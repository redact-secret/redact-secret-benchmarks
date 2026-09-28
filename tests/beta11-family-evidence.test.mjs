import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { RATIONALE, REVISIONS } from '../fixtures/generated/beta8/379.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { PROFILE_FLOORS } from '../benchmarks/lib/beta8/profiles.ts';
import { auditTwin, secretValues, skeleton } from '../benchmarks/lib/fixture-independence.ts';

// #379: independent family evidence for the fifteen families #377's frozen ledger selected.
const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const ledger = await read('docs/reports/2026-09-28/beta-11-family-axis-ledger.json');
const generated = buildCorpora();
const corpus = generated['beta8-379'].fixtures;
const targetOf = f => (f.detectors ?? f.arrivalTargets ?? [])[0];
const isPositive = f => f.expected.some(r => (r.role ?? 'secret') === 'secret');
const positives = corpus.filter(isPositive), twins = corpus.filter(f => f.twinOf), benign = corpus.filter(f => !isPositive(f) && !f.twinOf);
const selected = ledger.selection.map(s => s.family);

test('the corpus covers exactly the ledger selection with 81 positives, 83 benign controls and 41 twins', () => {
  assert.deepEqual([...new Set(corpus.map(targetOf))].sort(), [...selected].sort());
  assert.equal(positives.length, ledger.budgetTotals.positives);
  // Ledger planned 96 benign and 53 twins; every dropped item is a recorded revision.
  assert.equal(benign.length, 83);
  assert.equal(twins.length, 41);
  for (const family of selected) {
    const plan = ledger.selection.find(s => s.family === family);
    assert.equal(positives.filter(f => targetOf(f) === family).length, plan.positives.length, `${family}: every planned positive authored`);
  }
});

test('every case carries a contract rationale, provenance and a scored tier; no case is T0', () => {
  for (const f of corpus) {
    const r = RATIONALE.get(f.id);
    assert.ok(r, `${f.id}: rationale`);
    assert.equal(r.contract, targetOf(f));
    assert.ok(r.rationale.trim() && r.provenance.trim(), f.id);
    assert.notEqual(f.assessment.tier, 'T0', `${f.id}: ${f.assessment.reason}`);
    assert.equal(f.assessment.contract, targetOf(f), f.id);
  }
  for (const f of twins) assert.match(RATIONALE.get(f.id).basis, /^(provider|tool-undisputed|context)$/, f.id);
});

test('positives author the redact action, satisfy their frozen contract and use values and skeletons new to their family', () => {
  const others = Object.entries(generated).filter(([category]) => category !== 'beta8-379').flatMap(([, c]) => c.fixtures);
  for (const f of positives) {
    assert.equal(f.expectedAction, 'redact', f.id);
    const family = targetOf(f);
    const pattern = contracts[family].pattern ? new RegExp(contracts[family].pattern) : null;
    for (const value of secretValues(f)) if (pattern) assert.match(value, pattern, f.id);
    const prior = others.filter(o => targetOf(o) === family && isPositive(o));
    const priorValues = new Set(prior.flatMap(secretValues)), priorSkeletons = new Set(prior.map(skeleton));
    for (const value of secretValues(f)) assert.ok(!priorValues.has(value), `${f.id}: value reused from an existing fixture`);
    assert.ok(!priorSkeletons.has(skeleton(f)), `${f.id}: skeleton reused from an existing fixture`);
  }
  assert.equal(new Set(positives.flatMap(secretValues)).size, positives.length, 'one distinct value per positive');
  assert.equal(new Set(positives.map(skeleton)).size, positives.length, 'one distinct skeleton per positive');
});

test('each twin changes one property of its positive', () => {
  const byId = new Map(corpus.map(f => [f.id, f]));
  // Recorded, single-property exceptions to the audit's hunk heuristics: a separator written twice
  // (sk_live_ -> sk-live-), and the RFC 3986 delimiters that sit next to the password by definition.
  const expected = new Map([
    ['stripe-token-hyphen-separators-twin', ['multiple-value-edits']],
    ['connection-string-at-to-slash-twin', ['context-twin-edits-value']],
    ['connection-string-colon-removed-twin', ['context-twin-edits-value']],
  ]);
  for (const t of twins) {
    const audit = auditTwin(t, byId.get(t.twinOf));
    assert.deepEqual(audit.flags, expected.get(t.id) ?? [], `${t.id}: ${JSON.stringify(audit)}`);
    if (t.mutationKind === 'context') assert.deepEqual(secretValues(byId.get(t.twinOf)).map(v => t.content.includes(v)), [true], `${t.id}: context twin keeps the value`);
  }
});

test('benign controls carry no secret span and no authored action; revisions are recorded with reasons', () => {
  for (const f of benign) {
    assert.deepEqual(f.expected, [], f.id);
    assert.equal(f.expectedAction, undefined, f.id);
  }
  assert.ok(REVISIONS.length >= 20);
  for (const r of REVISIONS) {
    assert.ok(selected.includes(r.family), r.family);
    assert.ok(['dropped', 'moved', 'revised', 'noted'].includes(r.action), r.action);
    assert.ok(r.reason.trim().length > 40, `${r.family}: ${r.item}`);
  }
});

test('profile floors stay at 24/40/48', () => {
  assert.equal(PROFILE_FLOORS['documented-24'].total, 24);
  assert.equal(PROFILE_FLOORS['empirical-40'].total, 40);
  assert.equal(PROFILE_FLOORS['context-48'].total, 48);
});
