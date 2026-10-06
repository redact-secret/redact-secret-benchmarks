import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AXES, CLAIMS, EVIDENCE, FAMILY_IDS, INEXPRESSIBLE, ROWS, cases, corpusDigest, counts } from '../benchmarks/group-e/corpus-e.mjs';
import { CASE_IDS, FIXTURE_SETS, SNAPSHOT_TAG } from '../benchmarks/group-e/extract-evidence.mjs';
import { proposedFreeze, traceability } from '../benchmarks/group-e/build-artifacts.mjs';
import * as batch2Score from '../benchmarks/batch2/score-r2.mjs';
import * as groupScore from '../benchmarks/group-e/score-e.mjs';

// Group E (#754) corpus unit and schema tests. None of them invokes a detector, a scanner, a CLI or the product.

const file = (p) => new URL(`../${p}`, import.meta.url);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const bytes = (c, s) => Buffer.from(c.text, 'utf8').subarray(s.start, s.end).toString('utf8');
const byId = new Map(cases.map((c) => [c.id, c]));

test('evidence input: the snapshot, the 27 Cases and the 89 fixtures of the nine rows', () => {
  assert.equal(EVIDENCE.snapshot.tag, SNAPSHOT_TAG);
  assert.match(EVIDENCE.snapshot.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(EVIDENCE.cases).sort(), [...CASE_IDS].sort());
  assert.equal(EVIDENCE.fixtures.length, 89);
  assert.equal(new Set(EVIDENCE.fixtures.map((f) => f.id)).size, 89);
  assert.equal(FIXTURE_SETS.length, 7);
  const covered = new Set();
  for (const f of EVIDENCE.fixtures) {
    covered.add(f.case);
    const e = EVIDENCE.cases[f.case];
    assert.equal(f.outcome, e.outcome, f.id);
    for (const s of f.spans) assert.ok(s.start >= 0 && s.end > s.start && s.end <= Buffer.byteLength(f.text), f.id);
    assert.equal(f.spans.length > 0, e.outcome === 'must-flag', f.id);
  }
  // the one Case without a fixture is the Adobe key file text: any value would guess an encoding
  assert.deepEqual(CASE_IDS.filter((c) => !covered.has(c)), ['adobe-jwt-private-key-file-contents-unsettled']);
  // maintainer-only Cases have a decided outcome, draft Cases are not-assertable
  for (const e of Object.values(EVIDENCE.cases)) assert.equal(e.lifecycle === 'draft', e.outcome === 'not-assertable');
  for (const id of CASE_IDS) assert.ok(CLAIMS[id]?.length, id);
});

test('the nine rows are exactly the Group E rows and every case belongs to one', () => {
  assert.equal(ROWS.length, 9);
  assert.deepEqual([...FAMILY_IDS], [...ROWS]);
  for (const c of cases) {
    assert.ok(ROWS.includes(c.family), c.id);
    for (const f of c.families) assert.ok(ROWS.includes(f), c.id);
    assert.ok(c.families.includes(c.family), c.id);
  }
  const k = counts();
  for (const f of ROWS) {
    assert.ok(k[f].control > 0 && k[f].unsupported > 0, f);
    if (f !== 'adobe:service-account-jwt-private-key') assert.ok(k[f].positive >= 25, f);
  }
  // Adobe has no assertable positive Case, so no scored positive
  assert.equal(k['adobe:service-account-jwt-private-key'].positive, 0);
});

test('case shape: unique ids, defined axes, spans in UTF-8 bytes, no scored type or action', () => {
  assert.equal(byId.size, cases.length);
  for (const c of cases) {
    assert.ok(c.id.startsWith(`${c.family}:e:`), c.id);
    assert.ok(c.axes.length > 0, c.id);
    for (const a of c.axes) assert.ok(AXES[a], `${c.id}: ${a}`);
    assert.equal(c.expectedType, null, c.id);
    assert.equal(c.expectedAction, null, c.id);
    assert.ok(['positive', 'control', 'unsupported', 'conflict'].includes(c.kind), c.id);
    const len = Buffer.byteLength(c.text);
    if (c.kind === 'positive') {
      for (const s of [c.expected, ...c.expectedExtra]) {
        assert.ok(Number.isInteger(s.start) && s.start >= 0 && s.end > s.start && s.end <= len, c.id);
        assert.ok(s.end - s.start >= 12, `${c.id}: a positive value is at least 12 bytes`);
      }
      assert.ok(c.expectedExtra.every((s) => bytes(c, s) === bytes(c, c.expected)), `${c.id}: repeated spans carry the same value`);
    } else {
      assert.equal(c.expected, null, c.id);
      assert.deepEqual(c.expectedExtra, [], c.id);
    }
    if (c.kind === 'control' || c.kind === 'conflict' && c.derivation === 'fixture-mirror') assert.deepEqual(c.observedSpans, [], c.id);
    for (const s of c.observedSpans) assert.ok(s.end > s.start && s.end <= len, c.id);
  }
});

test('expectations come only from the Case outcome: kind, outcome and derivation agree', () => {
  for (const c of cases) {
    const e = EVIDENCE.cases[c.case];
    assert.ok(e, c.id);
    if (c.downgraded) {
      // a ruling observed-only case keeps its Case but is never scored
      assert.ok(['unsupported', 'conflict'].includes(c.kind), c.id);
      assert.equal(c.expected, null, c.id);
      assert.ok(c.downgraded.ref && c.downgraded.why && ['positive', 'control'].includes(c.downgraded.from), c.id);
      if (c.kind === 'conflict') assert.equal(e.outcome, 'must-not-flag', c.id);
      continue;
    }
    if (c.kind === 'positive') {
      assert.equal(e.outcome, 'must-flag', c.id);
      assert.ok(['fixture-mirror', 'carrier-extension'].includes(c.derivation), c.id);
    } else if (c.kind === 'control') {
      assert.equal(e.outcome, 'must-not-flag', c.id);
      assert.ok(['fixture-mirror', 'class-extension'].includes(c.derivation), c.id);
    } else {
      // observed only: a Case that asserts nothing, a probe no Case asserts, or a not-assertable fixture
      assert.ok(['fixture-mirror', 'unsettled-case', 'probe'].includes(c.derivation), c.id);
      if (c.derivation !== 'probe') assert.equal(e.outcome, 'not-assertable', c.id);
    }
    assert.ok(c.derivation !== 'fixture-mirror' || c.fixture, c.id);
  }
});

test('every fixture is mirrored exactly once, with the fixture text and spans', () => {
  const mirrors = cases.filter((c) => c.derivation === 'fixture-mirror');
  assert.equal(mirrors.length, 89);
  assert.equal(new Set(mirrors.map((c) => c.fixture)).size, 89);
  for (const f of EVIDENCE.fixtures) {
    const c = mirrors.find((m) => m.fixture === f.id);
    assert.ok(c, f.id);
    assert.equal(c.text, f.text, f.id);
    assert.equal(c.case, f.case, f.id);
    const all = f.spans.map((s) => ({ start: s.start, end: s.end }));
    assert.deepEqual(c.kind === 'positive' ? [c.expected, ...c.expectedExtra] : c.observedSpans, all, f.id);
    const natural = { 'must-flag': 'positive', 'must-not-flag': 'control', 'not-assertable': 'unsupported' }[f.outcome];
    assert.equal(c.downgraded ? c.downgraded.from : c.kind, natural, f.id);
  }
});

test('every Case is covered by at least one test case and the Case is named for each', () => {
  const named = new Set(cases.map((c) => c.case));
  assert.deepEqual([...named].sort(), [...CASE_IDS].sort());
  for (const f of Object.keys(EVIDENCE.cases)) assert.ok(cases.some((c) => c.case === f), f);
});

test('carrier positions the Cases state: the span sits where the Case says', () => {
  const pre = (c, n = 40) => Buffer.from(c.text, 'utf8').subarray(Math.max(0, c.expected.start - n), c.expected.start).toString('utf8');
  const pos = (c) => cases.filter((x) => x.family === c && x.kind === 'positive');
  for (const c of pos('airtable:legacy-api-key')) assert.ok(/api_key=$/.test(pre(c)), c.id);
  for (const c of pos('hubspot:legacy-api-key')) assert.ok(/hapikey=$/.test(pre(c)), c.id);
  // JFrog: the header value or the Basic password only
  for (const c of pos('jfrog:api-key')) assert.ok(/X-JFrog-Art-Api?["']?\s*:\s*["']?$/i.test(pre(c)) || /-u "?'?[^\s:]+:$/.test(pre(c)), c.id);
  // Zendesk: the token after /token:, or the whole encoded run after Basic whose decoding is {email}/token:{token}
  for (const c of pos('zendesk:api-token')) {
    const val = bytes(c, c.expected);
    if (c.case === 'zendesk-api-token-basic-credential-encoded-header-value') {
      assert.ok(/Basic $/.test(pre(c, 6)), c.id);
      assert.match(Buffer.from(val, 'base64').toString('utf8'), /^[^:/]+@[^:/]+\/token:.+$/, c.id);
      assert.match(val, /^[A-Za-z0-9+/]+={0,2}$/, c.id);
    } else {
      assert.ok(/\/token:$/.test(pre(c)), c.id);
      assert.ok(!val.includes('@') && !val.includes('/token'), c.id);
    }
  }
  for (const c of pos('dropbox:legacy-long-lived-access-token')) assert.ok(/"access_token"\s*:\s*"$/.test(pre(c)), c.id);
  for (const c of pos('reddit:oauth-access-token')) assert.ok(/(access_token"\s*:\s*"|access_token=|token=|bearer )$/.test(pre(c)), c.id);
  for (const c of pos('reddit:oauth-refresh-token')) assert.ok(/refresh_token("\s*:\s*"|=)$/.test(pre(c)), c.id);
  for (const c of pos('reddit:app-client-secret')) assert.ok(/(-u|--user) ['"]?[^\s:]+:$/.test(pre(c, 80)), c.id);
});

test('the same shape never decides: the shape-independence cases cover five shapes per slot kind', () => {
  const shapes = cases.filter((c) => c.axes.includes('shape-independence') && c.kind === 'positive');
  assert.ok(shapes.length >= 9 * 5 - 5);
  for (const f of ROWS.filter((r) => r !== 'adobe:service-account-jwt-private-key')) assert.ok(shapes.some((c) => c.family === f), f);
});

test('era words never justify silence: every assertable row has a positive with era words', () => {
  for (const f of ROWS.filter((r) => r !== 'adobe:service-account-jwt-private-key')) {
    assert.ok(cases.some((c) => c.family === f && c.kind === 'positive' && c.axes.includes('era-words')), f);
  }
  assert.ok(cases.filter((c) => c.kind === 'positive' && c.axes.includes('era-words')).every((c) => /legacy|retired|deprecated|archived|old/i.test(c.text)));
});

test('vendor-shaped probes are assembled at run time and only ever observed', () => {
  const src = readFileSync(file('benchmarks/group-e/corpus-e.mjs'), 'utf8');
  assert.ok(!/AKCp[A-Za-z0-9]{12}/.test(src));
  assert.ok(!/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/.test(src));
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(src));
  assert.ok(!/sl\.[A-Za-z0-9_-]{20}/.test(src));
  const probes = cases.filter((c) => c.axes.includes('probe-vendor-shaped'));
  assert.ok(probes.length >= 40);
  assert.ok(probes.every((c) => c.kind === 'unsupported'));
  const shapes = {
    akcp: /AKCp[A-Za-z0-9]{69}\b/, uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, pem: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, sl: /\bsl\.[A-Za-z0-9_-]{100,}/,
    airtableKey: /\bkey[A-Za-z0-9]{14}\b/, digitsDash: /\b\d{8}-[A-Za-z0-9_-]{27}\b/,
  };
  for (const c of cases.filter((x) => x.kind !== 'unsupported')) {
    for (const [name, re] of Object.entries(shapes)) {
      // the evidence's own fixtures are not probes; only generated cases are held to this
      if (c.derivation === 'fixture-mirror') continue;
      assert.ok(!re.test(c.text), `${c.id}: vendor-shaped ${name} outside an observed probe`);
    }
  }
  for (const name of ['akcp', 'uuid', 'pem', 'sl', 'airtableKey', 'digitsDash']) assert.ok(cases.some((c) => c.kind === 'unsupported' && shapes[name].test(c.text)), name);
});

test('synthetic only: no case text carries a real-looking credential literal', () => {
  const real = [/\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{36}\b/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/, /\bsk_live_[A-Za-z0-9]{10,}/, /\bAIza[0-9A-Za-z_-]{35}\b/, /\bpat[A-Za-z0-9]{14}\.[0-9a-f]{64}\b/];
  for (const c of cases) for (const re of real) assert.ok(!re.test(c.text), `${c.id}: ${re}`);
  for (const f of ['benchmarks/group-e/corpus-e.mjs', 'benchmarks/group-e/evidence-group-e.json']) {
    const text = readFileSync(file(f), 'utf8');
    for (const re of real) assert.ok(!re.test(text), `${f}: ${re}`);
  }
});

test('controls avoid values the Cases decline to assert (client id, account_id, uid)', () => {
  for (const c of cases.filter((x) => x.family === 'reddit:app-client-secret' && x.kind === 'control' && x.derivation === 'class-extension')) {
    assert.ok(!/[A-Za-z0-9_-]{22}:/.test(c.text.replace(/CLIENT_ID:/g, '')), `${c.id}: a literal client id in a control`);
  }
  for (const c of cases.filter((x) => x.family === 'dropbox:legacy-long-lived-access-token' && x.kind === 'control' && x.derivation === 'class-extension')) {
    assert.ok(!/account_id|"uid"/.test(c.text), c.id);
  }
});

test('the scorer is Batch 2\'s, unchanged', () => {
  assert.equal(groupScore.scoreCase, batch2Score.scoreCase);
  assert.equal(groupScore.summarize, batch2Score.summarize);
  assert.equal(groupScore.parity, batch2Score.parity);
  const frozen = proposedFreeze();
  for (const [p, h] of Object.entries(frozen.scorer.sha256)) assert.equal(sha(readFileSync(file(p))), h, p);
});

test('scoring smoke without a detector: an oracle observation is all exact, an empty one is all misses', () => {
  const oracle = Object.fromEntries(cases.map((c) => [c.id, { findings: c.kind === 'positive' ? [c.expected, ...c.expectedExtra].map((s) => ({ ...s, type: 'x', detector: 'oracle', action: 'redact' })) : [] }]));
  const empty = Object.fromEntries(cases.map((c) => [c.id, { findings: [] }]));
  const a = groupScore.summarize(cases, oracle);
  const b = groupScore.summarize(cases, empty);
  const positives = cases.filter((c) => c.kind === 'positive').length;
  assert.equal(a.positives, positives);
  assert.equal(a.exact, positives);
  assert.equal(a.fullyCovered, positives);
  assert.equal(a.misses, 0);
  assert.equal(a.controlFlagged, 0);
  assert.equal(a.unsupported, cases.filter((c) => c.kind === 'unsupported').length);
  // type and action are not Case-derived, so the contract-outcome counters are structurally zero (INEXPRESSIBLE finding-type-and-action)
  assert.equal(a.pass, 0);
  assert.equal(a.typeOk, 0);
  assert.equal(b.misses, positives);
  assert.equal(b.controlFlagged, 0);
  assert.ok(INEXPRESSIBLE.some((i) => i.id === 'finding-type-and-action'));
  // a finding on a control is reported; a finding that is wider than the value is `over`
  const control = cases.find((c) => c.kind === 'control');
  assert.equal(groupScore.scoreCase(control, { findings: [{ start: 0, end: 3, type: 'x', action: 'redact' }] }).flagged, true);
  const pos = cases.find((c) => c.kind === 'positive');
  const wide = groupScore.scoreCase(pos, { findings: [{ start: pos.expected.start - 2, end: pos.expected.end, type: 'x', action: 'redact' }] });
  assert.equal(wide.span, 'over');
});

test('the corpus is deterministic and its digest is the proposed freeze, which is not frozen', async () => {
  const again = await import('../benchmarks/group-e/corpus-e.mjs?again');
  assert.equal(again.corpusDigest(), corpusDigest());
  const proposed = JSON.parse(readFileSync(file('benchmarks/group-e/FROZEN-group-e.json.proposed'), 'utf8'));
  assert.equal(proposed.status, 'proposed');
  assert.equal(proposed.frozen, false);
  assert.equal(proposed.sha256, corpusDigest());
  assert.equal(proposed.cases, cases.length);
  for (const f of ROWS) assert.equal(proposed.rows[f].total, counts()[f].total);
  assert.equal(proposed.expectationSources.evidenceInputSha256, sha(readFileSync(file('benchmarks/group-e/evidence-group-e.json'))));
  assert.equal(existsSync(file('benchmarks/group-e/FROZEN-group-e.json')), false, 'freezing is the owner\'s step');
});

test('the traceability table names a Case, a fixture or the absence of one, and claims for every case', () => {
  const t = traceability();
  assert.equal(t.length, cases.length);
  for (const r of t) {
    assert.ok(byId.has(r.id));
    assert.ok(EVIDENCE.cases[r.case], r.id);
    assert.ok(r.claims.length > 0, r.id);
    assert.ok(r.clause.length > 20, r.id);
    if (r.fixture) assert.ok(EVIDENCE.fixtures.some((f) => f.id === r.fixture), `${r.id}: ${r.fixture}`);
    else assert.equal(r.case, 'adobe-jwt-private-key-file-contents-unsettled', r.id);
  }
  const committed = JSON.parse(readFileSync(file('benchmarks/group-e/traceability-group-e.json'), 'utf8'));
  assert.deepEqual(committed, t);
  const md = readFileSync(file('benchmarks/group-e/TRACEABILITY.md'), 'utf8');
  for (const f of ROWS) assert.ok(md.includes(`## \`${f}\``), f);
  for (const i of INEXPRESSIBLE) assert.ok(md.includes(i.id), i.id);
});

test('reviewer rulings: a scored expectation needs Case support, otherwise the case is observed only and kept', () => {
  const id = (family, layout, kind) => cases.find((c) => c.family === family && c.layout === layout && c.kind === kind);
  // E-B1: every scored Reddit bearer positive carries the oauth.reddit.com host
  for (const c of cases.filter((x) => x.family === 'reddit:oauth-access-token' && x.layout.startsWith('header-') && x.kind === 'positive')) assert.ok(c.text.includes('oauth.reddit.com'), c.id);
  // E-B2: no scored or control Zendesk text carries the literal email in a generated control; the four fixture mirrors are conflicts
  const zdLookalikes = cases.filter((c) => c.family === 'zendesk:api-token' && c.layout.startsWith('lookalike-'));
  assert.ok(zdLookalikes.length >= 13);
  for (const c of zdLookalikes) assert.ok(!c.text.includes('agent@example.test'), c.id);
  const zdConflicts = cases.filter((c) => c.kind === 'conflict');
  assert.equal(zdConflicts.length, 4);
  assert.ok(zdConflicts.every((c) => c.family === 'zendesk:api-token' && c.derivation === 'fixture-mirror'));
  for (const l of ['claims-json-compact', 'claims-json-metascopes', 'claims-same-shape-identifiers', 'claims-yaml']) assert.ok(id('adobe:service-account-jwt-private-key', l, 'unsupported'), l);
  // E-B3, A8, A9
  assert.ok(id('zendesk:api-token', 'basic-proxy-header', 'unsupported'));
  assert.ok(id('jfrog:api-key', 'header-mixed-case-name', 'unsupported') && id('jfrog:api-key', 'header-mixed-case-name-curl', 'unsupported'));
  assert.match(id('jfrog:api-key', 'basic-curl-u-eof', 'positive').text, /jfrog\.example\.test/);
  // A2, A6, A7: the container variants, identifier-literal controls and null controls are observed only
  assert.ok(id('dropbox:legacy-long-lived-access-token', 'member-json-wrapped-object', 'unsupported'));
  assert.ok(id('hubspot:legacy-api-key', 'query-yaml-url-unquoted', 'unsupported'));
  assert.ok(id('hubspot:legacy-api-key', 'developer-key-empty', 'unsupported'));
  assert.ok(id('reddit:oauth-refresh-token', 'form-null-undefined', 'unsupported'));
  assert.ok(!cases.some((c) => c.kind === 'control' && /^(member-null|form-null-undefined)$/.test(c.layout)));
  // nothing was deleted: the case count is unchanged by the rulings
  assert.equal(cases.length, 767);
  for (const f of ['reddit:oauth-access-token', 'reddit:oauth-refresh-token']) {
    const c = id(f, 'member-json-wrapped-object', 'unsupported');
    assert.ok(c && c.ruling === 'A2-consistency' && c.downgradedFrom === 'positive', f);
    assert.ok(id(f, 'member-json-wrapped-array', 'unsupported'));
  }
  assert.ok(cases.filter((c) => c.downgraded).every((c) => c.ruling === c.downgraded.ref && c.downgradedFrom === c.downgraded.from));
  // A13: variant tags
  assert.ok(cases.some((c) => c.variant === 'bullet-mask') && cases.some((c) => c.variant === 'secrets-template'));
  assert.ok(cases.filter((c) => c.variant).every((c) => c.kind === 'control' && c.derivation === 'class-extension'));
});

test('unique inputs per row and kind are in the proposal and the traceability', () => {
  const p = proposedFreeze();
  const t = traceability();
  const k = counts();
  for (const f of ROWS) {
    for (const kind of ['positive', 'control', 'unsupported', 'conflict']) {
      const texts = new Set(cases.filter((c) => c.family === f && c.kind === kind).map((c) => c.text));
      assert.equal(p.uniqueInputs[f][kind], texts.size, `${f} ${kind}`);
      assert.equal(t.filter((r) => r.family === f && r.kind === kind && r.uniqueInput).length, texts.size, `${f} ${kind}`);
    }
    assert.ok(k[f].uniqueInputs.total <= k[f].total);
  }
  assert.equal(t.filter((r) => !r.uniqueInput).every((r) => r.duplicateOf), true);
  assert.match(p.policyClassTolerance, /tolerance/);
  assert.ok(p.inexpressible.includes('policy-class-tolerance'));
});
