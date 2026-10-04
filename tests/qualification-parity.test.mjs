import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUSES, causeOfReason, compareDistributions, compareFamilies, compareIdentity, compareKnownGaps, compareOutcomes, compareReview, compareSupportMatrix, joinByKeys, reasonCode, renderMarkdown, summarise,
} from '../benchmarks/qualification/parity.ts';

// Synthetic only. Nothing here reads the ledger, a committed report or a count from the corpus: a repin re-keys those.
// Every expectation is relative to the sides the test builds.

const FLOORS = 'pop-floors';
const evidence = (over = {}) => ({
  detectors: ['fam-a'], positiveContractTier: 'T1', hasProviderSource: true, observationCount: 0, observationSubjects: 0, observationIssuanceDates: 0,
  corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [], unresolvedContradictions: 0, boundedContradictions: 0, uncertainty: null,
  supportedContexts: [], empiricalMode: null, supportsBareValues: false, evidenceBasis: 'provider-documented',
  positiveCases: 10, totalFixtures: 30, benignCases: 8, twinPairs: 6, contextTwinPairs: 2, twinFailures: 0, benignFalseAlarms: 0,
  positiveAxes: 5, controlAxes: 4, confusionAxes: 5, benignAxes: 4, benignAxisIds: ['a', 'b'],
  metamorphicCriticalFailures: 0, mutationUnresolvedCritical: 0, differentialUnresolvedContractDisagreements: 0, policyQualification: null, ...over,
});
const legacy = (family = 'fam-a', over = {}, evidenceOver = {}) => ({
  family, status: 'stable', reasons: [], evidenceTier: 'T1', evidenceBasis: 'provider-documented', qualificationProfile: 'documented', taxonomyFamilies: ['p:f'], evidence: evidence(evidenceOver), ...over,
});
const next = (family = 'fam-a', over = {}, evidenceOver = {}, statusOver = {}, populations) => ({
  family, taxonomyFamilies: ['p:f'], evidence: evidence(evidenceOver),
  status: { value: 'stable', reasons: [], evidenceTier: 'T1', evidenceBasis: 'provider-documented', qualificationProfile: 'documented', methodsNotRun: [], ...statusOver },
  populations: populations ?? [{ population: FLOORS, role: 'floors-and-gates', cases: 30, pending: 0, notMeasured: 0, positives: 10, benign: 8, twinPairs: 6 }],
  ...over,
});
const options = { floorsPopulation: FLOORS };
const diffs = (section, field) => section.differences.filter(d => d.field === field);

test('identical sides are all equal and no difference is invented', () => {
  const report = compareFamilies([legacy()], [next()], options);
  for (const section of [report.membership, report.status, report.evidence]) {
    assert.equal(section.tally.explained, 0);
    assert.equal(section.tally.unexplained, 0);
    assert.equal(section.tally.equal, section.tally.compared);
  }
});

test('a product-owned fact that differs is unexplained: it must be equal', () => {
  const report = compareFamilies([legacy()], [next('fam-a', {}, { corroborationReferences: 3 })], options);
  const [d] = diffs(report.evidence, 'corroborationReferences');
  assert.equal(d.verdict, 'unexplained');
  assert.equal(report.evidence.tally.unexplained, 1);
});

test('a pooled legacy count is explained by the populations the new path keeps apart, only when it reconciles exactly', () => {
  const split = [
    { population: FLOORS, role: 'floors-and-gates', cases: 30, pending: 0, notMeasured: 0, positives: 10, benign: 8, twinPairs: 6 },
    { population: 'pop-gates', role: 'gates', cases: 5, pending: 0, notMeasured: 0, positives: 3, benign: 2, twinPairs: 0 },
  ];
  const pooled = compareFamilies([legacy('fam-a', {}, { totalFixtures: 35, positiveCases: 13, benignCases: 10 })], [next('fam-a', {}, {}, {}, split)], options);
  for (const field of ['totalFixtures', 'positiveCases', 'benignCases']) assert.equal(diffs(pooled.evidence, field)[0].cause, 'population-separation', field);
  const off = compareFamilies([legacy('fam-a', {}, { totalFixtures: 36 })], [next('fam-a', {}, {}, {}, split)], options);
  assert.equal(diffs(off.evidence, 'totalFixtures')[0].verdict, 'unexplained');
});

test('an adjustment explains a residual only when its amounts sum to it', () => {
  const exact = compareFamilies([legacy('fam-a', {}, { totalFixtures: 33 })], [next()], { ...options, adjustmentsByFamily: { 'fam-a': { 'pending-not-scored': { totalFixtures: 2 }, 'twin-scope-vocabulary': { totalFixtures: 1 } } } });
  assert.equal(diffs(exact.evidence, 'totalFixtures')[0].cause, 'pending-not-scored');
  const short = compareFamilies([legacy('fam-a', {}, { totalFixtures: 33 })], [next()], { ...options, adjustmentsByFamily: { 'fam-a': { 'pending-not-scored': { totalFixtures: 2 } } } });
  assert.equal(diffs(short.evidence, 'totalFixtures')[0].verdict, 'unexplained');
});

test('a pending twin is no adjustment: legacy drops T0 twins, so only the real residual needs a cause', () => {
  // 32 legacy vs 30 new: two cross-family twins explain it. Pending twins book nothing, so no pending-not-scored amount is present.
  const report = compareFamilies([legacy('fam-a', {}, { totalFixtures: 32 })], [next()], { ...options, adjustmentsByFamily: { 'fam-a': { 'twin-scope-vocabulary': { totalFixtures: 2 } } } });
  const [d] = diffs(report.evidence, 'totalFixtures');
  assert.equal(d.verdict, 'explained');
  assert.equal(d.cause, 'twin-scope-vocabulary');
  // Booking the three pending twins as well (the old behaviour) overshoots the residual and is unexplained.
  const overshoot = compareFamilies([legacy('fam-a', {}, { totalFixtures: 32 })], [next()], { ...options, adjustmentsByFamily: { 'fam-a': { 'pending-not-scored': { totalFixtures: 3 }, 'twin-scope-vocabulary': { totalFixtures: 2 } } } });
  assert.equal(diffs(overshoot.evidence, 'totalFixtures')[0].verdict, 'unexplained');
});

test('axis counts that differ are the axis vocabulary, and equal axis counts are just equal', () => {
  const report = compareFamilies([legacy('fam-a', {}, { positiveAxes: 11 })], [next('fam-a', {}, { positiveAxes: 1 })], options);
  assert.equal(diffs(report.evidence, 'positiveAxes')[0].cause, 'axis-vocabulary');
  assert.equal(diffs(report.evidence, 'controlAxes').length, 0);
});

test('a method that did not run is not measured even when the numbers happen to be equal', () => {
  const report = compareFamilies([legacy()], [next('fam-a', {}, {}, { methodsNotRun: ['metamorphic'] })], options);
  const [d] = diffs(report.evidence, 'metamorphicCriticalFailures');
  assert.equal(d.cause, 'methods-not-run');
  assert.equal(d.next, 'not measured');
  assert.equal(diffs(report.evidence, 'mutationUnresolvedCritical').length, 0);
});

test('a status that drops is explained only when every reason the new path adds has a cause', () => {
  const reasons = ['methods.notRun: metamorphic did not run', 'empirical.minimumPositiveAxes: 1 < 6 — axes'];
  const explained = compareFamilies([legacy()], [next('fam-a', {}, {}, { value: 'provisional', qualificationProfile: null, reasons, methodsNotRun: ['metamorphic'] })], options);
  assert.equal(explained.status.differences[0].verdict, 'explained');
  assert.deepEqual(explained.statusRows[0].causes, ['axis-vocabulary', 'methods-not-run']);
  assert.equal(explained.counterfactual.heldByMethodsAndOthers, 1);

  const mystery = compareFamilies([legacy()], [next('fam-a', {}, {}, { value: 'provisional', qualificationProfile: null, reasons: ['something.unknown: x'] })], options);
  assert.equal(mystery.status.differences[0].verdict, 'unexplained');
  assert.deepEqual(mystery.statusRows[0].unattributedReasons, ['something.unknown']);
});

test('the counterfactual separates families held only by the unmeasured methods', () => {
  const only = ['methods.notRun: methods did not run'];
  const report = compareFamilies(
    [legacy('fam-a'), legacy('fam-b'), legacy('fam-c')],
    [
      next('fam-a', {}, {}, { value: 'provisional', qualificationProfile: null, reasons: only, methodsNotRun: ['mutation'] }),
      next('fam-b', {}, {}, { value: 'provisional', qualificationProfile: null, reasons: ['documented.minimumPositiveAxes: 1 < 6'] }),
      next('fam-c'),
    ],
    options,
  );
  assert.deepEqual(report.counterfactual, { legacyStable: 3, nextStable: 1, heldOnlyByMethods: 1, heldByMethodsAndOthers: 0, heldWithoutMethods: 1 });
});

test('membership: a family present on one side only is a difference', () => {
  const report = compareFamilies([legacy('fam-a'), legacy('fam-x')], [next('fam-a')], options);
  assert.equal(report.membership.tally.unexplained, 1);
  assert.equal(report.membership.differences[0].subject, 'fam-x');
});

test('reason codes and their causes', () => {
  assert.equal(reasonCode('empirical.minimumPositiveAxes: 1 < 6 — text'), 'empirical.minimumPositiveAxes');
  assert.equal(reasonCode('positiveContractTier T0 — Tier T0 means'), 'positiveContractTier T0');
  assert.equal(causeOfReason('methods.notRun', undefined), 'methods-not-run');
  assert.equal(causeOfReason('documented.minimumPositiveAxes', undefined), 'axis-vocabulary');
  assert.equal(causeOfReason('policy.positive-cases', undefined), 'policy-corpus-bounded');
  assert.equal(causeOfReason('policy.protected-holdout', undefined), undefined);
  assert.equal(causeOfReason('benign.minimumCases', undefined), undefined);
  assert.equal(causeOfReason('benign.minimumCases', 'pending-not-scored'), 'pending-not-scored');
});

test('identity: the same pins are equal, a version drift or a scanner on one side is a difference', () => {
  assert.equal(compareIdentity({ a: '1', b: '2' }, { a: '1', b: '2' }).tally.unexplained, 0);
  const drift = compareIdentity({ a: '1', b: '2' }, { a: '1', b: '3' });
  assert.equal(drift.tally.unexplained, 1);
  assert.equal(drift.differences[0].subject, 'b');
  assert.equal(compareIdentity({ a: '1' }, { a: '1', c: '9' }).tally.unexplained, 1);
});

const control = (over = {}) => ({ kind: 'control', observed: true, flagged: false, coDetected: false, twin: true, ...over });
const side = (key, scanners) => ({ key, scanners });
const pair = (legacyScanners, nextScanners, key = 'case-1') => ({ population: 'pop', legacy: side(key, legacyScanners), next: side(key, nextScanners) });

test('outcomes: equal outcomes compare equal; a twin whose verdict swaps with a finding on both sides is the twin-scope pattern', () => {
  const equal = compareOutcomes([pair({ s: { kind: 'positive', spans: ['EXACT'] } }, { s: { kind: 'positive', spans: ['EXACT'] } })]);
  assert.equal(equal.section.tally.equal, 1);
  const swap = compareOutcomes([pair({ s: control({ flagged: true }) }, { s: control({ coDetected: true }) })]);
  assert.equal(swap.section.tally.explained, 1);
  assert.equal(swap.groups[0].cause, 'twin-scope-vocabulary');
});

test('outcomes: a positive that scores differently, or a non-twin control, is never attributed', () => {
  const positive = compareOutcomes([pair({ s: { kind: 'positive', spans: ['EXACT'] } }, { s: { kind: 'positive', spans: ['MISS'] } })]);
  assert.equal(positive.section.tally.unexplained, 1);
  const benign = compareOutcomes([pair({ s: control({ twin: false, flagged: true }) }, { s: control({ twin: false, coDetected: true }) })]);
  assert.equal(benign.section.tally.unexplained, 1);
  const unobserved = compareOutcomes([pair({ s: control({ observed: false }) }, { s: control({ observed: true, flagged: true }) })]);
  assert.equal(unobserved.section.tally.unexplained, 1);
});

test('outcomes: pairs that differ the same way are grouped, with at most three examples', () => {
  const pairs = ['c1', 'c2', 'c3', 'c4', 'c5'].map(key => pair({ s: control({ flagged: true }) }, { s: control({ coDetected: true }) }, key));
  const { groups } = compareOutcomes(pairs);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 5);
  assert.equal(groups[0].examples.length, 3);
});

test('join: a content key held once on each side pairs; shared content waits for a looser key and is never guessed', () => {
  const l = (key, ...joinKeys) => ({ key, scanners: {}, joinKeys });
  const result = joinByKeys('pop',
    [l('l1', 'h1|e|n1', 'h1'), l('l2', 'h2|e|n2', 'h2'), l('l3', 'h3|e|n3', 'h3'), l('l4', 'h3|e|n4', 'h3'), l('l5', 'h5|e|n5', 'h5')],
    [l('n1', 'h1|e|n1', 'h1'), l('n2', 'x|e|n2', 'h2'), l('n3', 'h3|e|n3', 'h3'), l('n4', 'h3|e|n4', 'h3'), l('n6', 'h6|e|n6', 'h6')]);
  assert.deepEqual(result.pairs.map(p => `${p.legacy.key}:${p.next.key}`).sort(), ['l1:n1', 'l2:n2', 'l3:n3', 'l4:n4']);
  assert.deepEqual(result.byTier, [3, 1]);
  assert.deepEqual(result.unmatchedLegacy, ['l5']);
  assert.deepEqual(result.unmatchedNext, ['n6']);
  const shared = joinByKeys('pop', [l('a', 'h|1', 'h'), l('b', 'h|2', 'h')], [l('c', 'h|3', 'h')]);
  assert.equal(shared.pairs.length, 0);
  assert.deepEqual(shared.ambiguous, { legacy: 2, next: 1 });
});

test('known gaps: ids and status must equal; a legacy fixture that does not resolve in a re-keyed population is the re-key', () => {
  const gapsLegacy = [{ id: 'g1', status: 'open', kind: 'false-positive', fixtures: ['cat--a', 'cat--b'] }];
  const gapsNext = [{ id: 'g1', status: 'open', kind: 'false-positive', fixtures: [{ fixture: 'cat--a', matches: [{ population: 'pop-shared' }] }, { fixture: 'cat--b', matches: [] }] }];
  const populations = { 'cat--a': 'pop-shared', 'cat--b': 'pop-rekeyed' };
  const section = compareKnownGaps(gapsLegacy, gapsNext, { populationOf: f => populations[f], inLegacyRun: () => true, sharedIdPopulations: ['pop-shared'] });
  assert.equal(section.tally.unexplained, 0);
  assert.equal(section.differences.length, 1);
  assert.equal(section.differences[0].cause, 'legacy-id-rekey');
  const drift = compareKnownGaps(gapsLegacy, [{ ...gapsNext[0], status: 'fixed' }], { populationOf: f => populations[f], inLegacyRun: () => false, sharedIdPopulations: [] });
  assert.equal(drift.differences[0].verdict, 'unexplained');
  assert.equal(drift.differences[0].field, 'status');
});

const totals = (distribution = { stable: 1, provisional: 0, pending: 0, unsupported: 0 }, stable = { documented: 1, empirical: 0, 'policy-qualified': 0 }) => ({ distribution, stable });
const entry = (family = 'p:f', over = {}) => ({
  provider: 'p', family, familyName: 'F', status: 'stable', evidenceTier: 'T1', evidenceBasis: 'provider-documented', qualificationProfile: 'documented',
  providerSource: { url: 'u' }, corroboratingScanners: ['x'], twinCoverage: { pairs: 6, failures: 0, unprobeable: null },
  unresolvedCriticalItems: { metamorphic: 0, mutation: 0, differential: 0 }, empiricalEvidence: { observations: 0, contradictions: 0 },
  policyQualification: null, fixtureProfile: { positiveCases: 10, totalFixtures: 30, positiveAxes: 5 }, detectors: ['fam-a'], reason: null,
  profileCoverage: { claimed: 'c', cells: { totalFixtures: 30 }, cellsMet: ['c'], debt: [] }, ...over,
});
/** The matrix is a projection of the family comparison: build both from the same synthetic sides. */
const matrixOf = (legacySide, nextSide, legacyEntries, nextEntries, legacyTotals = totals(), nextTotals = totals()) => {
  const families = compareFamilies(legacySide, nextSide, options);
  return compareSupportMatrix(legacyEntries, nextEntries, legacyTotals, nextTotals, { evidence: families.evidence, status: families.status, statusRows: families.statusRows });
};

test('support matrix: equal entries are all equal, key order is not a value, and nothing is invented', () => {
  const a = entry(), b = { ...entry(), profileCoverage: { debt: [], cellsMet: ['c'], cells: { totalFixtures: 30 }, claimed: 'c' } };
  const section = matrixOf([legacy()], [next()], [a], [b]);
  assert.equal(section.tally.explained + section.tally.unexplained, 0);
  assert.equal(section.tally.equal, section.tally.compared);
});

test('support matrix: a figure is attributed only through the evidence difference it projects, and one with none is unexplained', () => {
  // The family comparison explains a count difference by the population split; the matrix projects the same figure.
  const split = [
    { population: FLOORS, role: 'floors-and-gates', cases: 30, pending: 0, notMeasured: 0, positives: 10, benign: 8, twinPairs: 6 },
    { population: 'pop-gates', role: 'gates', cases: 5, pending: 0, notMeasured: 0, positives: 3, benign: 2, twinPairs: 0 },
  ];
  const l = legacy('fam-a', {}, { totalFixtures: 35 }), n = next('fam-a', {}, {}, {}, split);
  const attributed = matrixOf([l], [n], [entry('p:f', { fixtureProfile: { positiveCases: 10, totalFixtures: 35, positiveAxes: 5 } })], [entry()]);
  const [d] = attributed.differences;
  assert.deepEqual([d.field, d.verdict, d.cause], ['fixtureProfile.totalFixtures', 'explained', 'population-separation']);
  // A figure that differs where the evidence does not is not attributed, and neither is a product-owned fact.
  const bare = matrixOf([legacy()], [next()], [entry('p:f', { fixtureProfile: { positiveCases: 10, totalFixtures: 31, positiveAxes: 5 } })], [entry()]);
  assert.equal(bare.differences[0].verdict, 'unexplained');
  const owned = matrixOf([legacy()], [next()], [entry('p:f', { corroboratingScanners: ['x', 'y'] })], [entry()]);
  assert.deepEqual(owned.differences.map(x => [x.field, x.verdict]), [['corroboratingScanners', 'unexplained']]);
});

test('support matrix: a status that drops is attributed through the status comparison, and the counts are explained only when the entries sum to them', () => {
  const reasons = ['methods.notRun: metamorphic did not run'];
  const l = legacy(), n = next('fam-a', {}, {}, { value: 'provisional', qualificationProfile: null, reasons, methodsNotRun: ['metamorphic'] });
  const drop = { status: 'provisional', qualificationProfile: null, reason: reasons.join(' | ') };
  const dropped = matrixOf([l], [n], [entry()], [entry('p:f', drop)], totals(), totals({ stable: 0, provisional: 1, pending: 0, unsupported: 0 }, { documented: 0, empirical: 0, 'policy-qualified': 0 }));
  const byField = Object.fromEntries(dropped.differences.map(d => [d.field, d]));
  assert.equal(byField.status.cause, 'methods-not-run');
  assert.equal(byField['distribution.stable'].cause, 'methods-not-run');
  assert.equal(byField['distribution.provisional'].cause, 'methods-not-run');
  assert.equal(byField['stableDistribution.documented'].cause, 'methods-not-run');
  assert.equal(dropped.tally.unexplained, 0);
  // A count that moved by more than the attributed entries show is not explained.
  const off = matrixOf([l], [n], [entry()], [entry('p:f', drop)], totals(), totals({ stable: 0, provisional: 2, pending: 0, unsupported: 0 }));
  assert.equal(off.differences.find(d => d.field === 'distribution.provisional').verdict, 'unexplained');
});

test('support matrix: a family on one side only is a difference, and an undetected family has nothing to attribute', () => {
  const undetected = entry('p:none', { status: 'unsupported', evidenceTier: null, evidenceBasis: 'none', qualificationProfile: null, detectors: [], reason: 'no format' });
  const section = matrixOf([legacy()], [next()], [entry(), undetected], [entry(), { ...undetected, reason: 'a different reason' }]);
  assert.ok(section.differences.some(d => d.subject === 'matrix' && d.field === 'taxonomy families' || d.subject === 'p:none' && d.field === 'reason'));
  assert.ok(section.differences.every(d => d.verdict === 'unexplained'));
});

test('overview numbers: the family and status counts are compared, and a count is explained only by the attributed status changes', () => {
  const rows = [{ family: 'fam-a', legacy: 'stable', next: 'provisional', legacyProfile: 'documented', nextProfile: null, verdict: 'explained', causes: ['methods-not-run'] }];
  const section = compareDistributions({ familyCount: 3, ...totals({ stable: 3, provisional: 0, pending: 0, unsupported: 0 }, { documented: 3, empirical: 0, 'policy-qualified': 0 }) }, { familyCount: 3, ...totals({ stable: 2, provisional: 1, pending: 0, unsupported: 0 }, { documented: 2, empirical: 0, 'policy-qualified': 0 }) }, rows);
  assert.equal(section.tally.unexplained, 0);
  assert.deepEqual(section.differences.map(d => d.field), ['distribution.provisional', 'distribution.stable', 'stableDistribution.documented']);
  const unrelated = compareDistributions({ familyCount: 3, ...totals({ stable: 3, provisional: 0, pending: 0, unsupported: 0 }) }, { familyCount: 2, ...totals({ stable: 2, provisional: 0, pending: 0, unsupported: 0 }) }, []);
  assert.ok(unrelated.differences.every(d => d.verdict === 'unexplained'));
});

test('review: a peer the legacy run never scanned is the occurrence identity, every other value must equal', () => {
  const section = compareReview({ a: { occurrences: 4, settled: 3 }, b: null }, { a: { occurrences: 4, settled: 3 }, b: { occurrences: 7, settled: 0 } }, { differential: 4, mapped: 4 }, 4);
  assert.deepEqual(section.differences.map(d => [d.subject, d.field, d.verdict, d.cause]), [['b', 'occurrences', 'explained', 'review-occurrence-identity'], ['b', 'settled', 'explained', 'review-occurrence-identity']]);
  const drift = compareReview({ a: { occurrences: 4, settled: 3 } }, { a: { occurrences: 4, settled: 2 } }, { differential: 5, mapped: 4 }, 4);
  assert.deepEqual(drift.differences.map(d => d.verdict), ['unexplained', 'unexplained']);
});


test('summary and report: three classes add up, the markdown is deterministic and names an unexplained difference', () => {
  const families = compareFamilies([legacy('fam-a', {}, { positiveAxes: 11, corroborationReferences: 1 })], [next('fam-a', {}, { positiveAxes: 1 })], options);
  const outcomes = compareOutcomes([pair({ s: control({ flagged: true }) }, { s: control({ coDetected: true }) })]);
  const sections = { identity: compareIdentity({ a: '1' }, { a: '1' }), membership: families.membership, status: families.status, evidence: families.evidence, outcomes: outcomes.section, knownGaps: compareKnownGaps([], [], { populationOf: () => undefined, inLegacyRun: () => false, sharedIdPopulations: [] }), supportMatrix: compareSupportMatrix([], [], totals(), totals(), { evidence: families.evidence, status: families.status, statusRows: families.statusRows }), distribution: compareDistributions({ familyCount: 1, ...totals() }, { familyCount: 1, ...totals() }, []), review: compareReview({}, {}, { differential: 0, mapped: 0 }, 0) };
  const summary = summarise(sections);
  assert.equal(summary.compared, summary.equal + summary.explained + summary.unexplained);
  assert.equal(summary.classes.unexplained, summary.unexplained);
  assert.ok(Object.keys(summary.byCause).every(id => CAUSES.some(c => c.id === id)));
  const report = { schema: 's', identities: { legacy: 'x' }, causes: CAUSES, sections, statusRows: families.statusRows, matrix: { taxonomyFamilies: { legacy: 0, next: 0 }, distribution: { legacy: {}, next: {} }, stableDistribution: { legacy: {}, next: {} } }, counterfactual: families.counterfactual, outcomeGroups: outcomes.groups, joins: { pop: { byTier: [1], pairs: 1, unmatchedLegacy: 0, unmatchedNext: 0, ambiguousLegacy: 0, ambiguousNext: 0 } }, notCompared: [{ area: 'a', reason: 'r' }], summary, recommendations: ['do not apply'] };
  const markdown = renderMarkdown(report);
  assert.equal(markdown, renderMarkdown(report));
  assert.match(markdown, /corroborationReferences/);
  assert.match(markdown, /Recommendations \(not applied\)/);
});

test('every cause names a change and an owner, and its confirmation is stated', () => {
  const ids = new Set();
  for (const cause of CAUSES) {
    assert.ok(cause.change.length > 20 && cause.owner, cause.id);
    assert.ok(['confirmed', 'inferred'].includes(cause.confirmation), cause.id);
    assert.ok(!ids.has(cause.id), `duplicate cause ${cause.id}`);
    ids.add(cause.id);
  }
});

test('with the axis overlay, an axis difference is attributed by comparing axis ids, never assumed to be the snapshot vocabulary', () => {
  const ids = (positive, control = ['a', 'b']) => ({ positiveContext: positive, control, confusion: control });
  const withOverlay = { ...options, axisOverlay: true };
  // The new side holds one axis id the legacy side lacks: a case with no legacy counterpart, which needs the membership adjustment as evidence.
  const extra = adjustments => compareFamilies([legacy('fam-a', { axisIds: ids(['x']) }, { positiveAxes: 1 })], [next('fam-a', { axisIds: ids(['x', 'y']) }, { positiveAxes: 2 })], { ...withOverlay, adjustmentsByFamily: adjustments });
  assert.equal(diffs(extra({ 'fam-a': { 'canonical-evidence-membership': { totalFixtures: -1 } } }).evidence, 'positiveAxes')[0].cause, 'canonical-evidence-membership');
  assert.equal(diffs(extra({}).evidence, 'positiveAxes')[0].verdict, 'unexplained');
  // The legacy side holds an id the new side lacks: regression or policy cases of the family explain it; so does a pending fixture the adapter does not score.
  const split = [{ population: FLOORS, role: 'floors-and-gates', cases: 30, pending: 0, notMeasured: 0, positives: 10, benign: 8, twinPairs: 6 }, { population: 'pop-gates', role: 'gates', cases: 2, pending: 0, notMeasured: 0, positives: 2, benign: 0, twinPairs: 0 }];
  const missing = (populations, adjustments = {}) => compareFamilies([legacy('fam-a', { axisIds: ids(['x', 'y']) }, { positiveAxes: 2 })], [next('fam-a', { axisIds: ids(['x']) }, { positiveAxes: 1 }, {}, populations)], { ...withOverlay, adjustmentsByFamily: adjustments });
  assert.equal(diffs(missing(split).evidence, 'positiveAxes')[0].cause, 'population-separation');
  assert.equal(diffs(missing(undefined, { 'fam-a': { 'pending-not-scored': { totalFixtures: 1 } } }).evidence, 'positiveAxes')[0].cause, 'pending-not-scored');
  assert.equal(diffs(missing(undefined).evidence, 'positiveAxes')[0].verdict, 'unexplained');
  // Without the overlay the snapshot vocabulary still explains any axis difference, as before.
  assert.equal(diffs(compareFamilies([legacy('fam-a', {}, { positiveAxes: 11 })], [next('fam-a', {}, { positiveAxes: 1 })], options).evidence, 'positiveAxes')[0].cause, 'axis-vocabulary');
  // And a status reason about axes inherits the attributed cause, or none when the overlay is on and the evidence difference is unexplained.
  assert.equal(causeOfReason('documented.minimumPositiveAxes', undefined, { axis: 'population-separation', overlay: true }), 'population-separation');
  assert.equal(causeOfReason('documented.minimumPositiveAxes', undefined, { overlay: true }), undefined);
});

test('a differential count is a review-occurrence-identity difference only when no canonical occurrence id is in the ledger', () => {
  const reasons = ['differential.unresolvedContractDisagreements: 3 > 0 — text'];
  const run = review => compareFamilies([legacy()], [next('fam-a', {}, { differentialUnresolvedContractDisagreements: 3 }, { value: 'provisional', qualificationProfile: null, reasons })], { ...options, reviewByFamily: review });
  const none = run({ 'fam-a': { occurrences: 3, inLedger: 0, byPeer: { 'peer-one': 2, 'peer-two': 1 } } });
  const [d] = diffs(none.evidence, 'differentialUnresolvedContractDisagreements');
  assert.equal(d.cause, 'review-occurrence-identity');
  assert.match(d.note, /3 differential occurrence\(s\) \(peer-one 2, peer-two 1\)/);
  assert.deepEqual(none.statusRows[0].causes, ['review-occurrence-identity']);
  assert.deepEqual(none.heldBy, { 'review-occurrence-identity': 1 });
  // A partly re-keyed ledger, or no queue at all, is not this cause: it stays unexplained and the status is held by an unattributed reason.
  assert.equal(diffs(run({ 'fam-a': { occurrences: 3, inLedger: 1, byPeer: {} } }).evidence, 'differentialUnresolvedContractDisagreements')[0].verdict, 'unexplained');
  const unknown = run(undefined);
  assert.equal(unknown.statusRows[0].verdict, 'unexplained');
  assert.deepEqual(unknown.heldBy, { unattributed: 1 });
  assert.ok(CAUSES.some(c => c.id === 'review-occurrence-identity'));
});

test('a methods-run residual is canonical-evidence-membership only when the cases with no legacy counterpart show it exactly (#680)', () => {
  const reasons = ['differential.unresolvedContractDisagreements: 4 > 0 — text', 'metamorphic.criticalFailures: 3 > 0 — text', 'mutation.unresolvedCritical: 1 > 0 — text'];
  const evidenceOver = { differentialUnresolvedContractDisagreements: 4, metamorphicCriticalFailures: 3, mutationUnresolvedCritical: 1 };
  const run = review => compareFamilies([legacy()], [next('fam-a', {}, evidenceOver, { value: 'provisional', qualificationProfile: null, reasons })], { ...options, reviewByFamily: review });
  const exact = run({ 'fam-a': { occurrences: 9, inLedger: 5, byPeer: {}, unsettledUnjoined: 4, failuresUnjoined: { metamorphic: 3, mutation: 1 } } });
  for (const field of ['differentialUnresolvedContractDisagreements', 'metamorphicCriticalFailures', 'mutationUnresolvedCritical']) assert.equal(diffs(exact.evidence, field)[0].cause, 'canonical-evidence-membership', field);
  assert.deepEqual(exact.statusRows[0].causes, ['canonical-evidence-membership']);
  assert.equal(exact.statusRows[0].verdict, 'explained');
  // One occurrence or failure more or less than the residual is not this cause, and the status stays held by an unattributed reason.
  const off = run({ 'fam-a': { occurrences: 9, inLedger: 5, byPeer: {}, unsettledUnjoined: 3, failuresUnjoined: { metamorphic: 3, mutation: 2 } } });
  assert.equal(diffs(off.evidence, 'differentialUnresolvedContractDisagreements')[0].verdict, 'unexplained');
  assert.equal(diffs(off.evidence, 'mutationUnresolvedCritical')[0].verdict, 'unexplained');
  assert.equal(off.statusRows[0].verdict, 'unexplained');
  assert.equal(causeOfReason('metamorphic.criticalFailures', undefined, { method: { metamorphic: 'canonical-evidence-membership' } }), 'canonical-evidence-membership');
  assert.equal(causeOfReason('mutation.unresolvedCritical', undefined, {}), undefined);
});

test('review: occurrences of cases the legacy path never had explain the occurrence residual of a mapped peer only when they are exactly the residual (#680)', () => {
  const legacySide = { a: { occurrences: 4, settled: 3 } };
  const nextSide = n => ({ a: { occurrences: n, settled: 3 } });
  const exact = compareReview(legacySide, nextSide(7), { differential: 4, mapped: 4 }, 4, { a: 3 });
  assert.equal(exact.differences.find(d => d.subject === 'a' && d.field === 'occurrences').cause, 'canonical-evidence-membership');
  assert.equal(compareReview(legacySide, nextSide(7), { differential: 4, mapped: 4 }, 4, { a: 2 }).differences.find(d => d.subject === 'a' && d.field === 'occurrences').verdict, 'unexplained');
  assert.equal(compareReview(legacySide, nextSide(7), { differential: 4, mapped: 4 }, 4).differences.find(d => d.subject === 'a' && d.field === 'occurrences').verdict, 'unexplained');
});

test('a twin-failure difference is attributed to the twin scope only when the matched twins show it exactly, and holds the status through its cause', () => {
  const held = { status: { value: 'provisional', reasons: ['twinFailures: 2 > 0 — A twin failure is a recorded false negative'], evidenceTier: 'T1', evidenceBasis: 'provider-documented', qualificationProfile: null, methodsNotRun: [] } };
  const adjust = amount => ({ ...options, adjustmentsByFamily: { 'fam-a': { 'twin-scope-vocabulary': { twinFailures: amount } } } });
  // The new path reads two twin failures the legacy path read as co-detected: residual legacy - new = -2, and two matched twins show it.
  const explained = compareFamilies([legacy()], [next('fam-a', held, { twinFailures: 2 })], adjust(-2));
  const [d] = diffs(explained.evidence, 'twinFailures');
  assert.equal(d.verdict, 'explained');
  assert.equal(d.cause, 'twin-scope-vocabulary');
  assert.deepEqual(explained.statusRows[0].causes, ['twin-scope-vocabulary']);
  assert.deepEqual(explained.heldBy, { 'twin-scope-vocabulary': 1 });
  // An amount that does not sum to the residual, or no adjustment at all, is never attributed.
  assert.equal(diffs(compareFamilies([legacy()], [next('fam-a', held, { twinFailures: 2 })], adjust(-1)).evidence, 'twinFailures')[0].verdict, 'unexplained');
  const bare = compareFamilies([legacy()], [next('fam-a', held, { twinFailures: 2 })], options);
  assert.equal(diffs(bare.evidence, 'twinFailures')[0].verdict, 'unexplained');
  assert.deepEqual(bare.statusRows[0].unattributedReasons, ['twinFailures']);
  assert.equal(causeOfReason('twinFailures', undefined), undefined);
  assert.equal(causeOfReason('twinFailures', 'twin-scope-vocabulary'), 'twin-scope-vocabulary');
});
