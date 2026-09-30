/**
 * What each library's own documentation says it can do: `benchmarks/feature-claims.json`.
 *
 * That file does not exist yet (follow-up to #543, linked from the /comparison/feature
 * page). Until it does, this service returns `not-recorded` and the page says so; it
 * never falls back to another source. When the file is committed it is read and
 * checked against the shape below: an invalid file is reported, not rendered.
 */
import { once, readJsonIfPresent } from './repo';

export const FEATURE_CLAIMS = 'benchmarks/feature-claims.json';
export type Mark = 'yes' | 'partly' | 'no';

export interface FeatureClaimCell { mark: Mark; note?: string; tested?: boolean; literal?: boolean }
export interface FeatureClaims {
  schemaVersion: 1;
  /** The date the documentation was read. */
  readOn: string;
  libraries: { id: string; name: string; version: string }[];
  groups: { label: string; rows: { id: string; label: string; cells: Record<string, FeatureClaimCell> }[] }[];
  sources: { name: string; detail: string }[];
}

export type FeatureClaimsLoad =
  | { state: 'recorded'; claims: FeatureClaims }
  | { state: 'not-recorded'; reason: string }
  | { state: 'invalid'; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** The first problem with a claims file, or `null`. Exported for the tests. */
export function featureClaimsProblem(value: unknown): string | null {
  if (!isObject(value) || value.schemaVersion !== 1) return 'schemaVersion must be 1';
  if (!isText(value.readOn) || !/^\d{4}-\d{2}-\d{2}$/.test(value.readOn)) return 'readOn must be a date';
  const { libraries, groups, sources } = value;
  if (!Array.isArray(libraries) || libraries.length === 0 || libraries.some(l => !isObject(l) || !isText(l.id) || !isText(l.name) || !isText(l.version))) return 'libraries must list id, name and version';
  const ids = (libraries as { id: string }[]).map(l => l.id);
  if (new Set(ids).size !== ids.length) return 'library ids must be unique';
  if (!Array.isArray(groups) || groups.length === 0) return 'groups must not be empty';
  const seen = new Set<string>();
  for (const g of groups) {
    if (!isObject(g) || !isText(g.label) || !Array.isArray(g.rows)) return 'each group needs a label and rows';
    for (const r of g.rows) {
      if (!isObject(r) || !isText(r.id) || !isText(r.label) || !isObject(r.cells)) return 'each row needs an id, a label and cells';
      if (seen.has(r.id)) return `duplicate row id ${r.id}`;
      seen.add(r.id);
      for (const [lib, cell] of Object.entries(r.cells)) {
        if (!ids.includes(lib)) return `row ${r.id} has a cell for unknown library ${lib}`;
        if (!isObject(cell) || !['yes', 'partly', 'no'].includes(cell.mark as string)) return `row ${r.id}, ${lib}: mark must be yes, partly or no`;
      }
    }
  }
  if (!Array.isArray(sources) || sources.some(s => !isObject(s) || !isText(s.name) || !isText(s.detail))) return 'sources must list name and detail';
  return null;
}

export function loadFeatureClaims(): Promise<FeatureClaimsLoad> {
  return once('feature-claims', async () => {
    const file = await readJsonIfPresent<unknown>(FEATURE_CLAIMS);
    if (file === undefined) return { state: 'not-recorded', reason: `${FEATURE_CLAIMS} does not exist: no library's documentation has been read into the ledger yet.` };
    const problem = featureClaimsProblem(file);
    if (problem) return { state: 'invalid', reason: `${FEATURE_CLAIMS} did not validate: ${problem}.` };
    return { state: 'recorded', claims: file as FeatureClaims };
  });
}
