import type { Tier } from '../types.ts';
import data from './status-criteria.json';
import { fixtureProfiles, profileFailures as fixtureProfileFailures, type FixtureProfileEvidence, type FixtureProfiles } from './profiles.ts';

/**
 * Family support status (issue #503, part of epic #500). A machine-readable
 * profile that decides a provider x credential-family's support status from
 * evidence alone, so no status is ever hand-written into README, docs or UI.
 * See docs/specs/support-status.md.
 *
 * This profile is deliberately downstream of, and never a substitute for,
 * `scripts/check-evidence-arrival.mjs` (#52): these floors are pass-rate
 * thresholds over evidence that is assumed to already exist. A family
 * missing a required evidence kind entirely — no twin, no benign control,
 * no metamorphic or mutation case — reads as zero cases here, which already
 * fails `minimumTwinPairs`/`benign.minimumCases` on its way to `stable`; the
 * arrival gate is what makes that failure legible as a missing element
 * rather than an unexplained zero, and is the one CI checks before this
 * profile's numbers are trusted at all. Clearing the arrival contract is
 * necessary for `stable`; it is never sufficient on its own.
 */
export type SupportStatus = 'stable' | 'provisional' | 'pending' | 'unsupported';
export type EvidenceBasis = 'provider-documented' | 'independently-corroborated' | 'empirically-observed' | 'project-policy' | 'none';
export type QualificationProfile = 'documented' | 'empirical';

/** Reader-facing names for each evidence basis; the UI shows the machine value beside it. */
export const EVIDENCE_BASIS_LABEL: Record<EvidenceBasis, string> = {
  'provider-documented': 'Provider-documented',
  'independently-corroborated': 'Corroborated by external sources (no provider-issued observation required)',
  'empirically-observed': 'Provider-issued observations',
  'project-policy': 'Project policy',
  none: 'None',
};

interface Threshold { value: number; rationale: string }

export interface StatusCriteria {
  schemaVersion: 1;
  stable: {
    documented: {
      tier: 'T1'; requireProviderSource: true; rationale: string;
      minimumPositiveCases: Threshold; minimumPositiveAxes: Threshold; minimumBenignCases: Threshold;
      minimumControlAxes: Threshold; minimumTwinPairs: Threshold;
    };
    empirical: {
      tier: 'T2'; rationale: string;
      minimumObservations: Threshold; minimumSubjects: Threshold; minimumIssuanceDates: Threshold;
      minimumCorroborationClasses: Threshold;
      /** The corroborated route (#177 amendment, 2026-09-24): qualifies a T2 family with no provider-issued observation. */
      corroborated: {
        minimumReferences: Threshold; minimumOwners: Threshold; minimumClasses: Threshold;
        summaryClasses: { classes: string[]; rationale: string }; rationale: string;
      };
      unresolvedContradictions: Threshold;
      minimumPositiveCases: Threshold; minimumPositiveAxes: Threshold;
      minimumBenignCases: Threshold; minimumControlAxes: Threshold; minimumTwinPairs: Threshold;
      contextConstrained: { minimumContextTwinPairs: Threshold; minimumConfusionAxes: Threshold; minimumFixtures: Threshold };
    };
    twinFailures: Threshold;
    benign: { minimumCases: Threshold; minimumAxes: Threshold; falseAlarms: Threshold };
    metamorphic: { criticalFailures: Threshold };
    mutation: { unresolvedCritical: Threshold };
    differential: { unresolvedContractDisagreements: Threshold };
  };
  provisional: { requiresDetector: true; rationale: string };
  pending: { tier: 'T0'; rationale: string };
  unsupported: { requiresReason: true; rationale: string };
}

export const statusCriteria = data as StatusCriteria;

export function validateStatusCriteria(value: unknown): StatusCriteria {
  const c = value as StatusCriteria;
  const threshold = (t: unknown) => !!t && typeof t === 'object' && Number.isInteger((t as Threshold).value) &&
    (t as Threshold).value >= 0 && typeof (t as Threshold).rationale === 'string' && (t as Threshold).rationale.length > 0;
  if (!c || c.schemaVersion !== 1) throw new Error('Invalid support-status criteria: schemaVersion');
  const s = c.stable;
  const thresholds = (value: Record<string, unknown>, keys: string[]) => keys.every(key => threshold(value?.[key]));
  if (!s || s.documented?.tier !== 'T1' || s.documented.requireProviderSource !== true || !s.documented.rationale ||
      !thresholds(s.documented as unknown as Record<string, unknown>, ['minimumPositiveCases', 'minimumPositiveAxes', 'minimumBenignCases', 'minimumControlAxes', 'minimumTwinPairs']) ||
      s.empirical?.tier !== 'T2' || !s.empirical.rationale ||
      !thresholds(s.empirical as unknown as Record<string, unknown>, ['minimumObservations', 'minimumSubjects', 'minimumIssuanceDates', 'minimumCorroborationClasses', 'unresolvedContradictions', 'minimumPositiveCases', 'minimumPositiveAxes', 'minimumBenignCases', 'minimumControlAxes', 'minimumTwinPairs']) ||
      !thresholds(s.empirical.corroborated as unknown as Record<string, unknown>, ['minimumReferences', 'minimumOwners', 'minimumClasses']) ||
      !s.empirical.corroborated.rationale || !Array.isArray(s.empirical.corroborated.summaryClasses?.classes) || !s.empirical.corroborated.summaryClasses.rationale ||
      !thresholds(s.empirical.contextConstrained as unknown as Record<string, unknown>, ['minimumContextTwinPairs', 'minimumConfusionAxes', 'minimumFixtures']) ||
      !threshold(s.twinFailures) ||
      !threshold(s.benign?.minimumCases) || !threshold(s.benign?.minimumAxes) || !threshold(s.benign?.falseAlarms) ||
      !threshold(s.metamorphic?.criticalFailures) || !threshold(s.mutation?.unresolvedCritical) ||
      !threshold(s.differential?.unresolvedContractDisagreements))
    throw new Error('Invalid support-status criteria: stable');
  if (c.provisional?.requiresDetector !== true || !c.provisional.rationale) throw new Error('Invalid support-status criteria: provisional');
  if (c.pending?.tier !== 'T0' || !c.pending.rationale) throw new Error('Invalid support-status criteria: pending');
  if (c.unsupported?.requiresReason !== true || !c.unsupported.rationale) throw new Error('Invalid support-status criteria: unsupported');
  return c;
}

/**
 * The evidence one provider x credential-family carries into classification.
 * Producing this from real benchmark runs (byDetector summaries, the review
 * ledger, twin/benign/metamorphic/mutation/differential method output) is
 * out of this issue's scope; see #504.
 */
export interface FamilySupportEvidence {
  family: string;
  /** Registered detectors serving this family (`taxonomy.familiesForDetector`'s inverse). Empty means no detector exists. */
  detectors: string[];
  /** The tier of the family's positive contract, or null when no detector, and so no contract, exists. */
  positiveContractTier: Tier | null;
  /** True only when the contract is T1 and grounded in a documented provider source (`contracts[id].providerSource`). */
  hasProviderSource: boolean;
  /** Provenance category, deliberately separate from tier and qualification. */
  evidenceBasis: EvidenceBasis;
  observationCount: number;
  observationSubjects: number;
  observationIssuanceDates: number;
  /** Verified corroborating references, the distinct owners behind them, and their distinct classes (`empirical.ts`). */
  corroborationReferences: number;
  corroborationOwners: number;
  corroborationClasses: string[];
  /** Contradictions that block qualification, and those the contract deliberately bounds (recorded, never deleted). */
  unresolvedContradictions: number;
  boundedContradictions: number;
  uncertainty: string | null;
  supportedContexts: string[];
  empiricalMode: 'shape' | 'context-constrained' | null;
  supportsBareValues: boolean;
  positiveCases: number;
  positiveAxes: number;
  controlAxes: number;
  totalFixtures: number;
  contextTwinPairs: number;
  confusionAxes: number;
  twinPairs: number;
  twinFailures: number;
  benignCases: number;
  benignFalseAlarms: number;
  /** Distinct benign taxonomy axes observed (`lib/assessment.ts`'s `Axis`); a bare case count cannot express diversity, this can. */
  benignAxes: number;
  /** Which axes those are, so a `benign.minimumAxes` failure names what is present, not just how many. */
  benignAxisIds: string[];
  metamorphicCriticalFailures: number;
  mutationUnresolvedCritical: number;
  differentialUnresolvedContractDisagreements: number;
  /** Corpus-measured evidence cells and the profile this family claims (issue #206). Absent means unmeasured, which fails closed for any binding claim. */
  fixtureProfile?: FixtureProfileEvidence;
  /** Only meaningful when `detectors` is empty; required to ever report `unsupported`. */
  unsupportedReason?: string;
}

export interface SupportAssessment {
  family: string;
  status: SupportStatus;
  /** Which criterion produced this status. Empty only when `status` is `stable`. */
  reasons: string[];
  /** Null unless stable; T2 never changes tier when it clears the empirical profile. */
  qualificationProfile: QualificationProfile | null;
}

const fails = (point: number, limit: number, comparison: '<' | '>') => (comparison === '<' ? point < limit : point > limit);

/** Every stable criterion the evidence misses, each naming the criterion, the numbers, and its rationale. */
function behavioralFailures(evidence: FamilySupportEvidence, criteria: StatusCriteria): string[] {
  const s = criteria.stable, reasons: string[] = [];
  const check = (id: string, point: number, limit: number, comparison: '<' | '>', rationale: string) => {
    if (fails(point, limit, comparison)) reasons.push(`${id}: ${point} ${comparison} ${limit} — ${rationale}`);
  };
  check('twinFailures', evidence.twinFailures, s.twinFailures.value, '>', s.twinFailures.rationale);
  check('benign.minimumCases', evidence.benignCases, s.benign.minimumCases.value, '<', s.benign.minimumCases.rationale);
  if (fails(evidence.benignAxes, s.benign.minimumAxes.value, '<'))
    reasons.push(`benign.minimumAxes: ${evidence.benignAxes} < ${s.benign.minimumAxes.value} (axes present: ${evidence.benignAxisIds.length ? evidence.benignAxisIds.join(', ') : 'none'}) — ${s.benign.minimumAxes.rationale}`);
  check('benign.falseAlarms', evidence.benignFalseAlarms, s.benign.falseAlarms.value, '>', s.benign.falseAlarms.rationale);
  check('metamorphic.criticalFailures', evidence.metamorphicCriticalFailures, s.metamorphic.criticalFailures.value, '>', s.metamorphic.criticalFailures.rationale);
  check('mutation.unresolvedCritical', evidence.mutationUnresolvedCritical, s.mutation.unresolvedCritical.value, '>', s.mutation.unresolvedCritical.rationale);
  check('differential.unresolvedContractDisagreements', evidence.differentialUnresolvedContractDisagreements,
    s.differential.unresolvedContractDisagreements.value, '>', s.differential.unresolvedContractDisagreements.rationale);
  return reasons;
}

/** The evidence counts a route reads; a subset of `FamilySupportEvidence`, so `evidence.ts` can derive the basis before the record exists. */
type RouteEvidence = Pick<FamilySupportEvidence, 'observationCount' | 'observationSubjects' | 'observationIssuanceDates' | 'corroborationReferences' | 'corroborationOwners' | 'corroborationClasses'>;
export interface EmpiricalRoute {
  /** `observed` when the #205 observation bar is met, else `corroborated` when the corroboration bar is, else null. */
  route: 'observed' | 'corroborated' | null;
  qualifies: boolean;
  /** Why each route is short, criterion by criterion; empty when that route's counts are met. */
  observed: string[];
  corroborated: string[];
}

/**
 * Which T2 evidence route the records meet (#177 as amended 2026-09-24). The
 * corroborated route needs no provider-issued observation; the observed route
 * is the #205 bar, unchanged, and strengthens the basis when met. Neither
 * route relaxes the contradiction, uncertainty, context, fixture or behavioral
 * gates, which `qualificationFailures` checks for both.
 */
export function empiricalRoute(evidence: RouteEvidence, criteria: StatusCriteria = statusCriteria): EmpiricalRoute {
  const p = criteria.stable.empirical, c = p.corroborated;
  const counted = evidence.corroborationClasses.filter(item => !c.summaryClasses.classes.includes(item)).length;
  const short = (reasons: string[], id: string, point: number, threshold: Threshold) => {
    if (point < threshold.value) reasons.push(`${id}: ${point} < ${threshold.value} — ${threshold.rationale}`);
  };
  const observed: string[] = [], corroborated: string[] = [];
  short(observed, 'empirical.minimumObservations', evidence.observationCount, p.minimumObservations);
  short(observed, 'empirical.minimumSubjects', evidence.observationSubjects, p.minimumSubjects);
  short(observed, 'empirical.minimumIssuanceDates', evidence.observationIssuanceDates, p.minimumIssuanceDates);
  short(observed, 'empirical.minimumCorroborationClasses', counted, p.minimumCorroborationClasses);
  short(corroborated, 'empirical.corroborated.minimumReferences', evidence.corroborationReferences, c.minimumReferences);
  short(corroborated, 'empirical.corroborated.minimumOwners', evidence.corroborationOwners, c.minimumOwners);
  short(corroborated, 'empirical.corroborated.minimumClasses', counted, c.minimumClasses);
  const route = !observed.length ? 'observed' : !corroborated.length ? 'corroborated' : null;
  return { route, qualifies: route !== null, observed, corroborated };
}

/** The evidence basis a T2 route implies: observations only when the #205 bar is met; otherwise corroboration, the T2 default. */
export const basisForRoute = (route: EmpiricalRoute): EvidenceBasis => route.route === 'observed' ? 'empirically-observed' : 'independently-corroborated';

function qualificationFailures(evidence: FamilySupportEvidence, criteria: StatusCriteria): { profile: QualificationProfile | null; reasons: string[] } {
  const check = (reasons: string[], id: string, point: number, threshold: Threshold) => {
    if (point < threshold.value) reasons.push(`${id}: ${point} < ${threshold.value} — ${threshold.rationale}`);
  };
  if (evidence.positiveContractTier === 'T1') {
    const p = criteria.stable.documented, reasons: string[] = [];
    if (p.requireProviderSource && !evidence.hasProviderSource) reasons.push(`documented.providerSource: missing — ${p.rationale}`);
    check(reasons, 'documented.minimumPositiveCases', evidence.positiveCases, p.minimumPositiveCases);
    check(reasons, 'documented.minimumPositiveAxes', evidence.positiveAxes, p.minimumPositiveAxes);
    check(reasons, 'documented.minimumBenignCases', evidence.benignCases, p.minimumBenignCases);
    check(reasons, 'documented.minimumControlAxes', evidence.controlAxes, p.minimumControlAxes);
    check(reasons, 'documented.minimumTwinPairs', evidence.twinPairs, p.minimumTwinPairs);
    return { profile: 'documented', reasons };
  }
  if (evidence.positiveContractTier === 'T2') {
    const p = criteria.stable.empirical, reasons: string[] = [];
    const route = empiricalRoute(evidence, criteria);
    if (evidence.evidenceBasis !== 'empirically-observed' && evidence.evidenceBasis !== 'independently-corroborated')
      reasons.push(`empirical.evidenceBasis: ${evidence.evidenceBasis} — ${p.rationale}`);
    else if (evidence.evidenceBasis !== basisForRoute(route))
      reasons.push(`empirical.evidenceBasis: ${evidence.evidenceBasis} does not match the evidence (${basisForRoute(route)}) — a basis is derived from the records, never asserted`);
    if (!route.qualifies) reasons.push(...route.corroborated.map(reason => `${reason} (corroborated route)`), ...route.observed.map(reason => `${reason} (observed route, optional)`));
    if (evidence.unresolvedContradictions > p.unresolvedContradictions.value)
      reasons.push(`empirical.unresolvedContradictions: ${evidence.unresolvedContradictions} > ${p.unresolvedContradictions.value} — ${p.unresolvedContradictions.rationale}`);
    if (!evidence.uncertainty?.trim()) reasons.push('empirical.uncertainty: missing — explicit uncertainty is required');
    if (!evidence.supportedContexts.length) reasons.push('empirical.supportedContexts: none — supported-context limits are required');
    check(reasons, 'empirical.minimumPositiveCases', evidence.positiveCases, p.minimumPositiveCases);
    check(reasons, 'empirical.minimumPositiveAxes', evidence.positiveAxes, p.minimumPositiveAxes);
    check(reasons, 'empirical.minimumBenignCases', evidence.benignCases, p.minimumBenignCases);
    check(reasons, 'empirical.minimumControlAxes', evidence.controlAxes, p.minimumControlAxes);
    check(reasons, 'empirical.minimumTwinPairs', evidence.twinPairs, p.minimumTwinPairs);
    if (evidence.empiricalMode === 'context-constrained') {
      const c = p.contextConstrained;
      if (evidence.supportsBareValues) reasons.push('empirical.contextConstrained.supportsBareValues: true — opaque values cannot claim bare-value support');
      check(reasons, 'empirical.contextConstrained.minimumContextTwinPairs', evidence.contextTwinPairs, c.minimumContextTwinPairs);
      check(reasons, 'empirical.contextConstrained.minimumConfusionAxes', evidence.confusionAxes, c.minimumConfusionAxes);
      check(reasons, 'empirical.contextConstrained.minimumFixtures', evidence.totalFixtures, c.minimumFixtures);
    } else if (evidence.empiricalMode !== 'shape') reasons.push('empirical.mode: missing — choose shape or context-constrained qualification');
    return { profile: 'empirical', reasons };
  }
  return { profile: null, reasons: [`qualificationProfile: tier ${evidence.positiveContractTier} is not eligible for documented or empirical stable`] };
}

/**
 * Decide one family's support status from evidence alone (never tier alone:
 * a T1 contract with no twins still fails `minimumTwinPairs` and lands on
 * `provisional`). `unsupported` is refused without `unsupportedReason`; a
 * detectorless family without one reports `pending`, not `unsupported`.
 */
export function classifyFamilySupport(evidence: FamilySupportEvidence, criteria: StatusCriteria = statusCriteria, profiles: FixtureProfiles = fixtureProfiles): SupportAssessment {
  const { family } = evidence;
  if (!evidence.detectors.length) {
    if (evidence.unsupportedReason) return { family, status: 'unsupported', reasons: [evidence.unsupportedReason], qualificationProfile: null };
    return { family, status: 'pending', reasons: [`no detector and no recorded reason — ${criteria.unsupported.rationale}`], qualificationProfile: null };
  }
  if (evidence.positiveContractTier === null || evidence.positiveContractTier === criteria.pending.tier)
    return { family, status: 'pending', reasons: [`positiveContractTier ${evidence.positiveContractTier ?? 'none'} — ${criteria.pending.rationale}`], qualificationProfile: null };
  const qualification = qualificationFailures(evidence, criteria);
  const reasons = [...qualification.reasons, ...behavioralFailures(evidence, criteria), ...fixtureProfileFailures(evidence, profiles)];
  if (!reasons.length && qualification.profile) return { family, status: 'stable', reasons: [], qualificationProfile: qualification.profile };
  return { family, status: 'provisional', reasons, qualificationProfile: null };
}
