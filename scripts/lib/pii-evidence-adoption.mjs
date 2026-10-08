import { createHash } from 'node:crypto';
import { validatePiiPopulationPolicy } from './pii-population-policy.mjs';
import { SNAPSHOT_PIN, sha256, validatePreflightReport } from './pii-evidence-contract.mjs';
import { parseEvidenceJson } from './pii-evidence-json.mjs';
import { loadPiiEvidenceComparison } from '../../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';

const canonical = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
export const adoptionDigest = value => createHash('sha256').update(canonical(value)).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const refuse = code => { throw new Error(`PII adoption refusal: ${code}`); };
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);

export function validateAdoptionScanner(value) {
  if (!exact(value, ['schema', 'sourceCommit', 'version', 'kind', 'coreTarballSha256', 'nativeTarballSha256', 'wasmTarballSha256',
    'packageTreeSha256', 'adapterDigest', 'configurationDigest', 'activationDigest']) || value.schema !== 'pii-evidence-scanner-identity/1' ||
      !hex(value.sourceCommit, 40) || typeof value.version !== 'string' || value.version.length > 64 || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(value.version) ||
      !['published-npm', 'qualified-candidate'].includes(value.kind) ||
      ['coreTarballSha256', 'nativeTarballSha256', 'wasmTarballSha256', 'packageTreeSha256', 'adapterDigest', 'configurationDigest', 'activationDigest']
        .some(key => !hex(value[key], 64))) refuse('scanner-identity-invalid');
  return structuredClone(value);
}

// A supplied record is checked for exact scope and binding, never created or treated as an execution receipt.
export function validateMaintainerAcceptance(value, candidateDigest) {
  if (!exact(value, ['schema', 'scope', 'candidateDigest', 'acceptedBy', 'acceptedAt', 'source']) ||
      value.schema !== 'pii-evidence-maintainer-acceptance/1' || value.scope !== 'public-evidence-snapshot-adoption' ||
      value.candidateDigest !== candidateDigest || !hex(value.candidateDigest, 64) ||
      typeof value.acceptedBy !== 'string' || !/^[A-Za-z][A-Za-z .'-]{0,127}$/.test(value.acceptedBy) ||
      typeof value.acceptedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.acceptedAt) ||
      !Number.isFinite(Date.parse(value.acceptedAt)) || new Date(value.acceptedAt).toISOString() !== value.acceptedAt.replace(/Z$/, '.000Z') ||
      typeof value.source !== 'string' || !/^https:\/\/github\.com\/redact-secret\/redact-secret-benchmarks\/issues\/[1-9]\d*#issuecomment-[1-9]\d*$/.test(value.source))
    refuse('maintainer-acceptance-invalid');
  return structuredClone(value);
}

function checkedPreflight(value, policy) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('preflight-invalid');
  return validatePreflightReport(value, policy, { snapshotPin: value.evidence, consumerPin: value.consumer });
}

const kindDelta = (previous, next) => ({ added: next.filter(kind => !previous.includes(kind)), removed: previous.filter(kind => !next.includes(kind)) });
function identity(preflight, scanner) {
  return {
    evidence: preflight.evidence, consumer: preflight.consumer, population: preflight.population,
    importOutputs: preflight.outputs, scanner,
  };
}

export function preparePiiEvidenceAdoption({ policy, preflight, previousPreflight = null, scanner = null, previousScanner = null, acceptance = null }) {
  validatePiiPopulationPolicy(policy);
  const next = checkedPreflight(preflight, policy);
  const previous = previousPreflight === null ? null : checkedPreflight(previousPreflight, policy);
  const target = scanner === null ? null : validateAdoptionScanner(scanner);
  const priorTarget = previousScanner === null ? null : validateAdoptionScanner(previousScanner);
  if (priorTarget && !previous) refuse('previous-scanner-without-preflight');
  const losses = Object.fromEntries(policy.mapping.lossClasses.map(code => [code, {
    previous: previous?.losses[code] ?? null, candidate: next.losses[code],
    delta: previous ? next.losses[code] - previous.losses[code] : null,
  }]));
  const identityCompatible = previous !== null && target !== null && priorTarget !== null &&
    adoptionDigest(identity(previous, priorTarget)) === adoptionDigest(identity(next, target));
  const candidate = {
    schema: 'pii-evidence-adoption-candidate/1', state: 'proposed', supportClaims: false,
    authorityChanged: false, activePinsChanged: false, ownerAcceptance: null,
    policyDigest: adoptionDigest(policy), preflightDigest: adoptionDigest(next),
    identity: identity(next, target),
    historical: previous ? { preflightDigest: adoptionDigest(previous), identity: identity(previous, priorTarget),
      preservation: 'retain-immutable-snapshot-and-run-records-before-active-update' } : null,
    changes: { losses, mappedKinds: kindDelta(previous?.mappedKinds ?? [], next.mappedKinds), excludedKinds: kindDelta(previous?.excludedKinds ?? [], next.excludedKinds),
      counts: Object.fromEntries(Object.keys(next.counts).map(key => [key, { previous: previous?.counts[key] ?? null, candidate: next.counts[key] }])) },
    measurement: { state: 'fresh-execution-required', reused: false, identityCompatible,
      reason: identityCompatible ? 'identity-compatible-but-no-strict-measurement-receipt-validated' : 'no-identical-validated-measurement-tuple',
      targetSelected: target !== null, scannerExecutions: 0, lostAxisClaims: 'pending-until-faithfully-represented' },
    adoption: { canApply: false, reason: 'strict-measurement-receipt-required-before-acceptance',
      activeUpdate: 'separate-explicit-maintainer-acceptance-command', numericalCriteriaChanged: false,
      freshOfficialCostDecisionRequired: true, protectedExecutionAuthorised: false },
  };
  const candidateDigest = adoptionDigest(candidate);
  const acceptanceReview = acceptance === null ? null : {
    record: validateMaintainerAcceptance(acceptance, candidateDigest), state: 'scope-and-candidate-binding-checked-only',
    measurementValidated: false, activeUpdateApplied: false,
  };
  return { ...candidate, candidateDigest, acceptanceReview };
}

export function adoptionSummary(candidate) {
  return [
    '# PII evidence adoption proposal', '',
    `Candidate digest: ${candidate.candidateDigest}.`,
    `Snapshot: ${candidate.identity.evidence.snapshot.id}. Population: ${candidate.identity.population.id}.`,
    'Proposal only. Active pins, four benchmark populations and authority are unchanged.',
    'Fresh measurement remains required; identity compatibility alone does not reuse an observation.',
    'Lost PHI/context axes remain pending. No product support or protected execution is authorised.',
    candidate.acceptanceReview ? 'An external acceptance record has only its scope and candidate binding checked; no active update was applied.' : 'No maintainer acceptance supplied.',
    '', '## Mapping loss changes', '',
    ...Object.entries(candidate.changes.losses).map(([code, value]) => `${code}: ${value.previous ?? 'no previous snapshot'} -> ${value.candidate}; delta ${value.delta ?? 'not compared'}.`), '',
    'Next: validate a fresh canonical execution receipt, retain historical snapshot/run identities, then review a separate explicit acceptance.', '',
  ].join('\n');
}


function measuredScanner(comparison) {
  const { plan, receipt } = comparison;
  return validateAdoptionScanner({ schema: 'pii-evidence-scanner-identity/1', sourceCommit: receipt.candidate.sourceCommit,
    version: receipt.candidate.version, kind: 'qualified-candidate', coreTarballSha256: receipt.candidate.tarballs.core,
    nativeTarballSha256: receipt.candidate.tarballs.node, wasmTarballSha256: receipt.candidate.tarballs.wasm,
    packageTreeSha256: receipt.candidate.packageTreeSha256, adapterDigest: adoptionDigest(plan.scanner.adapter),
    configurationDigest: plan.scanner.configurationDigest, activationDigest: plan.scanner.activationDigest });
}

function checkedAdoptionEntry(entry, policy, previous) {
  if (!exact(entry, ['preflight', 'candidate', 'acceptance', 'comparison', 'retainedFiles']) ||
      !exact(entry.comparison, ['plan', 'receipt', 'receiptText', 'record', 'artifacts', 'populationIndex'])) refuse('adoption-entry-invalid');
  const preflight = checkedPreflight(entry.preflight, policy), comparison = entry.comparison;
  // The default loader requires a GitHub record for official data. No bypass is exposed here.
  const measured = loadPiiEvidenceComparison(comparison);
  if (measured.state !== 'recorded' || measured.mode !== 'official') refuse('canonical-measurement-required');
  const plan = comparison.plan, receipt = comparison.receipt;
  const names = ['plan.json', 'receipt.json', 'build-receipt.json', 'baseline.public-synthetic-artifact.json', 'candidate.public-synthetic-artifact.json',
    ...receipt.replayInputs.map(row => row.name)];
  const files = entry.retainedFiles;
  if (!exact(files, names) || Object.values(files).some(text => typeof text !== 'string') ||
      adoptionDigest(parseEvidenceJson(files['plan.json'])) !== adoptionDigest(plan) || files['receipt.json'] !== comparison.receiptText ||
      sha256(files['build-receipt.json']) !== comparison.record.buildReceipt.sha256 ||
      adoptionDigest(parseEvidenceJson(files['build-receipt.json'])) !== adoptionDigest(receipt.importer.buildReceipt) ||
      comparison.artifacts.some(row => files[`${row.side}.public-synthetic-artifact.json`] !== row.text) ||
      receipt.replayInputs.some(row => sha256(files[row.name]) !== row.sha256)) refuse('retained-upload-bytes-mismatch');

  if (adoptionDigest(plan.policy) !== adoptionDigest(policy) || adoptionDigest(plan.preflight) !== adoptionDigest(preflight) ||
      adoptionDigest(plan.evidence) !== adoptionDigest(preflight.evidence) ||
      adoptionDigest(plan.consumer) !== adoptionDigest(preflight.consumer) ||
      adoptionDigest(plan.population) !== adoptionDigest(preflight.population) ||
      adoptionDigest(plan.counts) !== adoptionDigest(preflight.counts) || adoptionDigest(plan.losses) !== adoptionDigest(preflight.losses) ||
      adoptionDigest(plan.mappedFamilies) !== adoptionDigest(preflight.mappedFamilies) ||
      receipt.import.snapshotSha256 !== preflight.outputs['snapshot.json'].sha256 ||
      receipt.import.bindingSha256 !== preflight.outputs['binding.json'].sha256) refuse('measurement-preflight-mismatch');
  const scanner = measuredScanner(comparison);
  const expected = preparePiiEvidenceAdoption({ policy, preflight, scanner,
    previousPreflight: previous?.preflight ?? null, previousScanner: previous?.scanner ?? null });
  if (adoptionDigest(entry.candidate) !== adoptionDigest(expected)) refuse('candidate-measurement-mismatch');
  const acceptance = validateMaintainerAcceptance(entry.acceptance, expected.candidateDigest);
  return { preflight, scanner, candidate: expected, acceptance,
    measurement: { planDigest: adoptionDigest(plan), recordDigest: adoptionDigest(comparison.record),
      receiptSha256: comparison.record.receipt.sha256, workflowRunId: comparison.record.workflow.runId } };
}

// This validates supplied approval and history. It never creates approvals or changes active files.
export function validateActiveEvidenceAdoption(input) {
  if (!exact(input, ['policy', 'snapshotPin', 'consumerPin', 'preflight', 'candidate', 'acceptance', 'history', 'comparison', 'retainedFiles']))
    refuse('active-adoption-invalid');
  validatePiiPopulationPolicy(input.policy);
  if (!Array.isArray(input.history) || input.history.length > 100) refuse('history-invalid');
  let previous = null;
  const historical = [], identities = new Set();
  for (const entry of [...input.history, input]) {
    const selected = { preflight: entry.preflight, candidate: entry.candidate, acceptance: entry.acceptance, comparison: entry.comparison, retainedFiles: entry.retainedFiles };
    if (entry !== input && !exact(entry, Object.keys(selected))) refuse('history-invalid');
    const checked = checkedAdoptionEntry(selected, input.policy, previous), id = checked.preflight.evidence.snapshot.id;
    if (identities.has(id)) refuse('history-snapshot-duplicate');
    if (!previous && adoptionDigest(checked.preflight.evidence) !== adoptionDigest(SNAPSHOT_PIN)) refuse('history-initial-anchor-missing');
    identities.add(id);
    if (entry !== input) historical.push({ candidateDigest: checked.candidate.candidateDigest,
      identity: checked.candidate.identity, acceptance: checked.acceptance, measurement: checked.measurement });
    previous = checked;
  }
  if (adoptionDigest(input.snapshotPin) !== adoptionDigest(previous.preflight.evidence) ||
      adoptionDigest(input.consumerPin) !== adoptionDigest(previous.preflight.consumer)) refuse('active-pin-mismatch');
  return { schema: 'pii-evidence-validated-adoption/1', state: 'externally-accepted-and-measured',
    candidateDigest: previous.candidate.candidateDigest, snapshotPin: structuredClone(input.snapshotPin), consumerPin: structuredClone(input.consumerPin),
    acceptance: previous.acceptance, measurement: previous.measurement, historical,
    activeWritesApplied: false, authorityChanged: false, supportClaims: false, qualified: false };
}
