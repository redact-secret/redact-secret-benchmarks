import type { KnownGaps } from './promotion.ts';

export interface PinFacts {
  registrySourceRevision: string;
  inventoryRedactSecretRevision: string;
  inventoryRedactSecretVersion: string;
  packageVersion: string;
  /** `performance-criteria.json` `baseline.verifiedCommit`: the latest ACCEPTED evaluation against the unchanged thresholds. */
  performanceCriteriaVerifiedCommit: string;
}

export interface AncestryFacts {
  registrySourceRevisionIsAncestor: boolean;
  detectorsPathChangedSinceRegistry: boolean;
  /** Ancestor-of-product-main result, keyed by full 40-character commit SHA. */
  knownGapCommitIsAncestor: Record<string, boolean>;
}

const DETECTORS_PATH = 'crates/secret-scan-core/src/detectors';
export const PRODUCT_REPO = 'redact-secret/redact-secret';
export const PRODUCT_BRANCH = 'main';

/** Checks that need no network access: internal consistency between the three pins. */
export function checkPinConsistency(facts: PinFacts): string[] {
  const failures: string[] = [];
  if (facts.registrySourceRevision !== facts.inventoryRedactSecretRevision) {
    failures.push(`detectors.json sourceRevision (${facts.registrySourceRevision}) does not match detector-inventory.json redactSecretRevision (${facts.inventoryRedactSecretRevision})`);
  }
  if (facts.inventoryRedactSecretVersion !== facts.packageVersion) {
    failures.push(`detector-inventory.json redactSecretVersion (${facts.inventoryRedactSecretVersion}) does not match package.json @redact-secret/core version (${facts.packageVersion})`);
  }
  if (facts.performanceCriteriaVerifiedCommit !== facts.inventoryRedactSecretRevision) {
    failures.push(`benchmarks/performance-criteria.json baseline.verifiedCommit (${facts.performanceCriteriaVerifiedCommit}) does not match detector-inventory.json redactSecretRevision (${facts.inventoryRedactSecretRevision}) -- #150: the pinned core revision needs an ACCEPTED performance evaluation`);
  }
  return failures;
}

/** Checks that require product-repo commit ancestry, supplied by the caller so this stays network-free and testable. */
export function checkPinAncestry(facts: PinFacts, knownGaps: Pick<KnownGaps, 'issues'>, ancestry: AncestryFacts): string[] {
  const failures: string[] = [];
  if (!ancestry.registrySourceRevisionIsAncestor) {
    failures.push(`detectors.json sourceRevision (${facts.registrySourceRevision}) is not an ancestor of ${PRODUCT_REPO}@${PRODUCT_BRANCH}`);
  }
  if (ancestry.detectorsPathChangedSinceRegistry) {
    failures.push(`${DETECTORS_PATH} changed in ${PRODUCT_REPO} after ${facts.registrySourceRevision}; refresh the detector registry snapshot`);
  }
  for (const issue of knownGaps.issues) {
    const fixCommit = issue.fix?.commit;
    if (fixCommit && ancestry.knownGapCommitIsAncestor[fixCommit] !== true) {
      failures.push(`known-gaps.json ${issue.id} fix.commit (${fixCommit}) is not a recorded ancestor of ${PRODUCT_REPO}@${PRODUCT_BRANCH}`);
    }
    const sourceCommit = issue.candidate.sourceCommit;
    if (sourceCommit && ancestry.knownGapCommitIsAncestor[sourceCommit] !== true) {
      failures.push(`known-gaps.json ${issue.id} candidate.sourceCommit (${sourceCommit}) is not a recorded ancestor of ${PRODUCT_REPO}@${PRODUCT_BRANCH}`);
    }
  }
  return failures;
}

/** Every product commit named in known-gaps.json that ancestry must be checked for, deduplicated. */
export function collectKnownGapCommits(knownGaps: Pick<KnownGaps, 'issues'>): string[] {
  const commits = new Set<string>();
  for (const issue of knownGaps.issues) {
    if (issue.fix?.commit) commits.add(issue.fix.commit);
    if (issue.candidate.sourceCommit) commits.add(issue.candidate.sourceCommit);
  }
  return [...commits].sort();
}
