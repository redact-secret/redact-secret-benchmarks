// This is a proposed role contract, not a measurement pin or an owner decision.
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const benchmark = 'redact-secret/redact-secret-benchmarks';
const populations = [
  ['pii-evidence', 'redact-secret/pii-evidence', 'canonical-public-evidence', 'public-synthetic', 'released-snapshot-and-import-binding', 'imported-artifact-metric-sufficient-counts', 'no-new-authorisation'],
  ['oracle-plan', benchmark, 'authored-identity-oracle', 'public-synthetic', 'benchmarks/pii-eval-population-pins.json', 'bound-artifact-metric-sufficient-counts', 'existing-contract-only'],
  ['qualification-plan', benchmark, 'product-contract-qualification', 'public-synthetic', 'benchmarks/pii-eval-population-pins.json', 'bound-artifact-metric-sufficient-counts', 'existing-contract-only'],
  ['diagnostic-balanced', benchmark, 'development-tuning', 'public-synthetic', 'benchmarks/pii-eval-population-pins.json', 'bound-artifact-metric-sufficient-counts', 'existing-contract-only'],
  ['benign-heavy-stress', benchmark, 'evaluation-only-stress', 'public-synthetic', 'benchmarks/pii-eval-population-pins.json', 'bound-artifact-metric-sufficient-counts', 'forbidden'],
  ['future-protected', 'unresolved-authored-evidence-owner', 'protected-independent-evidence', 'protected', 'future-reviewed-custodian-contract', 'future-bound-protected-aggregate', 'no-new-authorisation'],
];
const rowKeys = ['id', 'evidenceOwner', 'role', 'visibility', 'identitySource', 'denominatorSource', 'tuning'];
const requirements = ['exact-population-and-run-provenance', 'exact-product-artifact', 'versioned-engine-and-protocol',
  'declared-axis-applicability', 'explicit-mapping-losses', 'separate-public-and-protected-evidence'];
const lossClasses = ['contexts-not-carried', 'phi-domain-not-carried', 'sensitivity-context-dependent-flattened',
  'identity-weakened-no-span', 'sensitivity-weakened-no-span'];

export function validatePiiPopulationPolicy(value) {
  const fail = () => { throw new Error('Invalid proposed PII population policy'); };
  if (!exact(value, ['schema', 'state', 'issue', 'supportClaims', 'owners', 'populations', 'accounting', 'composition', 'mapping', 'execution']) ||
      value.schema !== 'pii-population-policy/1' || value.state !== 'proposed' || value.issue !== 835 || value.supportClaims !== false) fail();
  if (!exact(value.owners, ['measurement', 'qualification', 'protectedExecution', 'privateAudit']) ||
      value.owners.measurement !== 'redact-secret/pii-eval' || value.owners.qualification !== benchmark ||
      value.owners.protectedExecution !== 'redact-secret/private-custodian' || value.owners.privateAudit !== 'redact-secret/private-ledger') fail();
  if (!Array.isArray(value.populations) || value.populations.length !== populations.length || value.populations.some((row, index) =>
    !exact(row, rowKeys) || !equal(rowKeys.map(key => row[key]), populations[index]))) fail();
  const accounting = value.accounting;
  if (!exact(accounting, ['crossPopulationPooling', 'crossScannerPooling', 'replayAddsSamples', 'authoredCaseEqualsImportedCase',
    'denominator', 'unresolved', 'withheld', 'notApplicable', 'partial', 'protectedInPublicDenominator']) ||
      accounting.crossPopulationPooling !== 'forbidden' || accounting.crossScannerPooling !== 'forbidden' ||
      accounting.replayAddsSamples !== false || accounting.authoredCaseEqualsImportedCase !== false ||
      accounting.denominator !== 'metric-local-effectiveN-and-sufficient-counts' || accounting.unresolved !== 'retain-authored-membership-and-report-counts' ||
      accounting.withheld !== 'retain-reason-never-impute-zero-or-pass' || accounting.notApplicable !== 'protocol-declared-only' ||
      accounting.partial !== 'no-subset-renormalisation' || accounting.protectedInPublicDenominator !== 'forbidden') fail();
  const composition = value.composition;
  if (!exact(composition, ['state', 'output', 'requirements', 'numericalCriteria', 'automaticSupportPromotion', 'ownerCriteria']) ||
      composition.state !== 'proposed' || composition.output !== 'population-local-conclusion-vector' || !equal(composition.requirements, requirements) ||
      composition.numericalCriteria !== 'existing-qualification-contracts-only' || composition.automaticSupportPromotion !== false ||
      !exact(composition.ownerCriteria, ['state', 'acceptedBy', 'acceptedAt', 'acceptanceSource']) || composition.ownerCriteria.state !== 'proposed' ||
      composition.ownerCriteria.acceptedBy !== null || composition.ownerCriteria.acceptedAt !== null || composition.ownerCriteria.acceptanceSource !== null) fail();
  const mapping = value.mapping;
  if (!exact(mapping, ['owner', 'upstreamIssue', 'publicAdoptionBlocked', 'lostAxisClaims', 'lossClasses', 'unknownKindOrJurisdiction']) ||
      mapping.owner !== 'redact-secret/pii-eval' || mapping.upstreamIssue !== 'https://github.com/redact-secret/pii-eval/issues/37' ||
      mapping.publicAdoptionBlocked !== false || mapping.lostAxisClaims !== 'pending-until-faithfully-represented' ||
      !equal(mapping.lossClasses, lossClasses) || mapping.unknownKindOrJurisdiction !== 'refuse-not-guess') fail();
  const execution = value.execution;
  if (!exact(execution, ['measurementTarget', 'snapshotPin', 'freshOfficialCostDecision', 'authorityRepin', 'protectedExecution']) ||
      execution.measurementTarget !== 'not-selected' || execution.snapshotPin !== 'not-selected' ||
      execution.freshOfficialCostDecision !== 'required-before-dispatch' || execution.authorityRepin !== 'not-authorised-by-this-policy' ||
      execution.protectedExecution !== 'not-authorised-by-this-policy') fail();
  return structuredClone(value);
}
