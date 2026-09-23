import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { kinds, tiers, contracts, classifyFixture, validateAssessment, validateContracts, controlAxis, AXES } from '../benchmarks/lib/assessment.ts';
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

// Engine v1.1 accounting with the floors relaxed, so tiny synthetic groups still publish a rate object.
const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url)));
const lax = { ...suite.accounting, minDenominator: 1, measurableShareFloor: 0, twinCoverageFloor: 0 };

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
  // v3 audit plus #369 expanded boundaries plus the beta.4 registry refresh
  // (17 new detector families): reviewed formats 226 files / 232 spans;
  // 176 policy; 184 negative controls; 33 unreviewed. Phase 5 moved the three
  // Vault recovery contexts from pending to policy because the provider
  // documents the hvr. prefix. #45 resolved all 55 pending/T0 fixtures: 22
  // malformed-by-construction controls promoted to must-not-flag/T2 (closing
  // a near-miss suffix regex gap) and huggingface-token's digit-bearing
  // shape promoted to must-redact/T2 (trufflehog's pinned alphabet is
  // alphanumeric, not letters-only); 30 remain pending with per-family
  // evidence gaps and tracking issues (vercel #516, stripe #513, slack #512,
  // supabase #515, linear un-tracked). #67 backfilled terraform-cloud-token
  // and pulumi-access-token (registered upstream but absent here): 18 new
  // must-redact/T1 positives (3 shapes × 3 contexts each) and 12 new
  // must-not-flag controls (6 twins + 6 independent negatives) per family.
  // #81 backfilled supabase-management-token (T1, two prefix shapes × 3
  // contexts = 6 positives, 2 twins × 3 contexts) and firebase-server-key
  // (T2, one shape × 3 contexts = 3 positives, 1 twin × 3 contexts): 9 new
  // must-redact positives, 9 new twins (6 supabase + 3 firebase) and 10 new
  // independent negatives (5 supabase + 5 firebase).
  // #569: `slack-token`'s `xoxb-` shape-1 and `cloudflare-token`'s `cfut_`
  // shape-1 were generated as a flat unstructured run, never matching either
  // family's own frozen `pattern` (`^xoxb-[0-9]{12}-[0-9]{12}-[A-Za-z0-9]{24}$`,
  // `^cfut_[A-Za-z0-9]{40}[a-f0-9]{8}$`); corrected to a contract-matching
  // structural shape, both move policy/T3 -> must-redact/T1 (+6 files/+6
  // spans: 3 contexts each).
  // #104/#107: `pypi-token`'s shape-1 was likewise a flat "pypi-" + random
  // run, never a serialized macaroon; corrected to the ADR-verified
  // construction (docs/decisions/2026-09-21-author-pypi-macaroon-positives-
  // synthetically.md), moving policy/T3 -> must-redact/T1 (+3 files/+3 spans:
  // 3 contexts).
  // #128: `docker-token`'s `shape-1` (`dckr_pat_`) was generated at the
  // shared 32-byte length the `families` loop applies to both prefixes, but
  // redact-secret#370 froze `dckr_pat_` at its own 27-byte length
  // (`dckr_oat_` stays 32); corrected to per-prefix lengths, moving
  // policy/T3 -> must-redact/T2 (+3 files/+3 spans: 3 contexts).
  // #112: 64 new must-redact/T2 positives in context-edges — the eight
  // pattern-contracted families that sat at the detector-coverage floor, each
  // across eight text contexts (fixtures/generated/context-families.mjs).
  // #161: `microsoft-entra-client-secret`'s lead alphabet widened to include
  // '-' (redact-secret#655's web-search pass: TruffleHog 3.97.4's
  // azure_entra/serviceprincipal/v2 detector and microsoft/security-utilities
  // SEC101/156 both accept it there; four independent field reports confirm
  // a real leading '-'). New must-redact/T2 leading-dash positive (+3
  // files/+3 spans: 3 contexts).
  // #162: datadog-application-key's ddapp_-prefixed shape (3 contexts) moves
  // policy/T3 -> must-redact/T1 (+3 files/+3 spans).
  // #160: 3 new must-redact/T2 positives (new-relic-license-key's currently
  // issued 32-hex-plus-FFFFNRAL generation, one per context) now that
  // trufflehog 3.97.4's newreliclicensekey detector corroborates the shape
  // (redact-secret/redact-secret#656); the legacy all-hex generation stays
  // policy/T3, unmatched by the new pattern.
  // #159: 6 new must-redact/T2 positives in detector-coverage — discord-bot-token's
  // current 26/6/38 and 24/6/38 shapes, each across three contexts.
  // Post-beta.6 registry refresh (redact-secret/redact-secret#308, product PR #665):
  // databricks-personal-access-token joins as must-redact/T2 — two shapes (bare,
  // rotation-suffixed) across three contexts (+6 files/+6 spans), 3 twins × 3
  // contexts (netted out below) and 6 independent controls.
  // redact-secret#309 (product PR #667): confluent-cloud-api-secret (T1, cflt +
  // 60 base64 × 3 contexts, +3 files/+3 spans; 2 twins × 3 contexts; 6 controls)
  // and confluent-cloud-api-secret-legacy (keyword-gated, policy/T3 below; 1 twin
  // × 3 contexts; 5 controls).
  // redact-secret#310 (product PR #668): postman-api-key (T2, PMAK- + 24 hex + "-" +
  // 34 hex × 3 contexts, +3 files/+3 spans; 3 twins × 3 contexts; 6 controls).
  // redact-secret#311 (product PR #666): netlify-token (T1, nfp_ + 36 [A-Za-z0-9_] as a
  // bare shape and inside a NETLIFY_AUTH_TOKEN assignment, × 3 contexts, +6 files/+6
  // spans; 2 twins × 3 contexts; 6 controls).
  // redact-secret#312 (product PR #675): heroku-api-key (T1, HRKU-AA + 58 × 3 contexts,
  // +3 files/+3 spans; 2 twins × 3 contexts; 5 controls) and heroku-api-key-legacy
  // (keyword-gated bare UUID, policy/T3 below; 1 twin × 3 contexts; 6 controls).
  assert.equal(tally['must-redact/T1'].files + tally['must-redact/T2'].files, 368);
  assert.equal(tally['must-redact/T1'].spans + tally['must-redact/T2'].spans, 374);
  // #66: 3 new policy/T3 positives (generic-token's markdown-inline-code
  // boundary, one per field) pin the exact metamorphic-derived shape
  // redact-secret#552 found undetected, independent of a fresh metamorphic run.
  // #112: 32 more — the four keyword-gated Datadog/Twilio families across the
  // same eight context-edges contexts, policy as in detector-coverage.
  // redact-secret#309: 3 more — confluent-cloud-api-secret-legacy's keyword-gated bare
  // 64-byte value across three contexts, policy as for twilio/datadog.
  // redact-secret#312: 3 more — heroku-api-key-legacy's keyword-gated bare UUID.
  assert.deepEqual(tally['policy/T3'], { files: 205, spans: 205 });
  assert.deepEqual(tally['must-redact/T0'], { files: 30, spans: 30 });
  const twins = all.flatMap(([, c]) => c.fixtures.filter(f => f.twinOf));
  // #62: 6 new independent benign controls (aws-access-key-mask,
  // jwt-prefix-only/reference/mask, private-key-prefix-only/reference) plus
  // 6 new twins (which net out of this count via -twins.length).
  // #64: 18 new independent negatives (leading/trailing/dash identifier-
  // embedding × 6 families), generalising the digitalocean-token-only shape.
  // #65: 16 new independent benign controls (mask/reference/label-prose
  // across vault-token, shopify-token, cloudflare-token, stripe-token, plus
  // one mask each for slack-token, gitlab-token, npm-token, github-token)
  // plus 10 new twins (netted out via -twins.length), to clear the stable
  // floors of 5 twin pairs and 5 benign cases for the ten T1 families #65
  // covers.
  // #66: 6 new independent negatives (leading/trailing/dash identifier-
  // embedding × 2 open-floor shapes, `linear-token`'s `lin_oauth_` and
  // `slack-token`'s `xoxe-`) — #64's generalisation above reused each
  // family's already-exact primary shape and never exercised the two
  // interim guards redact-secret#551 actually found still open-floored.
  // #93: 69 new independent negatives (mask/reference/label-prose across the
  // 23 families that previously carried only a same-axis near-miss pair), to
  // clear the stable floor of 3 benign axes for those families, plus one
  // reference control each for gitlab-token and npm-token so raising that
  // floor does not regress the two families already reading stable at it.
  // #107: 3 new independent negatives for `pypi-token` (public-identifier,
  // ordinary-prose, encoded-value axes), plus 2 new twins (netted out via
  // -twins.length) for the length and alphabet dimensions docs.pypi.org
  // documents alongside the existing prefix twin.
  // #105: 3 new independent negatives (digitalocean-token mask/label-prose/
  // reference) clear the same 3-axis floor for digitalocean-token, which #93
  // skipped (it was already at 5+ benign cases via #369's near-miss-only
  // controls, so it never appeared in #93's case-count-deficient scope).
  // #125: 3 new independent negatives (aws-access-key/github-token/slack-token
  // reference) land the third benign axis each of those families lacked.
  // #129: 8 new independent negatives (mask/reference each for docker-token,
  // huggingface-token, linear-token, openai-token) land the third benign axis
  // each of those four families lacked — the last families still at 1.
  // #161: `microsoft-entra-client-secret`'s leading-dash positive adds 2 new
  // independent negatives (missing-marker, short-suffix) and 3 new twins
  // (netted out via -twins.length): net +2.
  // #162: 1 new independent negative (datadog-application-key-prefixed-short-key)
  // plus a new prefix twin (netted out via -twins.length).
  // #159: 2 new independent negatives (discord-bot-token short-current-final-segment/
  // short-current-first-segment) cover the current-shape length boundaries.
  assert.equal(tally['must-not-flag/T1'].files + tally['must-not-flag/T2'].files + tally['must-not-flag/T3'].files - twins.length, 407);
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
  // #66: 3 new quoted-assignment envelopes (generic-token's markdown-inline-
  // code boundary, one per field).
  assert.equal(enveloped.length, 58);
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
  assert.equal(twins.length, 86);
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
  // #569/#107/#128: slack-token/cloudflare-token/pypi-token/docker-token
  // shape-1 now generate a contract-matching structural body (see the tally
  // test above) and correctly promote to must-redact.
  for (const id of ['anthropic-token-shape-1-bare', 'openai-token-shape-1-bare', 'vault-token-shape-1-bare', 'vault-token-shape-3-bare', 'private-key-private-key-bare', 'jwt-expired-fabricated-bare', 'aws-access-key-shape-1-bare', 'shopify-token-shape-1-bare', 'connection-string-postgres-bare', 'generic-token-api-key-bare']) assert.equal(get(id).assessment.kind, 'policy', id);
  assert.equal(get('slack-token-shape-1-bare').assessment.kind, 'must-redact');
  assert.equal(get('cloudflare-token-shape-1-bare').assessment.kind, 'must-redact');
  assert.equal(get('pypi-token-shape-1-bare').assessment.kind, 'must-redact');
  assert.equal(get('docker-token-shape-1-bare').assessment.kind, 'must-redact');
  assert.equal(get('docker-token-shape-1-bare').assessment.tier, 'T2');
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
  assert.throws(() => validateAssessment({ ...common[0], assessment: { kind: 'must-redact', tier: 'T2', reason: 'Unsupported promotion', contract: 'datadog-api-key', sources: ['x'] } }), /validator/);
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
  const result = scoreReport(selected, findings, lax);
  assert.deepEqual(Object.keys(result).sort(), ['accountingDelta', 'groups', 'rows']);
  assert.deepEqual(Object.keys(result.groups), ['must-not-flag/T2', 'must-redact/T1', 'pending/T0', 'policy/T3']);
  const t1 = result.groups['must-redact/T1'];
  assert.deepEqual([t1.twins.positives, t1.twins.pairs, t1.twins.discriminated, t1.twins.rate.point, t1.twins.coverage.point], [1, 1, 1, 1, 1]);
  assert.deepEqual([t1.leakedSpanRate.point, t1.leakedSpanRate.direction, t1.leakedSpanRate.n], [0, 'upper', 1]);
  assert.ok(t1.leakedSpanRate.bound > 0, 'one clean span is not evidence of a zero leak rate');
  assert.equal(result.groups['policy/T3'].outcomes.EXACT, 2);
  assert.deepEqual(result.groups['pending/T0'], { files: 1, scored: false, candidateKinds: { 'must-redact': 1 } });
  // The pending file is charged to the group it would have joined, next to the rate it is absent from.
  assert.deepEqual([t1.pendingFiles, t1.measurableShare.point], [1, 0.5]);
  assert.equal(scoreReport(selected, findings, suite.accounting).groups['must-redact/T1'].leakedSpanRate, 'insufficient-evidence');
  const pending = result.rows.find(r => r.tier === 'T0');
  assert.equal(pending.actual.length, 1);
  assert.equal(pending.spanOutcomes, undefined);
  const fixtures = selected.map(f => ({ ...f, category: 'mixed', slug: `mixed--${f.id}` }));
  const report = { schemaVersion: 5, accountingVersion: '1.1', accounting: lax, runId: '2026-09-17T00:00:00.000Z-abc123', category: 'mixed', corpusHash: 'hash', lockHash: 'lock', matching: 'v4', scanners: [{ id: 'test', name: 'Test', mode: 'offline', version: '1', status: 'complete', ...result }] };
  assert.equal(reportProblem(report, 'mixed', 'hash', fixtures), null);
  const { summaries, stale } = summarize(fixtures, [report]);
  assert.deepEqual(stale, []);
  assert.equal(summaries.length, 4);
  assert.deepEqual(summaries.find(s => s.key === 'must-redact/T1').metrics, t1, 'a full selection recomputes the published group, pending share included');
  assert.equal(summaries.find(s => s.key === 'pending/T0').metrics.scored, false);
  for (const [name, mutate] of [
    ['legacy', r => { r.schemaVersion = 3; }],
    ['v1.0 accounting', r => { delete r.accountingVersion; }],
    ['accounting block', r => { r.accounting.intervalZ = 0; }],
    ['relaxed floor after the fact', r => { r.accounting = { ...r.accounting, minDenominator: 2 }; }],
    ['published bound', r => { r.scanners[0].groups['must-redact/T1'].leakedSpanRate.bound = 0; }],
    ['delta', r => { r.scanners[0].accountingDelta.groups['must-redact/T1'].cause = ['interval']; }],
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
  assert.match(reportProblem({ ...report, schemaVersion: 4 }, 'mixed', 'hash', fixtures), /Legacy report/);
});

test('cross-suite views aggregate only the newest run id and name stale suites', () => {
  const a = common.find(f => f.id === 'npm-token-access-plain');
  const b = common.find(f => f.id === 'npm-token-access-plain-twin');
  const fixtures = [{ ...a, category: 'one', slug: 'one--' + a.id }, { ...b, category: 'one', slug: 'one--' + b.id }, { ...a, category: 'two', slug: 'two--' + a.id }];
  const make = (category, runId, findings) => ({ schemaVersion: 5, accountingVersion: '1.1', accounting: lax, runId, category, corpusHash: 'h', lockHash: 'l', matching: 'v4', reviewStatus: 'draft', scanners: [{ id: 't', name: 'T', mode: 'm', version: '1', status: 'complete', ...scoreReport(category === 'one' ? [a, b] : [a], findings, lax) }] });
  const hit = { path: a.path, ...a.expected[0] };
  const reports = [make('one', '2026-09-17T10:00:00.000Z-aaaaaa', [hit]), make('two', '2026-09-17T09:00:00.000Z-bbbbbb', [])];
  const { summaries, stale, runId } = summarize(fixtures, reports);
  assert.equal(runId, '2026-09-17T10:00:00.000Z-aaaaaa');
  assert.deepEqual(stale, ['two']);
  const redact = summaries.find(s => s.key === 'must-redact/T1');
  assert.equal(redact.rows.length, 1, 'the stale suite is not summed');
  assert.deepEqual([redact.metrics.twins.positives, redact.metrics.twins.pairs, redact.metrics.twins.discriminated, redact.metrics.twins.rate.point], [1, 1, 1, 1]);
  assert.equal(summarize(fixtures, reports, '2026-09-17T09:00:00.000Z-bbbbbb').summaries.find(s => s.key === 'must-redact/T1').metrics.leakedSpans, 1);
  assert.equal(summarize(fixtures, [reports[0], { ...reports[0], runId: '2026-09-17T11:00:00.000Z-cccccc', scanners: [{ ...reports[0].scanners[0], version: '2' }] }]).summaries.filter(s => s.key === 'must-redact/T1').length, 1, 'older run is stale, not a separate observation');
});

test('format-correct unsupported controls stay included regardless of scanner output', () => {
  const selected = common.filter(f => /docker-token|cloudflare-token|stripe-token-test/.test(f.id));
  const result = scoreReport(selected, [], lax);
  assert.equal(result.groups['must-redact/T2'].leakedSpans, selected.filter(f => f.assessment.kind === 'must-redact' && f.assessment.tier === 'T2').length);
  assert.equal(result.groups['must-redact/T1'].leakedSpanRate.point, 1);
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

test('controlAxis reads the same table as classifyControl: one id per suffix, and a stale suffix fails closed (#91)', () => {
  // One representative fixture per reviewed suffix/id/group, covering every axis the vocabulary names.
  const cases = [
    ['detector-coverage', 'aws-access-key-prefix-only', 'near-miss'],
    ['detector-coverage', 'digitalocean-token-leading-identifier-embedding', 'near-miss'],
    ['detector-coverage', 'vault-token-reference', 'reference'],
    ['detector-coverage', 'connection-string-public-url', 'reference'],
    ['detector-coverage', 'vault-token-mask', 'placeholder'],
    ['detector-coverage', 'private-key-label-prose', 'placeholder'],
    ['detector-coverage', 'jwt-ordinary-dotted-name', 'ordinary-prose'],
    ['detector-coverage', 'bearer-token-ordinary-prose', 'ordinary-prose'],
    ['sendgrid-regressions', 'short-id', 'near-miss'],
    ['sendgrid-regressions', 'masked', 'placeholder'],
    ['sendgrid-regressions', 'documentation', 'ordinary-prose'],
    ['negative-controls', 'prefix-only', 'near-miss'],
    ['negative-controls', 'sha256', 'public-identifier'],
    ['negative-controls', 'base64-text', 'encoded-value'],
    ['negative-controls', 'shell-reference', 'reference'],
    ['negative-controls', 'unicode-prose', 'ordinary-prose'],
    ['negative-controls', 'empty', 'placeholder'],
    ['accuracy', 'public-id', 'public-identifier'],
    ['token-contexts', 'env-reference', 'reference'],
    ['token-contexts', 'ordinary-text', 'ordinary-prose'],
    ['reference-syntax', 'jinja', 'reference'],
    ['milestone-6-closed', 'issue-262-yaml-block', 'near-miss'],
    ['milestone-6-closed', 'issue-265-secret-key-ref', 'reference'],
  ];
  const byCategory = new Map(all.map(([category, corpus]) => [category, corpus.fixtures]));
  for (const [category, id, axis] of cases) {
    const f = byCategory.get(category).find(x => x.id === id);
    assert.ok(f, `${category}/${id} fixture must exist`);
    assert.equal(controlAxis(category, f), axis, `${category}/${id}`);
  }
  assert.deepEqual(new Set(cases.map(([, , axis]) => axis)), new Set(AXES.filter(a => a !== 'pending')), 'every non-pending axis in the vocabulary is exercised above');
  // A suffix classifyControl does not recognize must fail closed on both sides of the shared table together.
  const stale = { id: 'aws-access-key-never-reviewed-suffix', group: 'aws-access-key', content: 'x', expected: [], detectors: ['aws-access-key'] };
  assert.equal(controlAxis('detector-coverage', stale), null);
  assert.equal(classifyFixture('detector-coverage', stale).tier, 'T0');
});
