import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AXES, REAL_WORLD_AXES, controlAxis } from '../evaluation/domains/credential/assessment.ts';
import type { Fixture } from '../types.ts';
import { canonical } from './canonical.ts';
import { joinByKeys, type Joinable } from './parity.ts';

/**
 * The product-owned axis overlay of the public evidence snapshot (#636, docs/specs/qualification-inputs.md).
 *
 * The qualification floors count distinct positive-context axes (the authored context group of a secret-bearing
 * fixture) and distinct control axes (the reviewed benign taxonomy of a non-twin control). The public snapshot names a
 * case group by scenario and carries no benign taxonomy, so those two vocabularies are not in the artifact. They are
 * product policy (benchmarks/support/fixture-profiles.json `axes`), and the product's authored fixtures hold them. The
 * overlay carries them per canonical case id, DERIVED, never hand-authored: each snapshot case is joined to its legacy
 * development fixture by the same ordered content keys the parity report uses (SHA-256 of the content, expected spans,
 * fixture name), and the overlay takes that fixture's `group` and `controlAxis(category, fixture)`. A case that joins
 * nothing has no entry and keeps the snapshot's own vocabulary.
 *
 * It changes no evidence class, no outcome and no measured count: it only names the axis a counted case belongs to.
 * It is bound to one snapshot by `snapshot.corpusDigest`; the adapter refuses an artifact of another corpus.
 */
/** The fixture group of an overlay context axis (`<category>/<group>`); the cell axis. */
export const contextGroup = (axis: string) => axis.slice(axis.indexOf('/') + 1);

export const AXIS_OVERLAY_FILE = 'benchmarks/support/public-axis-overlay.json';
export const AXIS_OVERLAY_ID = 'credential-public-axis-overlay-v1';
export const OVERLAY_POPULATION = 'public-evidence-snapshot';

export interface AxisOverlay {
  schemaVersion: 1;
  id: typeof AXIS_OVERLAY_ID;
  population: typeof OVERLAY_POPULATION;
  owner: 'redact-secret-benchmarks';
  note: string;
  snapshot: { corpusDigest: string; cases: number };
  derivation: { join: string; contextAxis: string; controlAxis: string; joinedCases: number; unjoinedCases: number };
  /**
   * Case id to the context axis of a secret-bearing, non-twin fixture, written `<legacy category>/<fixture group>` (the axis the legacy
   * `positiveAxes` counted). The fixture group alone, after the first `/`, is the axis of the fixture-profile cell.
   */
  contexts: Record<string, string>;
  /** Case id to the reviewed benign taxonomy of a non-twin control; `null` is a control with no reviewed axis (pending), which counts toward none. */
  controls: Record<string, string | null>;
}

interface SnapshotCase { id: string; content: string; expected: { start: number; end: number; role?: string }[]; twin?: unknown }
export interface SnapshotLike { identity: { corpus_digest: string }; cases: SnapshotCase[] }

const root = fileURLToPath(new URL('../../', import.meta.url));
const readJson = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const suffixOf = (key: string) => key.slice(key.indexOf('--') + 2);

/** Ordered content keys, most specific first: bytes, expected ranges and fixture name; then each loosened in turn. */
export const contentKeys = (hash: string, expected: string, key: string) => [`${hash}|${expected}|${suffixOf(key)}`, `${hash}|${expected}`, `${hash}|${suffixOf(key)}`, hash];
export const expectedKey = (expected: { start: number; end: number }[]) => JSON.stringify(expected.map(e => [e.start, e.end]));

interface LegacyFixture extends Joinable { category: string; group: string; positive: boolean; twin: boolean; axis: string | null; tier: string }

/** The legacy development fixtures with the axes the legacy classifier counted. */
async function legacyFixtures(): Promise<LegacyFixture[]> {
  const categories: { id: string; corpus: string }[] = await readJson('benchmarks/categories.json');
  const development: string[] = (await readJson('corpora/development/manifest.json')).categories;
  const out: LegacyFixture[] = [];
  for (const category of categories.filter(c => development.includes(c.id))) {
    const corpus = await readJson(category.corpus);
    for (const f of corpus.fixtures as (Fixture & { assessment: { tier: string } })[]) {
      const slug = `${category.id}--${f.id}`;
      const secret = f.expected.some(e => (e.role ?? 'secret') === 'secret');
      const axis = !f.twinOf && !secret && f.assessment.tier !== 'T0' ? controlAxis(category.id, f) : null;
      out.push({ key: slug, scanners: {}, joinKeys: contentKeys(sha256(f.content), expectedKey(f.expected), slug), category: category.id, group: f.group, positive: !f.twinOf && secret, twin: Boolean(f.twinOf), axis: axis === 'pending' ? null : axis, tier: f.assessment.tier });
    }
  }
  return out;
}

/** Derive the overlay of one snapshot. Deterministic: the same snapshot and fixtures write the same bytes. */
export async function buildAxisOverlay(snapshot: SnapshotLike): Promise<AxisOverlay> {
  const legacy = await legacyFixtures();
  const next: (Joinable & { snapshot: SnapshotCase })[] = snapshot.cases.map(c => ({ key: c.id, scanners: {}, joinKeys: contentKeys(sha256(c.content), expectedKey(c.expected), c.id), snapshot: c }));
  const joined = joinByKeys(OVERLAY_POPULATION, legacy, next);
  const legacyByKey = new Map(legacy.map(l => [l.key, l]));
  const contexts: Record<string, string> = {}, controls: Record<string, string | null> = {};
  for (const pair of joined.pairs) {
    const l = legacyByKey.get(pair.legacy.key)!;
    const n = snapshot.cases.find(c => c.id === pair.next.key)!;
    const secret = n.expected.some(e => (e.role ?? 'secret') === 'secret');
    if (l.positive && secret && !n.twin) contexts[n.id] = `${l.category}/${l.group}`;
    else if (!l.twin && !secret && !n.twin) controls[n.id] = l.axis;
  }
  const sortedObject = <T>(o: Record<string, T>) => Object.fromEntries(Object.keys(o).sort(byteOrder).map(k => [k, o[k]]));
  return {
    schemaVersion: 1, id: AXIS_OVERLAY_ID, population: OVERLAY_POPULATION, owner: 'redact-secret-benchmarks',
    note: 'Product-owned, generated by npm run qualification:axis-overlay from the legacy development fixtures; never hand-edited. Names the source-context axis and the benign taxonomy axis of a counted case; it changes no evidence class, outcome or count. Not part of credential-evidence.',
    snapshot: { corpusDigest: snapshot.identity.corpus_digest, cases: snapshot.cases.length },
    derivation: {
      join: 'ordered content keys (sha256(content)|expected spans|fixture name, then looser), one to one, as in docs/specs/qualification-parity.md',
      contextAxis: 'the legacy `<category>/<group>` of a secret-bearing, non-twin fixture: the whole value is the `positiveAxes` axis, the group after the first `/` is the fixture-profile cell axis (benchmarks/support/fixture-profiles.json axes.positiveContext)',
      controlAxis: 'the legacy `controlAxis(category, fixture)` of a non-twin, non-secret, scored fixture (axes.control); pending is no axis',
      joinedCases: joined.pairs.length, unjoinedCases: joined.unmatchedNext.length + joined.ambiguous.next,
    },
    contexts: sortedObject(contexts), controls: sortedObject(controls),
  };
}

export const serializeAxisOverlay = (overlay: AxisOverlay) => `${canonical(overlay)}\n`;

/** Structural validation of a parsed overlay, without the snapshot: vocabulary, shape and uniqueness. Returns problems. */
export function axisOverlayProblems(overlay: unknown): string[] {
  const problems: string[] = [];
  const o = overlay as Partial<AxisOverlay> | null;
  if (!o || typeof o !== 'object') return ['the overlay is not an object'];
  if (o.schemaVersion !== 1 || o.id !== AXIS_OVERLAY_ID || o.population !== OVERLAY_POPULATION || o.owner !== 'redact-secret-benchmarks') problems.push('schemaVersion, id, population and owner must be the overlay identity');
  if (!/^sha256:[a-f0-9]{64}$/.test(o.snapshot?.corpusDigest ?? '')) problems.push('snapshot.corpusDigest must be sha256:<64 hex>');
  if (!o.contexts || typeof o.contexts !== 'object' || !o.controls || typeof o.controls !== 'object') return [...problems, 'contexts and controls are required objects'];
  const vocabulary = new Set<string>([...AXES, ...REAL_WORLD_AXES].filter(a => a !== 'pending'));
  for (const [id, axis] of Object.entries(o.contexts)) if (typeof axis !== 'string' || !/^[^/]+\/.+/.test(axis)) problems.push(`contexts[${id}] must be <category>/<group>`);
  for (const [id, axis] of Object.entries(o.controls)) if (axis !== null && !vocabulary.has(axis as string)) problems.push(`controls[${id}] is not a reviewed control axis (${String(axis)})`);
  for (const id of Object.keys(o.contexts)) if (id in o.controls) problems.push(`${id} is both a context and a control`);
  if (o.snapshot && Object.keys(o.contexts).length + Object.keys(o.controls).length > o.snapshot.cases) problems.push('more entries than snapshot cases');
  if (o.derivation && o.derivation.joinedCases !== undefined && o.snapshot && o.derivation.joinedCases + o.derivation.unjoinedCases !== o.snapshot.cases) problems.push('derivation.joinedCases + unjoinedCases must equal snapshot.cases');
  return problems;
}
