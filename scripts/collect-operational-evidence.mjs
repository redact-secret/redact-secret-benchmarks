/**
 * Operational performance and artifact-size evidence (#141). Deterministically
 * assembles `benchmarks/operational-evidence.json` from inputs that were
 * measured elsewhere, so every number names the run or artifact it came from:
 *
 *  - timings, memory and throughput: the committed release-build performance
 *    summary (`evidence/603/summary.json`, produced by
 *    `.github/workflows/performance-evaluation.yml`) and its acceptance verdict,
 *    kept in separate sections so a measurement is never read as a judgement;
 *  - artifact sizes: the product's artifact-qualification inventory
 *    (`artifact-inventory.json`) for native addons, wheels, CLI binaries and the
 *    wasm-bindgen outputs;
 *  - compressed WebAssembly sizes: gzip (level 9) and brotli (quality 11) of the
 *    `.wasm` files downloaded from that same qualification run;
 *  - npm packed/unpacked size: the candidate tarballs themselves;
 *  - minimal browser bundle: a Vite production build of the quickstart's
 *    browser `main.js` against the candidate tarballs.
 *
 * Run (all paths required):
 *   node scripts/collect-operational-evidence.mjs \
 *     --summary evidence/603/summary.json --acceptance evidence/603/acceptance.json \
 *     --performance-run <id> --inventory <artifact-inventory.json> --qualification-run <id> \
 *     --wasm-dir <dir> --npm core=<tgz> --npm wasm=<tgz> --npm node-darwin-arm64=<tgz> \
 *     --bundle-dir <vite dist> --bundle-tool "vite 7.3.6" --measured-at YYYY-MM-DD \
 *     --out benchmarks/operational-evidence.json
 */
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { gzipSync, gunzipSync, brotliCompressSync, constants } from 'node:zlib';
import path from 'node:path';

const args = { npm: [] };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, ''); const value = process.argv[i + 1];
  if (key === 'npm') args.npm.push(value); else args[key] = value;
}
for (const k of ['summary', 'acceptance', 'performance-run', 'inventory', 'qualification-run', 'wasm-dir', 'bundle-dir', 'bundle-tool', 'measured-at', 'out'])
  if (!args[k]) throw new Error(`missing --${k}`);

const json = async p => JSON.parse(await readFile(p, 'utf8'));
const summary = await json(args.summary);
const acceptance = await json(args.acceptance);
const inventory = await json(args.inventory);
if (summary.sourceCommit !== acceptance.sourceCommit || summary.sourceCommit !== inventory.sourceCommit)
  throw new Error(`source commits differ: summary ${summary.sourceCommit}, acceptance ${acceptance.sourceCommit}, inventory ${inventory.sourceCommit}`);

const dist = d => ({ median: d.median, p95: d.p95, minimum: d.minimum, maximum: d.maximum, standardDeviation: d.standardDeviation, samples: d.samples.length, unit: d.unit });
const timings = summary.runs.filter(r => r.kind === 'performance').map(r => {
  const p = r.result.performance, prov = r.result.provenance;
  const memory = {};
  for (const [category, m] of Object.entries(p.memory)) {
    if (!m.samples?.length) { memory[category] = { unavailableReason: m.unavailableReason ?? m.samplingLimit ?? 'not sampled' }; continue; }
    const observed = m.samples.map(s => typeof s === 'number' ? s : (s.maximumObservedBytes ?? 0));
    const growth = m.samples.map(s => typeof s === 'number' ? null : Math.max(0, (s.maximumObservedBytes ?? 0) - (s.baselineBytes ?? 0)));
    memory[category] = { maximumObservedBytes: Math.max(...observed),
      maximumGrowthBytes: growth.every(g => g === null) ? null : Math.max(...growth.filter(g => g !== null)), samples: observed.length, unit: 'bytes' };
  }
  return {
    surface: r.surface, profileId: r.profileId, path: r.path,
    environment: { os: prov.os ?? null, cpu: prov.cpu ?? null, runtime: prov.runtime ?? null, buildProfile: prov.buildProfile ?? null, artifactIdentity: prov.artifactIdentity ?? null },
    initialization: dist(p.initialization), processing: dist(p.processing),
    throughput: { median: p.throughput.median, minimum: p.throughput.minimum, unit: p.throughput.unit },
    memory,
  };
}).sort((a, b) => `${a.surface}/${a.profileId}`.localeCompare(`${b.surface}/${b.profileId}`));

const pick = family => inventory.artifacts.filter(a => a.family === family);
const binary = /\.(node|whl|wasm)$|^redact-secret(\.exe)?$/;
const nativeAddons = pick('node-addon').filter(a => a.file.endsWith('.node')).map(a => ({ target: a.target, file: a.file, bytes: a.bytes, sha256: a.sha256 }));
const pythonWheels = pick('python-wheel').map(a => ({ target: a.target, file: a.file, bytes: a.bytes, sha256: a.sha256 }));
const cli = pick('cli').filter(a => binary.test(a.file)).map(a => ({ target: a.target, file: a.file, bytes: a.bytes, sha256: a.sha256 }));
const byTarget = (a, b) => String(a.target).localeCompare(String(b.target));
[nativeAddons, pythonWheels, cli].forEach(list => list.sort(byTarget));

const wasm = [];
for (const [profile, family] of [['full', 'browser'], ['common', 'browser-common']]) {
  const entries = pick(family);
  const wasmEntry = entries.find(a => a.file.endsWith('.wasm'));
  const glue = entries.find(a => a.file.endsWith('.js'));
  const bytes = await readFile(path.join(args['wasm-dir'], wasmEntry.artifact, wasmEntry.file));
  if (bytes.length !== wasmEntry.bytes) throw new Error(`${wasmEntry.file}: downloaded ${bytes.length} bytes, inventory says ${wasmEntry.bytes}`);
  wasm.push({
    profile, artifact: wasmEntry.artifact, file: wasmEntry.file, sha256: wasmEntry.sha256,
    rawBytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
    brotliBytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    jsGlueBytes: glue?.bytes ?? null,
  });
}

/** Sum of regular-file sizes in a ustar archive (npm pack output), read from the 512-byte headers. */
function tarRegularFiles(buffer) {
  let offset = 0, unpacked = 0, files = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    if (type === '0' || type === '\0') { unpacked += size; files++; }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return { unpacked, files };
}

const npmPackages = [];
for (const spec of args.npm) {
  const [label, file] = spec.split('=');
  const packed = (await stat(file)).size;
  const { unpacked, files } = tarRegularFiles(gunzipSync(await readFile(file)));
  npmPackages.push({ label, file: path.basename(file), packedBytes: packed, unpackedBytes: unpacked, files });
}

const bundleFiles = [];
for (const dir of ['', 'assets']) {
  const root = path.join(args['bundle-dir'], dir);
  for (const name of (await readdir(root, { withFileTypes: true })).filter(e => e.isFile()).map(e => e.name)) {
    const bytes = await readFile(path.join(root, name));
    bundleFiles.push({ file: path.posix.join(dir, name.replace(/-[A-Za-z0-9_]{8}(?=\.)/, '-<hash>')), kind: path.extname(name).slice(1),
      bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length });
  }
}
bundleFiles.sort((a, b) => a.file.localeCompare(b.file));
const total = (kind, key) => bundleFiles.filter(f => !kind || f.kind === kind).reduce((s, f) => s + f[key], 0);

const evidence = {
  schemaVersion: 1,
  issue: 141,
  sourceCommit: summary.sourceCommit,
  productVersion: inventory.productVersion,
  measuredAt: args['measured-at'],
  provenance: {
    performanceRun: args['performance-run'], performanceSummaryPath: args.summary,
    qualificationRun: args['qualification-run'], repetitions: summary.repetitions,
    workloadProfiles: summary.workloadProfiles, officialProfile: 'linux-x64 release builds (performance workflow on ubuntu-latest)',
    buildProfile: 'release for every surface: napi build --release (Node addon), build-browser-artifact.mjs default release profile (wasm), cargo build --release (CLI and Rust core), maturin build --release (Python); only the Rust core result records it in its own provenance, the others report null',
  },
  measurements: {
    timings,
    artifacts: { nativeAddons, pythonWheels, cli, wasm, npmPackages },
    browserBundle: { tool: args['bundle-tool'], entry: 'docs/quickstart.md browser main.js (initialize + scanAndRedact)', files: bundleFiles,
      totals: { jsBytes: total('js', 'bytes'), jsGzipBytes: total('js', 'gzipBytes'), wasmBytes: total('wasm', 'bytes'), wasmGzipBytes: total('wasm', 'gzipBytes'), allBytes: total(null, 'bytes'), allGzipBytes: total(null, 'gzipBytes') } },
  },
  judgement: {
    criteriaId: acceptance.criteriaId, criteriaFixedAt: acceptance.criteriaFixedAt, status: acceptance.status,
    checksPassed: acceptance.checks.filter(c => c.passed).length, checksTotal: acceptance.checks.length,
    note: 'Acceptance of the timing and memory measurements against benchmarks/performance-criteria.json. Artifact sizes carry no threshold and no verdict.',
  },
  limitations: [
    'Timings are host-dependent. They come from one Linux x86_64 GitHub-hosted runner, five repetitions each, and do not transfer to other hosts or architectures.',
    'Initialization and processing are measured and reported separately; neither includes the other.',
    'Each surface (Rust core, Node native addon, browser WebAssembly, Python, CLI) is reported on its own. No combined score is computed.',
    'The Node WebAssembly fallback lane is qualified for behavior in artifact qualification but has no timing profile of its own here.',
    'The browser bundle is a Vite build of the quickstart on the candidate tarballs built on darwin-arm64; its wasm asset can differ by a few bytes from the Linux-built wasm-web artifact reported under artifacts.',
    'Adapter traversal and host overhead are not measured: no compatible evidence exists at this commit.',
    'No cross-product speed comparison is made, because detection scope and output semantics differ between scanners.',
  ],
};
await writeFile(args.out, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${args.out}: ${timings.length} timing rows, ${nativeAddons.length} addons, ${pythonWheels.length} wheels, ${cli.length} CLI binaries, ${wasm.length} wasm profiles, ${npmPackages.length} npm packages, ${bundleFiles.length} bundle files.`);
