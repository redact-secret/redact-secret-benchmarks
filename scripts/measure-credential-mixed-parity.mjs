/**
 * Measure the frozen #381 credential mixed-document parity plan on every surface an exact core commit provides
 * (benchmarks #381, parent #376). Reuses the #427 surface runners (scripts/pii-parity/*) unchanged, with an empty PII
 * selection, and adds the byte-input stream adapters for the JavaScript surfaces (scripts/credential-parity/node-child.mjs).
 *
 * Target: an exact clean core commit (`--core-commit=<40-hex> --core-repo=<absolute path>`), built in a detached worktree
 * with the core repository's own recipe (`benchmark-candidate`: `js:build`, the Node addon build, `wasm:build` and
 * `wasm:build:common`, then `npm pack`), `maturin build --release --locked` for the wheel and
 * `cargo build --release --locked -p redact-secret-cli` for the CLI; the Rust runner depends on the checkout by path.
 *
 * Surfaces: Node addon and Node Wasm fallback (each with Node `Transform` and Web `TransformStream` byte streams), browser
 * Wasm (headless Chrome), Python extension, Rust crate and CLI. No input or output text is written: findings carry type,
 * detector, action and ranges; outputs are SHA-256 digests plus the ids of targets whose value survived.
 *
 * Run: node --import tsx scripts/measure-credential-mixed-parity.mjs --core-commit=<sha> --core-repo=<path>
 *        [--surfaces=a,b] [--out-dir=results-output/credential-mixed-parity/<fresh-run>] [--keep-scratch]
 */
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CREDENTIAL_MIXED_PARITY_PLAN_FILE, loadCorpora } from '../benchmarks/evaluation/domains/credential/mixed-parity/authoring.ts';
import { VARIANTS, bytePartitions, loadPlan, materialize, offsetTables, partitions, planCommitment, sha256, variantOf, leakedTargets } from '../benchmarks/evaluation/domains/credential/mixed-parity/parity.ts';
import { SURFACES, buildCredentialParityReport } from '../benchmarks/evaluation/domains/credential/mixed-parity/report.ts';
import { renderCredentialMixedParityPlan } from './generate-credential-mixed-parity.mjs';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { measurementOutput, stagedMeasurementDirectory } from './lib/measurement-output.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(core-commit|core-repo|surfaces|out-dir|keep-scratch)(?:=(.+))?$/.exec(argument);
  if (!match) throw new Error(`Unknown argument ${argument}`); return [match[1], match[2] ?? true];
}));
if (!/^[0-9a-f]{40}$/.test(args['core-commit'] ?? '') || !path.isAbsolute(args['core-repo'] ?? ''))
  throw new Error('needs --core-commit=<40-hex sha> and an absolute --core-repo=<path>');
const surfacesRequested = args.surfaces ? String(args.surfaces).split(',') : SURFACES;
for (const surface of surfacesRequested) if (!SURFACES.includes(surface)) throw new Error(`unknown surface ${surface}`);
const outDir = measurementOutput(path.resolve(root, args['out-dir'] ?? `results-output/credential-mixed-parity/${String(args['core-commit']).slice(0, 12)}-${Date.now()}`), root, { directory: true });
const INCREMENTAL_LIMITS = { maxInput: 1 << 20, maxBuffered: 1 << 16, maxToken: 8192, maxMultiline: 16384 };
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const run = async (command, argv, options = {}) => (await exec(command, argv, { maxBuffer: 512 * 1024 * 1024, timeout: 60 * 60_000, ...options })).stdout;

// 1. Expectations are frozen before any scan: the plan and its derivation must be committed, clean and regenerable.
const frozenPaths = [CREDENTIAL_MIXED_PARITY_PLAN_FILE, 'scripts/generate-credential-mixed-parity.mjs',
  'benchmarks/evaluation/domains/credential/mixed-parity/authoring.ts', 'benchmarks/evaluation/domains/credential/mixed-parity/parity.ts'];
if ((await run('git', ['status', '--porcelain', '--', ...frozenPaths], { cwd: root })).trim()) throw new Error('the #381 plan is not committed; freeze expectations before scanning');
if (renderCredentialMixedParityPlan() !== readFileSync(path.join(root, CREDENTIAL_MIXED_PARITY_PLAN_FILE), 'utf8')) throw new Error('the #381 plan drifted from its authored rule');
const planFrozenAt = (await run('git', ['log', '-1', '--format=%H', '--', CREDENTIAL_MIXED_PARITY_PLAN_FILE], { cwd: root })).trim();
const benchmarkCommit = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).trim();
const harnessDirty = Boolean((await run('git', ['status', '--porcelain', '--', 'scripts/measure-credential-mixed-parity.mjs', 'scripts/credential-parity',
  'scripts/pii-parity', 'benchmarks/evaluation/domains/credential/mixed-parity/report.ts'], { cwd: root })).trim());
const plan = loadPlan(CREDENTIAL_MIXED_PARITY_PLAN_FILE, file => readFileSync(path.join(root, file), 'utf8'));
const documents = materialize(plan, loadCorpora());

// 2. Jobs: every document in both line-ending variants, with its partitions and limit probes (credential detectors only).
const shapedCases = documents.flatMap(document => VARIANTS.map(variant => ({ key: `${document.id}/${variant}`, document: variantOf(document, variant), variant })));
function job({ bytes = false } = {}) {
  return { selectors: [], incrementalLimits: INCREMENTAL_LIMITS, cases: shapedCases.map(({ key, document, variant }) => {
    const size = Buffer.byteLength(document.input), units = document.input.length;
    const rows = partitions(document, variant);
    const inside = rows.find(row => row.id === 'inside-every-target').cuts;
    const under = { ...INCREMENTAL_LIMITS, maxInput: units - 1, maxToken: Math.min(INCREMENTAL_LIMITS.maxToken, units - 1), maxMultiline: Math.min(INCREMENTAL_LIMITS.maxMultiline, units - 1) };
    return { key, input: document.input, partitions: rows.map(({ id, cuts }) => ({ id, cuts })),
      wholeLimits: [{ id: 'input-exact', maxInputBytes: size, maxFindings: 50_000 }, { id: 'input-under', maxInputBytes: size - 1, maxFindings: 50_000 }],
      incrementalFailures: [{ id: 'input-under', limits: under, cuts: inside }],
      ...(bytes ? { bytePartitions: bytePartitions(document, variant).map(({ id, cuts }) => ({ id, cuts })) } : {}) };
  }) };
}
const rustJob = j => [`SEL`, `ILIM ${j.incrementalLimits.maxInput} ${j.incrementalLimits.maxBuffered} ${j.incrementalLimits.maxToken} ${j.incrementalLimits.maxMultiline}`,
  ...j.cases.flatMap(row => [`CASE ${row.key} ${Buffer.from(row.input).toString('hex')}`,
    ...row.partitions.map(p => `PART ${p.id} ${p.cuts.length ? p.cuts.join(',') : '-'}`),
    ...row.wholeLimits.map(l => `WLIM ${l.id} ${l.maxInputBytes} ${l.maxFindings}`),
    ...row.incrementalFailures.map(f => `IFAIL ${f.id} ${f.limits.maxInput} ${f.limits.maxBuffered} ${f.limits.maxToken} ${f.limits.maxMultiline} ${f.cuts.length ? f.cuts.join(',') : '-'}`), 'END'])].join('\n') + '\n';

// 3. Artifacts at the exact core commit.
const nodePackage = () => ({ 'darwin-arm64': 'node-darwin-arm64', 'darwin-x64': 'node-darwin-x64', 'linux-x64': 'node-linux-x64-gnu', 'linux-arm64': 'node-linux-arm64-gnu' })[`${process.platform}-${process.arch}`];
async function buildRustRunner(scratch, dependency) {
  const project = path.join(scratch, 'rust-runner');
  await cp(path.join(root, 'scripts/pii-parity/rust-runner/src'), path.join(project, 'src'), { recursive: true });
  await writeFile(path.join(project, 'Cargo.toml'), `[package]\nname = "pii-parity-rust-runner"\nversion = "0.0.0"\nedition = "2021"\npublish = false\n\n[dependencies]\n${dependency}\n\n[workspace]\n`);
  await run('cargo', ['build', '--release', '--quiet'], { cwd: project, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, 'rust-runner-target') } });
  return path.join(scratch, 'rust-runner-target', 'release', 'pii-parity-rust-runner');
}
async function coreCommitArtifacts(scratch) {
  const repo = args['core-repo'], commit = args['core-commit'], checkout = path.join(scratch, 'core');
  await run('git', ['-C', repo, 'worktree', 'add', '--detach', checkout, commit]);
  try {
    if ((await run('git', ['rev-parse', 'HEAD'], { cwd: checkout })).trim() !== commit) throw new Error('core checkout head mismatch');
    const env = { ...process.env, npm_config_update_notifier: 'false' };
    await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: checkout, env });
    await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: path.join(checkout, 'bindings/node'), env });
    await run(npm, ['run', 'js:build'], { cwd: checkout, env });
    await run(npm, ['run', 'build'], { cwd: path.join(checkout, 'bindings/node'), env });
    const wasmOut = path.join(scratch, 'wasm-output'), wasmCommonOut = path.join(scratch, 'wasm-common-output'), packDir = path.join(scratch, 'npm');
    await run(npm, ['run', 'wasm:build', '--', '--out-dir', wasmOut], { cwd: checkout, env });
    await run(npm, ['run', 'wasm:build:common', '--', '--out-dir', wasmCommonOut], { cwd: checkout, env });
    await mkdir(packDir);
    const pack = async directory => path.join(packDir, JSON.parse(await run(npm, ['pack', '--json', '--pack-destination', packDir], { cwd: directory, env }))[0].filename);
    const core = await pack(path.join(checkout, 'packages/javascript'));
    const suffix = nodePackage().replace('node-', '');
    const nodeManifest = JSON.parse(await readFile(path.join(checkout, 'bindings/node/npm', suffix, 'package.json'), 'utf8'));
    const nodeStage = path.join(scratch, 'node-package'); await cp(path.join(checkout, 'bindings/node/npm', suffix), nodeStage, { recursive: true });
    await cp(path.join(checkout, 'bindings/node', nodeManifest.main), path.join(nodeStage, nodeManifest.main));
    const node = await pack(nodeStage);
    const wasmStage = path.join(scratch, 'wasm-package'); await cp(path.join(checkout, 'bindings/wasm/npm'), wasmStage, { recursive: true });
    await cp(wasmOut, wasmStage, { recursive: true }); await cp(wasmCommonOut, wasmStage, { recursive: true });
    const wasm = await pack(wasmStage);
    const wheelDir = path.join(scratch, 'wheel');
    await run('maturin', ['build', '--release', '--locked', '--quiet', '-m', 'bindings/python/Cargo.toml', '-o', wheelDir], { cwd: checkout });
    const [wheelName] = (await readdir(wheelDir)).filter(file => file.endsWith('.whl'));
    await run('cargo', ['build', '--release', '--locked', '--quiet', '-p', 'redact-secret-cli'], { cwd: checkout, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, 'core-target') } });
    const cli = path.join(scratch, 'core-target', 'release', 'redact-secret');
    const rustRunner = await buildRustRunner(scratch, `redact-secret = { path = "${path.join(checkout, 'crates/secret-scan-core')}" }`);
    const components = { core: await digest(core), node: await digest(node), wasm: await digest(wasm), wheel: await digest(path.join(wheelDir, wheelName)), cli: await digest(cli) };
    return { identity: { kind: 'core-commit', version: JSON.parse(await readFile(path.join(checkout, 'packages/javascript/package.json'), 'utf8')).version, sourceCommit: commit,
      coreCrateTree: (await run('git', ['rev-parse', `${commit}:crates/secret-scan-core`], { cwd: checkout })).trim(), components },
      tarballs: { core, node, wasm }, wheel: path.join(wheelDir, wheelName), cli, rustRunner, cleanup: async () => run('git', ['-C', repo, 'worktree', 'remove', '--force', checkout]) };
  } catch (error) { await run('git', ['-C', repo, 'worktree', 'remove', '--force', checkout]).catch(() => {}); throw error; }
}

// 4. Surfaces. Texts stay in this process; only digests and ranges leave it.
async function nodeSurface(scratch, tarballs, artifact) {
  const installation = await installCandidate(tarballs);
  try {
    if (artifact === 'wasm') {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const jobFile = path.join(scratch, `job-${artifact}.json`), outFile = path.join(scratch, `out-${artifact}.json`);
    await writeFile(jobFile, JSON.stringify(job({ bytes: true })));
    await run(process.execPath, [path.join(root, 'scripts/credential-parity/node-child.mjs'), installation.root, artifact, jobFile, outFile]);
    return { status: 'observed', result: JSON.parse(await readFile(outFile, 'utf8')), unit: 'utf16-code-units', runtime: process.version };
  } finally { await removeCandidate(installation); }
}
function chromePath() {
  for (const candidate of [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'])
    if (candidate && existsSync(candidate)) return candidate;
  return null;
}
async function browserSurface(scratch, tarballs) {
  const chrome = chromePath();
  if (!chrome) return { status: 'not-run', reason: 'no-headless-browser-on-host' };
  const installation = await installCandidate(tarballs);
  try {
    const moduleRoot = path.join(installation.root, 'node_modules');
    const page = `<!doctype html><meta charset="utf-8"><title>credential-381</title>
<script type="importmap">${JSON.stringify({ imports: { '#native': '/m/@redact-secret/core/dist/runtime/browser.js', '@redact-secret/wasm': '/m/@redact-secret/wasm/redact_secret_wasm.js' } })}</script>
<script type="module">
import * as api from '/m/@redact-secret/core/dist/index.js';
import { runJob } from '/runner/js-runner.mjs';
const post = body => fetch('/result', { method: 'POST', body: JSON.stringify(body) });
try {
  const job = await (await fetch('/job')).json();
  await api.initialize({});
  if (api.artifact() !== 'wasm') throw new Error('browser did not load wasm');
  await post(runJob(api, job));
} catch (error) { await post({ error: String((error && error.code) || error) }); }
</script>`;
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.html': 'text/html' };
    const body = JSON.stringify(job());
    let resolveResult; const received = new Promise(resolve => { resolveResult = resolve; });
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/result') { const parts = []; for await (const part of request) parts.push(part); response.end('ok'); resolveResult(JSON.parse(Buffer.concat(parts).toString('utf8'))); return; }
        if (url.pathname === '/') { response.setHeader('content-type', 'text/html'); response.end(page); return; }
        if (url.pathname === '/job') { response.setHeader('content-type', 'application/json'); response.end(body); return; }
        const file = url.pathname.startsWith('/m/') ? path.join(moduleRoot, url.pathname.slice(3)) : url.pathname === '/runner/js-runner.mjs' ? path.join(root, 'scripts/pii-parity/js-runner.mjs') : null;
        if (!file || !file.startsWith(moduleRoot) && !file.endsWith('js-runner.mjs')) { response.statusCode = 404; response.end(); return; }
        response.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file));
      } catch { response.statusCode = 404; response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(scratch, 'chrome')}`,
      `http://127.0.0.1:${server.address().port}/`], { stdio: 'ignore' });
    const timeout = setTimeout(() => resolveResult({ error: 'browser-timeout' }), 30 * 60_000);
    let result;
    try { result = await received; } finally { clearTimeout(timeout); browser.kill('SIGKILL'); server.close(); }
    if (result.error) throw new Error(`browser surface failed: ${result.error}`);
    return { status: 'observed', result, unit: 'utf16-code-units', runtime: (await run(chrome, ['--version'])).trim(),
      notApplicable: { streams: 'the page drives the shared job runner only; byte streams are measured in Node' } };
  } finally { await removeCandidate(installation); }
}
async function pythonSurface(scratch, wheel) {
  const venv = path.join(scratch, 'venv');
  await run('python3', ['-m', 'venv', venv]);
  const python = path.join(venv, 'bin', 'python');
  await run(python, ['-m', 'pip', 'install', '--quiet', '--no-deps', '--no-index', wheel]);
  const jobFile = path.join(scratch, 'job-python.json'), outFile = path.join(scratch, 'out-python.json');
  await writeFile(jobFile, JSON.stringify(job()));
  await run(python, [path.join(root, 'scripts/pii-parity/python_runner.py'), jobFile, outFile]);
  return { status: 'observed', result: JSON.parse(await readFile(outFile, 'utf8')), unit: 'unicode-code-points', runtime: (await run(python, ['--version'])).trim(),
    notApplicable: { streams: 'the Python binding has no byte-stream adapter' } };
}
const fromHex = value => Buffer.from(value, 'hex').toString('utf8');
function unhexResult(result) {
  const fix = op => { if (op && typeof op.textHex === 'string') { op.text = fromHex(op.textHex); delete op.textHex; } return op; };
  for (const row of result.cases) {
    fix(row.redact); fix(row.scanAndRedact); row.partitions.forEach(fix); row.incrementalFailures.forEach(fix);
    for (const limit of row.wholeLimits) { fix(limit.redact); fix(limit.scanAndRedact); }
  }
  return result;
}
async function rustSurface(scratch, runner) {
  const jobFile = path.join(scratch, 'job-rust.txt'), outFile = path.join(scratch, 'out-rust.json');
  await writeFile(jobFile, rustJob(job()));
  await run(runner, [jobFile, outFile]);
  return { status: 'observed', result: unhexResult(JSON.parse(await readFile(outFile, 'utf8'))), unit: 'utf8-bytes', runtime: (await run('rustc', ['--version'])).trim(),
    notApplicable: { streams: 'the Rust crate exposes the incremental sanitizer (partitions), not a stream adapter' } };
}
function spawnCollect(command, argv, chunks, delayMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { stdio: ['pipe', 'pipe', 'pipe'] }); const out = [];
    child.stdout.on('data', data => out.push(data)); child.stderr.on('data', () => {});
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout: Buffer.concat(out).toString('utf8') }));
    (async () => { for (const chunk of chunks) { child.stdin.write(chunk); if (delayMs) await new Promise(r => setTimeout(r, delayMs)); } child.stdin.end(); })().catch(reject);
  });
}
async function cliSurface(scratch, cli) {
  const j = job(); let rangeUnit = null, version = null; const cases = [];
  for (const row of j.cases) {
    const file = path.join(scratch, `cli-${row.key.replace('/', '-')}.txt`); await writeFile(file, row.input);
    const check = await spawnCollect(cli, ['--json', '--', file], [], 0);
    let scan;
    if (check.code === 0 || check.code === 1) {
      const report = JSON.parse(check.stdout); rangeUnit = report.rangeUnit; version = report.version;
      scan = report.failures.length ? { status: 'error', errorCode: report.failures[0].code }
        : { status: 'ok', findings: report.sources[0].findings.map(f => ({ type: f.type, detector: f.detector, action: f.action, confidence: f.confidence, start: f.start, end: f.end })) };
    } else scan = { status: 'error', errorCode: `exit-${check.code}` };
    const redactPath = await spawnCollect(cli, ['--redact', '--', file], [], 0);
    const stdinWhole = await spawnCollect(cli, ['--redact'], [Buffer.from(row.input)], 0);
    const inside = row.partitions.find(p => p.id === 'inside-every-target').cuts;
    const points = Array.from(row.input), paced = []; let previous = 0;
    for (const cut of [...inside, points.length]) { paced.push(Buffer.from(points.slice(previous, cut).join(''))); previous = cut; }
    const stdinPaced = await spawnCollect(cli, ['--redact'], paced, 10);
    const asOp = result => result.code === 0 ? { status: 'ok', text: result.stdout } : { status: 'error', errorCode: `exit-${result.code}`, text: result.stdout };
    cases.push({ key: row.key, scan, scanAndRedact: { ...asOp(redactPath), findings: null },
      partitions: [{ id: 'cli-stdin-single-write', ...asOp(stdinWhole), findings: null }, { id: 'cli-stdin-paced-inside-every-target', ...asOp(stdinPaced), findings: null }] });
  }
  return { status: 'observed', result: { identity: { rangeUnit, version, artifact: 'cli-binary' }, cases }, unit: 'utf8-bytes',
    notApplicable: { redact: 'the CLI has no separate redact(findings) operation', wholeLimits: 'the CLI declares fixed limits; no caller-supplied whole-input limit',
      incrementalFailures: 'the CLI declares fixed incremental limits', streams: 'the CLI read loop is driven by one stdin write and one paced write' } };
}

// 5. Normalize: ranges to UTF-8 (range-unit errors counted), outputs to digests plus surviving-target ids.
const caseByKey = new Map(shapedCases.map(row => [row.key, row]));
function normalize(surfaceRun) {
  const cases = {};
  for (const row of surfaceRun.result.cases) {
    const { document } = caseByKey.get(row.key), tables = offsetTables(document.input);
    const op = (observed, unit = surfaceRun.unit) => {
      if (!observed) return { status: 'not-applicable' };
      if (observed.status !== 'ok') return { status: 'error', errorCode: observed.errorCode ?? null,
        ...(typeof observed.text === 'string' ? { emittedBytes: Buffer.byteLength(observed.text), emittedLeaks: leakedTargets(document, observed.text) } : {}) };
      let rangeUnitErrors = 0;
      const findings = observed.findings === null || observed.findings === undefined ? null : observed.findings.map(f => {
        const start = tables.toUtf8(f.start, unit), end = tables.toUtf8(f.end, unit);
        if (start === null || end === null) rangeUnitErrors += 1;
        return { type: f.type, detector: f.detector, action: f.action, confidence: f.confidence ?? null, start: start ?? -1, end: end ?? -1 };
      });
      const text = typeof observed.text === 'string' ? observed.text : null;
      return { status: 'ok', findings, outputSha256: text === null ? null : sha256(text), valueLeft: text === null ? [] : leakedTargets(document, text), rangeUnitErrors };
    };
    // Partitions and streams are stored as keys into a per-case table of distinct normalized results, so identical
    // outcomes (the common case) are written once.
    const signatures = {};
    const keyed = normalized => { const key = sha256(JSON.stringify(normalized)).slice(0, 16); signatures[key] = normalized; return key; };
    cases[row.key] = {
      scan: op(row.scan), redact: row.redact ? op(row.redact) : { status: 'not-applicable', reason: surfaceRun.notApplicable?.redact },
      scanAndRedact: op(row.scanAndRedact),
      partitions: Object.fromEntries((row.partitions ?? []).map(p => [p.id, keyed(op(p))])),
      // Streams report UTF-16 offsets into the logical whole-stream input, like the JavaScript API.
      streams: row.streams ? Object.fromEntries(row.streams.map(s => [s.id, keyed(op(s, 'utf16-code-units'))])) : null,
      signatures,
      wholeLimits: row.wholeLimits ? row.wholeLimits.map(limit => ({ id: limit.id,
        scan: limit.scan.status === 'ok' ? { status: 'ok', count: limit.scan.count } : { status: 'error', errorCode: limit.scan.errorCode },
        redact: limit.redact.status === 'ok' ? { status: 'ok', outputSha256: sha256(limit.redact.text) } : { status: 'error', errorCode: limit.redact.errorCode },
        scanAndRedact: limit.scanAndRedact.status === 'ok' ? { status: 'ok', outputSha256: sha256(limit.scanAndRedact.text) } : { status: 'error', errorCode: limit.scanAndRedact.errorCode } }))
        : null,
      incrementalFailures: row.incrementalFailures ? row.incrementalFailures.map(failure => ({ id: failure.id, status: failure.status, errorCode: failure.errorCode ?? null,
        emittedBytes: Buffer.byteLength(failure.text ?? ''), emittedLeaks: leakedTargets(document, failure.text ?? '') })) : null,
    };
  }
  return { identity: surfaceRun.result.identity, cases };
}

const scratch = await mkdtemp(path.join(tmpdir(), 'credential-381-parity-'));
let artifacts;
try {
  artifacts = await coreCommitArtifacts(scratch);
  console.log(`artifacts ready: ${artifacts.identity.sourceCommit}`);
  const surfaces = [];
  for (const surface of SURFACES) {
    if (!surfacesRequested.includes(surface)) { surfaces.push({ surface, status: 'not-run', reason: 'not-requested' }); continue; }
    const started = Date.now();
    const observed = surface === 'node-addon' ? await nodeSurface(scratch, artifacts.tarballs, 'addon')
      : surface === 'node-wasm' ? await nodeSurface(scratch, artifacts.tarballs, 'wasm')
      : surface === 'browser-wasm' ? await browserSurface(scratch, artifacts.tarballs)
      : surface === 'python' ? await pythonSurface(scratch, artifacts.wheel)
      : surface === 'rust' ? await rustSurface(scratch, artifacts.rustRunner)
      : await cliSurface(scratch, artifacts.cli);
    if (observed.status !== 'observed') { surfaces.push({ surface, status: observed.status, reason: observed.reason }); continue; }
    surfaces.push({ surface, status: 'observed', unit: observed.unit, runtime: observed.runtime ?? null, notApplicable: observed.notApplicable ?? null, ...normalize(observed) });
    console.log(`${surface}: observed in ${Math.round((Date.now() - started) / 1000)} s`);
  }
  const observation = {
    schemaVersion: 1, reportType: 'credential-mixed-parity-observation', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#381',
    plan: { path: CREDENTIAL_MIXED_PARITY_PLAN_FILE, frozenAt: planFrozenAt, commitment: planCommitment(plan) },
    benchmark: { commit: benchmarkCommit, harnessDirty }, target: artifacts.identity,
    platform: `${process.platform}-${process.arch}`, node: process.version, incrementalLimits: INCREMENTAL_LIMITS, surfaces,
  };
  const report = buildCredentialParityReport(observation, documents);
  stagedMeasurementDirectory(outDir, stage => {
    writeFileSync(path.join(stage, 'credential-mixed-parity-observation-v1.json'), `${JSON.stringify(observation)}\n`);
    writeFileSync(path.join(stage, 'credential-mixed-parity-report-v1.json'), `${JSON.stringify(report, null, 2)}\n`);
  });
  for (const row of report.surfaceSummary) console.log(JSON.stringify(row));
  console.log(JSON.stringify(report.acceptance));
} finally {
  if (artifacts?.cleanup) await artifacts.cleanup().catch(() => {});
  if (!args['keep-scratch']) await rm(scratch, { recursive: true, force: true });
  else console.log(`scratch kept at ${scratch}`);
}
