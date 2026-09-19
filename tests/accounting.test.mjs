// Engine v1.1 accounting: one test per clause of docs/evaluation-engine-v1.1.md §11.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aggregateGroups, scoreRow, isLeaked } from '../benchmarks/lib/lattice.ts';
import { accountGroups, accountingDelta, accountCounts, unresolvedGroups, assertComparable, validateAccounting, wilson, proportion, ratio } from '../benchmarks/lib/accounting.ts';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { runEvaluation, exitCode } from '../benchmarks/engine/runner.ts';
import { reviewState } from '../benchmarks/engine/execution.ts';
import { completenessReasons } from '../benchmarks/engine/evidence.ts';

const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url)));
const config = validateAccounting(suite.accounting);
const methods = createMethods(), operators = createOperators();
const cases = await loadCases(operators);
const sample = method => cases.find(c => c.method === method && c.id.includes('github-token-ghp-plain'));
// Reads bytes only, like a real adapter: reports every GitHub-token-shaped run by UTF-8 byte offset.
const exact = { id: 'exact', version: async () => '1', scan: async (_, fixtures) => fixtures.flatMap(f =>
  [...f.content.matchAll(/ghp_[A-Za-z0-9]{36}/g)].map(m => {
    const start = Buffer.byteLength(f.content.slice(0, m.index));
    return { path: f.path, start, end: start + Buffer.byteLength(m[0]) };
  })) };

// Synthetic scored rows: spans are [10,20); an exact finding covers it, an overbroad one swallows surrounding bytes.
const span = { start: 10, end: 20, role: 'secret' };
const positive = (id, tier, actual, extra = {}) => ({ id, path: id, group: 'g', kind: 'must-redact', tier, expected: [span], actual, ...scoreRow([span], actual), ...extra });
const control = (id, tier, twinOf, actual = []) => ({ id, path: id, group: 'g', kind: 'must-not-flag', tier, twinOf, expected: [], actual, ...scoreRow([], actual) });
const pending = (id, kind = 'must-redact') => ({ id, path: id, group: 'g', kind, tier: 'T0', expected: [span], actual: [] });
const hit = { start: 10, end: 20 }, wide = { start: 0, end: 40 };
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));

test('§0 floors live in the suite, are covered by suiteHash, and malformed blocks fail closed', () => {
  assert.deepEqual(Object.keys(suite.accounting), ['version', 'minDenominator', 'resolvedRateFloor', 'measurableShareFloor', 'twinCoverageFloor', 'replays', 'intervalZ', 'intervalPrecision']);
  for (const bad of [{ version: '1.0' }, { minDenominator: 0 }, { replays: 1 }, { intervalZ: 0 }, { measurableShareFloor: 1.2 }, { resolvedRateFloor: { differential: 0 } }, { intervalPrecision: 0 }])
    assert.throws(() => validateAccounting({ ...suite.accounting, ...bad }), /Invalid accounting/);
  assert.throws(() => validateAccounting(undefined), /Invalid accounting/);
});

test('§1 a wholly review-required run is incomplete with unresolved-assertions; a differential-only queue does not trip the floor', async () => {
  const t0 = cases.find(c => c.method === 'benign' && c.seed.assessment.tier === 'T0');
  assert.ok(t0, 'the corpus carries a pending benign case');
  const unresolved = await runEvaluation({ cases: [t0], methods, operators, scanners: [exact] });
  assert.ok(unresolved.results[0].scanners[0].assertions.every(a => a.status === 'review-required'));
  assert.deepEqual(unresolved.unresolvedGroups, ['benign/*']);
  assert.deepEqual(completenessReasons({ executed: true, unresolvedGroups: unresolved.unresolvedGroups, review: { unknown: 0 } }), ['unresolved-assertions']);
  const row = Object.values(unresolved.resolution)[0];
  assert.deepEqual([row.total, row.resolved, row.unresolved, row.resolvedRate], [row['review-required'], 0, row.total, 'insufficient-evidence']);

  const differential = await runEvaluation({ cases: [sample('differential')], methods, operators, scanners: [{ ...exact, id: 'redact-secret' }, { id: 'peer', version: async () => '1', scan: async () => [] }] });
  assert.ok(differential.reviewQueue.length > 0, 'the disagreement is still queued, never truth');
  assert.deepEqual(differential.unresolvedGroups, []);
  // A scored stratum below the floor is named by its full key; T0 strata are charged through measurableShare instead.
  assert.deepEqual(unresolvedGroups({ 'twin/s/must-redact:T1/absolute': { pass: 8, 'review-required': 2 }, 'twin/s/must-redact:T0/absolute': { 'review-required': 9 }, 'twin/s/must-redact:T2/absolute': { pass: 9, fail: 1 } }, config), ['twin/s/must-redact:T1/absolute']);
});

test('§2 a majority-T0 candidate population withholds the rate; diagnostics.exact is byte-identical to v1.0', () => {
  const rows = [...many(6, i => positive(`p${i}`, 'T1', [hit])), ...many(7, i => pending(`t${i}`)), pending('control-pending', 'must-not-flag')];
  const v10 = aggregateGroups(rows), v11 = accountGroups(rows, config);
  const g = v11['must-redact/T1'];
  assert.deepEqual([g.leakedSpanRate, g.leakedByteRate, g.collateralRatio], ['insufficient-evidence', 'insufficient-evidence', 'insufficient-evidence']);
  assert.deepEqual([g.pendingFiles, g.measurableShare.point, g.measurableShare.direction], [7, 0.461538, 'lower'], 'only T0 rows of the same candidate kind are charged');
  assert.deepEqual(v11['pending/T0'], { files: 8, scored: false, candidateKinds: { 'must-not-flag': 1, 'must-redact': 7 } });
  assert.equal(JSON.stringify(g.diagnostics), JSON.stringify(v10['must-redact/T1'].diagnostics));
  assert.deepEqual(g.outcomes, v10['must-redact/T1'].outcomes, 'counts stay visible beside the withheld rate');
  assert.deepEqual(accountingDelta(rows, config).groups['must-redact/T1'].cause, ['t0-share']);
  // Policy groups have no provider evidence to be pending on: the floor is 0 for them, by decision.
  const policy = accountGroups([...many(5, i => positive(`q${i}`, 'T3', [hit], { kind: 'policy' })), ...many(9, i => pending(`r${i}`, 'policy'))], config)['policy/T3'];
  assert.equal(typeof policy.leakedSpanRate, 'object');
});

test('§3 an OVERBROAD positive is not a discriminated twin; its leak accounting is unchanged from v1.0', () => {
  const rows = [...many(5, i => positive(`p${i}`, 'T1', [i === 0 ? wide : hit])), ...many(5, i => control(`c${i}`, 'T2', `p${i}`))];
  assert.deepEqual(rows[0].spanOutcomes, ['OVERBROAD']);
  assert.equal(isLeaked('OVERBROAD'), false, 'leakage and overbreadth stay separate axes');
  const v10 = aggregateGroups(rows)['must-redact/T1'], v11 = accountGroups(rows, config)['must-redact/T1'];
  assert.deepEqual([v10.twins.discriminated, v11.twins.discriminated], [5, 4]);
  assert.deepEqual([v11.leakedSpans, v11.leakedSpanRate.point, v11.leakedBytes], [v10.leakedSpans, v10.leakedSpanRate, v10.leakedBytes]);
  const delta = accountingDelta(rows, config).groups['must-redact/T1'];
  assert.deepEqual(delta.cause, ['overbroad-twin']);
  assert.deepEqual([delta.v10['twins.rate'], delta.v11['twins.rate'].point], [1, 0.8]);
});

test('§4 an unavailable scanner yields one not-measured row per variant and moves resolvedRate', async () => {
  const report = await runEvaluation({ cases: [sample('twin')], methods, operators, scanners: [exact, { id: 'missing', version: async () => { throw new Error('unavailable'); } }] });
  const [measured, missing] = report.results[0].scanners;
  assert.equal(missing.assertions.length, report.results[0].variants.length);
  assert.ok(missing.assertions.every(a => a.status === 'not-measured' && a.reason === 'unavailable' && a.variant));
  const rows = Object.entries(report.resolution);
  assert.ok(rows.filter(([key]) => key.includes('/exact/')).every(([, r]) => r['not-measured'] === 0 && r.resolved === r.total));
  assert.ok(rows.filter(([key]) => key.includes('/missing/')).every(([, r]) => r.resolved === 0 && r.unresolved === r.total && r.total > 0));
  assert.ok(report.unresolvedGroups.some(key => key.startsWith('twin/missing/')), 'a silently absent scanner trips the floor');
  assert.ok(Object.values(report.accountingDelta.groups).some(g => g.cause.includes('not-measured')));
  assert.ok(measured.assertions.every(a => a.status !== 'not-measured'));
});

test('§5 twin coverage is pairs / positives and a single-pair group withholds its rate', () => {
  const rows = [...many(40, i => positive(`p${i}`, 'T2', [hit])), control('only-twin', 'T2', 'p0')];
  const g = accountGroups(rows, config)['must-redact/T2'];
  assert.deepEqual([g.twins.positives, g.twins.pairs, g.twins.coverage.point, g.twins.coverage.n], [40, 1, 0.025, 40]);
  assert.equal(g.twins.rate, 'insufficient-coverage');
  assert.equal(aggregateGroups(rows)['must-redact/T2'].twins.rate, 1, 'v1.0 published a rate from a denominator of one');
  assert.deepEqual(accountingDelta(rows, config).groups['must-redact/T2'].cause, ['twin-coverage']);
  // Coverage above the floor with too few pairs is still withheld.
  const few = [...many(5, i => positive(`p${i}`, 'T2', [hit])), ...many(4, i => control(`c${i}`, 'T2', `p${i}`))];
  assert.equal(accountGroups(few, config)['must-redact/T2'].twins.rate, 'insufficient-evidence');
  // The per-row increments must agree with the positive population.
  assert.equal(Object.values(aggregateGroups(rows)).reduce((n, x) => n + (x.twins?.positives ?? 0), 0), 40);
});

test('§6 a queue entry with no ledger row blocks qualification; an open row does not', () => {
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const entries = { a: { status: 'open', firstSeenRun: '2026-09-02', note: 'acknowledged' }, b: { status: 'resolved', firstSeenRun: '2026-09-01', resolvedRun: '2026-09-10', note: 'adapter mapping' }, c: { status: 'open', firstSeenRun: '2026-08-30', note: 'standing' } };
  const reviewed = reviewState(queue, { schemaVersion: 1, entries });
  assert.deepEqual(reviewed, { open: 2, resolved: 1, unknown: 0, oldestOpenRun: '2026-08-30' });
  assert.deepEqual(completenessReasons({ executed: true, unresolvedGroups: [], review: reviewed }), []);
  const unseen = reviewState(queue, { schemaVersion: 1, entries: { a: entries.a } });
  assert.deepEqual(unseen, { open: 1, resolved: 0, unknown: 2, oldestOpenRun: '2026-09-02' });
  assert.deepEqual(completenessReasons({ executed: true, unresolvedGroups: [], review: unseen }), ['unreviewed-queue']);
  assert.equal(reviewState([{ id: 'constructor' }], { schemaVersion: 1, entries: {} }).unknown, 1);
});

test('§7 Wilson bounds match a fixed table; collateralRatio carries bound: null; report bytes are deterministic', () => {
  for (const [k, n, upper, lower] of [[0, 5, 0.434491, 0], [0, 10, 0.27754, 0], [5, 10, 0.76341, 0.23659], [10, 10, 1, 0.72246], [1, 139, 0.039625, 0.001271], [45, 50, 0.956525, 0.786395], [0, 1000, 0.003827, 0]]) {
    assert.equal(wilson(k / n, n, 'upper', config), upper, `upper ${k}/${n}`);
    assert.equal(wilson(k / n, n, 'lower', config), lower, `lower ${k}/${n}`);
  }
  assert.deepEqual(proportion(1, 139, 'upper', config), { point: 0.007194, bound: 0.039625, n: 139, direction: 'upper' });
  assert.equal(proportion(1, 4, 'upper', config), 'insufficient-evidence');
  assert.equal(proportion(0, 0, 'upper', config), null);
  assert.deepEqual(ratio(640, 6120, config), { point: 0.104575, bound: null, n: 6120, direction: null });
  const rows = [...many(6, i => positive(`p${i}`, 'T1', [i ? hit : wide])), ...many(6, i => control(`c${i}`, 'T2', undefined, i ? [] : [hit]))];
  const groups = accountGroups(rows, config);
  const t1 = groups['must-redact/T1'], controls = groups['must-not-flag/T2'];
  assert.deepEqual([t1.collateralRatio.bound, t1.collateralRatio.direction, t1.collateralRatio.point], [null, null, 0.5]);
  assert.deepEqual([controls.meanFindingsPerFlagged.bound, controls.falseAlarmRate.direction, t1.leakedSpanRate.direction, t1.measurableShare.direction], [null, 'upper', 'upper', 'lower']);
  // Bytes inside one span are not independent trials: the byte-rate interval is drawn over spans.
  assert.deepEqual([t1.leakedByteRate.n, t1.secretBytes], [6, 60]);
  assert.equal(JSON.stringify(accountGroups(structuredClone(rows).reverse(), config)), JSON.stringify(groups));
  assert.equal(JSON.stringify(accountingDelta(rows, config)), JSON.stringify(accountingDelta(structuredClone(rows), config)));
});

test('§8 a scanner whose replays disagree is unstable: no findings, not-measured rows and a failed complete', async () => {
  let call = 0;
  const flaky = { id: 'flaky', version: async () => '1', scan: async (directory, fixtures) => (call++ % 2 ? [] : exact.scan(directory, fixtures)) };
  let scans = 0;
  const counted = { ...exact, id: 'steady', scan: async (...args) => { scans++; return exact.scan(...args); } };
  const report = await runEvaluation({ cases: [sample('twin')], methods, operators, scanners: [flaky, counted] });
  const [unstable, steady] = report.scanners;
  assert.equal(scans, config.replays, 'every scanner is replayed over the same scratch tree');
  assert.deepEqual([unstable.status, unstable.replays.count, unstable.replays.agreed], ['unstable', config.replays, false]);
  assert.ok(unstable.replays.divergentPaths.length > 0 && unstable.replays.divergentPaths.every(p => report.results[0].variants.some(v => v.path === p)));
  assert.deepEqual([steady.status, steady.replays], ['complete', { count: config.replays, agreed: true }]);
  assert.equal('findings' in unstable, false, 'no raw or normalized scanner output is retained');
  assert.ok(report.results[0].scanners[0].assertions.every(a => a.status === 'not-measured' && a.reason === 'unstable'));
  assert.equal(exitCode(report, { strict: true }), 1);
  assert.deepEqual(completenessReasons({ executed: report.scanners.every(s => s.status === 'complete'), unresolvedGroups: [], review: { unknown: 0 } }), ['execution-incomplete']);
  assert.ok(Object.values(report.accountingDelta.groups).some(g => g.cause.includes('unstable')));
});

test('§9 with nothing unresolved, no T0, no overbroad twins and adequate n, every accountingDelta group is a no-op', async () => {
  const rows = [...many(12, i => positive(`p${i}`, 'T1', [i % 3 ? hit : { start: 12, end: 20 }])), ...many(12, i => control(`c${i}`, 'T2', `p${i}`, i % 4 ? [] : [hit])), ...many(8, i => positive(`q${i}`, 'T3', [hit], { kind: 'policy' }))];
  const delta = accountingDelta(rows, config);
  assert.equal(delta.version, '1.0 -> 1.1');
  assert.deepEqual(Object.keys(delta.groups), ['must-not-flag/T2', 'must-redact/T1', 'policy/T3']);
  for (const [key, g] of Object.entries(delta.groups)) {
    assert.deepEqual(g.cause, [], key);
    for (const [metric, before] of Object.entries(g.v10)) assert.equal(g.v11[metric]?.point ?? null, before, `${key} ${metric}`);
  }
  const report = await runEvaluation({ cases: [sample('twin')], methods, operators, scanners: [exact] });
  assert.ok(Object.values(report.accountingDelta.groups).every(g => g.cause.length === 0 && g.v11['not-measured'] === 0 && g.v11.unresolved === 0));
  assert.deepEqual([report.schemaVersion, report.engineVersion, report.accountingVersion], [3, '1.1.0', '1.1']);
});

test('§10 a v1.0 baseline is not comparable with a v1.1 record unless an accountingDelta mapping is present', async () => {
  const baseline = JSON.parse(await readFile(new URL('../baselines/0.1.0-beta.4.json', import.meta.url)));
  assert.equal(baseline.accountingVersion, undefined, 'the checked-in baseline predates the field and is v1.0');
  assert.throws(() => assertComparable(baseline, { accountingVersion: '1.1' }), /not comparable: 1\.0 vs 1\.1/);
  assert.doesNotThrow(() => assertComparable(baseline, { accountingVersion: '1.1', accountingDelta: { version: '1.0 -> 1.1', groups: {} } }));
  assert.doesNotThrow(() => assertComparable({ accountingVersion: '1.1' }, { accountingVersion: '1.1' }));
  assert.doesNotThrow(() => assertComparable(baseline, {}));
  assert.deepEqual(accountCounts({ pass: 3, fail: 1, 'review-required': 1 }, config), { pass: 3, fail: 1, 'review-required': 1, 'not-measured': 0, total: 5, resolved: 4, unresolved: 1, resolvedRate: { point: 0.8, bound: 0.375528, n: 5, direction: 'lower' } });
});
