/**
 * Candidate-feature observations for explainable statistical calibration (#254,
 * cross-repo parent redact-secret/redact-secret#767).
 *
 * For every reviewed fixture in the development and regression corpora this
 * module emits one row per candidate value: redact-secret's 27-integer
 * `evidence-features/v1` vector (randomness and lexical groups, defined once in
 * ./evidence-features.ts from the core spec), plus two benchmark-only
 * categorical fields kept apart from it, a contextual evidence class and a
 * negative-evidence class, and the authored ground truth for stratification.
 * The rules are normative in docs/specs/candidate-features.md; changing any
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
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Fixture, Kind, Tier } from '../types.ts';
import { canonicalJson } from './adversarial-intake.ts';
import { CORE_FEATURE_SCHEMA, FEATURE_NAMES, MAX_ANALYSED_SYMBOLS, extractEvidenceFeatures } from './evidence-features.ts';

export const CANDIDATE_FEATURES_SCHEMA_VERSION = 1;
/** Bump on any change to a feature formula, class vocabulary, candidate rule or row field. */
export const FEATURE_EXTRACTION_VERSION = 'candidate-features/2';
/** Bounded local context, in Unicode scalar values, read before a candidate on its own line. */
export const CONTEXT_WINDOW = 64;
export const DATASET_TYPE = 'candidate-features' as const;
export const DEFAULT_OUTPUT = 'results-output/calibration/candidate-features-v1.json';
/** The only directory a dataset may be written under; git-ignored and never part of the site build. */
export const NON_PUBLIC_ROOT = 'results-output';
/** The files whose bytes define the extractor; their hash is `extractor.sourceHash`. */
export const EXTRACTOR_SOURCES = ['benchmarks/lib/evidence-features.ts', 'benchmarks/lib/candidate-features.ts', 'benchmarks/candidate-features.ts'] as const;

export type ContextClass = 'url-userinfo' | 'authorization-header' | 'credential-name' | 'other-name' | 'bare';
export type NegativeClass =
  | 'template-reference' | 'environment-reference' | 'command-substitution' | 'angle-placeholder'
  | 'mask' | 'placeholder-vocabulary' | 'dotted-reference' | 'none';
export type Partition = 'development' | 'regression';
export type Origin = 'generated' | 'authored';
/**
 * Why a row has its origin (docs/specs/candidate-features.md §2):
 * `authored-corpus`, a corpus outside fixtures/generated/; `generator-literal`,
 * a generated corpus whose candidate value is written verbatim in a generator's
 * source, so a person typed it; `generator-computed`, a generated corpus whose
 * value the generator computed (a seeded body, a mutation or a concatenation).
 */
export type OriginBasis = 'authored-corpus' | 'generator-literal' | 'generator-computed';
export type CandidateSource = 'expected-span' | 'control-longest-token';

export interface CandidateRow {
  /** `<category>--<fixture id>#<candidate index>`; stable while the fixture is. */
  id: string;
  category: string;
  fixtureId: string;
  partition: Partition;
  /** Only development rows may be selected for tuning (docs/specs/statistical-tuning.md §1). */
  tuningEligible: boolean;
  origin: Origin;
  originBasis: OriginBasis;
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
  /** Benchmark-only: not part of the core feature schema. */
  contextClass: ContextClass;
  /** Benchmark-only: not part of the core feature schema. */
  negativeClass: NegativeClass;
  /** The core `evidence-features/v1` vector, in `featureSchema.names` order. */
  features: number[];
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
  extractor: { version: string; sourceHash: string; contextWindow: number };
  /** The core feature schema the `features` vectors follow, and where it was read from. */
  featureSchema: {
    id: string; repository: string; sourceRevision: string; sources: { path: string; sha256: string }[];
    maxAnalysedSymbols: number; names: string[];
  };
  benchmark: { commit: string; dirty: boolean };
  corpora: CorpusSummary[];
  rows: CandidateRow[];
  /** SHA-256 of the canonical JSON of every field except `benchmark` and `datasetHash` itself. */
  datasetHash: string;
  /** Exactly the `featureDataset` block a tuning manifest records (#256). */
  manifestBinding: { schemaVersion: 1; extractorVersion: string; extractorSourceHash: string; datasetHash: string };
}

const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');

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
  /**
   * For a generated corpus: whether a candidate value is written verbatim in
   * the generator sources. Absent for an authored corpus.
   */
  isGeneratorLiteral?: (value: string) => boolean;
}

/** Corpus-level origin: a corpus a benchmark generator writes (under fixtures/generated/) is `generated`. */
export const originOf = (corpusPath: string): Origin => (corpusPath.startsWith('fixtures/generated/') ? 'generated' : 'authored');

/** Where the benchmark generators live; their source text is what `generator-literal` is checked against. */
export const GENERATOR_SOURCE_ROOT = 'fixtures/generated';

/**
 * Per-row origin. A row of an authored corpus is authored. A row of a
 * generated corpus is authored only when its whole candidate value appears
 * verbatim in a generator's source (as written, or with JSON string escapes),
 * because then a person typed it; any value the generator computed, including
 * a one-character mutation of a seeded body, stays generated. The rule errs
 * towards `generated`, which is the direction the generated-share cap guards.
 */
export function rowOrigin(corpusOrigin: Origin, value: string, isGeneratorLiteral?: (value: string) => boolean): { origin: Origin; originBasis: OriginBasis } {
  if (corpusOrigin === 'authored') return { origin: 'authored', originBasis: 'authored-corpus' };
  return value.length > 0 && isGeneratorLiteral?.(value)
    ? { origin: 'authored', originBasis: 'generator-literal' }
    : { origin: 'generated', originBasis: 'generator-computed' };
}

/** Reads every generator module under fixtures/generated/ and returns the verbatim-literal test. */
export function generatorLiteralTest(root: string): (value: string) => boolean {
  const texts: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(mjs|js|ts)$/.test(entry.name)) texts.push(readFileSync(file, 'utf8'));
    }
  };
  if (existsSync(path.join(root, GENERATOR_SOURCE_ROOT))) walk(path.join(root, GENERATOR_SOURCE_ROOT));
  const source = texts.join('\n');
  return (value: string) => source.includes(value) || source.includes(JSON.stringify(value).slice(1, -1));
}

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
      const provenance = rowOrigin(origin, value, input.isGeneratorLiteral);
      const row: CandidateRow = {
        id: `${input.id}--${f.id}#${index}`,
        category: input.id,
        fixtureId: f.id,
        partition: input.partition,
        tuningEligible: input.partition === 'development',
        origin: provenance.origin,
        originBasis: provenance.originBasis,
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
        features: extractEvidenceFeatures(value),
      };
      rows.push(row);
      if (row.role !== 'none') values.push(value);
      summary.rows[row.origin]++;
      const counts = (summary.families[family] ??= { generated: 0, authored: 0 });
      counts[row.origin]++;
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
  const isGeneratorLiteral = generatorLiteralTest(root);
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
        ...(originOf(category.corpus) === 'generated' ? { isGeneratorLiteral } : {}),
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
  const { schemaVersion, datasetType, visibility, holdoutAccess, extractor, featureSchema, corpora, rows } = dataset;
  return sha256(canonicalJson({ schemaVersion, datasetType, visibility, holdoutAccess, extractor, featureSchema, corpora, rows }));
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
    extractor: { version: FEATURE_EXTRACTION_VERSION, sourceHash: context.sourceHash, contextWindow: CONTEXT_WINDOW },
    featureSchema: {
      id: CORE_FEATURE_SCHEMA.id, repository: CORE_FEATURE_SCHEMA.repository, sourceRevision: CORE_FEATURE_SCHEMA.sourceRevision,
      sources: CORE_FEATURE_SCHEMA.sources.map(source => ({ ...source })), maxAnalysedSymbols: MAX_ANALYSED_SYMBOLS, names: [...FEATURE_NAMES],
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
