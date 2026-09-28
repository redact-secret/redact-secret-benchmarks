import { createHash } from 'node:crypto';

/**
 * Independence and balance checks for the untargeted `real-world-shapes` corpus (#378).
 *
 * A larger fixture count is only more evidence when the files are independently
 * authored. Twenty copies of one skeleton with the values swapped would raise the
 * denominator of the untargeted false-alarm rate while measuring one file shape, so
 * the corpus must (a) contain no exact or value-normalized near-duplicates and (b)
 * stay balanced across its declared axes. Both properties are checked on every
 * commit (tests/real-world-shapes.test.mjs), not once at review time.
 *
 * Near-duplicate measure: lowercase word 3-gram shingles after collapsing every
 * value-like token (hex/base64-ish runs, digits, UUIDs) to a class marker, compared
 * by Jaccard similarity. Swapping ids, versions, hashes or hostnames in a templated
 * copy leaves its shingle set almost unchanged, so the pair scores near 1; two
 * files of different tools share keys only incidentally and score low. Deterministic,
 * dependency-free, and independent of any scanner's output.
 */

export interface IndependenceFixture { id: string; group: string; path: string; content: string }

/** Similarity at or above which two fixtures count as one templated shape (#378). */
export const NEAR_DUPLICATE_THRESHOLD = 0.5;

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g;
const HEXISH = /\b(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/g;
const LONG_TOKEN = /[A-Za-z0-9+/_=-]{24,}/g;
const DIGITS = /\d+/g;

/** Collapse values so a templated copy with swapped ids/versions/hashes normalizes to its source. */
export function normalizeValues(content: string): string {
  return content.toLowerCase().replace(UUID, ' ⟨uuid⟩ ').replace(LONG_TOKEN, ' ⟨tok⟩ ').replace(HEXISH, ' ⟨hex⟩ ').replace(DIGITS, '0');
}

export function shingles(content: string, size = 3): Set<string> {
  const words = normalizeValues(content).split(/[^\p{L}\p{N}⟨⟩_]+/u).filter(Boolean);
  const out = new Set<string>();
  if (words.length < size) { if (words.length) out.add(words.join(' ')); return out; }
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let shared = 0;
  for (const s of a) if (b.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}

export interface SimilarPair { a: string; b: string; similarity: number }

/** Every pair at or above `threshold`, highest first; exact duplicates score 1. */
export function nearDuplicatePairs(fixtures: IndependenceFixture[], threshold = NEAR_DUPLICATE_THRESHOLD): SimilarPair[] {
  const sets = fixtures.map(f => shingles(f.content));
  const pairs: SimilarPair[] = [];
  for (let i = 0; i < fixtures.length; i++) for (let j = i + 1; j < fixtures.length; j++) {
    const similarity = fixtures[i].content === fixtures[j].content ? 1 : jaccard(sets[i], sets[j]);
    if (similarity >= threshold) pairs.push({ a: fixtures[i].id, b: fixtures[j].id, similarity });
  }
  return pairs.sort((x, y) => y.similarity - x.similarity || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}

/** Highest pairwise similarity in the corpus, for reporting how far it sits below the threshold. */
export function maxPairwiseSimilarity(fixtures: IndependenceFixture[]): SimilarPair | null {
  const sets = fixtures.map(f => shingles(f.content));
  let best: SimilarPair | null = null;
  for (let i = 0; i < fixtures.length; i++) for (let j = i + 1; j < fixtures.length; j++) {
    const similarity = jaccard(sets[i], sets[j]);
    if (!best || similarity > best.similarity) best = { a: fixtures[i].id, b: fixtures[j].id, similarity };
  }
  return best;
}

/**
 * Number of independent shapes: connected components of the near-duplicate
 * relation. This, not the raw fixture count, is what a report may call the
 * corpus size; the corpus check requires the two to be equal.
 */
export function independentShapeCount(fixtures: IndependenceFixture[], threshold = NEAR_DUPLICATE_THRESHOLD): number {
  const parent = new Map(fixtures.map(f => [f.id, f.id]));
  const find = (x: string): string => { const p = parent.get(x)!; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  for (const { a, b } of nearDuplicatePairs(fixtures, threshold)) parent.set(find(a), find(b));
  return new Set(fixtures.map(f => find(f.id))).size;
}

export interface DistributionPolicy { axes: readonly string[]; minimumPerAxis: number; maximumShare: number }

/** Default balance policy for ~20 files per axis over six axes (#378). */
export const DEFAULT_DISTRIBUTION: Omit<DistributionPolicy, 'axes'> = { minimumPerAxis: 15, maximumShare: 0.25 };

export function axisCounts(fixtures: IndependenceFixture[], axes: readonly string[]): Record<string, number> {
  const counts = Object.fromEntries(axes.map(a => [a, 0]));
  for (const f of fixtures) counts[f.group] = (counts[f.group] ?? 0) + 1;
  return counts;
}

/** Problems with the axis distribution: an unknown axis, an under-filled axis, or one axis dominating. */
export function distributionProblems(fixtures: IndependenceFixture[], policy: DistributionPolicy): string[] {
  const counts = axisCounts(fixtures, policy.axes), problems: string[] = [];
  for (const [axis, n] of Object.entries(counts)) {
    if (!policy.axes.includes(axis)) problems.push(`unknown axis ${axis} (${n})`);
    else if (n < policy.minimumPerAxis) problems.push(`${axis}: ${n} < ${policy.minimumPerAxis}`);
    if (fixtures.length && n / fixtures.length > policy.maximumShare) problems.push(`${axis}: share ${(n / fixtures.length).toFixed(3)} > ${policy.maximumShare}`);
  }
  return problems;
}

/** Problems that would let duplicated content inflate the corpus: repeated ids, paths or bytes, or a near-duplicate pair. */
export function independenceProblems(fixtures: IndependenceFixture[], threshold = NEAR_DUPLICATE_THRESHOLD): string[] {
  const problems: string[] = [];
  const seen = { id: new Map<string, string>(), path: new Map<string, string>(), sha: new Map<string, string>() };
  for (const f of fixtures) {
    for (const [key, value] of [['id', f.id], ['path', f.path], ['sha', sha256(f.content)]] as const) {
      const prior = seen[key].get(value);
      if (prior) problems.push(`duplicate ${key}: ${prior} and ${f.id}`);
      else seen[key].set(value, f.id);
    }
  }
  for (const p of nearDuplicatePairs(fixtures, threshold)) problems.push(`near-duplicate ${p.a} ~ ${p.b} (${p.similarity.toFixed(3)})`);
  return problems;
}

export interface FrozenEntry { id: string; group: string; sha256: string }

/** Order-independent digest of a frozen subset: sha256 over sorted `id<TAB>sha256` lines. */
export function frozenDigest(entries: FrozenEntry[]): string {
  return sha256([...entries].sort((a, b) => a.id.localeCompare(b.id)).map(e => `${e.id}\t${e.sha256}\n`).join(''));
}

/** Problems between a frozen subset manifest and the live corpus: missing, regrouped or edited fixtures, or a stale digest. */
export function frozenSubsetProblems(frozen: { digest: string; fixtures: FrozenEntry[] }, fixtures: IndependenceFixture[]): string[] {
  const byId = new Map(fixtures.map(f => [f.id, f])), problems: string[] = [];
  for (const e of frozen.fixtures) {
    const f = byId.get(e.id);
    if (!f) { problems.push(`frozen fixture removed: ${e.id}`); continue; }
    if (f.group !== e.group) problems.push(`frozen fixture regrouped: ${e.id} ${e.group} -> ${f.group}`);
    if (sha256(f.content) !== e.sha256) problems.push(`frozen fixture edited: ${e.id}`);
  }
  if (new Set(frozen.fixtures.map(e => e.id)).size !== frozen.fixtures.length) problems.push('frozen subset repeats an id');
  if (frozenDigest(frozen.fixtures) !== frozen.digest) problems.push('frozen subset digest is stale');
  return problems;
}
