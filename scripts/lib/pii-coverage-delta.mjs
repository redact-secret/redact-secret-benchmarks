import { createHash } from 'node:crypto';
import { validateCoverageMatrix } from './pii-coverage-model.mjs';

const countKeys = ['authoredCases', 'importedCases', 'fixtures', 'variants', 'occurrences', 'acceptedCases'];
const refuse = reason => { throw new Error(`pii-coverage-delta:${reason}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = values => [...values].sort();
const setChange = (before, after) => ({ added: sorted(after.filter(value => !before.includes(value))), removed: sorted(before.filter(value => !after.includes(value))) });
const change = (before, after) => ({ previous: before, next: after, delta: before === null || after === null ? null : after - before });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());

function sourceReference(value) {
  if (value === null) return { state: 'unavailable', fullReproduction: false, reason: 'immutable-source-reference-not-recorded' };
  if (!exact(value, ['manifestUrl', 'archiveUrl', 'sha256', 'reproduction']) || !/^[a-f0-9]{64}$/.test(value.sha256) ||
      !['available', 'unavailable'].includes(value.reproduction)) refuse('source-reference-invalid');
  for (const url of [value.manifestUrl, value.archiveUrl]) {
    try { if (new URL(url).protocol !== 'https:') refuse('source-reference-invalid'); } catch { refuse('source-reference-invalid'); }
  }
  return { ...value, state: 'recorded', fullReproduction: value.reproduction === 'available' };
}

function rowChange(previous, next, rename) {
  return {
    previousKindKey: previous?.kindKey ?? null, nextKindKey: next?.kindKey ?? null,
    classification: !previous ? 'added' : !next ? 'removed' : rename ? 'reclassified' : 'retained',
    review: rename?.source ?? null,
    label: { previous: previous?.label ?? null, next: next?.label ?? null },
    domains: setChange(previous?.domains ?? [], next?.domains ?? []),
    jurisdictions: setChange(previous?.jurisdictions ?? [], next?.jurisdictions ?? []),
    counts: Object.fromEntries(countKeys.map(key => [key, change(previous?.evidence[key] ?? null, next?.evidence[key] ?? null)])),
    deferredCounts: { cases: change(null, null), fixtures: change(null, null), reason: 'separate-deferred-counts-not-exposed-by-coverage-contract' },
    evidenceAvailability: { previous: previous?.evidence.availability ?? null, next: next?.evidence.availability ?? null },
    mapping: {
      state: { previous: previous?.mapping.state ?? null, next: next?.mapping.state ?? null },
      losses: setChange(previous?.mapping.losses ?? [], next?.mapping.losses ?? []),
      requiredAxes: setChange(previous?.mapping.requiredAxes ?? [], next?.mapping.requiredAxes ?? []),
      representableAxes: setChange(previous?.mapping.representableAxes ?? [], next?.mapping.representableAxes ?? []),
    },
    coverage: { previous: previous?.state ?? null, next: next?.state ?? null },
    capability: { previous: previous?.capability.state ?? null, next: next?.capability.state ?? null },
    measurement: { previous: previous?.observation.status ?? null, next: next?.observation.status ?? null },
  };
}

/** Snapshot membership changes describe evidence scope, never detector regressions. */
export function buildPiiCoverageDelta({ previous, next, mode, renames = [], previousSource = null, nextSource = null }) {
  validateCoverageMatrix(previous);
  validateCoverageMatrix(next);
  if (!['active-vs-proposed', 'accepted-before-after'].includes(mode)) refuse('mode-invalid');
  if (mode === 'active-vs-proposed' && (!['active', 'baseline', 'candidate'].includes(previous.identity.role) || next.identity.role !== 'proposed')) refuse('proposal-role-mismatch');
  if (mode === 'accepted-before-after' && (previous.identity.role === 'proposed' || next.identity.role === 'proposed')) refuse('accepted-role-mismatch');
  if (previous.identity.snapshotId === next.identity.snapshotId && previous.identity.snapshotCommitment !== next.identity.snapshotCommitment) refuse('snapshot-id-content-mismatch');
  if (previous.identity.snapshotId === next.identity.snapshotId) refuse('snapshot-change-required');
  if (!Array.isArray(renames)) refuse('renames-invalid');
  const before = new Map(previous.rows.map(row => [row.kindKey, row]));
  const after = new Map(next.rows.map(row => [row.kindKey, row]));
  const reviewed = new Map();
  const targets = new Set();
  for (const entry of renames) {
    if (!exact(entry, ['previousKindKey', 'nextKindKey', 'source']) || typeof entry.source !== 'string' || !entry.source.trim() ||
        !before.has(entry.previousKindKey) || !after.has(entry.nextKindKey) ||
        (entry.previousKindKey !== entry.nextKindKey && (after.has(entry.previousKindKey) || before.has(entry.nextKindKey))) ||
        reviewed.has(entry.previousKindKey) || targets.has(entry.nextKindKey)) refuse('rename-ambiguous-or-unreviewed');
    reviewed.set(entry.previousKindKey, entry);
    targets.add(entry.nextKindKey);
  }
  const rows = [];
  for (const key of sorted([...before.keys()])) {
    const rename = reviewed.get(key);
    rows.push(rowChange(before.get(key), after.get(rename?.nextKindKey ?? key), rename));
  }
  for (const key of sorted([...after.keys()])) if (!before.has(key) && !targets.has(key)) rows.push(rowChange(null, after.get(key)));
  rows.sort((a, b) => (a.nextKindKey ?? a.previousKindKey).localeCompare(b.nextKindKey ?? b.previousKindKey, 'en'));
  const evidenceChanged = previous.identity.snapshotCommitment !== next.identity.snapshotCommitment;
  const evaluatorKeys = ['mappingRevision', 'mappingCommitment', 'protocol'];
  const evaluatorChanged = evaluatorKeys.some(key => !same(previous.identity[key], next.identity[key]));
  const productChanged = previous.identity.productCommitment === null || next.identity.productCommitment === null ? null :
    previous.identity.productCommitment !== next.identity.productCommitment;
  const explicitCount = matrix => matrix.rows.filter(row => row.capability.state === 'declared').length;
  const oldSupported = explicitCount(previous), newSupported = explicitCount(next);
  const retainedCapabilityConstant = rows.filter(row => row.classification === 'retained' || row.classification === 'reclassified')
    .every(row => row.capability.previous === row.capability.next);
  const solelyDenominatorExpansion = evidenceChanged && productChanged === false && !evaluatorChanged && retainedCapabilityConstant &&
    rows.some(row => row.classification === 'added') && !rows.some(row => row.classification === 'removed' || row.classification === 'reclassified') &&
    oldSupported === newSupported;
  return {
    schemaVersion: 1, mode, supportClaims: false, activePinsChanged: false, ownerAcceptance: null,
    previous: { identity: previous.identity, inventoryCommitment: digest(previous), source: sourceReference(previousSource) },
    next: { identity: next.identity, inventoryCommitment: digest(next), source: sourceReference(nextSource) },
    rows,
    totals: { kinds: change(previous.rows.length, next.rows.length), grainAccounting: 'per-kind-memberships-not-unique-source-totals',
      counts: Object.fromEntries(countKeys.map(key => {
        const total = matrix => {
          if (matrix.rows.some(row => row.evidence[key] === null)) return null;
          const value = matrix.rows.reduce((sum, row) => sum + row.evidence[key], 0);
          if (!Number.isSafeInteger(value)) refuse('count-total-overflow');
          return value;
        };
        return [key, change(total(previous), total(next))];
      })) },
    attribution: {
      evidence: { changed: evidenceChanged, reason: 'snapshot-inventory-scope' },
      evaluator: { changed: evaluatorChanged, reason: evaluatorChanged ? 'mapping-or-protocol-changed' : 'bound-evaluator-identity-unchanged' },
      product: { changed: productChanged, reason: productChanged === null ? 'product-binding-unavailable-cannot-attribute-change' : productChanged ? 'product-artifact-changed' : 'bound-product-identity-unchanged' },
      productRegressionComparison: { state: 'unavailable', reason: 'different-snapshot-denominators-require-separate-held-constant-product-control', oldObservationReused: false },
    },
    denominator: { previousKinds: previous.rows.length, nextKinds: next.rows.length, previousDeclaredKinds: oldSupported, nextDeclaredKinds: newSupported,
      solelyDenominatorExpansion, metric: 'declared-capability-membership-only', measurementRate: null },
    adoption: { applied: false, workflow: 'existing-verify-preflight-acceptance-rehearsal', ownerAcceptanceSupplied: false },
  };
}

/** Publish both independently bound scanner sides without copying old observations. */
export function buildPiiCoverageDeltas(coverage, { historicalCoverage = null, acceptance = null } = {}) {
  if (coverage?.schema !== 'pii-coverage-view/1' || !coverage.inventories?.active || !coverage.inventories?.proposed ||
      !coverage.matrices?.active || !coverage.matrices?.proposed) refuse('coverage-view-invalid');
  const source = inventory => {
    const pin = inventory.source;
    return { state: 'recorded', pin: structuredClone(pin), fullReproduction: false,
      sourceTreeUrl: `https://github.com/${pin.release.repository}/tree/${pin.release.commit}`,
      archiveLocator: `https://github.com/${pin.release.repository}/releases/download/${pin.release.tag}/${pin.release.archive.name}`,
      archiveSha256: pin.release.archive.tarGzSha256, manifestSha256: pin.snapshot.manifestSha256,
      reason: 'immutable-pin-and-archive-locator-retained-source-availability-not-verified' };
  };
  const accepted = coverage.proposalState === 'accepted';
  if (accepted && (!historicalCoverage?.matrices?.active || !acceptance?.source ||
      !same(coverage.inventories.active.source, coverage.inventories.proposed.source))) refuse('accepted-history-or-acceptance-required');
  const before = accepted ? historicalCoverage : coverage, afterRole = accepted ? 'active' : 'proposed';
  return Object.fromEntries(['baseline', 'candidate'].map(side => {
    const previous = before.matrices.active[side]?.matrix, next = coverage.matrices[afterRole][side]?.matrix;
    for (const [inventory, matrix] of [[before.inventories.active, previous], [coverage.inventories[afterRole], next]]) {
      const pin = inventory.source;
      if (!matrix || pin?.snapshot?.id !== matrix.identity?.snapshotId || pin.snapshot.contentDigest !== matrix.identity.snapshotCommitment ||
          !/^[a-f0-9]{40}$/.test(pin.release?.commit) || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(pin.release?.repository) ||
          !/^[a-f0-9]{64}$/.test(pin.release?.archive?.tarGzSha256) || !/^[a-f0-9]{64}$/.test(pin.snapshot.manifestSha256)) refuse('inventory-matrix-source-mismatch');
    }
    const delta = buildPiiCoverageDelta({ previous, next,
      mode: accepted ? 'accepted-before-after' : 'active-vs-proposed' });
    delta.previous.source = source(before.inventories.active);
    delta.next.source = source(coverage.inventories[afterRole]);
    if (accepted) {
      delta.activePinsChanged = true;
      delta.ownerAcceptance = structuredClone(acceptance);
      delta.adoption = { applied: true, workflow: 'existing-verify-preflight-acceptance-rehearsal', ownerAcceptanceSupplied: true };
    }
    delta.limitations = ['deferred-case-and-fixture-counts-not-exposed-by-source',
      'mapping-commitment-includes-population-so-scope-and-mapping-effects-cannot-be-isolated',
      'different-evidence-populations-are-not-a-held-constant-product-regression-comparison'];
    return [side, delta];
  }));
}
