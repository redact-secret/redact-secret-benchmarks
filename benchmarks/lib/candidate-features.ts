/**
 * Candidate-feature observations for explainable statistical calibration (#254,
 * cross-repo parent redact-secret/redact-secret#767).
 *
 * For every reviewed fixture in the development and regression corpora this
 * module derives a small, closed set of numeric and categorical features for
 * each candidate value: randomness (Shannon entropy, min-entropy, information
 * bits, repetition, periodicity), lexical shape (length, alphabet, character
 * class ratios), a contextual evidence class and a negative-evidence class.
 * The formulas are normative in docs/specs/candidate-features.md; changing any
 * of them changes FEATURE_EXTRACTION_VERSION.
 *
 * Boundary (docs/specs/candidate-features.md §5, redact-secret
 * decision-freeze-the-shadow-evidence-score-and-confidence-contract §8 and §11):
 *
 * - a row never carries candidate bytes, any substring of them, a
 *   character-class run, or any hash of the value; `assertNoCandidateBytes`
 *   fails the build of a dataset that would;
 * - the dataset is maintainer-local: `resolveNonPublicOutput` only accepts a
 *   path under results-output/, which is git-ignored and never projected to
 *   the site; scripts/check-feature-dataset-exclusion.mjs fails CI if one
 *   reaches public/ or dist/;
 * - protected and public-control holdout is never read: corpora come only
 *   from the development and regression manifests and must resolve inside
 *   development storage, and a dataset naming a holdout identifier is refused;
 * - ground truth is copied from the authored fixture (kind, tier, role) and
 *   never derived from a feature value.
 *
 * The measurement-v4 scorer is not touched: nothing here runs a scanner.
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Fixture, Kind, Tier } from '../types.ts';
import { canonicalJson } from './adversarial-intake.ts';

export const CANDIDATE_FEATURES_SCHEMA_VERSION = 1;
/** Bump on any change to a feature formula, class vocabulary, candidate rule or row field. */
export const FEATURE_EXTRACTION_VERSION = 'candidate-features/1';
/** Real-valued features are recorded as integers: round(value × FIXED_POINT_SCALE). */
export const FIXED_POINT_SCALE = 1_000_000;
/** Bounded local context, in Unicode scalar values, read before a candidate on its own line. */
export const CONTEXT_WINDOW = 64;
/** Autocorrelation lags examined: 1 ..= min(floor(n / 2), MAX_AUTOCORRELATION_LAG). */
export const MAX_AUTOCORRELATION_LAG = 64;
export const DATASET_TYPE = 'candidate-features' as const;
export const DEFAULT_OUTPUT = 'results-output/calibration/candidate-features-v1.json';
/** The only directory a dataset may be written under; git-ignored and never part of the site build. */
export const NON_PUBLIC_ROOT = 'results-output';
/** The files whose bytes define the extractor; their hash is `extractor.sourceHash`. */
export const EXTRACTOR_SOURCES = ['benchmarks/lib/candidate-features.ts', 'benchmarks/candidate-features.ts'] as const;

export type Alphabet =
  | 'empty' | 'decimal' | 'hex-lower' | 'hex-upper' | 'base32' | 'alphanumeric'
  | 'base64url' | 'base64' | 'printable-ascii' | 'other';
export type ContextClass = 'url-userinfo' | 'authorization-header' | 'credential-name' | 'other-name' | 'bare';
export type NegativeClass =
  | 'template-reference' | 'environment-reference' | 'command-substitution' | 'angle-placeholder'
  | 'mask' | 'placeholder-vocabulary' | 'dotted-reference' | 'none';
export type Partition = 'development' | 'regression';
export type Origin = 'generated' | 'authored';
export type CandidateSource = 'expected-span' | 'control-longest-token';

export interface CandidateFeatures {
  lengthCodePoints: number;
  lengthBytes: number;
  distinctSymbols: number;
  distinctRatioMicro: number;
  shannonEntropyBitsMicro: number;
  minEntropyBitsMicro: number;
  informationBitsMicro: number;
  alphabet: Alphabet;
  upperRatioMicro: number;
  lowerRatioMicro: number;
  digitRatioMicro: number;
  symbolRatioMicro: number;
  whitespaceRatioMicro: number;
  otherRatioMicro: number;
  classesPresent: number;
  maxRunLength: number;
  maxMonotonicStepRun: number;
  repeatedBigramRatioMicro: number;
  smallestPeriod: number;
  maxAutocorrelationMicro: number;
}

export interface CandidateRow {
  /** `<category>--<fixture id>#<candidate index>`; stable while the fixture is. */
  id: string;
  category: string;
  fixtureId: string;
  partition: Partition;
  /** Only development rows may be selected for tuning (docs/specs/statistical-tuning.md §1). */
  tuningEligible: boolean;
  origin: Origin;
  kind: Kind;
  tier: Tier;
  /** `secret` or `companion` for an expected span; `none` for a control's candidate. */
  role: 'secret' | 'companion' | 'none';
  candidateSource: CandidateSource;
  candidateIndex: number;
  /** UTF-8 byte range inside the fixture content, `[start, end)`. */
  range: { start: number; end: number };
  family: string;
  contract: string | null;
  targets: string[];
  contextAxis: string | null;
  twinOf: string | null;
  mutationKind: string | null;
  contextClass: ContextClass;
  negativeClass: NegativeClass;
  features: CandidateFeatures;
}

export interface OriginCounts { generated: number; authored: number }
export interface CorpusSummary {
  category: string;
  partition: Partition;
  origin: Origin;
  corpusPath: string;
  corpusHash: string;
  reviewStatus: string | null;
  fixtures: number;
  /** Same shape as a tuning manifest's `corpora.tuning[]` counts (schemas/tuning-manifest-v1.json). */
  rows: OriginCounts;
  families: Record<string, OriginCounts>;
  contexts: Record<string, number>;
  excluded: { pendingT0Fixtures: number; controlsWithoutToken: number };
}

export interface CandidateFeatureDataset {
  schemaVersion: 1;
  datasetType: typeof DATASET_TYPE;
  visibility: 'maintainer-local';
  holdoutAccess: 'none';
  extractor: { version: string; sourceHash: string; fixedPointScale: number; contextWindow: number; maxAutocorrelationLag: number };
  benchmark: { commit: string; dirty: boolean };
  corpora: CorpusSummary[];
  rows: CandidateRow[];
  /** SHA-256 of the canonical JSON of every field except `benchmark` and `datasetHash` itself. */
  datasetHash: string;
  /** Exactly the `featureDataset` block a tuning manifest records (#256). */
  manifestBinding: { schemaVersion: 1; extractorVersion: string; extractorSourceHash: string; datasetHash: string };
}

const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
const fixed = (value: number) => Math.round(value * FIXED_POINT_SCALE);

// ---------------------------------------------------------------------------
// Features over one candidate value. Symbols are Unicode scalar values, the
// same unit redact-secret's `shannon_entropy` counts (crates/secret-scan-core/src/entropy.rs).

/** First-occurrence ordered symbol histogram: the summation order redact-secret's entropy uses. */
function histogram(symbols: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts];
}

/** Shannon entropy in bits per symbol, log base 2, summed in first-occurrence order (bit-identical to the core's f64). */
export function shannonEntropy(value: string): number {
  const symbols = [...value];
  if (!symbols.length) return 0;
  const total = symbols.length;
  let entropy = 0;
  for (const [, frequency] of histogram(symbols)) {
    const probability = frequency / total;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

/** Min-entropy in bits per symbol: −log2(max count / n). */
export function minEntropy(value: string): number {
  const symbols = [...value];
  if (!symbols.length) return 0;
  const max = Math.max(...histogram(symbols).map(([, c]) => c));
  return max === symbols.length ? 0 : -Math.log2(max / symbols.length);
}

const ALPHABETS: [Alphabet, RegExp][] = [
  ['decimal', /^[0-9]+$/],
  ['hex-lower', /^[0-9a-f]+$/],
  ['hex-upper', /^[0-9A-F]+$/],
  ['base32', /^[A-Z2-7]+=*$/],
  ['alphanumeric', /^[A-Za-z0-9]+$/],
  ['base64url', /^[A-Za-z0-9_-]+$/],
  ['base64', /^[A-Za-z0-9+/]+=*$/],
  ['printable-ascii', /^[\x20-\x7e]+$/],
];

/** The first named alphabet, in the order above, that contains every symbol. */
export function alphabetOf(value: string): Alphabet {
  if (!value) return 'empty';
  return ALPHABETS.find(([, pattern]) => pattern.test(value))?.[0] ?? 'other';
}

type CharClass = 'upper' | 'lower' | 'digit' | 'symbol' | 'whitespace' | 'other';
function charClass(symbol: string): CharClass {
  if (/^[A-Z]$/.test(symbol)) return 'upper';
  if (/^[a-z]$/.test(symbol)) return 'lower';
  if (/^[0-9]$/.test(symbol)) return 'digit';
  if (/^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/.test(symbol)) return 'symbol';
  if (/^[ \t\n\v\f\r]$/.test(symbol)) return 'whitespace';
  return 'other';
}

/** Smallest period p with 1 ≤ p ≤ floor(n/2) and s[i] = s[i+p] for all i < n − p; 0 when none (KMP prefix function). */
export function smallestPeriod(symbols: string[]): number {
  const n = symbols.length;
  if (n < 2) return 0;
  const prefix = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    let k = prefix[i - 1];
    while (k > 0 && symbols[i] !== symbols[k]) k = prefix[k - 1];
    if (symbols[i] === symbols[k]) k++;
    prefix[i] = k;
  }
  const p = n - prefix[n - 1];
  return p <= Math.floor(n / 2) ? p : 0;
}

export function extractFeatures(value: string): CandidateFeatures {
  const symbols = [...value];
  const n = symbols.length;
  const ratio = (count: number) => (n ? fixed(count / n) : 0);
  const classes: Record<CharClass, number> = { upper: 0, lower: 0, digit: 0, symbol: 0, whitespace: 0, other: 0 };
  for (const s of symbols) classes[charClass(s)]++;
  const distinct = histogram(symbols).length;
  const entropy = shannonEntropy(value);

  let maxRun = n ? 1 : 0, run = 1;
  let maxStep = n ? 1 : 0, step = 1, direction = 0;
  for (let i = 1; i < n; i++) {
    run = symbols[i] === symbols[i - 1] ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
    const delta = symbols[i].codePointAt(0)! - symbols[i - 1].codePointAt(0)!;
    if ((delta === 1 || delta === -1) && delta === direction) step++;
    else if (delta === 1 || delta === -1) { step = 2; direction = delta; }
    else { step = 1; direction = 0; }
    maxStep = Math.max(maxStep, step);
  }

  const bigrams = new Set<string>();
  for (let i = 1; i < n; i++) bigrams.add(`${symbols[i - 1]}\u0000${symbols[i]}`);
  const repeatedBigramRatio = n > 1 ? (n - 1 - bigrams.size) / (n - 1) : 0;

  let maxAutocorrelation = 0;
  for (let lag = 1; lag <= Math.min(Math.floor(n / 2), MAX_AUTOCORRELATION_LAG); lag++) {
    let matches = 0;
    for (let i = 0; i + lag < n; i++) if (symbols[i] === symbols[i + lag]) matches++;
    maxAutocorrelation = Math.max(maxAutocorrelation, matches / (n - lag));
  }

  return {
    lengthCodePoints: n,
    lengthBytes: Buffer.byteLength(value),
    distinctSymbols: distinct,
    distinctRatioMicro: ratio(distinct),
    shannonEntropyBitsMicro: fixed(entropy),
    minEntropyBitsMicro: fixed(minEntropy(value)),
    informationBitsMicro: fixed(entropy * n),
    alphabet: alphabetOf(value),
    upperRatioMicro: ratio(classes.upper),
    lowerRatioMicro: ratio(classes.lower),
    digitRatioMicro: ratio(classes.digit),
    symbolRatioMicro: ratio(classes.symbol),
    whitespaceRatioMicro: ratio(classes.whitespace),
    otherRatioMicro: ratio(classes.other),
    classesPresent: (['upper', 'lower', 'digit', 'symbol'] as const).filter(c => classes[c] > 0).length,
    maxRunLength: maxRun,
    maxMonotonicStepRun: maxStep,
    repeatedBigramRatioMicro: fixed(repeatedBigramRatio),
    smallestPeriod: smallestPeriod(symbols),
    maxAutocorrelationMicro: fixed(maxAutocorrelation),
  };
}

// ---------------------------------------------------------------------------
// Context and negative evidence. Both read the candidate's own line only, with
// a bounded window before it, so a class never depends on other candidates.

/** Normalized name segments that make an assignment name credential-bearing. Benchmark-owned; not the product's list. */
export const CREDENTIAL_NAME_SEGMENTS = [
  'apikey', 'auth', 'bearer', 'credential', 'credentials', 'key', 'pass', 'passwd', 'password', 'pwd', 'secret', 'token',
] as const;
/** Words a placeholder may be built from; a placeholder needs at least one PLACEHOLDER_MARKERS word. */
export const PLACEHOLDER_WORDS = [
  'a', 'access', 'an', 'api', 'auth', 'change', 'changeme', 'client', 'dummy', 'example', 'fake', 'goes', 'here', 'id',
  'insert', 'key', 'me', 'my', 'nil', 'none', 'null', 'password', 'placeholder', 'redacted', 'replace', 'replaceme',
  'sample', 'secret', 'tbd', 'the', 'todo', 'token', 'undefined', 'value', 'your',
] as const;
export const PLACEHOLDER_MARKERS = [
  'changeme', 'dummy', 'example', 'fake', 'here', 'insert', 'nil', 'none', 'null', 'placeholder', 'redacted', 'replace',
  'replaceme', 'sample', 'tbd', 'todo', 'undefined', 'your',
] as const;
const MASK_SYMBOLS = new Set(['*', 'x', 'X', '•', '#', '.', '-', '0']);

/** camelCase → snake_case, lower-case, `.` and `-` → `_` (the same normalization the product documents for names). */
export function normalizeName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[.-]/g, '_');
}

function lineAround(content: string, start: number, end: number) {
  const lineStart = content.lastIndexOf('\n', start - 1) + 1;
  const newline = content.indexOf('\n', end);
  const lineEnd = newline === -1 ? content.length : newline;
  const before = [...content.slice(lineStart, start)].slice(-CONTEXT_WINDOW).join('');
  const after = [...content.slice(end, lineEnd).replace(/\r$/, '')].slice(0, CONTEXT_WINDOW).join('');
  return { before, after };
}

const ASSIGNMENT = /([A-Za-z_][A-Za-z0-9_.-]*)["'\]]?\s*(?::=|=>|=|:)\s*["'`]?$/;
const FLAG = /(?:^|\s)--?([A-Za-z][A-Za-z0-9_-]*)(?:=|\s+)["']?$/;

/** Character offsets (UTF-16) of a UTF-8 byte range in `content`. */
function characterRange(content: string, start: number, end: number) {
  const buffer = Buffer.from(content);
  return { start: buffer.subarray(0, start).toString().length, end: buffer.subarray(0, end).toString().length };
}

export function contextClassOf(content: string, start: number, end: number): ContextClass {
  const { before, after } = lineAround(content, start, end);
  if (/[a-z][a-z0-9+.-]*:\/\/[^\s/@:]*:$/i.test(before) && after.startsWith('@')) return 'url-userinfo';
  if (/\bauthorization["']?\s*[:=]\s*["']?(?:(?:bearer|basic|token|digest)\s+)?$/i.test(before) || /(?:^|[\s"'])(?:bearer|basic)\s+$/i.test(before)) {
    return 'authorization-header';
  }
  const name = ASSIGNMENT.exec(before)?.[1] ?? FLAG.exec(before)?.[1];
  if (name === undefined) return 'bare';
  const segments = normalizeName(name).split('_').filter(Boolean);
  return segments.some(s => (CREDENTIAL_NAME_SEGMENTS as readonly string[]).includes(s)) ? 'credential-name' : 'other-name';
}

/**
 * A negative class applies only when the whole value matches a named grammar
 * (the product contract's §6): the candidate is exactly the delimited form, or
 * it is the entire interior of the delimiters that immediately surround it.
 * No prefix, suffix, substring or fuzzy resemblance counts.
 */
export function negativeClassOf(content: string, start: number, end: number, value: string): NegativeClass {
  const { before, after } = lineAround(content, start, end);
  const inside = (open: RegExp, close: RegExp) => open.test(before) && close.test(after);
  if (/^\{\{[^{}]*\}\}$/.test(value) || (inside(/\{\{\s*$/, /^\s*\}\}/) && !/[{}]/.test(value))) return 'template-reference';
  if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(?::?-[^}]*)?\}$/.test(value) || /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(value) || /^%[A-Za-z_][A-Za-z0-9_]*%$/.test(value)
    || (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && (inside(/\$\{$/, /^(?::?-[^}]*)?\}/) || inside(/(?:^|[^$])\$$/, /^(?![A-Za-z0-9_])/) || inside(/%$/, /^%/)))) {
    return 'environment-reference';
  }
  if (/^\$\([^()]*\)$/.test(value) || /^`[^`]*`$/.test(value) || (inside(/\$\(\s*$/, /^\s*\)/) && !/[()]/.test(value))) return 'command-substitution';
  if (/^<[A-Za-z0-9_ .-]+>$/.test(value) || (/^[A-Za-z0-9_ .-]+$/.test(value) && inside(/<$/, /^>/))) return 'angle-placeholder';
  const symbols = [...value];
  if (symbols.length >= 3 && new Set(symbols).size === 1 && MASK_SYMBOLS.has(symbols[0])) return 'mask';
  const words = value.toLowerCase().split(/[_\-.\s]+/).filter(Boolean);
  if (words.length && words.every(w => (PLACEHOLDER_WORDS as readonly string[]).includes(w))
    && words.some(w => (PLACEHOLDER_MARKERS as readonly string[]).includes(w))) return 'placeholder-vocabulary';
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[['"][^'"\]]+['"]\])+$/.test(value) && value.includes('.')) return 'dotted-reference';
  return 'none';
}

// ---------------------------------------------------------------------------
// Candidates per fixture. An expected span is the candidate for a fixture that
// has one; a fixture with no expected span (a control) contributes its longest
// token, a benchmark-side selection rule that is not product candidate generation.

/** Characters that end a control token besides whitespace. */
const TOKEN_DELIMITERS = new Set([...'"\'`=:,;()[]{}<>|']);

/** The longest maximal run of non-whitespace, non-delimiter scalar values (earliest on a tie), as a UTF-8 byte range. */
export function longestToken(content: string): { start: number; end: number } | null {
  let best: { start: number; end: number; length: number } | null = null;
  let offset = 0, tokenStart = -1, length = 0;
  const close = (at: number) => {
    if (tokenStart >= 0 && (!best || length > best.length)) best = { start: tokenStart, end: at, length };
    tokenStart = -1; length = 0;
  };
  for (const symbol of content) {
    if (/^\s$/u.test(symbol) || TOKEN_DELIMITERS.has(symbol)) close(offset);
    else { if (tokenStart < 0) tokenStart = offset; length++; }
    offset += Buffer.byteLength(symbol);
  }
  close(offset);
  const found = best as { start: number; end: number } | null;
  return found ? { start: found.start, end: found.end } : null;
}

export interface CategoryInput {
  id: string;
  partition: Partition;
  corpusPath: string;
  corpusHash: string;
  reviewStatus: string | null;
  fixtures: Fixture[];
  /** `fixture-detectors.json` targets keyed by fixture id. */
  targets: Record<string, string[]>;
}

/** Corpus-level origin: a corpus a benchmark generator writes (under fixtures/generated/) is `generated`. */
export const originOf = (corpusPath: string): Origin => (corpusPath.startsWith('fixtures/generated/') ? 'generated' : 'authored');

function byteSlice(content: string, start: number, end: number) {
  return Buffer.from(content).subarray(start, end).toString();
}

/** Rows for one category plus its aggregate summary. The candidate values are returned separately for the leak guard and never stored. */
export function categoryRows(input: CategoryInput): { rows: CandidateRow[]; summary: CorpusSummary; values: string[] } {
  const origin = originOf(input.corpusPath);
  const rows: CandidateRow[] = [];
  const values: string[] = [];
  const summary: CorpusSummary = {
    category: input.id, partition: input.partition, origin, corpusPath: input.corpusPath, corpusHash: input.corpusHash,
    reviewStatus: input.reviewStatus, fixtures: input.fixtures.length,
    rows: { generated: 0, authored: 0 }, families: {}, contexts: {},
    excluded: { pendingT0Fixtures: 0, controlsWithoutToken: 0 },
  };
  for (const f of input.fixtures) {
    // T0 is pending review: it has no ground truth to calibrate against.
    if (f.assessment.tier === 'T0') { summary.excluded.pendingT0Fixtures++; continue; }
    const candidates: { start: number; end: number; role: CandidateRow['role']; source: CandidateSource }[] = f.expected.length
      ? f.expected.map(r => ({ start: r.start, end: r.end, role: r.role ?? 'secret', source: 'expected-span' as const }))
      : (() => { const t = longestToken(f.content); return t ? [{ ...t, role: 'none' as const, source: 'control-longest-token' as const }] : []; })();
    if (!candidates.length) { summary.excluded.controlsWithoutToken++; continue; }
    candidates.forEach((c, index) => {
      const value = byteSlice(f.content, c.start, c.end);
      const chars = characterRange(f.content, c.start, c.end);
      const family = f.assessment.contract ?? 'uncontracted';
      const row: CandidateRow = {
        id: `${input.id}--${f.id}#${index}`,
        category: input.id,
        fixtureId: f.id,
        partition: input.partition,
        tuningEligible: input.partition === 'development',
        origin,
        kind: f.assessment.kind,
        tier: f.assessment.tier,
        role: c.role,
        candidateSource: c.source,
        candidateIndex: index,
        range: { start: c.start, end: c.end },
        family,
        contract: f.assessment.contract ?? null,
        targets: [...(input.targets[f.id] ?? f.detectors ?? []), ...(f.arrivalTargets ?? [])].sort(),
        contextAxis: f.contextAxis ?? null,
        twinOf: f.twinOf ?? null,
        mutationKind: f.mutationKind ?? null,
        contextClass: contextClassOf(f.content, chars.start, chars.end),
        negativeClass: negativeClassOf(f.content, chars.start, chars.end, value),
        features: extractFeatures(value),
      };
      rows.push(row);
      if (row.role !== 'none') values.push(value);
      summary.rows[origin]++;
      const counts = (summary.families[family] ??= { generated: 0, authored: 0 });
      counts[origin]++;
      summary.contexts[row.contextClass] = (summary.contexts[row.contextClass] ?? 0) + 1;
    });
  }
  summary.families = Object.fromEntries(Object.entries(summary.families).sort(([a], [b]) => a.localeCompare(b)));
  summary.contexts = Object.fromEntries(Object.entries(summary.contexts).sort(([a], [b]) => a.localeCompare(b)));
  return { rows, summary, values };
}

// ---------------------------------------------------------------------------
// Guards.

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(item => strings(item, out));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { out.push(key); strings(item, out); }
  return out;
}

/** Minimum candidate length the leak guard checks; shorter values collide with ordinary field text. */
export const LEAK_GUARD_MIN_LENGTH = 8;

/** Throws if any string in the dataset contains an expected-span value of at least LEAK_GUARD_MIN_LENGTH scalar values. Names no value. */
export function assertNoCandidateBytes(dataset: unknown, values: string[]): void {
  const haystack = strings(dataset);
  const needles = [...new Set(values)].filter(v => [...v].length >= LEAK_GUARD_MIN_LENGTH);
  const leaked = needles.filter(v => haystack.some(s => s.includes(v))).length;
  if (leaked) throw new Error(`Candidate feature dataset would carry ${leaked} candidate value(s); refusing to build it.`);
}

/** Throws if the dataset names a holdout manifest id, corpus hash, seed hash or a holdout/ path. */
export function assertNoHoldout(dataset: unknown, holdoutIdentifiers: string[]): void {
  const holdout = new Set(holdoutIdentifiers);
  for (const value of new Set(strings(dataset))) {
    if (holdout.has(value) || /(^|[\s/'"])holdout\//.test(value)) throw new Error('Candidate feature dataset names a holdout identifier or path; holdout is never a feature-dataset input.');
  }
}

/**
 * Resolves `requested` against `root` and accepts it only inside results-output/
 * (the non-public result surface). public/ and dist/ are what the site
 * projects, so a dataset path there, or anywhere else, is refused.
 */
export function resolveNonPublicOutput(root: string, requested: string = DEFAULT_OUTPUT): string {
  const resolved = path.resolve(root, requested);
  const allowed = path.resolve(root, NON_PUBLIC_ROOT) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error(`Candidate feature datasets are maintainer-local: write under ${NON_PUBLIC_ROOT}/, never public/, dist/ or a tracked path.`);
  return resolved;
}

// ---------------------------------------------------------------------------
// Loading and assembly.

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

/** SHA-256 over the canonical JSON of each extractor source's path and SHA-256. */
export function extractorSourceHash(root: string): string {
  return sha256(canonicalJson(EXTRACTOR_SOURCES.map(file => ({ file, sha256: sha256(readFileSync(path.join(root, file))) }))));
}

/** Development and regression categories only, each corpus resolved inside development storage. Holdout is never opened. */
export function loadCategoryInputs(root: string): CategoryInput[] {
  const categories: { id: string; corpus: string }[] = readJson(path.join(root, 'benchmarks/categories.json'));
  const targets: Record<string, string[]> = readJson(path.join(root, 'benchmarks/fixture-detectors.json'));
  const directories = ['fixtures', 'corpora/development', 'corpora/regression'];
  const storage = directories.map(p => path.join(root, p) + path.sep);
  const realStorage = directories.map(p => path.join(realpathSync(root), p) + path.sep);
  const inStorage = (file: string, roots = storage) => roots.some(directory => file.startsWith(directory));
  const inputs: CategoryInput[] = [];
  for (const partition of ['development', 'regression'] as const) {
    const manifest = readJson(path.join(root, `corpora/${partition}/manifest.json`));
    if (manifest.schemaVersion !== 1 || manifest.visibility !== partition || !Array.isArray(manifest.categories)) throw new Error(`Invalid ${partition} corpus manifest`);
    for (const id of manifest.categories as string[]) {
      const category = categories.find(c => c.id === id);
      if (!category) throw new Error(`Unknown corpus category: ${id}`);
      const source = path.resolve(root, category.corpus);
      if (!inStorage(source) || !inStorage(realpathSync(source), realStorage)) throw new Error(`Corpus for ${id} resolves outside development storage`);
      const bytes = readFileSync(source);
      const corpus = JSON.parse(bytes.toString('utf8'));
      const prefix = `${id}--`;
      inputs.push({
        id, partition, corpusPath: category.corpus, corpusHash: sha256(bytes),
        reviewStatus: typeof corpus.reviewStatus === 'string' ? corpus.reviewStatus : null,
        fixtures: corpus.fixtures,
        targets: Object.fromEntries(Object.entries(targets).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v])),
      });
    }
  }
  return inputs;
}

export function holdoutIdentifiers(root: string, names: string[]): string[] {
  const out: string[] = [];
  for (const name of names.filter(n => n.endsWith('.json')).sort()) {
    const manifest = readJson(path.join(root, 'holdout', name));
    for (const key of ['id', 'corpusHash', 'seedHash']) if (typeof manifest[key] === 'string') out.push(manifest[key]);
  }
  return out;
}

/** SHA-256 of the canonical JSON of the dataset without `benchmark`, `datasetHash` and `manifestBinding`. */
export function datasetHashOf(dataset: Omit<CandidateFeatureDataset, 'datasetHash' | 'manifestBinding' | 'benchmark'>): string {
  const { schemaVersion, datasetType, visibility, holdoutAccess, extractor, corpora, rows } = dataset;
  return sha256(canonicalJson({ schemaVersion, datasetType, visibility, holdoutAccess, extractor, corpora, rows }));
}

export function buildDataset(
  inputs: CategoryInput[],
  context: { sourceHash: string; commit: string; dirty: boolean; holdoutIdentifiers: string[] },
): CandidateFeatureDataset {
  const corpora: CorpusSummary[] = [], rows: CandidateRow[] = [], values: string[] = [];
  for (const input of [...inputs].sort((a, b) => a.id.localeCompare(b.id))) {
    const result = categoryRows(input);
    corpora.push(result.summary);
    rows.push(...result.rows);
    values.push(...result.values);
  }
  const body = {
    schemaVersion: 1 as const,
    datasetType: DATASET_TYPE,
    visibility: 'maintainer-local' as const,
    holdoutAccess: 'none' as const,
    extractor: {
      version: FEATURE_EXTRACTION_VERSION, sourceHash: context.sourceHash, fixedPointScale: FIXED_POINT_SCALE,
      contextWindow: CONTEXT_WINDOW, maxAutocorrelationLag: MAX_AUTOCORRELATION_LAG,
    },
    corpora,
    rows,
  };
  const datasetHash = datasetHashOf(body);
  const dataset: CandidateFeatureDataset = {
    ...body,
    benchmark: { commit: context.commit, dirty: context.dirty },
    datasetHash,
    manifestBinding: { schemaVersion: 1, extractorVersion: FEATURE_EXTRACTION_VERSION, extractorSourceHash: context.sourceHash, datasetHash },
  };
  assertNoCandidateBytes(dataset, values);
  assertNoHoldout(dataset, context.holdoutIdentifiers);
  return dataset;
}
