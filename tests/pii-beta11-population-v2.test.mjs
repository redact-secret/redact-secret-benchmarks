// Beta.11 PII E (#428): the pii-context/v2 population plan set closes the interim population gaps without editing a frozen plan.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { B11_V2_PLAN_FILES, buildC1PlanV2, serializeB11V2Plan } from '../benchmarks/evaluation/domains/pii/beta11-population-v2.ts';
import {
  C1_FAMILIES, C1_POPULATION_PLANS, C1_POPULATION_PLANS_V2, c1PriorPlanCandidates, c1ReferenceSensitivity, emailWholeCandidate, validateC1PopulationPlan,
} from '../benchmarks/evaluation/domains/pii/email-network-population.ts';
import { STRESS_FAMILIES, stressCommitment, stressOracleFamiliesV2, stressPlans, stressPlansV2, validateStressPlan } from '../benchmarks/evaluation/domains/pii/card-iban-stress/stress.ts';
import { STRESS_PLAN_FILES } from '../benchmarks/evaluation/domains/pii/card-iban-stress/authoring.ts';
import { c3Files, c3FilesV3, validateC3File } from '../benchmarks/evaluation/domains/pii/ssn-phone-stress.ts';
import { PII_GAP_LEDGER_PLANS } from '../benchmarks/evaluation/domains/pii/gap-ledger.ts';
import { piiIdentityOracle, piiOraclePlanCommitment } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { B11_CURRENT_PLAN_SET, B11_FAMILIES, B11_PLAN_SETS, b11CaseTables, b11ObservedRanges, b11Revisions, b11ScoreTable, b11ViewGate }
  from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { B11_FREEZE_FILES, b11FreezeFiles } from '../benchmarks/evaluation/domains/pii/beta11-disposition.ts';

const root = new URL('../', import.meta.url);
const sha256 = file => createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex');
const ledger = JSON.parse(readFileSync(new URL('evidence/901/pii-gap-ledger-v1.json', root), 'utf8'));
const corrections = JSON.parse(readFileSync(new URL('evidence/901/426/pii-c3-reviewed-corrections-v1.json', root), 'utf8')).corrections;
const prior = family => c1PriorPlanCandidates(PII_GAP_LEDGER_PLANS[family].plan, piiIdentityOracle.families.find(row => row.family === family));
const at = (input, text) => { const start = Buffer.byteLength(input.slice(0, input.indexOf(text))); return { start, end: start + Buffer.byteLength(text) }; };
const planOf = family => family === 'pii:global:email' || family === 'pii:global:network-address' ? C1_POPULATION_PLANS_V2[family].plan :
  family === 'pii:global:payment-card' || family === 'pii:global:iban' ? stressPlansV2[family] : c3FilesV3[family].file;
const predecessorCases = family => family === 'pii:global:email' || family === 'pii:global:network-address' ? C1_POPULATION_PLANS[family].plan.plan.cases :
  family === 'pii:global:payment-card' || family === 'pii:global:iban' ? stressPlans[family].cases : c3Files[family].file.cases;
const planCases = family => family === 'pii:global:email' || family === 'pii:global:network-address' ? planOf(family).plan.cases : planOf(family).cases;

test('the v2 plan set is the current one and regenerates byte for byte from its authored truth', () => {
  assert.equal(B11_CURRENT_PLAN_SET, 'b11-population-v2');
  for (const [family, file] of Object.entries(B11_V2_PLAN_FILES)) assert.equal(readFileSync(new URL(file, root), 'utf8'), serializeB11V2Plan(family), file);
  // The interim plan set and its freeze file list are unchanged.
  assert.deepEqual(B11_PLAN_SETS['b11-population-v1'].populationPlanFiles, Object.fromEntries(B11_FAMILIES.map(family =>
    [family, B11_FREEZE_FILES.benchmarkInputs.find(file => file === B11_PLAN_SETS['b11-population-v1'].populationPlanFiles[family])])));
  const v2Inputs = b11FreezeFiles('b11-population-v2').benchmarkInputs;
  for (const file of [...B11_FREEZE_FILES.benchmarkInputs, ...Object.values(B11_V2_PLAN_FILES)]) assert.ok(v2Inputs.includes(file), file);
});

test('every v2 plan validates with its family validator, the #423 oracle rules and the independence checks', () => {
  for (const family of C1_FAMILIES) {
    const { independence } = validateC1PopulationPlan(C1_POPULATION_PLANS_V2[family].plan, prior(family));
    assert.equal(independence.duplicateInputs, 0);
    assert.equal(independence.priorPlanCandidateOverlap, 0);
    assert.ok(independence.distinctSensitiveCandidates >= 30 && independence.koreanSensitive >= 5 && independence.declaredTwins >= 15, family);
  }
  for (const family of STRESS_FAMILIES) validateStressPlan(stressPlansV2[family]);
  assert.equal(stressOracleFamiliesV2().length, 2);
  for (const [family, { file, path }] of Object.entries(c3FilesV3)) {
    const { independence } = validateC3File(file, ledger.axisBacklog, path);
    assert.equal(independence.v1CandidateReuse, 0, family);
    assert.ok(independence.dominantCandidateShare <= 0.15, family);
  }
});

test('each v2 plan keeps its frozen predecessor, and relabels exactly the pre-registered revisions and corrections', () => {
  const expected = family => [...b11Revisions.revisions.filter(row => row.family === family).map(row => row.caseId),
    ...corrections.filter(row => row.family === family).map(row => row.caseId)].sort();
  for (const family of B11_FAMILIES) {
    const plan = planOf(family), derived = plan.derivedFrom;
    const predecessorFile = { ...Object.fromEntries(C1_FAMILIES.map(item => [item, C1_POPULATION_PLANS[item].file])), ...STRESS_PLAN_FILES,
      ...Object.fromEntries(Object.entries(c3Files).map(([item, row]) => [item, row.path])) }[family];
    assert.equal(derived.file, predecessorFile);
    assert.equal(derived.fileSha256, sha256(predecessorFile), `${family} predecessor file changed`);
    assert.equal(derived.planCommitment, family in C1_POPULATION_PLANS ? C1_POPULATION_PLANS[family].plan.oracle.planCommitment :
      family in stressPlans ? stressCommitment(stressPlans[family]) : c3Files[family].file.frozen.planCommitment);
    assert.deepEqual(derived.relabeled.map(row => row.caseId).sort(), expected(family), family);
    const cases = planCases(family), ids = new Set(cases.map(row => row.id));
    for (const row of predecessorCases(family)) assert.ok(ids.has(row.id), `${family} dropped ${row.id}`);
    assert.equal(cases.length, predecessorCases(family).length + derived.addedCases.length);
    // No appended case depends on redact-secret#940 (a label right after `|`).
    for (const row of cases.filter(item => derived.addedCases.includes(item.id))) assert.ok(!(row.input ?? `${row.prefix}${row.suffix}`).includes('|'), row.id);
  }
});

test('the v2 contract reference encodes #924, #926 and #927 and rejects a label that contradicts it', () => {
  const net = 'pii:global:network-address', email = 'pii:global:email';
  // #927: ASCII case in a Korean label folds only under v2.
  assert.equal(c1ReferenceSensitivity(net, 'Ip 주소: 10.77.3.21', at('Ip 주소: 10.77.3.21', '10.77.3.21')).sensitivity, 'not-established');
  assert.equal(c1ReferenceSensitivity(net, 'Ip 주소: 10.77.3.21', at('Ip 주소: 10.77.3.21', '10.77.3.21'), [], 'pii-context/v2').sensitivity, 'sensitive');
  assert.equal(c1ReferenceSensitivity(email, 'EMAIL ADDRESS: t@h.synthetic', at('EMAIL ADDRESS: t@h.synthetic', 't@h.synthetic'), [], 'pii-context/v2').sensitivity, 'sensitive');
  // #924: a field label is compared only with the values that follow it; the next dense value stays unassociated.
  const dense = 'ip: 10.52.3.1 10.52.3.2', first = at(dense, '10.52.3.1'), second = at(dense, '10.52.3.2');
  assert.equal(c1ReferenceSensitivity(net, dense, second, [{ ...first, domain: 'network-address', sensitivity: 'sensitive' }], 'pii-context/v2').sensitivity, 'not-established');
  const bare = 'c.west@z9k4m.synthetic email: d.east@z9k4m.synthetic';
  const other = [{ ...at(bare, 'c.west@z9k4m.synthetic'), domain: 'email', sensitivity: 'not-established' }];
  assert.equal(c1ReferenceSensitivity(email, bare, at(bare, 'd.east@z9k4m.synthetic'), other).sensitivity, 'not-established');
  assert.equal(c1ReferenceSensitivity(email, bare, at(bare, 'd.east@z9k4m.synthetic'), other, 'pii-context/v2').sensitivity, 'sensitive');
  // A natural-language label between two values is still equidistant under v2.
  const between = 'a.lund@k8r2p.synthetic contact details b.lund@k8r2p.synthetic';
  assert.equal(c1ReferenceSensitivity(email, between, at(between, 'b.lund@k8r2p.synthetic'),
    [{ ...at(between, 'a.lund@k8r2p.synthetic'), domain: 'email', sensitivity: 'not-established' }], 'pii-context/v2').sensitivity, 'not-established');
  // #926: only a reviewed email label key splits at `=`; `user.email=` stays local-part syntax.
  assert.equal(emailWholeCandidate('email=k.ruiz@d7w3p.synthetic', at('email=k.ruiz@d7w3p.synthetic', 'k.ruiz@d7w3p.synthetic'), 'pii-context/v2'), true);
  assert.equal(emailWholeCandidate('email=k.ruiz@d7w3p.synthetic', at('email=k.ruiz@d7w3p.synthetic', 'k.ruiz@d7w3p.synthetic')), false);
  assert.equal(emailWholeCandidate('user.email=k.ruiz@d7w3p.synthetic', at('user.email=k.ruiz@d7w3p.synthetic', 'k.ruiz@d7w3p.synthetic'), 'pii-context/v2'), false);
  // An authoring slip on a new v2 case fails the plan check instead of reaching a scan.
  const plan = structuredClone(buildC1PlanV2(net));
  const index = plan.plan.cases.findIndex(row => row.id === 'net-l-upper-ip-address-example');
  plan.plan.cases[index] = { ...plan.plan.cases[index], stratum: 'net-v2-korean-ascii-case-label',
    expected: { publicFinding: true, sensitive: true, ...plan.oracle.labels[index].candidate, action: 'redact' } };
  plan.oracle.labels[index] = { ...plan.oracle.labels[index], sensitivity: 'sensitive', sensitivityBasis: ['contract-context-rule'] };
  plan.oracle.planCommitment = piiOraclePlanCommitment(plan.plan);
  assert.throws(() => validateC1PopulationPlan(plan, prior(net)), /contract reference/);
});

test('under a conforming observation every family meets both population gates, with no mass on undecided cases', () => {
  for (const family of B11_FAMILIES) {
    const { frozen, reviewed } = b11CaseTables(family, 'b11-population-v2'), ranges = b11ObservedRanges(family, 'b11-population-v2');
    assert.deepEqual(frozen.map(row => [row.id, row.sensitivity, row.expectedFinding]), reviewed.map(row => [row.id, row.sensitivity, row.expectedFinding]));
    const lane = on => ({ cases: reviewed.map((row, index) => ({ id: row.id, family: on && row.scored && row.sensitivity === 'sensitive' ?
      [[row.candidate.start, row.candidate.end, 'redact']] : [], otherPii: [], otherPiiAtTarget: false, credential: 0,
    ranges: ranges[index].map(range => [range.start, range.end, false]), outsidePreserved: true, scanRedactAgree: true })) });
    const score = b11ScoreTable(family, reviewed, lane(true), family === 'pii:us:ssn' ? lane(false) : null);
    for (const id of ['diagnostic-balanced', 'benign-heavy-stress']) {
      const view = score.views.find(row => row.view === id);
      assert.deepEqual(b11ViewGate(view), { status: 'met', reasons: [] }, `${family} ${id}`);
      assert.equal(view.unscoredCases, 0, `${family} ${id} has contract-silent mass`);
      assert.ok(view.sensitive.cases >= 4, `${family} ${id} sensitive`);
      assert.ok(view.twinPairs >= 4, `${family} ${id} twins`);
      for (const metric of view.metrics) assert.ok(metric.status === 'met' || (metric.status === 'not-applicable' && metric.id === 'non-sensitive-flag-rate' &&
        ['pii:global:iban', 'pii:us:ssn'].includes(family)), `${family} ${id} ${metric.id} ${metric.status}`);
    }
  }
  // Declared mass: every massed C1 stratum has an authored v2 member in that view.
  for (const family of C1_FAMILIES) {
    const plan = C1_POPULATION_PLANS_V2[family].plan;
    for (const population of plan.populations) for (const row of population.strata)
      assert.ok(plan.plan.cases.some(item => item.stratum === row.stratum && item.views.includes(population.id)), `${population.id}/${row.stratum}`);
  }
});
