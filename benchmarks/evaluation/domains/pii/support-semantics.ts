import { isPiiJurisdiction } from './jurisdictions.ts';
import trustedBindings from './trusted-product-bindings-v1.json';

export const PII_SUPPORT_REGISTRY_SOURCE = Object.freeze({
  repository: 'redact-secret/redact-secret' as const,
  decision: 'decision-define-pii-v1-qualification-and-national-id-arrival-gates' as const,
  mergeCommit: 'eb22bdf587e0079e101fc3ab5aeefada58ba438d' as const,
});
const populationIds = ['benign-heavy-stress', 'diagnostic-balanced'] as const;
const pendingPopulationIdentities = [
  { id: 'benign-heavy-stress', status: 'not-measured', contractCommitment: '6bcd6db3f1779f81b8b0f976797c16bcca6e63a563d2888223c58ff87213d162', corpusCommitment: 'f027c8a63b6356932e759bae52037a2862e331bcc37e578c19dbbf816e06eeff', reportCommitment: '9e237095ffa483b80c2894432330555dc93fb1418d61f51b5f89d05e7bd1945c' },
  { id: 'diagnostic-balanced', status: 'not-measured', contractCommitment: '6bcd6db3f1779f81b8b0f976797c16bcca6e63a563d2888223c58ff87213d162', corpusCommitment: 'f027c8a63b6356932e759bae52037a2862e331bcc37e578c19dbbf816e06eeff', reportCommitment: 'e87ce05e3a59a98e0eb32a16ab7773dbd3758dda93ac8cf59c65161b829b65c9' },
] as const;
const selector = (family: string) => `pii:family:${family.slice('pii:'.length)}`;
const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const locator = (value: unknown) => typeof value === 'string' && /^(?:https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9._~!$&'()*+,;=:@\/-]+|(?:section|clause|annex):[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119})$/.test(value);
const authoritySupports = ['lexical', 'validation', 'allocation', 'reserved-control', 'sensitivity'];
const diagnosticAxes = ['type-identity', 'validator-correctness', 'context-discrimination'] as const;
const arithmetic = (baseline: any, candidate: any, delta: any) => {
  if (baseline === null || candidate === null) return delta === null;
  return typeof baseline === 'number' && typeof candidate === 'number' && typeof delta === 'number' && delta === candidate - baseline;
};

export function piiSupportRegistryProjection(matrix: any) {
  return { schemaVersion: 1, id: 'pii-support-registry-v1', version: 1, source: PII_SUPPORT_REGISTRY_SOURCE,
    families: matrix.families.map(({ activation: _activation, status: _status, populationEvidence: _populationEvidence,
      qualificationArtifactCommitment: _qualificationArtifactCommitment, ...family }: any) => family) };
}

/** Browser-safe semantic checks shared with the Node producer; schema and cryptographic commitments are checked separately. */
export function piiSupportSemanticProblem(matrix: any, options: { allowBoundPopulationEvidence?: boolean } = {}): string | null {
  if (!['not-measured', 'trusted'].includes(matrix.activationContract?.productArtifact)) return 'PII activation identity is invalid';
  const trustedProduct = matrix.activationContract.productArtifact === 'trusted';
  const bound = [matrix.activationContract.productArtifactCommitment, matrix.activationContract.candidateEvidenceCommitment,
    matrix.activationContract.activationArtifactCommitment];
  if (trustedProduct ? (!/^[a-f0-9]{40}$/.test(matrix.activationContract.productSourceCommit) || bound.some(value => !/^[a-f0-9]{64}$/.test(value))) :
    (matrix.activationContract.productSourceCommit !== null || bound.some(value => value !== null))) return 'PII product artifact binding is incomplete';
  const sanctioned = trustedProduct ? trustedBindings.bindings.find(binding =>
    binding.product.sourceCommit === matrix.activationContract.productSourceCommit &&
    binding.product.artifactCommitment === matrix.activationContract.productArtifactCommitment &&
    binding.product.candidateEvidenceCommitment === matrix.activationContract.candidateEvidenceCommitment &&
    binding.activationArtifactCommitment === matrix.activationContract.activationArtifactCommitment) : null;
  if (trustedProduct && !sanctioned) return 'PII product artifact binding is not repository-sanctioned';
  if (!Array.isArray(matrix.populationReports) || JSON.stringify(matrix.populationReports.map((row: any) => row.id)) !== JSON.stringify(populationIds) ||
      matrix.populationReports.some((row: any) => !['measured', 'partial', 'not-measured'].includes(row.status)) ||
      new Set(matrix.populationReports.map((row: any) => row.contractCommitment)).size !== 1 ||
      new Set(matrix.populationReports.map((row: any) => row.corpusCommitment)).size !== 1)
    return 'PII support populations are not canonical or do not share one source';
  const top = new Map<string, any>(matrix.populationReports.map((row: any) => [row.id, row]));
  if (!Array.isArray(matrix.populationComparisons) ||
      JSON.stringify(matrix.populationComparisons.map((row: any) => row.id)) !== JSON.stringify(populationIds))
    return 'PII population comparisons are not canonical';
  for (const comparison of matrix.populationComparisons) {
    const report = top.get(comparison.id);
    if (!report || comparison.contractCommitment !== report.contractCommitment || comparison.corpusCommitment !== report.corpusCommitment)
      return 'PII population comparison does not bind the published report';
    if (comparison.status === 'not-measured') {
      if (comparison.baselineObservation !== null || comparison.candidateObservation !== null || comparison.verdict !== 'not-measured' ||
          comparison.benignFalseAlarmDeltas.length || comparison.diagnosticDeltas.length)
        return 'PII not-measured comparison is not canonical';
      continue;
    }
    if (comparison.status !== 'compared' || !comparison.baselineObservation || !comparison.candidateObservation ||
        comparison.candidateObservation.reportCommitment !== report.reportCommitment ||
        comparison.baselineObservation.candidateArtifactHash === comparison.candidateObservation.candidateArtifactHash ||
        comparison.baselineObservation.reportCommitment === comparison.candidateObservation.reportCommitment)
      return 'PII comparison source identities are incomplete or stale';
    const benignKeys = comparison.benignFalseAlarmDeltas.map((row: any) => JSON.stringify([
      row.family, row.scope, row.contextClass, row.evidenceClass, row.accountingAxis, row.validatorBacked, row.contextDependent,
    ]));
    if (new Set(benignKeys).size !== benignKeys.length || comparison.benignFalseAlarmDeltas.some((row: any) =>
      !arithmetic(row.baselineRate, row.candidateRate, row.delta) ||
      row.regressed !== (row.delta !== null && row.delta > row.limit))) return 'PII benign comparison deltas are inconsistent';
    const axes = comparison.diagnosticDeltas.map((row: any) => row.axis);
    const expectedAxes = comparison.id === 'diagnostic-balanced' ? diagnosticAxes : [];
    if (JSON.stringify(axes) !== JSON.stringify(expectedAxes) || comparison.diagnosticDeltas.some((row: any) =>
      !arithmetic(row.baselineRate, row.candidateRate, row.delta) ||
      row.failedDelta !== row.candidateFailed - row.baselineFailed ||
      (!row.applicable && (row.baselineRate !== null || row.candidateRate !== null || row.delta !== null ||
        row.baselineFailed !== 0 || row.candidateFailed !== 0 || row.failedDelta !== 0)) ||
      row.regressed !== (row.applicable && row.delta !== null && (row.delta < 0 || row.failedDelta > 0))))
      return 'PII diagnostic comparison deltas are inconsistent';
    const incomplete = comparison.benignFalseAlarmDeltas.length === 0 || comparison.benignFalseAlarmDeltas.some((row: any) => row.delta === null) ||
      comparison.diagnosticDeltas.some((row: any) => row.applicable && row.delta === null);
    const regressed = comparison.benignFalseAlarmDeltas.some((row: any) => row.regressed) || comparison.diagnosticDeltas.some((row: any) => row.regressed);
    const verdict = incomplete ? 'not-measured' : regressed ? 'regression' : 'no-regression';
    if (comparison.verdict !== verdict) return 'PII population comparison verdict is inconsistent';
  }
  const publicComparisonBinding = matrix.populationComparisons.every((comparison: any) => comparison.status === 'compared' &&
    comparison.candidateObservation && top.get(comparison.id)?.reportCommitment === comparison.candidateObservation.reportCommitment);
  const allowBoundPopulationEvidence = options.allowBoundPopulationEvidence || publicComparisonBinding;
  const families = matrix.families.map((row: any) => row.family);
  if (new Set(families).size !== families.length || JSON.stringify(families) !== JSON.stringify([...families].sort())) return 'PII support families are not unique and canonical';
  if (matrix.populationReports.some((report: any) => !Array.isArray(report.familyEvidence) ||
      JSON.stringify(report.familyEvidence.map((entry: any) => entry.family)) !== JSON.stringify(families) ||
      report.familyEvidence.some((entry: any) => !['measured', 'partial', 'not-measured', 'not-applicable'].includes(entry.status) ||
        !Number.isInteger(entry.strata) || entry.strata < 0 || (entry.strata === 0 && entry.status !== 'not-measured'))))
    return 'PII support population family summaries are invalid';
  if (!allowBoundPopulationEvidence && (matrix.populationReports.some((report: any) => report.status !== 'not-measured' ||
      report.familyEvidence.some((entry: any) => entry.status !== 'not-measured' || entry.strata !== 0))))
    return 'PII population evidence requires bound source reports';
  if (!allowBoundPopulationEvidence && JSON.stringify(matrix.populationReports.map(({ familyEvidence: _familyEvidence, ...identity }: any) => identity)) !==
      JSON.stringify(pendingPopulationIdentities))
    return 'PII unbound population provenance is not the canonical empty projection';
  for (const row of matrix.families) {
    const global = row.scope === 'global', jurisdiction = global ? null : /^jurisdiction:([A-Z]{2})$/.exec(row.scope)?.[1] ?? null;
    if ((!global && (!jurisdiction || !isPiiJurisdiction(jurisdiction))) || row.jurisdiction !== jurisdiction ||
        row.family.split(':')[1] !== (jurisdiction?.toLowerCase() ?? 'global') || row.activation.selector !== selector(row.family))
      return 'PII family identity, scope, jurisdiction, or selector is inconsistent';
    if (!/^[A-Za-z0-9][A-Za-z0-9 ()/.+-]{0,79}$/.test(row.displayName) || !Number.isInteger(row.familyContractVersion) || row.familyContractVersion < 1 ||
        !['email', 'payment-card', 'network-address', 'iban', 'phone', 'national-id'].includes(row.identityDomain) ||
        row.qualificationProfile?.id !== 'pii-v1' || row.qualificationProfile.version !== 1 || row.status.profile?.id !== 'pii-v1' || row.status.profile.version !== 1 ||
        !['none', 'reinforcing', 'required-for-sensitive-classification'].includes(row.contextObligation) || typeof row.validatorApplicable !== 'boolean' ||
        !Array.isArray(row.authority) || row.authority.length === 0 || row.authority.some((authority: any) =>
          !['standard', 'public-authority'].includes(authority.sourceKind) || !slug(authority.sourceId) || !locator(authority.locator) ||
          typeof authority.revision !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(authority.revision) ||
          !Array.isArray(authority.supports) || authority.supports.length === 0 || new Set(authority.supports).size !== authority.supports.length ||
          authority.supports.some((support: string) => !authoritySupports.includes(support)))) return 'PII support family metadata is invalid';
    if (JSON.stringify(row.populationEvidence.map((entry: any) => entry.id)) !== JSON.stringify(populationIds) ||
        row.populationEvidence.some((entry: any) => {
          const report = top.get(entry.id), summary = report?.familyEvidence.find((candidate: any) => candidate.family === row.family);
          return entry.reportStatus !== report?.status || entry.reportCommitment !== report?.reportCommitment || !summary ||
            entry.status !== summary.status || entry.strata !== summary.strata;
        }))
      return 'PII family population evidence is incomplete or unbound';
    if (!allowBoundPopulationEvidence && row.populationEvidence.some((entry: any) =>
      entry.reportStatus !== 'not-measured' || entry.status !== 'not-measured' || entry.strata !== 0))
      return 'PII family population evidence requires bound source reports';
    const trusted = trustedProduct;
    const sanctionedQualification = sanctioned?.qualifications.find(candidate => candidate.family === row.family);
    const sanctionedAvailable = sanctioned?.availableFamilies.includes(row.family) ?? false;
    if (trusted ? (!['available', 'unavailable'].includes(row.activation.state) ||
        row.activation.state !== (sanctionedAvailable ? 'available' : 'unavailable') ||
        row.activation.activationIdentity !== sanctioned?.activationIdentity ||
        row.activation.productArtifactCommitment !== matrix.activationContract.productArtifactCommitment ||
        row.qualificationArtifactCommitment !== (sanctionedQualification?.artifactCommitment ?? null)) :
      (row.activation.state !== 'not-measured' || row.activation.activationIdentity !== null || row.activation.productArtifactCommitment !== null ||
        row.qualificationArtifactCommitment !== null))
      return 'PII activation row does not match the product artifact binding';
    const reasons: string[] = [];
    if (!trusted) reasons.push('product-activation-not-measured');
    else if (row.activation.state !== 'available') reasons.push('product-family-unavailable');
    if (row.populationEvidence.find((entry: any) => entry.id === 'diagnostic-balanced')?.status !== 'measured') reasons.push('diagnostic-population-not-measured');
    if (row.populationEvidence.find((entry: any) => entry.id === 'benign-heavy-stress')?.status !== 'measured') reasons.push('benign-heavy-stress-not-measured');
    if (matrix.populationComparisons.some((comparison: any) => comparison.verdict !== 'no-regression')) reasons.push('population-comparison-not-qualified');
    if (row.qualificationArtifactCommitment === null) reasons.push('qualification-not-measured');
    else if (!/^[a-f0-9]{64}$/.test(row.qualificationArtifactCommitment)) return 'PII qualification artifact commitment is invalid';
    else reasons.push(...(sanctionedQualification?.reasonCodes ?? []));
    const provisional = row.activation.state === 'available' && row.populationEvidence.every((entry: any) => entry.status === 'measured') &&
      matrix.populationComparisons.every((comparison: any) => comparison.verdict === 'no-regression') && row.qualificationArtifactCommitment !== null &&
      row.status.reasonCodes.length === 0;
    const exactReasons = [...new Set(reasons)].sort();
    if (row.status.state !== (provisional ? 'provisional' : 'pending') ||
        JSON.stringify(row.status.reasonCodes) !== JSON.stringify(exactReasons)) return 'PII support status is not exactly derived';
  }
  return null;
}
