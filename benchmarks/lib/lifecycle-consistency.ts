import type { KnownGaps } from './promotion.ts';
import { validateKnownGaps } from './promotion.ts';

/** A record from the product repository's conformance/benchmark-regressions.json, the fields this check needs. */
export interface ProductManifestRecord {
  id: string;
  benchmarkRecordId: string;
  productIssue: string;
}

export interface ProductManifest {
  records: ProductManifestRecord[];
}

/** Whether `gh` could confirm each known-gap record's product issue exists, keyed by issue number. Absent/false both mean "not confirmed" -- fail closed. */
export interface IssueReachability {
  reachable: Record<number, boolean>;
}

/** #106 bullet 1: every product issue known-gaps.json references must resolve to a real, reachable issue. */
export function checkProductIssuesReachable(knownGaps: Pick<KnownGaps, 'issues'>, facts: IssueReachability): string[] {
  const failures: string[] = [];
  for (const issue of knownGaps.issues) {
    if (facts.reachable[issue.number] !== true) {
      failures.push(`${issue.id}: product issue #${issue.number} (${issue.url}) could not be confirmed reachable in redact-secret/redact-secret`);
    }
  }
  return failures;
}

/**
 * #106 bullets 2-3: bidirectional cross-reference between this repo's authoritative
 * benchmarks/known-gaps.json and the product's conformance/benchmark-regressions.json,
 * which is verified against, never trusted as, ground truth (see
 * docs/decisions/2026-09-21-anchor-cross-repo-promotion-authority-in-known-gaps.md).
 * Every product manifest record must resolve to a known-gaps.json record it agrees with;
 * a product record with no known-gaps.json record behind it is exactly the bypass #66 and
 * #106 exist to catch, so an unresolved reference fails, it does not warn.
 */
export function checkManifestCrossReference(knownGaps: Pick<KnownGaps, 'issues'>, productManifest: ProductManifest): string[] {
  const failures: string[] = [];
  const byId = new Map(knownGaps.issues.map(issue => [issue.id, issue]));

  for (const record of productManifest.records) {
    const issue = byId.get(record.benchmarkRecordId);
    if (!issue) {
      failures.push(`product manifest record "${record.id}" references benchmarkRecordId "${record.benchmarkRecordId}", which has no benchmarks/known-gaps.json record -- a product issue reached the promotion manifest with no lifecycle record behind it`);
      continue;
    }
    if (issue.promotion?.productManifestRecordId !== record.id) {
      failures.push(`product manifest record "${record.id}" claims benchmarkRecordId "${issue.id}", but that known-gaps.json record's promotion.productManifestRecordId is "${issue.promotion?.productManifestRecordId ?? 'unset'}"`);
      continue;
    }
    if (issue.promotion.productIssue !== record.productIssue) {
      failures.push(`product manifest record "${record.id}" and benchmarks/known-gaps.json record "${issue.id}" disagree on the product issue (${record.productIssue} vs ${issue.promotion.productIssue})`);
    }
  }
  return failures;
}

/** Full #106 guard: the local schema/lifecycle contract plus both directions of the cross-repo cross-reference, fail-closed throughout. */
export function checkPromotionConsistency(knownGaps: KnownGaps, productManifest: ProductManifest, facts: IssueReachability): string[] {
  const failures: string[] = [];
  try {
    validateKnownGaps(knownGaps);
  } catch (error) {
    failures.push(`benchmarks/known-gaps.json fails its own lifecycle schema: ${(error as Error).message}`);
  }
  failures.push(...checkProductIssuesReachable(knownGaps, facts));
  failures.push(...checkManifestCrossReference(knownGaps, productManifest));
  return failures;
}
