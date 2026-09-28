import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeValues, shingles, jaccard, nearDuplicatePairs, independentShapeCount, independenceProblems, distributionProblems, frozenDigest, frozenSubsetProblems, sha256 } from '../benchmarks/lib/corpus-independence.ts';

const template = (service, version, digest, port) => `services:\n  ${service}:\n    image: registry.example.internal/${service}:${version}@sha256:${digest}\n    environment:\n      LOG_LEVEL: info\n      API_TOKEN: \${API_TOKEN}\n    ports:\n      - "${port}:${port}"\n    healthcheck:\n      test: ["CMD", "curl", "-f", "http://localhost:${port}/health"]\n      interval: 30s\n`;
const a = { id: 'a', group: 'realworld-config', path: 'a.yml', content: template('billing', '1.4.2', 'a'.repeat(64), 8080) };
const b = { id: 'b', group: 'realworld-config', path: 'b.yml', content: template('billing', '2.0.0', '0b1c'.repeat(16), 9090) };
const c = { id: 'c', group: 'realworld-logs', path: 'c.log', content: '2026-09-28T10:00:00Z INFO worker started pid=4121\n2026-09-28T10:00:02Z WARN queue depth above soft limit depth=812\n2026-09-28T10:00:05Z INFO drained backlog in 3.2s\n' };

test('value normalization collapses ids, versions and digests', () => {
  assert.equal(normalizeValues('v1.4.2 sha256:' + 'ab12'.repeat(16)), normalizeValues('v9.9.9 sha256:' + 'cd34'.repeat(16)));
});

test('a templated copy with swapped values is a near-duplicate; an unrelated file is not', () => {
  assert.ok(jaccard(shingles(a.content), shingles(b.content)) >= 0.9);
  assert.ok(jaccard(shingles(a.content), shingles(c.content)) < 0.1);
  assert.deepEqual(nearDuplicatePairs([a, b, c]).map(p => [p.a, p.b]), [['a', 'b']]);
  assert.equal(independentShapeCount([a, b, c]), 2);
});

test('exact duplicate bytes, ids and paths are reported', () => {
  const problems = independenceProblems([a, { ...a, id: 'a2', path: 'a.yml' }]);
  assert.ok(problems.some(p => p.startsWith('duplicate path')));
  assert.ok(problems.some(p => p.startsWith('duplicate sha')));
  assert.ok(problems.some(p => p.startsWith('near-duplicate')));
});

test('distribution: an under-filled, dominant or unknown axis is reported', () => {
  const axes = ['x', 'y'];
  const make = (group, n) => Array.from({ length: n }, (_, i) => ({ id: `${group}${i}`, group, path: `${group}${i}`, content: String(i) }));
  assert.deepEqual(distributionProblems([...make('x', 3), ...make('y', 3)], { axes, minimumPerAxis: 3, maximumShare: 0.5 }), []);
  assert.ok(distributionProblems([...make('x', 5), ...make('y', 1)], { axes, minimumPerAxis: 3, maximumShare: 0.6 }).length === 2);
  assert.ok(distributionProblems([...make('x', 3), ...make('y', 3), ...make('z', 1)], { axes, minimumPerAxis: 1, maximumShare: 1 }).some(p => p.startsWith('unknown axis z')));
});

test('frozen subset: an edit, a regroup, a removal or a stale digest is reported', () => {
  const entries = [a, c].map(f => ({ id: f.id, group: f.group, sha256: sha256(f.content) }));
  const frozen = { digest: frozenDigest(entries), fixtures: entries };
  assert.deepEqual(frozenSubsetProblems(frozen, [a, c]), []);
  assert.equal(frozenDigest([...entries].reverse()), frozen.digest);
  assert.deepEqual(frozenSubsetProblems(frozen, [{ ...a, content: a.content + '#\n' }, c]), ['frozen fixture edited: a']);
  assert.deepEqual(frozenSubsetProblems(frozen, [{ ...a, group: 'realworld-docs' }, c]), ['frozen fixture regrouped: a realworld-config -> realworld-docs']);
  assert.deepEqual(frozenSubsetProblems(frozen, [a]), ['frozen fixture removed: c']);
  assert.deepEqual(frozenSubsetProblems({ ...frozen, digest: '0'.repeat(64) }, [a, c]), ['frozen subset digest is stale']);
});
