import { brotliCompressSync, constants as zlibConstants, gunzipSync, gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertPiiProfileCostPublicEvidenceSafe, piiProfileCostCommitment,
  piiProfileCostPlan } from '../benchmarks/evaluation/domains/pii/profile-cost-v2.ts';
import { digest, exact, sha256, verifyImplementationFreeze } from './pii-profile-cost/adapter-protocol.mjs';

await verifyImplementationFreeze(piiProfileCostPlan);

const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(config|output)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('Invalid PII profile-cost size arguments');
  args[match[1]] = match[2];
}
if (!args.config || !args.output) throw new Error('Required: --config=<json> --output=<json>');
const config = JSON.parse(await readFile(path.resolve(args.config), 'utf8'));
if (!exact(config, ['schemaVersion', 'producer', 'baseline', 'candidate']) || config.schemaVersion !== 1) throw new Error('Invalid size configuration');
const officialProducer = piiProfileCostPlan.implementationFreeze.files.find(row => row.path === 'scripts/prepare-pii-profile-cost-size-config-v2.mjs');
if (!officialProducer || JSON.stringify(config.producer) !== JSON.stringify({ id: 'prepare-pii-profile-cost-size-config-v2', sha256: officialProducer.sha256 }) ||
    sha256(await readFile(path.resolve('scripts/prepare-pii-profile-cost-size-config-v2.mjs'))) !== officialProducer.sha256 ||
    process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== 'redact-secret/redact-secret-benchmarks' ||
    process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_JOB !== 'size' ||
    !/^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost-v2\.yml@/.test(process.env.GITHUB_WORKFLOW_REF ?? '') ||
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== process.env.GITHUB_SHA ||
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '')
  throw new Error('Size collection requires the clean official PII profile-cost workflow and configuration producer');

const expected = {
  baseline: { commit: piiProfileCostPlan.inputs.distributionBaselineProductCommit,
    run: piiProfileCostPlan.inputs.distributionBaselineQualificationRun,
    inventorySha256: piiProfileCostPlan.inputs.distributionBaselineInventorySha256 },
  candidate: { commit: piiProfileCostPlan.inputs.candidateProductCommit, run: piiProfileCostPlan.inputs.candidateQualificationRun,
    inventorySha256: piiProfileCostPlan.inputs.candidateInventorySha256 },
};
async function loadSide(id) {
  const side = config[id];
  if (!exact(side, ['productCheckout', 'inventory', 'inventorySha256', 'npmTarballs', 'wasm', 'browserBundles']) ||
      !exact(side.productCheckout, ['path', 'commit']) || side.productCheckout.commit !== expected[id].commit ||
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: side.productCheckout.path, encoding: 'utf8' }).trim() !== expected[id].commit ||
      execFileSync('git', ['status', '--porcelain'], { cwd: side.productCheckout.path, encoding: 'utf8' }).trim() !== '' ||
      !digest(side.inventorySha256) ||
      !Array.isArray(side.npmTarballs) || !Array.isArray(side.wasm) || !Array.isArray(side.browserBundles))
    throw new Error(`Invalid ${id} size configuration`);
  const inventoryBytes = await readFile(path.resolve(side.inventory));
  if (side.inventorySha256 !== expected[id].inventorySha256 || sha256(inventoryBytes) !== side.inventorySha256)
    throw new Error(`${id} inventory digest mismatch`);
  const inventory = JSON.parse(inventoryBytes);
  if (inventory.sourceCommit !== expected[id].commit || Number(inventory.workflowRun) !== expected[id].run ||
      inventory.sourceRef !== 'refs/heads/main' || !Array.isArray(inventory.artifacts)) throw new Error(`${id} inventory identity mismatch`);
  // v2: the default roster must be present on both sides; the candidate may add PII-only families (redact-secret#937).
  const families = [...new Set(inventory.artifacts.map(row => row.family))].sort();
  const defaults = families.filter(family => !/pii/.test(family));
  if (JSON.stringify(defaults) !== JSON.stringify([...piiProfileCostPlan.artifactRoster.qualificationFamilies].sort()) ||
      (id === 'baseline' && defaults.length !== families.length))
    throw new Error(`${id} qualification artifact roster mismatch`);
  const lane = inventory.cleanInstallQualification?.filter(row => row.lane === 'node');
  if (lane?.length !== 1) throw new Error(`${id} node qualification lane mismatch`);
  const npm = [];
  for (const row of side.npmTarballs) {
    if (!exact(row, ['id', 'path', 'sha256']) || !piiProfileCostPlan.artifactRoster.npmPackages.includes(row.id) || !digest(row.sha256))
      throw new Error(`Invalid ${id} npm tarball`);
    const bytes = await readFile(path.resolve(row.path));
    const packageName = { core: '@redact-secret/core', node: '@redact-secret/node-linux-x64-gnu', wasm: '@redact-secret/wasm' }[row.id];
    if (sha256(bytes) !== row.sha256 || lane[0].packages.filter(pkg => pkg.name === packageName && pkg.sha256 === row.sha256).length !== 1)
      throw new Error(`${id} npm tarball identity mismatch: ${row.id}`);
    let offset = 0, unpackedBytes = 0;
    const tar = gunzipSync(bytes);
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512); if (header.every(value => value === 0)) break;
      const size = Number.parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim() || '0', 8);
      if (['0', '\0'].includes(String.fromCharCode(header[156]))) unpackedBytes += size;
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    npm.push({ id: row.id, packedBytes: bytes.length, unpackedBytes, sha256: row.sha256 });
  }
  if (JSON.stringify(npm.map(row => row.id).sort()) !== JSON.stringify([...piiProfileCostPlan.artifactRoster.npmPackages].sort()))
    throw new Error(`${id} npm tarball roster mismatch`);
  const wasm = [];
  for (const row of side.wasm) {
    const pii = typeof row.profile === 'string' && /^pii:wasm-[a-z0-9-]*pii[a-z0-9-]*$/.test(row.profile);
    if (!exact(row, ['profile', 'path', 'sha256']) || !(['full', 'common'].includes(row.profile) || (pii && id === 'candidate')) || !digest(row.sha256))
      throw new Error(`Invalid ${id} wasm input`);
    const bytes = await readFile(path.resolve(row.path));
    if (sha256(bytes) !== row.sha256 || (!pii && inventory.artifacts.filter(artifact => artifact.family === (row.profile === 'full' ? 'browser' : 'browser-common') &&
        artifact.file.endsWith('_bg.wasm') && artifact.sha256 === row.sha256 && artifact.bytes === bytes.length).length !== 1) ||
        (pii && inventory.artifacts.filter(artifact => /pii/.test(artifact.family) && artifact.sha256 === row.sha256 && artifact.bytes === bytes.length).length !== 1))
      throw new Error(`${id} wasm identity mismatch: ${row.profile}`);
    wasm.push({ profile: row.profile, sha256: row.sha256, raw: bytes.length,
      gzip9: gzipSync(bytes, { level: 9, mtime: 0 }).length,
      brotli11: brotliCompressSync(bytes, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length });
  }
  if (JSON.stringify(wasm.map(row => row.profile).filter(profile => !profile.startsWith('pii:')).sort()) !== JSON.stringify(['common', 'full']))
    throw new Error(`${id} wasm roster mismatch`);
  const browserBundles = [];
  for (const row of side.browserBundles) {
    const expectedEntry = row.profile === 'full' ? '@redact-secret/core' : '@redact-secret/core/common';
    if (!exact(row, ['profile', 'tool', 'entry', 'bundleManifestCommitment', 'files']) || !['full', 'common'].includes(row.profile) ||
        row.tool !== 'vite-8.3.0' || row.entry !== expectedEntry || !digest(row.bundleManifestCommitment) ||
        !Array.isArray(row.files) || !row.files.length)
      throw new Error(`Invalid ${id} browser consumer bundle`);
    let bytes = 0, gzip9 = 0; const emittedFiles = [];
    for (const entry of row.files) {
      if (!exact(entry, ['path', 'relativePath', 'sha256']) || typeof entry.relativePath !== 'string' ||
          path.isAbsolute(entry.relativePath) || entry.relativePath.includes('..') || !digest(entry.sha256))
        throw new Error(`Invalid ${id} browser bundle file`);
      const content = await readFile(path.resolve(entry.path));
      if (sha256(content) !== entry.sha256) throw new Error(`${id} browser consumer bundle digest mismatch: ${row.profile}`);
      bytes += content.length; gzip9 += gzipSync(content, { level: 9, mtime: 0 }).length;
      emittedFiles.push({ relativePath: entry.relativePath, sha256: entry.sha256, bytes: content.length });
    }
    emittedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    if (new Set(emittedFiles.map(entry => entry.relativePath)).size !== emittedFiles.length ||
        !emittedFiles.some(entry => entry.relativePath.endsWith('.js')) || !emittedFiles.some(entry => entry.relativePath.endsWith('.wasm')) ||
        row.bundleManifestCommitment !== piiProfileCostCommitment({ profile: row.profile, tool: row.tool, entry: row.entry,
          files: emittedFiles.map(({ relativePath, sha256: digest }) => ({ relativePath, sha256: digest })) }))
      throw new Error(`${id} browser consumer bundle manifest mismatch: ${row.profile}`);
    browserBundles.push({ profile: row.profile, tool: row.tool, entry: row.entry,
      bundleManifestCommitment: row.bundleManifestCommitment, emittedFiles, bytes, gzip9 });
  }
  if (JSON.stringify(browserBundles.map(row => row.profile).sort()) !== JSON.stringify(['common', 'full']))
    throw new Error(`${id} browser consumer bundle roster mismatch`);
  return { inventoryCommitment: side.inventorySha256, inventory, npm, wasm, browserBundles };
}

const [baseline, candidate] = await Promise.all([loadSide('baseline'), loadSide('candidate')]);
const artifactKey = row => `${row.family}/${row.target ?? 'portable'}/${row.artifact}/${row.file}`;
const baselineArtifacts = new Map(baseline.inventory.artifacts.map(row => [artifactKey(row), row]));
const candidateArtifacts = new Map(candidate.inventory.artifacts.map(row => [artifactKey(row), row]));
const candidateOnly = [...candidateArtifacts.keys()].filter(key => !baselineArtifacts.has(key));
if ([...baselineArtifacts.keys()].some(key => !candidateArtifacts.has(key)) || candidateOnly.some(key => !/pii/.test(candidateArtifacts.get(key).family)))
  throw new Error('Baseline/candidate qualification artifact roster mismatch');
const budget = (id, baselineBytes, candidateBytes, floorBytes) => {
  const deltaBytes = candidateBytes - baselineBytes, allowedBytes = Math.max(Math.ceil(baselineBytes * 0.05), floorBytes);
  return { id, baselineBytes, candidateBytes, deltaBytes, relative: baselineBytes === 0 ? null : deltaBytes / baselineBytes,
    threshold: { source: 'regression-budgets-v1', relative: 0.05, absoluteFloorBytes: floorBytes },
    verdict: deltaBytes > allowedBytes ? 'regression' : 'within-budget' };
};
const qualificationArtifacts = [...baselineArtifacts].map(([id, row]) => budget(id, row.bytes, candidateArtifacts.get(id).bytes,
  ['node-addon', 'cli', 'python-wheel'].includes(row.family) ? 16384 : 4096));
const npmPackages = baseline.npm.flatMap(row => ['packedBytes', 'unpackedBytes'].map(kind =>
  budget(`${row.id}/${kind === 'packedBytes' ? 'packed' : 'unpacked'}`, row[kind], candidate.npm.find(item => item.id === row.id)[kind], 4096)));
// Candidate-only PII artifacts have no pre-existing budget: reported apart, never folded into a default row.
const piiArtifacts = [
  ...candidateOnly.map(key => ({ id: key, candidateBytes: candidateArtifacts.get(key).bytes, verdict: 'no-frozen-budget' })),
  ...candidate.wasm.filter(row => row.profile.startsWith('pii:')).flatMap(row => ['raw', 'gzip9', 'brotli11'].map(kind =>
    ({ id: `wasm/${row.profile}/${kind}`, candidateBytes: row[kind], verdict: 'no-frozen-budget' }))),
];
const wasmCompression = baseline.wasm.flatMap(row => ['raw', 'gzip9', 'brotli11'].map(kind =>
  budget(`${row.profile}/${kind}`, row[kind], candidate.wasm.find(item => item.profile === row.profile)[kind], 4096)));
const browserBundle = baseline.browserBundles.flatMap(row => ['bytes', 'gzip9'].map(kind => ({
  ...budget(`${row.profile}/${kind}`, row[kind], candidate.browserBundles.find(item => item.profile === row.profile)[kind], 4096),
  tool: row.tool, entry: row.entry,
  baselineBundleManifestCommitment: row.bundleManifestCommitment,
  comparisonBundleManifestCommitment: candidate.browserBundles.find(item => item.profile === row.profile).bundleManifestCommitment,
  baselineEmittedFiles: row.emittedFiles, comparisonEmittedFiles: candidate.browserBundles.find(item => item.profile === row.profile).emittedFiles,
})));
const projection = { schemaVersion: 1, reportType: 'pii-profile-cost-size', supportClaims: false,
  planCommitment: piiProfileCostPlan.contentCommitment,
  provenance: { kind: 'github-actions', runId: process.env.GITHUB_RUN_ID, benchmarkCommit: process.env.GITHUB_SHA,
    workflowRef: process.env.GITHUB_WORKFLOW_REF, configProducerSha256: officialProducer.sha256 },
  baseline: { sourceCommit: expected.baseline.commit, qualificationRun: expected.baseline.run,
    inventoryCommitment: baseline.inventoryCommitment },
  comparison: { sourceCommit: expected.candidate.commit, qualificationRun: expected.candidate.run,
    inventoryCommitment: candidate.inventoryCommitment },
  baselineSemantic: 'distribution', browserBundleDefinition: 'vite-minified-consumer-all-emitted-assets-summed-per-file-raw-and-gzip9-bytes',
  qualificationArtifacts, npmPackages, wasmCompression, browserBundle, piiArtifacts };
assertPiiProfileCostPublicEvidenceSafe(projection);
const output = { ...projection, artifactCommitment: piiProfileCostCommitment(projection) };
await writeFile(path.resolve(args.output), `${JSON.stringify(output, null, 2)}\n`);
console.log(`${output.artifactCommitment} ${qualificationArtifacts.length + npmPackages.length + wasmCompression.length + browserBundle.length} size rows`);
