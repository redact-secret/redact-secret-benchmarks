import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, findingShape, sha256, workload } from './measure-configuration-artifacts.mjs';

const request = JSON.parse(readFileSync(0, 'utf8'));
const { artifact, mode, sourceCommit, selection, inputBytes, iterations } = request;
const profile = artifact.id.split('-')[0];
const memory = () => { const m = process.memoryUsage(); return { rssBytes: m.rss, heapUsedBytes: m.heapUsed, externalBytes: m.external }; };
const before = memory();
const importStarted = performance.now();
let api;
if (profile === 'custom') api = await import(pathToFileURL(join(artifact.directory, 'index.js')).href);
else {
  const { createRedactSecretRuntime } = await import(pathToFileURL(join(artifact.coreDist, 'runtime.js')).href);
  const { assertWasmModuleShape, createBindingFromWasmModule } = await import(pathToFileURL(join(artifact.coreDist, 'runtime', 'wasm-binding.js')).href);
  api = createRedactSecretRuntime(async () => {
    const module = await import(pathToFileURL(artifact.glue).href);
    assertWasmModuleShape(module);
    await module.default({ module_or_path: readFileSync(artifact.binary) });
    return createBindingFromWasmModule(module);
  }, profile);
}
const moduleImportMs = performance.now() - importStarted;
const initializeOptions = { ...artifact.initializeOptions, ...(mode === 'narrowed' ? { detection: { include: selection } } : {}) };
const started = performance.now();
await api.initialize(initializeOptions);
const initializationMs = performance.now() - started;
const initialized = memory();
assert.equal(api.artifact(), 'wasm');
const manifest = api.artifactManifest();
const { digest, ...rest } = manifest;
assert.equal(digest, `sha256:${sha256(canonical(rest))}`);
assert.ok(manifest.sourceRevision === sourceCommit || (manifest.sourceRevision === null && request.qualifiedSource === sourceCommit), 'Loaded source revision must match or be bound by the verified qualification inventory');
assert.equal(manifest.artifact.variant, profile);
assert.equal(manifest.artifact.kind, 'wasm');
assert.equal(manifest.artifact.pii, artifact.id.endsWith('-pii'));
const included = manifest.detectors.map(d => d.id);
const enabled = api.describeConfig().detection.enabled;
assert.deepEqual(enabled, mode === 'narrowed' ? included.filter(id => selection.includes(id)) : included);
assert.ok(selection.every(id => included.includes(id)), 'Selection unavailable in this artifact');
if (profile === 'custom') {
  assert.equal(manifest.sourceRevision, sourceCommit);
  assert.deepEqual([...included].sort(), [...(request.compositionSelection ?? selection)].sort());
  assert.deepEqual(JSON.parse(readFileSync(join(artifact.directory, 'artifact-manifest.custom.json'), 'utf8')), manifest);
  const report = JSON.parse(readFileSync(join(artifact.directory, 'build-report.json'), 'utf8'));
  assert.equal(report.engine.sourceRevision, sourceCommit);
  assert.equal(report.engine.sourceTreeDirty, false);
  assert.equal(report.manifest.digest, digest);
  for (const [file, hash] of Object.entries(report.files)) assert.equal(sha256(readFileSync(join(artifact.directory, file))), hash);
}
const time = run => {
  run();
  const start = performance.now();
  for (let iteration = 0; iteration < iterations; iteration++) run();
  return (performance.now() - start) / iterations;
};
const config = { detection: { include: selection } };
const configBytes = Buffer.byteLength(canonical(config));
const configSha256 = sha256(canonical(config));
const limits = { maxInputCodeUnits: Math.max(...inputBytes, 32896) + 1, maxBufferedCodeUnits: 32896, maxTokenCodeUnits: 8192, maxMultilineCodeUnits: 32768 };
const workloads = inputBytes.map(bytes => {
  const input = workload(bytes);
  const findings = api.scan(input);
  const shape = findingShape(findings);
  const findingsByDetector = findings.reduce((counts, finding) => { counts[finding.detector] = (counts[finding.detector] ?? 0) + 1; return counts; }, {});
  const scanMs = time(() => api.scan(input));
  const resolveConfigMs = time(() => { assert.equal(api.resolveConfig(config).ok, true); });
  const compare2Ms = time(() => api.compareConfigurations(input, { configs: [config, config] }));
  const compare4Ms = time(() => api.compareConfigurations(input, { configs: [config, config, config, config] }));
  const sessionCreateMs = time(() => { const session = api.createIncrementalSanitizer({ limits }); session.abort(); });
  const appendTimings = [];
  for (let iteration = 0; iteration <= iterations; iteration++) {
    const session = api.createIncrementalSanitizer({ limits });
    const start = performance.now();
    for (let offset = 0; offset < input.length; offset += 4096) session.append(input.slice(offset, offset + 4096));
    const elapsed = performance.now() - start;
    session.finalize();
    if (iteration) appendTimings.push(elapsed);
  }
  return { inputBytes: Buffer.byteLength(input), configBytes, configSha256, inputSha256: sha256(input), findingCount: findings.length, findingsByDetector, findingsDigest: sha256(canonical(shape)), scanMs, scanBytesPerSecond: Buffer.byteLength(input) / (scanMs / 1000), resolveConfigMs, comparedSides: [2, 4], compare2Ms, compare4Ms, sessionCreateMs, appendMs: appendTimings.reduce((a, b) => a + b, 0) / iterations, ...memory() };
});
process.stdout.write(JSON.stringify({ artifactSourceRevision: manifest.sourceRevision, manifestDigest: digest, includedDetectors: included.length, enabled, initialization: { moduleImportMs, initializationMs, startupMs: moduleImportMs + initializationMs, rssBeforeBytes: before.rssBytes, rssInitializedBytes: initialized.rssBytes, heapInitializedBytes: initialized.heapUsedBytes, externalInitializedBytes: initialized.externalBytes }, workloads }));
