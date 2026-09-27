import { brotliCompressSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { parsePiiArrivalRuntimeSampleProcess, piiArrivalOperationalSampleProtocol,
  validatePiiArrivalWasmPayloadRoster } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';

const execFile = promisify(execFileCallback);
const rawArgs = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument); if (!match) throw new Error('invalid arguments'); return [match[1], match[2]];
}));
for (const side of ['baseline', 'candidate']) for (const role of ['core', 'node', 'wasm'])
  if (!rawArgs[`${side}-${role}`]) throw new Error(`missing --${side}-${role}`);
for (const side of ['baseline', 'candidate']) if (!/^[a-f0-9]{40}$/.test(rawArgs[`${side}-source-commit`] ?? ''))
  throw new Error(`missing or invalid --${side}-source-commit`);
if (!rawArgs.output || !rawArgs.contract) throw new Error('missing --output or --contract');
const args = Object.fromEntries(Object.entries(rawArgs).map(([key, value]) =>
  [key, key.endsWith('commit') ? value : path.resolve(value)]));
const contract = JSON.parse(await readFile(args.contract, 'utf8'));
const samples = contract.operational.minimumPairedSamples;
if (!Number.isInteger(samples) || samples < 10) throw new Error('operational contract requires at least ten paired samples');
const digest = value => createHash('sha256').update(value).digest('hex');
const fileDigest = async location => digest(await readFile(location));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = value => digest(JSON.stringify(canonical(value)));
const profiles = contract.operational.profiles.map(profile => [profile, contract.operational.profileSelections[profile]]);
if (profiles.some(([, selection]) => !selection?.baseline || !selection?.candidate))
  throw new Error('operational profile selection policy is incomplete');
const workload = [
  'authorization=Bearer SYNTHETIC_REVOKED_OPERATIONAL_TOKEN_392',
  'order_reference=890626879',
  'ssn documentation=890-62-6879',
  'ssn=890-62-6879',
].join('\n');
const workloadCommitment = digest(workload);
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
const sampleProtocol = contract.operational.sampleProtocol;
const helper = path.resolve(path.dirname(fileURLToPath(import.meta.url)), path.basename(sampleProtocol.helper));
if (await fileDigest(helper) !== sampleProtocol.helperSha256 || JSON.stringify(sampleProtocol.argv) !==
    JSON.stringify(['--module', '--selectors-base64', '--workload-base64'])) throw new Error('operational sample helper identity mismatch');
const sampleEnvironment = { ...Object.fromEntries(sampleProtocol.environment.inherit.flatMap(key =>
  process.env[key] === undefined ? [] : [[key, process.env[key]]])), ...sampleProtocol.environment.fixed };
const encodedWorkload = Buffer.from(workload).toString('base64url');

async function forceWasm(root) {
  const scope = path.join(root, 'node_modules', '@redact-secret');
  for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
}
async function runtimePaired(artifactsBySide) {
  const rows = new Map();
  for (const [surface, wasm] of [['node-addon', false], ['node-wasm', true]]) {
    const installations = Object.fromEntries(await Promise.all(['baseline', 'candidate'].map(async side =>
      [side, await installCandidate(artifactsBySide[side])] )));
    try {
      if (wasm) await Promise.all(Object.values(installations).map(installation => forceWasm(installation.root)));
      for (const [profile, selection] of profiles) {
        for (const side of ['baseline', 'candidate']) {
          const { effectiveSelectors, selectionState } = selection[side];
          rows.set(`${side}/${surface}/${profile}`, { side, surface, profile, effectiveSelectors, selectionState, samples,
            workloadCommitment, milliseconds: { initialize: [], wholeInput: [], incrementalLineCalls: [] } });
        }
        for (let index = 0; index < samples + sampleProtocol.warmupSamples; index++) {
          for (const side of ['baseline', 'candidate']) {
            const modulePath = path.join(installations[side].root, 'node_modules/@redact-secret/core/dist/index.js');
            const commandArgs = [helper, `--module=${modulePath}`,
              `--selectors-base64=${Buffer.from(JSON.stringify(selection[side].effectiveSelectors)).toString('base64url')}`,
              `--workload-base64=${encodedWorkload}`];
            const { stdout, stderr } = await execFile(process.execPath, commandArgs, { env: sampleEnvironment, timeout: 30_000, maxBuffer: 16 * 1024 });
            const sample = parsePiiArrivalRuntimeSampleProcess(stdout, stderr);
            if (index >= sampleProtocol.warmupSamples) {
              const target = rows.get(`${side}/${surface}/${profile}`).milliseconds;
              target.initialize.push(sample.initialize); target.wholeInput.push(sample.wholeInput);
              target.incrementalLineCalls.push(sample.incrementalLineCalls);
            }
          }
        }
      }
    } finally { await Promise.all(Object.values(installations).map(removeCandidate)); }
  }
  return ['baseline', 'candidate'].flatMap(side => contract.operational.surfaces.flatMap(surface =>
    contract.operational.profiles.map(profile => rows.get(`${side}/${surface}/${profile}`))));
}
async function packageSizes(side, artifacts) {
  const result = { side, packed: {}, unpacked: {}, wasmPayloads: null, wasmPayloadTotals: null };
  for (const role of ['core', 'node', 'wasm']) {
    result.packed[role] = (await stat(artifacts[role])).size;
    const directory = await mkdtemp(path.join(os.tmpdir(), `pii-arrival-${side}-${role}-`));
    try {
      await execFile('tar', ['-xzf', artifacts[role], '-C', directory]);
      const files = [];
      const walk = async current => { for (const name of await readdir(current)) { const location = path.join(current, name), info = await stat(location);
        if (info.isDirectory()) await walk(location); else files.push([location, info.size]); } };
      await walk(directory); result.unpacked[role] = files.reduce((sum, [, size]) => sum + size, 0);
      if (role === 'wasm') {
        const wasmFiles = files.filter(([location]) => location.endsWith('.wasm'));
        const members = validatePiiArrivalWasmPayloadRoster(wasmFiles.map(([location]) => path.basename(location)));
        result.wasmPayloads = Object.fromEntries(await Promise.all(Object.entries(members).map(async ([profile, member]) => {
          const matches = wasmFiles.filter(([location]) => path.basename(location) === member.fileName);
          if (matches.length !== 1) throw new Error('invalid Wasm payload identity');
          const bytes = await readFile(matches[0][0]);
          return [profile, { fileName: member.fileName, raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length,
            brotli: brotliCompressSync(bytes).length, sha256: digest(bytes) }];
        })));
        result.wasmPayloadTotals = Object.fromEntries(['raw', 'gzip', 'brotli'].map(metric =>
          [metric, Object.values(result.wasmPayloads).reduce((sum, payload) => sum + payload[metric], 0)]));
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  return result;
}
async function artifactIdentity(side) {
  const artifacts = Object.fromEntries(['core', 'node', 'wasm'].map(role => [role, args[`${side}-${role}`]]));
  const components = Object.fromEntries(await Promise.all(Object.entries(artifacts).map(async ([role, location]) => [role, await fileDigest(location)])));
  return { artifacts, components, artifactSetCommitment: commitment(components) };
}
const baseline = await artifactIdentity('baseline'), candidate = await artifactIdentity('candidate');
if (baseline.artifactSetCommitment === candidate.artifactSetCommitment) throw new Error('baseline and candidate artifact sets must differ');
const [runtimeRows, baselineSizes, candidateSizes] = await Promise.all([
  runtimePaired({ baseline: baseline.artifacts, candidate: candidate.artifacts }),
  packageSizes('baseline', baseline.artifacts), packageSizes('candidate', candidate.artifacts),
]);
const baselineRuntime = runtimeRows.filter(row => row.side === 'baseline'), candidateRuntime = runtimeRows.filter(row => row.side === 'candidate');
const limit = contract.operational.runtime;
const runtimeComparisons = candidateRuntime.map(after => {
  const before = baselineRuntime.find(row => row.surface === after.surface && row.profile === after.profile);
  const metrics = Object.fromEntries(Object.keys(after.milliseconds).map(metric => {
    const baselineMedian = median(before.milliseconds[metric]), candidateMedian = median(after.milliseconds[metric]);
    const delta = candidateMedian - baselineMedian, relative = baselineMedian === 0 ? null : delta / baselineMedian;
    return [metric, { baselineMedian, candidateMedian, delta, relative,
      pass: delta <= limit.maximumAbsoluteIncreaseMilliseconds || (relative !== null && relative <= limit.maximumRelativeIncrease) }];
  }));
  return { surface: after.surface, profile: after.profile, metrics };
});
const byteLimits = contract.operational.packageBytes, payloadPolicy = contract.operational.wasmPayloadPolicy;
const byteComparisons = {
  corePacked: ['packed', 'core', byteLimits.corePackedMaximumIncrease],
  nodePacked: ['packed', 'node', byteLimits.nodePackedMaximumIncrease],
  wasmPacked: ['packed', 'wasm', byteLimits.wasmPackedMaximumIncrease],
};
for (const [role, member] of Object.entries(payloadPolicy.members)) for (const metric of ['raw', 'gzip', 'brotli'])
  byteComparisons[`wasm${role[0].toUpperCase()}${role.slice(1)}${metric[0].toUpperCase()}${metric.slice(1)}`] =
    [`wasmPayloads.${role}`, metric, member.maximumIncrease[metric]];
for (const metric of ['raw', 'gzip', 'brotli'])
  byteComparisons[`wasmAggregate${metric[0].toUpperCase()}${metric.slice(1)}`] =
    ['wasmPayloadTotals', metric, payloadPolicy.aggregateMaximumIncrease[metric]];
for (const [id, [section, key, maximumIncrease]] of Object.entries(byteComparisons)) {
  const read = (sizes, sectionName) => sectionName.split('.').reduce((value, part) => value[part], sizes)[key];
  const before = read(baselineSizes, section), after = read(candidateSizes, section);
  byteComparisons[id] = { baseline: before, candidate: after, delta: after - before, maximumIncrease, pass: after - before <= maximumIncrease };
}
const projection = { schemaVersion: 1, reportType: 'pii-arrival-operational', supportClaims: false,
  contractCommitment: commitment(contract), runtime: { node: process.version, platform: process.platform, arch: process.arch },
  workloadCommitment, sampleProtocol: piiArrivalOperationalSampleProtocol(workloadCommitment),
  baseline: { sourceCommit: rawArgs['baseline-source-commit'], artifactSetCommitment: baseline.artifactSetCommitment, components: baseline.components },
  candidate: { sourceCommit: rawArgs['candidate-source-commit'], artifactSetCommitment: candidate.artifactSetCommitment, components: candidate.components },
  observations: [...baselineRuntime, ...candidateRuntime], sizes: [baselineSizes, candidateSizes], runtimeComparisons, byteComparisons,
  status: runtimeComparisons.every(row => Object.values(row.metrics).every(metric => metric.pass)) &&
    Object.values(byteComparisons).every(row => row.pass) ? 'complete' : 'regression' };
const report = { ...projection, artifactCommitment: commitment(projection) };
await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.artifactCommitment} ${report.status}`);
