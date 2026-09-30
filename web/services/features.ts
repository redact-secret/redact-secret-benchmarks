/**
 * What each library's own documentation says it can do: `benchmarks/feature-claims.json`
 * (#564, part of #543). Without the file this service returns `not-recorded` and the
 * page says so; it never falls back to another source. The file is read and checked
 * against the shape below: an invalid file is reported, not rendered.
 *
 * A mark reads "listed in the documentation read". `no` means not listed or not stated
 * (a dash on the page), never "the library cannot"; there is no separate `unknown` mark
 * (docs/decisions/2026-09-30-record-feature-claims-from-each-librarys-own-docs.md).
 */
import { once, readJsonIfPresent } from './repo';

export const FEATURE_CLAIMS = 'benchmarks/feature-claims.json';
export type Mark = 'yes' | 'partly' | 'no';

/** Where a mark comes from: a page of the project's own documentation at the version read. */
export interface FeatureClaimSource { kind: 'doc'; ref: string }
export interface FeatureClaimCell {
  mark: Mark;
  note?: string;
  source: FeatureClaimSource;
  /** A committed test checks the claim; `test` names it (`tests/feature-claims.test.mjs`). */
  tested?: boolean;
  test?: string;
  literal?: boolean;
}
export interface LibraryInstallPackage { name: string; version: string; packedBytes: number; unpackedBytes: number }
/** Facts from package metadata, for the runtime page's "About the libraries" table. */
export interface LibraryFacts {
  runsIn: string;
  dependencies: string;
  install: { measuredOn: string; method: string; note: string; packages: LibraryInstallPackage[] };
  sources: string[];
}
export interface FeatureClaimLibrary { id: string; name: string; version: string; package?: string; facts?: LibraryFacts }
export interface FeatureClaimSourceNote { name: string; detail: string; links?: { label: string; href: string }[] }
export interface FeatureClaims {
  schemaVersion: 1;
  /** The date the documentation was read. */
  readOn: string;
  libraries: FeatureClaimLibrary[];
  groups: { label: string; rows: { id: string; label: string; cells: Record<string, FeatureClaimCell> }[] }[];
  sources: FeatureClaimSourceNote[];
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
        if (!isObject(cell.source) || cell.source.kind !== 'doc' || !isText(cell.source.ref) || !/^https:\/\//.test(cell.source.ref)) return `row ${r.id}, ${lib}: a mark needs a source (kind doc, an https ref)`;
        if (cell.tested !== undefined && (cell.tested !== true || !isText(cell.test))) return `row ${r.id}, ${lib}: tested must be true and name its test`;
      }
    }
  }
  if (!Array.isArray(sources) || sources.some(s => !isObject(s) || !isText(s.name) || !isText(s.detail))) return 'sources must list name and detail';
  for (const l of libraries as { id: string; facts?: unknown }[]) {
    if (l.facts === undefined) continue;
    const f = l.facts;
    if (!isObject(f) || !isText(f.runsIn) || !isText(f.dependencies) || !Array.isArray(f.sources) || f.sources.length === 0 || !isObject(f.install)) return `library ${l.id}: facts need runsIn, dependencies, install and sources`;
    const pk = f.install.packages;
    if (!isText(f.install.measuredOn) || !Array.isArray(pk) || pk.length === 0 || pk.some(x => !isObject(x) || !isText(x.name) || !isText(x.version) || !Number.isInteger(x.packedBytes) || !Number.isInteger(x.unpackedBytes))) return `library ${l.id}: install must list packages with packed and unpacked bytes`;
  }
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
