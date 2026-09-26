/**
 * redact-secret's `evidence-features/v1` statistical feature vector (#254),
 * reproduced from the core's normative definition so calibration reads the
 * same integers the shadow scorer does.
 *
 * Authority: redact-secret `docs/specs/engine.md`, section "Shadow evidence
 * feature schema", and `crates/secret-scan-core/src/evidence/features.rs` and
 * `fixed_point.rs` at CORE_FEATURE_SCHEMA.sourceRevision (redact-secret#769,
 * PR #809). Integer arithmetic only, no floating point: Q16 fixed point via
 * the exact truncating `log2_q16`, `permille = floor(1000·a/b)`, every
 * division a floor, and only the first 256 Unicode scalar values analysed.
 * This module is the benchmark's only feature definition. A change to the
 * core schema is a new schema id; reconcile by updating this file,
 * CORE_FEATURE_SCHEMA and the golden vectors in tests/candidate-features.test.mjs,
 * and bump FEATURE_EXTRACTION_VERSION in candidate-features.ts.
 *
 * The vector carries counts and ratios only: no symbol, substring, class run
 * or hash of the value.
 */

/** The core feature schema this module reproduces, pinned to the revision and files it was read from. */
export const CORE_FEATURE_SCHEMA = {
  id: 'evidence-features/v1',
  repository: 'redact-secret/redact-secret',
  sourceRevision: 'd7733632bb05082710f71b6684ccf60c7a69377e',
  sources: [
    { path: 'docs/specs/engine.md', sha256: '213d7b2f7a3e09a22dc6a0b73d4eba072961d837fe38b67697e7411f8d2fcc9a' },
    { path: 'crates/secret-scan-core/src/evidence/features.rs', sha256: '1a9abfd0ff8c8fbddb23f5ecc81be533742a96dd7af999011e49f4bd247b5c02' },
    { path: 'crates/secret-scan-core/src/evidence/fixed_point.rs', sha256: '27f0717227d4c99e97bfb141a69c843597c548cb6e374f38bd65eca11123a3bd' },
  ],
} as const;

/** Feature names in vector order; the order is part of the schema id. */
export const FEATURE_NAMES = [
  'byte_len',
  'analysed_chars',
  'truncated',
  'distinct_symbols',
  'max_symbol_count',
  'shannon_entropy_q16',
  'min_entropy_q16',
  'information_bits_q16',
  'class_lower',
  'class_upper',
  'class_digit',
  'class_symbol',
  'class_space_control',
  'class_non_ascii',
  'class_count',
  'class_transitions',
  'class_alphabet_size',
  'entropy_efficiency_permille',
  'alphabet_efficiency_permille',
  'distinct_ratio_permille',
  'length_permille',
  'longest_run',
  'adjacent_repeat_permille',
  'repeated_bigram_permille',
  'smallest_period',
  'max_autocorrelation_permille',
  'max_autocorrelation_lag',
] as const;
export const FEATURE_COUNT = FEATURE_NAMES.length;
/** Only the first MAX_ANALYSED_SYMBOLS Unicode scalar values are analysed. */
export const MAX_ANALYSED_SYMBOLS = 256;
/** Autocorrelation lags examined: 2 ..= min(MAX_AUTOCORRELATION_LAG, floor(n / 2)). */
export const MAX_AUTOCORRELATION_LAG = 32;
const U32_MAX = 0xffff_ffff;

/** Exact truncating log2 in Q16 (the core's `log2_q16`); `log2_q16(0) = 0`. */
export function log2Q16(x: number): number {
  if (!Number.isInteger(x) || x < 0) throw new RangeError('log2Q16 takes a non-negative integer');
  if (x === 0) return 0;
  const k = BigInt(x.toString(2).length - 1);
  let m = BigInt(x) << (32n - k);
  let frac = 0n;
  for (let i = 0; i < 16; i++) {
    m = (m * m) >> 32n;
    frac <<= 1n;
    if (m >= 1n << 33n) { m >>= 1n; frac |= 1n; }
  }
  return Number((k << 16n) | frac);
}

/** floor(1000 × a / b), and 0 when b = 0. */
export function permille(a: number, b: number): number {
  return b === 0 ? 0 : Math.floor((1000 * a) / b);
}

const sat = (a: number, b: number) => Math.max(0, a - b);

type ClassIndex = 0 | 1 | 2 | 3 | 4 | 5; // lower, upper, digit, symbol, space_control, non_ascii
const CLASS_ALPHABET = [26, 26, 10, 32, 34] as const;

function classOf(codePoint: number): ClassIndex {
  if (codePoint >= 0x61 && codePoint <= 0x7a) return 0;
  if (codePoint >= 0x41 && codePoint <= 0x5a) return 1;
  if (codePoint >= 0x30 && codePoint <= 0x39) return 2;
  if (codePoint >= 0x21 && codePoint <= 0x7e) return 3;
  if (codePoint <= 0x20 || codePoint === 0x7f) return 4;
  return 5;
}

/** The 27-integer `evidence-features/v1` vector of one candidate value, in FEATURE_NAMES order. */
export function extractEvidenceFeatures(value: string): number[] {
  const all = [...value];
  const symbols = all.slice(0, MAX_ANALYSED_SYMBOLS).map(s => s.codePointAt(0)!);
  const n = symbols.length;
  const counts = new Map<number, number>();
  for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1);
  const d = counts.size;
  const cMax = n ? Math.max(...counts.values()) : 0;

  let sum = 0;
  for (const c of counts.values()) sum += c * log2Q16(c);
  const h = n ? sat(log2Q16(n), Math.floor(sum / n)) : 0;
  const minEntropy = n ? sat(log2Q16(n), log2Q16(cMax)) : 0;

  const classCounts = [0, 0, 0, 0, 0, 0];
  const nonAscii = new Set<number>();
  let transitions = 0;
  symbols.forEach((s, i) => {
    const c = classOf(s);
    classCounts[c]++;
    if (c === 5) nonAscii.add(s);
    if (i > 0 && classOf(symbols[i - 1]) !== c) transitions++;
  });
  const classCount = classCounts.filter(c => c > 0).length;
  const alphabetSize = classCounts.reduce((a, c, i) => (c > 0 ? a + (i === 5 ? nonAscii.size : CLASS_ALPHABET[i]) : a), 0);

  let longestRun = n ? 1 : 0, run = 1, adjacentRepeats = 0;
  for (let i = 1; i < n; i++) {
    if (symbols[i] === symbols[i - 1]) { run++; adjacentRepeats++; } else run = 1;
    longestRun = Math.max(longestRun, run);
  }

  let repeatedBigrams = 0;
  const seen = new Set<string>();
  for (let i = 0; i + 1 < n; i++) {
    const bigram = `${symbols[i]},${symbols[i + 1]}`;
    if (seen.has(bigram)) repeatedBigrams++;
    else seen.add(bigram);
  }

  let smallestPeriod = 0;
  for (let p = 1; p <= Math.floor(n / 2) && !smallestPeriod; p++) {
    let periodic = true;
    for (let i = 0; i + p < n && periodic; i++) periodic = symbols[i] === symbols[i + p];
    if (periodic) smallestPeriod = p;
  }

  let maxAutocorrelation = 0, maxLag = 0;
  for (let k = 2; k <= Math.min(MAX_AUTOCORRELATION_LAG, Math.floor(n / 2)); k++) {
    let matches = 0;
    for (let i = 0; i + k < n; i++) if (symbols[i] === symbols[i + k]) matches++;
    const value = permille(matches, n - k);
    if (value > maxAutocorrelation) { maxAutocorrelation = value; maxLag = k; }
  }

  const vector = [
    Math.min(Buffer.byteLength(value), U32_MAX),
    n,
    all.length > MAX_ANALYSED_SYMBOLS ? 1 : 0,
    d,
    cMax,
    h,
    minEntropy,
    n * h,
    ...classCounts,
    classCount,
    transitions,
    alphabetSize,
    d >= 2 ? Math.min(1000, permille(h, log2Q16(d))) : 0,
    alphabetSize >= 2 ? Math.min(1000, permille(h, log2Q16(alphabetSize))) : 0,
    permille(d, n),
    permille(n, MAX_ANALYSED_SYMBOLS),
    longestRun,
    permille(adjacentRepeats, sat(n, 1)),
    permille(repeatedBigrams, sat(n, 1)),
    smallestPeriod,
    maxAutocorrelation,
    maxLag,
  ];
  if (vector.length !== FEATURE_COUNT) throw new Error('evidence-features vector length mismatch');
  return vector;
}
