import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, summarize } from '../src/model.mjs';
import { scoreReport } from '../benchmarks/lib/reporting.ts';
import { accountGroups } from '../benchmarks/lib/accounting.ts';
import { summarizeRun, selectionGroups } from '../benchmarks/lib/run-summary.ts';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const categories = (await read('benchmarks/categories.json')).filter(category => !category.calibrationOnly);
const registry = await read('benchmarks/detectors.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const corpora = Object.fromEntries(await Promise.all(categories.map(async c => [c.id, await read(c.corpus)])));
const fixtures = buildCatalog(categories, corpora, assignments, registry.detectors);
const accounting = (await read('qualification/suite-v1.json')).accounting;
const runId = '2026-09-19T12:00:00.000Z-0a0b0c';

/** Two deterministic scanners: one reports nothing, one reports every expected span exactly. */
const scannersFor = list => [
  { id: 'silent', name: 'Silent', mode: 'test', version: '1', status: 'complete', ...scoreReport(list, [], accounting) },
  { id: 'exact', name: 'Exact', mode: 'test', version: '1', status: 'complete', ...scoreReport(list, list.flatMap(f => f.expected.filter(s => (s.role ?? 'secret') === 'secret').map(s => ({ path: f.path, start: s.start, end: s.end }))), accounting) },
];
const reports = categories.map(c => ({ schemaVersion: 5, accountingVersion: '1.1', accounting, runId, category: c.id, lockHash: 'lock', matching: 'v4', reviewStatus: 'draft', scanners: scannersFor(corpora[c.id].fixtures) }));
const summary = summarizeRun(reports, assignments, '2026-09-19T12:00:01.000Z');
const allRows = id => reports.flatMap(r => r.scanners.find(s => s.id === id).rows.map(row => ({ ...row, category: r.category, id: `${r.category}--${row.id}`, twinOf: row.twinOf ? `${r.category}--${row.twinOf}` : undefined })));

test('overall groups are accounting.ts over every row of the run: same bound, same n, same withheld reason', () => {
  for (const id of ['silent', 'exact']) assert.deepEqual(summary.overall[id], accountGroups(allRows(id), accounting), id);
  const t1 = summary.overall.exact['must-redact/T1'];
  assert.equal(t1.leakedSpanRate.n, t1.spans);
  assert.equal(t1.leakedSpanRate.direction, 'upper');
  assert.ok(t1.leakedSpanRate.bound > t1.leakedSpanRate.point, 'zero leaks still publishes a pessimistic bound above zero');
  assert.equal(summary.overall.silent['must-redact/T1'].leakedSpanRate.point, 1);
  assert.deepEqual(summary.categories, categories.map(c => c.id));
  assert.equal(summary.runId, runId);
  assert.deepEqual(summary.accounting, accounting);
});

test('per-detector groups match the site selection view for every detector and scanner', () => {
  assert.deepEqual(Object.keys(summary.byDetector).sort(), registry.detectors.map(d => d.id).sort(), 'every registered detector has fixtures and a summary');
  for (const detector of registry.detectors) {
    const selected = fixtures.filter(f => f.detectors.includes(detector.id));
    const { summaries } = summarize(selected, reports, runId);
    for (const s of summaries) assert.deepEqual(summary.byDetector[detector.id][s.scanner][s.key], s.metrics, `${detector.id} ${s.scanner} ${s.key}`);
    for (const [scanner, groups] of Object.entries(summary.byDetector[detector.id])) assert.deepEqual(Object.keys(groups).sort(), summaries.filter(s => s.scanner === scanner && s.metrics).map(s => s.key).sort());
  }
});

test('a thin group publishes its reason instead of a rate, and the summary refuses mixed runs', () => {
  const thin = Object.entries(summary.byDetector).flatMap(([d, scanners]) => Object.entries(scanners.exact ?? {}).filter(([, g]) => g.leakedSpanRate === 'insufficient-evidence').map(([key, g]) => ({ d, key, g })));
  assert.ok(thin.length, 'the corpus has detector groups below the floor or with too much pending');
  assert.ok(thin.some(({ g }) => g.spans < accounting.minDenominator));
  assert.throws(() => summarizeRun([reports[0], { ...reports[1], runId: 'other' }], assignments), /never mixes run ids/);
  assert.throws(() => summarizeRun([], assignments), /at least one/);
  const none = selectionGroups(allRows('exact'), new Set(), accounting);
  assert.deepEqual(none, {});
});

test('a scanner that did not complete a suite is named, and contributes no rows from it', () => {
  const broken = structuredClone(reports);
  broken[0].scanners[1] = { id: 'exact', name: 'Exact', mode: 'test', version: '1', status: 'unavailable' };
  const partial = summarizeRun(broken, assignments);
  assert.deepEqual(partial.scanners.find(s => s.id === 'exact'), { id: 'exact', name: 'Exact', version: '1', mode: 'test', status: 'unavailable', completeSuites: reports.length - 1 });
  assert.ok(partial.overall.exact['must-redact/T1'].spans < summary.overall.exact['must-redact/T1'].spans);
});
