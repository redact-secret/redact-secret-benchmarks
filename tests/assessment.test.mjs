import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { kinds, tiers, contracts, classifyFixture, validateAssessment, validateContracts } from '../benchmarks/lib/assessment.ts';
import { scoreReport } from '../benchmarks/lib/reporting.ts';
import { validateCorpus, score } from '../benchmarks/lib/scoring.ts';
import { validateStructures } from '../benchmarks/lib/validate-structures.ts';
import { spanOutcome } from '../benchmarks/lib/lattice.ts';
import { reportProblem, summarize } from '../src/model.mjs';
import { normalizeTrufflehogFindings } from '../scanners/index.mjs';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const generated = buildCorpora();
const handwritten = { accuracy: await read('fixtures/accuracy/corpus.json'), 'token-contexts': await read('fixtures/token-contexts/corpus.json') };
const all = Object.entries({ ...generated, ...handwritten });
const common = generated['common-formats'].fixtures;
const legacy = generated['detector-coverage'].fixtures;
const get = id => legacy.find(f => f.id === id);

test('contracts are provider-first: T1 needs a dated provider source, T2 needs corroboration', async () => {
  validateContracts();
  const registry = await read('benchmarks/detectors.json');
  assert.deepEqual(Object.keys(contracts).sort(), registry.detectors.map(d => d.id).sort());
  for (const [family, c] of Object.entries(contracts)) {
    if (c.tier === 'T1') assert.match(c.providerSource.observedAt, /^\d{4}-\d{2}-\d{2}$/, family);
    if (c.tier === 'T2') assert.ok(c.review && c.corroboration.length, family);
    if (c.tier === 'T3') assert.ok(!c.pattern && c.review, family);
  }
  assert.equal(contracts['vault-token'].tier, 'T1');
  assert.ok(new RegExp(contracts['vault-token'].pattern).test('hvs.CvmS4c0DPTvHv5eJgXWMJg9r'), 'the provider-documented example must satisfy the T1 contract');
  assert.deepEqual(Object.keys(kinds), ['must-redact', 'must-not-flag', 'policy']);
  assert.deepEqual(Object.keys(tiers), ['T1', 'T2', 'T3', 'T0']);
});

test('every fixture has an input-derived (kind, tier) and the mechanical v3 → v4 mapping holds', () => {
  const tally = {};
  for (const [category, corpus] of all) for (const f of corpus.fixtures) {
    validateAssessment(f);
    assert.deepEqual(f.assessment, classifyFixture(category, f), f.id);
    const key = `${f.assessment.kind}/${f.assessment.tier}`;
    tally[key] ??= { files: 0, spans: 0 };
    tally[key].files++;
    tally[key].spans += f.expected.filter(r => r.role === 'secret').length;
    if (f.assessment.kind === 'must-not-flag') assert.equal(f.expected.length, 0, f.id);
    if (f.assessment.kind === 'policy') assert.equal(f.assessment.tier, 'T3', f.id);
    if (f.assessment.kind === 'must-redact' && f.assessment.tier !== 'T0') assert.equal(contracts[f.assessment.contract].tier, f.assessment.tier, f.id);
  }
  // v3 audit: reviewed formats 190 files / 195 spans; masking 69 + malformed-with-spans 86 = 155 policy;
  // 168 negative controls; 36 unreviewed. Phase 5 moved the three Vault recovery
  // contexts from pending to policy because the provider documents the hvr. prefix.
  assert.equal(tally['must-redact/T1'].files + tally['must-redact/T2'].files, 190);
  assert.equal(tally['must-redact/T1'].spans + tally['must-redact/T2'].spans, 195);
  assert.deepEqual(tally['policy/T3'], { files: 158, spans: 158 });
  assert.deepEqual(tally['must-redact/T0'], { files: 33, spans: 33 });
  const twins = all.flatMap(([, c]) => c.fixtures.filter(f => f.twinOf));
  assert.equal(tally['must-not-flag/T1'].files + tally['must-not-flag/T2'].files + tally['must-not-flag/T3'].files - twins.length, 168);
  assert.equal(classifyFixture('unknown', { id: 'future', content: 'secret', expected: [{ start: 0, end: 6, role: 'secret' }] }).tier, 'T0');
  assert.equal(classifyFixture('unknown', { id: 'future', content: 'benign', expected: [] }).tier, 'T0');
});

test('v4 outcomes reduce to the v3 exact/containment rule when no envelope is authored', () => {
  for (const [, corpus] of all) for (const f of corpus.fixtures) {
    for (const e of f.expected.filter(r => r.role === 'secret' && !r.envelope)) {
      const variants = [[{ ...e }], [{ start: Math.max(0, e.start - 1), end: e.end + 1 }], [{ start: e.start, end: e.end - 1 }], [], [{ start: 0, end: Buffer.byteLength(f.content) }]];
      for (const actual of variants.filter(v => v.every(a => a.end > a.start))) {
        const outcome = spanOutcome(e, actual);
        const exact = actual.some(a => a.start === e.start && a.end === e.end);
        const contained = actual.some(a => a.start <= e.start && a.end >= e.end);
        assert.equal(outcome === 'EXACT', exact, f.id);
        assert.equal(['EXACT', 'COVERED', 'OVERBROAD'].includes(outcome), contained, f.id);
        assert.equal(outcome === 'OVERBROAD', contained && !exact, `${f.id}: broader-only becomes OVERBROAD without an envelope`);
        assert.notEqual(outcome, 'COVERED', 'COVERED requires an authored envelope');
      }
    }
  }
});

test('envelopes are authored where v3 needed prose: URIs, OTP, Bearer, quoted generics', () => {
  const enveloped = all.flatMap(([category, c]) => c.fixtures.filter(f => f.expected.some(r => r.envelope)).map(f => ({ category, f })));
  assert.equal(enveloped.length, 55);
  for (const { f } of enveloped) for (const r of f.expected) {
    const bytes = Buffer.from(f.content);
    const whole = bytes.subarray(r.envelope.start, r.envelope.end).toString();
    assert.ok(/^(?:[a-z]+:\/\/|otpauth:\/\/|Authorization: Bearer |[A-Za-z_]+(?:=|: )")/.test(whole), `${f.id}: ${whole}`);
    assert.ok(r.envelope.start <= r.start && r.envelope.end >= r.end && r.envelope.reason.length > 20, f.id);
  }
  const postgres = get('connection-string-postgres-bare');
  const [span] = postgres.expected;
  assert.equal(spanOutcome(span, [{ start: span.envelope.start, end: span.envelope.end }]), 'COVERED');
  assert.equal(spanOutcome(span, [{ start: 0, end: Buffer.byteLength(postgres.content) }]), 'COVERED', 'bare URI is the whole file');
  const quotedPostgres = get('connection-string-postgres-quoted');
  assert.equal(spanOutcome(quotedPostgres.expected[0], [{ start: 0, end: Buffer.byteLength(quotedPostgres.content) }]), 'OVERBROAD');
});

test('corpus validation rejects malformed roles, envelopes and twins', () => {
  const base = structuredClone(get('connection-string-postgres-bare'));
  const ok = { schemaVersion: 2, fixtures: [base] };
  assert.doesNotThrow(() => validateCorpus(ok));
  const mutate = fn => { const c = structuredClone(ok); fn(c.fixtures[0], c); return c; };
  assert.throws(() => validateCorpus(mutate(f => { delete f.expected[0].role; })), /role/);
  assert.throws(() => validateCorpus(mutate(f => { f.expected[0].envelope.start = f.expected[0].start + 1; })), /envelope/i);
  assert.throws(() => validateCorpus(mutate(f => { f.expected[0].envelope.reason = ''; })), /envelope/i);
  assert.throws(() => validateCorpus(mutate(f => { f.expected[0].envelope.end = 999; })), /envelope/i);
  assert.throws(() => validateCorpus(mutate(f => { f.expected.push({ start: f.expected[0].envelope.end - 1, end: f.expected[0].envelope.end, role: 'secret', envelope: { start: 0, end: 5, reason: 'x' } }); })), /Invalid UTF-8 range|overlaps/);
  const twin = structuredClone(common.find(f => f.id === 'github-token-ghp-plain-twin'));
  const positive = structuredClone(common.find(f => f.id === 'github-token-ghp-plain'));
  assert.doesNotThrow(() => validateCorpus({ fixtures: [positive, twin] }));
  assert.throws(() => validateCorpus({ fixtures: [twin] }), /twin/i);
  assert.throws(() => validateCorpus({ fixtures: [positive, { ...twin, mutation: '' }] }), /mutation/i);
  assert.throws(() => validateCorpus({ fixtures: [positive, { ...twin, expected: positive.expected }] }), /twin/i);
});

test('twins mutate exactly one property, pair with their positive and never carry spans', () => {
  const twins = common.filter(f => f.twinOf);
  assert.equal(twins.length, 56);
  const untwinned = common.filter(f => f.assessment.kind === 'must-redact' && !twins.some(t => t.twinOf === f.id));
  assert.deepEqual(untwinned.map(f => f.id), ['aws-access-key-pair-plain', 'aws-access-key-pair-unicode-crlf'], 'the ID/secret pair has no single-mutation twin yet');
  for (const t of twins) {
    const p = common.find(f => f.id === t.twinOf);
    assert.equal(t.assessment.kind, 'must-not-flag');
    assert.equal(t.expected.length, 0);
    assert.equal(t.detectors[0], p.detectors[0]);
    assert.match(t.mutation, /^(length|prefix namespace|boundary|alphabet|internal marker|public prefix|public material)/, t.id);
    const value = Buffer.from(p.content).subarray(p.expected[0].start, p.expected[0].end).toString();
    assert.ok(!t.content.includes(value), `${t.id} must not contain the positive's secret`);
    const contract = contracts[p.assessment.contract];
    if (contract.pattern) assert.ok(!t.content.split(/\r?\n/).some(line => new RegExp(contract.pattern).test(line)), `${t.id} must not satisfy the contract`);
    assert.equal(t.assessment.tier, t.mutationKind === 'public-prefix' && contract.tier === 'T1' ? 'T1' : 'T2', t.id);
  }
  assert.deepEqual(twins.filter(t => t.assessment.tier === 'T1').map(t => t.id.replace(/-(plain|unicode-crlf)-twin$/, '')).filter((v, i, a) => a.indexOf(v) === i), ['stripe-token-live', 'stripe-token-test', 'private-key-ed25519']);
});

test('malformed fixtures, missing companions and pending variants cannot pass as must-redact', () => {
  for (const id of ['anthropic-token-shape-1-bare', 'openai-token-shape-1-bare', 'slack-token-shape-1-bare', 'pypi-token-shape-1-bare', 'docker-token-shape-1-bare', 'cloudflare-token-shape-1-bare', 'vault-token-shape-1-bare', 'vault-token-shape-3-bare', 'private-key-private-key-bare', 'jwt-expired-fabricated-bare', 'aws-access-key-shape-1-bare', 'shopify-token-shape-1-bare', 'connection-string-postgres-bare', 'generic-token-api-key-bare']) assert.equal(get(id).assessment.kind, 'policy', id);
  for (const id of ['supabase-token-shape-1-bare', 'vercel-token-shape-1-bare', 'linear-token-shape-2-bare', 'slack-token-shape-4-bare']) assert.equal(get(id).assessment.tier, 'T0', id);
  assert.equal(get('digitalocean-token-shape-1-bare').assessment.tier, 'T1');
  assert.equal(get('linear-token-shape-1-bare').assessment.tier, 'T2');
  const anthropic = structuredClone(common.find(f => f.id === 'anthropic-token-api03-plain'));
  anthropic.content = anthropic.content.replace(/AA\n/, 'AB\n');
  assert.throws(() => validateAssessment(anthropic), /contract/);
  const shopify = structuredClone(common.find(f => f.id === 'shopify-token-shpat-plain'));
  shopify.content = shopify.content.replace('.myshopify.com', '.example.invalid');
  assert.throws(() => validateAssessment(shopify), /domain/);
  const aws = structuredClone(common.find(f => f.id === 'aws-access-key-pair-plain'));
  aws.expected.pop();
  assert.throws(() => validateAssessment(aws), /pair/);
  assert.throws(() => validateAssessment({ ...common[0], assessment: { kind: 'must-redact', tier: 'T1', reason: 'Unsupported promotion', contract: 'pypi-token', sources: ['x'] } }), /validator/);
  assert.throws(() => validateAssessment({ ...common[0], assessment: { kind: 'must-redact', tier: 'T2', reason: 'Tier mismatch', contract: 'github-token', sources: ['x'] } }), /evidence/);
  assert.throws(() => validateAssessment({ ...common[0], assessment: { kind: 'policy', tier: 'T1', reason: 'x', sources: [] } }), /T3/);
  assert.throws(() => validateAssessment({ id: 'missing' }), /assessment/);
});

test('cryptographic controls parse and signatures verify; corrupted signatures are rejected', () => {
  validateStructures(common);
  const corrupt = structuredClone(common);
  const jwt = corrupt.find(f => f.id === 'jwt-eddsa-plain');
  const at = jwt.content.lastIndexOf('.') + 1;
  jwt.content = jwt.content.slice(0, at) + (jwt.content[at] === 'A' ? 'B' : 'A') + jwt.content.slice(at + 1);
  assert.throws(() => validateStructures(corrupt), /signature/);
  const invalid = structuredClone(common);
  const key = invalid.find(f => f.id === 'private-key-ed25519-plain');
  key.content = key.content.replace('MC4C', 'AAAA');
  assert.throws(() => validateStructures(invalid));
});

test('reports export per-group metrics only and the client re-verifies every row and total', () => {
  const selected = [common.find(f => f.id === 'github-token-ghp-plain'), common.find(f => f.id === 'github-token-ghp-plain-twin'), get('aws-access-key-shape-1-bare'), get('anthropic-token-shape-1-bare'), get('vercel-token-shape-1-bare'), get('github-token-prefix-only')];
  const findings = selected.flatMap(f => f.expected.map(r => ({ path: f.path, start: r.start, end: r.end })));
  const result = scoreReport(selected, findings);
  assert.deepEqual(Object.keys(result).sort(), ['groups', 'rows']);
  assert.deepEqual(Object.keys(result.groups), ['must-not-flag/T2', 'must-redact/T1', 'pending/T0', 'policy/T3']);
  assert.deepEqual(result.groups['must-redact/T1'].twins, { positives: 1, pairs: 1, discriminated: 1, rate: 1 });
  assert.equal(result.groups['must-redact/T1'].leakedSpanRate, 0);
  assert.equal(result.groups['policy/T3'].outcomes.EXACT, 2);
  assert.deepEqual(result.groups['pending/T0'], { files: 1, scored: false });
  const pending = result.rows.find(r => r.tier === 'T0');
  assert.equal(pending.actual.length, 1);
  assert.equal(pending.spanOutcomes, undefined);
  const fixtures = selected.map(f => ({ ...f, category: 'mixed', slug: `mixed--${f.id}` }));
  const report = { schemaVersion: 4, runId: '2026-09-17T00:00:00.000Z-abc123', category: 'mixed', corpusHash: 'hash', lockHash: 'lock', matching: 'v4', scanners: [{ id: 'test', name: 'Test', mode: 'offline', version: '1', status: 'complete', ...result }] };
  assert.equal(reportProblem(report, 'mixed', 'hash', fixtures), null);
  const { summaries, stale } = summarize(fixtures, [report]);
  assert.deepEqual(stale, []);
  assert.equal(summaries.length, 4);
  assert.deepEqual(summaries.find(s => s.key === 'must-redact/T1').metrics.twins, { positives: 1, pairs: 1, discriminated: 1, rate: 1 });
  assert.equal(summaries.find(s => s.key === 'pending/T0').metrics.scored, false);
  for (const [name, mutate] of [
    ['legacy', r => { r.schemaVersion = 3; }],
    ['no run id', r => { delete r.runId; }],
    ['scanner-wide total', r => { r.scanners[0].tp = 4; }],
    ['precision anywhere', r => { r.scanners[0].groups['must-redact/T1'].precision = 1; }],
    ['group total', r => { r.scanners[0].groups['must-redact/T1'].leakedSpans = 1; }],
    ['pending scored', r => { r.scanners[0].rows.find(x => x.tier === 'T0').spanOutcomes = ['EXACT']; }],
    ['row outcome', r => { r.scanners[0].rows[0].spanOutcomes = ['MISS']; }],
    ['row bytes', r => { r.scanners[0].rows[0].collateralBytes = 3; }],
    ['control count', r => { r.scanners[0].rows[1].findings = 9; }],
    ['assessment', r => { r.scanners[0].rows[0].tier = 'T2'; }],
    ['twin link', r => { delete r.scanners[0].rows[1].twinOf; }],
    ['envelope', r => { r.scanners[0].rows[0].expected[0].envelope = { start: 0, end: 5 }; }],
    ['row tp', r => { r.scanners[0].rows[0].tp = 1; }],
  ]) {
    const bad = structuredClone(report); mutate(bad);
    assert.ok(reportProblem(bad, 'mixed', 'hash', fixtures), name);
  }
  assert.match(reportProblem({ ...report, schemaVersion: 3 }, 'mixed', 'hash', fixtures), /Legacy report/);
});

test('cross-suite views aggregate only the newest run id and name stale suites', () => {
  const a = common.find(f => f.id === 'npm-token-access-plain');
  const b = common.find(f => f.id === 'npm-token-access-plain-twin');
  const fixtures = [{ ...a, category: 'one', slug: 'one--' + a.id }, { ...b, category: 'one', slug: 'one--' + b.id }, { ...a, category: 'two', slug: 'two--' + a.id }];
  const make = (category, runId, findings) => ({ schemaVersion: 4, runId, category, corpusHash: 'h', lockHash: 'l', matching: 'v4', reviewStatus: 'draft', scanners: [{ id: 't', name: 'T', mode: 'm', version: '1', status: 'complete', ...scoreReport(category === 'one' ? [a, b] : [a], findings) }] });
  const hit = { path: a.path, ...a.expected[0] };
  const reports = [make('one', '2026-09-17T10:00:00.000Z-aaaaaa', [hit]), make('two', '2026-09-17T09:00:00.000Z-bbbbbb', [])];
  const { summaries, stale, runId } = summarize(fixtures, reports);
  assert.equal(runId, '2026-09-17T10:00:00.000Z-aaaaaa');
  assert.deepEqual(stale, ['two']);
  const redact = summaries.find(s => s.key === 'must-redact/T1');
  assert.equal(redact.rows.length, 1, 'the stale suite is not summed');
  assert.deepEqual(redact.metrics.twins, { positives: 1, pairs: 1, discriminated: 1, rate: 1 });
  assert.equal(summarize(fixtures, reports, '2026-09-17T09:00:00.000Z-bbbbbb').summaries.find(s => s.key === 'must-redact/T1').metrics.leakedSpans, 1);
  assert.equal(summarize(fixtures, [reports[0], { ...reports[0], runId: '2026-09-17T11:00:00.000Z-cccccc', scanners: [{ ...reports[0].scanners[0], version: '2' }] }]).summaries.filter(s => s.key === 'must-redact/T1').length, 1, 'older run is stale, not a separate observation');
});

test('format-correct unsupported controls stay included regardless of scanner output', () => {
  const selected = common.filter(f => /docker-token|cloudflare-token|stripe-token-test/.test(f.id));
  const result = scoreReport(selected, []);
  assert.equal(result.groups['must-redact/T2'].leakedSpans, selected.filter(f => f.assessment.kind === 'must-redact' && f.assessment.tier === 'T2').length);
  assert.equal(result.groups['must-redact/T1'].leakedSpanRate, 1);
  assert.equal(result.groups['must-redact/T1'].twins.discriminated, 0, 'a clean twin does not count when the positive leaks');
  assert.equal(result.groups['pending/T0'], undefined);
});

test('AWS and Shopify composites map reported components without borrowing expectations', () => {
  const aws = common.find(f => f.id === 'aws-access-key-pair-unicode-crlf');
  const values = aws.expected.map(r => Buffer.from(aws.content).subarray(r.start, r.end).toString());
  const metadata = (f, line) => ({ Data: { Filesystem: { file: f.path, line } } });
  const row = { DetectorName: 'AWS', Raw: values[0], RawV2: values.join(':'), SourceMetadata: metadata(aws, 2) };
  const expected = aws.expected.map(({ start, end }) => ({ path: aws.path, start, end }));
  assert.deepEqual(normalizeTrufflehogFindings([{ ...aws, expected: [] }], '/tmp', row), expected);
  assert.throws(() => normalizeTrufflehogFindings([aws], '/tmp', { ...row, RawV2: values[0] }), /composite/);
  assert.throws(() => normalizeTrufflehogFindings([{ ...aws, content: aws.content + '\n' + values[1] }], '/tmp', row), /Ambiguous/);
  const shop = common.find(f => f.id === 'shopify-token-shpat-unicode-crlf');
  const token = Buffer.from(shop.content).subarray(shop.expected[0].start, shop.expected[0].end).toString();
  const shopRow = { DetectorName: 'Shopify', Raw: token + 'benchmark-never-issued.myshopify.com', SourceMetadata: metadata(shop, 2) };
  assert.deepEqual(normalizeTrufflehogFindings([{ ...shop, expected: [] }], '/tmp', shopRow), shop.expected.map(({ start, end }) => ({ path: shop.path, start, end })));
  assert.throws(() => normalizeTrufflehogFindings([shop], '/tmp', { ...shopRow, Raw: token + 'absent.myshopify.com' }));
  assert.deepEqual(score([aws], expected).rows[0].spanOutcomes, ['EXACT', 'EXACT']);
});
