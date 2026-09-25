import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  ATTACK_CLASSES_289, REQUIRED_DIMENSIONS, contractContentHash, evaluatePromotion, evasionAggregateProblems,
  evidenceIdentityProblems, loadPromotionContract, metricsFromEvasionAggregate, validatePromotionContract,
} from '../benchmarks/lib/scorer-promotion.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const committed = loadPromotionContract(root);
const clone = () => structuredClone(committed);
/** Re-seal a deliberately edited contract as a proper new revision, so only the rule under test can fail. */
function reseal(contract) {
  contract.contractVersion += 1;
  contract.revisions.push({ contractVersion: contract.contractVersion, date: '2026-09-26', summary: 'test revision', contentHash: '0'.repeat(64) });
  contract.revisions.at(-1).contentHash = contractContentHash(contract);
  return contract;
}
const problems = c => validatePromotionContract(c).join('\n');
const gate = (c, id) => c.gates.find(g => g.id === id);

// --- the contract -----------------------------------------------------------

test('the committed contract is valid', () => {
  assert.deepEqual(validatePromotionContract(committed), []);
});

test('the contract answers questions 1-5 separately and beta.9 needs no Q5', () => {
  assert.deepEqual(committed.questions.map(q => q.id), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
  for (const q of committed.questions) assert.ok(committed.gates.some(g => g.question === q.id), q.id);
  assert.equal(committed.questions.find(q => q.id === 'Q5').beta9Role, 'not-required');
  assert.equal(committed.beta9.passesWithoutQuestion5, true);
  assert.equal(committed.beta9.enforcementPromotion, false);
  assert.equal(committed.principles.promotionDependsOnSecretValues, false);
  assert.equal(committed.principles.securityDependsOnSecrecy, false);
  assert.equal(committed.framing.mixedScore, false);
});

test('every #257 dimension is gated', () => {
  for (const dimension of REQUIRED_DIMENSIONS) assert.ok(committed.gates.some(g => g.dimension === dimension), dimension);
});

test('changing any gate without a new revision fails', () => {
  const c = clone();
  gate(c, 'q2-twin-discrimination-gain').bound = 0.01;
  assert.match(problems(c), /content changed without a new revision; add contractVersion 2/);
  assert.deepEqual(validatePromotionContract(reseal(c)), []);
});

test('revisions are numbered in order and match contractVersion', () => {
  const c = reseal(clone());
  c.revisions[1].contractVersion = 3;
  assert.match(problems(c), /numbered 1, 2, 3/);
});

test('zero-tolerance leakage, invariance and negative-evidence gates cannot be loosened', () => {
  for (const [id, edit] of [
    ['q3-leaked-only-under-candidate', g => { g.bound = 1; }],
    ['q3-leaked-span-rate', g => { g.strata.bound = 0.01; }],
    ['q3-invariant-specificities', g => { g.operator = '<='; g.bound = 2; }],
    ['q4-negative-evidence-abuse', g => { g.bound = 1; }],
    ['q4-no-new-evasion', g => { g.strata.bound = 1; }],
  ]) {
    const c = clone();
    edit(gate(c, id));
    assert.match(problems(reseal(c)), /zero-tolerance/, id);
  }
});

test('a missing question, dimension or mandatory gate fails', () => {
  let c = clone();
  c.gates = c.gates.filter(g => g.question !== 'Q1');
  assert.match(problems(reseal(c)), /question Q1 has no gate/);

  c = clone();
  c.gates = c.gates.filter(g => g.dimension !== 'size');
  assert.match(problems(reseal(c)), /no gate covers the size dimension/);

  c = clone();
  c.gates = c.gates.filter(g => g.id !== 'q5-new-model-identity');
  assert.match(problems(reseal(c)), /Q5 must gate identity\.newModelIdentity == true/);

  c = clone();
  c.gates = c.gates.filter(g => !g.source.endsWith('/issues/772'));
  assert.match(problems(reseal(c)), /Q5 must cite product-supplied qualification from .*issues\/772/);
});

test('independent evidence belongs to Q5 and only Q4 reads the #289 aggregate', () => {
  let c = clone();
  gate(c, 'q5-holdout-false-alarm').question = 'Q3';
  gate(c, 'q5-holdout-false-alarm').id = 'q3-holdout-false-alarm';
  assert.match(problems(reseal(c)), /protected-holdout evidence is independent evidence and belongs to Q5/);

  c = clone();
  gate(c, 'q3-unstable').metric = 'evasion.unstableCases';
  assert.match(problems(reseal(c)), /Q4 gates, and only Q4 gates/);
});

test('beta.9 stays shadow-only and Q5 not required', () => {
  let c = clone();
  c.questions.find(q => q.id === 'Q5').beta9Role = 'informational';
  assert.match(problems(reseal(c)), /Q5\.beta9Role: must be not-required/);
  c = clone();
  c.beta9.passesWithoutQuestion5 = false;
  assert.match(problems(c), /schema: \/beta9\/passesWithoutQuestion5/);
  c = clone();
  c.framing.mixedScore = true;
  assert.match(problems(c), /schema: \/framing\/mixedScore/);
  c = clone();
  c.principles.promotionDependsOnSecretValues = true;
  assert.match(problems(c), /schema: \/principles\/promotionDependsOnSecretValues/);
});

test('no scorer weight or cut-off can be added to the contract', () => {
  const c = clone();
  gate(c, 'q1-calibration-error').weights = [1, 2];
  assert.match(problems(c), /schema: .*must NOT have additional properties/);
});

test('the #289 field lists stay in step with the aggregate schema and attack classes', () => {
  let c = clone();
  c.evasionAggregate.countFields = c.evasionAggregate.countFields.filter(f => f !== 'unstable');
  assert.match(problems(reseal(c)), /countFields: must equal/);
  c = clone();
  c.evasionAggregate.requiredAttackClasses = c.evasionAggregate.requiredAttackClasses.filter(x => x !== 'periodic-body');
  assert.match(problems(reseal(c)), /must include the #289 class periodic-body/);
});

// --- the #289 aggregate -----------------------------------------------------

function counts(overrides = {}) {
  return {
    variants: 40, unresolved: 1, unstable: 0, controls: 9,
    detectionPreserved: 28, leakedSpans: 2, legacyDetectionPreserved: 27, legacyLeakedSpans: 3, leakedOnlyUnderCandidate: 0,
    falseAlarms: 1, legacyFalseAlarms: 1, mustRedactBytes: 1200, collateralBytes: 30, legacyCollateralBytes: 40,
    negativeEvidenceApplied: 3, negativeEvidenceOnPartialMatch: 0,
    ...overrides,
  };
}
function aggregate(mode = 'promotion-candidate', perClass = () => counts()) {
  const attackClasses = Object.fromEntries(ATTACK_CLASSES_289.map(cls => [cls, perClass(cls)]));
  const totals = {};
  for (const c of Object.values(attackClasses)) for (const [k, v] of Object.entries(c)) totals[k] = (totals[k] ?? 0) + v;
  return {
    schemaVersion: 1, reportType: 'score-evasion-aggregate', visibility: 'public-aggregate', mode, holdoutAccess: 'none',
    identity: identityTuple(),
    benchmark: { commit: 'b'.repeat(40), dirty: false },
    operatorSetHash: 'c'.repeat(64),
    totals, attackClasses,
    invariants: {
      protectedSpecificityNeverWeakened: true, negativeEvidenceFullGrammarOnly: true, noStatisticalPositiveToNonFinding: true,
      shadowNonEnforcing: mode === 'shadow' ? true : null,
    },
  };
}
function identityTuple() {
  return {
    sourceRevision: 'a'.repeat(40), candidateArtifactHash: '1'.repeat(64), scoringArtifactRevision: 2,
    modelFingerprint: '2'.repeat(64), scoringArtifactSha256: '3'.repeat(64), tuningManifestHash: '4'.repeat(64), scoringIdentity: '5'.repeat(64),
  };
}

test('a well-formed #289 aggregate is publishable', () => {
  assert.deepEqual(evasionAggregateProblems(aggregate()), []);
  assert.deepEqual(evasionAggregateProblems(aggregate('shadow')), []);
});

test('the #289 aggregate is a closed shape: no recipe, score or variant detail', () => {
  const a = aggregate();
  a.attackClasses['periodic-body'].recipe = 1;
  assert.match(evasionAggregateProblems(a).join('\n'), /must NOT have additional properties/);
  const b = aggregate();
  b.variants = [{ id: 'x' }];
  assert.match(evasionAggregateProblems(b).join('\n'), /must NOT have additional properties/);
});

test('the #289 aggregate counts must add up and small classes are not published', () => {
  const a = aggregate();
  a.attackClasses['periodic-body'].variants += 1;
  a.totals.variants += 1;
  assert.match(evasionAggregateProblems(a).join('\n'), /attackClasses\.periodic-body: variants must equal/);

  const b = aggregate();
  b.totals.leakedSpans += 1;
  assert.match(evasionAggregateProblems(b).join('\n'), /totals\.leakedSpans: must equal the sum/);

  const c = aggregate('promotion-candidate', cls => (cls === 'periodic-body'
    ? counts({ variants: 4, unresolved: 0, controls: 0, detectionPreserved: 4, leakedSpans: 0, legacyDetectionPreserved: 4, legacyLeakedSpans: 0, falseAlarms: 0, legacyFalseAlarms: 0 })
    : counts()));
  assert.match(evasionAggregateProblems(c).join('\n'), /fewer than 5 variants is never published/);

  const d = aggregate('shadow');
  d.invariants.shadowNonEnforcing = null;
  assert.match(evasionAggregateProblems(d).join('\n'), /shadowNonEnforcing/);
});

// --- evaluation ---------------------------------------------------------------

/** A cell that satisfies `bound` under `op` for a gate kind. */
function satisfying(kind, op, bound) {
  if (kind === 'boolean') return { value: bound };
  if (kind === 'delta') {
    const legacy = 0.5;
    return { candidate: legacy + (op === '>=' ? Math.max(bound, 0) : Math.min(bound, 0)), legacy };
  }
  return { value: bound };
}
function passingEvidence(contract = committed) {
  const metrics = {};
  for (const g of contract.gates) {
    if (g.kind === 'member') {
      metrics[g.metric] = { strata: { [g.strata.dimensions[0]]: Object.fromEntries(g.strata.required.map(n => [n, { value: g.allowed[0] }])) } };
      continue;
    }
    const cell = satisfying(g.kind, g.operator, g.bound);
    if (g.strata) {
      const stratum = { ...satisfying(g.kind, g.strata.operator, g.strata.bound), support: 50 };
      cell.strata = Object.fromEntries(g.strata.dimensions.map(d => [d, { alpha: stratum, beta: stratum }]));
    }
    metrics[g.metric] = cell;
  }
  return { metrics };
}
const verdicts = outcome => Object.fromEntries(outcome.questions.map(q => [q.id, q.verdict]));
function numbersOutside(value, allowed, at = '$', out = []) {
  if (typeof value === 'number' && !allowed.has(at)) out.push(at);
  else if (Array.isArray(value)) value.forEach((v, i) => numbersOutside(v, allowed, `${at}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) numbersOutside(v, allowed, `${at}.${k}`, out);
  return out;
}

test('evidence meeting every constraint is promotable, and the outcome carries no combined score', () => {
  const outcome = evaluatePromotion(committed, passingEvidence());
  assert.deepEqual(verdicts(outcome), { Q1: 'pass', Q2: 'pass', Q3: 'pass', Q4: 'pass', Q5: 'pass' });
  assert.equal(outcome.promotable, true);
  assert.equal(outcome.blocksBeta9, false);
  assert.deepEqual(numbersOutside(outcome, new Set(['$.contractVersion'])), []);
});

test('one failed constraint cannot be offset by a large gain elsewhere', () => {
  const evidence = passingEvidence();
  evidence.metrics['ambiguous.twinDiscriminationRate'] = { candidate: 0.99, legacy: 0.1, strata: { family: { a: { candidate: 0.99, legacy: 0.1, support: 50 } }, context: { a: { candidate: 0.99, legacy: 0.1, support: 50 } } } };
  evidence.metrics['corpus.leakedOnlyUnderCandidate'].value = 1;
  const outcome = evaluatePromotion(committed, evidence);
  assert.deepEqual(verdicts(outcome), { Q1: 'pass', Q2: 'pass', Q3: 'fail', Q4: 'pass', Q5: 'pass' });
  assert.equal(outcome.promotable, false);
});

test('a stratum regression fails a gate whose aggregate passes; thin strata are listed, not judged', () => {
  const evidence = passingEvidence();
  const m = evidence.metrics['corpus.leakedSpanRate'];
  m.strata.family.gamma = { candidate: 0.2, legacy: 0.1, support: 50 };
  m.strata.family.delta = { candidate: 0.9, legacy: 0.1, support: 2 };
  const q3 = evaluatePromotion(committed, evidence).questions.find(q => q.id === 'Q3');
  const g = q3.gates.find(x => x.id === 'q3-leaked-span-rate');
  assert.equal(g.verdict, 'fail');
  assert.match(g.reasons.join('\n'), /family:gamma/);
  assert.deepEqual(g.unsupportedStrata, ['family:delta']);
});

test('the beta.9 shape: Q1-Q4 answered, no Q5 evidence, not promotable, beta.9 not blocked', () => {
  const evidence = passingEvidence();
  for (const g of committed.gates.filter(x => x.question === 'Q5')) delete evidence.metrics[g.metric];
  const outcome = evaluatePromotion(committed, evidence);
  assert.deepEqual(verdicts(outcome), { Q1: 'pass', Q2: 'pass', Q3: 'pass', Q4: 'pass', Q5: 'not-evaluated' });
  assert.equal(outcome.promotable, false);
  assert.equal(outcome.blocksBeta9, false);
});

test('a missing required performance dimension or an invalid measurement does not pass', () => {
  let evidence = passingEvidence();
  delete evidence.metrics['performance.budgetOutcome'].strata.dimension.memory;
  assert.equal(evaluatePromotion(committed, evidence).questions.find(q => q.id === 'Q5').verdict, 'not-evaluated');
  evidence = passingEvidence();
  evidence.metrics['size.budgetOutcome'].strata.dimension.size = { value: 'invalid-measurement' };
  assert.equal(evaluatePromotion(committed, evidence).questions.find(q => q.id === 'Q5').verdict, 'fail');
});

test('Q4 is read from the #289 aggregate fields', () => {
  const evidence = passingEvidence();
  Object.assign(evidence.metrics, metricsFromEvasionAggregate(aggregate(), committed));
  assert.equal(evaluatePromotion(committed, evidence).questions.find(q => q.id === 'Q4').verdict, 'pass');

  // A shadow-mode aggregate cannot answer Q4 for a promotion.
  Object.assign(evidence.metrics, metricsFromEvasionAggregate(aggregate('shadow'), committed));
  const shadow = evaluatePromotion(committed, evidence).questions.find(q => q.id === 'Q4');
  assert.equal(shadow.verdict, 'fail');
  assert.deepEqual(shadow.gates.filter(g => g.verdict === 'fail').map(g => g.id), ['q4-evaluated-against-candidate']);

  // One attack class with a promotion-only leak fails the no-new-evasion gate.
  const leaky = aggregate('promotion-candidate', cls => (cls === 'placeholder-wrapping' ? counts({ leakedOnlyUnderCandidate: 1 }) : counts()));
  assert.deepEqual(evasionAggregateProblems(leaky), []);
  Object.assign(evidence.metrics, metricsFromEvasionAggregate(leaky, committed));
  const q4 = evaluatePromotion(committed, evidence).questions.find(q => q.id === 'Q4');
  assert.deepEqual(q4.gates.filter(g => g.verdict === 'fail').map(g => g.id), ['q4-no-new-evasion']);
  assert.match(q4.gates.find(g => g.id === 'q4-no-new-evasion').reasons.join('\n'), /attackClass:placeholder-wrapping/);

  // A class below the variant floor.
  const thin = aggregate('promotion-candidate', cls => (cls === 'periodic-body'
    ? counts({ variants: 10, controls: 0, detectionPreserved: 8, leakedSpans: 1, legacyDetectionPreserved: 8, legacyLeakedSpans: 1, falseAlarms: 0, legacyFalseAlarms: 0 })
    : counts()));
  assert.deepEqual(evasionAggregateProblems(thin), []);
  assert.equal(metricsFromEvasionAggregate(thin, committed)['evasion.attackClassesBelowFloor'].value, 1);
});

test('evidence keyed to another identity is stale', () => {
  const candidate = identityTuple();
  assert.deepEqual(evidenceIdentityProblems(committed, candidate, [{ source: '#289', identity: aggregate().identity }]), []);
  const stale = { ...aggregate().identity, modelFingerprint: '9'.repeat(64) };
  assert.match(evidenceIdentityProblems(committed, candidate, [{ source: '#289', identity: stale }]).join('\n'), /#289: modelFingerprint does not match/);
});
