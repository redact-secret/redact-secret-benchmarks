/**
 * Credential evidence as the domain and PII publishers read it (#790): the evaluation bundle, never a full `evaluation-v1.json`.
 *
 * A publisher takes one read set: the bytes digest of the mutable pointer, the bundle id, the digest of the immutable manifest and the support matrix bytes. The bundle is validated with the
 * shared streaming validator (one part in memory at a time). Credential evidence is read-only for these tools; just before a publisher's commit it calls `credentialEvidenceChangeProblem`,
 * which re-reads the pointer and manifest (bounded: two small documents) and refuses any replacement, so a concurrent credential publication is detected and never mixed into the index.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BUNDLES_DIR, POINTER_FILE, resolveBundle, validateBundle } from '../evaluation/bundle/bundle.ts';
import { sha256Of } from '../evaluation/storage/parts.ts';
import { supportMatrixProblem } from './support-model.ts';

export interface CredentialEvidenceReadSet {
  resultsDirectory: string;
  pointerSha256: string;
  bundleId: string;
  runId: string;
  manifestSha256: string;
  supportFile: string;
  supportSha256: string;
  /** Streaming validation evidence, for the publisher's log. */
  totals: { cases: number; reviews: number; caseParts: number; reviewParts: number; maxPartBytes: number };
}

/** The credential support matrix is one small document; its validation is the support-matrix contract's. */
const readSupport = async (file: string) => {
  const bytes = await readFile(file);
  const issue = supportMatrixProblem(JSON.parse(bytes.toString('utf8')));
  if (issue) throw new Error(`Credential support artifact is incompatible: ${issue}`);
  return sha256Of(bytes);
};

/** Reads the pointer, validates the whole bundle it names by streaming, and validates the support matrix. Throws on any problem; writes nothing. */
export async function readCredentialEvidence(resultsDirectory: string, supportFile: string): Promise<CredentialEvidenceReadSet> {
  let pointerBytes: Buffer;
  try { pointerBytes = await readFile(path.join(resultsDirectory, POINTER_FILE)); }
  catch { throw new Error(`Credential evaluation bundle is absent: ${path.join(resultsDirectory, POINTER_FILE)} (a full evaluation-v1.json is the legacy contract and is not a credential evidence input)`); }
  let bundle: Awaited<ReturnType<typeof resolveBundle>>, validation: Awaited<ReturnType<typeof validateBundle>>;
  try {
    bundle = await resolveBundle(resultsDirectory);
    validation = await validateBundle(bundle.directory);
  } catch (error) {
    // Part I/O problems (size, digest, missing file) are plain errors, structural ones are BundleErrors: both mean the evidence is not a complete bundle.
    throw new Error(`Credential evaluation bundle is incompatible: ${error instanceof Error ? error.message : error}`, { cause: error });
  }
  if (validation.manifestSha256 !== bundle.pointer.manifest.sha256 || validation.manifest.bundleId !== bundle.pointer.bundleId) throw new Error('Credential evaluation bundle is incompatible: the validated manifest is not the one the pointer commits to');
  const supportSha256 = await readSupport(supportFile);
  return { resultsDirectory, pointerSha256: sha256Of(pointerBytes), bundleId: bundle.pointer.bundleId, runId: bundle.pointer.runId, manifestSha256: validation.manifestSha256, supportFile, supportSha256,
    totals: { cases: validation.manifest.totals.cases, reviews: validation.manifest.totals.reviews, caseParts: validation.manifest.cases.length, reviewParts: validation.manifest.reviews.length, maxPartBytes: validation.maxPartBytes } };
}

/** The descriptor fields the domain index needs. */
export const credentialEvaluationReference = (set: Pick<CredentialEvidenceReadSet, 'bundleId' | 'manifestSha256'>) =>
  ({ href: `/results/${BUNDLES_DIR}/${set.bundleId}/manifest.json`, artifactCommitment: set.manifestSha256 });

/** Re-reads the read set's inputs and returns the first difference, or null. Bounded: the pointer, the manifest and the support matrix, never the details. */
export async function credentialEvidenceChangeProblem(set: CredentialEvidenceReadSet): Promise<string | null> {
  try {
    const pointerBytes = await readFile(path.join(set.resultsDirectory, POINTER_FILE));
    if (sha256Of(pointerBytes) !== set.pointerSha256) return 'Credential evaluation pointer changed during publication';
    const { pointer, manifest } = await resolveBundle(set.resultsDirectory);
    if (pointer.bundleId !== set.bundleId || manifest.bundleId !== set.bundleId || manifest.runId !== set.runId || pointer.manifest.sha256 !== set.manifestSha256)
      return 'Credential evaluation bundle changed during publication';
    const manifestBytes = await readFile(path.join(set.resultsDirectory, pointer.manifest.path));
    if (sha256Of(manifestBytes) !== set.manifestSha256) return 'Credential evaluation manifest bytes changed during publication';
    if (sha256Of(await readFile(set.supportFile)) !== set.supportSha256) return 'Credential support artifact bytes changed during publication';
  } catch (error) { return `Credential evidence became unreadable during publication: ${error instanceof Error ? error.message : error}`; }
  return null;
}
