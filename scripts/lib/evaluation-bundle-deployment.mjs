/**
 * Deployment checks for the sharded public evaluation bundle (#791; spec: docs/specs/evaluation-bundle-deployment.md).
 *
 * Pure local-filesystem logic, shared by assemble-site.mjs, the publication check and the retention planner, so the same rules run on the
 * assembled `dist/`, on a read-back of what was uploaded, and in the synthetic rehearsal tests (which use local directories as the bucket).
 * It imports the bundle validator, so run it under tsx (`node --import tsx`).
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { BUNDLES_DIR, POINTER_FILE, resolveBundle, validateBundle } from '../../benchmarks/evaluation/bundle/bundle.ts';
import { blindTextProblems } from '../check-blind-public.mjs';
import { nameProblem, textProblems } from '../check-feature-dataset-exclusion.mjs';

export const DOMAIN_INDEX_FILE = 'evaluation-domains-v2.json';
export const BUNDLE_ID = /^[a-f0-9]{32}$/;
/** Immutable parts live a year in caches; the pointer, the index and the rollback copies are revalidated on every request. */
export const CACHE_CONTROL = { immutable: 'public, max-age=31536000, immutable', mutable: 'no-cache' };

/** Staging and internal raw files that must never be copied into the site root or served: the bundle writer's staging directory, temporary renames, the discovery store and the raw discovery report. */
const INTERNAL_SEGMENT = /^(?:\.evaluation-bundle-.*|results-output|.*\.staging|.*\.tmp)$/;
const INTERNAL_FILE = /(?:^|\/)(?:evaluation\.json|(?:results|failures|review-queue)-\d+\.jsonl|[^/]*\.jsonl)$/;
const STORE_MARKER = /redact-secret\/evaluation-discovery-store\//;

/** Path-level rule (relative to the site root or the results directory). Returns the problem or null. */
export function internalPathProblem(relative) {
  const posix = relative.split(path.sep).join('/');
  if (posix.split('/').some(segment => INTERNAL_SEGMENT.test(segment))) return `${posix}: a staging or internal file is in the public tree`;
  if (INTERNAL_FILE.test(posix)) return `${posix}: a raw discovery file (evaluation.json or a discovery store part) is in the public tree`;
  return null;
}

export async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const exists = file => stat(file).then(() => true, () => false);
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

/** Every file a manifest references, relative to its bundle directory, manifest first. */
export const referencedFiles = manifest => ['manifest.json', manifest.summary.path, ...manifest.cases.map(p => p.path), ...manifest.reviews.map(p => p.path)];

/** The domain index must commit to exactly the manifest the pointer names: same href, same digest. Missing index is a problem unless `required` is false. */
export async function domainIndexProblems(results, pointer, { required = true } = {}) {
  const file = path.join(results, DOMAIN_INDEX_FILE);
  if (!(await exists(file))) return required ? [`${DOMAIN_INDEX_FILE} is absent: nothing commits the site to a bundle`] : [];
  let index;
  try { index = await readJson(file); } catch { return [`${DOMAIN_INDEX_FILE} is not valid JSON`]; }
  const credential = (index?.domains ?? []).find(domain => domain?.domain === 'credential');
  const evaluation = credential?.evaluation;
  if (!evaluation) return [`${DOMAIN_INDEX_FILE} has no credential evaluation descriptor`];
  const problems = [];
  const href = `/results/${pointer.manifest.path}`;
  if (evaluation.href !== href) problems.push(`${DOMAIN_INDEX_FILE}: the credential evaluation href is ${JSON.stringify(evaluation.href)}, the pointer names ${href}`);
  const commitment = String(evaluation.artifactCommitment ?? '').replace(/^sha256:/, '');
  if (commitment !== pointer.manifest.sha256) problems.push(`${DOMAIN_INDEX_FILE}: the artifact commitment is not the sha256 of the manifest the pointer names (index and pointer disagree; readers refuse to combine them)`);
  return problems;
}

/**
 * The bundle half of the publication check, on a results directory (`dist/results` or a read-back of the bucket): the pointer resolves to its own manifest, the directory holds exactly the
 * files that manifest references (nothing staged, nothing extra, no other bundle), the whole bundle validates by streaming, and the existing public exclusion rules run over EVERY referenced
 * file. Returns { problems, inspected, pointer, manifest }.
 */
export async function bundleProblems(results, { onlyCurrentBundle = true } = {}) {
  const problems = [];
  let resolved;
  try { resolved = await resolveBundle(results); } catch (error) { return { problems: [`${POINTER_FILE}: ${error.message}`], inspected: 0 }; }
  const { pointer, directory, manifest } = resolved;
  const referenced = new Set(referencedFiles(manifest));
  const bundlesRoot = path.join(results, BUNDLES_DIR);
  for (const entry of await readdir(bundlesRoot, { withFileTypes: true })) {
    if (entry.name === pointer.bundleId && entry.isDirectory()) continue;
    if (onlyCurrentBundle) problems.push(`${BUNDLES_DIR}/${entry.name}: not the bundle the pointer names; only the current bundle ships (earlier ones stay on the bucket under retention)`);
  }
  for await (const file of walk(directory)) {
    const relative = path.relative(directory, file).split(path.sep).join('/');
    if (!referenced.has(relative)) problems.push(`${BUNDLES_DIR}/${pointer.bundleId}/${relative}: not referenced by the manifest`);
  }
  try { await validateBundle(directory); } catch (error) { problems.push(`bundle ${pointer.bundleId}: ${error.message}`); }
  // The existing exclusion rules over every referenced file (one at a time: a part is at most the manifest's part limit).
  let inspected = 0;
  for (const relative of referenced) {
    const display = `${BUNDLES_DIR}/${pointer.bundleId}/${relative}`;
    const file = path.join(directory, relative);
    if (!(await exists(file))) { problems.push(`${display}: referenced but missing`); continue; }
    const named = nameProblem(display);
    if (named) problems.push(named);
    const text = await readFile(file, 'utf8');
    inspected += 1;
    problems.push(...textProblems(display, text), ...blindTextProblems(display, text));
    if (STORE_MARKER.test(text)) problems.push(`${display}: carries a discovery store document`);
  }
  if (inspected !== referenced.size) problems.push(`only ${inspected} of ${referenced.size} referenced files were inspected`);
  return { problems, inspected, pointer, manifest };
}

/** The whole check on an assembled site root: no staging or internal file anywhere, the bundle, and the domain index commitment. */
export async function publicationProblems(dist, { requireIndex = true } = {}) {
  const problems = [];
  for await (const file of walk(dist)) {
    const relative = path.relative(dist, file);
    // Everything under results/ is held to the full rule; the Next export only to the two names that can never be public anywhere.
    const problem = relative.split(path.sep)[0] === 'results' ? internalPathProblem(relative) : (relative.split(path.sep).some(s => s === 'results-output' || s.startsWith('.evaluation-bundle-')) ? `${relative}: a staging or internal file is in the public tree` : null);
    if (problem) problems.push(problem);
  }
  const results = path.join(dist, 'results');
  const bundle = await bundleProblems(results);
  problems.push(...bundle.problems);
  if (bundle.pointer) problems.push(...(await domainIndexProblems(results, bundle.pointer, { required: requireIndex })));
  return { problems, inspected: bundle.inspected, pointer: bundle.pointer, manifest: bundle.manifest };
}

/**
 * Retention: which immutable bundle directories to keep and which may be pruned. Keeps the bundle being published (`current`), the bundle the live pointer named when the deployment started
 * (`previous`: the rollback target) and any bundle the live pointer names now (`live`, re-read at prune time); anything that is not a bundle id is never touched. Refuses to plan when the current
 * bundle is not present, since pruning then could leave the pointer's target missing.
 */
export function retentionPlan({ present, current, previous = null, live = null }) {
  const ids = [...new Set(present)];
  if (!BUNDLE_ID.test(current ?? '') || !ids.includes(current)) throw new Error(`The current bundle ${current} is not among the stored bundles; refusing to plan a prune`);
  const keep = [...new Set([current, previous, live].filter(id => id && BUNDLE_ID.test(id)))];
  for (const id of keep) if (!ids.includes(id) && id !== previous) throw new Error(`The live bundle ${id} is not stored; refusing to plan a prune`);
  const prune = ids.filter(id => BUNDLE_ID.test(id) && !keep.includes(id)).sort();
  return { keep: keep.filter(id => ids.includes(id)), prune, ignored: ids.filter(id => !BUNDLE_ID.test(id)) };
}

/**
 * Availability of an uploaded bundle without reading the objects back: the publisher role may list and write the bucket but not read objects (s3:GetObject is not granted), so the upload is
 * verified from `aws s3api list-objects-v2` rows ({ Key, Size, ETag }) against the files of the already-validated dist directory: every file present under the bundle's prefix with the same size,
 * and the same MD5 where the object is a single-part upload (its ETag has no '-'). The bytes were digest-validated locally before the upload; this proves the bucket holds them.
 * Returns the problems (empty when the whole bundle is available).
 */
export async function listingProblems({ rows, dist, bundleId, prefix = 'results' }) {
  const problems = [];
  if (!BUNDLE_ID.test(bundleId)) return ['the bundle id is not a 32-hex id'];
  const base = path.join(dist, 'results', BUNDLES_DIR, bundleId);
  const walk = async dir => (await readdir(dir, { withFileTypes: true })).flatMap(entry => entry.isDirectory() ? [] : [path.join(dir, entry.name)]).concat(
    ...await Promise.all((await readdir(dir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => walk(path.join(dir, entry.name)))));
  const present = new Map((rows ?? []).map(row => [row.Key, row]));
  const files = await walk(base);
  if (!files.length) return [`dist has no files for bundle ${bundleId}`];
  for (const file of files) {
    const key = `${prefix}/${BUNDLES_DIR}/${bundleId}/${path.relative(base, file).split(path.sep).join('/')}`, row = present.get(key);
    const bytes = await readFile(file);
    if (!row) { problems.push(`${key} is not in the bucket`); continue; }
    if (row.Size !== bytes.length) problems.push(`${key} is ${row.Size} bytes in the bucket, ${bytes.length} locally`);
    const etag = String(row.ETag ?? '').replaceAll('"', '');
    if (etag && !etag.includes('-') && etag !== createHash('md5').update(bytes).digest('hex')) problems.push(`${key} has another MD5 in the bucket than the validated file`);
  }
  return problems;
}
