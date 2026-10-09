import { currentPerformanceInputs } from '../benchmarks/lib/current-performance-inputs.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dispatchModel, comparableRows, measuredRows, workloadGuidance } from '../benchmarks/lib/measured-performance.ts';

// #405 / #450: measured rows come only from the pinned accepted summary, and every row states its dispatch model.
const read = async p => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const criteria = await read('benchmarks/performance-criteria.json');
const summary = currentPerformanceInputs().accepted;
const rows = measuredRows(summary);

test('one measured row per criterion, from the accepted commit\'s own run', () => {
  assert.equal(summary.sourceCommit, criteria.baseline.verifiedCommit);
  assert.deepEqual(rows.map(r => `${r.surface}/${r.profileId}`).sort(), criteria.performance.map(c => `${c.surface}/${c.profileId}`).sort());
});

test('every row states a dispatch model; the CLI is per-line, library surfaces one-shot or chunked', () => {
  for (const r of rows) assert.ok(r.dispatch.label && r.dispatch.detail, `${r.surface}/${r.profileId}`);
  const model = (surface, profile) => rows.find(r => r.surface === surface && r.profileId === profile).dispatch.model;
  assert.equal(model('cli', 'scale-logs-small-whole'), 'per-line-incremental');
  assert.equal(model('cli', 'scale-logs-medium-fixed4096'), 'per-line-incremental');
  assert.equal(model('rust-core', 'scale-logs-small-whole'), 'one-shot');
  assert.equal(model('node', 'scale-logs-medium-fixed4096'), 'chunked-incremental');
});

test('rows of different dispatch models are not comparable; rows of one model are', () => {
  assert.equal(comparableRows({ surface: 'cli', path: 'whole-input' }, { surface: 'rust-core', path: 'whole-input' }), false);
  assert.equal(comparableRows({ surface: 'node', path: 'whole-input' }, { surface: 'python', path: 'whole-input' }), true);
  assert.equal(comparableRows({ surface: 'node', path: 'incremental' }, { surface: 'node', path: 'whole-input' }), false);
  assert.equal(dispatchModel('browser-wasm', 'incremental').model, 'chunked-incremental');
});

test('every regression-budget latency trigger compares one surface with itself, so it never crosses a dispatch model', async () => {
  const budgets = await read('benchmarks/regression-budgets.json');
  const latency = budgets.triggers.filter(t => t.dimension === 'latency' || t.dimension === 'initialization');
  assert.ok(latency.length > 0);
  for (const t of latency) assert.match(t.id, /^(latency|initialization)\/[a-z-]+\/scale-logs-[a-z0-9-]+\/(processing|initialization)-ratio$/, t.id);
});

test('workload guidance is derived from the one-shot medians', () => {
  const g = workloadGuidance(rows);
  const oneShot = rows.filter(r => r.dispatch.model === 'one-shot').map(r => r.throughputMedianBytesPerSecond);
  assert.equal(g.slowestBytesPerSecond, Math.min(...oneShot));
  assert.equal(g.fastestBytesPerSecond, Math.max(...oneShot));
  assert.ok(g.smallPayloadMsSlowest < 5 && g.smallPayloadMsFastest < g.smallPayloadMsSlowest);
  assert.throws(() => workloadGuidance([]), /no-one-shot-rows/);
});
