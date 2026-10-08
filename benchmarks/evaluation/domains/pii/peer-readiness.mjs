// Readiness is an inventory of missing evidence, never a measurement or a support verdict.
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const rules = ['authored-before-observation', 'type-and-sensitivity-independent', 'reserved-control-requires-authority',
  'unknown-remains-unresolved', 'no-output-derived-truth', 'same-population-and-protocol'];
const requirements = ['reviewed-family-range-sensitivity-mapping', 'offset-conformance-vectors',
  'pinned-configuration-and-artifacts', 'same-population-execution'];
const gaps = ['method-restricted-metrics-not-applicable', 'range-less-expectations-unresolved',
  'no-reserved-non-sensitive-ssn-or-iban-namespace', 'no-independent-diversity-review'];
const views = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function validatePiiPeerReadiness(value) {
  const fail = () => { throw new Error('Invalid PII peer readiness inventory'); };
  if (!exact(value, ['schema', 'supportClaims', 'measurementState', 'reviewedEvaluator', 'expectationRules', 'populations', 'peers', 'coverageGaps', 'sources']) ||
      value.schema !== 'pii-peer-readiness/1' || value.supportClaims !== false || value.measurementState !== 'not-measured' ||
      !equal(value.expectationRules, rules) || !equal(value.coverageGaps, gaps)) fail();
  const evaluator = value.reviewedEvaluator;
  if (!exact(evaluator, ['repository', 'commit', 'inventorySha256', 'configurationSha256']) || evaluator.repository !== 'redact-secret/pii-eval' ||
      !/^[a-f0-9]{40}$/.test(evaluator.commit) || !digest(evaluator.inventorySha256) || !digest(evaluator.configurationSha256)) fail();
  if (!Array.isArray(value.populations) || !equal(value.populations.map(row => row?.view), views) || value.populations.some(row =>
    !exact(row, ['view', 'populationId', 'populationDigest', 'method']) || row.populationId !== `b11-population-v2-${row.view}` ||
    !digest(row.populationDigest) || row.method !== 'schema-only')) fail();
  if (!Array.isArray(value.peers) || !equal(value.peers.map(row => [row?.scannerId, row?.version]), [['flare-redact', '1.6.1'], ['openredaction', '1.1.5']]) ||
    value.peers.some(row => !exact(row, ['scannerId', 'version', 'adapterState', 'accuracyState', 'reason', 'required']) ||
      row.adapterState !== 'unavailable' || row.accuracyState !== 'not-measured' || row.reason !== 'throughput-only-no-reviewed-pii-mapping' || !equal(row.required, requirements))) fail();
  if (!equal(value.sources, ['docs/specs/pii-identity-oracle.md', 'docs/specs/pii-benign-collision-evidence.md',
    'docs/specs/pii-eval-integration.md', 'docs/specs/pii-populations.md'])) fail();
  return structuredClone(value);
}
