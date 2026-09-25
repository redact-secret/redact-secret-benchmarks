/**
 * Calibration experiments over the candidate-feature dataset (#255, cross-repo
 * parent redact-secret/redact-secret#767; depends on #254 and #256).
 *
 * Compares candidate evidence models for the product's shadow scorer
 * (redact-secret decision-freeze-the-shadow-evidence-score-and-confidence-contract):
 * a flat linear sum (the baseline the contract forbids), grouped scores with a
 * capped sum, max-within-group and the contract's halving rule, a 2-D entropy x
 * length lookup, and a floating-point logistic model kept as a research
 * reference. Each configuration's band thresholds are swept and selected on
 * development rows only, then evaluated on the evaluation-only regression rows.
 * Holdout is never read: the input is the #254 dataset, which never reads it.
 *
 * Rules are normative in docs/specs/calibration-experiments.md.
 *
 * Boundary (the contract's §1, §8 and §11; docs/specs/statistical-tuning.md §7):
 * - an evidence score is an ordinal integer, never a probability; only the
 *   Platt and isotonic transforms fitted on development rows are called a
 *   `calibratedEstimate`, and only for that population;
 * - weights, caps, thresholds, per-candidate scores and group contributions
 *   stay in the maintainer-local result under results-output/; the public
 *   projection (./calibration-projection.mjs) carries aggregate outcomes and
 *   identities only, and its whitelist is enforced at build and in CI;
 * - nothing here changes a product threshold or enforcement.
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from './adversarial-intake.ts';
import type { CandidateFeatureDataset, CandidateRow, ContextClass, NegativeClass } from './candidate-features.ts';
import { FEATURE_NAMES, permille } from './evidence-features.ts';

export const CALIBRATION_EXPERIMENTS_VERSION = 'calibration-experiments/1';
export const AGGREGATION_CONTRACT_VERSION = 'grouped-halving/1';
export const SELECTION_METHOD = 'calibration-experiments/1:dev-balanced-error-within-tolerance,fewest-parameters,loco-stability';
export const DEFAULT_OUTPUT = 'results-output/calibration/calibration-experiments-v1.json';
export const DEFAULT_REPORT = 'results-output/calibration/calibration-experiments-v1.md';
export const DEFAULT_PROJECTION = 'results-output/calibration/calibration-public-projection-v1.json';
export const DEFAULT_MANIFEST_DRAFT = 'results-output/calibration/tuning-manifest-draft.json';
/** The files whose bytes define the selection procedure; their hash is `selection.sourceHash`. */
export const SELECTION_SOURCES = [
  'benchmarks/lib/calibration-experiments.ts', 'benchmarks/lib/calibration-projection.mjs', 'benchmarks/calibration-experiments.ts',
] as const;

/** Selection tolerance: a configuration within this much development balanced error of the best is admissible. */
export const SELECTION_TOLERANCE = 0.01;
/** `t_high` is the smallest threshold whose development false-alarm rate on independent controls is at most this. */
export const HIGH_FALSE_ALARM_TARGET = 0.02;

export type Group = 'randomness' | 'lexical' | 'contextual' | 'validation' | 'negative';
export const GROUPS: Group[] = ['randomness', 'lexical', 'contextual', 'validation', 'negative'];
export type Band = 'none' | 'low' | 'medium' | 'high';
export const BANDS: Band[] = ['none', 'low', 'medium', 'high'];
export type WithinGroup = 'linear' | 'capped-sum' | 'max' | 'halving';

const index = Object.fromEntries(FEATURE_NAMES.map((name, i) => [name, i])) as Record<string, number>;
const feature = (row: CandidateRow, name: string) => row.features[index[name]];

// ---------------------------------------------------------------------------
// Signals. Each is an integer measure computed from the evidence-features/v1
// vector (or, for context and negative evidence, from the dataset's
// benchmark-only classes), oriented so that larger means more evidence of a
// credential. Only integer operations are used, so each is expressible in the
// core's fixed-point arithmetic.

export type SignalId =
  | 'shannon-entropy' | 'min-entropy' | 'class-balance' | 'non-repetition'
  | 'length' | 'class-mix' | 'class-transitions';

export const SIGNALS: Record<SignalId, { group: 'randomness' | 'lexical'; features: string[]; measure: (row: CandidateRow) => number; description: string }> = {
  'shannon-entropy': { group: 'randomness', features: ['shannon_entropy_q16'], measure: r => feature(r, 'shannon_entropy_q16'), description: 'Shannon entropy per symbol (Q16)' },
  'min-entropy': { group: 'randomness', features: ['min_entropy_q16'], measure: r => feature(r, 'min_entropy_q16'), description: 'min-entropy per symbol (Q16)' },
  'class-balance': { group: 'randomness', features: ['alphabet_efficiency_permille'], measure: r => feature(r, 'alphabet_efficiency_permille'), description: 'entropy relative to the class alphabet (permille)' },
  'non-repetition': {
    group: 'randomness',
    features: ['adjacent_repeat_permille', 'repeated_bigram_permille', 'max_autocorrelation_permille', 'smallest_period'],
    measure: r => (feature(r, 'smallest_period') > 0 ? 0
      : 1000 - Math.max(feature(r, 'adjacent_repeat_permille'), feature(r, 'repeated_bigram_permille'), feature(r, 'max_autocorrelation_permille'))),
    description: '1000 minus the strongest repetition measure; 0 when the value is periodic',
  },
  length: { group: 'lexical', features: ['analysed_chars'], measure: r => feature(r, 'analysed_chars'), description: 'analysed length in symbols' },
  'class-mix': { group: 'lexical', features: ['class_count'], measure: r => feature(r, 'class_count'), description: 'character classes present' },
  'class-transitions': {
    group: 'lexical', features: ['class_transitions', 'analysed_chars'],
    measure: r => permille(feature(r, 'class_transitions'), Math.max(0, feature(r, 'analysed_chars') - 1)),
    description: 'class transitions per adjacent pair (permille)',
  },
};

/** Context classes that count as credential-bearing contextual evidence. `other-name` and `bare` contribute nothing. */
export const CREDENTIAL_CONTEXTS: ContextClass[] = ['credential-name', 'authorization-header', 'url-userinfo'];
/** Whole-value reference and placeholder grammars (the contract's §6). */
export const STRICT_NEGATIVE_CLASSES: NegativeClass[] = [
  'template-reference', 'environment-reference', 'command-substitution', 'angle-placeholder', 'mask', 'placeholder-vocabulary',
];
export type NegativeGate = 'strict' | 'all' | 'none';
export const negativeApplies = (gate: NegativeGate, cls: NegativeClass) =>
  gate === 'all' ? cls !== 'none' : gate === 'strict' ? STRICT_NEGATIVE_CLASSES.includes(cls) : false;

/** Integer ramp: 0 at or below `lo`, `points` at or above `hi`, linear (floored) between. */
export function ramp(x: number, lo: number, hi: number, points: number): number {
  if (hi <= lo) return x > lo ? points : 0;
  if (x <= lo) return 0;
  if (x >= hi) return points;
  return Math.floor((points * (x - lo)) / (hi - lo));
}

/** The contract's within-group rule: descending contributions c1 + (c2 >> 1) + (c3 >> 2) + ..., capped. */
export function halving(contributions: number[], cap: number): number {
  const sorted = [...contributions].sort((a, b) => b - a);
  let total = 0;
  sorted.forEach((c, i) => { total += i < 31 ? c >> i : 0; });
  return Math.min(cap, total);
}

export function combineWithinGroup(rule: WithinGroup, contributions: number[], cap: number): number {
  if (!contributions.length) return 0;
  if (rule === 'linear') return contributions.reduce((a, b) => a + b, 0);
  if (rule === 'capped-sum') return Math.min(cap, contributions.reduce((a, b) => a + b, 0));
  if (rule === 'max') return Math.min(cap, Math.max(...contributions));
  return halving(contributions, cap);
}

// ---------------------------------------------------------------------------
// Configurations.

export interface Caps { randomness: number; lexical: number; contextual: number; validation: number; negative: number }

export interface ConfigSpec {
  id: string;
  kind: 'flat-linear' | 'grouped' | 'lookup-2d' | 'logistic';
  withinGroup: WithinGroup;
  signals: { randomness: SignalId[]; lexical: SignalId[] };
  caps: Caps;
  context: boolean;
  negativeGate: NegativeGate;
}

export interface Ramp { signal: SignalId; lo: number; hi: number; points: number }
export interface Thresholds { low: number; medium: number; high: number }
export interface LookupTable { entropyEdgesQ16: number[]; lengthEdges: number[]; points: number[][] }

export interface FittedConfig {
  spec: ConfigSpec;
  ramps: Ramp[];
  lookup?: LookupTable;
  logistic?: { mean: number[]; scale: number[]; weights: number[]; bias: number };
  thresholds: Thresholds;
  /** Integer, fixed-point and within the contract's §3 and §4 rules. */
  adrConformant: boolean;
  conformanceProblems: string[];
  /** Number of fitted numeric constants (ramp ends, table cells, weights, caps, thresholds). */
  parameters: number;
  maxScore: number;
}

export interface Evaluated { groups: Record<Group, number>; score: number }

const LENGTH_EDGES = [8, 16, 24, 32, 48, 64];
const ENTROPY_EDGES_Q16 = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5].map(b => Math.round(b * 65536));
const bucket = (x: number, edges: number[]) => edges.filter(e => x >= e).length;

function lookupPoints(table: LookupTable, row: CandidateRow): number {
  return table.points[bucket(feature(row, 'shannon_entropy_q16'), table.entropyEdgesQ16)][bucket(feature(row, 'analysed_chars'), table.lengthEdges)];
}

export function evaluate(config: FittedConfig, row: CandidateRow): Evaluated {
  const { spec } = config;
  const groups: Record<Group, number> = { randomness: 0, lexical: 0, contextual: 0, validation: 0, negative: 0 };
  if (spec.kind === 'logistic') {
    const m = config.logistic!;
    const x = logisticInputs(row);
    let z = m.bias;
    for (let i = 0; i < x.length; i++) z += m.weights[i] * ((x[i] - m.mean[i]) / m.scale[i]);
    return { groups, score: Math.floor(1000 / (1 + Math.exp(-z))) };
  }
  const contributions = (group: 'randomness' | 'lexical') =>
    config.ramps.filter(r => SIGNALS[r.signal].group === group).map(r => ramp(SIGNALS[r.signal].measure(row), r.lo, r.hi, r.points));
  const randomness = contributions('randomness');
  if (config.lookup) randomness.push(lookupPoints(config.lookup, row));
  const lexical = contributions('lexical');
  const contextual = spec.context && CREDENTIAL_CONTEXTS.includes(row.contextClass) ? spec.caps.contextual : 0;
  groups.negative = negativeApplies(spec.negativeGate, row.negativeClass) ? spec.caps.negative : 0;
  if (spec.kind === 'flat-linear') {
    const positive = [...randomness, ...lexical, contextual].reduce((a, b) => a + b, 0);
    groups.randomness = randomness.reduce((a, b) => a + b, 0);
    groups.lexical = lexical.reduce((a, b) => a + b, 0);
    groups.contextual = contextual;
    return { groups, score: Math.max(0, positive - groups.negative) };
  }
  groups.randomness = combineWithinGroup(spec.withinGroup, randomness, spec.caps.randomness);
  groups.lexical = combineWithinGroup(spec.withinGroup, lexical, spec.caps.lexical);
  groups.contextual = Math.min(spec.caps.contextual, contextual);
  groups.validation = 0; // evidence-features/v1 and the dataset carry no validation signal yet (#770/#771).
  const positive = groups.randomness + groups.lexical + groups.contextual + groups.validation;
  return { groups, score: Math.max(0, positive - groups.negative) };
}

export function bandOf(score: number, t: Thresholds): Band {
  return score >= t.high ? 'high' : score >= t.medium ? 'medium' : score >= t.low ? 'low' : 'none';
}
const bandRank = (b: Band) => BANDS.indexOf(b);

// ---------------------------------------------------------------------------
// Populations.

export type Unresolved = 'companion-role' | 'truncated';
export function unresolvedReason(row: CandidateRow): Unresolved | null {
  if (row.role === 'companion') return 'companion-role';
  if (feature(row, 'truncated') === 1) return 'truncated';
  return null;
}
const measurable = (rows: CandidateRow[]) => rows.filter(r => unresolvedReason(r) === null);
const isMustRedact = (r: CandidateRow) => r.role === 'secret' && r.kind === 'must-redact';
const isPolicy = (r: CandidateRow) => r.role === 'secret' && r.kind === 'policy';
const isControl = (r: CandidateRow) => r.role === 'none' && r.kind === 'must-not-flag';
/** A control that is not a one-property twin of a positive. */
const isIndependentControl = (r: CandidateRow) => isControl(r) && r.twinOf === null;

/** Row weights for fitting. Unweighted by default; the generated-share sensitivity reweights by origin. */
export type Weight = (row: CandidateRow) => number;
const unit: Weight = () => 1;

/** Weighted lower median of integer measures. */
const median = (values: { x: number; w: number }[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a.x - b.x);
  const half = s.reduce((t, v) => t + v.w, 0) / 2;
  let run = 0;
  for (const v of s) { run += v.w; if (run >= half) return v.x; }
  return s[s.length - 1].x;
};

/**
 * Weights under which benchmark-generated rows are exactly half of the total
 * weight: authored rows are scaled up. Used only for the sensitivity check,
 * never for the selected configuration.
 */
export function generatedShareWeights(rows: CandidateRow[]): Weight {
  const generated = rows.filter(r => r.origin === 'generated').length;
  const authored = rows.length - generated;
  if (!authored || generated <= authored) return unit;
  const scale = generated / authored;
  return r => (r.origin === 'authored' ? scale : 1);
}

// ---------------------------------------------------------------------------
// Fitting. Every fitted value is read from development rows only.

export function fitRamps(spec: ConfigSpec, rows: CandidateRow[], weight: Weight = unit): Ramp[] {
  const positives = measurable(rows).filter(isMustRedact);
  const controls = measurable(rows).filter(isControl);
  const out: Ramp[] = [];
  for (const group of ['randomness', 'lexical'] as const) {
    for (const signal of spec.signals[group]) {
      const m = SIGNALS[signal].measure;
      // Control median to positive median: explainable, two constants per signal, robust to outliers.
      const lo = median(controls.map(r => ({ x: m(r), w: weight(r) })));
      const hi = median(positives.map(r => ({ x: m(r), w: weight(r) })));
      out.push({ signal, lo, hi: Math.max(hi, lo), points: spec.caps[group] });
    }
  }
  return out;
}

/** Entropy x length table: smoothed positive share per cell, scaled to the randomness cap, made monotone in both axes. */
export function fitLookup(cap: number, rows: CandidateRow[], weight: Weight = unit): LookupTable {
  const E = ENTROPY_EDGES_Q16.length + 1, L = LENGTH_EDGES.length + 1;
  const pos = Array.from({ length: E }, () => Array(L).fill(0));
  const neg = Array.from({ length: E }, () => Array(L).fill(0));
  for (const r of measurable(rows)) {
    const e = bucket(feature(r, 'shannon_entropy_q16'), ENTROPY_EDGES_Q16), l = bucket(feature(r, 'analysed_chars'), LENGTH_EDGES);
    if (isMustRedact(r)) pos[e][l] += weight(r);
    else if (isControl(r)) neg[e][l] += weight(r);
  }
  const points = pos.map((line, e) => line.map((p, l) => Math.floor((cap * (p + 1)) / (p + neg[e][l] + 2))));
  // Monotone non-decreasing in entropy and in length (the contract's §4).
  for (let e = 0; e < E; e++) for (let l = 0; l < L; l++) {
    points[e][l] = Math.max(points[e][l], e ? points[e - 1][l] : 0, l ? points[e][l - 1] : 0);
  }
  return { entropyEdgesQ16: [...ENTROPY_EDGES_Q16], lengthEdges: [...LENGTH_EDGES], points };
}

const LOGISTIC_FEATURES = FEATURE_NAMES.filter(n => !['truncated', 'class_space_control', 'class_non_ascii'].includes(n));
function logisticInputs(row: CandidateRow): number[] {
  return [
    ...LOGISTIC_FEATURES.map(n => feature(row, n)),
    CREDENTIAL_CONTEXTS.includes(row.contextClass) ? 1 : 0,
    negativeApplies('strict', row.negativeClass) ? 1 : 0,
  ];
}

/** Deterministic L2-regularised logistic regression by full-batch gradient descent from zero. Research reference only. */
export function fitLogistic(rows: CandidateRow[], weight: Weight = unit, iterations = 1500, rate = 0.5, l2 = 1e-3) {
  const data = measurable(rows).filter(r => isMustRedact(r) || isControl(r));
  const X = data.map(logisticInputs), y = data.map(r => (isMustRedact(r) ? 1 : 0)), w = data.map(weight);
  const W = w.reduce((a, b) => a + b, 0);
  const k = X[0].length;
  const mean = Array.from({ length: k }, (_, j) => X.reduce((s, x) => s + x[j], 0) / X.length);
  const scale = Array.from({ length: k }, (_, j) => Math.sqrt(X.reduce((s, x) => s + (x[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map(x => x.map((v, j) => (v - mean[j]) / scale[j]));
  const weights = Array(k).fill(0);
  let bias = 0;
  for (let it = 0; it < iterations; it++) {
    const g = Array(k).fill(0);
    let gb = 0;
    for (let i = 0; i < Z.length; i++) {
      let z = bias;
      for (let j = 0; j < k; j++) z += weights[j] * Z[i][j];
      const err = (1 / (1 + Math.exp(-z)) - y[i]) * w[i];
      gb += err;
      for (let j = 0; j < k; j++) g[j] += err * Z[i][j];
    }
    bias -= (rate * gb) / W;
    for (let j = 0; j < k; j++) weights[j] -= rate * (g[j] / W + l2 * weights[j]);
  }
  return { mean, scale, weights, bias };
}

interface ScoredRow { row: CandidateRow; score: number; groups: Record<Group, number> }

function rates(scored: ScoredRow[], t: number, weight: Weight = unit) {
  const pos = scored.filter(s => isMustRedact(s.row));
  const ctl = scored.filter(s => isControl(s.row));
  const ind = scored.filter(s => isIndependentControl(s.row));
  const share = (xs: ScoredRow[], f: (s: ScoredRow) => boolean) => {
    const total = xs.reduce((a, s) => a + weight(s.row), 0);
    return total ? xs.filter(f).reduce((a, s) => a + weight(s.row), 0) / total : 0;
  };
  return {
    leak: share(pos, s => s.score < t),
    falseAlarm: share(ctl, s => s.score >= t),
    independentFalseAlarm: share(ind, s => s.score >= t),
  };
}

/** Midpoint of the lowest-cost plateau; ties break to the smaller threshold. */
function argminPlateau(from: number, to: number, cost: (t: number) => number): number {
  let best = Infinity, first = from, last = from;
  for (let t = from; t <= to; t++) {
    const c = cost(t);
    if (c < best - 1e-12) { best = c; first = t; last = t; } else if (Math.abs(c - best) <= 1e-12 && last === t - 1) last = t;
  }
  return Math.floor((first + last) / 2);
}

/**
 * Band thresholds from development rows:
 * - `high`: the smallest threshold above every positive cap and above
 *   randomness + lexical (the contract's §3) whose false-alarm rate on
 *   independent controls is at most HIGH_FALSE_ALARM_TARGET; if none, one
 *   above the largest reachable score (high is unreachable);
 * - `medium`: minimises leaked span rate + false alarm rate below `high`;
 * - `low`: minimises 2 x leaked span rate + false alarm rate below `medium`.
 */
export function fitThresholds(scored: ScoredRow[], floorHigh: number, maxScore: number, weight: Weight = unit): Thresholds {
  const fitRows = scored.filter(s => isMustRedact(s.row) || isControl(s.row));
  let high = maxScore + 1;
  for (let t = Math.max(floorHigh, 3); t <= maxScore; t++) {
    if (rates(fitRows, t, weight).independentFalseAlarm <= HIGH_FALSE_ALARM_TARGET) { high = t; break; }
  }
  const medium = argminPlateau(2, high - 1, t => { const r = rates(fitRows, t, weight); return r.leak + r.falseAlarm; });
  const low = argminPlateau(1, medium - 1, t => { const r = rates(fitRows, t, weight); return 2 * r.leak + r.falseAlarm; });
  return { low, medium, high };
}

export function maxScoreOf(spec: ConfigSpec, ramps: Ramp[], lookup?: LookupTable): number {
  if (spec.kind === 'logistic') return 1000;
  const sumPoints = (group: 'randomness' | 'lexical') => ramps.filter(r => SIGNALS[r.signal].group === group).reduce((s, r) => s + r.points, 0)
    + (group === 'randomness' && lookup ? Math.max(...lookup.points.flat()) : 0);
  if (spec.kind === 'flat-linear') return sumPoints('randomness') + sumPoints('lexical') + (spec.context ? spec.caps.contextual : 0);
  const capOf = (group: 'randomness' | 'lexical') => (spec.withinGroup === 'linear' ? sumPoints(group) : Math.min(spec.caps[group], sumPoints(group)));
  return capOf('randomness') + capOf('lexical') + (spec.context ? spec.caps.contextual : 0);
}

/** The contract's §3/§4/§7 conditions a configuration must meet before it can be selected. */
export function conformance(spec: ConfigSpec, t: Thresholds, maxScore: number): string[] {
  const problems: string[] = [];
  if (spec.kind === 'logistic') problems.push('floating-point model: not expressible in the core fixed-point arithmetic (§7)');
  if (spec.kind === 'flat-linear') problems.push('signals are summed linearly across and within groups (§3 forbids it)');
  if (spec.kind !== 'logistic' && spec.withinGroup !== 'halving') problems.push(`within-group rule ${spec.withinGroup} is not the contract's halving rule (§3)`);
  const c = spec.caps;
  if (spec.kind !== 'logistic') {
    for (const g of ['randomness', 'lexical', 'contextual', 'validation'] as const) if (c[g] >= t.high) problems.push(`cap_${g} is not below t_high (§3)`);
    if (c.randomness + c.lexical >= t.high) problems.push('cap_randomness + cap_lexical is not below t_high (§3)');
  }
  if (!(t.low >= 1 && t.low < t.medium && t.medium < t.high)) problems.push('band thresholds do not strictly increase (§2)');
  if (t.high > maxScore) problems.push('high is unreachable with this configuration');
  return problems;
}

export function fitConfig(spec: ConfigSpec, development: CandidateRow[], weight: Weight = unit): FittedConfig {
  const ramps = spec.kind === 'logistic' ? [] : fitRamps(spec, development, weight);
  const lookup = spec.kind === 'lookup-2d' ? fitLookup(spec.caps.randomness, development, weight) : undefined;
  const logistic = spec.kind === 'logistic' ? fitLogistic(development, weight) : undefined;
  const maxScore = maxScoreOf(spec, ramps, lookup);
  const partial: FittedConfig = { spec, ramps, lookup, logistic, thresholds: { low: 1, medium: 2, high: 3 }, adrConformant: false, conformanceProblems: [], parameters: 0, maxScore };
  const scored = scoreRows(partial, measurable(development));
  const floorHigh = spec.kind === 'grouped' || spec.kind === 'lookup-2d'
    ? Math.max(spec.caps.randomness + spec.caps.lexical, spec.caps.randomness, spec.caps.lexical, spec.caps.contextual) + 1
    : 3;
  const thresholds = fitThresholds(scored, floorHigh, maxScore, weight);
  const conformanceProblems = conformance(spec, thresholds, maxScore);
  const parameters = ramps.length * 2 + (lookup ? lookup.points.flat().length : 0) + (logistic ? logistic.weights.length + 1 : 0)
    + (spec.kind === 'logistic' ? 0 : 2 + (spec.context ? 1 : 0) + (spec.negativeGate === 'none' ? 0 : 1)) + 3;
  return { ...partial, thresholds, conformanceProblems, adrConformant: conformanceProblems.length === 0, parameters };
}

export function scoreRows(config: FittedConfig, rows: CandidateRow[]): ScoredRow[] {
  return rows.map(row => ({ row, ...evaluate(config, row) }));
}

// ---------------------------------------------------------------------------
// Metrics (measurement-v4 §2.4-2.5, adapted to one candidate per row: a row is
// flagged at a band when its shadow band is at least that band).

export interface OutcomeMetrics {
  rows: number;
  measurableShare: number;
  unresolved: Record<Unresolved, number>;
  mustRedact: number;
  policy: number;
  controls: number;
  leakedSpanRate: number;
  policyLeakedSpanRate: number;
  falseAlarmRate: number;
  independentFalseAlarmRate: number;
  /** Bytes of flagged control candidates / bytes of must-redact secret spans. */
  collateralRatio: number;
  twins: { pairs: number; discriminated: number; rate: number };
  balancedError: number;
}

export function outcomes(config: FittedConfig, rows: CandidateRow[], band: Band): OutcomeMetrics {
  const unresolved: Record<Unresolved, number> = { 'companion-role': 0, truncated: 0 };
  for (const r of rows) { const u = unresolvedReason(r); if (u) unresolved[u]++; }
  const scored = scoreRows(config, measurable(rows));
  const flagged = (s: ScoredRow) => bandRank(bandOf(s.score, config.thresholds)) >= bandRank(band);
  const pos = scored.filter(s => isMustRedact(s.row)), pol = scored.filter(s => isPolicy(s.row));
  const ctl = scored.filter(s => isControl(s.row)), ind = scored.filter(s => isIndependentControl(s.row));
  const share = (xs: ScoredRow[], f: (s: ScoredRow) => boolean) => (xs.length ? xs.filter(f).length / xs.length : 0);
  const bytes = (xs: ScoredRow[]) => xs.reduce((s, x) => s + feature(x.row, 'byte_len'), 0);
  const positivesByFixture = new Map<string, ScoredRow[]>();
  for (const s of scored.filter(s => s.row.role === 'secret')) {
    const key = `${s.row.category}--${s.row.fixtureId}`;
    positivesByFixture.set(key, [...(positivesByFixture.get(key) ?? []), s]);
  }
  let pairs = 0, discriminated = 0;
  for (const twin of ctl.filter(s => s.row.twinOf)) {
    const positives = positivesByFixture.get(`${twin.row.category}--${twin.row.twinOf}`);
    if (!positives) continue;
    pairs++;
    if (positives.every(flagged) && !flagged(twin)) discriminated++;
  }
  const leakedSpanRate = share(pos, s => !flagged(s)), falseAlarmRate = share(ctl, flagged);
  return {
    rows: rows.length,
    measurableShare: rows.length ? scored.length / rows.length : 0,
    unresolved,
    mustRedact: pos.length, policy: pol.length, controls: ctl.length,
    leakedSpanRate,
    policyLeakedSpanRate: share(pol, s => !flagged(s)),
    falseAlarmRate,
    independentFalseAlarmRate: share(ind, flagged),
    collateralRatio: bytes(pos) ? bytes(ctl.filter(flagged)) / bytes(pos) : 0,
    twins: { pairs, discriminated, rate: pairs ? discriminated / pairs : 0 },
    balancedError: leakedSpanRate + falseAlarmRate,
  };
}

// ---------------------------------------------------------------------------
// Calibration diagnostics (research only). A calibrated estimate is valid for
// the development population it was fitted on and is never a product value.

export function plattFit(scores: number[], labels: number[], iterations = 3000, rate = 0.1) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const scale = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length) || 1;
  let a = 0, b = 0;
  for (let it = 0; it < iterations; it++) {
    let ga = 0, gb = 0;
    for (let i = 0; i < scores.length; i++) {
      const z = a * ((scores[i] - mean) / scale) + b;
      const err = 1 / (1 + Math.exp(-z)) - labels[i];
      ga += err * ((scores[i] - mean) / scale); gb += err;
    }
    a -= (rate * ga) / scores.length; b -= (rate * gb) / scores.length;
  }
  return (score: number) => 1 / (1 + Math.exp(-(a * ((score - mean) / scale) + b)));
}

/** Pool-adjacent-violators isotonic fit over integer scores. */
export function isotonicFit(scores: number[], labels: number[]) {
  const byScore = new Map<number, { n: number; y: number }>();
  scores.forEach((s, i) => { const c = byScore.get(s) ?? { n: 0, y: 0 }; c.n++; c.y += labels[i]; byScore.set(s, c); });
  const blocks = [...byScore.entries()].sort((x, y) => x[0] - y[0]).map(([s, c]) => ({ lo: s, hi: s, n: c.n, y: c.y }));
  const stack: typeof blocks = [];
  for (const b of blocks) {
    stack.push({ ...b });
    while (stack.length > 1 && stack[stack.length - 2].y / stack[stack.length - 2].n > stack[stack.length - 1].y / stack[stack.length - 1].n) {
      const top = stack.pop()!, below = stack.pop()!;
      stack.push({ lo: below.lo, hi: top.hi, n: below.n + top.n, y: below.y + top.y });
    }
  }
  return (score: number) => {
    let value = stack[0].y / stack[0].n;
    for (const b of stack) if (score >= b.lo) value = b.y / b.n;
    return value;
  };
}

export function calibrationDiagnostics(estimate: (s: number) => number, scores: number[], labels: number[]) {
  const n = scores.length;
  const p = scores.map(estimate);
  const brier = p.reduce((s, x, i) => s + (x - labels[i]) ** 2, 0) / n;
  const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  p.forEach((x, i) => { const b = bins[Math.min(9, Math.floor(x * 10))]; b.n++; b.p += x; b.y += labels[i]; });
  const ece = bins.reduce((s, b) => s + (b.n ? (b.n / n) * Math.abs(b.p / b.n - b.y / b.n) : 0), 0);
  return { brier, expectedCalibrationError: ece };
}

// ---------------------------------------------------------------------------
// The experiment grid.

/** The negative cap equals the largest positive total, so a whole-value negative match floors the score at 0. */
const BASE_CAPS: Caps = { randomness: 40, lexical: 20, contextual: 50, validation: 50, negative: 160 };
const ALL_RANDOMNESS: SignalId[] = ['shannon-entropy', 'min-entropy', 'class-balance', 'non-repetition'];
const ALL_LEXICAL: SignalId[] = ['length', 'class-mix', 'class-transitions'];

/** Cap grid for the contract-rule candidates. */
export const CAP_GRID = { randomness: [30, 40, 50, 60], lexical: [10, 20], contextual: [30, 40, 50, 60] };

export function experimentSpecs(): ConfigSpec[] {
  const specs: ConfigSpec[] = [];
  const add = (s: Omit<ConfigSpec, 'id'> & { id?: string }) => specs.push({ id: s.id ?? '', ...s } as ConfigSpec);
  add({ id: 'flat-linear', kind: 'flat-linear', withinGroup: 'linear', signals: { randomness: ALL_RANDOMNESS, lexical: ALL_LEXICAL }, caps: BASE_CAPS, context: true, negativeGate: 'strict' });
  for (const withinGroup of ['capped-sum', 'max', 'halving'] as const) {
    add({ id: `grouped-${withinGroup}`, kind: 'grouped', withinGroup, signals: { randomness: ALL_RANDOMNESS, lexical: ALL_LEXICAL }, caps: BASE_CAPS, context: true, negativeGate: 'strict' });
  }
  add({ id: 'grouped-halving-no-context', kind: 'grouped', withinGroup: 'halving', signals: { randomness: ALL_RANDOMNESS, lexical: ALL_LEXICAL }, caps: BASE_CAPS, context: false, negativeGate: 'strict' });
  add({ id: 'grouped-halving-negative-all', kind: 'grouped', withinGroup: 'halving', signals: { randomness: ALL_RANDOMNESS, lexical: ALL_LEXICAL }, caps: BASE_CAPS, context: true, negativeGate: 'all' });
  add({ id: 'grouped-halving-negative-none', kind: 'grouped', withinGroup: 'halving', signals: { randomness: ALL_RANDOMNESS, lexical: ALL_LEXICAL }, caps: BASE_CAPS, context: true, negativeGate: 'none' });
  add({ id: 'lookup-2d', kind: 'lookup-2d', withinGroup: 'halving', signals: { randomness: [], lexical: ['class-mix', 'class-transitions'] }, caps: BASE_CAPS, context: true, negativeGate: 'strict' });
  add({ id: 'logistic-research', kind: 'logistic', withinGroup: 'linear', signals: { randomness: [], lexical: [] }, caps: BASE_CAPS, context: true, negativeGate: 'strict' });
  // Signal-subset and cap grid for the contract's rule: the candidates the selection chooses from.
  const randomnessSets: [string, SignalId[]][] = [['r4', ALL_RANDOMNESS], ['r2', ['shannon-entropy', 'non-repetition']], ['r1', ['shannon-entropy']]];
  const lexicalSets: [string, SignalId[]][] = [['l3', ALL_LEXICAL], ['l1', ['length']], ['l0', []]];
  for (const [rn, randomness] of randomnessSets) for (const [ln, lexical] of lexicalSets) {
    for (const capR of CAP_GRID.randomness) for (const capL of lexical.length ? CAP_GRID.lexical : [0]) for (const capC of CAP_GRID.contextual) {
      add({
        id: `halving-${rn}-${ln}-r${capR}-l${capL}-c${capC}`, kind: 'grouped', withinGroup: 'halving', signals: { randomness, lexical },
        caps: { randomness: capR, lexical: capL, contextual: capC, validation: capC, negative: capR + capL + 2 * capC }, context: true, negativeGate: 'strict',
      });
    }
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Robustness: leave one development category out, refit, and see how far the
// thresholds move and how the held-out category fares.

export function leaveOneCategoryOut(spec: ConfigSpec, development: CandidateRow[], weight: Weight = unit) {
  const categories = [...new Set(development.map(r => r.category))].sort();
  const mediums: number[] = [], highs: number[] = [];
  let worstHeldOut = 0;
  for (const category of categories) {
    const fitted = fitConfig(spec, development.filter(r => r.category !== category), weight);
    mediums.push(fitted.thresholds.medium); highs.push(fitted.thresholds.high);
    const held = outcomes(fitted, development.filter(r => r.category === category), 'medium');
    if (held.mustRedact && held.controls) worstHeldOut = Math.max(worstHeldOut, held.balancedError);
  }
  return {
    folds: categories.length,
    mediumRange: [Math.min(...mediums), Math.max(...mediums)] as [number, number],
    highRange: [Math.min(...highs), Math.max(...highs)] as [number, number],
    worstHeldOutBalancedError: worstHeldOut,
  };
}

export interface ConfigResult {
  id: string;
  fitted: FittedConfig;
  development: Record<Band, OutcomeMetrics>;
  evaluation: Record<Band, OutcomeMetrics>;
  authoredOnly: { development: OutcomeMetrics; evaluation: OutcomeMetrics };
  generalizationGap: number;
  bandDistribution: { development: Record<Band, number>; evaluation: Record<Band, number> };
  loco?: ReturnType<typeof leaveOneCategoryOut>;
}

const bandsFor = (config: FittedConfig, rows: CandidateRow[]) =>
  Object.fromEntries((['low', 'medium', 'high'] as const).map(b => [b, outcomes(config, rows, b)])) as Record<Band, OutcomeMetrics>;

function distribution(config: FittedConfig, rows: CandidateRow[]): Record<Band, number> {
  const out: Record<Band, number> = { none: 0, low: 0, medium: 0, high: 0 };
  for (const s of scoreRows(config, measurable(rows))) out[bandOf(s.score, config.thresholds)]++;
  return out;
}

export function runConfig(spec: ConfigSpec, development: CandidateRow[], evaluation: CandidateRow[], weight: Weight = unit): ConfigResult {
  const fitted = fitConfig(spec, development, weight);
  const dev = bandsFor(fitted, development), ev = bandsFor(fitted, evaluation);
  const authored = (rows: CandidateRow[]) => rows.filter(r => r.origin === 'authored');
  return {
    id: spec.id, fitted, development: dev, evaluation: ev,
    authoredOnly: { development: outcomes(fitted, authored(development), 'medium'), evaluation: outcomes(fitted, authored(evaluation), 'medium') },
    generalizationGap: Math.abs(dev.medium.balancedError - ev.medium.balancedError),
    bandDistribution: { development: distribution(fitted, development), evaluation: distribution(fitted, evaluation) },
  };
}

/** A grid candidate: the contract's rule, credential context, strict negative gate, caps on CAP_GRID. */
export const isGridCandidate = (r: ConfigResult) => r.id.startsWith('halving-');

/** Grid neighbours: the same signals, and caps equal except one of randomness, lexical or contextual one grid step away. */
export function capNeighbours(target: ConfigResult, pool: ConfigResult[]): ConfigResult[] {
  const t = target.fitted.spec;
  const step = (grid: number[], a: number, b: number) => Math.abs(grid.indexOf(a) - grid.indexOf(b)) === 1 && grid.includes(a) && grid.includes(b);
  const same = (a: SignalId[], b: SignalId[]) => a.join(',') === b.join(',');
  return pool.filter(r => {
    const s = r.fitted.spec;
    if (r === target || !same(s.signals.randomness, t.signals.randomness) || !same(s.signals.lexical, t.signals.lexical)) return false;
    const dR = s.caps.randomness !== t.caps.randomness, dL = s.caps.lexical !== t.caps.lexical, dC = s.caps.contextual !== t.caps.contextual;
    if (Number(dR) + Number(dL) + Number(dC) !== 1) return false;
    return dR ? step(CAP_GRID.randomness, s.caps.randomness, t.caps.randomness)
      : dL ? step(CAP_GRID.lexical, s.caps.lexical, t.caps.lexical)
        : step(CAP_GRID.contextual, s.caps.contextual, t.caps.contextual);
  });
}

/**
 * The selection rule (deterministic). Candidates are the contract-conformant
 * grid configurations. Each is judged by its neighbourhood balanced error at
 * `medium` on development rows: the mean over itself and its one-step cap
 * neighbours (non-conformant neighbours count as they are), so a cap setting
 * that only works at one grid point is penalised. Admissible: within
 * SELECTION_TOLERANCE of the best neighbourhood error. Then prefer the fewest
 * fitted parameters, the narrowest leave-one-category-out range of
 * `t_medium`, the lower neighbourhood error, the smaller
 * development-to-evaluation gap, and finally the id. Evaluation rows only
 * break a tie between otherwise equal configurations; they never admit one.
 */
export function selectConfiguration(results: ConfigResult[], development: CandidateRow[], weight: Weight = unit) {
  const grid = results.filter(isGridCandidate);
  const conformant = grid.filter(r => r.fitted.adrConformant);
  if (!conformant.length) throw new Error('No contract-conformant configuration to select from.');
  const neighbourhood = new Map<string, number>();
  for (const r of conformant) {
    const around = [r, ...capNeighbours(r, grid)];
    neighbourhood.set(r.id, around.reduce((s, x) => s + x.development.medium.balancedError, 0) / around.length);
  }
  const hood = (r: ConfigResult) => neighbourhood.get(r.id)!;
  const best = Math.min(...conformant.map(hood));
  const admissible = conformant.filter(r => hood(r) <= best + SELECTION_TOLERANCE);
  const fewest = Math.min(...admissible.map(r => r.fitted.parameters));
  const simplest = admissible.filter(r => r.fitted.parameters === fewest);
  for (const r of simplest) r.loco = leaveOneCategoryOut(r.fitted.spec, development, weight);
  const width = (r: ConfigResult) => r.loco!.mediumRange[1] - r.loco!.mediumRange[0];
  const ranked = [...simplest].sort((a, b) => width(a) - width(b) || hood(a) - hood(b) || a.generalizationGap - b.generalizationGap || a.id.localeCompare(b.id));
  return {
    selected: ranked[0],
    neighbourhoodBalancedError: Object.fromEntries([...neighbourhood].sort(([a], [b]) => a.localeCompare(b))),
    bestNeighbourhoodBalancedError: best,
    admissible: admissible.map(r => r.id).sort(),
    ranked: ranked.map(r => ({ id: r.id, locoMediumRange: r.loco!.mediumRange, neighbourhoodBalancedError: hood(r), generalizationGap: r.generalizationGap })),
  };
}

// ---------------------------------------------------------------------------
// Strata (statistical tuning §6): per family and per context, for one configuration.

export function strata(config: FittedConfig, rows: CandidateRow[], dimension: 'family' | 'contextClass' | 'originBasis') {
  const keys = [...new Set(rows.map(r => r[dimension]))].sort();
  return Object.fromEntries(keys.map(k => [k, outcomes(config, rows.filter(r => r[dimension] === k), 'medium')]));
}

// ---------------------------------------------------------------------------
// Identity: hashes of the selected configuration's components, in the shape a
// tuning manifest's `scoring` block records (#256). Values never leave the
// local result; only their hashes go into the manifest draft.

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export function scoringComponents(config: FittedConfig) {
  const { spec } = config;
  const featureSet = {
    schema: 'evidence-features/v1',
    signals: config.ramps.map(r => ({ signal: r.signal, group: SIGNALS[r.signal].group, features: SIGNALS[r.signal].features })),
    contextual: spec.context ? CREDENTIAL_CONTEXTS : [],
    negative: spec.negativeGate === 'strict' ? STRICT_NEGATIVE_CLASSES : spec.negativeGate,
  };
  const weightSet = { withinGroup: spec.withinGroup, caps: spec.caps, ramps: config.ramps, lookup: config.lookup ?? null };
  return {
    featureSetHash: sha256(canonicalJson(featureSet)),
    weightSetHash: sha256(canonicalJson(weightSet)),
    thresholdSetHash: sha256(canonicalJson(config.thresholds)),
  };
}

export function datasetSummary(dataset: CandidateFeatureDataset) {
  return {
    extractorVersion: dataset.extractor.version,
    extractorSourceHash: dataset.extractor.sourceHash,
    datasetHash: dataset.datasetHash,
    featureSchema: dataset.featureSchema.id,
    benchmark: dataset.benchmark,
  };
}

// ---------------------------------------------------------------------------
// Orchestration.

export interface ExperimentOptions {
  /** Restrict the configurations (tests); defaults to experimentSpecs(). */
  specs?: ConfigSpec[];
  /** Run the generated-share reweighting sensitivity (a second full pass). */
  sensitivity?: boolean;
}

const labelsOf = (scored: ScoredRow[]) => scored.map(s => (isMustRedact(s.row) ? 1 : 0));
const calibrationRows = (rows: CandidateRow[]) => measurable(rows).filter(r => isMustRedact(r) || isControl(r));

/** Platt and isotonic transforms fitted on development rows; Brier and ECE on both partitions. Research only. */
export function calibrationStudy(config: FittedConfig, development: CandidateRow[], evaluation: CandidateRow[]) {
  const dev = scoreRows(config, calibrationRows(development)), ev = scoreRows(config, calibrationRows(evaluation));
  const devScores = dev.map(s => s.score), devLabels = labelsOf(dev);
  const platt = plattFit(devScores, devLabels), isotonic = isotonicFit(devScores, devLabels);
  const diag = (estimate: (s: number) => number) => ({
    development: calibrationDiagnostics(estimate, devScores, devLabels),
    evaluation: calibrationDiagnostics(estimate, ev.map(s => s.score), labelsOf(ev)),
  });
  return {
    note: 'Calibrated estimates are fitted on development rows and are valid for that population only; the integer evidence score itself is ordinal and never a probability.',
    population: 'development must-redact spans versus must-not-flag controls',
    platt: diag(platt),
    isotonic: diag(isotonic),
    /** Isotonic calibrated estimate at each band's lower threshold. */
    isotonicAtThresholds: Object.fromEntries((['low', 'medium', 'high'] as const).map(b => [b, isotonic(config.thresholds[b])])),
  };
}

function authoredOnlySensitivity(results: ConfigResult[], selected: ConfigResult) {
  const conformant = results.filter(r => r.fitted.adrConformant && isGridCandidate(r));
  const rank = (key: (r: ConfigResult) => number) => [...conformant].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id)).findIndex(r => r.id === selected.id) + 1;
  return {
    selected: selected.authoredOnly,
    /** Rank of the selected configuration among the conformant grid by authored-only false-alarm rate on development controls (1 = lowest). */
    authoredFalseAlarmRank: rank(r => r.authoredOnly.development.falseAlarmRate),
    conformantConfigurations: conformant.length,
    bestAuthoredFalseAlarmRate: Math.min(...conformant.map(r => r.authoredOnly.development.falseAlarmRate)),
  };
}

export function runExperiments(dataset: CandidateFeatureDataset, options: ExperimentOptions = {}) {
  const development = dataset.rows.filter(r => r.partition === 'development' && r.tuningEligible);
  const evaluation = dataset.rows.filter(r => r.partition === 'regression');
  const specs = options.specs ?? experimentSpecs();
  const results = specs.map(spec => runConfig(spec, development, evaluation));
  const selection = selectConfiguration(results, development);
  const selected = selection.selected;
  const logistic = results.find(r => r.fitted.spec.kind === 'logistic');
  const generated = (rows: CandidateRow[]) => rows.filter(r => r.origin === 'generated');
  const sensitivity: Record<string, unknown> = {
    authoredOnly: {
      ...authoredOnlySensitivity(results, selected),
      generatedOnly: { development: outcomes(selected.fitted, generated(development), 'medium'), evaluation: outcomes(selected.fitted, generated(evaluation), 'medium') },
    },
  };
  if (options.sensitivity !== false) {
    const weight = generatedShareWeights(development);
    const reweighted = specs.map(spec => runConfig(spec, development, evaluation, weight));
    const again = selectConfiguration(reweighted, development, weight);
    sensitivity.generatedShareReweighted = {
      description: 'Every fit repeated with authored development rows weighted so benchmark-generated rows are half of the total weight (the 0.5 cap); outcomes are unweighted.',
      selectedId: again.selected.id,
      sameConfiguration: again.selected.id === selected.id,
      thresholds: again.selected.fitted.thresholds,
      ramps: again.selected.fitted.ramps,
      development: again.selected.development.medium,
      evaluation: again.selected.evaluation.medium,
      authoredOnly: again.selected.authoredOnly,
      admissible: again.admissible,
    };
  }
  return {
    schemaVersion: 1 as const,
    datasetType: 'calibration-experiments' as const,
    visibility: 'maintainer-local' as const,
    holdoutAccess: 'none' as const,
    experimentVersion: CALIBRATION_EXPERIMENTS_VERSION,
    aggregationContractVersion: AGGREGATION_CONTRACT_VERSION,
    featureDataset: datasetSummary(dataset),
    rows: { development: development.length, evaluation: evaluation.length },
    selectionRule: {
      method: SELECTION_METHOD, tolerance: SELECTION_TOLERANCE, highFalseAlarmTarget: HIGH_FALSE_ALARM_TARGET, capGrid: CAP_GRID,
    },
    configurations: results.map(r => ({
      id: r.id,
      spec: r.fitted.spec,
      adrConformant: r.fitted.adrConformant,
      conformanceProblems: r.fitted.conformanceProblems,
      parameters: r.fitted.parameters,
      maxScore: r.fitted.maxScore,
      ramps: r.fitted.ramps,
      lookup: r.fitted.lookup ?? null,
      thresholds: r.fitted.thresholds,
      development: r.development,
      evaluation: r.evaluation,
      authoredOnly: r.authoredOnly,
      generalizationGap: r.generalizationGap,
      bandDistribution: r.bandDistribution,
    })),
    selection: {
      selectedId: selected.id,
      bestNeighbourhoodBalancedError: selection.bestNeighbourhoodBalancedError,
      admissible: selection.admissible,
      ranked: selection.ranked,
      loco: selected.loco,
      components: scoringComponents(selected.fitted),
      strata: {
        development: { family: strata(selected.fitted, development, 'family'), context: strata(selected.fitted, development, 'contextClass'), origin: strata(selected.fitted, development, 'originBasis') },
        evaluation: { family: strata(selected.fitted, evaluation, 'family'), context: strata(selected.fitted, evaluation, 'contextClass'), origin: strata(selected.fitted, evaluation, 'originBasis') },
      },
      calibration: calibrationStudy(selected.fitted, development, evaluation),
    },
    logisticResearch: logistic ? {
      note: 'Floating-point research reference: not expressible in core fixed-point arithmetic; shows how much separability the integer models leave unused. Its output is not a product value.',
      inputs: [...LOGISTIC_FEATURES, 'credential-context', 'strict-negative'],
      standardizedWeights: logistic.fitted.logistic!.weights,
      calibration: calibrationStudy(logistic.fitted, development, evaluation),
    } : null,
    sensitivity,
  };
}

export type ExperimentResult = ReturnType<typeof runExperiments>;

// ---------------------------------------------------------------------------
// Public projection: aggregate outcomes and identities only
// (./calibration-projection.mjs enforces the shape).

const publicOutcome = (m: OutcomeMetrics) => ({
  rows: m.rows, measurableShare: m.measurableShare, unresolved: m.unresolved, mustRedact: m.mustRedact, policy: m.policy, controls: m.controls,
  leakedSpanRate: m.leakedSpanRate, policyLeakedSpanRate: m.policyLeakedSpanRate, falseAlarmRate: m.falseAlarmRate,
  independentFalseAlarmRate: m.independentFalseAlarmRate, collateralRatio: m.collateralRatio, twins: m.twins,
});

export function buildProjection(result: ExperimentResult, scoringIdentityValue: string, selectionSourceHash: string, generatedShare: { tuningShare: number; overrideApplied: boolean }, minStratumRows: number) {
  const selected = result.configurations.find(c => c.id === result.selection.selectedId)!;
  const project = (s: Record<string, OutcomeMetrics>) => Object.fromEntries(Object.entries(s).filter(([, m]) => m.rows >= minStratumRows).map(([k, m]) => [k, publicOutcome(m)]));
  const suppressed = (['development', 'evaluation'] as const).reduce((n, p) => n
    + Object.values(result.selection.strata[p].family).filter(m => m.rows < minStratumRows).length
    + Object.values(result.selection.strata[p].context).filter(m => m.rows < minStratumRows).length, 0);
  return {
    schemaVersion: 1,
    datasetType: 'calibration-public-projection',
    visibility: 'public-aggregate',
    holdoutAccess: 'none',
    notice: 'Aggregate shadow-scorer outcomes for one selected configuration. The evidence score is ordinal and never a probability; weights, caps, thresholds and per-candidate values are maintainer-local. Nothing here changes product thresholds or enforcement.',
    experimentVersion: result.experimentVersion,
    aggregationContractVersion: result.aggregationContractVersion,
    contractDecision: 'decision-freeze-the-shadow-evidence-score-and-confidence-contract',
    selectionSourceHash,
    scoringIdentity: scoringIdentityValue,
    featureDataset: {
      extractorVersion: result.featureDataset.extractorVersion, extractorSourceHash: result.featureDataset.extractorSourceHash,
      datasetHash: result.featureDataset.datasetHash, featureSchema: result.featureDataset.featureSchema,
    },
    benchmark: result.featureDataset.benchmark,
    generatedShare,
    partitions: {
      development: { operatingPoints: { low: publicOutcome(selected.development.low), medium: publicOutcome(selected.development.medium), high: publicOutcome(selected.development.high) } },
      evaluation: { operatingPoints: { low: publicOutcome(selected.evaluation.low), medium: publicOutcome(selected.evaluation.medium), high: publicOutcome(selected.evaluation.high) } },
    },
    authoredOnly: { development: publicOutcome(selected.authoredOnly.development), evaluation: publicOutcome(selected.authoredOnly.evaluation) },
    strata: {
      development: { family: project(result.selection.strata.development.family), context: project(result.selection.strata.development.context) },
      evaluation: { family: project(result.selection.strata.evaluation.family), context: project(result.selection.strata.evaluation.context) },
    },
    suppressedStrata: suppressed,
  };
}

// ---------------------------------------------------------------------------
// Tuning manifest draft (#256) for the selected configuration. It carries
// hashes and counts only. `product` is the frozen candidate that will carry
// this scoring (redact-secret#770/#798); until one exists the draft leaves it
// null and is validated against every other rule.

/** Reviewed override of the 0.5 generated-share cap (statistical tuning §5). */
export const GENERATED_SHARE_OVERRIDE = {
  cap: 1,
  reason: 'The development corpora are benchmark-generated almost throughout: after the per-row refinement (candidate-features/2) only rows whose value a person typed into a generator, and the three authored corpora, count as authored; roughly four in five tuning rows stay generated, and most families have no authored row at all, so no cap below 1 can hold per family. Mitigations: (1) every run repeats each tuning fit with authored rows reweighted to a 0.5 generated share and reports whether the same configuration is selected (it is, at the time of this review); (2) the selected configuration is also reported on the authored-only and generated-only subsets; (3) the selection penalises cap settings that only work at one grid point. Retire this override when authored rows reach half of each family (more authored corpora, redact-secret-benchmarks#255 follow-up).',
  reviewedBy: 'redact-secret-benchmarks#255 pull request review (maintainer confirmation requested in the PR body)',
} as const;

export interface ManifestContext {
  createdAt: string;
  selectionSourceHash: string;
  corpusHashes: Record<string, string>;
  product: { sourceRevision: string; sourceHash: string; lockHash: string; candidateArtifactHash: string } | null;
}

export function buildManifestDraft(result: ExperimentResult, dataset: CandidateFeatureDataset, context: ManifestContext, scoringIdentityOf: (s: Record<string, string>) => string) {
  const components = {
    contractDecision: 'decision-freeze-the-shadow-evidence-score-and-confidence-contract',
    featureSchemaVersion: dataset.featureSchema.id,
    featureSetHash: result.selection.components.featureSetHash,
    aggregationContractVersion: AGGREGATION_CONTRACT_VERSION,
    weightSetHash: result.selection.components.weightSetHash,
    thresholdSetHash: result.selection.components.thresholdSetHash,
  };
  const tuning = dataset.corpora.filter(c => c.partition === 'development').map(c => ({
    category: c.category, corpusHash: c.corpusHash, rows: c.rows, families: c.families, contexts: c.contexts,
  }));
  const generated = tuning.reduce((s, c) => s + c.rows.generated, 0), total = tuning.reduce((s, c) => s + c.rows.generated + c.rows.authored, 0);
  return {
    schemaVersion: 1 as const,
    // The id never encodes the configuration: grid ids carry cap values, which stay local.
    id: 'shadow-evidence-generic-token-v1',
    status: 'active' as const,
    createdAt: context.createdAt,
    product: context.product,
    benchmark: { commit: dataset.benchmark.commit, dirty: dataset.benchmark.dirty },
    featureDataset: dataset.manifestBinding,
    selection: { method: SELECTION_METHOD, sourceHash: context.selectionSourceHash, seed: 'none' },
    scoring: { ...components, identity: scoringIdentityOf(components) },
    corpora: {
      tuning,
      evaluation: dataset.corpora.filter(c => c.partition === 'regression').map(c => ({ source: c.category, role: 'regression' as const, corpusHash: c.corpusHash })),
    },
    holdoutAccess: 'none' as const,
    generatedShare: { cap: 0.5, override: GENERATED_SHARE_OVERRIDE },
    strata: { dimensions: ['family', 'context', 'kind'] },
    /** Not part of the manifest schema: stripped before a manifest is committed. */
    draftNotes: {
      tuningGeneratedShare: total ? generated / total : 0,
      productPending: context.product === null ? 'No product candidate carries this scoring yet; fill product from the redact-secret#770/#798 candidate before committing under tuning/manifests/.' : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Maintainer-local report (Markdown). Carries exact values; never published.

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const num = (x: number) => x.toFixed(3);

export function renderReport(result: ExperimentResult, manifestProblems: string[]): string {
  const byId = new Map(result.configurations.map(c => [c.id, c]));
  const selected = byId.get(result.selection.selectedId)!;
  const lines: string[] = [];
  const row = (cells: (string | number)[]) => lines.push(`| ${cells.join(' | ')} |`);
  lines.push('# Calibration experiments (maintainer-local)', '',
    '> Maintainer-local. Carries weights, caps, thresholds and band distributions: never publish, paste into an issue, or commit this file.',
    '> The evidence score is an ordinal integer and never a probability. Only the Platt/isotonic rows below are calibrated estimates, valid for the development population only.', '',
    `- experiment: \`${result.experimentVersion}\`, aggregation contract \`${result.aggregationContractVersion}\``,
    `- dataset: \`${result.featureDataset.datasetHash}\` (extractor \`${result.featureDataset.extractorVersion}\`, benchmark \`${result.featureDataset.benchmark.commit}\`${result.featureDataset.benchmark.dirty ? ', dirty' : ''})`,
    `- rows: ${result.rows.development} development (tuning), ${result.rows.evaluation} regression (evaluation-only); holdout read: none`, '');
  lines.push('## Configurations at `medium` (flagged = band >= medium)', '',
    'BE = leaked span rate + false alarm rate. Grid rows: the selected configuration and the five best by development BE.', '');
  row(['configuration', 'conformant', 'params', 't_low/t_med/t_high', 'dev leak', 'dev policy leak', 'dev FA', 'dev indep. FA', 'dev collateral', 'dev twins', 'dev measurable', 'dev BE', 'eval leak', 'eval FA', 'eval collateral', 'eval twins', 'eval BE']);
  row(Array(17).fill('---'));
  const named = result.configurations.filter(c => !c.id.startsWith('halving-'));
  const grid = result.configurations.filter(c => c.id.startsWith('halving-')).sort((a, b) => a.development.medium.balancedError - b.development.medium.balancedError);
  const shown = [...named, selected, ...grid.filter(c => c.id !== selected.id).slice(0, 5)];
  for (const c of shown) {
    const d = c.development.medium, e = c.evaluation.medium, t = c.thresholds;
    row([c.id === selected.id ? `**${c.id}** (selected)` : c.id, c.adrConformant ? 'yes' : 'no', c.parameters, `${t.low}/${t.medium}/${t.high}`,
      pct(d.leakedSpanRate), pct(d.policyLeakedSpanRate), pct(d.falseAlarmRate), pct(d.independentFalseAlarmRate), num(d.collateralRatio),
      `${d.twins.discriminated}/${d.twins.pairs}`, pct(d.measurableShare), num(d.balancedError),
      pct(e.leakedSpanRate), pct(e.falseAlarmRate), num(e.collateralRatio), `${e.twins.discriminated}/${e.twins.pairs}`, num(e.balancedError)]);
  }
  lines.push('', 'Non-conformant configurations and why:', '');
  for (const c of result.configurations.filter(c => !c.adrConformant && !c.id.startsWith('halving-'))) lines.push(`- \`${c.id}\`: ${c.conformanceProblems.join('; ')}`);
  lines.push('', '## Selected configuration', '', `\`${selected.id}\``, '', '```json', JSON.stringify({ spec: selected.spec, ramps: selected.ramps, thresholds: selected.thresholds, maxScore: selected.maxScore }, null, 2), '```', '');
  lines.push('| band cut | partition | leak | policy leak | FA | indep. FA | collateral | twins | measurable |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const band of ['low', 'medium', 'high'] as const) for (const part of ['development', 'evaluation'] as const) {
    const m = selected[part][band];
    lines.push(`| ${band} | ${part} | ${pct(m.leakedSpanRate)} | ${pct(m.policyLeakedSpanRate)} | ${pct(m.falseAlarmRate)} | ${pct(m.independentFalseAlarmRate)} | ${num(m.collateralRatio)} | ${m.twins.discriminated}/${m.twins.pairs} | ${pct(m.measurableShare)} (${Object.entries(m.unresolved).map(([k, v]) => `${k} ${v}`).join(', ')}) |`);
  }
  lines.push('', `Band distribution: development ${JSON.stringify(selected.bandDistribution.development)}, evaluation ${JSON.stringify(selected.bandDistribution.evaluation)}.`, '');
  lines.push('Selection:', '', `- best neighbourhood BE ${num(result.selection.bestNeighbourhoodBalancedError)}; admissible (${result.selection.admissible.length}): ${result.selection.admissible.join(', ')}`,
    `- ranked (fewest parameters first): ${result.selection.ranked.map(r => `${r.id} [LOCO t_medium ${r.locoMediumRange.join('-')}, hood ${num(r.neighbourhoodBalancedError)}, gap ${num(r.generalizationGap)}]`).join('; ')}`,
    `- leave-one-category-out: ${JSON.stringify(result.selection.loco)}`, '');
  const signalKey = (c: typeof selected) => `${c.spec.signals.randomness.join(',')}|${c.spec.signals.lexical.join(',')}`;
  const peers = result.configurations.filter(c => c.id.startsWith('halving-') && signalKey(c) === signalKey(selected) && c.spec.caps.lexical === selected.spec.caps.lexical);
  lines.push('Cap sensitivity for the selected signal set (development BE / evaluation BE at medium):', '', `| cap_randomness \\ cap_contextual | ${CAP_GRID.contextual.join(' | ')} |`, `| --- | ${CAP_GRID.contextual.map(() => '---').join(' | ')} |`);
  for (const r of CAP_GRID.randomness) {
    lines.push(`| ${r} | ${CAP_GRID.contextual.map(cc => { const p = peers.find(x => x.spec.caps.randomness === r && x.spec.caps.contextual === cc); return p ? `${num(p.development.medium.balancedError)} / ${num(p.evaluation.medium.balancedError)}` : '-'; }).join(' | ')} |`);
  }
  for (const [part, s] of Object.entries(result.selection.strata)) for (const [dim, table] of Object.entries(s)) {
    lines.push('', `### Strata: ${part} by ${dim} (medium)`, '', '| stratum | rows | must-redact | controls | leak | policy leak | FA | twins |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const [k, m] of Object.entries(table as Record<string, OutcomeMetrics>)) lines.push(`| ${k} | ${m.rows} | ${m.mustRedact} | ${m.controls} | ${pct(m.leakedSpanRate)} | ${pct(m.policyLeakedSpanRate)} | ${pct(m.falseAlarmRate)} | ${m.twins.discriminated}/${m.twins.pairs} |`);
  }
  lines.push('', '## Sensitivity', '', '```json', JSON.stringify(result.sensitivity, null, 2), '```', '');
  lines.push('## Calibration diagnostics (research only)', '', '```json', JSON.stringify({ selected: result.selection.calibration, logistic: result.logisticResearch?.calibration ?? null }, null, 2), '```', '');
  if (result.logisticResearch) {
    const w = result.logisticResearch.standardizedWeights.map((v, i) => [result.logisticResearch!.inputs[i], v] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 12);
    lines.push('Largest standardized logistic weights: ' + w.map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', '), '');
  }
  lines.push('## Tuning manifest draft', '', manifestProblems.length ? `Validation problems (product excluded):\n\n${manifestProblems.map(p => `- ${p}`).join('\n')}` : 'The draft passes every tuning-manifest rule (product binding pending).', '');
  return lines.join('\n') + '\n';
}
