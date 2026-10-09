import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { historicalBytes, historicalReplayOptions } from './helpers/historical-evidence-archive.mjs';
import {
  C1_FAMILIES, C1_POPULATION_PLANS, C1_SUPERSEDED_PLANS, c1LedgerAxes, c1PriorPlanCandidates, c1ReferenceSensitivity, compareC1, emailReservedDomain,
  networkReservedAddress, scoreC1Surface, validateC1PopulationPlan,
} from '../benchmarks/evaluation/domains/pii/email-network-population.ts';
import { piiIdentityOracle, piiOraclePlanCommitment } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { PII_GAP_LEDGER_PLANS } from '../benchmarks/evaluation/domains/pii/gap-ledger.ts';

const EVIDENCE = 'evidence/901/424/pii-email-network-population-evidence-v1.json';
const clone = value => JSON.parse(JSON.stringify(value));
const prior = family => c1PriorPlanCandidates(PII_GAP_LEDGER_PLANS[family].plan, piiIdentityOracle.families.find(row => row.family === family));
const rebind = plan => { plan.oracle.planCommitment = piiOraclePlanCommitment(plan.plan); return plan; };
const perfect = plan => plan.plan.cases.map((row, index) => {
  const label = plan.oracle.labels[index];
  return { caseId: row.id, familyFindings: label.sensitivity === 'sensitive' ? [{ ...label.candidate, action: 'redact' }] : [],
    otherPiiFindings: [], credentialFindings: 0, leakedSensitiveSpans: 0, collateralBytes: 0 };
});

test('both #424 population plans validate against the #423 oracle, the contract reference and the ledger backlog', () => {
  for (const family of C1_FAMILIES) {
    const { plan, independence } = validateC1PopulationPlan(C1_POPULATION_PLANS[family].plan, prior(family));
    assert.deepEqual(plan.ledger.axes, c1LedgerAxes(family).map(row => row.id));
    assert.equal(independence.duplicateInputs, 0);
    assert.equal(independence.priorPlanCandidateOverlap, 0);
    assert.ok(independence.distinctSensitiveCandidates >= 30, family);
    assert.ok(independence.koreanSensitive >= 5, family);
    assert.ok(independence.benignAxes.length >= 3, family);
    assert.ok(independence.declaredTwins >= 15, family);
    for (const population of plan.populations) assert.equal(population.strata.reduce((n, row) => n + row.mass, 0), population.totalMass);
  }
});

test('the superseded email plan v1 stays frozen and fails only for its recorded contract reason', () => {
  const successor = C1_POPULATION_PLANS['pii:global:email'].plan;
  const [superseded] = C1_SUPERSEDED_PLANS;
  assert.equal(successor.supersedes.file, superseded.file);
  assert.equal(createHash('sha256').update(readFileSync(superseded.file)).digest('hex'), successor.supersedes.fileSha256);
  assert.equal(superseded.plan.oracle.planCommitment, successor.supersedes.planCommitment);
  assert.throws(() => validateC1PopulationPlan(superseded.plan, prior('pii:global:email')), /not a whole contract candidate/);
  assert.equal(successor.supersedes.corrections.length, 3);
});

test('a label that contradicts the frozen contract is rejected, never adjusted', () => {
  const plan = clone(C1_POPULATION_PLANS['pii:global:email'].plan);
  const index = plan.plan.cases.findIndex(row => row.id === 'email-n-for-example');
  // Promote a named-negative case to sensitive consistently everywhere except the contract reference.
  plan.plan.cases[index].expected = { publicFinding: true, sensitive: true, ...plan.oracle.labels[index].candidate, action: 'redact' };
  plan.plan.cases[index].stratum = 'email-positive-independent'; plan.plan.cases[index].axis = 'email-independent-sensitive-positives';
  plan.plan.cases[index].views = ['diagnostic-balanced'];
  plan.oracle.labels[index] = { ...plan.oracle.labels[index], sensitivity: 'sensitive', sensitivityBasis: ['contract-context-rule'] };
  assert.throws(() => validateC1PopulationPlan(rebind(plan), prior('pii:global:email')), /contract reference/);
});

test('plan binding, mass, twins and independence are enforced', () => {
  const family = 'pii:global:network-address';
  const base = C1_POPULATION_PLANS[family].plan;
  const unbound = clone(base); unbound.plan.cases[0].input += ' '; // commitment no longer matches
  assert.throws(() => validateC1PopulationPlan(unbound, prior(family)), /not bound/);
  const mass = clone(base); mass.populations[1].strata[0].mass += 1; mass.populations[1].strata[0].notEstablishedMass += 1;
  assert.throws(() => validateC1PopulationPlan(mass, prior(family)), /mass/);
  const heavy = clone(base);
  const sensitiveRow = heavy.populations[1].strata.find(row => row.sensitiveMass > 0), benignRow = heavy.populations[1].strata.find(row => row.sensitiveMass === 0);
  const shift = benignRow.mass - 1; benignRow.mass -= shift; benignRow.notEstablishedMass = Math.max(0, benignRow.notEstablishedMass - shift);
  benignRow.nonSensitiveMass = benignRow.mass - benignRow.notEstablishedMass; sensitiveRow.mass += shift; sensitiveRow.sensitiveMass += shift;
  assert.throws(() => validateC1PopulationPlan(heavy, prior(family)));
  const twin = clone(base); twin.plan.cases.find(row => row.twinOf).twinProperty = 'two-things-at-once';
  assert.throws(() => validateC1PopulationPlan(rebind(twin), prior(family)), /twin/);
  const reuse = clone(C1_POPULATION_PLANS['pii:global:email'].plan);
  assert.throws(() => validateC1PopulationPlan(reuse, ['dara.venn@q3v9k.synthetic']), /independence/);
});

test('authority-reserved controls and the association reference follow the frozen contract text', () => {
  assert.equal(emailReservedDomain('a@sub.EXAMPLE.com'), true);
  assert.equal(emailReservedDomain('a@example.com.synthetic'), false);
  assert.equal(emailReservedDomain('a@notlocalhost.synthetic'), false);
  for (const value of ['192.0.2.1', '198.19.255.255', '::ffff:127.0.0.1', '3fff:fff::1', 'ff0e::1', '::', '255.255.255.255'])
    assert.equal(networkReservedAddress(value), true, value);
  for (const value of ['198.20.0.1', '3fff:1000::1', '::ffff:10.0.0.1', '240.0.0.1', '2001:db9::1', '100.64.0.1'])
    assert.equal(networkReservedAddress(value), false, value);
  const at = (input, value) => { const start = Buffer.byteLength(input.slice(0, input.lastIndexOf(value))); return { start, end: start + Buffer.byteLength(value) }; };
  const email = 'pii:global:email', net = 'pii:global:network-address';
  assert.equal(c1ReferenceSensitivity(email, 'email: a@b.synthetic', at('email: a@b.synthetic', 'a@b.synthetic')).sensitivity, 'sensitive');
  assert.equal(c1ReferenceSensitivity(email, 'email address: a@b.synthetic', at('email address: a@b.synthetic', 'a@b.synthetic')).sensitivity, 'not-established');
  assert.equal(c1ReferenceSensitivity(email, 'contact a@b.synthetic', at('contact a@b.synthetic', 'a@b.synthetic')).sensitivity, 'not-established');
  assert.equal(c1ReferenceSensitivity(net, 'IP 주소: 10.0.0.9', at('IP 주소: 10.0.0.9', '10.0.0.9')).sensitivity, 'not-established');
  const dense = 'ip: 10.0.0.1 ip: 10.0.0.2';
  const first = at(dense, '10.0.0.1'), second = at(dense, '10.0.0.2');
  assert.equal(c1ReferenceSensitivity(net, dense, second, [{ ...first, domain: 'network-address', sensitivity: 'sensitive' }]).sensitivity, 'not-established');
  assert.equal(c1ReferenceSensitivity(net, dense, first, [{ ...second, domain: 'network-address', sensitivity: 'not-established' }]).sensitivity, 'sensitive');
});

test('scoring keeps sensitivity, action-split false alarms, output leakage/collateral and unsupported syntax apart', () => {
  const plan = C1_POPULATION_PLANS['pii:global:email'].plan;
  const clean = scoreC1Surface(plan, perfect(plan));
  for (const view of clean.views) {
    assert.equal(view.sensitivity.sensitive.detected, view.sensitivity.sensitive.cases);
    assert.equal(view.sensitivity.nonSensitive.falseAlarm + view.sensitivity.notEstablished.falseAlarm, 0);
    assert.equal(view.identity.status, 'not-measured');
    assert.equal(view.output.leakedCases + view.output.collateralCases, 0);
  }
  const noisy = perfect(plan);
  const reserved = plan.plan.cases.findIndex(row => row.id === 'email-r-example-com');
  noisy[reserved].familyFindings = [{ ...plan.oracle.labels[reserved].candidate, action: 'mask' }]; noisy[reserved].collateralBytes = 5;
  const positive = plan.plan.cases.findIndex(row => row.id === 'email-p-plain-label');
  noisy[positive].familyFindings = []; noisy[positive].leakedSensitiveSpans = 1;
  const scored = scoreC1Surface(plan, noisy), diagnostic = scored.views.find(row => row.view === 'diagnostic-balanced');
  assert.equal(diagnostic.sensitivity.nonSensitive.falseAlarm, 1);
  assert.deepEqual(diagnostic.falseAlarmsByAction, { mask: 1 });
  assert.equal(diagnostic.output.leakedCases, 1);
  assert.equal(diagnostic.output.collateralCases, 1);
  assert.equal(diagnostic.sensitivity.sensitive.missed, 1);
  const comparison = compareC1(clean, scored);
  assert.deepEqual(comparison.map(row => row.verdict), ['regression', 'regression']);
  assert.throws(() => scoreC1Surface(plan, noisy.slice(1)), /incomplete/);
});

test('the committed #424 evidence binds the frozen plans, stays input-free and never promotes', historicalReplayOptions, () => {
  const text = historicalBytes(EVIDENCE).toString('utf8'), report = JSON.parse(text);
  assert.equal(report.supportClaims, false);
  assert.equal(report.benchmark.dirty, false);
  assert.deepEqual(report.releases.map(row => row.role), ['baseline', 'candidate']);
  assert.equal(report.releases[1].version, '0.1.0-beta.10');
  for (const family of C1_FAMILIES) {
    const plan = C1_POPULATION_PLANS[family].plan, row = report.families.find(item => item.family === family);
    assert.equal(row.planCommitment, plan.oracle.planCommitment);
    assert.equal(row.supportState, 'pending');
    assert.equal(row.identityOnly.status, 'not-measured');
    assert.ok(row.reasonCodes.includes('identity-only-classification'));
    plan.oracle.labels.forEach((label, index) => {
      if (!label.candidate) return;
      const value = Buffer.from(plan.plan.cases[index].input, 'utf8').subarray(label.candidate.start, label.candidate.end).toString('utf8');
      assert.equal(text.includes(value), false, 'evidence must not carry candidate values');
    });
  }
});
