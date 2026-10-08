import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generatedStage, publishGeneratedFiles } from '../scripts/lib/generated-output.mjs';
import { replayPatchFile, replayPatchPaths } from '../scripts/run-evidence-replay.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'generated-output-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, bytes) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), bytes); };
  return { root, write };
}
const report = 'docs/generated/evidence-adoption/example.md';
const registry = 'benchmarks/evidence-adoption.json';

test('missing staged output refuses publication before replacing an existing report or registry', t => {
  const { root, write } = fixture(t);
  write(report, 'previous report'); write(registry, 'previous registry');
  const stage = generatedStage(root); writeFileSync(path.join(stage, 'report.md'), 'new report');
  assert.ok(stage.startsWith(path.join(root, 'results-output')));
  assert.throws(() => publishGeneratedFiles({ root, files: [{ source: path.join(stage, 'report.md'), target: report }, { source: path.join(stage, 'missing.json'), target: 'docs/generated/evidence-adoption/missing.json' }], record: { path: registry, value: { state: 'candidate' } } }), /ENOENT/);
  assert.equal(readFileSync(path.join(root, report), 'utf8'), 'previous report');
  assert.equal(readFileSync(path.join(root, registry), 'utf8'), 'previous registry');
});

test('a late publication failure rolls back newly created data and byte-identical existing records', t => {
  const { root, write } = fixture(t); write(report, 'original bytes\n'); write(registry, '{"old":true}\n');
  const stage = generatedStage(root); const source = path.join(stage, 'new'); writeFileSync(source, 'replacement');
  let writes = 0;
  assert.throws(() => publishGeneratedFiles({ root, files: [{ source, target: report }, { source, target: 'docs/generated/evidence-adoption/new.json' }], record: { path: registry, value: { state: 'candidate' } }, write: (file, bytes) => { writeFileSync(file, bytes); if (++writes === 3) throw new Error('injected registry failure'); } }), /injected/);
  assert.equal(readFileSync(path.join(root, report), 'utf8'), 'original bytes\n');
  assert.equal(readFileSync(path.join(root, registry), 'utf8'), '{"old":true}\n');
  assert.equal(existsSync(path.join(root, 'docs/generated/evidence-adoption/new.json')), false);
});

test('validated reports and their registry publish together while authority and pins cannot be targets', t => {
  const { root } = fixture(t); const stage = generatedStage(root); const source = path.join(stage, 'report'); writeFileSync(source, 'valid report');
  publishGeneratedFiles({ root, files: [{ source, target: report }], record: { path: registry, value: { state: 'candidate', ownerAcceptance: null } } });
  assert.equal(readFileSync(path.join(root, report), 'utf8'), 'valid report');
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, registry))), { state: 'candidate', ownerAcceptance: null });
  for (const target of ['benchmarks/qualification-authority.json', 'benchmarks/pii-authority.json', 'benchmarks/evidence-pin.json', 'docs/generated/evidence-adoption/../invalid.json']) assert.throws(() => publishGeneratedFiles({ root, files: [{ source, target }] }), /invalid generated publication target/);
  assert.throws(() => publishGeneratedFiles({ root, files: [{ source, target: report }, { source, target: report }] }), /invalid generated publication target/);
});

test('replay planning prefers ignored patches and still reads exact historical canonical patch bytes', t => {
  const { root, write } = fixture(t); const tag = 'snapshot-2026.10.06.4'; const paths = replayPatchPaths(tag, true);
  assert.equal(paths.transient, `results-output/evidence-adoption/${tag}.engine-replay-pins.patch`);
  assert.throws(() => replayPatchFile(root, tag, true), /missing/);
  write(paths.retained, 'historical'); assert.equal(readFileSync(replayPatchFile(root, tag, true), 'utf8'), 'historical');
  write(paths.transient, 'new planning bytes'); assert.equal(readFileSync(replayPatchFile(root, tag, true), 'utf8'), 'new planning bytes');
  assert.throws(() => replayPatchPaths('../traversal'), /invalid replay patch tag/);
});


test('default publication restores earlier reports when an unchanged registry refuses writes with EACCES', t => {
  if (process.platform === 'win32' || process.getuid?.() === 0) return t.skip('directory write permissions require a non-root POSIX user');
  const { root, write } = fixture(t);
  write(report, 'original report'); write(registry, 'original registry');
  const stage = generatedStage(root); const source = path.join(stage, 'report'); writeFileSync(source, 'new report');
  chmodSync(path.join(root, 'benchmarks'), 0o555);
  try {
    assert.throws(() => publishGeneratedFiles({ root, files: [{ source, target: report }], record: { path: registry, value: { state: 'candidate' } } }), error => error.code === 'EACCES');
    assert.equal(readFileSync(path.join(root, report), 'utf8'), 'original report');
    assert.equal(readFileSync(path.join(root, registry), 'utf8'), 'original registry');
  } finally { chmodSync(path.join(root, 'benchmarks'), 0o755); }
});

test('an incomplete rollback keeps both causes and recovery bytes and still restores other targets', t => {
  if (process.platform === 'win32' || process.getuid?.() === 0) return t.skip('directory write permissions require a non-root POSIX user');
  const { root, write } = fixture(t);
  const blocked = 'docs/generated/evidence-adoption/blocked/report.md';
  write(report, 'original report'); write(blocked, 'original blocked report'); write(registry, 'original registry');
  const stage = generatedStage(root); const source = path.join(stage, 'report'); writeFileSync(source, 'new report');
  const original = new Error('injected failure after changing registry');
  let captured;
  try {
    assert.throws(() => publishGeneratedFiles({ root, files: [{ source, target: report }, { source, target: blocked }], record: { path: registry, value: { state: 'candidate' } }, write: (file, bytes) => {
      writeFileSync(file, bytes);
      if (file === path.join(root, registry)) { chmodSync(path.dirname(path.join(root, blocked)), 0o555); throw original; }
    } }), error => {
      captured = error;
      return error instanceof AggregateError && error.cause === original && /Restore these targets.*before retrying/.test(error.message);
    });
    assert.equal(readFileSync(path.join(root, report), 'utf8'), 'original report');
    assert.equal(readFileSync(path.join(root, registry), 'utf8'), 'original registry');
    assert.equal(captured.errors[0], original);
    assert.equal(captured.errors[1].code, 'EACCES');
    assert.deepEqual(captured.recovery.map(row => row.target), [blocked]);
    assert.equal(captured.recovery[0].previousBytes.toString(), 'original blocked report');
    assert.equal(captured.recovery[0].cause.code, 'EACCES');
  } finally { chmodSync(path.dirname(path.join(root, blocked)), 0o755); }
});
