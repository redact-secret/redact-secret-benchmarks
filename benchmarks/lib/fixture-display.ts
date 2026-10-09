/** Current public display evidence, derived from byte-verified release assets, never used to score a run. */
import { createHash } from 'node:crypto';
import { authoredTextProblems, deriveEvidenceCaseMetadata, evidenceCaseMetadataProblems, type EvidencePin, type EvidenceCaseMetadata } from './fixture-metadata.ts';

export const FIXTURE_DISPLAY_FILE = 'benchmarks/inputs/fixture-display-v1.json';
export const FIXTURE_DISPLAY_SCHEMA = 'redact-secret/fixture-display/v1';
export const FIXTURE_DISPLAY_TRANSPORT_SCHEMA = 'redact-secret/fixture-display-transport/v1';
export const SNAPSHOT_ASSET = 'credential-eval-corpus-snapshot.json';
// Leave room for outcomes, spans and shared metadata within the 2 MiB records-file limit.
export const SUITE_CONTENT_BUDGET = 1024 * 1024;
export const BUDGET_NOTE = 'The pinned release records the exact bytes. This suite exceeds the 1 MiB input display budget within the 2 MiB records-file limit, so its bytes are not included in this view.';

type Span = { start: number; end: number; role?: string; envelope?: { start: number; end: number; reason?: string } };
export interface DisplayDescription { title: string; description: string; lifecycle: string; kind: 'case' | 'scenario'; record: string; sha256: string }
export interface DisplayAssessment { reason: string; sources: string[]; record: string; sha256: string }
export interface DisplayFixture {
  path: string; kind: string; tier: string; group: string; expected: Span[]; sha256: string; bytes: number;
  content?: string; description?: string; assessment?: string;
}
export interface FixtureDisplay {
  schema: typeof FIXTURE_DISPLAY_SCHEMA;
  source: EvidenceCaseMetadata['source'] & { snapshot: { asset: string; sha256: string } };
  descriptions: Record<string, DisplayDescription>;
  assessments: Record<string, DisplayAssessment>;
  fixtures: Record<string, DisplayFixture>;
  digest: string;
}
const hex = /^[a-f0-9]{64}$/;
const slug = /^[a-z0-9][a-z0-9._-]*--[a-z0-9][a-z0-9._-]*$/;
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const displayDigest = ({ digest: _digest, ...payload }: FixtureDisplay) => `sha256:${sha(JSON.stringify(payload))}`;
/** Encode the whole verified projection, including literals quoted in authored explanations. */
export function encodeFixtureDisplay(value: FixtureDisplay) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  return { schema: FIXTURE_DISPLAY_TRANSPORT_SCHEMA, encoding: 'base64', bytes: bytes.length, sha256: sha(bytes), payload: bytes.toString('base64') };
}

/** Decode before source and fixture commitments are checked. Base64 is transport, never redaction. */
export function decodeFixtureDisplay(value: unknown): FixtureDisplay {
  const f = value as Record<string, unknown>;
  if (f?.schema === FIXTURE_DISPLAY_SCHEMA) return value as FixtureDisplay;
  if (!f || f.schema !== FIXTURE_DISPLAY_TRANSPORT_SCHEMA || f.encoding !== 'base64' ||
      Object.keys(f).sort().join(',') !== 'bytes,encoding,payload,schema,sha256' ||
      !Number.isSafeInteger(f.bytes) || (f.bytes as number) < 1 || (f.bytes as number) > 16 * 1024 * 1024 ||
      typeof f.sha256 !== 'string' || !hex.test(f.sha256) || typeof f.payload !== 'string' ||
      f.payload.length !== 4 * Math.ceil((f.bytes as number) / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.payload))
    throw new Error('malformed fixture display transport');
  const bytes = Buffer.from(f.payload, 'base64');
  if (bytes.length !== f.bytes || bytes.toString('base64') !== f.payload || sha(bytes) !== f.sha256)
    throw new Error('fixture display transport byte commitment mismatch');
  const decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (decoded?.schema !== FIXTURE_DISPLAY_SCHEMA) throw new Error('invalid decoded fixture display schema');
  return decoded as FixtureDisplay;
}
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, canonical(x)])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
// The RunArtifact span contract omits construction notes, decoded representations and envelope prose.
const exportSpans = (spans: Span[]) => spans.map(s => ({ start: s.start, end: s.end, ...(s.role ? { role: s.role } : {}), ...(s.envelope ? { envelope: { start: s.envelope.start, end: s.envelope.end } } : {}) }));

/** Check offline integrity and source binding; upstream verification happens during derivation. */
export function fixtureDisplayProblems(value: unknown, pin: EvidencePin): string[] {
  try {
    const f = decodeFixtureDisplay(value);
    const problems = evidenceCaseMetadataProblems({ schema: 'redact-secret/evidence-case-metadata/v1', source: f.source, cases: {}, fixtures: {} }, pin);
    if (f.schema !== FIXTURE_DISPLAY_SCHEMA || f.digest !== displayDigest(f)) problems.push('display schema or digest mismatch');
    if (f.source.snapshot.asset !== SNAPSHOT_ASSET || !hex.test(f.source.snapshot.sha256)) problems.push('invalid snapshot commitment');
    if (!f.fixtures || !f.descriptions || !f.assessments) return [...problems, 'missing display dictionaries'];
    for (const [key, d] of Object.entries(f.descriptions)) {
      if (!['case', 'scenario'].includes(d.kind) || d.record !== key || !hex.test(d.sha256) || !/^[a-z0-9._-]+$/.test(d.lifecycle)) problems.push('invalid description provenance');
      problems.push(...authoredTextProblems(d.title, 160, 'display title'), ...authoredTextProblems(d.description, 2000, 'display description'));
    }
    for (const a of Object.values(f.assessments)) {
      if (!hex.test(a.sha256) || !a.record.startsWith('records/fixtures/') || !Array.isArray(a.sources) || a.sources.some(s => { try { return !['https:', 'http:'].includes(new URL(s).protocol); } catch { return true; } })) problems.push('invalid assessment provenance');
      // Upstream rationales may cite full public source digests, unlike short titles and descriptions.
      problems.push(...authoredTextProblems(a.reason, 6000, 'display rationale').filter(p => !p.includes('run of 32 or more')));
    }
    const suiteBytes = new Map<string, number>();
    for (const [id, d] of Object.entries(f.fixtures)) {
      if (!slug.test(id) || typeof d.path !== 'string' || !d.path || typeof d.group !== 'string' || !['must-redact', 'must-not-flag', 'policy'].includes(d.kind) || !/^T[0-3]$/.test(d.tier) || !hex.test(d.sha256) || !Number.isSafeInteger(d.bytes) || d.bytes < 0 || !Array.isArray(d.expected)) problems.push('invalid fixture display row');
      if (d.expected.some(s => !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) || s.start < 0 || s.end <= s.start || s.end > d.bytes || (s.role !== undefined && !['secret', 'companion'].includes(s.role)) || (s.envelope && (!Number.isSafeInteger(s.envelope.start) || !Number.isSafeInteger(s.envelope.end) || s.envelope.start < 0 || s.envelope.start > s.start || s.envelope.end < s.end || s.envelope.end > d.bytes)))) problems.push('invalid expected display span');
      if (d.description !== undefined && !Object.hasOwn(f.descriptions, d.description)) problems.push('missing description record');
      if (d.assessment !== undefined && !Object.hasOwn(f.assessments, d.assessment)) problems.push('missing assessment record');
      if (d.content !== undefined) {
        if (typeof d.content !== 'string' || sha(d.content) !== d.sha256 || Buffer.byteLength(d.content) !== d.bytes) problems.push('fixture input byte commitment mismatch');
        const suite = id.split('--')[0];
        suiteBytes.set(suite, (suiteBytes.get(suite) ?? 0) + Buffer.byteLength(d.content));
      }
    }
    if ([...suiteBytes.values()].some(n => n > SUITE_CONTENT_BUDGET)) problems.push('suite input display budget exceeded');
    return problems;
  } catch { return ['malformed fixture display evidence']; }
}

export function displayMatchesCase(d: DisplayFixture, c: { path: string; kind: string; tier: string; group: string; expected: unknown[] }): boolean {
  return d.path === c.path && d.kind === c.kind && d.tier === c.tier && d.group === c.group && same(d.expected, c.expected);
}

type Snapshot = { schema: string; identity: { source: string; revision: string; evidence_schema: string; corpus_digest: string }; cases: { id: string; path: string; content: string; expected: Span[]; grouping: { kind: string; tier: string; group: string } }[] };
type Materialized = { fixtures: { id: string; path: string; sha256: string; bytes: number; target: { type: string; id: string }; case?: string; expected: { outcome: string; spans: Span[] } }[] };
type RecordData = { id: string; title?: string; summary?: string; description?: string; lifecycle: string; locator?: { url: string }; evidence?: Record<string, { rationale: string; sources: { sourceId: string }[] }>; fixtures?: { id: string; sha256: string; evidence: string }[] };

export function deriveFixtureDisplay(input: { pin: EvidencePin; manifestBytes: Uint8Array; recordsBundleBytes: Uint8Array; materializedBytes: Uint8Array; snapshotBytes: Uint8Array }): FixtureDisplay {
  const metadata = deriveEvidenceCaseMetadata(input);
  const parse = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));
  const manifest = parse(input.manifestBytes);
  const entry = manifest.files.find((f: { asset: string }) => f.asset === SNAPSHOT_ASSET);
  if (!entry || entry.sha256 !== sha(input.snapshotBytes) || entry.bytes !== input.snapshotBytes.length) throw new Error('snapshot asset commitment mismatch');
  const snapshot = parse(input.snapshotBytes) as Snapshot;
  if (snapshot.schema !== 'credential-eval/corpus-snapshot/v1' || snapshot.identity.source !== 'credential-evidence' || snapshot.identity.corpus_digest !== input.pin.corpusDigest || snapshot.identity.revision !== `records-tree-sha256:${manifest.sourceRevision.recordsTree.digest}` || snapshot.identity.evidence_schema !== `credential-evidence/schema/${manifest.schemaRevision}` || snapshot.cases.length !== (manifest.evalExport?.exported ?? manifest.fixtures.count)) throw new Error('snapshot identity mismatch');
  const materialized = parse(input.materializedBytes) as Materialized;
  const material = new Map(materialized.fixtures.map(f => [f.id, f]));
  if (material.size !== materialized.fixtures.length || material.size !== manifest.fixtures.count) throw new Error('duplicate or incomplete materialized fixtures');
  const bundle = parse(input.recordsBundleBytes) as { records: { path: string; sha256: string; text: string }[] };
  const records = new Map<string, { data: RecordData; sha256: string }>();
  for (const r of bundle.records) {
    if (records.has(r.path) || sha(r.text) !== r.sha256) throw new Error('record commitment mismatch');
    records.set(r.path, { data: JSON.parse(r.text), sha256: r.sha256 });
  }
  const sourceUrls = new Map([...records.values()].flatMap(({ data: r }) => r.locator?.url ? [[r.id, r.locator.url] as const] : []));
  const assessmentByFixture = new Map<string, string>();
  const assessments: FixtureDisplay['assessments'] = {};
  for (const [path, { data: r, sha256 }] of records) {
    if (!path.startsWith('records/fixtures/')) continue;
    for (const f of r.fixtures ?? []) {
      const m = material.get(f.id);
      if (!m) continue;
      if (assessmentByFixture.has(f.id) || f.sha256 !== m.sha256) throw new Error('fixture-set commitment mismatch');
      if (f.evidence === undefined) continue;
      const a = r.evidence?.[f.evidence];
      if (!a) throw new Error('missing fixture evidence');
      const key = `${path}#${f.evidence}`;
      assessments[key] = { reason: a.rationale, sources: [...new Set(a.sources.map(s => { const url = sourceUrls.get(s.sourceId); if (!url) throw new Error('missing evidence source'); return url; }))], record: path, sha256 };
      assessmentByFixture.set(f.id, key);
    }
  }
  const suiteBytes = new Map<string, number>();
  for (const c of snapshot.cases) {
    const suite = c.id.split('--')[0];
    suiteBytes.set(suite, (suiteBytes.get(suite) ?? 0) + Buffer.byteLength(c.content));
  }
  const fixtures: FixtureDisplay['fixtures'] = {}, descriptions: FixtureDisplay['descriptions'] = {};
  for (const c of [...snapshot.cases].sort((a, b) => a.id < b.id ? -1 : 1)) {
    const m = material.get(c.id);
    if (Object.hasOwn(fixtures, c.id) || !m || m.path !== c.path || m.sha256 !== sha(c.content) || m.bytes !== Buffer.byteLength(c.content) || !same(exportSpans(m.expected.spans), exportSpans(c.expected)) || (m.expected.outcome === 'not-assertable' ? c.grouping.tier !== 'T0' : (m.expected.outcome === 'must-not-flag') !== (c.grouping.kind === 'must-not-flag'))) throw new Error(`snapshot fixture commitment mismatch: ${c.id}`);
    const type = m.target.type;
    const recordPath = type === 'case' ? `records/cases/${m.case ?? m.target.id}.json` : type === 'scenario' ? `records/scenarios/${m.target.id}.json` : undefined;
    if (recordPath) {
      const r = records.get(recordPath);
      if (!r || r.data.id !== (m.case ?? m.target.id)) throw new Error('missing target record');
      descriptions[recordPath] = { kind: type as 'case' | 'scenario', title: r.data.title!, description: (type === 'case' ? r.data.summary : r.data.description)!, lifecycle: r.data.lifecycle, record: recordPath, sha256: r.sha256 };
    }
    fixtures[c.id] = { path: c.path, kind: c.grouping.kind, tier: c.grouping.tier, group: c.grouping.group, expected: exportSpans(c.expected), sha256: m.sha256, bytes: m.bytes,
      ...((suiteBytes.get(c.id.split('--')[0]) ?? 0) <= SUITE_CONTENT_BUDGET ? { content: c.content } : {}),
      ...(recordPath ? { description: recordPath } : {}), ...(assessmentByFixture.has(c.id) ? { assessment: assessmentByFixture.get(c.id) } : {}),
    };
  }
  const out: FixtureDisplay = { schema: FIXTURE_DISPLAY_SCHEMA, source: { ...metadata.source, snapshot: { asset: SNAPSHOT_ASSET, sha256: entry.sha256 } }, descriptions, assessments, fixtures, digest: '' };
  out.digest = displayDigest(out);
  const problems = fixtureDisplayProblems(out, input.pin);
  if (problems.length) throw new Error(`Invalid fixture display evidence: ${problems.slice(0, 8).join('; ')}`);
  return out;
}
