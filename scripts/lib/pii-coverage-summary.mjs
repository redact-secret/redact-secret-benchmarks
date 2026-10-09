import { COVERAGE_STATES, validateCoverageMatrix } from './pii-coverage-model.mjs';

/** Recounts one population/product/snapshot only. Slice membership can overlap. */
export function summarizeCoverage(matrix, { kindKeys } = {}) {
  validateCoverageMatrix(matrix);
  const rows = matrix.rows;
  if (kindKeys !== undefined && (!Array.isArray(kindKeys) || new Set(kindKeys).size !== kindKeys.length || kindKeys.some(key => !rows.some(row => row.kindKey === key)))) throw new Error('Invalid PII coverage filter');
  const selected = kindKeys === undefined ? rows : rows.filter(row => kindKeys.includes(row.kindKey));
  const states = Object.fromEntries(COVERAGE_STATES.map(state => [state, rows.filter(row => row.state === state).length]));
  const capability = Object.fromEntries(['declared', 'explicitly-absent', 'unknown'].map(state => [state, rows.filter(row => row.capability.state === state).length]));
  const mapping = Object.fromEntries(['faithful', 'partial', 'not-representable', 'unknown'].map(state => [state, rows.filter(row => row.mapping.state === state).length]));
  const slice = field => Object.fromEntries([...new Set(rows.flatMap(row => row[field]))].sort().map(value => [value, rows.filter(row => row[field].includes(value)).length]));
  const losses = Object.fromEntries([...new Set(rows.flatMap(row => row.mapping.losses))].sort().map(loss => [loss, rows.filter(row => row.mapping.losses.includes(loss)).length]));
  const grainMemberships = Object.fromEntries(['authoredCases', 'importedCases', 'fixtures', 'variants', 'occurrences', 'acceptedCases'].map(grain => [grain, {
    count: rows.some(row => row.evidence[grain] === null) ? null : rows.reduce((total, row) => total + row.evidence[grain], 0),
    knownCount: rows.reduce((total, row) => total + (row.evidence[grain] ?? 0), 0),
    unknownKinds: rows.filter(row => row.evidence[grain] === null).length,
  }]));
  if (Object.values(grainMemberships).some(grain => !Number.isSafeInteger(grain.knownCount))) throw new Error('PII coverage grain total exceeds safe integer');
  const numerator = states['measured-supported'];
  return {
    schemaVersion: 1, identity: structuredClone(matrix.identity), discoveredKinds: rows.length,
    states, capability, mapping, acceptedMeasurableKinds: rows.filter(row => row.evidence.acceptedCases > 0 && ['faithful', 'partial'].includes(row.mapping.state) && row.mapping.representableAxes.length > 0).length,
    domainSlices: slice('domains'), jurisdictionSlices: slice('jurisdictions'), losses,
    sliceMembership: { exclusive: false, domainsOverlap: rows.some(row => row.domains.length > 1), jurisdictionsOverlap: rows.some(row => row.jurisdictions.length > 1), cannotSumAsUniqueKinds: true },
    grainMemberships, grainAccounting: 'Per-kind memberships; shared cases or variants can overlap. These are not unique source totals.',
    descriptiveCoverage: { numerator, denominator: rows.length, value: rows.length ? numerator / rows.length : null,
      available: rows.length > 0, label: 'Measured-supported kinds / full discovered evidence-kind inventory, not detection accuracy',
      identity: structuredClone(matrix.identity), exclusions: Object.fromEntries(Object.entries(states).filter(([state]) => state !== 'measured-supported')) },
    view: { selectedKinds: selected.length, fullInventoryDenominator: rows.length, kindKeys: selected.map(row => row.kindKey) },
    metrics: rows.flatMap(row => row.observation.status !== 'valid' ? [] : row.observation.axes.map(axis => ({
      kindKey: row.kindKey, axis: axis.axis, eligible: axis.eligible, measured: axis.measured, effectiveN: axis.satisfied + axis.missed,
      satisfied: axis.satisfied, missed: axis.missed, unresolved: axis.unresolved, withheld: axis.withheld,
      unobserved: axis.eligible - axis.measured - axis.withheld, denominator: axis.satisfied + axis.missed,
      value: axis.satisfied + axis.missed ? axis.satisfied / (axis.satisfied + axis.missed) : null,
      identity: structuredClone(matrix.identity), exclusions: { unresolved: axis.unresolved, withheld: axis.withheld, unobserved: axis.eligible - axis.measured - axis.withheld },
    }))),
  };
}

export function validateCoverageSummary(summary, matrix, options) {
  const canonical = value => value === null || typeof value !== 'object' ? value : Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  if (JSON.stringify(canonical(summary)) !== JSON.stringify(canonical(summarizeCoverage(matrix, options)))) throw new Error('PII coverage summary does not recount validated full inventory');
  return summary;
}
