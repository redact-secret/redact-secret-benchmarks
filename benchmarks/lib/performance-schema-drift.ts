import { PINNED_ASSESSMENT_SURFACES, PINNED_COMPLETE_ASSESSMENT_SCHEMA_VERSION } from './performance-schema.ts';

/**
 * Field lists this repository's pinned copy (`performance-schema.ts`) reads
 * from core's `assessment/schema.ts`, kept in sync with that file's own
 * `interface` declarations by hand -- the same trust boundary
 * `completeAssessmentProblem` already draws for the shapes it validates at
 * runtime. This module is the source-level counterpart: it reads core's
 * actual `.ts` source at the pinned commit (already checked out by
 * `.github/workflows/performance-evaluation.yml` before this runs) and
 * fails if the *names* have moved, catching drift `completeAssessmentProblem`
 * cannot -- a renamed or removed field never gets far enough to produce
 * output that check could see (#150).
 */
const PINNED_DISTRIBUTION_FIELDS = ['unit', 'samples', 'minimum', 'median', 'p95', 'maximum', 'mean', 'standardDeviation'];
const PINNED_MEMORY_METRIC_FIELDS = ['unit', 'samples', 'unavailableReason', 'samplingLimit'];
const PINNED_PROVENANCE_FIELDS = ['commit', 'artifactIdentity', 'corpusVersion', 'corpusHash', 'os', 'cpu', 'runtime', 'command', 'buildProfile'];
const PINNED_MEMORY_CATEGORIES = ['nodeHeap', 'nodeRss', 'nodeExternal', 'browserJsHeap', 'wasmLinearMemory', 'pythonHeap', 'processRss', 'streamingBuffer'];

function interfaceFields(source: string, interfaceName: string): string[] | null {
  const match = source.match(new RegExp(`interface\\s+${interfaceName}\\b[^{]*\\{([^}]*)\\}`, 's'));
  if (!match) return null;
  return [...match[1].matchAll(/readonly\s+(\w+)\??:/g)].map(field => field[1]);
}

function sameSet(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && expected.every(field => actual.includes(field));
}

/**
 * Compares core's live `assessment/complete.ts` and `assessment/schema.ts`
 * source (at the commit `benchmarks/pin-manifest.json` pins) against this
 * repository's pinned copy of the result contract. Returns a diagnostic per
 * mismatch, or `[]` when nothing has drifted.
 */
export function checkCoreSchemaDrift(completeSource: string, schemaSource: string): string[] {
  const failures: string[] = [];

  const versionMatch = completeSource.match(/COMPLETE_ASSESSMENT_SCHEMA_VERSION\s*=\s*"([^"]+)"/);
  if (!versionMatch) {
    failures.push('core assessment/complete.ts: could not find COMPLETE_ASSESSMENT_SCHEMA_VERSION -- core schema drifted structurally');
  } else if (versionMatch[1] !== PINNED_COMPLETE_ASSESSMENT_SCHEMA_VERSION) {
    failures.push(`core assessment/complete.ts COMPLETE_ASSESSMENT_SCHEMA_VERSION is "${versionMatch[1]}", pinned copy (benchmarks/lib/performance-schema.ts) expects "${PINNED_COMPLETE_ASSESSMENT_SCHEMA_VERSION}"`);
  }

  const surfacesMatch = completeSource.match(/REQUIRED_ASSESSMENT_SURFACES\s*=\s*\[([^\]]*)\]/s);
  if (!surfacesMatch) {
    failures.push('core assessment/complete.ts: could not find REQUIRED_ASSESSMENT_SURFACES -- core schema drifted structurally');
  } else {
    const surfaces = [...surfacesMatch[1].matchAll(/"([^"]+)"/g)].map(surface => surface[1]);
    if (!sameSet(surfaces, [...PINNED_ASSESSMENT_SURFACES])) {
      failures.push(`core assessment/complete.ts REQUIRED_ASSESSMENT_SURFACES is [${surfaces.join(', ')}], pinned copy expects [${PINNED_ASSESSMENT_SURFACES.join(', ')}]`);
    }
  }

  const structuralChecks: readonly [string, readonly string[]][] = [
    ['AssessmentDistribution', PINNED_DISTRIBUTION_FIELDS],
    ['AssessmentMemoryMetric', PINNED_MEMORY_METRIC_FIELDS],
    ['AssessmentProvenance', PINNED_PROVENANCE_FIELDS],
    ['AssessmentMemoryMetrics', PINNED_MEMORY_CATEGORIES],
  ];
  for (const [name, expected] of structuralChecks) {
    const fields = interfaceFields(schemaSource, name);
    if (fields === null) {
      failures.push(`core assessment/schema.ts: could not find interface ${name} -- core schema drifted structurally`);
      continue;
    }
    if (!sameSet(fields, [...expected])) {
      failures.push(`core assessment/schema.ts ${name} fields are [${fields.join(', ')}], pinned copy (benchmarks/lib/performance-schema.ts) expects [${expected.join(', ')}]`);
    }
  }

  return failures;
}
