import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFiles, removalDryRun } from '../scripts/lib/retention-inventory.mjs';

const files = pairs => pairs.map(([path, text]) => ({ path, bytes: Buffer.from(text) }));
test('inventory finds imports, indirect callers, dynamic directories, npm, workflows and remote references', () => {
  const result = analyzeFiles(files([
    ['scripts/run.mjs', "import './lib.mjs'; const dir = 'evidence/123/'; readdir(dir);"],
    ['scripts/lib.mjs', "readFile('benchmarks/policy.json');"],
    ['benchmarks/policy.json', '{}'], ['evidence/123/run.json', '{}'],
    ['package.json', '{"scripts":{"run":"node scripts/run.mjs"}}'],
    ['.github/workflows/check.yml', 'run: node scripts/run.mjs'],
    ['web/services/example.ts', "import '../../benchmarks/policy.json';"],
  ]), { remoteReferences: [{ path: 'github:issue/123', text: 'evidence/123/run.json' }] });
  const policy = result.entries.find(e => e.path === 'benchmarks/policy.json');
  assert.deepEqual(policy.callers.map(c => c.path), ['scripts/lib.mjs', 'web/services/example.ts']);
  const evidence = result.entries.find(e => e.path === 'evidence/123/run.json');
  assert.deepEqual(evidence.callers.map(c => c.path), ['github:issue/123', 'scripts/run.mjs']);
  const run = result.entries.find(e => e.path === 'scripts/run.mjs');
  assert.equal(run.callers.length, 2);
  const dry = removalDryRun(result, { entries: [{ path: policy.path, sha256: policy.sha256 }] });
  assert.equal(dry.totalBytes, 0);
  assert.ok(dry.errors.some(e => e.includes('active consumers')));
  assert.ok(dry.reachableDependencies.includes('package.json'));
});

test('unresolved computed readers stay explicit and zero-caller files need reviewed preservation', () => {
  const result = analyzeFiles(files([['scripts/load.mjs', 'readFile(path + name);'], ['evidence/7/data.json', '{}']]));
  assert.deepEqual(result.coverage.dynamicReaders, ['scripts/load.mjs']);
  const entry = result.entries.find(e => e.path === 'evidence/7/data.json');
  assert.equal(entry.candidateDisposition, 'review-before-removal');
  assert.ok(removalDryRun(result, { entries: [{ path: entry.path, sha256: entry.sha256 }] }).errors.length);
  assert.deepEqual(removalDryRun(result).removablePaths, []);
  const approved = { ...entry, owner: 'benchmark maintainer', issue: '#849', review: { dynamicReaders: 'review #849', externalReferences: 'review #849', authorityGates: 'review #849' }, preservation: { ref: 'refs/tags/hygiene-before-cleanup', sha256: entry.sha256, verifiedAt: '2026-10-08' } };
  assert.deepEqual(removalDryRun(result, { entries: [approved] }).removablePaths, [entry.path]);
  assert.throws(() => removalDryRun(result, { entries: [approved, approved] }), /duplicate/);
});
test('passive manifests cannot hide an active indirect reader', () => {
  const result = analyzeFiles(files([['evidence/1/a.json', '{}'], ['benchmarks/wrapper.json', '{"input":"evidence/1/a.json"}'], ['scripts/build.mjs', "readFile('benchmarks/wrapper.json')"]]));
  const entry = result.entries.find(e => e.path === 'evidence/1/a.json');
  const dry = removalDryRun(result, { entries: [{ ...entry, owner: 'benchmarks', issue: '#849', review: { dynamicReaders: 'scoped', externalReferences: 'scoped', authorityGates: 'scoped' }, preservation: { ref: 'refs/tags/retained', sha256: entry.sha256, verifiedAt: '2026-10-08' } }] });
  assert.ok(dry.errors.some(e => e.includes('reachable active consumer: scripts/build.mjs')));
  assert.deepEqual(dry.removablePaths, []);
});
test('a scoped prefix exclusion cannot override an exact import or literal reader', () => {
  const result = analyzeFiles(files([['docs/record.json', '{}'], ['scripts/read.mjs', "readFile('docs/record.json')"]]));
  const entry = result.entries.find(e => e.path === 'docs/record.json');
  const dry = removalDryRun(result, { entries: [{ ...entry, review: { excludedCallers: [{ path: 'scripts/read.mjs', via: ['literal-path'], reason: 'cannot suppress this' }] } }] });
  assert.ok(dry.errors.some(e => e.includes('active consumer')));
});
