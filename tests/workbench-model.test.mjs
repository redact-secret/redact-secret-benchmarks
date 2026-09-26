import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reviewClasses, ledgerClassOf, reviewClassId, ledgerSnippet, reviewLedgerPublicationProblem } from '../src/evaluation-model.ts';
import { observeReviewEntries, reviewLedgerProblem } from '../benchmarks/engine/review-ledger.ts';
import { parseRoute } from '../src/model.mjs';
import { bindCopy, reviewPage, reviewQueue } from '../src/pages/workbench/review.ts';

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

test('the open queue uses reviewed decision categories and leaves no Other catch-all', () => {
  const open = classes.filter(c => c.open);
  assert.ok(open.length <= 6, `${open.length} open groups`);
  assert.deepEqual(open.map(c => c.open), [...open.map(c => c.open)].sort((a, b) => b - a), 'largest group first');
  for (const c of classes) assert.deepEqual(parseRoute(`/workbench/review/${c.id}`), { kind: 'workbench', id: c.id, view: 'review', to: '' }, c.id);
  assert.ok(open.some(c => c.id === 'fixture-expectation-review'));
  assert.ok(!classes.some(c => c.id === 'other'));
  assert.equal(reviewClassId('opaque-new-class'), 'unmapped');
});

test('not-assertable remains a distinct ledger state inside the reviewed intentional-difference category', () => {
  const notAssertable = classes.filter(c => c['not-assertable']);
  assert.ok(notAssertable.length > 0);
  const intentional = classes.find(c => c.id === 'intentional-difference');
  assert.ok(intentional['not-assertable'] > 0);
  assert.ok(intentional.rawClasses.some(raw => raw.startsWith('operator=')));
});

test('a resolution fragment requires exact current occurrence proof and carries that same run', () => {
  const first = { ...classes[0].entries[0], lastSeenRun: 'run-1', lastSeenAt: '2026-09-26T12:00:00.000Z' };
  const proof = { kind: 'current-run', runId: 'run-1', observedAt: first.lastSeenAt, observedIds: new Set([first.id]) };
  const parsed = JSON.parse(ledgerSnippet([first], proof, 'Reviewed: expected.'));
  assert.deepEqual(Object.keys(parsed), [first.id]);
  assert.equal(parsed[first.id].status, 'resolved');
  assert.equal(parsed[first.id].firstSeenRun, first.firstSeenRun);
  assert.equal(parsed[first.id].resolvedRun, 'run-1');
  assert.equal(parsed[first.id].resolutionEvidence.kind, 'run-observation');
  assert.equal(ledgerClassOf(parsed[first.id].note), ledgerClassOf(first.note));
  assert.equal(ledgerSnippet([first], { ...proof, observedIds: new Set() }), null, 'an id absent from the run cannot produce JSON');
  assert.equal(ledgerSnippet([{ ...first, lastSeenRun: 'old-run' }], proof), null, 'stale provenance cannot produce JSON');
});

test('legacy migration stays unverifiable, observed updates touch only carried ids, and historical adjudication is explicit', () => {
  assert.equal(ledger.schemaVersion, 2);
  assert.equal(reviewLedgerProblem(ledger), null);
  const [a, b] = classes.flatMap(c => c.entries).filter(e => e.status === 'open');
  const occurrence = { id: a.id, caseId: 'case-a', sourceSlug: 'suite--fixture', variant: 'original' };
  const updated = observeReviewEntries({ schemaVersion: 2, entries: { [a.id]: a, [b.id]: b } }, [occurrence], 'run-now', '2026-09-26T12:00:00.000Z');
  assert.equal(updated.entries[a.id].lastSeenRun, 'run-now');
  assert.equal(updated.entries[b.id].lastSeenRun, b.lastSeenRun, 'unobserved entries are untouched');
  const adjudicated = { ...b, historicalAdjudication: { decidedAt: '2026-09-26T12:00:00.000Z', evidenceUrl: 'https://example.test/evidence', note: 'Reviewed source evidence.' } };
  const historical = JSON.parse(ledgerSnippet([adjudicated], { kind: 'historical-adjudication' }));
  assert.equal(historical[b.id].resolutionEvidence.kind, 'historical-adjudication');
});

test('publication may retain known observations while unknown current ids force the browser lock', () => {
  const id = 'a'.repeat(64), unknown = 'b'.repeat(64);
  const source = { schemaVersion: 2, entries: { [id]: { status: 'open', firstSeenRun: 'first', note: 'Needs review. Class: t0-pending-fixture.' } } };
  const occurrence = { id, caseId: 'case-a', sourceSlug: 'accuracy--aws-id', variant: 'baseline' };
  assert.throws(() => observeReviewEntries(source, [occurrence, { ...occurrence, id: unknown }], 'run-2', '2026-09-26T00:00:00Z'), /absent from the ledger/);
  const published = observeReviewEntries(source, [occurrence, { ...occurrence, id: unknown }], 'run-2', '2026-09-26T00:00:00Z', { unknown: 'ignore' });
  assert.equal(published.entries[id].lastSeenRun, 'run-2');
  assert.equal(Object.hasOwn(published.entries, unknown), false);
});

test('published occurrence provenance is bound to the exact public evaluation', () => {
  const evaluation = { runId: 'run-now', finishedAt: '2026-09-26T12:00:00.000Z', reviews: [{ id: 'a'.repeat(64), caseId: 'case-a', variant: 'original' }], cases: [{ id: 'case-a', sourceSlug: 'suite--fixture' }] };
  const source = { schemaVersion: 2, entries: { ['a'.repeat(64)]: { status: 'open', firstSeenRun: 'first', note: 'Why. Class: t0-pending-fixture.' } } };
  const published = observeReviewEntries(source, [{ id: 'a'.repeat(64), caseId: 'case-a', sourceSlug: 'suite--fixture', variant: 'original' }], evaluation.runId, evaluation.finishedAt);
  assert.equal(reviewLedgerPublicationProblem(published, source, evaluation), null);
  published.observationRun.runId = 'stale';
  assert.match(reviewLedgerPublicationProblem(published, source, evaluation), /does not describe/);
});

test('every historical, missing, stale and direct category path is locked; current and adjudicated branches alone can copy', () => {
  const id = 'b'.repeat(64), runId = 'run-current', finishedAt = '2026-09-26T12:00:00.000Z';
  const base = { status: 'open', firstSeenRun: 'first', note: 'Review this fixture. Class: t0-pending-fixture.' };
  const evaluation = { runId, finishedAt, reviews: [{ id, caseId: 'case-a', variant: 'original', peer: '', disagreement: '' }], cases: [{ id: 'case-a', sourceSlug: 'suite--fixture', variants: [{ id: 'original', kind: 'must-redact', tier: 'T1', strategy: 'authored' }] }] };
  const legacyClasses = reviewClasses({ schemaVersion: 2, entries: { [id]: base } });
  for (const [report, problem] of [[null, 'No evaluation report published'], [evaluation, 'Stale review ledger']]) {
    const html = reviewPage(legacyClasses, 'release-historical', report, problem);
    assert.ok(html.includes('Resolution locked'));
    assert.ok(!html.includes('data-copy=') && !html.includes('ledger-snippet-'), 'locked HTML exposes no copy or snippet target');
  }
  const observed = { ...base, lastSeenRun: runId, lastSeenAt: finishedAt, lastSeenEvidence: { caseId: 'case-a', sourceSlug: 'suite--fixture', variant: 'original' } };
  const currentClasses = reviewClasses({ schemaVersion: 2, entries: { [id]: observed } });
  const current = reviewPage(currentClasses, 'fixture-expectation-review', evaluation, null);
  assert.ok(current.includes('data-copy=') && current.includes(`&quot;resolvedRun&quot;: &quot;${runId}&quot;`));
  assert.ok(!reviewPage(currentClasses, 'release-historical', evaluation, null).includes('data-copy='), 'direct historical route cannot copy a current item');
  const adjudicated = { ...base, historicalAdjudication: { decidedAt: finishedAt, evidenceUrl: 'https://example.test/evidence', note: 'Reviewed.' } };
  const historical = reviewPage(reviewClasses({ schemaVersion: 2, entries: { [id]: adjudicated } }), 'release-historical', evaluation, null);
  assert.ok(historical.includes('data-copy=') && historical.includes('historical-adjudication'));
  const counts = [...reviewQueue(currentClasses, evaluation, null).matchAll(/<b>([\d,]+)<\/b>/g)].map(match => Number(match[1].replace(/,/g, '')));
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 1, 'category counts reconcile to open ledger entries');
});

test('copy status is live on success and failure', async () => {
  let handler, copied = '';
  const button = { dataset: { copy: 'draft' }, addEventListener: (_event, next) => { handler = next; } };
  const status = { textContent: '' }, snippet = { textContent: '{"safe":true}' };
  const root = { querySelectorAll: () => [button], querySelector: selector => selector.startsWith('[data-copy-status') ? status : snippet };
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { copied = text; } } } });
  bindCopy(root); await handler();
  assert.equal(copied, snippet.textContent); assert.match(status.textContent, /Copied/);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => { throw new Error('blocked'); } } } });
  await handler(); assert.match(status.textContent, /blocked/);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
});

import { changeRows, qualificationGates, candidateProblem } from '../src/evaluation-model.ts';
const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url), 'utf8'));
const qualified = JSON.parse(await readFile(new URL('../docs/specs/qualification/engine-v1.json', import.meta.url), 'utf8'));
// The checked-in run is execution-qualified (#213); the floors are read here against the same run with unreviewed queue entries.
const evidence = structuredClone(qualified);
evidence.status = 'incomplete';
evidence.accounting = { ...evidence.accounting, reasons: ['unreviewed-queue'], review: { ...evidence.accounting.review, unknown: 7 } };
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
  // The evidence says why it is incomplete; the page repeats that, it does not decide it.
  assert.deepEqual(evidence.accounting.reasons, ['unreviewed-queue']);
  assert.equal(qualificationGates(suite.accounting, qualified, null).find(g => g.id === 'ledger').status, 'met', 'the checked-in run has no open or missing ledger rows');
  assert.equal(get('ledger').status, 'not-met');
  assert.match(get('ledger').detail, new RegExp(`${evidence.accounting.review.unknown} queue entries have no ledger row`));
  assert.equal(get('resolved-rate').status, 'met');
  assert.equal(get('scanners').status, 'met');
  const thin = qualificationGates(suite.accounting, null, { 'must-redact/T1': group(3, 3, 0.4, 3, 1, 0.333) });
  assert.deepEqual(thin.filter(g => g.status === 'not-met').map(g => g.id), ['min-denominator', 'measurable-share', 'twin-coverage']);
  const reviewed = structuredClone(evidence); reviewed.accounting = { reasons: [], unresolvedGroups: [], review: { open: 1233, resolved: 382, notAssertable: 5, unknown: 0, oldestOpenRun: 'x' } };
  assert.deepEqual([qualificationGates(suite.accounting, reviewed, null).at(-1).status, qualificationGates(suite.accounting, reviewed, null).at(-1).value], ['watch', '1,620 · 1,233 open'], 'open is a valid state, and not-assertable counts toward the total like resolved');
});
