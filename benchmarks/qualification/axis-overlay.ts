import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AXES, REAL_WORLD_AXES, controlAxis, scoredContractIds } from '../evaluation/domains/credential/assessment.ts';
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
 * It also carries the product's attribution of a case to its detector families (#638): the legacy path scoped a fixture to the
 * detectors in its `targets` (benchmarks/fixture-detectors.json, else the fixture's own `detectors`, plus arrival targets), and
 * some public cases name no family or target the product maps to a detector, so the adapter would attribute them to none. `detectors` carries the legacy
 * targets of every joined case that has any; the adapter reads it only for a case the snapshot attributes to no detector.
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
  derivation: { join: string; contextAxis: string; controlAxis: string; detectors: string; joinedCases: number; unjoinedCases: number };
  /**
   * Case id to the context axis of a secret-bearing, non-twin fixture, written `<legacy category>/<fixture group>` (the axis the legacy
   * `positiveAxes` counted). The fixture group alone, after the first `/`, is the axis of the fixture-profile cell.
   */
  contexts: Record<string, string>;
  /** Case id to the product detector families the legacy path scoped the fixture to (its `targets`, filtered to product detector ids, sorted). Used only where the snapshot attributes a case to no detector. */
  detectors: Record<string, string[]>;
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

interface LegacyFixture extends Joinable { category: string; group: string; positive: boolean; twin: boolean; axis: string | null; tier: string; targets: string[] }

/** The legacy fixtures of one visibility (the development partition by default) with the axes the legacy classifier counted. */
export async function legacyFixtures(visibility: 'development' | 'regression' = 'development'): Promise<LegacyFixture[]> {
  const productDetectors = new Set<string>(scoredContractIds);
  const fixtureDetectors: Record<string, string[]> = await readJson('benchmarks/fixture-detectors.json');
  const categories: { id: string; corpus: string }[] = await readJson('benchmarks/categories.json');
  const development: string[] = (await readJson(`corpora/${visibility}/manifest.json`)).categories;
  const out: LegacyFixture[] = [];
  for (const category of categories.filter(c => development.includes(c.id))) {
    const corpus = await readJson(category.corpus);
    for (const f of corpus.fixtures as (Fixture & { assessment: { tier: string }; arrivalTargets?: string[] })[]) {
      const slug = `${category.id}--${f.id}`;
      const secret = f.expected.some(e => (e.role ?? 'secret') === 'secret');
      const axis = !f.twinOf && !secret && f.assessment.tier !== 'T0' ? controlAxis(category.id, f) : null;
      out.push({ key: slug, scanners: {}, joinKeys: contentKeys(sha256(f.content), expectedKey(f.expected), slug), category: category.id, group: f.group, positive: !f.twinOf && secret, twin: Boolean(f.twinOf), axis: axis === 'pending' ? null : axis, tier: f.assessment.tier,
        targets: [...new Set([...(fixtureDetectors[slug] ?? f.detectors ?? []), ...(f.arrivalTargets ?? [])].filter(d => productDetectors.has(d)))].sort(byteOrder) });
    }
  }
  return out;
}

/**
 * The legacy fixture slug (`<category>--<fixture id>`) of each canonical case id the content join pairs, one to one (nothing is
 * guessed). Shared with the review-ledger re-key. Two stages: the development partition first (the join of the parity report and
 * the overlay, unchanged), then the legacy regression fixtures against the snapshot cases still unpaired. The evidence release
 * also publishes some fixtures the legacy path kept in its regression corpus (the same bytes, expected spans and fixture name),
 * and a review decision is about a case, not about the population that held it; the second stage only identifies those cases.
 * No count of any population reads it.
 */
export async function joinLegacyToSnapshot(snapshot: SnapshotLike): Promise<Map<string, string>> {
  const next: Joinable[] = snapshot.cases.map(c => ({ key: c.id, scanners: {}, joinKeys: contentKeys(sha256(c.content), expectedKey(c.expected), c.id) }));
  const first = joinByKeys(OVERLAY_POPULATION, await legacyFixtures('development'), next);
  const paired = new Set(first.pairs.map(p => p.next.key));
  const second = joinByKeys(OVERLAY_POPULATION, await legacyFixtures('regression'), next.filter(n => !paired.has(n.key)));
  return new Map([...first.pairs, ...second.pairs].map(p => [p.legacy.key, p.next.key]));
}

/** Derive the overlay of one snapshot. Deterministic: the same snapshot and fixtures write the same bytes. */
export async function buildAxisOverlay(snapshot: SnapshotLike): Promise<AxisOverlay> {
  const legacy = await legacyFixtures();
  const next: (Joinable & { snapshot: SnapshotCase })[] = snapshot.cases.map(c => ({ key: c.id, scanners: {}, joinKeys: contentKeys(sha256(c.content), expectedKey(c.expected), c.id), snapshot: c }));
  const joined = joinByKeys(OVERLAY_POPULATION, legacy, next);
  const legacyByKey = new Map(legacy.map(l => [l.key, l]));
  const contexts: Record<string, string> = {}, controls: Record<string, string | null> = {}, detectors: Record<string, string[]> = {};
  for (const pair of joined.pairs) {
    const l = legacyByKey.get(pair.legacy.key)!;
    const n = snapshot.cases.find(c => c.id === pair.next.key)!;
    const secret = n.expected.some(e => (e.role ?? 'secret') === 'secret');
    if (l.targets.length) detectors[n.id] = l.targets;
    if (l.positive && secret && !n.twin) contexts[n.id] = `${l.category}/${l.group}`;
    else if (!l.twin && !secret && !n.twin) controls[n.id] = l.axis;
  }
  const sortedObject = <T>(o: Record<string, T>) => Object.fromEntries(Object.keys(o).sort(byteOrder).map(k => [k, o[k]]));
  return {
    schemaVersion: 1, id: AXIS_OVERLAY_ID, population: OVERLAY_POPULATION, owner: 'redact-secret-benchmarks',
    note: 'Product-owned, generated by npm run qualification:axis-overlay from the legacy development fixtures; never hand-edited. Names the source-context axis and the benign taxonomy axis of a counted case, and the detector families the legacy path scoped it to; it changes no evidence class, outcome or measured count. Not part of credential-evidence.',
    snapshot: { corpusDigest: snapshot.identity.corpus_digest, cases: snapshot.cases.length },
    derivation: {
      join: 'ordered content keys (sha256(content)|expected spans|fixture name, then looser), one to one, as in docs/specs/qualification-parity.md',
      contextAxis: 'the legacy `<category>/<group>` of a secret-bearing, non-twin fixture: the whole value is the `positiveAxes` axis, the group after the first `/` is the fixture-profile cell axis (benchmarks/support/fixture-profiles.json axes.positiveContext)',
      controlAxis: 'the legacy `controlAxis(category, fixture)` of a non-twin, non-secret, scored fixture (axes.control); pending is no axis',
      detectors: 'the legacy case targets (fixture-detectors.json, else the fixture detectors, plus arrival targets) filtered to product detector ids; read only where the snapshot attributes a case to no detector (docs/specs/qualification-adapter.md, Attribution)',
      joinedCases: joined.pairs.length, unjoinedCases: joined.unmatchedNext.length + joined.ambiguous.next,
    },
    contexts: sortedObject(contexts), detectors: sortedObject(detectors), controls: sortedObject(controls),
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
  if (!o.detectors || typeof o.detectors !== 'object') return [...problems, 'detectors is a required object'];
  const productDetectors = new Set<string>(scoredContractIds);
  for (const [id, list] of Object.entries(o.detectors)) {
    if (!Array.isArray(list) || !list.length || list.some(d => !productDetectors.has(d)) || new Set(list).size !== list.length || list.some((d, i) => i > 0 && Buffer.compare(Buffer.from(list[i - 1]), Buffer.from(d)) >= 0))
      problems.push(`detectors[${id}] must be a sorted, unique, non-empty list of product detector ids`);
  }
  for (const id of Object.keys(o.contexts)) if (id in o.controls) problems.push(`${id} is both a context and a control`);
  if (o.snapshot && (Object.keys(o.contexts).length + Object.keys(o.controls).length > o.snapshot.cases || Object.keys(o.detectors).length > o.snapshot.cases)) problems.push('more entries than snapshot cases');
  if (o.derivation && o.derivation.joinedCases !== undefined && o.snapshot && o.derivation.joinedCases + o.derivation.unjoinedCases !== o.snapshot.cases) problems.push('derivation.joinedCases + unjoinedCases must equal snapshot.cases');
  return problems;
}
