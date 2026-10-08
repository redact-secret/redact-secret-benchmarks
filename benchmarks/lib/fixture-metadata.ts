/**
 * Authored fixture titles and descriptions (#593): who owns them and how they reach the fixture page.
 *
 * Two owners, never mixed (docs/specs/fixture-metadata.md):
 *  - a public evidence case's title and summary are credential-evidence's. `benchmarks/evidence-case-metadata.json` is a projection of the
 *    pinned release's case records (`records/cases/<case>.json`: `title`, `summary`, `lifecycle`), joined to fixture ids by the release's
 *    materialized-fixture manifest (`case`). It is derived by `npm run evidence:case-metadata`, verified against the release manifest the
 *    registry pins, and never edited by hand: the text is copied byte for byte, and the upstream records, the snapshot and its corpus digest are untouched;
 *  - a product-owned fixture's title and description (the regression and policy corpora this repository generates) are this repository's,
 *    authored in `benchmarks/fixture-descriptions.json`. A public-evidence fixture can never get one here: its text belongs upstream.
 *
 * Both are display text. Neither is an input of the fixture index identity, the corpus hashes, the generated-corpora manifest or any
 * scored value, so authoring or repinning them re-keys no observation (the identity section of the spec says how that is checked).
 */
import { createHash } from 'node:crypto';

export const EVIDENCE_CASE_METADATA_FILE = 'benchmarks/evidence-case-metadata.json';
export const FIXTURE_DESCRIPTIONS_FILE = 'benchmarks/fixture-descriptions.json';
export const EVIDENCE_CASE_METADATA_SCHEMA = 'redact-secret/evidence-case-metadata/v1';
export const FIXTURE_DESCRIPTIONS_SCHEMA = 'redact-secret/fixture-descriptions/v1';
export const EVIDENCE_REPOSITORY = 'redact-secret/credential-evidence';
export const RECORDS_BUNDLE_ASSET = 'records-bundle.json';
export const MATERIALIZED_MANIFEST_ASSET = 'fixtures-materialized-manifest.json';

/** The longest title and description the page shows: a title is one line, a description a sentence or two. */
export const TITLE_MAX = 160;
export const DESCRIPTION_MAX = 600;

export interface CaseText { title: string; summary: string; lifecycle: string; record: string; sha256: string }
export interface EvidenceCaseMetadata {
  schema: typeof EVIDENCE_CASE_METADATA_SCHEMA;
  spec: string;
  note: string;
  source: {
    repository: typeof EVIDENCE_REPOSITORY;
    tag: string;
    manifestDigest: string;
    corpusDigest: string;
    sourceCommit: string;
    recordsBundle: { asset: string; sha256: string };
    materializedManifest: { asset: string; sha256: string; digest: string };
  };
  /** One entry per upstream case record a fixture targets, by case id. */
  cases: Record<string, CaseText>;
  /** The case each fixture of the release targets, by fixture id. A fixture the release attaches to a scenario, not a case, is absent. */
  fixtures: Record<string, string>;
}

export interface AuthoredDescription { title: string; description: string; authoredOn: string }
export interface FixtureDescriptions {
  schema: typeof FIXTURE_DESCRIPTIONS_SCHEMA;
  spec: string;
  note: string;
  /** By fixture slug (`<category>--<id>`); every category is a product-owned one (`benchmarks/generated-populations.json`). */
  fixtures: Record<string, AuthoredDescription>;
}

/** The pin of the public evidence population (`benchmarks/official-runs.json` `populations[].evidence`). */
export interface EvidencePin { corpusDigest: string; release: { tag: string; manifestDigest: string } }

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HEX = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9._-]*$/;
const SLUG = /^[a-z0-9][a-z0-9._-]*--[a-z0-9][a-z0-9._-]*$/;
// No control character, line break or bidi override: the text is one line on the page.
const CONTROL = new RegExp(`[${[[0x00, 0x1f], [0x7f, 0x9f], [0x2028, 0x2029], [0x202a, 0x202e], [0x2066, 0x2069]].map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join('')}]`, 'u');
// A run of 32 letters and digits with no separator is the shape of a credential value, never of a title (a guard against pasting a fixture's bytes).
const OPAQUE = /[A-Za-z0-9]{32,}/;

const sha256Hex = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

/** Why a title or description cannot be shown; empty when it can. */
export function authoredTextProblems(text: unknown, max: number, where: string): string[] {
  if (typeof text !== 'string' || !text.length) return [`${where}: must be a non-empty string`];
  const problems: string[] = [];
  if (text !== text.trim()) problems.push(`${where}: leading or trailing whitespace`);
  if (text.length > max) problems.push(`${where}: ${text.length} characters, over ${max}`);
  if (CONTROL.test(text)) problems.push(`${where}: holds a control character or line break`);
  if (OPAQUE.test(text)) problems.push(`${where}: holds a run of 32 or more letters and digits, the shape of a value rather than a description`);
  return problems;
}

/** Why the committed projection is not the one for this pin; empty when it is. Offline: the text itself is checked, the upstream bytes are not re-read. */
export function evidenceCaseMetadataProblems(file: unknown, pin: EvidencePin): string[] {
  const f = file as Partial<EvidenceCaseMetadata> | null;
  if (!f || typeof f !== 'object') return ['not an object'];
  const problems: string[] = [];
  if (f.schema !== EVIDENCE_CASE_METADATA_SCHEMA) problems.push(`schema must be ${EVIDENCE_CASE_METADATA_SCHEMA}`);
  const s = f.source;
  if (!s || s.repository !== EVIDENCE_REPOSITORY) problems.push(`source.repository must be ${EVIDENCE_REPOSITORY}`);
  else {
    if (s.tag !== pin.release.tag) problems.push(`source.tag is ${s.tag}, the registry pins ${pin.release.tag} (run npm run evidence:case-metadata)`);
    if (s.manifestDigest !== pin.release.manifestDigest) problems.push(`source.manifestDigest is ${s.manifestDigest}, the registry pins ${pin.release.manifestDigest}`);
    if (s.corpusDigest !== pin.corpusDigest) problems.push(`source.corpusDigest is ${s.corpusDigest}, the registry pins ${pin.corpusDigest}`);
    if (!/^[0-9a-f]{40}$/.test(s.sourceCommit ?? '')) problems.push('source.sourceCommit must be a 40-hex commit');
    if (s.recordsBundle?.asset !== RECORDS_BUNDLE_ASSET || !HEX.test(s.recordsBundle?.sha256 ?? '')) problems.push('source.recordsBundle must name the records bundle and its sha256');
    if (s.materializedManifest?.asset !== MATERIALIZED_MANIFEST_ASSET || !HEX.test(s.materializedManifest?.sha256 ?? '') || !HEX.test(s.materializedManifest?.digest ?? '')) problems.push('source.materializedManifest must name the manifest, its sha256 and its digest');
  }
  const cases = f.cases && typeof f.cases === 'object' ? f.cases : {};
  if (!f.cases || typeof f.cases !== 'object') problems.push('cases must be an object');
  for (const [id, c] of Object.entries(cases)) {
    if (!ID.test(id)) problems.push(`cases.${id}: not a case id`);
    problems.push(...authoredTextProblems(c?.title, TITLE_MAX, `cases.${id}.title`), ...authoredTextProblems(c?.summary, DESCRIPTION_MAX, `cases.${id}.summary`));
    if (!ID.test(c?.lifecycle ?? '')) problems.push(`cases.${id}.lifecycle: must be the record's lifecycle word`);
    if (c?.record !== `records/cases/${id}.json`) problems.push(`cases.${id}.record: must be records/cases/${id}.json`);
    if (!HEX.test(c?.sha256 ?? '')) problems.push(`cases.${id}.sha256: must be the record's sha256`);
  }
  const fixtures = f.fixtures && typeof f.fixtures === 'object' ? f.fixtures : {};
  if (!f.fixtures || typeof f.fixtures !== 'object') problems.push('fixtures must be an object');
  const used = new Set<string>();
  for (const [id, caseId] of Object.entries(fixtures)) {
    if (!SLUG.test(id)) problems.push(`fixtures.${id}: not a fixture id`);
    if (!Object.hasOwn(cases, caseId)) problems.push(`fixtures.${id}: names case ${caseId}, which has no entry`);
    used.add(caseId);
  }
  for (const id of Object.keys(cases)) if (!used.has(id)) problems.push(`cases.${id}: no fixture targets it`);
  return problems;
}

/** Why the authored overlay cannot be used; empty when it can. `productSlugs` is every fixture slug of a product-owned category. */
export function fixtureDescriptionsProblems(file: unknown, productSlugs: ReadonlySet<string>): string[] {
  const f = file as Partial<FixtureDescriptions> | null;
  if (!f || typeof f !== 'object') return ['not an object'];
  const problems: string[] = [];
  if (f.schema !== FIXTURE_DESCRIPTIONS_SCHEMA) problems.push(`schema must be ${FIXTURE_DESCRIPTIONS_SCHEMA}`);
  if (!f.fixtures || typeof f.fixtures !== 'object') return [...problems, 'fixtures must be an object'];
  for (const [slug, d] of Object.entries(f.fixtures)) {
    if (!productSlugs.has(slug)) problems.push(`fixtures.${slug}: not a fixture of a product-owned category (a public evidence case's title belongs to credential-evidence)`);
    problems.push(...authoredTextProblems(d?.title, TITLE_MAX, `fixtures.${slug}.title`), ...authoredTextProblems(d?.description, DESCRIPTION_MAX, `fixtures.${slug}.description`));
    if (!DATE.test(d?.authoredOn ?? '')) problems.push(`fixtures.${slug}.authoredOn: must be YYYY-MM-DD`);
    if (Object.keys(d ?? {}).some(k => !['title', 'description', 'authoredOn'].includes(k))) problems.push(`fixtures.${slug}: only title, description and authoredOn are allowed`);
  }
  return problems;
}

/**
 * Whether the projection describes the snapshot a run measured: the release tag, its manifest digest and the corpus digest must all be the
 * run's own (`artifact.manifest.evidence`). Returns why not, or `undefined` when it does. A projection of another snapshot is never shown.
 */
export function caseMetadataBindingProblem(file: EvidenceCaseMetadata, evidence: { corpus_digest: string; release?: { tag: string; manifest_digest: string } | null }): string | undefined {
  if (!evidence.release) return 'the run names no evidence release, so no case record can be matched to it';
  if (file.source.tag !== evidence.release.tag || file.source.manifestDigest !== evidence.release.manifest_digest) return `the case titles are from ${file.source.tag}, the run measured ${evidence.release.tag}`;
  if (file.source.corpusDigest !== evidence.corpus_digest) return `the case titles are bound to corpus ${file.source.corpusDigest}, the run measured ${evidence.corpus_digest}`;
  return undefined;
}

interface ReleaseFile { asset: string; bytes: number; sha256: string }
interface ReleaseManifest { format: string; tag: string; sourceRevision?: { commit?: string }; fixtures?: { digest?: string; count?: number }; files?: ReleaseFile[] }

/**
 * Derive the projection from the downloaded release files. Refuses unless the manifest is the pinned one, each asset's bytes are the ones it
 * lists, the materialized manifest is the one its fixture digest names, and the records bundle is from the manifest's source commit. Pure.
 */
export function deriveEvidenceCaseMetadata({ pin, manifestBytes, recordsBundleBytes, materializedBytes }: {
  pin: EvidencePin; manifestBytes: Uint8Array; recordsBundleBytes: Uint8Array; materializedBytes: Uint8Array;
}): EvidenceCaseMetadata {
  const problems: string[] = [];
  const manifestDigest = `sha256:${sha256Hex(manifestBytes)}`;
  if (!DIGEST.test(pin.release.manifestDigest) || manifestDigest !== pin.release.manifestDigest) problems.push(`release manifest digest is ${manifestDigest}, the registry pins ${pin.release.manifestDigest}`);
  const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));
  const manifest = decode(manifestBytes) as ReleaseManifest;
  if (manifest.format !== 'credential-evidence/release-manifest') problems.push(`manifest format is ${manifest.format}`);
  if (manifest.tag !== pin.release.tag) problems.push(`manifest names ${manifest.tag}, the registry pins ${pin.release.tag}`);
  const asset = (name: string, bytes: Uint8Array): string => {
    const entry = (manifest.files ?? []).find(f => f.asset === name);
    const hex = sha256Hex(bytes);
    if (!entry) problems.push(`the manifest lists no ${name}`);
    else if (entry.sha256 !== hex || entry.bytes !== bytes.length) problems.push(`${name} is not the bytes the manifest lists`);
    return hex;
  };
  const recordsSha = asset(RECORDS_BUNDLE_ASSET, recordsBundleBytes);
  const materializedSha = asset(MATERIALIZED_MANIFEST_ASSET, materializedBytes);
  const bundle = decode(recordsBundleBytes) as { format?: string; sourceRevision?: { commit?: string }; records?: { path: string; sha256: string; text: string }[] };
  const materialized = decode(materializedBytes) as { format?: string; digest?: string; fixtures?: { id: string; case?: string; target?: { type?: string } }[] };
  const commit = manifest.sourceRevision?.commit ?? '';
  if (bundle.format !== 'credential-evidence/records-bundle') problems.push(`records bundle format is ${bundle.format}`);
  if (bundle.sourceRevision?.commit !== commit) problems.push(`the records bundle is from ${bundle.sourceRevision?.commit}, the manifest from ${commit}`);
  if (materialized.format !== 'credential-evidence/materialized-fixtures') problems.push(`materialized manifest format is ${materialized.format}`);
  if (!materialized.digest || materialized.digest !== manifest.fixtures?.digest) problems.push('the materialized manifest digest is not the release manifest\'s fixture digest');
  if (problems.length) throw new Error(`The release files are not the pinned ${pin.release.tag}:\n  - ${problems.join('\n  - ')}`);

  const records = new Map((bundle.records ?? []).filter(r => r.path.startsWith('records/cases/')).map(r => [r.path, r]));
  const fixtures: Record<string, string> = {};
  const cases: Record<string, CaseText> = {};
  for (const f of [...(materialized.fixtures ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (f.target?.type !== 'case' || !f.case) continue;
    const path = `records/cases/${f.case}.json`;
    const record = records.get(path);
    if (!record) throw new Error(`${f.id} targets case ${f.case}, which the records bundle does not hold`);
    if (sha256Hex(record.text) !== record.sha256) throw new Error(`${path}: the bundle's text is not its sha256`);
    if (!cases[f.case]) {
      const r = JSON.parse(record.text) as { id?: string; title?: string; summary?: string; lifecycle?: string };
      if (r.id !== f.case) throw new Error(`${path} holds case ${r.id}`);
      cases[f.case] = { title: r.title as string, summary: r.summary as string, lifecycle: r.lifecycle as string, record: path, sha256: record.sha256 };
    }
    fixtures[f.id] = f.case;
  }
  const out: EvidenceCaseMetadata = {
    schema: EVIDENCE_CASE_METADATA_SCHEMA,
    spec: 'docs/specs/fixture-metadata.md',
    note: 'Derived by npm run evidence:case-metadata from the pinned credential-evidence release. Do not edit: the titles and summaries are the upstream case records\' own text, copied byte for byte. Display text only: no fixture index identity, corpus hash or scored value reads this file.',
    source: {
      repository: EVIDENCE_REPOSITORY, tag: pin.release.tag, manifestDigest, corpusDigest: pin.corpusDigest, sourceCommit: commit,
      recordsBundle: { asset: RECORDS_BUNDLE_ASSET, sha256: recordsSha },
      materializedManifest: { asset: MATERIALIZED_MANIFEST_ASSET, sha256: materializedSha, digest: materialized.digest! },
    },
    cases: Object.fromEntries(Object.entries(cases).sort(([a], [b]) => (a < b ? -1 : 1))),
    fixtures,
  };
  const left = evidenceCaseMetadataProblems(out, pin);
  if (left.length) throw new Error(`The derived case metadata is not usable:\n  - ${left.join('\n  - ')}`);
  return out;
}

/** The committed text of the projection: stable key order and a trailing newline, so a re-derivation is byte-identical. */
export const serializeCaseMetadata = (file: EvidenceCaseMetadata): string => `${JSON.stringify(file, null, 2)}\n`;
