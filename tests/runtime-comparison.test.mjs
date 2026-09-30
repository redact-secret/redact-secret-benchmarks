import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  SETTING_IDS,
  describeLineOutcome,
  renderLine,
  renderRuntimeComparisonWorkload,
  runtimeComparisonCommitment,
  runtimeComparisonPlan,
  runtimeComparisonWriteRefusal,
  summarizeSamples,
  validateRuntimeComparisonPlan,
  validateRuntimeComparisonReport,
} from '../benchmarks/evaluation/domains/pii/runtime-comparison.ts';
import { renderWorkloadText, validatePeerRuntimeThroughputReport } from '../benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

const plan = validateRuntimeComparisonPlan();
const recommit = (object, key) => { const { [key]: _drop, ...rest } = object; return { ...rest, [key]: runtimeComparisonCommitment(rest) }; };

test('the plan validates, extends v1 by commitment and is informational-only', () => {
  assert.equal(plan.id, 'runtime-comparison-v2');
  assert.deepEqual(plan.settings.map(s => s.id), [...SETTING_IDS]);
  assert.equal(plan.thresholdPolicy.verdict, 'informational');
  assert.equal(plan.workloads.length, 6);
});

test('the v1 workloads are reused byte-identically, the v1 plan file is untouched', async () => {
  for (const id of ['validator-heavy', 'multilingual-context']) assert.equal(renderRuntimeComparisonWorkload(id), renderWorkloadText(id));
  const v1 = JSON.parse(await readFile(new URL('../qualification/peer-pii-runtime-throughput-v1.json', import.meta.url), 'utf8'));
  assert.equal(v1.contentCommitment, 'd1e14a01c355ec73c03cc7b3f6f5f8c298a7a6ee9614041e156d883d467456b5');
  assert.equal(plan.extends.contentCommitment, v1.contentCommitment);
});

test('every line places each of its values and carries an expected kind; credential families are absent, PII families present', () => {
  for (const workload of plan.workloads) for (const line of workload.lines) for (const value of line.values) {
    assert.ok(value.kind);
    assert.equal(value.family === undefined, workload.domain === 'credentials', `${workload.id}/${line.label}`);
  }
});

test('credential inputs are never committed as a literal token: the plan file holds prefixes and generator segments only', async () => {
  const raw = await readFile(new URL('../qualification/runtime-comparison-v2.json', import.meta.url), 'utf8');
  for (const workload of plan.workloads.filter(w => w.domain === 'credentials')) {
    workload.lines.forEach((line, index) => {
      const { values } = renderLine(workload, index);
      values.forEach((value, slot) => {
        if (workload.lines[index].values[slot].segments.some(segment => 'alphabet' in segment)) assert.ok(!raw.includes(value), `${workload.id}/${index} appears whole in the plan file`);
      });
    });
  }
});

test('rendering is deterministic and a text repeats its lines to the generator line count', () => {
  const a = renderRuntimeComparisonWorkload('credentials-real');
  assert.equal(a, renderRuntimeComparisonWorkload('credentials-real'));
  assert.equal(a.split('\n').length - 1, plan.generator.lineCount);
  const lines = plan.workloads.find(w => w.id === 'credentials-real').lines.map((_, i) => renderLine(plan.workloads.find(w => w.id === 'credentials-real'), i).text);
  assert.deepEqual(a.split('\n').slice(0, lines.length), lines);
});

test('an outcome keeps the replacement but never a value, and cuts it to the limit', () => {
  assert.deepEqual(describeLineOutcome('a=1\n', 'a=1\n', ['1']), { changed: false, valuesHidden: 0, replacement: '' });
  assert.deepEqual(describeLineOutcome('email=x@y.z\n', 'email=[EMAIL_1]\n', ['x@y.z']), { changed: true, valuesHidden: 1, replacement: '[EMAIL_1]' });
  assert.deepEqual(describeLineOutcome('a B a\n', 'a B a!\n', ['B']), { changed: true, valuesHidden: 0, replacement: '!' });
  assert.deepEqual(describeLineOutcome('k=SECRET tail\n', 'k=SECRET-x tail\n', ['SECRET']).valuesHidden, 0);
  assert.equal(describeLineOutcome('k=abc def\n', 'k=abc-abc def\n', ['abc']).replacement.includes('abc'), false, 'a value inside a replacement is replaced by its index');
  const long = describeLineOutcome('v=1\n', `v=${'z'.repeat(200)}\n`, ['1']);
  assert.equal(long.replacement.length, 64);
});

test('the write guard mirrors #513 for evidence/562 only', () => {
  const base = { ref: 'a', pinRef: 'a', emulated: false, root: '/r/' };
  assert.equal(runtimeComparisonWriteRefusal({ ...base, outPath: '/r/evidence/562/x.json' }), null);
  assert.match(runtimeComparisonWriteRefusal({ ...base, ref: 'b', outPath: '/r/evidence/562/x.json' }), /differs from pin-manifest/);
  assert.match(runtimeComparisonWriteRefusal({ ...base, emulated: true, outPath: '/r/evidence/562/x.json' }), /emulated/);
  assert.equal(runtimeComparisonWriteRefusal({ ...base, ref: 'b', emulated: true, outPath: '/r/public/x.json' }), null);
});

function syntheticReport(settingId = 'pii-global', mutate = report => report) {
  const setting = plan.settings.find(s => s.id === settingId);
  const families = setting.selectors.length ? ['pii:global:email', 'pii:global:phone'] : [];
  const activation = `credentials=full;selectors=${setting.selectors.length ? setting.selectors.join(',') : 'off'};families=${families.join(',')};vocabulary=pii-context/v2`;
  const observations = plan.tools.flatMap(tool => plan.workloads.map(workload => {
    const text = renderRuntimeComparisonWorkload(workload.id);
    const samples = Array.from({ length: plan.sampleProtocol.samplesPerCell }, (_, i) => ({ redactMs: 1 + i / 10, bytesPerSecond: 1000 + i }));
    return { tool: tool.id, workload: workload.id, workloadBytes: Buffer.byteLength(text), workloadCommitment: hash(text), samples, summary: summarizeSamples(samples) };
  }));
  const outcomes = plan.tools.flatMap(tool => plan.workloads.map(workload => ({
    tool: tool.id, workload: workload.id, lines: workload.lines.map(() => ({ changed: true, valuesHidden: 1, replacement: '<X>' })),
  })));
  const base = {
    schemaVersion: 1, reportType: 'runtime-comparison', supportClaims: false, planCommitment: plan.contentCommitment,
    setting: { id: setting.id, selectors: setting.selectors, activation, families },
    generatedAt: new Date().toISOString(),
    runner: { platform: 'linux', arch: 'x64', node: process.version, cpuModel: 'test-cpu', cpuLimit: 4, emulated: false, imageDigest: `sha256:${'a'.repeat(64)}` },
    tools: plan.tools.map(t => ({ id: t.id, version: '0.0.0-test', provenance: t.id === 'redact-secret' ? { kind: 'local-source-build', commit: 'b'.repeat(40) } : { kind: 'published-npm-package' } })),
    methodologyNotes: ['OpenRedaction is asynchronous (a Promise-returning detect()).', 'redact-secret is measured from a local-source-build, not a published npm release.', 'Outcomes are recorded, never graded.'],
    observations, outcomes,
  };
  return recommit(mutate(base), 'artifactCommitment');
}

test('a complete report validates, through the v1 entry point too', () => {
  for (const id of SETTING_IDS) {
    const report = syntheticReport(id);
    assert.doesNotThrow(() => validateRuntimeComparisonReport(report));
    assert.doesNotThrow(() => validatePeerRuntimeThroughputReport(report));
  }
});

test('the report validator rejects a missing outcome, a wrong line count, a value count above the line, a replacement on an unchanged line and a stale summary', () => {
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('pii-global', r => ({ ...r, outcomes: r.outcomes.slice(1) }))), /outcome matrix/);
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('pii-global', r => ({ ...r, outcomes: r.outcomes.map((o, i) => i ? o : { ...o, lines: o.lines.slice(1) }) }))), /Invalid runtime-comparison outcome for/);
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('pii-global', r => ({ ...r, outcomes: r.outcomes.map((o, i) => i ? o : { ...o, lines: o.lines.map(l => ({ ...l, valuesHidden: 9 })) }) }))), /outcome line/);
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('pii-global', r => ({ ...r, outcomes: r.outcomes.map((o, i) => i ? o : { ...o, lines: o.lines.map(l => ({ changed: false, valuesHidden: 0, replacement: 'x' })) }) }))), /outcome line/);
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('pii-global', r => ({ ...r, observations: r.observations.map((o, i) => i ? o : { ...o, summary: { ...o.summary, medianMs: 9 } }) }))), /Stale runtime-comparison summary/);
  assert.throws(() => validateRuntimeComparisonReport({ ...syntheticReport(), generatedAt: '2001-01-01T00:00:00.000Z' }), /identity or commitment/);
});

test('the report validator rejects a setting whose activation identity disagrees with the plan', () => {
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('pii-global-us', r => ({ ...r, setting: { ...r.setting, activation: r.setting.activation.replace('pii:global,pii:us', 'pii:global') } }))), /setting does not match/);
  assert.throws(() => validateRuntimeComparisonReport(syntheticReport('default', r => ({ ...r, setting: { ...r.setting, selectors: ['pii:global'] } }))), /setting does not match/);
});

test('the committed snapshots, when present, validate and belong to this plan', async () => {
  const dir = new URL('../evidence/562/', import.meta.url);
  const files = (await readdir(dir).catch(() => [])).filter(name => /^runtime-comparison-.+\.json$/.test(name));
  for (const name of files) {
    const report = JSON.parse(await readFile(new URL(name, dir), 'utf8'));
    assert.doesNotThrow(() => validatePeerRuntimeThroughputReport(report), name);
    assert.equal(name, `runtime-comparison-${report.setting.id}.json`);
    assert.equal(report.runner.emulated, false, 'an emulated run is a smoke check and is never committed');
  }
  if (files.length) assert.deepEqual(files.sort(), SETTING_IDS.map(id => `runtime-comparison-${id}.json`).sort(), 'all three settings or none');
});
