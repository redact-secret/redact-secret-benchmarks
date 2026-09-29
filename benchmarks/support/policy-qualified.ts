import type { CaseResult, EvaluationCase, ReviewLedger } from '../engine/types.ts';
import type { Finding, Outcome } from '../types.ts';
import { OUTCOMES, scoreRow } from '../lib/lattice.ts';
import data from './policy-qualified-credentials.json';
import type { CredentialPolicyHoldoutReport } from '../evaluation/domains/credential-policy/holdout.ts';

export const POLICY_FAMILIES = ['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token'] as const;
export type PolicyFamily = typeof POLICY_FAMILIES[number];
export type PolicyAction = 'warn' | 'redact' | 'block' | 'allow';
export type PolicyGateCode =
  | 'policy-contract' | 'positive-cases' | 'positive-axes' | 'benign-cases' | 'benign-axes' | 'twin-pairs'
  | 'exact-span' | 'leaked-span' | 'overbroad-span' | 'collateral' | 'redact-false-alarm' | 'block-false-alarm'
  | 'positive-action' | 'unresolved-action' | 'critical-failure' | 'public-conformance' | 'protected-holdout';

export interface PolicyGateFailure { code: PolicyGateCode; actual: number | string; required: number | string; }
export interface PolicyHoldoutReceipt {
  schemaVersion: 2; profileId: 'credential-policy-v1'; productRevision: string; benchmarkRevision: string;
  report: CredentialPolicyHoldoutReport;
}
export interface PolicyBehaviorAggregate {
  profileId: 'credential-policy-v1'; contractVersion: 1; contractBounded: boolean;
  positiveCases: number; positiveAxes: number; benignCases: number; benignAxes: number; twinPairs: number;
  spans: number; outcomes: Record<Outcome, number>; exactSpanMisses: number; leakedSpans: number; overbroadSpans: number; collateralBytes: number;
  positiveActions: Record<PolicyAction, number>; controlFalseAlarms: Record<PolicyAction, number>;
  unexpectedPositiveActions: number; unresolvedActionCases: number;
  publicConformanceCases: number; publicConformanceFailures: number;
  publicConformance: 'pass' | 'fail' | 'not-run'; protectedHoldout: 'pass' | 'fail' | 'not-run'; candidateFrozen: boolean;
  failedGates: PolicyGateFailure[];
}

type Contract = {
  taxonomyFamily: string; trigger: string; candidate: string; exactSpan: string;
  requiredAction: 'redact' | 'fixture-resolved'; allowedActions?: PolicyAction[]; actionResolution?: string;
  exclusions: string[]; blindSpots: string[]; externalFacts: string[]; projectPolicy: string[];
};
type Profile = typeof data & { families: Record<PolicyFamily, Contract> };
export const policyCredentialProfile = data as Profile;

const emptyActions = (): Record<PolicyAction, number> => ({ warn: 0, redact: 0, block: 0, allow: 0 });
const emptyOutcomes = (): Record<Outcome, number> => Object.fromEntries(OUTCOMES.map(outcome => [outcome, 0])) as Record<Outcome, number>;
const actionOf = (value: string | undefined): PolicyAction | null =>
  value && ['warn', 'redact', 'block', 'allow'].includes(value) ? value as PolicyAction : null;

/**
 * Aggregate only canonical differential rows. Other methods deliberately reuse
 * the same fixture, so counting their rows would multiply evidence. Values and
 * ranges never leave the evaluator; this artifact contains counts only.
 */
export function policyBehaviorAggregate(family: string, cases: EvaluationCase[], results: CaseResult[],
  criticalFailures: number, holdout?: PolicyHoldoutReceipt): PolicyBehaviorAggregate | null {
  if (!POLICY_FAMILIES.includes(family as PolicyFamily)) return null;
  const id = family as PolicyFamily, contract = policyCredentialProfile.families[id];
  // Positive claims must be T3. Controls and twins may carry a stronger source
  // tier for the property they negate; using that evidence does not relabel the
  // family's positive contract or qualification basis.
  const selected = cases.filter(c => c.method === 'differential' && c.targets.includes(id) && c.seed.assessment.tier !== 'T0' &&
    (!c.seed.expected.some(expected => (expected.role ?? 'secret') === 'secret') || c.seed.assessment.tier === 'T3'));
  const byId = new Map(results.filter(r => r.method === 'differential').map(r => [r.id, r]));
  const outcomes = emptyOutcomes(), positiveActions = emptyActions(), controlFalseAlarms = emptyActions();
  const positiveAxes = new Set<string>(), benignAxes = new Set<string>();
  let positiveCases = 0, benignCases = 0, twinPairs = 0, spans = 0, collateralBytes = 0;
  let unexpectedPositiveActions = 0, unresolvedActionCases = 0, publicConformanceCases = 0, publicConformanceFailures = 0;
  for (const c of selected) {
    const result = byId.get(c.id);
    const observation = result?.observations?.find(item => item.scanner === 'redact-secret');
    const actual = (observation?.variants[0]?.actual as Finding[] | undefined)?.filter(finding => finding.family === id);
    const conformance = c.seed.policyConformance === true;
    if (conformance) publicConformanceCases++;
    if (!actual) { if (conformance) publicConformanceFailures++; continue; }
    if (c.seed.expected.some(expected => (expected.role ?? 'secret') === 'secret')) {
      positiveCases++;
      positiveAxes.add(c.seed.contextAxis ?? `${c.source.category}/${c.seed.group}`);
      const scored = scoreRow(c.seed.expected, actual);
      for (const outcome of scored.spanOutcomes ?? []) { outcomes[outcome]++; spans++; }
      collateralBytes += scored.collateralBytes ?? 0;
      const actions = new Set(actual.map(finding => actionOf(finding.action)).filter((action): action is PolicyAction => Boolean(action)));
      for (const action of actions) positiveActions[action]++;
      const expectedAction = c.seed.expectedAction;
      if (conformance) {
        if (!expectedAction) unresolvedActionCases++;
        else if (!actions.has(expectedAction) || actions.size !== 1 || actual.some(finding => actionOf(finding.action) !== expectedAction))
          unexpectedPositiveActions++;
      }
      if (conformance && (scored.spanOutcomes?.some(outcome => outcome !== 'EXACT') || !expectedAction ||
          !actions.has(expectedAction) || actions.size !== 1 || actual.some(finding => actionOf(finding.action) !== expectedAction)))
        publicConformanceFailures++;
    } else {
      if (c.seed.twinOf) twinPairs++;
      else { benignCases++; benignAxes.add(c.seed.contextAxis ?? c.seed.group); }
      for (const action of new Set(actual.map(finding => actionOf(finding.action)).filter((a): a is PolicyAction => Boolean(a)))) controlFalseAlarms[action]++;
      if (conformance && actual.length) publicConformanceFailures++;
    }
  }
  const publicConformance = publicConformanceCases === 0 ? 'not-run' : publicConformanceFailures === 0 ? 'pass' : 'fail';
  const protectedHoldout = holdout ? holdout.report.families[id].failures === 0 ? 'pass' : 'fail' : 'not-run';
  const aggregate: Omit<PolicyBehaviorAggregate, 'failedGates'> = {
    profileId: 'credential-policy-v1', contractVersion: 1,
    contractBounded: Boolean(contract.trigger && contract.candidate && contract.exactSpan && contract.exclusions.length && contract.blindSpots.length),
    positiveCases, positiveAxes: positiveAxes.size, benignCases, benignAxes: benignAxes.size, twinPairs,
    spans, outcomes, exactSpanMisses: spans - outcomes.EXACT, leakedSpans: outcomes.PARTIAL + outcomes.MISS,
    overbroadSpans: outcomes.OVERBROAD, collateralBytes, positiveActions, controlFalseAlarms,
    unexpectedPositiveActions, unresolvedActionCases, publicConformanceCases, publicConformanceFailures,
    publicConformance, protectedHoldout, candidateFrozen: Boolean(holdout),
  };
  const c = policyCredentialProfile.criteria, failedGates: PolicyGateFailure[] = [];
  const floor = (code: PolicyGateCode, actual: number, required: number, comparison: 'min' | 'max' = 'min') => {
    if (comparison === 'min' ? actual < required : actual > required) failedGates.push({ code, actual, required });
  };
  if (!aggregate.contractBounded) failedGates.push({ code: 'policy-contract', actual: 'unbounded', required: 'bounded' });
  floor('positive-cases', positiveCases, c.minimumPositiveCases); floor('positive-axes', positiveAxes.size, c.minimumPositiveAxes);
  floor('benign-cases', benignCases, c.minimumBenignCases); floor('benign-axes', benignAxes.size, c.minimumBenignAxes); floor('twin-pairs', twinPairs, c.minimumTwinPairs);
  floor('exact-span', aggregate.exactSpanMisses, c.exactSpanMisses, 'max'); floor('leaked-span', aggregate.leakedSpans, c.leakedSpans, 'max');
  floor('overbroad-span', aggregate.overbroadSpans, c.overbroadSpans, 'max'); floor('collateral', collateralBytes, c.collateralBytes, 'max');
  floor('redact-false-alarm', controlFalseAlarms.redact, c.redactFalseAlarms, 'max'); floor('block-false-alarm', controlFalseAlarms.block, c.blockFalseAlarms, 'max');
  floor('positive-action', unexpectedPositiveActions, c.unexpectedPositiveActions, 'max'); floor('unresolved-action', unresolvedActionCases, c.unresolvedActionCases, 'max');
  floor('critical-failure', criticalFailures, c.unresolvedCriticalFailures, 'max');
  if (c.requirePublicConformance && aggregate.publicConformance !== 'pass') failedGates.push({ code: 'public-conformance', actual: aggregate.publicConformance, required: 'pass' });
  if (c.requireProtectedHoldout && (aggregate.protectedHoldout !== 'pass' || !aggregate.candidateFrozen))
    failedGates.push({ code: 'protected-holdout', actual: aggregate.protectedHoldout, required: 'pass on frozen candidate' });
  return { ...aggregate, failedGates };
}

export const policyGateReasons = (aggregate: PolicyBehaviorAggregate | null): string[] =>
  aggregate?.failedGates.map(gate => `policy.${gate.code}: ${gate.actual} (requires ${gate.required})`) ?? ['policy.contract: no policy-qualified profile'];
