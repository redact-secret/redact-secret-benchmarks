import type { Summary, ReviewLedger } from '../engine/types.ts';
import type { FamilySupportEvidence } from './status.ts';
import type { EvaluationCase } from '../engine/types.ts';
import { contracts } from '../lib/assessment.ts';
import { measureFixtureCells, profileClaim } from './profiles.ts';

/**
 * Real `FamilySupportEvidence` per family (issue #504, A3). Aggregates
 * `benchmarks/engine/reporting.ts`'s `byDetector` summaries and the checked-in
 * review ledger; `classifyFamilySupport` (#503) turns this into a status.
 * See docs/specs/support-status.md.
 */
export interface QueuedReview { id: string; method: string; targets: string[] }

const PRODUCT = 'redact-secret';

/** `key` is `${method}/${scanner}/${stratum}/${type}` (reporting.ts's `summaries`); stratum never contains a slash. */
function totalWhere(summary: Summary, method: string, type?: string) {
  let pass = 0, fail = 0;
  for (const [key, counts] of Object.entries(summary)) {
    const [m, scanner, , t] = key.split('/');
    if (m !== method || scanner !== PRODUCT) continue;
    if (type && t !== type) continue;
    pass += counts.pass; fail += counts.fail;
  }
  return { pass, fail };
}

/**
 * Ledger status for one review-queue id; anything absent from the ledger is
 * `unknown`, not resolved. `not-assertable` is settled too: a person decided,
 * per operator class, that no ground truth is inferable — that is a real
 * disposition, distinct from `resolved` (a per-fixture sign-off) but just as
 * final for accounting purposes.
 */
const unresolved = (id: string, ledger: ReviewLedger) => !['resolved', 'not-assertable'].includes(ledger.entries[id]?.status as string);

function unresolvedInQueue(family: string, method: string, queue: QueuedReview[], ledger: ReviewLedger) {
  return queue.filter(q => q.method === method && q.targets.includes(family) && unresolved(q.id, ledger)).length;
}

/**
 * One family's evidence from a full evaluation report. `byDetector`,
 * `axesByDetector` and `reviewQueue` come from `runEvaluation` (twin/benign/
 * metamorphic/mutation/differential, `redact-secret` scored against the
 * checked-in ledger). Differential never reaches `byDetector` (its method
 * returns no scanner assertions, only a review queue), so its evidence is
 * queue-only.
 */
export function familyEvidence(family: string, byDetector: Record<string, Summary>, axesByDetector: Record<string, string[]>, reviewQueue: QueuedReview[], ledger: ReviewLedger, cases?: EvaluationCase[]): FamilySupportEvidence {
  const summary = byDetector[family] ?? {};
  const contract = contracts[family];
  const twin = totalWhere(summary, 'twin', 'must-flip');
  const benign = totalWhere(summary, 'benign');
  const metamorphic = totalWhere(summary, 'metamorphic');
  const mutation = totalWhere(summary, 'mutation');
  const benignAxisIds = axesByDetector[family] ?? [];
  return {
    family,
    detectors: contract ? [family] : [],
    positiveContractTier: contract?.tier ?? null,
    hasProviderSource: contract?.tier === 'T1' && Boolean(contract.providerSource),
    twinPairs: twin.pass + twin.fail,
    twinFailures: twin.fail,
    benignCases: benign.pass + benign.fail,
    benignFalseAlarms: benign.fail,
    benignAxes: benignAxisIds.length,
    benignAxisIds,
    metamorphicCriticalFailures: metamorphic.fail,
    // A hard mutation failure is as unreviewed as a queued one: nobody has
    // signed off that either is acceptable (only a `resolved` ledger entry does).
    mutationUnresolvedCritical: mutation.fail + unresolvedInQueue(family, 'mutation', reviewQueue, ledger),
    differentialUnresolvedContractDisagreements: unresolvedInQueue(family, 'differential', reviewQueue, ledger),
    // No corpus supplied means unmeasured: `profileFailures` fails closed on that for any binding claim.
    ...(cases ? { fixtureProfile: { claim: profileClaim(contract), cells: measureFixtureCells(family, cases), supportedContext: contract?.supportedContext } } : {}),
  };
}
