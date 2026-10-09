// Historical raw-observation publication is an explicit bounded oracle, never the current producer.
import { buildPiiSupportMatrixV2 as build, validatePiiSupportMatrixV2 as validate,
  type PiiSupportBuildOptions, type PiiSupportMatrixV2, type PopulationInput, type PopulationComparisonInput } from './support-v2.ts';
import { validatePiiPopulationReport, comparePiiPopulationReports, piiPopulationContract } from './populations.ts';
import { piiBenignCollisionEvidence } from './benign-collision-evidence.ts';

function comparisonProjection(input: PopulationComparisonInput) {
  const contract = input.contract ?? piiPopulationContract, evidence = input.evidence ?? piiBenignCollisionEvidence;
  const comparison = comparePiiPopulationReports(input.baseline, input.candidate, {
    contract, evidence, baselineRows: input.baselineRows, candidateRows: input.candidateRows, options: input.validation,
  });
  const limit = input.baseline.regressionPolicy.maxAbsoluteIncrease;
  return { id: comparison.population, status: 'compared' as const, contractCommitment: comparison.contractCommitment,
    corpusCommitment: comparison.corpusCommitment,
    baselineObservation: { reportCommitment: comparison.baselineReportCommitment, candidateArtifactHash: comparison.baselineArtifactHash! },
    candidateObservation: { reportCommitment: comparison.candidateReportCommitment, candidateArtifactHash: comparison.candidateArtifactHash! },
    verdict: comparison.verdict as 'not-measured' | 'no-regression' | 'regression',
    benignFalseAlarmDeltas: comparison.deltas.map(({ baseline, candidate, ...row }) => ({ ...row,
      baselineRate: baseline, candidateRate: candidate, limit, regressed: row.delta !== null && row.delta > limit })),
    diagnosticDeltas: comparison.diagnosticDeltas.map(row => {
      const key = row.axis === 'type-identity' ? 'typeIdentity' : row.axis === 'validator-correctness' ? 'validatorCorrectness' : 'contextDiscrimination';
      const applicable = input.baseline.diagnostics[key].eligible > 0;
      const { baseline, candidate, ...delta } = row;
      return { ...delta, baselineRate: baseline, candidateRate: candidate,
        baselineFailed: input.baseline.diagnostics[key].failed, candidateFailed: input.candidate.diagnostics[key].failed, applicable,
        regressed: applicable && row.delta !== null && (row.delta < 0 || row.failedDelta > 0) };
    }),
  };
}

const boundedOracle = {
  population(input: PopulationInput) {
    return validatePiiPopulationReport(input.report, input.contract ?? piiPopulationContract,
      input.evidence ?? piiBenignCollisionEvidence, input.validation, input.rows);
  },
  comparison: comparisonProjection,
};
export function buildPiiSupportMatrixV2(options: PiiSupportBuildOptions = {}): PiiSupportMatrixV2 {
  return build({ ...options, boundedOracle });
}
export function validatePiiSupportMatrixV2(value: unknown, bindings?: PiiSupportBuildOptions): PiiSupportMatrixV2 {
  return validate(value, bindings ? { ...bindings, boundedOracle } : undefined);
}
