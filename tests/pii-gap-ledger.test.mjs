import { historicalJson, historicalReplayOptions } from './helpers/historical-evidence-archive.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PII_GAP_LEDGER_CATEGORIES, PII_GAP_LEDGER_FAMILIES, PII_GAP_LEDGER_FAMILY_GROUP_OWNER, PII_GAP_LEDGER_PLANS,
  piiGapLedgerCommitment, piiGapLedgerFileDrift, piiPlanIndependence, validatePiiGapLedger,
} from '../benchmarks/evaluation/domains/pii/gap-ledger.ts';

const LEDGER = 'evidence/901/pii-gap-ledger-v1.json';
const load = async () => historicalJson(LEDGER);
const recommit = ledger => { ledger.contentCommitment = piiGapLedgerCommitment(ledger); return ledger; };
const blocker = (ledger, family, category) =>
  ledger.families.find(row => row.family === family).blockers.find(row => row.category === category);

test('the committed #422 ledger validates and every file it freezes is unchanged', historicalReplayOptions, async () => {
  const ledger = validatePiiGapLedger(await load());
  assert.deepEqual(ledger.families.map(row => row.family), [...PII_GAP_LEDGER_FAMILIES]);
  for (const row of ledger.families) {
    assert.deepEqual(row.blockers.map(entry => entry.category), [...PII_GAP_LEDGER_CATEGORIES]);
    assert.equal(row.supportState, 'pending');
    assert.ok(ledger.axisBacklog.some(axis => axis.family === row.family && axis.owner === PII_GAP_LEDGER_FAMILY_GROUP_OWNER[row.family]));
  }
  assert.deepEqual(await piiGapLedgerFileDrift(ledger, process.env.HYGIENE_ORIGINAL_SOURCE_ROOT), []);
});

test('the ledger binds one final candidate and never a mix of per-family merge commits', historicalReplayOptions, async () => {
  const ledger = await load();
  assert.equal(ledger.finalCandidate.status, 'identified');
  assert.equal(ledger.finalCandidate.piiEvidenceBound, false);
  assert.equal(new Set(ledger.priorEvidence.filter(row => row.kind === 'family-qualification').map(row => row.productSourceCommit)).size, 6);
  for (const row of ledger.families) assert.notEqual(blocker(ledger, row.family, 'exact-candidate-binding').status, 'passed');

  const passed = await load();
  blocker(passed, 'pii:global:phone', 'exact-candidate-binding').status = 'passed';
  blocker(passed, 'pii:global:phone', 'exact-candidate-binding').classification = 'none';
  assert.throws(() => validatePiiGapLedger(recommit(passed)), /cannot pass while the final candidate carries no PII evidence/);

  const mislabelled = await load();
  mislabelled.priorEvidence[0].boundToFinalCandidate = true;
  assert.throws(() => validatePiiGapLedger(recommit(mislabelled)), /misstates its binding/);
});

test('the five blocker states cannot stand in for each other', historicalReplayOptions, async () => {
  const cases = [
    ['not-measured', 'none', /cannot be not-measured with classification none/],
    ['passed', 'measurement-gap', /cannot be passed with classification measurement-gap/],
    ['failed', 'none', /cannot be failed with classification none/],
    ['not-run', 'evaluator-observability', /cannot be not-run with classification evaluator-observability/],
  ];
  for (const [status, classification, error] of cases) {
    const ledger = await load();
    Object.assign(blocker(ledger, 'pii:global:email', 'protected-partition'), { status, classification, evidence: ['evidence/876'] });
    assert.throws(() => validatePiiGapLedger(recommit(ledger)), error);
  }
  const notApplicable = await load();
  Object.assign(blocker(notApplicable, 'pii:global:iban', 'protected-partition'), { status: 'not-applicable', classification: 'non-goal' });
  assert.throws(() => validatePiiGapLedger(recommit(notApplicable)), /not-applicable without a non-goal decision/);
});

test('every unresolved blocker has an owning issue or explicit decision', historicalReplayOptions, async () => {
  const ledger = await load();
  for (const row of ledger.families) for (const entry of row.blockers)
    if (entry.status !== 'passed') assert.notEqual(entry.owner, 'none', `${row.family}/${entry.category}`);
  const orphan = await load();
  blocker(orphan, 'pii:global:network-address', 'identity-only-observability').owner = 'none';
  assert.throws(() => validatePiiGapLedger(recommit(orphan)), /has no owner/);
});

test('fixture corrections and product defects stay separate and fully referenced', historicalReplayOptions, async () => {
  const ledger = await load();
  assert.deepEqual(ledger.families.flatMap(row => row.productDefects), []);
  assert.ok(ledger.evaluatorFindings.every(finding => finding.productDefect === false));
  const ssn = ledger.families.find(row => row.family === 'pii:us:ssn');
  assert.deepEqual(ssn.fixtureCorrections, ['ssn-placeholder-control-408-411']);
  assert.equal(ledger.corrections[0].rewritesPriorEvidence, false);

  const defect = await load();
  Object.assign(blocker(defect, 'pii:global:phone', 'benign-false-positive'), { status: 'failed', classification: 'product-defect' });
  assert.throws(() => validatePiiGapLedger(recommit(defect)), /product defect and core issue must appear together/);
  blocker(defect, 'pii:global:phone', 'benign-false-positive').coreIssue = 999999;
  assert.throws(() => validatePiiGapLedger(recommit(defect)), /not listed on its family row/);

  const unrecorded = await load();
  Object.assign(blocker(unrecorded, 'pii:global:email', 'contract-fixture-discrepancy'), { status: 'failed', classification: 'fixture-correction' });
  assert.throws(() => validatePiiGapLedger(recommit(unrecorded)), /fixture correction has no recorded correction/);
});

test('independence metrics reproduce from the plans the immutable records bound', historicalReplayOptions, async () => {
  const ledger = await load();
  for (const row of ledger.families) {
    const prior = ledger.priorEvidence.find(entry => entry.id === row.evidence);
    assert.equal(row.independence.plan.planCommitment, prior.planCommitment);
    assert.deepEqual(row.independence.plan, piiPlanIndependence(row.family));
  }
  const inflated = await load();
  inflated.families[3].independence.plan.distinctPositiveSpans += 4;
  assert.throws(() => validatePiiGapLedger(recommit(inflated)), /do not reproduce from the frozen plan/);
  const inflatedPopulation = await load();
  inflatedPopulation.populationBeforeState.audit.declaredTwins = 3;
  assert.throws(() => validatePiiGapLedger(recommit(inflatedPopulation)), /Population audit does not reproduce/);
});

test('the ledger is input-free and commitment-bound', historicalReplayOptions, async () => {
  const [family] = Object.keys(PII_GAP_LEDGER_PLANS);
  const positive = PII_GAP_LEDGER_PLANS[family].plan.cases.find(row => row.expected.publicFinding);
  const leaked = await load();
  blocker(leaked, family, 'benign-false-positive').detail = `Observed ${positive.input} in a log line.`;
  assert.throws(() => validatePiiGapLedger(recommit(leaked)), /raw case value/);
  const unsafe = await load();
  unsafe.families[0].nonGoals.push({ id: 'x', basis: 'y' });
  unsafe.families[0].nonGoals.at(-1).candidate = 'z';
  assert.throws(() => validatePiiGapLedger(recommit(unsafe)), /schema/);
  const tampered = await load();
  tampered.axisBacklog[0].detail = 'Edited after freeze.';
  assert.throws(() => validatePiiGapLedger(tampered), /commitment mismatch/);
});

test('the axis backlog is contiguous and owned by the matching family-group child', historicalReplayOptions, async () => {
  const ledger = await load();
  assert.deepEqual(ledger.axisBacklog.map(axis => axis.order), ledger.axisBacklog.map((_, index) => index + 1));
  const misrouted = await load();
  misrouted.axisBacklog[0].owner = '#425';
  assert.throws(() => validatePiiGapLedger(recommit(misrouted)), /owned outside its family group/);
  const gap = await load();
  gap.axisBacklog = gap.axisBacklog.filter(axis => axis.family !== 'pii:global:iban').map((axis, index) => ({ ...axis, order: index + 1 }));
  assert.throws(() => validatePiiGapLedger(recommit(gap)), /pii:global:iban has no backlog axis/);
});
