import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Telemetry, classifyChanges, identityDigest, planExecution, planPerformance, renderExecutionPlan } from '../benchmarks/qualification/execution-plan.ts';

const axes = JSON.parse(readFileSync(new URL('../benchmarks/execution-axes.json', import.meta.url), 'utf8'));
const subject = (id, version = '1.0.0') => ({ id, version, package: id, kind: 'published-npm-package', commit: null, activation: null });
const cell = (measurement, subjectId, workload, version = '1.0.0') => {
  const identity = { subject: subject(subjectId, version), workloadDigest: `sha256:w-${workload}`, protocolDigest: 'sha256:p' };
  return { id: `${measurement}/default/${subjectId}/${workload}`, measurement, setting: null, subject: subjectId, workload, identity, identityDigest: identityDigest(identity),
    artifact: { path: `evidence/${measurement}.json`, byteDigest: 'sha256:aa', artifactCommitment: 'x', measuredAt: '2026-09-30T10:21:28.525Z', host: { platform: 'linux', arch: 'x64', cpuModel: 'cpu', imageDigest: null }, observations: 12 } };
};
const manifest = {
  schema: 'redact-secret-benchmarks/performance-cells/v1',
  measurements: [{ id: 'm', plan: 'qualification/m.json', granularity: 'measurement', jobKey: 'measurement' }],
  cells: ['core', 'peer-a', 'peer-b'].flatMap(s => ['w1', 'w2'].map(w => cell('m', s, w))),
};
// What the repository pins now: identical unless a test changes one subject.
const current = (changes = {}) => c => ({ subject: subject(c.subject, changes[c.subject] ?? '1.0.0'), workloadDigest: changes.workload === c.workload ? 'sha256:new' : c.identity.workloadDigest, protocolDigest: changes.protocol ? 'sha256:p2' : 'sha256:p' });
const performance = (extra = {}, changes = {}) => ({ manifest, current: current(changes), invocationsPerCell: () => 14, telemetry: new Telemetry({ schema: 's', jobs: { 'performance:m': { runnerMinutes: 2, runs: [] } } }), ...extra });

const registry = {
  scanners: ['core', 'peer-a', 'peer-b'].map(id => ({ id })),
  populations: [{ id: 'floors' }, { id: 'regression' }],
  runs: ['floors', 'regression'].map(p => ({ id: `${p}@linux-x64`, population: p, platform: 'linux-x64', artifact: { byteDigest: `sha256:${p}` } })),
};
const accuracy = (extra = {}) => ({ registry, platform: 'linux-x64', changedScanners: [], product: 'core', lane: 'official', engineRunsFor: p => (p === 'floors' ? 4 : 2), telemetry: new Telemetry({ schema: 's', jobs: { 'official-run:floors': { runnerMinutes: 50, runs: [] }, 'official-run:regression': { runnerMinutes: 1.5, runs: [] } } }), ...extra });
const plan = (files, o = {}) => planExecution({ axis: 'both', files, axes, accuracy: accuracy(o.accuracy), performance: performance(o.performance, o.changes) });

test('files are classified by the axes rules and an unknown file is never guessed (#709)', () => {
  const { kinds, unclassified } = classifyChanges(['fixtures/accuracy/a.txt', 'benchmarks/known-gaps.json', 'web/app/page.tsx', 'package-lock.json', 'qualification/pii-profile-cost-workloads-v1.json', 'scripts/mystery.mjs'], axes);
  assert.deepEqual(Object.keys(kinds).sort(), ['accuracy-expectations', 'accuracy-fixtures', 'performance-workload', 'scanner-pin', 'view-docs']);
  assert.deepEqual(unclassified, ['scripts/mystery.mjs']);
  const p = plan(['scripts/mystery.mjs']);
  assert.equal(p.verdict, 'needs-decision');
  assert.match(p.decisions[0], /no rule .* classifies scripts\/mystery\.mjs/);
});

test('a fixture-only update schedules zero performance jobs and zero peer performance processes (#709)', () => {
  for (const files of [['fixtures/accuracy/a.txt'], ['benchmarks/known-gaps.json'], ['web/a.tsx', 'docs/x.md']]) {
    const p = plan(files);
    assert.equal(p.counts.performance.jobs, 0, files.join());
    assert.equal(p.counts.performance.executed, 0);
    assert.equal(p.counts.performance.peerProcesses, 0);
    assert.ok(p.performance.cells.every(c => c.origin === 'reuse'));
  }
  const fixtures = plan(['fixtures/accuracy/a.txt']);
  assert.equal(fixtures.counts.accuracy.jobs, 2, 'the accuracy axis measures the populations');
  assert.equal(fixtures.verdict, 'plan');
});

test('a view or docs change measures neither axis and costs nothing (#709)', () => {
  const p = plan(['web/a.tsx']);
  assert.equal(p.counts.accuracy.executed + p.counts.performance.executed, 0);
  assert.equal(p.counts.runnerMinutes.known, 0);
  assert.ok(p.accuracy.populations.every(x => x.action === 'reuse-recorded-run' && x.scanners.every(s => s.reason === 'unchanged-inputs' && s.source)));
});

test('unchanged peer performance executes no competitor process; the product cells are fresh by identity (#709)', () => {
  const p = planPerformance({ ...performance({}, { core: '2.0.0' }), triggered: true, controlledComparison: true });
  // A controlled comparison is the explicit request that runs every subject of the job in one run.
  assert.equal(p.jobs.length, 1);
  assert.equal(p.peerProcesses, 4);
  const q = planPerformance({ ...performance({}, { core: '2.0.0' }), triggered: true });
  assert.equal(q.jobs.length, 0, 'without the explicit request nothing is scheduled');
  assert.equal(q.peerProcesses, 0);
  assert.match(q.decisions[0], /core changed, and the harness measures .* together/);
  assert.deepEqual(q.cells.filter(c => c.origin === 'fresh').map(c => c.subject), ['core', 'core']);
  assert.ok(q.cells.filter(c => c.subject !== 'core').every(c => c.origin === 'reuse' && c.source && c.source.measuredAt));
  const none = planPerformance({ ...performance(), triggered: true });
  assert.equal(none.jobs.length, 0);
  assert.equal(none.cells.filter(c => c.origin === 'fresh').length, 0);
});

test('a changed workload or protocol invalidates only the affected cells (#709)', () => {
  const w = planPerformance({ ...performance({}, { workload: 'w2' }), triggered: true, forceFresh: 'all' });
  assert.ok(w.cells.every(c => c.origin === 'fresh'));
  const only = planPerformance({ ...performance({}, { workload: 'w2' }), triggered: true });
  assert.deepEqual([...new Set(only.cells.filter(c => c.reason === 'identity-changed').map(c => c.workload))], ['w2']);
  assert.ok(only.cells.filter(c => c.reason === 'identity-changed').every(c => c.changed.join() === 'workload'));
  const protocol = planPerformance({ ...performance({}, { protocol: true }), triggered: true });
  assert.ok(protocol.cells.every(c => c.reason === 'identity-changed' && c.changed.join() === 'protocol'));
});

test('a performance change from a scanner pin selects the performance job; force-fresh and a controlled comparison are explicit (#709)', () => {
  const pin = plan(['package.json'], { changes: { 'peer-a': '1.1.0' } });
  assert.equal(pin.verdict, 'needs-decision');
  assert.equal(pin.counts.performance.jobs, 0);
  const controlled = plan(['package.json'], { performance: { controlledComparison: true }, changes: { 'peer-a': '1.1.0' } });
  assert.equal(controlled.counts.performance.jobs, 1);
  assert.equal(controlled.counts.performance.engineInvocations, 14 * 6);
  assert.equal(controlled.counts.performance.executed, 6);
  assert.ok(controlled.performance.cells.some(c => c.reason === 'controlled-comparison' && c.harnessForced));
  const forced = plan(['docs/x.md'], { performance: { forceFresh: ['m'] } });
  assert.equal(forced.counts.performance.jobs, 1, 'force-fresh runs even when no input changed');
  assert.ok(forced.performance.cells.every(c => c.reason === 'force-fresh'));
});

test('an invalid or missing stored artifact is never reused and is listed as missing evidence (#709)', () => {
  const p = planPerformance({ ...performance({ invalidArtifacts: ['evidence/m.json'] }), triggered: true, controlledComparison: true });
  assert.ok(p.cells.every(c => c.origin === 'fresh' && c.reason === 'stored-result-invalid'));
  assert.match(p.missingEvidence[0], /missing or differs from its recorded digest/);
});

test('the official lane measures every scanner of a changed population; the diagnostic lane repeats what the #706 plan reuses (#709)', () => {
  const official = plan(['fixtures/accuracy/a.txt']);
  assert.ok(official.accuracy.populations.flatMap(p => p.scanners).every(s => s.origin === 'fresh'));
  const reusePlan = { population: 'floors', verdict: 'plan', rescore: false, missingEvidence: [], refusals: [], scanners: [{ scanner: 'core', origin: 'fresh', reason: 'product-under-test' }, { scanner: 'peer-a', origin: 'reused', reason: 'compatible' }, { scanner: 'peer-b', origin: 'reused', reason: 'compatible' }] };
  const diag = plan(['package.json'], { accuracy: { lane: 'diagnostic', changedScanners: ['core'], reusePlans: [reusePlan] } });
  const floors = diag.accuracy.populations.find(p => p.population === 'floors');
  assert.deepEqual(floors.scanners.map(s => [s.scanner, s.origin]), [['core', 'fresh'], ['peer-a', 'reuse'], ['peer-b', 'reuse']]);
  assert.equal(floors.engineRuns, 4);
  // No reuse plan for the other population: a cache miss, shown, never silently reused.
  const regression = diag.accuracy.populations.find(p => p.population === 'regression');
  assert.ok(regression.scanners.filter(s => s.scanner !== 'core').every(s => s.origin === 'fresh' && s.reason === 'no-reuse-plan'));
  assert.ok(diag.missingEvidence.some(m => /regression: no #706 reuse plan/.test(m)));
});

test('unknown runner-minutes stay unknown and are reported apart from counts (#709)', () => {
  const p = planExecution({ axis: 'both', files: ['fixtures/accuracy/a.txt'], axes, accuracy: accuracy({ telemetry: new Telemetry(null) }), performance: performance({ telemetry: new Telemetry(null) }) });
  assert.equal(p.counts.runnerMinutes.known, 0);
  assert.equal(p.counts.runnerMinutes.unknownJobs, 2);
  assert.match(renderExecutionPlan(p), /2 job\(s\) unknown/);
});

test('a plan labels reused performance as independent historical measurements, never same-run (#709)', () => {
  const md = renderExecutionPlan(plan(['docs/x.md']));
  assert.match(md, /independent historical measurements/);
  assert.match(md, /imply no faster\/slower direction/);
  assert.match(md, /nothing below has been started/);
});

test('the committed cell register points at artifacts whose bytes match their recorded digests (#709)', () => {
  const committed = JSON.parse(readFileSync(new URL('../benchmarks/performance-cells.json', import.meta.url), 'utf8'));
  assert.ok(committed.cells.length > 0);
  for (const a of new Map(committed.cells.map(c => [c.artifact.path, c.artifact])).values())
    assert.equal(`sha256:${createHash('sha256').update(readFileSync(new URL(`../${a.path}`, import.meta.url))).digest('hex')}`, a.byteDigest, a.path);
  for (const c of committed.cells) assert.equal(c.identityDigest, identityDigest(c.identity), c.id);
  assert.ok(committed.measurements.every(m => m.granularity === 'measurement'));
});

test('the plan names one separate dispatch per axis and none while a decision is open (#709)', () => {
  const fixture = plan(['fixtures/accuracy/a.txt']);
  assert.deepEqual(fixture.dispatch.map(d => [d.axis, d.workflow]), [['accuracy', 'official-runs.yml']], 'a fixture-only change dispatches no performance workflow');
  assert.deepEqual(fixture.dispatch[0].covers, ['floors', 'regression']);
  const open = plan(['package.json'], { changes: { 'peer-a': '1.1.0' } });
  assert.equal(open.verdict, 'needs-decision');
  assert.deepEqual(open.dispatch, []);
  const controlled = planExecution({ axis: 'performance', files: [], axes, performance: performance({ controlledComparison: true }, { 'peer-a': '1.1.0' }) });
  assert.deepEqual(controlled.dispatch.map(d => d.axis), []);
  const withDispatch = { ...manifest, measurements: [{ ...manifest.measurements[0], dispatch: { workflow: 'perf.yml', inputs: { measurement: 'm' } } }] };
  const both = planExecution({ axis: 'performance', files: [], axes, performance: { ...performance({ controlledComparison: true }, { 'peer-a': '1.1.0' }), manifest: withDispatch } });
  assert.deepEqual(both.dispatch.map(d => d.command), ['gh workflow run perf.yml --ref <branch> -f measurement=m']);
  assert.equal(planExecution({ axis: 'accuracy', files: ['fixtures/accuracy/a.txt'], axes, accuracy: accuracy(), performance: performance() }).counts.performance.jobs, 0);
});
