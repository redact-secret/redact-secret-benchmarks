/**
 * The research projection (#590, #591; spec docs/specs/research-records.md): a read-only presentation copy of the canonical
 * credential-evidence records for the taxonomy's families, taken from the evidence release that `benchmarks/official-runs.json`
 * pins for the `public-evidence-snapshot` population. Pure: bytes and parsed objects in, a projection or a list of problems out.
 *
 * What it carries per family, from the records as written: the family's name, lifecycle (its review state), research state,
 * researched date, blockers and research issues; a summary of its review history (event counts, the latest event, every `decided`
 * ruling with its stable reference `<history id>#<seq>`); every format contract revision with its period, lifecycle and
 * `supersedes`; and the presented revision's structure, claims (evidence class, observed date, cited sources) and open questions.
 * Sources are listed once with their type, locator and last read date. Nothing is derived from a pattern or from claim text, no
 * value is invented for an absent field, and nothing about a scanner, the product or support status is in it.
 */
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECTION_SCHEMA = 'redact-secret/research-projection/v1';
export const RECORDS_ASSET = 'records-bundle.json';
export const MANIFEST_ASSET = 'release-manifest.json';
export const EVIDENCE_REPOSITORY = 'redact-secret/credential-evidence';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const READ_OUTCOMES = new Set(['read', 'unchanged', 'changed']);

/** The pin the projection is bound to: the `public-evidence-snapshot` population's evidence in the run registry. */
export function evidencePin(registry) {
  const population = registry?.populations?.find(p => p.id === 'public-evidence-snapshot');
  if (!population?.evidence?.release) throw new Error('benchmarks/official-runs.json has no public-evidence-snapshot evidence release');
  return population.evidence;
}

/**
 * The problems of a downloaded release against the pin: the manifest is the pinned one (digest and tag), it names the records
 * bundle with these bytes, and the bundle is the pinned source revision and schema. Empty when it is the pinned release.
 */
export function releaseProblems({ pin, manifestBytes, bundleBytes }) {
  const problems = [];
  const manifest = JSON.parse(manifestBytes);
  const bundle = JSON.parse(bundleBytes);
  if (`sha256:${sha256(manifestBytes)}` !== pin.release.manifestDigest) problems.push(`the release manifest is sha256:${sha256(manifestBytes)}, the registry pins ${pin.release.manifestDigest}`);
  if (manifest.tag !== pin.release.tag) problems.push(`the manifest is release ${manifest.tag}, the registry pins ${pin.release.tag}`);
  const tree = manifest.sourceRevision?.recordsTree;
  if (`${tree?.kind}:${tree?.digest}` !== pin.revision) problems.push(`the manifest records tree is ${tree?.kind}:${tree?.digest}, the registry pins ${pin.revision}`);
  const listed = manifest.files?.find(f => f.asset === RECORDS_ASSET);
  if (!listed) problems.push(`the manifest lists no ${RECORDS_ASSET}`);
  else if (listed.sha256 !== sha256(bundleBytes)) problems.push(`${RECORDS_ASSET} is sha256:${sha256(bundleBytes)}, the manifest lists sha256:${listed.sha256}`);
  if (bundle.format !== 'credential-evidence/records-bundle') problems.push(`${RECORDS_ASSET} is ${bundle.format}, not credential-evidence/records-bundle`);
  if (bundle.sourceRevision?.commit !== manifest.sourceRevision?.commit) problems.push(`the bundle is commit ${bundle.sourceRevision?.commit}, the manifest ${manifest.sourceRevision?.commit}`);
  if (`credential-evidence/schema/${bundle.schemaRevision}` !== pin.evidenceSchema) problems.push(`the bundle is schema ${bundle.schemaRevision}, the registry pins ${pin.evidenceSchema}`);
  return problems;
}

/** Each record's text, checked against the digest the bundle lists for it. Throws on a mismatch: a bundle that disagrees with itself is not read. */
function recordsOf(bundle, prefix) {
  return bundle.records.filter(r => r.path.startsWith(prefix)).map(r => {
    if (sha256(Buffer.from(r.text, 'utf8')) !== r.sha256) throw new Error(`${r.path}: the text does not match the bundle's sha256`);
    return { path: r.path, record: JSON.parse(r.text) };
  });
}

const latestRead = observations => {
  const read = observations.filter(o => READ_OUTCOMES.has(o.outcome)).map(o => o.observedAt).sort();
  return read.length ? read[read.length - 1].slice(0, 10) : null;
};

/**
 * The projection of `bundle` for the families in `familyIds` (the taxonomy's). A taxonomy family with no family record in the
 * release is simply absent: the page says "not recorded". `source` is the release identity written into the projection.
 */
export function projectResearch({ bundle, familyIds, source }) {
  const wanted = new Set(familyIds);
  const families = recordsOf(bundle, 'records/families/').filter(f => wanted.has(f.record.id));
  const contracts = recordsOf(bundle, 'records/contracts/').map(c => c.record);
  const reviews = new Map(recordsOf(bundle, 'records/reviews/').map(r => r.record).filter(r => r.subject.kind === 'family').map(r => [r.subject.id, r]));
  const sourceRecords = new Map(recordsOf(bundle, 'records/sources/').map(s => [s.record.id, s.record]));
  const cited = new Set();
  const out = {};
  for (const { path, record: family } of families.sort((a, b) => a.record.id.localeCompare(b.record.id))) {
    const revisions = contracts.filter(c => c.family === family.id).sort((a, b) => a.revision - b.revision);
    const presented = revisions.find(c => c.id === family.currentContract) ?? revisions[revisions.length - 1] ?? null;
    const history = reviews.get(family.id) ?? null;
    const events = history?.events ?? [];
    const latest = [...events].sort((a, b) => a.seq - b.seq).at(-1);
    const byType = {};
    for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;
    for (const claim of presented?.claims ?? []) for (const s of claim.sources) cited.add(s.sourceId);
    out[family.id] = {
      name: family.name,
      ...(family.aliases?.length ? { aliases: family.aliases } : {}),
      lifecycle: family.lifecycle,
      record: path,
      research: {
        state: family.research.state,
        researchedAt: family.research.researchedAt,
        blockers: (family.research.blockers ?? []).map(b => ({ kind: b.kind, summary: b.summary })),
        issues: family.research.issues ?? [],
      },
      review: {
        history: history?.id ?? null,
        events: events.length,
        byType,
        latest: latest ? { seq: latest.seq, type: latest.type, at: latest.at.slice(0, 10), role: latest.actor.role, affiliation: latest.actor.affiliation } : null,
        decided: events.filter(e => e.type === 'decided').map(e => ({ ref: `${history.id}#${e.seq}`, at: e.at.slice(0, 10), note: e.note })),
      },
      currentContract: family.currentContract ?? null,
      revisions: revisions.map(c => ({
        id: c.id, revision: c.revision, period: c.period, lifecycle: c.lifecycle, supersedes: c.supersedes,
        validity: { from: c.validity.from, until: c.validity.until }, current: c.id === family.currentContract,
      })),
      contract: presented && {
        id: presented.id,
        structure: presented.structure,
        claims: presented.claims.map(c => ({
          id: c.id, statement: c.statement, evidenceClass: c.evidenceClass, temporality: c.temporality, observedAt: c.observedAt.slice(0, 10),
          sources: c.sources.map(s => ({ sourceId: s.sourceId, supports: s.supports, ...(s.locator ? { locator: s.locator } : {}) })),
        })),
        openQuestions: (presented.openQuestions ?? []).map(q => ({ id: q.id, question: q.question, raisedAt: q.raisedAt })),
      },
    };
  }
  const sources = {};
  for (const id of [...cited].sort()) {
    const s = sourceRecords.get(id);
    if (!s) throw new Error(`a claim cites source ${id}, which the release does not hold`);
    const last = [...s.observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt)).at(-1);
    sources[id] = {
      title: s.title, ...(s.publisher ? { publisher: s.publisher } : {}), sourceType: s.sourceType,
      url: s.locator.url, pin: s.locator.pin.kind, lastReadAt: latestRead(s.observations), lastOutcome: last.outcome,
    };
  }
  return { schema: PROJECTION_SCHEMA, spec: 'docs/specs/research-records.md', source, families: out, sources };
}

/** The release identity a projection records, from the verified manifest and bundle bytes. */
export function sourceOf({ manifestBytes, bundleBytes }) {
  const manifest = JSON.parse(manifestBytes);
  return {
    repository: EVIDENCE_REPOSITORY,
    release: manifest.tag,
    manifestDigest: `sha256:${sha256(manifestBytes)}`,
    recordsBundleDigest: `sha256:${sha256(bundleBytes)}`,
    commit: manifest.sourceRevision.commit,
    recordsTree: `${manifest.sourceRevision.recordsTree.kind}:${manifest.sourceRevision.recordsTree.digest}`,
    schemaRevision: manifest.schemaRevision,
  };
}

/** Whether the projection was taken from the pinned release. Empty when it was. */
export function bindingProblems(projection, pin) {
  const s = projection?.source ?? {};
  const problems = [];
  if (s.release !== pin.release.tag) problems.push(`the projection is from ${s.release}, the registry pins ${pin.release.tag}`);
  if (s.manifestDigest !== pin.release.manifestDigest) problems.push(`the projection's manifest is ${s.manifestDigest}, the registry pins ${pin.release.manifestDigest}`);
  if (s.recordsTree !== pin.revision) problems.push(`the projection's records tree is ${s.recordsTree}, the registry pins ${pin.revision}`);
  if (`credential-evidence/schema/${s.schemaRevision}` !== pin.evidenceSchema) problems.push(`the projection is schema ${s.schemaRevision}, the registry pins ${pin.evidenceSchema}`);
  return problems;
}

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../schemas/research-projection-v1.json');
let compiled;
function schemaValidator() {
  if (!compiled) {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    compiled = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  }
  return compiled;
}

/**
 * The problems of a projection on its own and against the taxonomy: the schema, every family a taxonomy family, every cited source
 * listed, revisions in order with the presented one among them, the current contract one of them. Empty when it is usable.
 */
export function projectionProblems(projection, { familyIds }) {
  const validate = schemaValidator();
  if (!validate(projection)) return validate.errors.map(e => `schema: ${e.instancePath || '/'} ${e.message}`);
  const problems = [];
  const known = new Set(familyIds);
  for (const [id, f] of Object.entries(projection.families)) {
    if (!known.has(id)) problems.push(`${id} is not a taxonomy family`);
    const ids = f.revisions.map(r => r.id);
    f.revisions.forEach((r, i) => {
      if (r.id !== `${id}@${r.revision}`) problems.push(`${id}: revision ${r.id} is not ${id}@${r.revision}`);
      if (i > 0 && r.revision <= f.revisions[i - 1].revision) problems.push(`${id}: revisions are not in order`);
      if (r.current !== (r.id === f.currentContract)) problems.push(`${id}: ${r.id} current flag disagrees with currentContract`);
      if (r.supersedes !== null && !ids.includes(r.supersedes)) problems.push(`${id}: ${r.id} supersedes ${r.supersedes}, which is not listed`);
    });
    if (f.currentContract !== null && !ids.includes(f.currentContract)) problems.push(`${id}: current contract ${f.currentContract} is not among its revisions`);
    const expected = f.currentContract ?? f.revisions.at(-1)?.id ?? null;
    if ((f.contract?.id ?? null) !== expected) problems.push(`${id}: presented contract must be ${expected}`);
    if (f.contract && !ids.includes(f.contract.id)) problems.push(`${id}: presented contract ${f.contract.id} is not among its revisions`);
    if (!f.contract && ids.length) problems.push(`${id}: has revisions but presents none`);
    for (const c of f.contract?.claims ?? []) for (const s of c.sources) if (!projection.sources[s.sourceId]) problems.push(`${id}: claim ${c.id} cites ${s.sourceId}, which is not listed`);
    for (const d of f.review.decided) if (!d.ref.startsWith(`${f.review.history}#`)) problems.push(`${id}: ruling ${d.ref} is not in history ${f.review.history}`);
  }
  return problems;
}
