import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cases, corpusDigest, FAMILIES, FAMILY_IDS, synth, EXPECTED_ACTION } from '../benchmarks/corpora/provider-shapes/corpus.mjs';
import { parity, scoreCase, spanOutcome, summarize } from '../benchmarks/corpora/provider-shapes/score.mjs';

// Corpus and scoring invariants of the focused Batch 1 qualification (#717). No ledger value, scanner output or
// support status is asserted here: a recorded run is only checked for the identity of the corpus it measured.

const slice = (text, span) => Buffer.from(text, 'utf8').subarray(span.start, span.end).toString('utf8');

test('the corpus covers the five bounded families with positives, controls and recorded unsupported variants', () => {
  assert.deepEqual(FAMILY_IDS.sort(), ['airtable:webhook-mac-secret', 'asana:webhook-secret', 'canva:client-secret', 'elastic:elasticsearch-api-key', 'figma:personal-access-token']);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  for (const family of FAMILY_IDS) {
    const mine = cases.filter(c => c.family === family);
    assert.ok(mine.filter(c => c.kind === 'positive').length >= 5, `${family} positives`);
    assert.ok(mine.filter(c => c.kind === 'control').length >= 8, `${family} controls`);
    assert.ok(mine.some(c => c.layout.endsWith('unicode-prefix')), `${family} carries a non-ASCII offset case`);
    assert.ok(FAMILIES[family].providerFact && FAMILIES[family].projectPolicy, `${family} keeps provider fact and policy apart`);
  }
});

test('a positive span is a UTF-8 byte range of exactly the authored value; a control has none', () => {
  for (const kase of cases) {
    if (kase.kind === 'positive') {
      assert.ok(kase.expected.end > kase.expected.start, kase.id);
      assert.equal(kase.action, EXPECTED_ACTION);
      const value = slice(kase.text, kase.expected);
      assert.ok(value.length >= 20 && !/\s/.test(value), `${kase.id}: the value is one run`);
    } else if (kase.kind === 'control') {
      assert.equal(kase.expected, null, kase.id);
      assert.equal(kase.action, null, kase.id);
    }
  }
  const uni = cases.find(c => c.id === 'figma-raw-http-unicode-prefix-positive');
  assert.notEqual(Buffer.byteLength(uni.text), uni.text.length, 'the non-ASCII case separates byte and code unit offsets');
});

test('values are deterministic, synthetic and never a scanner or provider artifact', () => {
  assert.equal(synth('a', 40), synth('a', 40));
  assert.notEqual(synth('a', 40), synth('b', 40));
  assert.equal(corpusDigest(), corpusDigest());
  for (const kase of cases) assert.ok(!/AKIA|ghp_|sk_live|xox[bp]-/.test(kase.text), kase.id);
});

test('bounded boundaries: Canva Basic and Elastic ApiKey spans are the undecoded encoded value', () => {
  for (const id of ['canva-basic-raw-http-positive', 'canva-basic-curl-positive', 'elastic-raw-http-positive']) {
    const kase = cases.find(c => c.id === id);
    const value = slice(kase.text, kase.expected);
    assert.match(value, /^[A-Za-z0-9+/]+=*$/);
    assert.doesNotMatch(value, /:/);
  }
  const airtable = cases.find(c => c.id === 'airtable-json-positive');
  assert.match(slice(airtable.text, airtable.expected), /=$/, 'the span includes the Base64 padding');
});

test('span outcomes distinguish exact, over, under, partial and miss', () => {
  const expected = { start: 10, end: 30 };
  assert.equal(spanOutcome(expected, { start: 10, end: 30 }), 'exact');
  assert.equal(spanOutcome(expected, { start: 8, end: 31 }), 'over');
  assert.equal(spanOutcome(expected, { start: 12, end: 28 }), 'under');
  assert.equal(spanOutcome(expected, { start: 5, end: 20 }), 'partial');
  assert.equal(spanOutcome(expected, null), 'miss');
});

test('scoring: a positive passes on exact span and redact; a control passes on no finding', () => {
  const positive = cases.find(c => c.kind === 'positive');
  const exact = { start: positive.expected.start, end: positive.expected.end, type: 'contextual_secret', detector: 'x', action: 'redact' };
  assert.equal(scoreCase(positive, { findings: [exact] }).pass, true);
  assert.equal(scoreCase(positive, { findings: [{ ...exact, action: 'warn' }] }).pass, false);
  assert.equal(scoreCase(positive, { findings: [{ ...exact, end: exact.end + 3 }] }).collateralBytes, 3);
  assert.equal(scoreCase(positive, { findings: [{ ...exact, end: exact.end - 2 }] }).leakedBytes, 2);
  assert.equal(scoreCase(positive, { findings: [] }).span, 'miss');
  const control = cases.find(c => c.kind === 'control');
  assert.equal(scoreCase(control, { findings: [] }).pass, true);
  assert.equal(scoreCase(control, { findings: [exact] }).flagged, true);
  const unsupported = cases.find(c => c.kind === 'unsupported');
  assert.equal(scoreCase(unsupported, { findings: [exact] }).pass, null, 'an unsupported variant is observed, never scored');
});

test('whole and stream parity compares spans, types and actions regardless of order', () => {
  const a = { start: 1, end: 5, type: 't', action: 'redact' };
  const b = { start: 9, end: 12, type: 't', action: 'redact' };
  assert.equal(parity({ findings: [a, b] }, { findings: [b, a] }), true);
  assert.equal(parity({ findings: [a] }, { findings: [{ ...a, end: 6 }] }), false);
});

test('summarize counts every kind', () => {
  const observations = Object.fromEntries(cases.map(c => [c.id, { findings: [] }]));
  const out = summarize(cases, observations);
  assert.equal(out.positives + out.controls + out.unsupported, cases.length);
  assert.equal(out.misses, out.positives);
  assert.equal(out.controlFlagged, 0);
});

test('a recorded run, when present, was measured on this corpus', () => {
  for (const label of ['published', 'candidate']) {
    const file = new URL(`../evidence/717/observations-${label}.json`, import.meta.url);
    if (!existsSync(file)) continue;
    const run = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(run.schema, 'batch1-observations-v1');
    assert.equal(run.corpus.sha256, corpusDigest(), `${label} observations are stale: re-run scripts/measure-focused-corpus.mjs`);
    assert.ok(run.surfaces.node && run.surfaces.wasm && run.surfaces.python && run.surfaces.cli, `${label} covers every surface`);
    for (const kase of cases) for (const surface of Object.values(run.surfaces)) assert.ok(surface.cases[kase.id], `${label} lacks ${kase.id}`);
    assert.ok(!JSON.stringify(run).includes(cases[0].text.trim()), 'observations carry spans, not matched text');
  }
});
