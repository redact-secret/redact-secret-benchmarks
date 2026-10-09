/** Descriptive evidence coverage. This module never assigns product qualification. */
export const COVERAGE_STATES = Object.freeze(['measured-supported', 'measured-missed', 'measured-partial', 'supported-unmeasured', 'measurement-unavailable', 'product-not-supported', 'evaluator-not-representable', 'evidence-deferred', 'not-applicable']);
export const COVERAGE_REASONS = Object.freeze(['capability-unknown', 'product-excluded', 'evidence-deferred', 'no-accepted-cases', 'mapping-loss', 'mapping-unknown', 'evaluator-gap', 'no-observation', 'stale-observation', 'invalid-observation', 'identity-mismatch', 'observation-withheld', 'partial-observation', 'recorded-miss', 'not-applicable', 'applicability-unknown']);
const fail = message => { throw new Error(`Invalid PII coverage: ${message}`); };
const object = (value, fields, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...fields].sort().join()) fail(`${name} closed fields`);
};
const string = (value, name, nullable = false) => {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !value.trim() || value.length > 512 || /[\u0000-\u001f]/.test(value)) fail(`${name} bounded string`);
};
const enumeration = (value, values, name) => { if (!values.includes(value)) fail(`${name} unknown enum`); };
const count = (value, name, nullable = false) => { if (!(nullable && value === null) && (!Number.isSafeInteger(value) || value < 0)) fail(`${name} nonnegative safe integer`); };
const identifiers = (value, name, values) => {
  if (!Array.isArray(value) || value.length > 512 || new Set(value).size !== value.length) fail(`${name} unique bounded array`);
  for (const item of value) { string(item, name); if (values) enumeration(item, values, name); }
};
const identityFields = ['snapshotId', 'snapshotCommitment', 'productCommitment', 'mappingRevision', 'mappingCommitment', 'protocol', 'population', 'visibility', 'role', 'bindingCommitment'];
export function validateCoverageIdentity(identity) {
  object(identity, identityFields, 'identity');
  for (const field of identityFields.filter(field => !['mappingRevision', 'visibility', 'role'].includes(field))) string(identity[field], field, ['productCommitment', 'bindingCommitment'].includes(field));
  for (const field of ['snapshotCommitment', 'productCommitment', 'mappingCommitment', 'bindingCommitment', 'population']) {
    if (identity[field] !== null && !/^[a-f0-9]{64}$/.test(identity[field])) fail(`${field} SHA-256 commitment`);
  }
  count(identity.mappingRevision, 'mappingRevision');
  if (!identity.mappingRevision) fail('mappingRevision positive');
  enumeration(identity.visibility, ['public', 'protected'], 'visibility');
  enumeration(identity.role, ['active', 'proposed', 'baseline', 'candidate'], 'role');
  return identity;
}
const sameIdentity = (a, b) => identityFields.every(field => a[field] === b[field]);
export function deriveCoverageState(row) {
  if (row.applicability.state === 'not-applicable') return 'not-applicable';
  if (row.capability.state === 'explicitly-absent') return 'product-not-supported';
  if (row.evidence.availability === 'unknown') return 'measurement-unavailable';
  if (row.evidence.availability === 'deferred' || !row.evidence.acceptedCases) return 'evidence-deferred';
  if (row.mapping.state === 'not-representable') return 'evaluator-not-representable';
  if (row.capability.state === 'unknown') return 'measurement-unavailable';
  if (row.observation.status !== 'valid' || !row.observation.axes.length) return 'supported-unmeasured';
  if (row.applicability.state === 'unknown') return 'measurement-unavailable';
  if (row.observation.axes.some(axis => axis.missed > 0)) return 'measured-missed';
  const observed = new Map(row.observation.axes.map(axis => [axis.axis, axis]));
  const partial = row.mapping.state !== 'faithful' || row.mapping.losses.length > 0 || !row.mapping.requiredAxes.length ||
    row.mapping.requiredAxes.some(axis => !row.mapping.representableAxes.includes(axis) || !observed.has(axis) || observed.get(axis).measured === 0) ||
    row.observation.axes.some(axis => axis.measured < axis.eligible || axis.unresolved > 0 || axis.withheld > 0);
  if (partial) return 'measured-partial';
  if (!row.observation.axes.some(axis => axis.measured > 0)) return 'supported-unmeasured';
  return 'measured-supported';
}
export function coverageReasons(row) {
  const reasons = new Set();
  if (row.capability.state === 'unknown') reasons.add('capability-unknown');
  if (row.capability.state === 'explicitly-absent') reasons.add('product-excluded');
  if (row.evidence.availability === 'deferred') reasons.add('evidence-deferred');
  if (!row.evidence.acceptedCases) reasons.add('no-accepted-cases');
  if (row.mapping.losses.length || row.mapping.state === 'partial') reasons.add('mapping-loss');
  if (row.mapping.state === 'unknown') reasons.add('mapping-unknown');
  if (row.mapping.state === 'not-representable') reasons.add('evaluator-gap');
  const statuses = { absent: 'no-observation', stale: 'stale-observation', invalid: 'invalid-observation', 'identity-mismatch': 'identity-mismatch', withheld: 'observation-withheld' };
  if (statuses[row.observation.status]) reasons.add(statuses[row.observation.status]);
  if (row.observation.axes.some(axis => axis.missed > 0)) reasons.add('recorded-miss');
  if (row.observation.axes.some(axis => axis.measured < axis.eligible || axis.unresolved || axis.withheld)) reasons.add('partial-observation');
  if (row.applicability.state === 'not-applicable') reasons.add('not-applicable');
  if (row.applicability.state === 'unknown') reasons.add('applicability-unknown');
  return [...reasons].sort();
}
export function validateCoverageRow(row, identity) {
  validateCoverageIdentity(identity);
  object(row, ['kindKey', 'label', 'domains', 'jurisdictions', 'evidence', 'capability', 'mapping', 'observation', 'applicability', 'reasons', 'state'], 'row');
  string(row.kindKey, 'kindKey'); string(row.label, 'label');
  identifiers(row.domains, 'domains', ['PII', 'PHI']); if (!row.domains.length) fail('domain required');
  identifiers(row.jurisdictions, 'jurisdictions'); identifiers(row.reasons, 'reasons', COVERAGE_REASONS);
  object(row.evidence, ['availability', 'authoredCases', 'importedCases', 'fixtures', 'variants', 'occurrences', 'acceptedCases'], 'evidence');
  enumeration(row.evidence.availability, ['accepted', 'deferred', 'none', 'unknown'], 'availability');
  for (const key of ['authoredCases', 'importedCases', 'fixtures', 'variants', 'acceptedCases', 'occurrences']) count(row.evidence[key], key, ['importedCases', 'variants', 'occurrences'].includes(key));
  if (row.evidence.acceptedCases > row.evidence.authoredCases || (row.evidence.availability !== 'accepted' && row.evidence.acceptedCases)) fail('accepted case accounting');
  object(row.capability, ['state', 'source', 'productCommitment'], 'capability');
  enumeration(row.capability.state, ['declared', 'explicitly-absent', 'unknown'], 'capability');
  string(row.capability.source, 'capability source', true); string(row.capability.productCommitment, 'capability product', true);
  if (row.capability.state !== 'unknown' && (!row.capability.source || !identity.productCommitment || row.capability.productCommitment !== identity.productCommitment)) fail('capability exact product binding');
  if (row.capability.productCommitment !== null && row.capability.productCommitment !== identity.productCommitment) fail('capability identity mismatch');
  object(row.mapping, ['state', 'losses', 'requiredAxes', 'representableAxes'], 'mapping');
  enumeration(row.mapping.state, ['faithful', 'partial', 'not-representable', 'unknown'], 'mapping');
  for (const key of ['losses', 'requiredAxes', 'representableAxes']) identifiers(row.mapping[key], key);
  if (row.mapping.state === 'faithful' && (row.mapping.losses.length || row.mapping.requiredAxes.some(axis => !row.mapping.representableAxes.includes(axis)))) fail('faithful mapping loses required axes');
  object(row.applicability, ['state', 'source'], 'applicability');
  enumeration(row.applicability.state, ['applicable', 'not-applicable', 'unknown'], 'applicability'); string(row.applicability.source, 'applicability source', true);
  if (row.applicability.state !== 'unknown' && !row.applicability.source) fail('explicit applicability contract required');
  object(row.observation, ['status', 'identity', 'axes', 'source'], 'observation');
  enumeration(row.observation.status, ['valid', 'absent', 'stale', 'invalid', 'identity-mismatch', 'withheld'], 'observation');
  string(row.observation.source, 'observation source', true);
  if (row.observation.identity !== null) validateCoverageIdentity(row.observation.identity);
  if (row.observation.status === 'valid' && (!row.observation.identity || !sameIdentity(row.observation.identity, identity) || !identity.productCommitment || !identity.bindingCommitment || !row.observation.source)) fail('observation exact identity binding');
  if (!Array.isArray(row.observation.axes) || row.observation.axes.length > 512 || new Set(row.observation.axes.map(axis => axis?.axis)).size !== row.observation.axes.length) fail('observation axes unique bounded array');
  for (const axis of row.observation.axes) {
    object(axis, ['axis', 'eligible', 'measured', 'satisfied', 'missed', 'unresolved', 'withheld'], 'observation axis'); string(axis.axis, 'axis');
    for (const key of ['eligible', 'measured', 'satisfied', 'missed', 'unresolved', 'withheld']) count(axis[key], key);
    if (axis.measured !== axis.satisfied + axis.missed + axis.unresolved || axis.measured + axis.withheld > axis.eligible) fail('observation denominator accounting');
  }
  enumeration(row.state, COVERAGE_STATES, 'summary state');
  if (row.state !== deriveCoverageState(row)) fail('summary state does not recount');
  if (JSON.stringify([...row.reasons].sort()) !== JSON.stringify(coverageReasons(row))) fail('independent reason omitted or fabricated');
  return row;
}
export function createCoverageRow(input, identity) {
  const row = structuredClone(input);
  row.reasons ??= [];
  row.state = deriveCoverageState(row);
  row.reasons = coverageReasons(row);
  return validateCoverageRow(row, identity);
}
export function validateCoverageMatrix(matrix) {
  object(matrix, ['schemaVersion', 'identity', 'rows'], 'matrix');
  if (matrix.schemaVersion !== 1) fail('schemaVersion unknown');
  validateCoverageIdentity(matrix.identity);
  if (!Array.isArray(matrix.rows) || matrix.rows.length > 100000) fail('rows bounded array');
  if (new Set(matrix.rows.map(row => row?.kindKey)).size !== matrix.rows.length) fail('duplicate kind key');
  for (const row of matrix.rows) validateCoverageRow(row, matrix.identity);
  return matrix;
}
