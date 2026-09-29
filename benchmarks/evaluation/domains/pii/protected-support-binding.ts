/**
 * Reviewed v2 binding path from the Beta.11 protected disposition to `pii-support-matrix-v2` (benchmarks #428).
 *
 * The support projection used to read only v1 product records (`pii-activation-evidence-v1.json` plus
 * `pii-family-qualification-v1.json`). The Beta.11 result is a `pii-beta11-protected-disposition` written by the
 * v2 route. A reviewed entry in `protected-support-bindings-v1.json` names one such disposition and every identity it
 * rests on; `bindPiiProtectedSupport` reads the committed evidence, checks each identity, and re-derives the
 * disposition from the report, the seal, the six protected runs and the profile-cost ledger before a matrix may carry
 * it. The route projects `provisional` only for a family whose public gates and protected gate are met under an
 * accepted custody, `pending` otherwise, and never `stable`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from '../../substrate/hash.ts';
import { assertB11ReportBinding, b11ProtectedFamilySlug, buildB11ProtectedDisposition, validateB11ProtectedSeal,
  validateB11ProtectedTrust } from './beta11-protected.ts';
import { B11_FAMILIES, b11Commitment } from './beta11-qualification.ts';
import { b11ProfileCostAcceptance, piiProfileCostAcceptances, type PiiProfileCostAcceptance } from './profile-cost-acceptance.ts';
import { piiCurrentProtectedRoute, piiProtectedRouteProblem, piiReviewedProtectedRoute, type PiiProtectedRoute } from './support-semantics.ts';
import { piiSupportRegistry } from './support-v2.ts';

export interface PiiProtectedSupportEvidence {
  freeze: any; report: any; disposition: any; protectedDisposition: any; seal: any;
  runs: Array<{ aggregate: any; trust: any }>; profileCost: { runs: any; candidate: any; size: any };
  ledger?: readonly PiiProfileCostAcceptance[];
}

const reject = (code: string): never => { throw new Error(`PII protected support binding rejected: ${code}`); };
const attempt = <T>(code: string, run: () => T): T => { try { return run(); } catch { return reject(code); } };
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * Validate one reviewed route entry against its committed evidence. Returns the entry a matrix may carry.
 * Every rejection names its code; none echoes a value from the evidence.
 */
export function validatePiiProtectedSupportBinding(binding: PiiProtectedRoute, evidence: PiiProtectedSupportEvidence): PiiProtectedRoute {
  const reviewed = piiReviewedProtectedRoute(binding?.id);
  if (!reviewed || !same(reviewed, binding)) reject('not-a-reviewed-binding');
  const shape = piiProtectedRouteProblem(binding, piiSupportRegistry.families);
  if (shape) reject(`binding-shape (${shape})`);
  const { freeze, report, disposition, protectedDisposition: record, seal, runs, profileCost } = evidence;

  // The exact core commit and freeze.
  if (!freeze || freeze.freezeCommitment !== b11Commitment({ ...freeze, freezeCommitment: undefined })) reject('freeze-commitment-invalid');
  if (freeze.candidate?.sourceCommit !== binding.coreCommit) reject('core-commit-mismatch');
  if (freeze.freezeCommitment !== binding.freezeCommitment) reject('freeze-mismatch');
  // The #428 report and its public disposition.
  attempt('report-not-bound-to-freeze', () => assertB11ReportBinding(freeze, report));
  if (report.artifactCommitment !== binding.reportCommitment) reject('report-mismatch');
  if (!disposition || disposition.artifactCommitment !== b11Commitment({ ...disposition, artifactCommitment: undefined }) ||
      disposition.reportCommitment !== report.artifactCommitment || disposition.artifactCommitment !== binding.dispositionCommitment)
    reject('disposition-mismatch');
  // The seal.
  attempt('seal-invalid', () => validateB11ProtectedSeal(seal));
  if (seal.artifactCommitment !== binding.sealCommitment) reject('seal-mismatch');

  // The protected disposition names the same identities.
  if (!record || record.reportType !== 'pii-beta11-protected-disposition' || record.schemaVersion !== 1 || record.supportClaims !== false ||
      record.route !== binding.route || record.issue !== binding.issue || record.productIssue !== binding.productIssue ||
      record.artifactCommitment !== b11Commitment({ ...record, artifactCommitment: undefined }))
    reject('protected-disposition-invalid');
  if (record.candidate?.sourceCommit !== binding.coreCommit) reject('core-commit-mismatch');
  if (record.freezeCommitment !== binding.freezeCommitment) reject('freeze-mismatch');
  if (record.reportCommitment !== binding.reportCommitment) reject('report-mismatch');
  if (record.dispositionCommitment !== binding.dispositionCommitment) reject('disposition-mismatch');
  if (record.sealCommitment !== binding.sealCommitment) reject('seal-mismatch');

  // The profile-cost acceptance ledger entry, recomputed from the bound runs.
  const ledger = evidence.ledger ?? piiProfileCostAcceptances;
  const entry = ledger.find(row => row.id === binding.costAcceptance.id);
  if (!entry || hash(JSON.stringify(entry)) !== binding.costAcceptance.entryCommitment || entry.candidate.sourceCommit !== binding.coreCommit)
    reject('cost-acceptance-ledger-mismatch');
  const acceptance = b11ProfileCostAcceptance({ report, profileCost, ledger });
  if (acceptance.status !== 'accepted' || !same(acceptance, record.costAcceptance) || record.costAcceptance?.acceptedBy !== binding.costAcceptance.id ||
      record.costAcceptance?.entryCommitment !== binding.costAcceptance.entryCommitment || record.costAcceptance?.sourceCommit !== binding.coreCommit ||
      record.costAcceptance?.reportCommitment !== binding.reportCommitment)
    reject('cost-acceptance-ledger-mismatch');

  // Status rules: never stable; provisional only with every public gate and the protected gate met.
  if (record.maximumStatus !== 'provisional' || record.distribution?.stable !== 0 ||
      (record.families as any[]).some(row => !['pending', 'provisional'].includes(row.status)))
    reject('stable-not-projectable');
  if (!Array.isArray(record.families) || JSON.stringify(record.families.map((row: any) => row.family)) !== JSON.stringify(B11_FAMILIES))
    reject('protected-disposition-families');
  for (const row of record.families) {
    if (row.status === 'provisional' && (row.protected?.state !== 'met' || row.publicGates?.notMet?.length || row.publicGates?.unresolved?.length))
      reject(`protected-gate-not-met:${row.family}`);
  }

  // Custody: one accepted trust resolution over a complete sealed run per family.
  if (!Array.isArray(runs) || new Set(runs.map(run => run?.aggregate?.family)).size !== runs.length) reject('protected-runs-invalid');
  for (const row of record.families) {
    const run = runs.find(item => item.aggregate?.family === row.family);
    if (!run) reject(`custody-unresolved:${row.family}`);
    attempt(`custody-invalid:${row.family}`, () => validateB11ProtectedTrust(run!.trust, run!.aggregate));
    if (run!.trust.decision !== 'accepted') reject(`custody-rejected:${row.family}`);
    if (run!.aggregate.status !== 'complete' || run!.trust.aggregateStatus !== 'complete' || row.protected?.runs !== '1/1' ||
        !['met', 'not-met'].includes(row.protected?.state)) reject(`custody-unresolved:${row.family}`);
    const sealed = seal.families.find((item: any) => item.family === row.family);
    if (!sealed || run!.trust.sealCommitment !== binding.sealCommitment || run!.trust.freezeCommitment !== binding.freezeCommitment ||
        run!.trust.coreCommit !== binding.coreCommit || run!.trust.corpusHash !== sealed.corpusHash)
      reject(`custody-not-bound:${row.family}`);
  }

  // The committed disposition is exactly what the report, seal, runs and acceptance produce.
  const derived = attempt('protected-disposition-not-rederived', () => buildB11ProtectedDisposition({ report, disposition, seal, runs, costAcceptance: acceptance }));
  if (!same(derived, record)) reject('protected-disposition-not-rederived');
  if (record.artifactCommitment !== binding.artifactCommitment) reject('protected-disposition-not-reviewed');

  // The reviewed family rows restate the disposition, and each coverage cites its frozen contract.
  for (const row of binding.families) {
    const bound = record.families.find((item: any) => item.family === row.family);
    if (!bound || bound.status !== row.status || bound.protected.reason !== row.reason || bound.protected.epochCommitment !== row.epochCommitment ||
        bound.protected.aggregateCommitment !== row.aggregateCommitment || bound.protected.trustCommitment !== row.trustCommitment)
      reject(`binding-family-mismatch:${row.family}`);
    const reportEpoch = report.families.find((item: any) => item.family === row.family)?.protected?.epochCommitment;
    const trust = runs.find(item => item.aggregate.family === row.family)!.trust;
    if (reportEpoch !== row.epochCommitment || trust.epochCommitment !== row.epochCommitment) reject(`epoch-mismatch:${row.family}`);
    if (row.coverage.contract !== null &&
        (freeze.contracts as Array<{ path: string; sha256: string }>).find(item => item.path === row.coverage.contract)?.sha256 !== row.coverage.contractSha256)
      reject(`coverage-contract-mismatch:${row.family}`);
  }
  return structuredClone(binding);
}

/** Read the committed evidence one reviewed entry names, relative to the repository root. */
export async function loadPiiProtectedSupportEvidence(root: string, binding: PiiProtectedRoute): Promise<PiiProtectedSupportEvidence> {
  const read = (file: string) => readFile(path.join(root, file), 'utf8').then(JSON.parse);
  const dir = binding.evidenceDirectory;
  const [freeze, report, disposition, protectedDisposition, seal, runs, costRuns, candidate, size] = await Promise.all([
    read(`${dir}/pii-beta11-freeze-v2.json`), read(`${dir}/pii-beta11-report-v2.json`), read(`${dir}/pii-beta11-disposition-v2.json`),
    read(`${dir}/pii-beta11-protected-disposition-v2.json`), read(binding.sealRecord),
    Promise.all(B11_FAMILIES.map(async family => ({ aggregate: await read(`${dir}/protected/${b11ProtectedFamilySlug(family)}-aggregate-v1.json`),
      trust: await read(`${dir}/protected/${b11ProtectedFamilySlug(family)}-trust-resolution-v1.json`) }))),
    read(`${dir}/pii-profile-cost-v2-runs.json`), read(`${dir}/pii-profile-cost-v2-candidate.json`), read(`${dir}/pii-profile-cost-v2-size.json`),
  ]);
  return { freeze, report, disposition, protectedDisposition, seal, runs, profileCost: { runs: costRuns, candidate, size } };
}

/** The current reviewed entry, re-derived from committed evidence under `root`; null when none is reviewed. */
export async function bindPiiProtectedSupport(root: string, binding: PiiProtectedRoute | null = piiCurrentProtectedRoute()): Promise<PiiProtectedRoute | null> {
  if (!binding) return null;
  return validatePiiProtectedSupportBinding(binding, await loadPiiProtectedSupportEvidence(root, binding));
}
