import type { Tier } from '../types.ts';
import data from './status-criteria.json';

/**
 * Family support status (issue #503, part of epic #500). A machine-readable
 * profile that decides a provider x credential-family's support status from
 * evidence alone, so no status is ever hand-written into README, docs or UI.
 * See docs/support-status.md.
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

interface Threshold { value: number; rationale: string }

export interface StatusCriteria {
  schemaVersion: 1;
  stable: {
    positiveContract: { requireProviderSource: true; rationale: string };
    minimumTwinPairs: Threshold;
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
  if (!s || s.positiveContract?.requireProviderSource !== true || !s.positiveContract.rationale ||
      !threshold(s.minimumTwinPairs) || !threshold(s.twinFailures) ||
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
  /** Only meaningful when `detectors` is empty; required to ever report `unsupported`. */
  unsupportedReason?: string;
}

export interface SupportAssessment {
  family: string;
  status: SupportStatus;
  /** Which criterion produced this status. Empty only when `status` is `stable`. */
  reasons: string[];
}

const fails = (point: number, limit: number, comparison: '<' | '>') => (comparison === '<' ? point < limit : point > limit);

/** Every stable criterion the evidence misses, each naming the criterion, the numbers, and its rationale. */
function stableFailures(evidence: FamilySupportEvidence, criteria: StatusCriteria): string[] {
  const s = criteria.stable, reasons: string[] = [];
  const check = (id: string, point: number, limit: number, comparison: '<' | '>', rationale: string) => {
    if (fails(point, limit, comparison)) reasons.push(`${id}: ${point} ${comparison} ${limit} — ${rationale}`);
  };
  if (s.positiveContract.requireProviderSource && !evidence.hasProviderSource)
    reasons.push(`positiveContract: no T1 provider-documented contract — ${s.positiveContract.rationale}`);
  check('minimumTwinPairs', evidence.twinPairs, s.minimumTwinPairs.value, '<', s.minimumTwinPairs.rationale);
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

/**
 * Decide one family's support status from evidence alone (never tier alone:
 * a T1 contract with no twins still fails `minimumTwinPairs` and lands on
 * `provisional`). `unsupported` is refused without `unsupportedReason`; a
 * detectorless family without one reports `pending`, not `unsupported`.
 */
export function classifyFamilySupport(evidence: FamilySupportEvidence, criteria: StatusCriteria = statusCriteria): SupportAssessment {
  const { family } = evidence;
  if (!evidence.detectors.length) {
    if (evidence.unsupportedReason) return { family, status: 'unsupported', reasons: [evidence.unsupportedReason] };
    return { family, status: 'pending', reasons: [`no detector and no recorded reason — ${criteria.unsupported.rationale}`] };
  }
  if (evidence.positiveContractTier === null || evidence.positiveContractTier === criteria.pending.tier)
    return { family, status: 'pending', reasons: [`positiveContractTier ${evidence.positiveContractTier ?? 'none'} — ${criteria.pending.rationale}`] };
  const reasons = stableFailures(evidence, criteria);
  if (!reasons.length) return { family, status: 'stable', reasons: [] };
  return { family, status: 'provisional', reasons };
}
