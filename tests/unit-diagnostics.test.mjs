import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import Ajv from 'ajv';
import {
  observeProduct, diagnoseRow, aggregateRows, reportProblem, digestOf, rowsDigestOf, isNotable, rowProblem,
  UNIT_DIAGNOSTICS_SCHEMA_VERSION,
} from '../benchmarks/lib/unit-diagnostics.ts';
import { renderUnitDiagnostics } from '../benchmarks/lib/unit-diagnostics-report.ts';

const schema = JSON.parse(await readFile(new URL('../schemas/unit-diagnostics-v1.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv({ strict: false, allErrors: true }).compile(schema);

// A stand-in product whose findings are fixed per input. Its sanitized output
// follows the documented default placeholder unless a test overrides it.
function fakeApi(findings, overrides = {}) {
  const sanitize = input => {
    let text = '', cursor = 0, index = 0;
    for (const f of [...findings].filter(f => f.action === 'redact' || f.action === 'block').sort((a, b) => a.start - b.start)) {
      text += input.slice(cursor, f.start) + `<SECRET_${++index}>`;
      cursor = f.end;
    }
    return text + input.slice(cursor);
  };
  const full = findings.map(f => ({ type: 't', detector: 'd', ...f }));
  return {
    scan: () => full,
    redact: input => sanitize(input),
    scanAndRedact: input => ({ text: sanitize(input), findings: full }),
    ...overrides,
  };
}

// Synthetic, unmistakably fake values only.
const SECRET_A = 'FAKE_SECRET_AAAAAAAAAAAAAAAA';
const SECRET_B = 'FAKE_SECRET_BBBBBBBBBBBBBBBB';
const positiveFixture = (content, secrets, extra = {}) => ({
  category: 'unit', id: extra.id ?? 'positive', kind: extra.kind ?? 'must-redact', tier: extra.tier ?? 'T1',
  ...(('contract' in extra ? extra.contract : 'fake-family') ? { contract: 'contract' in extra ? extra.contract : 'fake-family' } : {}),
  expected: secrets.map(([start, end, envelope]) => ({ start, end, role: 'secret', ...(envelope ? { envelope } : {}) })),
});
const controlFixture = (extra = {}) => ({
  category: 'unit', id: extra.id ?? 'control', kind: 'must-not-flag', tier: extra.tier ?? 'T2', ...(extra.contract ? { contract: extra.contract } : {}),
  ...(extra.twinOf ? { twinOf: extra.twinOf } : {}), expected: [],
});
const span = (content, value) => { const start = content.indexOf(value); return [start, start + value.length]; };
const run = (fixture, content, findings, overrides) => {
  const secrets = fixture.expected.filter(e => e.role === 'secret');
  return diagnoseRow(fixture, observeProduct(fakeApi(findings, overrides), content, secrets, f => (f.family ? { family: f.family } : {})), 'credentials');
};

test('multi-span file: each secret span is its own unit, and a warn-only span leaks in the actual output', () => {
  const content = `a=${SECRET_A}\nb=${SECRET_B}\n`;
  const [a0, a1] = span(content, SECRET_A), [b0, b1] = span(content, SECRET_B);
  const row = run(positiveFixture(content, [[a0, a1], [b0, b1]]), content, [{ start: a0, end: a1, action: 'redact' }, { start: b0, end: b1, action: 'warn' }]);
  assert.equal(row.unit, 'secret-span');
  assert.deepEqual(row.spans.map(s => [s.detection, s.actionClass, s.sanitization, s.outputLeakedBytes]), [
    ['EXACT', 'destructive', 'removed', 0],
    ['EXACT', 'non-destructive', 'leaked', SECRET_B.length],
  ]);
  assert.deepEqual(row.spans.map(s => s.plaintextInOutput), [false, true]);
  // v4 reads the warn as a detection: no v4 leak, while the output leaks every byte.
  assert.equal(row.v4.leakedBytes, 0);
});

test('partial finding: PARTIAL detection and a partial leak of exactly the uncovered bytes', () => {
  const content = `k=${SECRET_A};`;
  const [s0, s1] = span(content, SECRET_A);
  const row = run(positiveFixture(content, [[s0, s1]]), content, [{ start: s0, end: s0 + 10, action: 'redact' }]);
  assert.equal(row.spans[0].detection, 'PARTIAL');
  assert.equal(row.spans[0].sanitization, 'partial-leak');
  assert.equal(row.spans[0].outputLeakedBytes, SECRET_A.length - 10);
  assert.equal(row.v4.leakedBytes, SECRET_A.length - 10);
});

test('two findings straddling a secret: PARTIAL detection even though the output removes every byte', () => {
  const content = `k=${SECRET_A};`;
  const [s0, s1] = span(content, SECRET_A);
  const row = run(positiveFixture(content, [[s0, s1]]), content, [{ start: s0, end: s0 + 5, action: 'redact' }, { start: s0 + 5, end: s1, action: 'redact' }]);
  assert.equal(row.spans[0].detection, 'PARTIAL');
  assert.equal(row.spans[0].sanitization, 'removed');
  assert.equal(rowProblem(row), null);
});

test('overbroad finding: OVERBROAD detection, removed output, output collateral outside the envelope', () => {
  const content = `key: "${SECRET_A}" trailing`;
  const [s0, s1] = span(content, SECRET_A);
  const fixture = positiveFixture(content, [[s0, s1, { start: s0 - 1, end: s1 + 1 }]]);
  const row = run(fixture, content, [{ start: 0, end: content.length, action: 'redact' }]);
  assert.equal(row.spans[0].detection, 'OVERBROAD');
  assert.equal(row.spans[0].sanitization, 'removed');
  assert.equal(row.outputCollateralBytes, content.length - (SECRET_A.length + 2));
  assert.equal(row.v4.collateralBytes, row.outputCollateralBytes);
  assert.ok(isNotable(row));
});

test('extra findings in a positive file are out-of-envelope collateral, split by action, never true negatives', () => {
  const content = `k=${SECRET_A}\nnoise=harmless-words\nmore=benign`;
  const [s0, s1] = span(content, SECRET_A);
  const n = content.indexOf('harmless'), m = content.indexOf('benign');
  const row = run(positiveFixture(content, [[s0, s1]]), content, [
    { start: s0, end: s1, action: 'redact' }, { start: n, end: n + 8, action: 'warn' }, { start: m, end: m + 6, action: 'redact' },
  ]);
  assert.deepEqual(row.outOfEnvelopeFindings, { redact: 1, warn: 1 });
  assert.equal(row.outputCollateralBytes, 6);
  const { segments } = aggregateRows([row]);
  const s = segments['credentials|must-redact/T1|family'];
  assert.equal(s.collateral.filesWithOutOfEnvelopeFindings, 1);
  assert.equal('states' in s, false, 'a positive file never contributes a file-unit (TN/FP) count');
});

test('mixed actions on one span: warn plus redact sanitizes, and is classed mixed', () => {
  const content = `k=${SECRET_A}`;
  const [s0, s1] = span(content, SECRET_A);
  const row = run(positiveFixture(content, [[s0, s1]]), content, [{ start: s0, end: s1, action: 'warn' }, { start: s0 - 2, end: s1, action: 'block' }]);
  assert.equal(row.spans[0].actionClass, 'mixed');
  assert.equal(row.spans[0].sanitization, 'removed');
});

test('benign warn versus destructive flag on must-not-flag file units', () => {
  const content = 'value=looks-sensitive-but-is-not';
  const warn = run(controlFixture({ id: 'warned' }), content, [{ start: 6, end: 20, action: 'warn' }]);
  const redact = run(controlFixture({ id: 'redacted' }), content, [{ start: 6, end: 20, action: 'warn' }, { start: 21, end: 30, action: 'redact' }]);
  const clean = run(controlFixture({ id: 'clean' }), content, []);
  assert.deepEqual([warn.state, warn.strongestAction], ['flagged-non-destructive', 'warn']);
  assert.deepEqual([redact.state, redact.strongestAction, redact.actionCounts], ['flagged-destructive', 'redact', { redact: 1, warn: 1 }]);
  assert.equal(clean.state, 'clean');
  const { segments } = aggregateRows([warn, redact, clean]);
  const s = segments['credentials|must-not-flag/T2|global-untargeted'];
  assert.deepEqual(s.states, { clean: 1, 'flagged-non-destructive': 1, 'flagged-destructive': 1 });
  assert.equal(s.eligibleFiles, 3);
});

test('family strata and global untargeted controls never share a segment; twins keep a v4 co-detection reading', () => {
  const content = 'value=twin-shaped';
  const twin = run(controlFixture({ id: 'twin', contract: 'fake-family', twinOf: 'positive' }), content, [{ start: 6, end: 10, action: 'redact', family: 'other-family' }]);
  const nearMiss = run(controlFixture({ id: 'near', contract: 'fake-family' }), content, [{ start: 6, end: 10, action: 'redact', family: 'other-family' }]);
  const global = run(controlFixture({ id: 'global' }), content, [{ start: 6, end: 10, action: 'warn' }]);
  const { segments } = aggregateRows([twin, nearMiss, global]);
  assert.deepEqual(Object.keys(segments), ['credentials|must-not-flag/T2|family', 'credentials|must-not-flag/T2|global-untargeted']);
  const family = segments['credentials|must-not-flag/T2|family'];
  assert.equal(family.states['flagged-destructive'], 2);
  assert.deepEqual(family.flaggedAttribution, { 'own-or-unattributed': 0, 'other-family-only': 2 });
  // v4: the twin is co-detection (not a false alarm); the non-twin control keeps the global reading.
  assert.deepEqual(family.v4, { files: 2, flaggedFiles: 1 });
  assert.equal(family.families['fake-family'].eligibleFiles, 2);
});

test('failure states fail closed and never count as sanitization success', () => {
  const content = `k=${SECRET_A}`;
  const [s0, s1] = span(content, SECRET_A);
  const fixture = positiveFixture(content, [[s0, s1]]);
  const good = [{ start: s0, end: s1, action: 'redact' }];
  const thrown = run(fixture, content, good, { scanAndRedact: () => { const e = new Error(`echo ${SECRET_A}`); e.code = 'INPUT_LIMIT_EXCEEDED'; throw e; } });
  assert.deepEqual([thrown.status, thrown.code, thrown.spans], ['scan-error', 'INPUT_LIMIT_EXCEEDED', 1]);
  assert.ok(!JSON.stringify(thrown).includes(SECRET_A), 'no plaintext or error message survives');
  const unclassified = run(fixture, content, good, { scan: () => { throw new Error(SECRET_A); } });
  assert.deepEqual([unclassified.status, unclassified.code], ['scan-error', 'UNCLASSIFIED']);
  let call = 0;
  const unstable = run(fixture, content, good, { scanAndRedact: input => ({ text: call++ ? input : `k=<SECRET_1>`, findings: good.map(f => ({ type: 't', detector: 'd', ...f })) }) });
  assert.equal(unstable.status, 'unstable');
  // Claims to redact but leaves the value in place: the output does not match the findings.
  const lying = run(fixture, content, good, { scanAndRedact: input => ({ text: input, findings: good.map(f => ({ type: 't', detector: 'd', ...f })) }), redact: input => input });
  assert.deepEqual([lying.status, lying.code], ['output-unverified', 'OUTPUT_RECONSTRUCTION_MISMATCH']);
  const disagree = run(fixture, content, good, { redact: () => 'something else' });
  assert.deepEqual([disagree.status, disagree.code], ['output-unverified', 'REDACT_OUTPUT_DISAGREES']);
  const { segments } = aggregateRows([thrown, unstable, lying]);
  const s = segments['credentials|must-redact/T1|family'];
  assert.deepEqual(s.failedSpans, { 'scan-error': 1, unstable: 1, 'output-unverified': 1 });
  assert.equal(s.sanitization.removed, 0);
  assert.equal(s.eligibleSpans, 3);
});

test('T0 rows are pending and never scored', () => {
  const row = diagnoseRow({ ...positiveFixture('x', [[0, 1]]), tier: 'T0' }, { status: 'complete', findings: [], outputVerified: true, outputBytes: 1, plaintextInOutput: [true] }, 'credentials');
  assert.equal(row.unit, 'pending');
  const { segments, pending } = aggregateRows([row]);
  assert.deepEqual(segments, {});
  assert.deepEqual(pending, { 'credentials|must-redact/T0|family': 1 });
});

function reportFrom(rows, extra = {}) {
  const { segments, pending } = aggregateRows(rows);
  const report = {
    schemaVersion: UNIT_DIAGNOSTICS_SCHEMA_VERSION, generatedAt: '2026-09-28T00:00:00.000Z', mode: 'published',
    product: { package: '@redact-secret/core', version: '0.0.0-test', declaredVersion: '0.0.0-test', lockHash: 'a'.repeat(64) },
    corpus: { pinned: true, pinManifestRevision: 'b'.repeat(40), categories: { unit: 'c'.repeat(64) }, identity: 'd'.repeat(64) },
    configuration: {}, domains: { credentials: { status: 'measured' }, pii: { status: 'not-measured', reason: 'test' } }, units: {},
    segments, pending, v4Reference: {}, rowCount: rows.length, rowsDigest: rowsDigestOf(rows), notableRows: rows.filter(isNotable),
    provenance: { benchmarkRevision: 'e'.repeat(40), dirty: false }, runtime: {}, ...extra,
  };
  report.digest = digestOf(report);
  return report;
}
const redigest = report => ({ ...report, digest: digestOf(report) });

function sampleRows() {
  const content = `a=${SECRET_A}\nb=${SECRET_B}\n`;
  const [a0, a1] = span(content, SECRET_A), [b0, b1] = span(content, SECRET_B);
  return [
    run(positiveFixture(content, [[a0, a1], [b0, b1]], { id: 'multi' }), content, [{ start: a0, end: a1, action: 'redact' }, { start: b0, end: b1, action: 'warn' }]),
    run(positiveFixture(content, [[a0, a1]], { id: 'policy', kind: 'policy', tier: 'T3', contract: undefined }), content, [{ start: a0, end: a1, action: 'redact' }]),
    run(controlFixture({ id: 'c1' }), 'plain', []),
    run(controlFixture({ id: 'c2', tier: 'T3' }), 'plain', [{ start: 0, end: 2, action: 'warn' }]),
  ];
}

test('a well-formed report validates against the schema and every invariant, with and without its rows', () => {
  const rows = sampleRows();
  const report = reportFrom(rows);
  assert.ok(validateSchema(report), JSON.stringify(validateSchema.errors));
  assert.equal(reportProblem(report), null);
  assert.equal(reportProblem(report, rows), null);
  assert.deepEqual(Object.keys(report.segments), [
    'credentials|must-not-flag/T2|global-untargeted', 'credentials|must-not-flag/T3|global-untargeted',
    'credentials|must-redact/T1|family', 'credentials|policy/T3|uncontracted',
  ], 'policy/T3 stays separate from T1/T2');
  assert.match(renderUnitDiagnostics(report), /Secret-span units[\s\S]*File units/);
});

test('invariants reject a warn counted as sanitization success', () => {
  const rows = sampleRows();
  const report = reportFrom(rows);
  const key = 'credentials|must-redact/T1|family';
  const tampered = structuredClone(report);
  tampered.segments[key].sanitizationByActionClass['non-destructive'] = { removed: 1, 'partial-leak': 0, leaked: 0 };
  assert.match(reportProblem(redigest(tampered)), /non-destructive span counted as \(partially\) sanitized/);
  const row = structuredClone(rows[0]);
  row.spans[1].sanitization = 'removed';
  row.spans[1].outputLeakedBytes = 0;
  assert.match(rowProblem(row), /sanitized without a destructive finding/);
});

test('invariants reject sums that do not equal eligible denominators, mixed units and forbidden metrics', () => {
  const rows = sampleRows();
  const report = reportFrom(rows);
  const span = structuredClone(report);
  span.segments['credentials|must-redact/T1|family'].eligibleSpans += 1;
  assert.match(reportProblem(redigest(span)), /do not sum to eligible spans/);
  const file = structuredClone(report);
  file.segments['credentials|must-not-flag/T2|global-untargeted'].states.clean += 1;
  assert.match(reportProblem(redigest(file)), /do not sum to eligible files/);
  const mixed = structuredClone(report);
  mixed.segments['credentials|must-not-flag/T2|global-untargeted'].detection = {};
  assert.match(reportProblem(redigest(mixed)), /carries span-unit counts/);
  for (const key of ['precision', 'recall', 'f1', 'confusionMatrix', 'ranking']) {
    const bad = structuredClone(report);
    bad.segments['credentials|must-redact/T1|family'][key] = 0.5;
    assert.match(reportProblem(redigest(bad)), new RegExp(`forbidden key .*${key}`));
  }
  const recount = structuredClone(report);
  recount.segments['credentials|must-redact/T1|family'].outputLeakedBytes += 1;
  assert.equal(reportProblem(redigest(recount)), null, 'self-consistent on its own');
  assert.match(reportProblem(redigest(recount), rows), /segments are not the sum of their rows/);
});

test('versioning and identity: unknown schema, unpinned corpus, mode/candidate mismatch, digest drift', () => {
  const report = reportFrom(sampleRows());
  assert.match(reportProblem({ ...report, schemaVersion: 2 }), /Unsupported unit-diagnostics schemaVersion 2/);
  assert.equal(validateSchema({ ...report, schemaVersion: 2 }), false);
  assert.match(reportProblem(redigest({ ...report, corpus: { ...report.corpus, pinned: false } })), /pinned/);
  assert.match(reportProblem(redigest({ ...report, mode: 'candidate' })), /candidate identity/);
  assert.match(reportProblem({ ...report, units: { changed: true } }), /digest/);
  // The digest ignores wall clock, host and benchmark checkout, so reruns are comparable.
  assert.equal(digestOf({ ...report, generatedAt: 'later', runtime: { node: 'other' }, provenance: { benchmarkRevision: 'f'.repeat(40), dirty: true } }), report.digest);
});

test('the real published product: actual sanitized output is verified end to end', async () => {
  const api = await import('@redact-secret/core');
  await api.initialize();
  // Constructed at runtime so no credential-shaped literal sits in the source.
  const token = ['ghp', '_', 'Z'.repeat(36)].join('');
  const content = `export GITHUB_TOKEN=${token}\n`;
  const start = Buffer.byteLength(content.slice(0, content.indexOf(token)));
  const secrets = [{ start, end: start + token.length }];
  const observation = observeProduct(api, content, secrets);
  assert.equal(observation.status, 'complete');
  assert.deepEqual(observation.plaintextInOutput, [false]);
  const row = diagnoseRow(positiveFixture(content, [[start, start + token.length]]), observation, 'credentials');
  assert.equal(row.spans[0].sanitization, 'removed');
});

test('reproducibility: the published product over the pinned corpus yields the same digest twice, and validates its fresh report', async () => {
  const { measure } = await import('../benchmarks/unit-diagnostics.ts');
  const first = await measure({});
  const second = await measure({});
  assert.equal(first.report.digest, second.report.digest);
  assert.equal(reportProblem(first.report, first.rows), null);
  // v4 stays authoritative: diagnostics reproduce its per kind × tier counts (checked inside measure()).
  assert.ok(Object.keys(first.report.v4Reference).length > 0);
  assert.ok(validateSchema(first.report), JSON.stringify(validateSchema.errors?.slice(0, 3)));
});
