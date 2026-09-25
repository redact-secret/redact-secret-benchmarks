/**
 * Future-promotion qualification contract for the statistical evidence scorer
 * (#257, cross-repo parent redact-secret/redact-secret#767).
 *
 * Beta.9 ships the scorer shadow-only. This module states, and checks, what a
 * later release must show before the scorer may change default Confidence or
 * action. It is a set of hard constraints, never a mixed score: every gate is
 * judged on its own, a failing gate cannot be offset by another, and no
 * combined figure is computed.
 *
 * - `validatePromotionContract` checks benchmarks/scorer-promotion-contract.json
 *   against schemas/scorer-promotion-contract-v1.json and the rules a JSON
 *   Schema cannot express: questions 1-5 answered separately, every required
 *   dimension gated, the zero-tolerance bounds not loosened, no scorer weight
 *   or cut-off anywhere, and a content hash that forces a new contract version
 *   whenever a gate changes.
 * - `evasionAggregateProblems` and `metricsFromEvasionAggregate` define and
 *   read the aggregate the #289 score-evasion evaluation may publish.
 * - `evaluatePromotion` judges an evidence bundle against the contract and
 *   answers each question separately.
 *
 * Normative text: docs/specs/scorer-promotion-gates.md.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import contractSchema from '../../schemas/scorer-promotion-contract-v1.json';
import evasionSchema from '../../schemas/score-evasion-aggregate-v1.json';
import { canonicalJson } from './adversarial-intake.ts';

export const CONTRACT_PATH = 'benchmarks/scorer-promotion-contract.json';
export const QUESTION_IDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
export type QuestionId = typeof QUESTION_IDS[number];

/** Every dimension #257 names; each must be gated by at least one gate. */
export const REQUIRED_DIMENSIONS = [
  'coherence', 'calibration', 'twin-discrimination', 'false-alarm', 'leaked-span', 'collateral', 'invariance',
  'unstable', 'unreviewed', 'measurable-share', 'evasion', 'negative-evidence-abuse', 'identity', 'protected-holdout',
  'runtime', 'performance', 'size',
] as const;

/** The #289 attack classes; the contract may add classes, never drop one. */
export const ATTACK_CLASSES_289 = [
  'controlled-repetition', 'periodic-body', 'class-distribution', 'length-segmentation', 'placeholder-wrapping',
  'embedded-reference', 'context-perturbation', 'negative-evidence-mixture', 'boundary-discontinuity',
] as const;

/** Issues whose evidence Q5 must cite: product runtime qualification (#772) and the #143 budgets. */
const Q5_REQUIRED_SOURCES = [
  'https://github.com/redact-secret/redact-secret/issues/772',
  'https://github.com/redact-secret/redact-secret-benchmarks/issues/143',
];

/** Metrics `metricsFromEvasionAggregate` derives; a Q4 gate may read only these. */
export const EVASION_METRICS = [
  'evasion.promotionCandidateMode', 'evasion.attackClassesBelowFloor', 'evasion.invariantsHold',
  'evasion.leakedOnlyUnderCandidate', 'evasion.detectionPreservedRate', 'evasion.negativeEvidenceOnPartialMatch',
  'evasion.falseAlarmRate', 'evasion.collateralRatio', 'evasion.unstable', 'evasion.unresolvedShare',
] as const;

/**
 * Keys that would publish or depend on a decision-boundary value of the scorer.
 * Gate bounds are named `bound`; the scorer's own cut-offs, weights and caps
 * never appear in the contract or in the #289 aggregate.
 */
const FORBIDDEN_KEY = /weight|threshold|cut-?off|ramp|contribution|feature(?!s?$)|recipe|mutation|probabilit|lookup|logistic|calibrationCurve|^caps?$|^t_?(low|medium|high)$|^(raw)?scores?$|perCandidate|variantIds?$/i;

type Operator = '==' | '<=' | '>=';
export interface Gate {
  id: string;
  question: QuestionId;
  dimension: string;
  metric: string;
  kind: 'boolean' | 'absolute' | 'delta' | 'member';
  operator?: Operator;
  bound?: number | boolean;
  allowed?: string[];
  strata?: { dimensions: string[]; operator?: Operator; bound?: number; minimumSupport: number; required?: string[] };
  source: string;
  visibility: 'public' | 'verdict-only';
  rationale: string;
}
export interface PromotionContract {
  schemaVersion: 1;
  id: 'scorer-promotion-gates';
  contractVersion: number;
  status: 'proposed' | 'accepted';
  principles: Record<string, boolean>;
  beta9: { enforcementPromotion: false; passesWithoutQuestion5: true; statement: string };
  identity: { fields: string[]; rule: string };
  evasionAggregate: {
    requiredAttackClasses: string[];
    minimumVariantsPerClass: number;
    countFields: string[];
    invariantFields: string[];
  };
  questions: { id: QuestionId; question: string; beta9Role: 'informational' | 'not-required'; population: string }[];
  gates: Gate[];
  revisions: { contractVersion: number; date: string; summary: string; contentHash: string }[];
  [key: string]: unknown;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: true });
const validContractShape = ajv.compile(contractSchema);
const validEvasionShape = ajv.compile(evasionSchema);
const schemaErrors = (errors: typeof validContractShape.errors) =>
  (errors ?? []).map(e => `schema: ${e.instancePath || '/'} ${e.message}${e.params && 'missingProperty' in e.params ? ` (${e.params.missingProperty})` : ''}`);

export function loadPromotionContract(root: string): PromotionContract {
  return JSON.parse(readFileSync(join(root, CONTRACT_PATH), 'utf8'));
}

/**
 * SHA-256 over the canonical JSON of everything the contract says, except its
 * revision history and `$schema`. Changing any gate, bound, question or rule
 * changes it, so the change needs a new revision entry and contract version.
 */
export function contractContentHash(contract: PromotionContract): string {
  const { $schema: _schema, revisions: _revisions, ...content } = contract;
  return sha256(canonicalJson(content));
}

function forbiddenKeys(value: unknown, at: string, out: string[]): string[] {
  if (Array.isArray(value)) value.forEach((item, i) => forbiddenKeys(item, `${at}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key !== '$schema' && FORBIDDEN_KEY.test(key)) out.push(`${at}.${key}: a scorer weight, cut-off or candidate-level key is never part of this record`);
      forbiddenKeys(item, `${at}.${key}`, out);
    }
  }
  return out;
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

/** Every rule violation in the contract, each naming the field at fault. Empty when valid. */
export function validatePromotionContract(contract: unknown): string[] {
  if (!validContractShape(contract)) return schemaErrors(validContractShape.errors);
  const c = contract as PromotionContract;
  const problems: string[] = [...forbiddenKeys(c, '$', [])];

  // Questions 1-5, each once, answered separately; beta.9 needs no Q5.
  const questionIds = c.questions.map(q => q.id);
  for (const id of QUESTION_IDS) {
    const count = questionIds.filter(q => q === id).length;
    if (count !== 1) problems.push(`questions: ${id} must appear exactly once`);
  }
  for (const q of c.questions) {
    const expected = q.id === 'Q5' ? 'not-required' : 'informational';
    if (q.beta9Role !== expected) problems.push(`questions.${q.id}.beta9Role: must be ${expected}; beta.9 is shadow-only and passes without question 5`);
  }

  // Gates: unique, well-formed, each answering one question.
  const ids = new Set<string>();
  const metrics = new Set<string>();
  for (const g of c.gates) {
    const at = `gates.${g.id}`;
    if (ids.has(g.id)) problems.push(`${at}: duplicate gate id`);
    ids.add(g.id);
    if (metrics.has(g.metric)) problems.push(`${at}: metric ${g.metric} is already gated; one metric, one gate`);
    metrics.add(g.metric);
    if (!g.id.startsWith(`${g.question.toLowerCase()}-`)) problems.push(`${at}: id prefix must match its question ${g.question}`);
    if (g.kind === 'boolean') {
      if (g.operator !== '==' || typeof g.bound !== 'boolean') problems.push(`${at}: a boolean gate uses operator == and a boolean bound`);
    } else if (g.kind === 'member') {
      if (!g.allowed?.length || g.operator !== undefined || g.bound !== undefined) problems.push(`${at}: a member gate lists allowed outcomes and has no operator or bound`);
      if (!g.strata?.required?.length) problems.push(`${at}: a member gate names the strata that must all be present`);
    } else {
      if (!g.operator || typeof g.bound !== 'number') problems.push(`${at}: a ${g.kind} gate needs an operator and a numeric bound`);
    }
    if (g.kind !== 'member' && g.allowed !== undefined) problems.push(`${at}: only a member gate lists allowed outcomes`);
    if (g.strata && g.kind !== 'member' && (g.strata.operator === undefined || g.strata.bound === undefined)) problems.push(`${at}.strata: needs an operator and a bound`);
    if (g.strata && g.kind === 'boolean') problems.push(`${at}.strata: a boolean gate is not stratified`);
    if (g.metric.startsWith('evasion.') !== (g.question === 'Q4')) problems.push(`${at}: Q4 gates, and only Q4 gates, read the #289 evasion aggregate`);
    if (g.metric.startsWith('evasion.') && !(EVASION_METRICS as readonly string[]).includes(g.metric)) problems.push(`${at}: ${g.metric} is not derived from the #289 aggregate fields`);
  }
  for (const id of QUESTION_IDS) {
    if (!c.gates.some(g => g.question === id)) problems.push(`gates: question ${id} has no gate`);
  }
  for (const dimension of REQUIRED_DIMENSIONS) {
    if (!c.gates.some(g => g.dimension === dimension)) problems.push(`gates: no gate covers the ${dimension} dimension`);
  }

  // Zero-tolerance constraints that a contract revision may not loosen.
  const zeroTolerance = (g: Gate) => ['leaked-span', 'invariance', 'negative-evidence-abuse'].includes(g.dimension)
    || /leakedOnlyUnderCandidate$/.test(g.metric);
  for (const g of c.gates.filter(zeroTolerance)) {
    const ok = (op?: Operator, bound?: number | boolean) => bound === 0 && (op === '==' || op === '<=');
    if (!ok(g.operator, g.bound)) problems.push(`gates.${g.id}: a leakage, invariance or negative-evidence gate is zero-tolerance (== 0 or <= 0)`);
    if (g.strata && !ok(g.strata.operator, g.strata.bound)) problems.push(`gates.${g.id}.strata: a leakage, invariance or negative-evidence gate is zero-tolerance in every stratum`);
  }
  const needMetric = (question: QuestionId, metric: string, why: string) => {
    if (!c.gates.some(g => g.question === question && g.metric === metric && g.kind === 'boolean' && g.bound === true)) problems.push(`gates: ${question} must gate ${metric} == true (${why})`);
  };
  needMetric('Q5', 'identity.newModelIdentity', 'any promotion is a new model identity, redact-secret#798');
  needMetric('Q5', 'identity.newCandidateIdentity', 'any promotion is a new candidate identity, redact-secret#798');
  needMetric('Q5', 'holdout.independentRun', 'the protected-holdout result is independent evidence');
  needMetric('Q4', 'evasion.invariantsHold', '#289 invariants');
  for (const source of Q5_REQUIRED_SOURCES) {
    if (!c.gates.some(g => g.question === 'Q5' && g.source === source)) problems.push(`gates: Q5 must cite product-supplied qualification from ${source}`);
  }
  for (const g of c.gates.filter(g => g.question !== 'Q5' && ['protected-holdout', 'runtime', 'performance', 'size', 'identity', 'governance'].includes(g.dimension))) {
    problems.push(`gates.${g.id}: ${g.dimension} evidence is independent evidence and belongs to Q5`);
  }

  // The #289 aggregate the contract reads must match its schema.
  const counts = (evasionSchema as { definitions: { counts: { required: string[] } } }).definitions.counts.required;
  const invariants = (evasionSchema as { properties: { invariants: { required: string[] } } }).properties.invariants.required;
  if (!sameSet(c.evasionAggregate.countFields, counts)) problems.push('evasionAggregate.countFields: must equal the count fields of schemas/score-evasion-aggregate-v1.json');
  if (!sameSet(c.evasionAggregate.invariantFields, invariants)) problems.push('evasionAggregate.invariantFields: must equal the invariant fields of schemas/score-evasion-aggregate-v1.json');
  for (const cls of ATTACK_CLASSES_289) {
    if (!c.evasionAggregate.requiredAttackClasses.includes(cls)) problems.push(`evasionAggregate.requiredAttackClasses: must include the #289 class ${cls}`);
  }

  // Versioning: the last revision describes this content.
  const last = c.revisions[c.revisions.length - 1];
  c.revisions.forEach((r, i) => {
    if (r.contractVersion !== i + 1) problems.push(`revisions[${i}].contractVersion: revisions are numbered 1, 2, 3, ... in order`);
  });
  if (last.contractVersion !== c.contractVersion) problems.push('contractVersion: must equal the last revision\'s contractVersion');
  const hash = contractContentHash(c);
  if (last.contentHash !== hash) problems.push(`revisions: the contract content changed without a new revision; add contractVersion ${c.contractVersion + 1} with contentHash ${hash}`);
  return problems;
}

// ---------------------------------------------------------------------------
// #289 aggregate

export type Counts = Record<string, number>;
export interface EvasionAggregate {
  schemaVersion: 1;
  reportType: 'score-evasion-aggregate';
  mode: 'shadow' | 'promotion-candidate';
  identity: Record<string, string | number | null>;
  totals: Counts;
  attackClasses: Record<string, Counts>;
  invariants: Record<string, boolean | null>;
  [key: string]: unknown;
}

const MIN_PUBLISHED_CLASS_VARIANTS = 5;

function countProblems(counts: Counts, at: string): string[] {
  const problems: string[] = [];
  const resolved = counts.detectionPreserved + counts.leakedSpans;
  if (resolved !== counts.legacyDetectionPreserved + counts.legacyLeakedSpans) problems.push(`${at}: candidate and legacy must cover the same resolved must-redact variants`);
  if (counts.variants !== counts.unresolved + counts.unstable + counts.controls + resolved) problems.push(`${at}: variants must equal unresolved + unstable + controls + resolved must-redact variants`);
  if (counts.leakedOnlyUnderCandidate > counts.leakedSpans) problems.push(`${at}: leakedOnlyUnderCandidate cannot exceed leakedSpans`);
  if (counts.falseAlarms > counts.controls || counts.legacyFalseAlarms > counts.controls) problems.push(`${at}: false alarms cannot exceed controls`);
  if (counts.negativeEvidenceOnPartialMatch > counts.negativeEvidenceApplied) problems.push(`${at}: negativeEvidenceOnPartialMatch cannot exceed negativeEvidenceApplied`);
  return problems;
}

/** Problems with a #289 aggregate; empty when it may be published and read by the contract. */
export function evasionAggregateProblems(aggregate: unknown): string[] {
  if (!validEvasionShape(aggregate)) return schemaErrors(validEvasionShape.errors);
  const a = aggregate as EvasionAggregate;
  const problems = [...forbiddenKeys(a, '$', [])];
  problems.push(...countProblems(a.totals, 'totals'));
  for (const [cls, counts] of Object.entries(a.attackClasses)) {
    problems.push(...countProblems(counts, `attackClasses.${cls}`));
    if (counts.variants < MIN_PUBLISHED_CLASS_VARIANTS) problems.push(`attackClasses.${cls}: fewer than ${MIN_PUBLISHED_CLASS_VARIANTS} variants is never published`);
  }
  for (const field of Object.keys(a.totals)) {
    const sum = Object.values(a.attackClasses).reduce((s, counts) => s + counts[field], 0);
    if (sum !== a.totals[field]) problems.push(`totals.${field}: must equal the sum over attack classes`);
  }
  if (a.mode === 'shadow' && a.invariants.shadowNonEnforcing === null) problems.push('invariants.shadowNonEnforcing: a shadow-mode aggregate states whether enforcement stayed unchanged');
  if (a.mode === 'promotion-candidate' && a.invariants.shadowNonEnforcing !== null) problems.push('invariants.shadowNonEnforcing: is null in promotion-candidate mode');
  return problems;
}

export interface StratumEvidence { value?: number | boolean | string; candidate?: number; legacy?: number; support?: number }
export interface MetricEvidence extends StratumEvidence { strata?: Record<string, Record<string, StratumEvidence>> }
export interface PromotionEvidence { metrics: Record<string, MetricEvidence> }

const rate = (numerator: number, denominator: number) => (denominator === 0 ? 0 : numerator / denominator);

function evasionRates(c: Counts) {
  const resolved = c.detectionPreserved + c.leakedSpans;
  return {
    detectionPreservedRate: { candidate: rate(c.detectionPreserved, resolved), legacy: rate(c.legacyDetectionPreserved, resolved), support: resolved },
    falseAlarmRate: { candidate: rate(c.falseAlarms, c.controls), legacy: rate(c.legacyFalseAlarms, c.controls), support: c.controls },
    collateralRatio: { candidate: rate(c.collateralBytes, c.mustRedactBytes), legacy: rate(c.legacyCollateralBytes, c.mustRedactBytes), support: resolved },
  };
}

/** The Q4 metrics, derived from the aggregate fields #289 publishes and nothing else. */
export function metricsFromEvasionAggregate(aggregate: EvasionAggregate, contract: PromotionContract): Record<string, MetricEvidence> {
  const { totals, attackClasses } = aggregate;
  const floor = contract.evasionAggregate.minimumVariantsPerClass;
  const byClass = <T>(f: (c: Counts) => T) => Object.fromEntries(Object.entries(attackClasses).map(([cls, c]) => [cls, f(c)]));
  const rates = evasionRates(totals);
  const invariants = contract.evasionAggregate.invariantFields.filter(f => f !== 'shadowNonEnforcing');
  return {
    'evasion.promotionCandidateMode': { value: aggregate.mode === 'promotion-candidate' },
    'evasion.attackClassesBelowFloor': {
      value: contract.evasionAggregate.requiredAttackClasses
        .filter(cls => !attackClasses[cls] || attackClasses[cls].variants - attackClasses[cls].unresolved < floor).length,
    },
    'evasion.invariantsHold': {
      value: invariants.every(f => aggregate.invariants[f] === true)
        && (aggregate.mode !== 'shadow' || aggregate.invariants.shadowNonEnforcing === true),
    },
    'evasion.leakedOnlyUnderCandidate': {
      value: totals.leakedOnlyUnderCandidate,
      strata: { attackClass: byClass(c => ({ value: c.leakedOnlyUnderCandidate, support: c.variants })) },
    },
    'evasion.detectionPreservedRate': {
      ...rates.detectionPreservedRate,
      strata: { attackClass: byClass(c => evasionRates(c).detectionPreservedRate) },
    },
    'evasion.negativeEvidenceOnPartialMatch': {
      value: totals.negativeEvidenceOnPartialMatch,
      strata: { attackClass: byClass(c => ({ value: c.negativeEvidenceOnPartialMatch, support: c.variants })) },
    },
    'evasion.falseAlarmRate': rates.falseAlarmRate,
    'evasion.collateralRatio': rates.collateralRatio,
    'evasion.unstable': { value: totals.unstable },
    'evasion.unresolvedShare': { value: rate(totals.unresolved, totals.variants) },
  };
}

/**
 * Problems with the identities of the evidence one promotion decision cites:
 * every cited record carries exactly the promotion candidate's identity tuple.
 * Empty means `identity.evidenceConsistent` may be recorded as true.
 */
export function evidenceIdentityProblems(
  contract: PromotionContract,
  candidate: Record<string, unknown>,
  cited: { source: string; identity: Record<string, unknown> }[],
): string[] {
  const problems: string[] = [];
  for (const field of contract.identity.fields) {
    if (candidate[field] === undefined || candidate[field] === null) problems.push(`candidate: ${field} is not bound`);
  }
  for (const { source, identity } of cited) {
    for (const field of contract.identity.fields) {
      if (identity[field] !== candidate[field]) problems.push(`${source}: ${field} does not match the promotion candidate; the evidence is stale`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Evaluation

export type Verdict = 'pass' | 'fail' | 'not-evaluated';
export interface GateOutcome { id: string; dimension: string; verdict: Verdict; reasons: string[]; unsupportedStrata: string[] }
export interface QuestionOutcome { id: QuestionId; question: string; beta9Role: string; verdict: Verdict; gates: GateOutcome[] }
export interface PromotionOutcome {
  contractVersion: number;
  contentHash: string;
  questions: QuestionOutcome[];
  /** True only when every gate of every question passes. There is no partial or weighted promotion. */
  promotable: boolean;
  /** Beta.9 is shadow-only: no outcome of this contract blocks it. */
  blocksBeta9: false;
}

const compare = (value: number, op: Operator, bound: number) =>
  (op === '==' ? value === bound : op === '<=' ? value <= bound + 1e-12 : value >= bound - 1e-12);

/** The value a gate reads from one evidence cell, or a reason it cannot. */
function observed(gate: Gate, cell: StratumEvidence): { value?: number | boolean | string; missing?: string } {
  if (gate.kind === 'delta') {
    if (typeof cell.candidate !== 'number' || typeof cell.legacy !== 'number') return { missing: 'needs candidate and legacy values' };
    return { value: cell.candidate - cell.legacy };
  }
  if (cell.value === undefined) return { missing: 'needs a value' };
  return { value: cell.value };
}

function judge(gate: Gate, value: number | boolean | string, op?: Operator, bound?: number | boolean): boolean {
  if (gate.kind === 'member') return typeof value === 'string' && (gate.allowed ?? []).includes(value);
  if (gate.kind === 'boolean') return value === bound;
  return typeof value === 'number' && compare(value, op as Operator, bound as number);
}

function evaluateGate(gate: Gate, evidence: PromotionEvidence): GateOutcome {
  const outcome: GateOutcome = { id: gate.id, dimension: gate.dimension, verdict: 'pass', reasons: [], unsupportedStrata: [] };
  const entry = evidence.metrics[gate.metric];
  const notEvaluated = (reason: string) => { if (outcome.verdict !== 'fail') outcome.verdict = 'not-evaluated'; outcome.reasons.push(reason); };
  const fail = (reason: string) => { outcome.verdict = 'fail'; outcome.reasons.push(reason); };
  if (!entry) { notEvaluated(`no evidence for ${gate.metric}`); return outcome; }

  if (gate.kind !== 'member' || entry.value !== undefined) {
    const aggregate = observed(gate, entry);
    if (aggregate.missing) notEvaluated(`${gate.metric}: ${aggregate.missing}`);
    else if (!judge(gate, aggregate.value!, gate.operator, gate.bound)) fail(`${gate.metric}: ${JSON.stringify(aggregate.value)} does not satisfy ${gate.kind === 'member' ? `one of ${gate.allowed!.join(', ')}` : `${gate.kind === 'delta' ? 'delta ' : ''}${gate.operator} ${gate.bound}`}`);
  }

  if (gate.strata) {
    for (const dimension of gate.strata.dimensions) {
      const strata = entry.strata?.[dimension];
      if (!strata) { notEvaluated(`${gate.metric}: no ${dimension} strata`); continue; }
      for (const name of gate.strata.required ?? []) {
        if (!(name in strata)) notEvaluated(`${gate.metric}: required ${dimension} stratum ${name} is missing`);
      }
      for (const [name, cell] of Object.entries(strata).sort(([a], [b]) => a.localeCompare(b))) {
        if ((cell.support ?? Infinity) < gate.strata.minimumSupport) { outcome.unsupportedStrata.push(`${dimension}:${name}`); continue; }
        const got = observed(gate, cell);
        if (got.missing) notEvaluated(`${gate.metric} ${dimension}:${name}: ${got.missing}`);
        else if (!judge(gate, got.value!, gate.strata.operator, gate.strata.bound)) fail(`${gate.metric} ${dimension}:${name}: ${JSON.stringify(got.value)} does not satisfy ${gate.kind === 'member' ? `one of ${gate.allowed!.join(', ')}` : `${gate.strata.operator} ${gate.strata.bound}`}`);
      }
    }
  }
  return outcome;
}

const worst = (verdicts: Verdict[]): Verdict => (verdicts.includes('fail') ? 'fail' : verdicts.includes('not-evaluated') ? 'not-evaluated' : 'pass');

/** Judge an evidence bundle. Each question is answered on its own gates; nothing is summed or weighted. */
export function evaluatePromotion(contract: PromotionContract, evidence: PromotionEvidence): PromotionOutcome {
  const questions = QUESTION_IDS.map(id => {
    const q = contract.questions.find(item => item.id === id)!;
    const gates = contract.gates.filter(g => g.question === id).map(g => evaluateGate(g, evidence));
    return { id, question: q.question, beta9Role: q.beta9Role, verdict: worst(gates.map(g => g.verdict)), gates };
  });
  return {
    contractVersion: contract.contractVersion,
    contentHash: contractContentHash(contract),
    questions,
    promotable: questions.every(q => q.verdict === 'pass'),
    blocksBeta9: false,
  };
}
