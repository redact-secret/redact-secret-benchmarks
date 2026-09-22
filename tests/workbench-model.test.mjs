import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reviewClasses, ledgerClassOf, reviewClassId, ledgerSnippet } from '../src/evaluation-model.ts';
import { parseRoute } from '../src/model.mjs';

const ledger = JSON.parse(await readFile(new URL('../benchmarks/review-ledger.json', import.meta.url), 'utf8'));
const entries = Object.entries(ledger.entries);
const classes = reviewClasses(ledger);

test('ledger classes tally the JSON exactly: every entry lands in one class, open, resolved and not-assertable separately', () => {
  assert.equal(classes.reduce((n, c) => n + c.open + c.resolved + c['not-assertable'], 0), entries.length);
  assert.equal(classes.reduce((n, c) => n + c.open, 0), entries.filter(([, e]) => e.status === 'open').length);
  assert.equal(classes.reduce((n, c) => n + c.resolved, 0), entries.filter(([, e]) => e.status === 'resolved').length);
  assert.equal(classes.reduce((n, c) => n + c['not-assertable'], 0), entries.filter(([, e]) => e.status === 'not-assertable').length);
  assert.equal(new Set(classes.flatMap(c => c.entries.map(e => e.id))).size, entries.length, 'no entry is counted twice');
  for (const c of classes) {
    // Recount straight from the file, independent of reviewClasses.
    const direct = entries.filter(([, e]) => reviewClassId(ledgerClassOf(e.note)) === c.id);
    assert.equal(c.open, direct.filter(([, e]) => e.status === 'open').length, c.id);
    assert.equal(c.resolved, direct.filter(([, e]) => e.status === 'resolved').length, c.id);
    assert.equal(c['not-assertable'], direct.filter(([, e]) => e.status === 'not-assertable').length, c.id);
    for (const raw of c.rawClasses) assert.ok(direct.some(([, e]) => ledgerClassOf(e.note) === raw), raw);
  }
  assert.ok(entries.every(([, e]) => ledgerClassOf(e.note) !== 'unclassified'), 'every note names its class');
});

test('the open queue is a handful of groups, not a thousand rows; each has a bookmarkable page', () => {
  const open = classes.filter(c => c.open);
  assert.ok(open.length <= 12, `${open.length} open groups`);
  assert.deepEqual(open.map(c => c.open), [...open.map(c => c.open)].sort((a, b) => b - a), 'largest group first');
  for (const c of classes) assert.deepEqual(parseRoute(`/workbench/review/${c.id}`), { kind: 'workbench', id: c.id, view: 'review', to: '' }, c.id);
  assert.ok(open.some(c => c.id === 't0-fixtures'), '/pending redirects here');
  assert.ok(!open.some(c => c.rawClasses[0].startsWith('operator=')), 'the mechanical operator classes were settled not-assertable (issue #63), so none is open any more');
});

test('the mechanical operator classes settled not-assertable are visible as their own state, not folded into resolved', () => {
  const notAssertable = classes.filter(c => c['not-assertable']);
  assert.ok(notAssertable.length > 0);
  assert.ok(notAssertable.every(c => c.open === 0), 'a settled class carries no open entries');
  const operator = notAssertable.find(c => c.rawClasses[0].startsWith('operator='));
  assert.ok(operator.description.length > 10 && !operator.description.includes('`'), 'operator groups describe their effect in the ledger\'s words');
  // Every entry the ADR (docs/specs/decisions/2026-09-21-settle-mechanical-mutation-review-classes.md) reclassified stayed a `not-assertable` entry, never `resolved`: no per-fixture review happened.
  assert.equal(notAssertable.reduce((n, c) => n + c.resolved, 0), 0);
});

test('the ledger snippet is a paste-ready fragment and keeps the class on the note', () => {
  const [first] = classes[0].entries;
  const parsed = JSON.parse(ledgerSnippet([first], 'run-1', 'Reviewed: expected.'));
  assert.deepEqual(Object.keys(parsed), [first.id]);
  assert.equal(parsed[first.id].status, 'resolved');
  assert.equal(parsed[first.id].firstSeenRun, first.firstSeenRun);
  assert.equal(parsed[first.id].resolvedRun, 'run-1');
  assert.equal(ledgerClassOf(parsed[first.id].note), ledgerClassOf(first.note));
});

import { changeRows, qualificationGates, candidateProblem } from '../src/evaluation-model.ts';
const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url), 'utf8'));
const evidence = JSON.parse(await readFile(new URL('../docs/specs/qualification/engine-v1.json', import.meta.url), 'utf8'));
const pair = (slug, kind, tier, before, after, section = 'fixed-corpus') => ({ slug, kind, tier, section, before, after });

test('changes list only what moved, with the reason; counts are tallies of outcome codes', () => {
  const rows = changeRows([
    ...Array.from({ length: 24 }, (_, i) => pair(`c--twin-${i}`, 'must-not-flag', 'T2', 'flagged:1', 'clean')),
    ...Array.from({ length: 32 }, (_, i) => pair(`c--quiet-${i}`, 'must-not-flag', 'T2', 'clean', 'clean')),
    ...Array.from({ length: 57 }, (_, i) => pair(`c--pos-${i}`, 'must-redact', 'T1', 'EXACT', 'EXACT')),
    pair('c--shape', 'must-redact', 'T1', 'EXACT', 'COVERED'),
    pair('c--policy', 'policy', 'T3', 'EXACT', 'MISS'),
    pair('c--pending', 'must-redact', 'T0', 'observed:1', 'observed:0'),
    pair('c--fresh', 'must-redact', 'T1', null, 'EXACT', 'expanded-corpus'),
  ]);
  const by = status => rows.filter(r => r.status === status);
  assert.deepEqual(by('improved').map(r => [r.label, r.before, r.after, r.of]), [['False alarms on controls', 24, 0, 56]]);
  assert.equal(by('improved')[0].slugs.length, 24);
  assert.deepEqual(by('held').map(r => [r.label, r.before, r.after, r.of]), [['Required secrets left readable', null, 0, 58]], 'unchanged rows fold into one Held line');
  assert.deepEqual(by('check').map(r => [r.label, r.after, r.slugs]), [['EXACT → COVERED', 1, ['c--shape']]], 'same verdict, different ranges: a person should look');
  assert.deepEqual(by('policy').map(r => [r.after, r.of]), [[1, 1]]);
  assert.equal(by('unscored')[0].detail, 'T0: observed, never scored');
  assert.deepEqual(by('new').map(r => r.slugs), [['c--fresh']], 'no baseline means listed, not scored as a change');
  const worse = changeRows([pair('c--a', 'must-redact', 'T1', 'EXACT', 'MISS'), pair('c--b', 'must-not-flag', 'T1', 'clean', 'flagged:2')]);
  assert.deepEqual(worse.map(r => [r.status, r.before, r.after, r.of]), [['regressed', 0, 1, 1], ['regressed', 0, 1, 1]]);
  assert.deepEqual(changeRows([]), []);
});

test('candidate evidence is contract-checked before Changes may read it', () => {
  assert.match(candidateProblem({}), /Invalid candidate evidence contract/);
  assert.match(candidateProblem({ reportType: 'candidate', results: [{ fixtureId: 'x', secret: 'leak' }] }), /Invalid/);
});

test('floors show met or not plus the actual value, and absent evidence is Not measured, never Met', () => {
  const none = qualificationGates(suite.accounting, null, null);
  assert.equal(none.length, 6);
  assert.ok(none.every(g => g.status === 'not-measured'));
  const group = (files, spans, share, positives, pairs, coverage) => ({ files, spans, measurableShare: { point: share, bound: share - 0.05, n: files }, twins: { positives, pairs, coverage: { point: coverage, bound: coverage - 0.05, n: positives } } });
  const gates = qualificationGates(suite.accounting, evidence, { 'must-redact/T1': group(133, 139, 0.801, 133, 71, 0.534), 'must-redact/T2': group(60, 60, 0.74, 60, 40, 0.667), 'must-not-flag/T1': { files: 6 } });
  const get = id => gates.find(g => g.id === id);
  assert.deepEqual(gates.map(g => g.id), ['scanners', 'min-denominator', 'measurable-share', 'twin-coverage', 'resolved-rate', 'ledger']);
  assert.equal(get('min-denominator').value, '3 / 3 ≥ 5');
  assert.deepEqual([get('measurable-share').status, get('measurable-share').value], ['met', '0.740 ≥ 0.7'], 'the group with the least margin is the one shown');
  assert.deepEqual([get('twin-coverage').status, get('twin-coverage').value], ['met', '0.534 ≥ 0.5']);
  // The checked-in evidence says why it is incomplete; the page repeats that, it does not decide it.
  assert.deepEqual(evidence.accounting.reasons, ['unreviewed-queue']);
  assert.equal(get('ledger').status, 'not-met');
  assert.match(get('ledger').detail, new RegExp(`${evidence.accounting.review.unknown} queue entries have no ledger row`));
  assert.equal(get('resolved-rate').status, 'met');
  assert.equal(get('scanners').status, 'met');
  const thin = qualificationGates(suite.accounting, null, { 'must-redact/T1': group(3, 3, 0.4, 3, 1, 0.333) });
  assert.deepEqual(thin.filter(g => g.status === 'not-met').map(g => g.id), ['min-denominator', 'measurable-share', 'twin-coverage']);
  const reviewed = structuredClone(evidence); reviewed.accounting = { reasons: [], unresolvedGroups: [], review: { open: 1233, resolved: 382, notAssertable: 5, unknown: 0, oldestOpenRun: 'x' } };
  assert.deepEqual([qualificationGates(suite.accounting, reviewed, null).at(-1).status, qualificationGates(suite.accounting, reviewed, null).at(-1).value], ['watch', '1,620 · 1,233 open'], 'open is a valid state, and not-assertable counts toward the total like resolved');
});
