#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkActiveEvidenceFiles } from './lib/pii-evidence-adoption-apply.mjs';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';
import { SNAPSHOT_PIN, preflightReport, validateProposedSnapshotPin, verifyConsumerRuntime, sha256 } from './lib/pii-evidence-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => parseEvidenceJson(readFileSync(file, 'utf8'));
const pinned = name => path.join(ROOT, 'benchmarks/pii-evidence', `${name}.json`);
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export function runPreflight({ sourceDir, consumerBin, snapshotDir, out, fetch = false, candidateSnapshotPin, candidateConsumerPin }) {
  const policy = read(path.join(ROOT, 'benchmarks/pii-population-policy.json'));
  const snapshotFile = candidateSnapshotPin ?? pinned('snapshot-pin');
  const snapshotPin = read(snapshotFile), consumerPin = read(candidateConsumerPin ?? pinned('consumer-pin'));
  if (candidateConsumerPin && !candidateSnapshotPin) throw new Error('candidate consumer requires candidate snapshot pin');
  checkActiveEvidenceFiles(ROOT);
  const futureActive = snapshotPin.snapshot.id !== SNAPSHOT_PIN.snapshot.id;
  if (candidateSnapshotPin) validateProposedSnapshotPin(snapshotPin);
  if (!sourceDir || !consumerBin || !out || (!fetch && !snapshotDir)) throw new Error('preflight requires source, pinned consumer binary, snapshot and new report paths');
  if (existsSync(out)) throw new Error('preflight report output already exists');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceDir, encoding: 'utf8' }).trim();
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'crates', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'tools/pii-evidence/fetch-snapshot.mjs'], { cwd: sourceDir });
  if (candidateConsumerPin && sha256(execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: sourceDir, maxBuffer: 32 * 1024 * 1024 })) !== consumerPin.source.sourceArchiveSha256)
    throw new Error('candidate consumer source archive mismatch');
  const helper = path.join(sourceDir, 'tools/pii-evidence/fetch-snapshot.mjs');
  verifyConsumerRuntime({ sourceCommit, cargoLock: readFileSync(path.join(sourceDir, 'Cargo.lock')),
    fetchHelper: readFileSync(helper), binary: readFileSync(consumerBin), platform: `${process.platform}-${process.arch}` }, consumerPin);
  if (sha256(readFileSync(path.join(sourceDir, 'rust-toolchain.toml'))) !== consumerPin.source.rustToolchainFileSha256 ||
      sha256(readFileSync(path.join(sourceDir, 'crates/pii-eval-adapters/shims/node/redact-secret-core.mjs'))) !== consumerPin.source.shimSha256)
    throw new Error('consumer toolchain or shim mismatch');
  const scratch = mkdtempSync(path.join(tmpdir(), 'pii-evidence-preflight-'));
  try {
    if (fetch) {
      snapshotDir = path.join(scratch, 'snapshot');
      execFileSync(process.execPath, [helper, '--pin', snapshotFile, '--out', snapshotDir], { timeout: 120000, stdio: 'pipe' });
    }
    const invoke = args => JSON.parse(execFileSync(consumerBin, args, { timeout: 20000, maxBuffer: 512 * 1024, encoding: 'utf8' }));
    // These two commands cannot launch a scanner. The upstream reproduction helper also runs one, so do not call it here.
    const common = ['--snapshot-dir', snapshotDir, '--pin', snapshotFile];
    const verified = invoke(['verify', ...common]);
    const importDir = path.join(scratch, 'import');
    const imported = invoke(['import', ...common, '--out', importDir,
      ...(consumerPin.contract.mapping.revision === 3 ? ['--mapping-revision', '3'] : [])]);
    const outputs = Object.fromEntries(['snapshot.json', 'binding.json'].map(name => [name, readFileSync(path.join(importDir, name))]));
    const proposedConsumer = candidateSnapshotPin ? { ...consumerPin, importedPopulation: {
      id: imported.semantic?.population?.id, version: imported.semantic?.population?.version,
      digest: imported.semantic?.population?.semanticDigest, bindingDigest: imported.semantic?.binding?.semanticDigest,
    } } : consumerPin;
    const report = preflightReport({ policy, snapshotPin, consumerPin: proposedConsumer, verified, imported, outputs,
      proposed: Boolean(candidateSnapshotPin) || futureActive,
      populationPins: readFileSync(path.join(ROOT, 'benchmarks/pii-eval-population-pins.json')) });
    writeFileSync(out, json(report), { flag: 'wx' });
    return report;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function main(args) {
  if (args.length === 1 && args[0] === '--check') {
    checkActiveEvidenceFiles(ROOT);
    console.log('PII evidence candidate pins/preflight valid; this check does not execute or authorise a measurement');
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--fetch' && options.fetch === undefined) { options.fetch = true; continue; }
    const field = { '--source-dir': 'sourceDir', '--consumer-bin': 'consumerBin', '--snapshot-dir': 'snapshotDir',
      '--candidate-snapshot-pin': 'candidateSnapshotPin', '--candidate-consumer-pin': 'candidateConsumerPin', '--out': 'out' }[key];
    if (!field || options[field] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('invalid preflight arguments');
    options[field] = path.resolve(args[++index]);
  }
  const result = runPreflight(options);
  console.log(json({ state: result.state, runnable: result.runnable, counts: result.counts, losses: result.losses }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
