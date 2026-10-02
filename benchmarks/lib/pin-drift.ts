import type { KnownGaps } from './promotion.ts';

export interface PinFacts {
  registrySourceRevision: string;
  inventoryRedactSecretRevision: string;
  inventoryRedactSecretVersion: string;
  packageVersion: string;
  /** `performance-criteria.json` `baseline.verifiedCommit`: the latest ACCEPTED evaluation against the unchanged thresholds. */
  performanceCriteriaVerifiedCommit: string;
  /**
   * What each committed `evidence/562/runtime-comparison-*.json` snapshot recorded for redact-secret (#562). Optional so a caller
   * that has no snapshots (or a test of the other pins) omits it; the real `pins:check` always supplies it.
   */
  runtimeComparisonSnapshots?: RuntimeComparisonSnapshotFacts[];
}

export interface RuntimeComparisonSnapshotFacts {
  file: string;
  /** The redact-secret tool's `version` in the report. */
  version: string;
  /** The redact-secret tool's `provenance.kind` in the report. */
  kind: string;
  /** The redact-secret tool's `provenance.commit` in the report. */
  commit: string;
}

export interface AncestryFacts {
  registrySourceRevisionIsAncestor: boolean;
  /** Registry ids (registration order) read from `detectors/mod.rs` at the pinned revision. */
  pinnedRegistryIds: string[];
  /** The same extraction at product `main`. */
  currentRegistryIds: string[];
  /** Ancestor-of-product-main result, keyed by full 40-character commit SHA. */
  knownGapCommitIsAncestor: Record<string, boolean>;
}

export const REGISTRY_PATH = 'crates/secret-scan-core/src/detectors/mod.rs';
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
  for (const snapshot of facts.runtimeComparisonSnapshots ?? []) {
    if (snapshot.kind !== 'published-npm-package') {
      failures.push(`${snapshot.file} measured redact-secret as ${snapshot.kind}, not the published package: re-run scripts/run-runtime-comparison-docker.sh (#562)`);
    }
    if (snapshot.version !== facts.packageVersion) {
      failures.push(`${snapshot.file} measured redact-secret ${snapshot.version}, but package.json pins @redact-secret/core ${facts.packageVersion}: re-measure with scripts/run-runtime-comparison-docker.sh and replace evidence/562 (#562)`);
    }
    if (snapshot.commit !== facts.inventoryRedactSecretRevision) {
      failures.push(`${snapshot.file} records product commit ${snapshot.commit}, but the pin is ${facts.inventoryRedactSecretRevision}: re-measure and replace evidence/562 (#562)`);
    }
  }
  return failures;
}

/** Checks that require product-repo commit ancestry, supplied by the caller so this stays network-free and testable. */
export function checkPinAncestry(facts: PinFacts, knownGaps: Pick<KnownGaps, 'issues'>, ancestry: AncestryFacts, snapshotRegistryIds?: string[]): string[] {
  const failures: string[] = [];
  if (!ancestry.registrySourceRevisionIsAncestor) {
    failures.push(`detectors.json sourceRevision (${facts.registrySourceRevision}) is not an ancestor of ${PRODUCT_REPO}@${PRODUCT_BRANCH}`);
  }
  failures.push(...registryDriftFailures(facts, ancestry, snapshotRegistryIds));
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

/**
 * The detector ids the product registers, in registration order: the `row("<id>", ...)` entries of the
 * `built_in_detectors()` table in `detectors/mod.rs`. This is what `benchmarks/detectors.json` records from the
 * product (titles are benchmark-authored). Fails closed: a missing table, an empty table or a line it does not
 * recognise throws, so a restructured registry fails the gate loudly instead of reading as "unchanged".
 */
export function extractRegistryIds(source: string): string[] {
  const start = source.search(/static\s+DETECTORS\s*:\s*&\[BuiltInRow\]\s*=\s*&\[/);
  if (start < 0) throw new Error(`${REGISTRY_PATH}: the built_in_detectors() DETECTORS table was not found`);
  const body = source.slice(source.indexOf('&[', source.indexOf('=', start)) + 2);
  const end = body.search(/^\s*\];/m);
  if (end < 0) throw new Error(`${REGISTRY_PATH}: the DETECTORS table has no end`);
  const ids: string[] = [];
  for (const raw of body.slice(0, end).split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('//')) continue;
    const match = /^row\("([^"]+)",\s*&[^)]*\),?\s*(\/\/.*)?$/.exec(line);
    if (!match) throw new Error(`${REGISTRY_PATH}: unrecognised DETECTORS table line: ${line}`);
    ids.push(match[1]);
  }
  if (ids.length === 0) throw new Error(`${REGISTRY_PATH}: the DETECTORS table is empty`);
  return ids;
}

/** Human-readable differences between two ordered id lists: removed, added, and (if the sets match) reordered. */
export function describeRegistryDifference(from: string[], to: string[]): string[] {
  const fromSet = new Set(from), toSet = new Set(to);
  const notes: string[] = [];
  const removed = from.filter(id => !toSet.has(id)), added = to.filter(id => !fromSet.has(id));
  if (removed.length) notes.push(`removed ${removed.join(', ')}`);
  if (added.length) notes.push(`added ${added.join(', ')}`);
  if (!removed.length && !added.length && from.join('\n') !== to.join('\n')) notes.push('registration order changed');
  return notes;
}

function registryDriftFailures(facts: PinFacts, ancestry: AncestryFacts, snapshotRegistryIds?: string[]): string[] {
  const failures: string[] = [];
  const sinceRevision = describeRegistryDifference(ancestry.pinnedRegistryIds, ancestry.currentRegistryIds);
  if (sinceRevision.length) {
    failures.push(`${REGISTRY_PATH} registry changed in ${PRODUCT_REPO} after ${facts.registrySourceRevision} (${sinceRevision.join('; ')}); refresh the detector registry snapshot`);
  }
  if (snapshotRegistryIds) {
    const snapshot = describeRegistryDifference(snapshotRegistryIds, ancestry.pinnedRegistryIds);
    if (snapshot.length) {
      failures.push(`benchmarks/detectors.json does not match ${REGISTRY_PATH} at ${facts.registrySourceRevision} (${snapshot.join('; ')})`);
    }
  }
  return failures;
}
