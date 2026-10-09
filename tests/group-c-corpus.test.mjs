import { frozenSourceDigest } from './corpus-source-receipts.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AXES, cases, CASE_CLAIMS, corpusDigest, EVIDENCE, FAMILY_IDS, PART, ROWS, SNAPSHOT } from '../benchmarks/corpora/provider-contracts/corpus-group-c.mjs';
import * as groupC from '../benchmarks/corpora/provider-contracts/score-group-c.mjs';
import * as batch2 from '../benchmarks/harness/credential-carriers/score-multispan.mjs';
import { ROW_IDS } from '../benchmarks/corpora/provider-contracts/rows.mjs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const caseOf = new Map(EVIDENCE.cases.map(c => [c.id, c]));
// Only the Group C rows are in scope: a Case may also name other rows (companions) that this corpus does not cover.
const inScope = c => c.families.some(f => ROW_IDS.includes(f.family));

test('the evidence snapshot pin and the 11 rows', () => {
  assert.equal(EVIDENCE.snapshot.tag, 'snapshot-2026.10.06.5');
  assert.deepEqual(SNAPSHOT, EVIDENCE.snapshot);
  assert.equal(ROW_IDS.length, 11);
  assert.deepEqual([...FAMILY_IDS].sort(), [...ROW_IDS].sort());
  assert.deepEqual([...new Set(cases.map(c => c.family))].sort(), [...ROW_IDS].sort());
});

const sha = f => createHash('sha256').update(readFileSync(new URL('../' + f, import.meta.url))).digest('hex');
const ERRATA_ORIGINAL = 'f216ca0a72c52d2b268924662d7f4ab66372c9820d0cfe386e3eefa0110dc37d';

test('the original freeze record is untouched; errata 1 proposes the new digest', () => {
  const frozen = JSON.parse(read('benchmarks/corpora/provider-contracts/FROZEN-group-c.json'));
  assert.equal(frozen.frozen, true);
  assert.equal(frozen.frozenBeforeAnyScan, true);
  assert.equal(frozen.evidenceSnapshot.tag, 'snapshot-2026.10.06.5');
  assert.equal(frozen.evidenceSnapshot.commit, '574b52ba367e2071d5a9bea3e2da7a9c5057f633');
  assert.equal(frozen.sha256, ERRATA_ORIGINAL);
  // everything the original freeze hashed except the generator (changed by errata 1, hashed in the errata manifest) still matches
  for (const [group, files] of Object.entries(frozen.frozenFileHashes)) {
    if (group === 'corpusGenerator') continue;
    for (const [f, h] of Object.entries(files)) assert.equal(frozenSourceDigest(f), h, f);
  }
  const errata = 'benchmarks/corpora/provider-contracts/contract-receipts/errata-1.json';
  const e = JSON.parse(read(errata));
  assert.equal(e.errata.id, 'errata-1');
  assert.equal(e.errata.previousSha256, ERRATA_ORIGINAL);
  assert.notEqual(e.sha256, ERRATA_ORIGINAL);
  assert.equal(e.errata.ids.length, 9);
  assert.equal(e.inputs.generator.sha256, frozenSourceDigest('benchmarks/corpora/provider-contracts/corpus-group-c.mjs'));
  assert.equal(e.inputs.evidenceFixtures.sha256, sha('benchmarks/corpora/provider-contracts/evidence-fixtures.json'));
  assert.equal(corpusDigest(), e.sha256);
  assert.equal(cases.length, e.cases);
  assert.equal(e.positives + e.controls + e.unsupported + e.conflict, e.cases);
  const index = JSON.parse(read('benchmarks/corpora/provider-contracts/corpus-index.json'));
  assert.equal(index.corpusSha256, corpusDigest());
  assert.equal(index.cases.length, cases.length);
  assert.ok(read('benchmarks/corpora/provider-contracts/TRACEABILITY.md').includes(corpusDigest()));
});

test('errata 1: exactly the nine code= controls are downgraded', () => {
  const e = cases.filter(c => c.ruling === 'errata-1');
  assert.equal(e.length, 9);
  for (const c of e) { assert.equal(c.kind, 'unsupported'); assert.equal(c.downgradedFrom, 'control'); assert.ok(/code=/.test(c.text), c.id); assert.deepEqual(c.observedSpans, []); assert.deepEqual(c.probeSpans, []); assert.ok(c.rulingReason); }
  assert.equal(e.filter(c => c.id.includes('fixture-replay-public-client-request-client-id-only')).length, 3);
  assert.equal(cases.filter(c => c.kind === 'control' && c.family.startsWith('adobe:') && /\bcode=/.test(c.text)).length, 0);
});

test('ids are unique, axes defined, spans are in UTF-8 byte bounds and cover a non-empty value', () => {
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  for (const c of cases) {
    assert.equal(c.part, PART);
    for (const a of c.axes) assert.ok(AXES[a], `${c.id}: axis ${a}`);
    const bytes = Buffer.from(c.text, 'utf8');
    if (c.kind !== 'positive') { assert.equal(c.expected, null, c.id); assert.deepEqual(c.expectedExtra, [], c.id); continue; }
    assert.ok(c.expectedType && c.expectedAction === 'redact' && c.typeBasis, c.id);
    for (const s of [c.expected, ...c.expectedExtra]) {
      assert.ok(s.end > s.start && s.end <= bytes.length, c.id);
      const value = bytes.subarray(s.start, s.end).toString('utf8');
      assert.ok(!/^\s|\s$/.test(value), `${c.id}: value has edge whitespace`);
    }
    // repeats carry every occurrence, and every occurrence is the same bytes
    const all = [c.expected, ...c.expectedExtra].map(s => bytes.subarray(s.start, s.end).toString('utf8'));
    assert.equal(new Set(all).size, 1, c.id);
  }
});

test('the kind of every case follows the outcome of the evidence Case it names', () => {
  const want = { 'must-flag': 'positive', 'must-not-flag': 'control', 'not-assertable': 'unsupported' };
  for (const c of cases) {
    const e = caseOf.get(c.evidenceCase);
    assert.ok(e, `${c.id}: unknown evidence Case ${c.evidenceCase}`);
    if (c.downgradedFrom) { assert.equal(c.kind, 'unsupported', c.id); assert.equal(c.downgradedFrom, want[e.outcome], `${c.id}: downgraded from the Case's kind`); assert.ok(c.ruling && c.rulingReason, c.id); continue; }
    assert.equal(c.kind, want[e.outcome], `${c.id}: ${e.outcome} must become ${want[e.outcome]}`);
    assert.ok(e.families.some(f => f.family === c.family), `${c.id}: Case does not name the row`);
    for (const id of c.evidenceFixtures) assert.ok(e.fixtures.some(f => f.id === id), c.id);
    assert.deepEqual(c.claims, CASE_CLAIMS[c.evidenceCase] ?? [], c.id);
  }
});

test('every stored fixture is replayed byte for byte with its own spans', () => {
  for (const e of EVIDENCE.cases) {
    for (const fx of e.fixtures) {
      for (const f of e.families.filter(x => ROW_IDS.includes(x.family))) {
        const id = `${f.family}:gc:fixture-replay-${fx.id.replace(/^[a-z0-9-]+?--/, '')}`;
        const kind = e.outcome === 'must-flag' ? 'positive' : e.outcome === 'must-not-flag' ? 'control' : 'unsupported';
        const mine = cases.find(c => c.id === `${id}:${kind}`) ?? cases.find(c => c.id === `${id}:unsupported` && c.downgradedFrom === kind);
        if (e.outcome === 'must-flag' && f.role !== 'subject') { assert.equal(mine, undefined, id); continue; }
        assert.ok(mine, `${id} (${kind}) missing`);
        assert.equal(mine.text, fx.text);
        assert.equal(createHash('sha256').update(fx.text).digest('hex'), fx.sha256, `${fx.id}: rebuilt text must match the snapshot sha256`);
        assert.deepEqual(mine.evidenceFixtures, [fx.id]);
        if (kind === 'positive' && !mine.downgradedFrom) {
          assert.deepEqual([mine.expected, ...mine.expectedExtra], fx.spans.map(s => ({ start: s.start, end: s.end })));
          assert.ok(fx.spans.every(s => s.role === 'secret'));
        }
      }
    }
  }
});

test('the committed fixture extract holds no vendor-shaped literal (tokenised, rebuilt at run time)', () => {
  const raw = read('benchmarks/corpora/provider-contracts/evidence-fixtures.json').replace(/"sha256": "[0-9a-f]{64}"/g, '"sha256": ""');
  assert.ok(!/[0-9a-f]{32,}/.test(raw), 'a long hex run is committed');
  assert.ok(!/\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/.test(raw), 'a UUID is committed');
  assert.ok(!/\bsl\.[A-Za-z]|\bcmVmd|\b5Aep861|(?<![-a-z])pat-(na1|eu1)-[A-Za-z0-9]|CFPAT-[A-Za-z0-9]/.test(raw), 'a vendor prefix literal is committed');
});

test('every Case is covered, every cited claim exists in a contract of the Case\'s rows', () => {
  for (const e of EVIDENCE.cases) {
    assert.ok(cases.some(c => c.evidenceCase === e.id), `no corpus case for ${e.id}`);
    assert.ok(e.id in CASE_CLAIMS, `no claim list for ${e.id}`);
    const known = new Set(e.families.flatMap(f => EVIDENCE.contractClaims[f.family] ?? []));
    for (const claim of CASE_CLAIMS[e.id]) assert.ok(known.has(claim), `${e.id}: claim ${claim} not in the contracts of ${e.families.map(f => f.family)}`);
  }
  assert.ok(EVIDENCE.cases.every(inScope));
});

test('every row has controls; rows without a must-flag Case have no positive and say so', () => {
  for (const f of ROW_IDS) {
    const mine = cases.filter(c => c.family === f);
    assert.ok(mine.some(c => c.kind === 'control'), `${f}: no control`);
    assert.ok(mine.some(c => c.kind === 'unsupported'), `${f}: no unsupported`);
    const hasMustFlag = EVIDENCE.cases.some(e => e.outcome === 'must-flag' && e.families.some(x => x.family === f && x.role === 'subject'));
    assert.equal(mine.some(c => c.kind === 'positive'), hasMustFlag, f);
    assert.equal(ROWS[f].slots.length > 0, hasMustFlag, f);
  }
  assert.equal(cases.filter(c => c.family === 'x:oauth1-consumer-secret' && c.kind === 'positive').length, 0);
});

test('vendor-shape probes are unscored and assembled at run time; the generator holds no vendor-prefix literal', () => {
  const probes = cases.filter(c => c.axes.includes('vendor-probe'));
  assert.ok(probes.length >= 30);
  for (const c of probes) assert.equal(c.kind, 'unsupported', c.id);
  const src = read('benchmarks/corpora/provider-contracts/corpus-group-c.mjs');
  // a prefix followed by a body (at least 8 characters with a digit) would be a vendor-shaped literal; the Case ids and notes that name a prefix are fine
  assert.ok(!/(p8e-|cmVmd|5Aep861|sl\.(u\.)?|pat-(na1|eu1)-|CFPAT-)(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{8,}/.test(src), 'vendor-shaped literal in the generator');
  for (const lit of ['ghp_', 'AKIA', 'xoxb-', 'sk_live_']) assert.ok(!src.includes(lit), `literal ${lit} in the generator`);
  // an assembled probe really carries the shape
  const sample = (family, re) => assert.ok(cases.some(c => c.family === family && c.axes.includes('vendor-probe') && re.test(c.text)), `${family}: probe ${re}`);
  sample('adobe:oauth-server-to-server-client-secret', /p8e-[A-Za-z0-9]{32}\n/);
  sample('contentful:cma-personal-access-token', /CFPAT-[A-Za-z0-9_-]{43}\n/);
  sample('dropbox:access-token', /sl\.u\.[A-Za-z0-9_-]{147}\n/);
  sample('hubspot:private-app-access-token', /pat-na1-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\n/);
  sample('jfrog:reference-token', /cmVmd[A-Za-z0-9]{59}\n/);
  sample('salesforce:oauth-refresh-token', /5Aep861/);
  sample('airtable:personal-access-token', /pat[A-Za-z0-9]{14}\.[0-9a-f]{64}/);
});

test('the scorer is Batch 2\'s, unchanged', () => {
  for (const name of ['scoreCase', 'summarize', 'parity']) assert.equal(groupC[name], batch2[name], name);
});

test('a perfect observation passes every positive and clears every control (scoring only, no detector)', () => {
  const observations = {};
  for (const c of cases) {
    observations[c.id] = { findings: c.kind === 'positive' ? [c.expected, ...c.expectedExtra].map(s => ({ ...s, type: c.expectedType, detector: 'oracle', action: c.expectedAction })) : [] };
  }
  const s = groupC.summarize(cases, observations);
  const kinds = k => cases.filter(c => c.kind === k).length;
  assert.equal(s.positives, kinds('positive'));
  assert.equal(s.pass, s.positives);
  assert.equal(s.controls, kinds('control'));
  assert.equal(s.controlFlagged, 0);
  assert.equal(s.unsupported, kinds('unsupported'));
  // an over-wide span and a flagged control are caught
  const p = cases.find(c => c.kind === 'positive');
  assert.equal(groupC.scoreCase(p, { findings: [{ start: p.expected.start - 1, end: p.expected.end, type: p.expectedType, action: 'redact' }] }).pass, false);
  const k = cases.find(c => c.kind === 'control');
  assert.equal(groupC.scoreCase(k, { findings: [{ start: 0, end: 1, type: 'x', action: 'redact' }] }).pass, false);
});

test('reviewer rulings: downgrades keep the entry, no scored span, and the control corrections hold', () => {
  const down = cases.filter(c => c.downgradedFrom);
  assert.equal(down.length, 55);
  for (const c of down.filter(x => x.downgradedFrom === 'positive')) { assert.ok(c.observedSpans.length >= 1, c.id); assert.deepEqual(c.probeSpans, c.observedSpans, c.id); for (const sp of c.observedSpans) assert.ok(sp.end > sp.start && sp.end <= Buffer.byteLength(c.text), c.id); }
  for (const c of cases.filter(x => x.kind === 'unsupported' && !x.downgradedFrom)) assert.deepEqual(c.observedSpans, [], c.id);
  assert.ok(cases.some(c => c.id === 'adobe:oauth-web-app-client-secret:gc:basic-header-map:unsupported' && c.ruling === 'A1'));
  for (const c of down) { assert.equal(c.expected, null); assert.deepEqual(c.expectedExtra, []); assert.equal(c.expectedType, null); }
  // the enterprise and Meta query layouts are no longer scored; the Case-named layouts still are
  assert.ok(cases.some(c => c.id === 'adobe:enterprise-web-app-client-secret:gc:client_secret-form-curl-data-urlencode:positive'));
  assert.ok(cases.some(c => c.id === 'adobe:enterprise-web-app-client-secret:gc:client_secret-form-query-request-line:unsupported'));
  // C-B4: no org_id in any enterprise control; C-B3: no numeric app ID in Meta controls
  for (const c of cases.filter(x => x.family === 'adobe:enterprise-web-app-client-secret' && x.kind === 'control')) assert.ok(!/org_id/.test(c.text), c.id);
  for (const c of cases.filter(x => x.family === 'meta:app-secret' && x.kind === 'control')) assert.ok(!/\b\d{15,17}\b/.test(c.text), c.id);
  // A10 / A13 / A4 / A12 are in the manifest
  const f = JSON.parse(read('benchmarks/corpora/provider-contracts/contract-receipts/errata-1.json'));
  assert.deepEqual(f.headlineMetrics, ['exact', 'fullyCovered']);
  assert.ok(f.uniqueInputs.total > 0 && f.policyClassTolerance.includes('cannot be expressed'));
  // C-F2: class extension is by construction: generated benign-value controls only, never a verbatim fixture replay
  const ext = cases.filter(c => c.classExtension);
  assert.ok(ext.length > 0);
  for (const c of ext) { assert.equal(c.kind, 'control', c.id); assert.ok(!c.axes.includes('fixture-replay'), c.id); assert.ok(!c.downgradedFrom, c.id); }
});
