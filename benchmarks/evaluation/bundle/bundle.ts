/**
 * The public evaluation bundle (#788; contract: docs/specs/evaluation-report-storage.md): `evaluation-public` stored as a manifest, one summary part and bounded detail parts instead of the
 * single `evaluation-v1.json`. The storage version (`redact-secret/evaluation-bundle/v1`) is separate from the scoring and accounting identity (`manifest.report`, the unchanged
 * evaluation-public schema 2 / accounting 1.1): a storage change never re-keys a measurement.
 *
 * Layout under `<results>/evaluation-bundles/<bundleId>/`: `manifest.json`, `summary.json`, `cases/<method>-NNNN.json`, `reviews/reviews-NNNN.json`. A mutable pointer
 * `<results>/evaluation-bundle-v1.json` names the manifest by path and digest. Details are immutable and content-bound: the manifest records every part's SHA-256, size and record count and the
 * bundle id is derived from them. Writing stages everything, publishes the immutable directory, reads it back through the validator, and only then moves the pointer.
 * Validation streams one part at a time and never rebuilds the whole report; its memory is the id index (one small entry per case and review), not the document.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import publicSchema from '../../../schemas/evaluation-public-v1.json';
import { METHODS, addOperatorEvidence, ajv, canonical, checkPublicCase, checkPublicReview, counts, type EvaluationLedgerView } from '../../shared/evaluation-model.ts';
import type { Counts, EvaluationCase, EvaluationReport, EvaluationReview } from '../../shared/evaluation-types.ts';
import { DEFAULT_MAX_PART_BYTES, SAFE_PART_PATH, documentBytes, partRefProblem, readDocumentPart, sha256Of, type PartRef } from '../storage/parts.ts';

export const BUNDLE_SCHEMA = 'redact-secret/evaluation-bundle/v1';
export const BUNDLE_POINTER_SCHEMA = 'redact-secret/evaluation-bundle-pointer/v1';
export const BUNDLE_PART_SCHEMA = 'redact-secret/evaluation-bundle-part/v1';
export const POINTER_FILE = 'evaluation-bundle-v1.json';
export const BUNDLES_DIR = 'evaluation-bundles';
const MAX_SMALL_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const CASE_METHODS = METHODS.slice(0, 5);

export type Summary = Omit<EvaluationReport, 'cases' | 'reviews'>;
export interface CasePartRef extends PartRef { method: string; index: number; firstId: string; lastId: string }
export interface ReviewPartRef extends PartRef { index: number; firstId: string; lastId: string }
export interface BundleTotals { cases: number; variants: number; assertions: Counts; reviews: number; byMethod: Record<string, { cases: number; variants: number; assertions: Counts }> }
export interface BundleManifest {
  schema: typeof BUNDLE_SCHEMA; storageVersion: 1;
  /** The scoring and accounting identity of the stored report, unchanged by the storage version. */
  report: { schemaVersion: 2; accountingVersion: '1.1'; reportType: 'evaluation-public'; supportClaims: false };
  bundleId: string; runId: string; startedAt: string; finishedAt: string; casesHash: string; maxPartBytes: number;
  summary: PartRef; totals: BundleTotals; cases: CasePartRef[]; reviews: ReviewPartRef[];
}
export interface BundlePointer { schema: typeof BUNDLE_POINTER_SCHEMA; bundleId: string; runId: string; finishedAt: string; manifest: { path: string; sha256: string; bytes: number } }
/** The index the validator keeps while streaming, for ledger reconciliation and the consumer's own derivations: one small entry per case and per review. */
export interface BundleIndex { runId: string; finishedAt: string; cases: Map<string, { method: string; sourceSlug: string }>; reviews: Map<string, { caseId: string; variant: string }> }
export class BundleError extends Error {}
const fail = (message: string): never => { throw new BundleError(message); };
/** Every refusal of the bundle layer is a BundleError, including those raised by the part reader (size, digest) and by JSON parsing. */
const guard = async <T>(read: () => Promise<T>): Promise<T> => { try { return await read(); } catch (error) { throw error instanceof BundleError ? error : new BundleError(error instanceof Error ? error.message : String(error)); } };
const readPart = <T>(dir: string, ref: PartRef, maxBytes: number) => guard(() => readDocumentPart<T>(dir, ref, maxBytes));

const props = (publicSchema as any).properties; // eslint-disable-line @typescript-eslint/no-explicit-any
const partSchema = (role: string, list: string, items: unknown, extra: Record<string, unknown>) => ajv.compile({ type: 'object', additionalProperties: false,
  properties: { schema: { const: BUNDLE_PART_SCHEMA }, role: { const: role }, runId: { type: 'string' }, casesHash: { type: 'string' }, ...extra, [list]: { type: 'array', items } },
  required: ['schema', 'role', 'runId', 'casesHash', ...Object.keys(extra), list] });
const validCasePart = partSchema('cases', 'cases', props.cases.items, { method: { enum: CASE_METHODS }, index: { type: 'integer', minimum: 0 } });
const validReviewPart = partSchema('reviews', 'reviews', props.reviews.items, { index: { type: 'integer', minimum: 0 } });
const summarySchema = (() => { const { cases: _c, reviews: _r, ...rest } = props; return { ...(publicSchema as any), $id: 'urn:redact-secret:evaluation-bundle-summary:1', properties: rest, required: (publicSchema as any).required.filter((k: string) => k !== 'cases' && k !== 'reviews') }; })(); // eslint-disable-line @typescript-eslint/no-explicit-any
const validSummary = ajv.compile(summarySchema);
const validSummaryPart = ajv.compile({ type: 'object', additionalProperties: false, properties: { schema: { const: BUNDLE_PART_SCHEMA }, role: { const: 'summary' }, report: summarySchema }, required: ['schema', 'role', 'report'] });
void validSummary;

const addCounts = (into: Counts, from: Counts) => { for (const key of Object.keys(into) as (keyof Counts)[]) into[key] += from[key]; };
const sameCounts = (a: Counts, b: Counts) => canonical(a) === canonical(b);
const bundleIdOf = (m: Omit<BundleManifest, 'bundleId'>) => sha256Of(canonical({ summary: m.summary.sha256, cases: m.cases.map(p => [p.path, p.sha256]), reviews: m.reviews.map(p => [p.path, p.sha256]) })).slice(0, 32);

/** Accumulates cases and reviews of one run into bounded parts under a staging directory, then writes the summary and the manifest. */
export class BundleWriter {
  private readonly buffers = new Map<string, { index: number; cases: EvaluationCase[]; bytes: number }>();
  private reviewBuffer: EvaluationReview[] = [];
  private reviewBytes = 0;
  private reviewIndex = 0;
  private readonly caseParts: CasePartRef[] = [];
  private readonly reviewParts: ReviewPartRef[] = [];
  private readonly operators: EvaluationReport['byOperator'] = {};
  private readonly totals: BundleTotals = { cases: 0, variants: 0, assertions: counts(), reviews: 0, byMethod: {} };
  private readonly seen = new Set<string>();
  /** Largest part written, for the size evidence. */
  maxPartWritten = 0;
  /** What a part's envelope (schema, role, run binding, method, index, the empty list) costs; the records of a part may use the rest of the byte limit, so the whole part never exceeds it unless it is one oversized record. */
  private readonly envelopeBytes: number;
  constructor(private readonly staging: string, private readonly run: { runId: string; casesHash: string }, private readonly maxPartBytes = DEFAULT_MAX_PART_BYTES) {
    const widest = { schema: BUNDLE_PART_SCHEMA, role: 'reviews', runId: run.runId, casesHash: run.casesHash, method: 'differential', index: 999999 };
    this.envelopeBytes = Buffer.byteLength(documentBytes({ ...widest, cases: [] }));
  }
  private get budget() { return Math.max(1, this.maxPartBytes - this.envelopeBytes); }
  async open() { await mkdir(path.join(this.staging, 'cases'), { recursive: true }); await mkdir(path.join(this.staging, 'reviews'), { recursive: true }); }
  private async writePart(relative: string, document: unknown): Promise<PartRef & { bytes: number }> {
    const bytes = documentBytes(document), size = Buffer.byteLength(bytes);
    await writeFile(path.join(this.staging, relative), bytes, { flag: 'wx', mode: 0o644 });
    this.maxPartWritten = Math.max(this.maxPartWritten, size);
    return { path: relative, sha256: sha256Of(bytes), bytes: size, records: 0 };
  }
  private async flushCases(method: string) {
    const buffer = this.buffers.get(method);
    if (!buffer?.cases.length) return;
    const index = buffer.index++, relative = `cases/${method}-${String(index).padStart(4, '0')}.json`;
    const ref = await this.writePart(relative, { schema: BUNDLE_PART_SCHEMA, role: 'cases', runId: this.run.runId, casesHash: this.run.casesHash, method, index, cases: buffer.cases });
    this.caseParts.push({ ...ref, records: buffer.cases.length, method, index, firstId: buffer.cases[0].id, lastId: buffer.cases.at(-1)!.id, ...(ref.bytes > this.maxPartBytes ? { oversized: true as const } : {}) });
    buffer.cases = []; buffer.bytes = 0;
  }
  async addCase(c: EvaluationCase) {
    if (!CASE_METHODS.includes(c.method)) fail(`Case ${c.id} has method ${c.method}, which is not a public evaluation method`);
    if (this.seen.has(c.id)) fail(`Duplicate case id ${c.id}`);
    this.seen.add(c.id);
    const buffer = this.buffers.get(c.method) ?? (this.buffers.set(c.method, { index: 0, cases: [], bytes: 0 }), this.buffers.get(c.method)!);
    const size = Buffer.byteLength(JSON.stringify(c)) + 1;
    // A part is one document: close it before the case that would overflow it. A case larger than the limit is stored alone, whole, marked oversized.
    if (buffer.cases.length && buffer.bytes + size > this.budget) await this.flushCases(c.method);
    buffer.cases.push(c); buffer.bytes += size;
    if (size > this.budget) await this.flushCases(c.method);
    addOperatorEvidence(this.operators, c);
    const stats = (this.totals.byMethod[c.method] ??= { cases: 0, variants: 0, assertions: counts() });
    stats.cases += 1; stats.variants += c.variants.length; this.totals.cases += 1; this.totals.variants += c.variants.length;
    for (const a of c.assertions) { stats.assertions[a.status] += 1; this.totals.assertions[a.status] += 1; }
  }
  private async flushReviews() {
    if (!this.reviewBuffer.length) return;
    const index = this.reviewIndex++, relative = `reviews/reviews-${String(index).padStart(4, '0')}.json`;
    const ref = await this.writePart(relative, { schema: BUNDLE_PART_SCHEMA, role: 'reviews', runId: this.run.runId, casesHash: this.run.casesHash, index, reviews: this.reviewBuffer });
    this.reviewParts.push({ ...ref, records: this.reviewBuffer.length, index, firstId: this.reviewBuffer[0].id, lastId: this.reviewBuffer.at(-1)!.id, ...(ref.bytes > this.maxPartBytes ? { oversized: true as const } : {}) });
    this.reviewBuffer = []; this.reviewBytes = 0;
  }
  async addReview(r: EvaluationReview) {
    const size = Buffer.byteLength(JSON.stringify(r)) + 1;
    if (this.reviewBuffer.length && this.reviewBytes + size > this.budget) await this.flushReviews();
    this.reviewBuffer.push(r); this.reviewBytes += size; this.totals.reviews += 1;
    if (size > this.budget) await this.flushReviews();
  }
  /** The operator totals of the cases written so far: what the summary must carry. */
  operatorTotals() { return this.operators; }
  async finish(summary: Summary): Promise<BundleManifest> {
    for (const method of this.buffers.keys()) await this.flushCases(method);
    await this.flushReviews();
    const summaryRef = await this.writePart('summary.json', { schema: BUNDLE_PART_SCHEMA, role: 'summary', report: summary });
    const caseParts = [...this.caseParts].sort((a, b) => CASE_METHODS.indexOf(a.method) - CASE_METHODS.indexOf(b.method) || a.index - b.index);
    const body: Omit<BundleManifest, 'bundleId'> = { schema: BUNDLE_SCHEMA, storageVersion: 1,
      report: { schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false },
      runId: summary.runId, startedAt: summary.startedAt, finishedAt: summary.finishedAt, casesHash: summary.provenance.casesHash, maxPartBytes: this.maxPartBytes,
      summary: { ...summaryRef, records: 1, ...(summaryRef.bytes > this.maxPartBytes ? { oversized: true as const } : {}) }, totals: this.totals, cases: caseParts, reviews: this.reviewParts };
    const manifest: BundleManifest = { ...body, bundleId: bundleIdOf(body) };
    await writeFile(path.join(this.staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
    return manifest;
  }
}

/** The manifest and its structural rules: no detail is read. Throws BundleError. */
export function checkManifest(m: BundleManifest): void {
  if (m?.schema !== BUNDLE_SCHEMA || m.storageVersion !== 1) fail('Unsupported evaluation bundle manifest');
  if (canonical(m.report) !== canonical({ schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false })) fail('The bundle stores a report of another scoring or accounting identity');
  if (!/^[a-f0-9]{32}$/.test(m.bundleId) || !m.runId || !m.casesHash || !Number.isSafeInteger(m.maxPartBytes) || m.maxPartBytes < 1024) fail('Bundle manifest identity is invalid');
  const refs: PartRef[] = [m.summary, ...m.cases, ...m.reviews];
  const names = new Set<string>();
  for (const ref of refs) {
    const problem = partRefProblem(ref);
    if (problem) fail(problem);
    if (names.has(ref.path)) fail(`Part ${ref.path} is listed twice`);
    names.add(ref.path);
    if (ref.bytes > m.maxPartBytes && !(ref.oversized && ref.records === 1)) fail(`Part ${ref.path} is over the part limit and is not a single oversized record`);
  }
  if (m.summary.path !== 'summary.json') fail('The summary part must be summary.json');
  // The summary is one record: it may exceed the detail limit (marked oversized) but is bounded by the small-document limit; a larger one needs a new storage version, not a larger bundle.
  if (m.summary.bytes > MAX_SMALL_DOCUMENT_BYTES) fail('The summary part is over the small-document limit');
  const seenMethod = new Map<string, number>();
  let order = -1;
  for (const ref of m.cases) {
    const rank = CASE_METHODS.indexOf(ref.method);
    if (rank < 0 || !ref.path.startsWith(`cases/${ref.method}-`) || rank < order) fail(`Case part ${ref.path} is out of canonical method order`);
    order = rank;
    if (ref.index !== (seenMethod.get(ref.method) ?? 0)) fail(`Case parts of ${ref.method} are not contiguous at ${ref.path}`);
    seenMethod.set(ref.method, ref.index + 1);
    if (!ref.records) fail(`Case part ${ref.path} is empty`);
  }
  m.reviews.forEach((ref, i) => { if (ref.index !== i || !ref.path.startsWith('reviews/reviews-')) fail(`Review parts are not contiguous at ${ref.path}`); if (!ref.records) fail(`Review part ${ref.path} is empty`); });
  if (bundleIdOf({ ...m, bundleId: undefined } as unknown as Omit<BundleManifest, 'bundleId'>) !== m.bundleId) fail('Bundle id does not match its parts');
}

const readManifest = async (dir: string): Promise<{ manifest: BundleManifest; sha256: string; bytes: number }> => {
  const file = path.join(dir, 'manifest.json');
  const info = await stat(file).catch(() => null);
  if (!info) return fail(`${dir} has no manifest.json: the bundle is incomplete`);
  if (info.size > MAX_SMALL_DOCUMENT_BYTES) fail('Bundle manifest is implausibly large');
  const bytes = await guard(() => readFile(file));
  const manifest = await guard(async () => JSON.parse(bytes.toString('utf8')) as BundleManifest);
  checkManifest(manifest);
  return { manifest, sha256: sha256Of(bytes), bytes: bytes.length };
};

/** Reads and checks the summary part: the only document a page needs without the details. Does not read any detail part. */
export async function readSummary(dir: string, manifest: BundleManifest, corpusHashes?: Record<string, string>): Promise<Summary> {
  const document = await readPart<{ report: Summary }>(dir, manifest.summary, MAX_SMALL_DOCUMENT_BYTES);
  if (!validSummaryPart(document)) return fail('Invalid public evaluation summary contract');
  const r = document.report;
  if (r.schemaVersion !== 2 || r.accountingVersion !== '1.1' || r.reportType !== 'evaluation-public' || r.supportClaims !== false) fail('Unsupported evaluation report version');
  if (r.runId !== manifest.runId || r.startedAt !== manifest.startedAt || r.finishedAt !== manifest.finishedAt || r.provenance.casesHash !== manifest.casesHash) fail('The summary is of another run than the manifest');
  if (!r.runId || !Number.isFinite(Date.parse(r.startedAt)) || !Number.isFinite(Date.parse(r.finishedAt)) || Date.parse(r.finishedAt) < Date.parse(r.startedAt) || !r.scanners.length) fail('Missing or invalid evaluation evidence');
  const scannerIds = new Set(r.scanners.map((s: Summary['scanners'][number]) => s.id));
  if (scannerIds.size !== r.scanners.length || r.scanners.some((s: Summary['scanners'][number]) => !Number.isFinite(Date.parse(s.observation?.observedAt)) || !s.observation?.sourceRunId ||
    (s.observation.source === 'snapshot') !== Boolean(s.observation.snapshotDigest && s.observation.inputDigest))) fail('Missing or invalid evaluation evidence');
  if (!Object.keys(r.corpusHashes).length) fail('Missing or invalid evaluation evidence');
  if (corpusHashes && Object.entries(r.corpusHashes).some(([id, hash]) => corpusHashes[id] !== hash)) fail('Stale evaluation: fixture corpus changed');
  if (r.qualification && (r.qualification.supportClaims !== false || r.qualification.reportType !== 'qualification')) fail('Missing or invalid evaluation evidence');
  return r;
}

/**
 * Validates a whole bundle by streaming its parts one at a time: digests, sizes and record counts against the manifest, the public allowlist schema on every record, the per-case and
 * per-review rules of the public contract, global id uniqueness, run binding, operator totals and manifest totals re-derived from the cases, and scanner completion semantics.
 * Returns the summary and the id index. Throws BundleError; a partial, mixed, stale or inconsistent bundle is never reported as complete.
 */
export async function validateBundle(dir: string, { corpusHashes }: { corpusHashes?: Record<string, string> } = {}): Promise<{ manifest: BundleManifest; manifestSha256: string; summary: Summary; index: BundleIndex; maxPartBytes: number }> {
  const { manifest, sha256 } = await readManifest(dir);
  const summary = await readSummary(dir, manifest, corpusHashes);
  const index: BundleIndex = { runId: summary.runId, finishedAt: summary.finishedAt, cases: new Map(), reviews: new Map() };
  const caseShapes = new Map<string, Pick<EvaluationCase, 'method' | 'variants' | 'comparisons'>>();
  const operators: EvaluationReport['byOperator'] = {};
  const totals: BundleTotals = { cases: 0, variants: 0, assertions: counts(), reviews: 0, byMethod: {} };
  let maxPartBytes = manifest.summary.bytes;
  for (const ref of manifest.cases) {
    const part = await readPart<{ runId: string; casesHash: string; method: string; index: number; cases: EvaluationCase[] }>(dir, ref, manifest.maxPartBytes);
    maxPartBytes = Math.max(maxPartBytes, ref.bytes);
    if (!validCasePart(part)) fail(`Part ${ref.path} violates the public case contract`);
    if (part.runId !== manifest.runId || part.casesHash !== manifest.casesHash) fail(`Part ${ref.path} belongs to another run`);
    if (part.method !== ref.method || part.index !== ref.index || part.cases.length !== ref.records) fail(`Part ${ref.path} does not match its manifest entry`);
    if (part.cases[0].id !== ref.firstId || part.cases.at(-1)!.id !== ref.lastId) fail(`Part ${ref.path} does not start and end at its recorded ids`);
    for (const c of part.cases) {
      if (c.method !== ref.method) fail(`Case ${c.id} is stored in a ${ref.method} part but is ${c.method}`);
      if (index.cases.has(c.id)) fail(`Duplicate case id ${c.id}`);
      try { checkPublicCase(c, summary.scanners); } catch { fail(`Case ${c.id} violates the public evaluation contract`); }
      index.cases.set(c.id, { method: c.method, sourceSlug: c.sourceSlug });
      caseShapes.set(c.id, { method: c.method, variants: c.variants, comparisons: c.comparisons });
      addOperatorEvidence(operators, c);
      const stats = (totals.byMethod[c.method] ??= { cases: 0, variants: 0, assertions: counts() });
      stats.cases += 1; stats.variants += c.variants.length; totals.cases += 1; totals.variants += c.variants.length;
      for (const a of c.assertions) { stats.assertions[a.status] += 1; totals.assertions[a.status] += 1; }
    }
  }
  for (const ref of manifest.reviews) {
    const part = await readPart<{ runId: string; casesHash: string; index: number; reviews: EvaluationReview[] }>(dir, ref, manifest.maxPartBytes);
    maxPartBytes = Math.max(maxPartBytes, ref.bytes);
    if (!validReviewPart(part)) fail(`Part ${ref.path} violates the public review contract`);
    if (part.runId !== manifest.runId || part.casesHash !== manifest.casesHash) fail(`Part ${ref.path} belongs to another run`);
    if (part.index !== ref.index || part.reviews.length !== ref.records) fail(`Part ${ref.path} does not match its manifest entry`);
    if (part.reviews[0].id !== ref.firstId || part.reviews.at(-1)!.id !== ref.lastId) fail(`Part ${ref.path} does not start and end at its recorded ids`);
    for (const q of part.reviews) {
      if (index.reviews.has(q.id)) fail(`Duplicate review id ${q.id}`);
      try { checkPublicReview(q, caseShapes.get(q.caseId)); } catch { fail(`Review ${q.id.slice(0, 12)} violates the public evaluation contract`); }
      index.reviews.set(q.id, { caseId: q.caseId, variant: q.variant });
      totals.reviews += 1;
    }
  }
  if (!totals.cases) fail('Missing or invalid evaluation evidence');
  const r = summary.review;
  if (r.open + r.resolved + r.notAssertable + r.unknown !== totals.reviews) fail('Review state does not account for every review');
  if (canonical(summary.byOperator) !== canonical(operators)) fail('Operator totals do not match case evidence');
  const sameTotals = totals.cases === manifest.totals.cases && totals.variants === manifest.totals.variants && totals.reviews === manifest.totals.reviews && sameCounts(totals.assertions, manifest.totals.assertions) &&
    canonical(Object.fromEntries(Object.entries(totals.byMethod).sort())) === canonical(Object.fromEntries(Object.entries(manifest.totals.byMethod).sort()));
  if (!sameTotals) fail('Manifest totals do not match the detail evidence');
  void addCounts;
  return { manifest, manifestSha256: sha256, summary, index, maxPartBytes };
}

/** The ledger-binding view of a validated bundle. */
export const ledgerViewOfBundle = (index: BundleIndex): EvaluationLedgerView => ({ runId: index.runId, finishedAt: index.finishedAt, reviews: index.reviews, sourceSlugOf: id => index.cases.get(id)?.sourceSlug });

/** Streams the case records of one method (or all), checking each part's digest as it goes. Call after validateBundle; each part is read once and dropped. */
export async function* bundleCases(dir: string, manifest: BundleManifest, method?: string): AsyncGenerator<EvaluationCase> {
  for (const ref of manifest.cases) {
    if (method && ref.method !== method) continue;
    const part = await readPart<{ cases: EvaluationCase[] }>(dir, ref, manifest.maxPartBytes);
    yield* part.cases;
  }
}
export async function* bundleReviews(dir: string, manifest: BundleManifest): AsyncGenerator<EvaluationReview> {
  for (const ref of manifest.reviews) yield* (await readPart<{ reviews: EvaluationReview[] }>(dir, ref, manifest.maxPartBytes)).reviews;
}

/** Publishes a staged bundle: moves it to its immutable directory, validates the readback, runs `beforePointer`, and only then writes the mutable pointer (tmp + rename). Returns the pointer. */
export async function commitBundle(resultsDir: string, staging: string, manifest: BundleManifest,
  { corpusHashes, beforePointer }: { corpusHashes?: Record<string, string>; beforePointer?: (validation: Awaited<ReturnType<typeof validateBundle>>) => Promise<void> } = {}): Promise<{ pointer: BundlePointer; directory: string; validation: Awaited<ReturnType<typeof validateBundle>> }> {
  const bundles = path.join(resultsDir, BUNDLES_DIR), directory = path.join(bundles, manifest.bundleId);
  await mkdir(bundles, { recursive: true });
  if (await stat(directory).then(() => true, () => false)) await rm(staging, { recursive: true, force: true }); // the same parts give the same id: already published
  else await rename(staging, directory);
  const validation = await validateBundle(directory, { corpusHashes });
  await beforePointer?.(validation); // e.g. the ledger binding: a refusal leaves the previous pointer, and the unreferenced immutable directory is harmless
  const pointer: BundlePointer = { schema: BUNDLE_POINTER_SCHEMA, bundleId: manifest.bundleId, runId: manifest.runId, finishedAt: manifest.finishedAt,
    manifest: { path: `${BUNDLES_DIR}/${manifest.bundleId}/manifest.json`, sha256: validation.manifestSha256, bytes: (await stat(path.join(directory, 'manifest.json'))).size } };
  const target = path.join(resultsDir, POINTER_FILE), temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`);
  await rename(temporary, target);
  return { pointer, directory, validation };
}

export const pointerProblem = (value: unknown): string | null => {
  const p = value as BundlePointer;
  if (p?.schema !== BUNDLE_POINTER_SCHEMA || !/^[a-f0-9]{32}$/.test(p.bundleId) || !p.runId || !p.manifest) return 'Unsupported evaluation bundle pointer';
  if (p.manifest.path !== `${BUNDLES_DIR}/${p.bundleId}/manifest.json` || !SAFE_PART_PATH.test(p.manifest.path) || !/^[a-f0-9]{64}$/.test(p.manifest.sha256) || !Number.isSafeInteger(p.manifest.bytes)) return 'Bundle pointer does not name its own manifest';
  return null;
};

/** Resolves the pointer of a results directory to the bundle directory, checking that the manifest is the one the pointer commits to. Reads only the pointer and the manifest. */
export async function resolveBundle(resultsDir: string): Promise<{ pointer: BundlePointer; directory: string; manifest: BundleManifest }> {
  const file = path.join(resultsDir, POINTER_FILE);
  const info = await stat(file).catch(() => null);
  if (!info) return fail(`${POINTER_FILE} is absent`);
  if (info.size > MAX_SMALL_DOCUMENT_BYTES) fail('Bundle pointer is implausibly large');
  const pointer = await guard(async () => JSON.parse(await readFile(file, 'utf8')) as BundlePointer);
  const problem = pointerProblem(pointer);
  if (problem) fail(problem);
  const directory = path.join(resultsDir, BUNDLES_DIR, pointer.bundleId);
  const { manifest, sha256, bytes } = await readManifest(directory);
  if (sha256 !== pointer.manifest.sha256 || bytes !== pointer.manifest.bytes || manifest.bundleId !== pointer.bundleId || manifest.runId !== pointer.runId || manifest.finishedAt !== pointer.finishedAt) fail('The bundle manifest is not the one the pointer commits to');
  return { pointer, directory, manifest };
}
