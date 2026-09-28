/**
 * Score a #425 stress observation into the development evidence report. Deterministic: the committed observation
 * re-scores to the committed report byte for byte, without installing any artifact.
 */
import { STRESS_FAMILIES, scoreSide, stressOracle, stressPlans, validateStressPlans, type ObservedLane, type StressFamily } from './stress.ts';
import { stressIndependence } from './stress.ts';

interface Observation {
  schemaVersion: 1; reportType: 'pii-card-iban-stress-observation'; plansFrozenAt: string; planCommitments: Record<string, string>;
  oracleCommitment: string; platform: string; node: string; candidateManifestVerification: unknown; baselineVerification: string;
  sides: Array<{ side: 'baseline' | 'candidate'; identity: { version: string; sourceCommit: string; components: Record<string, string>; artifactSetCommitment: string };
    families: Array<{ family: string; lanes: Array<ObservedLane & { status: string; artifact: string | null }> }> }>;
}

const correct = (outcome: string) => outcome === 'detected' || outcome === 'absent';

export function buildStressReport(observation: Observation) {
  if (observation.reportType !== 'pii-card-iban-stress-observation' || observation.schemaVersion !== 1) throw new Error('not a #425 stress observation');
  const validation = validateStressPlans();
  for (const result of validation.results)
    if (observation.planCommitments[result.plan.family] !== result.commitment) throw new Error(`observation was taken on a different ${result.plan.family} plan`);
  if (observation.oracleCommitment !== validation.oracleCommitment) throw new Error('observation was taken against a different oracle');
  const oracle = stressOracle();
  const sides = observation.sides.map(side => ({
    side: side.side, identity: side.identity,
    families: side.families.map(entry => {
      const plan = stressPlans[entry.family as StressFamily];
      const observed = entry.lanes.filter(lane => lane.status === 'observed');
      const unavailable = entry.lanes.filter(lane => lane.status !== 'observed').map(lane => ({ lane: lane.lane, selection: lane.selection, status: lane.status }));
      return { ...scoreSide(plan, observed, oracle), unavailableLanes: unavailable };
    }),
  }));
  const primary = (side: typeof sides[number], family: string) => side.families.find(row => row.family === family)!.lanes
    .find(lane => lane.lane === 'node-addon' && lane.selection === 'pii-global-and-us')!;
  const baseline = sides.find(row => row.side === 'baseline')!, candidate = sides.find(row => row.side === 'candidate')!;
  const comparison = STRESS_FAMILIES.map(family => {
    const before = primary(baseline, family).caseOutcomes, after = primary(candidate, family).caseOutcomes;
    return { family, regressions: after.filter((row, index) => correct(before[index].outcome) && !correct(row.outcome)).map(row => row.id),
      improvements: after.filter((row, index) => !correct(before[index].outcome) && correct(row.outcome)).length,
      unchangedIncorrect: after.filter((row, index) => !correct(before[index].outcome) && !correct(row.outcome)).length };
  });
  const summary = sides.flatMap(side => STRESS_FAMILIES.map(family => {
    const lane = primary(side, family), groups = lane.groups as Record<string, Record<string, number>>;
    const scored = side.families.find(row => row.family === family)!;
    return { side: side.side, family, sensitive: `${groups.sensitive.detected ?? 0}/${groups.sensitive.cases}`,
      validatorCorrectness: `${groups['validator-correctness'].absent ?? 0}/${groups['validator-correctness'].cases}`,
      semanticCollision: `${groups['semantic-collision'].absent ?? 0}/${groups['semantic-collision'].cases}`,
      officialTest: `${groups['official-test'].absent ?? 0}/${groups['official-test'].cases}`,
      unsupportedShape: `${groups['unsupported-shape'].absent ?? 0}/${groups['unsupported-shape'].cases}`,
      nonRedactAction: lane.action.nonRedact, valueLeaked: lane.outputLeakage.valueLeakedAfterRedaction,
      collateralOutsideModified: lane.collateral.casesWithOutsideModification, credentialFindings: lane.collateral.credentialFindings,
      crossFamilyNoneExpectedViolations: lane.crossFamily.noneExpectedViolations, crossFamilyFindings: lane.crossFamily.findingsByType,
      surfaceDisagreements: Object.values(scored.parity.surfaceDisagreements).flat().length,
      selectionDependentCases: [...new Set(Object.values(scored.parity.selectionDisagreements).flat())].length, identityOnly: scored.identityOracle.identityOnly.status };
  }));
  return {
    schemaVersion: 1, reportType: 'pii-card-iban-stress-report', supportClaims: false, statusPromotion: false,
    issue: 'redact-secret/redact-secret-benchmarks#425', plansFrozenAt: observation.plansFrozenAt, planCommitments: observation.planCommitments,
    oracleCommitment: observation.oracleCommitment, platform: observation.platform, node: observation.node,
    candidateManifestVerification: observation.candidateManifestVerification, baselineVerification: observation.baselineVerification,
    independence: Object.fromEntries(STRESS_FAMILIES.map(family => [family, stressIndependence(stressPlans[family])])),
    summary, comparison, sides,
  };
}
