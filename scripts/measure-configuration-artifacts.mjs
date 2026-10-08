#!/usr/bin/env node
// Measures already-built artifacts. No builds, registry access, policy repins or release verdicts.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, arch } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { measureWasm } from './measure-wasm-sizes.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function findingShape(findings) {
  return findings.map(f => {
    if (!Number.isInteger(f.start) || !Number.isInteger(f.end) || f.start < 0 || f.end < f.start || ['detector', 'type', 'action', 'confidence', 'obfuscation'].some(key => typeof f[key] !== 'string')) throw new Error('Invalid public finding shape');
    return [f.detector, f.type, f.start, f.end, f.action, f.confidence, f.obfuscation];
  });
}

export function readBenchmarkContext(cwd) {
  const benchmarkCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim() !== '';
  if (!/^[a-f0-9]{40}$/.test(benchmarkCommit) || dirty) throw new Error('Benchmark checkout must be clean before sampling');
  return { benchmarkCommit, benchmarkTreeDirty: false };
}

export function validatePlan(plan) {
  if (plan.schema !== 'configuration-performance-plan/v1' || !/^[a-f0-9]{40}$/.test(plan.sourceCommit ?? '')) throw new Error('Invalid plan source identity');
  if (!Array.isArray(plan.selection) || !plan.selection.length || new Set(plan.selection).size !== plan.selection.length || plan.selection.some(id => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))) throw new Error('Invalid detector selection');
  if (!Array.isArray(plan.artifacts) || plan.artifacts.length < 3 || plan.artifacts.length > 5) throw new Error('Require full, common and custom artifacts, optionally both PII variants');
  const ids = plan.artifacts.map(a => a.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(['full', 'common', 'custom'].sort()) && JSON.stringify(ids) !== JSON.stringify(['full', 'common', 'custom', 'full-pii', 'common-pii'].sort())) throw new Error('Invalid artifact roster');
  for (const artifact of plan.artifacts) {
    if (artifact.selection !== undefined && (!Array.isArray(artifact.selection) || !artifact.selection.length || new Set(artifact.selection).size !== artifact.selection.length || artifact.selection.some(id => !plan.selection.includes(id)))) throw new Error('Artifact selection must be a nonempty subset of the composition');
    for (const key of ['directory', 'binary', ...(artifact.id === 'custom' ? [] : ['coreDist', 'glue'])]) {
      if (typeof artifact[key] !== 'string' || !isAbsolute(artifact[key])) throw new Error(`Artifact ${key} must be an absolute path`);
    }
    for (const key of ['binary', ...(artifact.id === 'custom' ? [] : ['glue'])]) {
      const rel = relative(artifact.directory, artifact[key]);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Binary and glue must be inside the inventoried artifact directory');
    }
    const pii = artifact.initializeOptions?.pii ?? [];
    if (!Array.isArray(pii) || pii.some(selector => typeof selector !== 'string')) throw new Error('Invalid PII selection');
    if (artifact.id.endsWith('-pii') && !pii.length) throw new Error('PII artifact must activate explicit selectors');
    if (!artifact.id.endsWith('-pii') && pii.length) throw new Error('A non-PII artifact cannot activate PII');
  }
  if (plan.qualificationInventory !== undefined && (!isAbsolute(plan.qualificationInventory) || !isAbsolute(plan.corePackageTarball ?? ''))) throw new Error('Qualification inventory and core tarball must be absolute paths');
  const samples = plan.samples ?? 5;
  const iterations = plan.iterations ?? 10;
  const sizes = plan.inputBytes ?? [4096, 65536];
  if (!Number.isInteger(samples) || samples < 5 || samples > 20 || !Number.isInteger(iterations) || iterations < 1 || iterations > 100) throw new Error('Invalid bounded sample protocol');
  if (!Array.isArray(sizes) || sizes.length < 2 || sizes.length > 4 || new Set(sizes).size !== sizes.length || sizes.some(n => !Number.isInteger(n) || n < 1024 || n > 262144)) throw new Error('Invalid input sizes');
  if (plan.baselines !== undefined && (!Array.isArray(plan.baselines) || plan.baselines.some(b => !ids.includes(b.id) || !/^[a-f0-9]{40}$/.test(b.sourceCommit ?? '') || !isAbsolute(b.binary ?? '')))) throw new Error('Invalid historical size baseline');
  return { ...plan, samples, iterations, inputBytes: sizes };
}

export function fileInventory(directory) {
  const files = {};
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('Artifact trees must contain no symlinks');
      if (entry.isDirectory()) walk(join(dir, entry.name), `${relative}/`);
      else if (entry.isFile()) files[relative] = sha256(readFileSync(join(dir, entry.name)));
    }
  };
  walk(directory);
  if (!Object.keys(files).length) throw new Error('Artifact directory is empty');
  return files;
}

export function workload(bytes) {
  // Public, unmistakably synthetic. Only its byte length and digest leave the worker.
  const classic = ['ghp', '_SYNTHETICREVOKED', '0'.repeat(20)].join('');
  const jwt = [JSON.stringify({ alg: 'HS256' }), JSON.stringify({ sub: 'synthetic' }), 'synthetic_signature'].map(part => Buffer.from(part).toString('base64url')).join('.');
  const line = 'synthetic request authorization=' + classic + ' jwt=' + jwt + '\n';
  const block = line + 'Authorization: Basic ' + Buffer.from('syntheticuser:syntheticpassword').toString('base64') + '\n';
  return block.repeat(Math.ceil(bytes / block.length)).slice(0, bytes);
}

function summary(samples) {
  const metric = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { median: sorted[Math.ceil(sorted.length * .5) - 1], p95: sorted[Math.ceil(sorted.length * .95) - 1], maximum: sorted.at(-1) };
  };
  const summarize = values => Object.fromEntries(Object.keys(values[0]).filter(key => typeof values[0][key] === 'number' && key !== 'inputBytes' && key !== 'findingCount' && key !== 'configBytes').map(key => [key, metric(values.map(v => v[key]))]));
  return { initialization: summarize(samples.map(s => s.initialization)), workloads: samples[0].workloads.map((w, index) => ({ inputBytes: w.inputBytes, configBytes: w.configBytes, ...summarize(samples.map(s => s.workloads[index])) })) };
}

export function verifyQualification(plan, inventories) {
  if (!plan.qualificationInventory) return null;
  const bytes = readFileSync(plan.qualificationInventory);
  const inventory = JSON.parse(bytes);
  if (inventory.sourceCommit !== plan.sourceCommit) throw new Error('Qualification inventory source mismatch');
  const tarballHash = sha256(readFileSync(plan.corePackageTarball));
  const packageRows = [...(inventory.installedJavaScriptQualification ?? []), ...(inventory.cleanInstallQualification ?? [])].flatMap(row => row.packageArtifacts ?? []);
  if (inventory.configurationQualification?.corePackage) packageRows.push(inventory.configurationQualification.corePackage);
  if (!packageRows.some(row => row.name === '@redact-secret/core' && row.sha256 === tarballHash)) throw new Error('Core runtime tarball does not match qualification inventory');
  const checked = new Set();
  for (let index = 0; index < plan.artifacts.length; index++) {
    const artifact = plan.artifacts[index];
    if (artifact.id === 'custom') continue;
    const name = artifact.id.startsWith('common') ? 'wasm-web-common' : 'wasm-web';
    for (const file of [artifact.binary, artifact.glue]) {
      const rel = relative(artifact.directory, file);
      if (!inventory.artifacts.some(row => row.artifact === name && row.file === rel && row.sha256 === sha256(readFileSync(file)))) throw new Error('WASM files do not match qualification inventory');
    }
    if (!checked.has(artifact.coreDist)) {
      for (const [file, digest] of Object.entries(inventories[index].runtimeFiles)) {
        const packaged = execFileSync('tar', ['-xOf', plan.corePackageTarball, `package/dist/${file}`], { maxBuffer: 10485760 });
        if (sha256(packaged) !== digest) throw new Error('Runtime dist differs from qualified core tarball');
      }
      checked.add(artifact.coreDist);
    }
  }
  return { sha256: sha256(bytes), sourceCommit: inventory.sourceCommit, workflowRun: inventory.workflowRun, workflowRunAttempt: inventory.workflowRunAttempt, corePackageSha256: tarballHash };
}

export function measurePlan(input, { runSample } = {}) {
  const plan = validatePlan(input);
  const inventories = plan.artifacts.map(a => ({ id: a.id, files: fileInventory(a.directory), ...(a.coreDist ? { runtimeFiles: fileInventory(a.coreDist) } : {}) }));
  const qualification = verifyQualification(plan, inventories);
  const baselines = (plan.baselines ?? []).map(b => ({ id: b.id, sourceCommit: b.sourceCommit, buildEnvironment: b.buildEnvironment ?? null, ...measureWasm(readFileSync(b.binary)) }));
  const sizeRows = plan.artifacts.map(a => ({ id: a.id, ...measureWasm(readFileSync(a.binary)) }));
  const child = runSample ?? ((request) => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./configuration-artifact-worker.mjs', import.meta.url))], {
      input: JSON.stringify(request), encoding: 'utf8', timeout: 60000, maxBuffer: 1048576,
    });
    if (result.error || result.status !== 0) throw new Error('Configuration artifact sample failed or timed out; no evidence written');
    try { return JSON.parse(result.stdout); } catch { throw new Error('Configuration artifact sample emitted invalid JSON'); }
  });
  const rows = [];
  for (const artifact of plan.artifacts) {
    for (const mode of ['all-included', 'narrowed']) {
      const samples = [];
      for (let sample = 0; sample < plan.samples; sample++) samples.push(child({ artifact, mode, sourceCommit: plan.sourceCommit, selection: artifact.selection ?? plan.selection, compositionSelection: plan.selection, inputBytes: plan.inputBytes, iterations: plan.iterations, qualifiedSource: qualification?.sourceCommit ?? null }));
      const first = samples[0];
      for (const sample of samples) {
        if (sample.artifactSourceRevision !== first.artifactSourceRevision || sample.manifestDigest !== first.manifestDigest || JSON.stringify(sample.enabled) !== JSON.stringify(first.enabled) || JSON.stringify(sample.workloads.map(w => w.inputSha256)) !== JSON.stringify(first.workloads.map(w => w.inputSha256))) throw new Error('Artifact or workload input changed between repetitions');
      }
      rows.push({ artifact: artifact.id, mode, artifactSourceRevision: first.artifactSourceRevision ?? null, manifestDigest: first.manifestDigest, includedDetectors: first.includedDetectors, enabled: first.enabled, outputRepeatable: samples.every(sample => JSON.stringify(sample.workloads.map(w => w.findingsDigest)) === JSON.stringify(first.workloads.map(w => w.findingsDigest))), samples, summary: summary(samples) });
    }
  }
  const custom = rows.find(r => r.artifact === 'custom' && r.mode === 'all-included');
  const workloadExercisesCustom = custom.samples[0].workloads.some(w => w.findingCount > 0);
  const compare = (left, right) => {
    if (JSON.stringify([...left.enabled].sort()) !== JSON.stringify([...right.enabled].sort())) throw new Error('Parity rows must have the same enabled detector set');
    const sampleMatches = left.samples.map((sample, index) => JSON.stringify(sample.workloads.map(w => w.findingsDigest)) === JSON.stringify(right.samples[index].workloads.map(w => w.findingsDigest)));
    return { left: `${left.artifact}/${left.mode}`, right: `${right.artifact}/${right.mode}`, enabled: left.enabled, matches: sampleMatches.every(Boolean), sampleMatches };
  };
  const comparisons = [
    compare(rows.find(r => r.artifact === 'full' && r.mode === 'narrowed'), custom),
    compare(rows.find(r => r.artifact === 'common' && r.mode === 'narrowed'), rows.find(r => r.artifact === 'custom' && r.mode === 'narrowed')),
  ];
  for (let index = 0; index < plan.artifacts.length; index++) {
    const a = plan.artifacts[index];
    if (canonical(fileInventory(a.directory)) !== canonical(inventories[index].files) || (a.coreDist && canonical(fileInventory(a.coreDist)) !== canonical(inventories[index].runtimeFiles))) throw new Error('Artifact files changed during measurement');
  }
  const full = sizeRows.find(r => r.id === 'full');
  return {
    schema: 'configuration-performance/v1', supportClaims: false, releaseVerdict: null, generatedAt: new Date().toISOString(), sourceCommit: plan.sourceCommit,
    planSha256: sha256(canonical(plan)), protocol: { samples: plan.samples, iterations: plan.iterations, inputBytes: plan.inputBytes, freshProcessPerSample: true, serialRows: true },
    host: { platform: platform(), arch: arch(), cpuModel: cpus()[0]?.model ?? 'unknown', node: process.version },
    provenance: plan.provenance ?? null, comparisons, workloadExercisesCustom, qualification, inventories, sizes: sizeRows, baselines,
    fullBrotliBound: { baselineBytes: 181882, maximumGrowth: .15, measuredBytes: full.brotliBytes, growth: full.brotliBytes / 181882 - 1, withinByteBound: full.brotliBytes <= 181882 * 1.15, comparableBuildEnvironmentVerified: false },
    methodology: [
      'Node-hosted WebAssembly from exact supplied files, not browser/Workers latency or official Linux acceptance.',
      'Startup records runtime module import plus initialization. Initialization includes byte loading, instantiation, manifest verification and registry creation; registry-only timing is unavailable.',
      'Memory reports process RSS/heap/external checkpoints, not peak RSS or separate WebAssembly linear memory; categories overlap.',
      'Resolution measures the fixed selection document whose bytes/digest are recorded, not scanned text length.',
      'Timing uses one warmup then fixed repeated calls; every artifact/mode/repetition gets a fresh process. OS cache is not flushed.',
      'Only hashes/counts of synthetic input/findings are retained. Equality checks are a workload parity check, not product conformance.',
      'The historical full brotli bound is arithmetic only until build/toolchain equivalence is reviewed. Other profiles have no baseline in this report.',
    ], rows,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--plan' || args[2] !== '--out') throw new Error('Usage: node scripts/measure-configuration-artifacts.mjs --plan /absolute/plan.json --out report.json');
  const cwd = dirname(fileURLToPath(import.meta.url));
  const context = readBenchmarkContext(cwd);
  const plan = JSON.parse(readFileSync(args[1], 'utf8'));
  const evidence = { ...measurePlan(plan), ...context };
  if (readBenchmarkContext(cwd).benchmarkCommit !== context.benchmarkCommit) throw new Error('Benchmark revision changed during sampling');
  evidence.artifactCommitment = `sha256:${sha256(canonical(evidence))}`;
  mkdirSync(dirname(resolve(args[3])), { recursive: true });
  writeFileSync(args[3], `${JSON.stringify(evidence, null, 2)}\n`);
  console.log('Configuration artifact measurements recorded; no release or support verdict.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
