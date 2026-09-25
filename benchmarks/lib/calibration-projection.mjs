/**
 * Public projection boundary for the calibration experiments (#255).
 *
 * The maintainer-local experiment result carries weights, caps, ramps,
 * thresholds, per-configuration ids that encode caps, band distributions and
 * calibration curves. None of that may reach a public surface
 * (redact-secret decision-freeze-the-shadow-evidence-score-and-confidence-contract
 * §11; docs/specs/statistical-tuning.md §7). The public projection is a closed
 * shape: aggregate security outcomes per partition and per stratum for the
 * selected configuration, plus identities and hashes. `projectionProblems`
 * rejects any key outside that shape and any value that looks like a
 * configuration id or a decision-boundary detail. It is plain JavaScript so the
 * CI publication check (scripts/check-feature-dataset-exclusion.mjs) can run it
 * without a TypeScript loader.
 */

export const PROJECTION_TYPE = 'calibration-public-projection';
export const EXPERIMENT_RESULT_TYPE = 'calibration-experiments';
/** A stratum with fewer rows than this is not projected: it would describe individual candidates. */
export const MIN_STRATUM_ROWS = 5;

/** Every key the public projection may contain, at any depth. */
export const ALLOWED_KEYS = new Set([
  // envelope and identity
  'schemaVersion', 'datasetType', 'visibility', 'holdoutAccess', 'experimentVersion', 'selectionSourceHash', 'scoringIdentity',
  'aggregationContractVersion', 'contractDecision', 'featureDataset', 'extractorVersion', 'extractorSourceHash', 'datasetHash',
  'featureSchema', 'benchmark', 'commit', 'dirty', 'generatedShare', 'overrideApplied', 'tuningShare', 'notice',
  // outcomes
  'partitions', 'development', 'evaluation', 'authoredOnly', 'operatingPoints', 'low', 'medium', 'high',
  'strata', 'family', 'context', 'suppressedStrata',
  'rows', 'measurableShare', 'unresolved', 'companion-role', 'truncated', 'mustRedact', 'policy', 'controls',
  'leakedSpanRate', 'policyLeakedSpanRate', 'falseAlarmRate', 'independentFalseAlarmRate', 'collateralRatio',
  'twins', 'pairs', 'discriminated', 'rate',
]);

/** Keys whose presence alone would publish a decision-boundary detail, whatever the value. */
const FORBIDDEN_KEY = /threshold|weight|cap|ramp|score(?!Identity)|contribution|lookup|feature(?!Dataset|Schema)|logistic|platt|isotonic|brier|calibrat|distribution|signal|delta|lo$|hi$|points|recipe|mutation/i;
/** Values that name a grid configuration (its id encodes caps) or a row. */
const FORBIDDEN_VALUE = [/\bhalving-r\d/, /-r\d+-l\d+-c\d+/, /#\d+$/];

function walk(value, at, problems, strataKey = false) {
  if (Array.isArray(value)) { value.forEach((item, i) => walk(item, `${at}[${i}]`, problems)); return; }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const here = `${at}.${key}`;
      // Stratum names (family ids, context classes) are data keys under strata.family / strata.context.
      if (!strataKey) {
        if (FORBIDDEN_KEY.test(key) && !ALLOWED_KEYS.has(key)) problems.push(`${here}: a decision-boundary key is never public`);
        else if (!ALLOWED_KEYS.has(key)) problems.push(`${here}: not part of the public projection shape`);
      } else if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) problems.push(`${here}: not a stratum name`);
      walk(item, here, problems, !strataKey && (key === 'family' || key === 'context') && /\.strata\.(development|evaluation)$/.test(at));
    }
    return;
  }
  if (typeof value === 'string' && FORBIDDEN_VALUE.some(p => p.test(value))) problems.push(`${at}: names a configuration or a row`);
}

/** Problems with a candidate public projection; empty when it may be published. */
export function projectionProblems(projection) {
  const problems = [];
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) return ['projection: not an object'];
  if (projection.datasetType !== PROJECTION_TYPE) problems.push(`datasetType: must be ${PROJECTION_TYPE}`);
  if (projection.holdoutAccess !== 'none') problems.push('holdoutAccess: must be none');
  walk(projection, '$', problems);
  for (const dimension of ['family', 'context']) {
    for (const partition of ['development', 'evaluation']) {
      const strata = projection.strata?.[partition]?.[dimension] ?? {};
      for (const [name, outcome] of Object.entries(strata)) {
        if (typeof outcome?.rows !== 'number' || outcome.rows < MIN_STRATUM_ROWS) problems.push(`strata.${partition}.${dimension}.${name}: fewer than ${MIN_STRATUM_ROWS} rows is never projected`);
      }
    }
  }
  return problems;
}

export function assertPublicProjection(projection) {
  const problems = projectionProblems(projection);
  if (problems.length) throw new Error(`Calibration public projection refused:\n${problems.map(p => `  - ${p}`).join('\n')}`);
}
