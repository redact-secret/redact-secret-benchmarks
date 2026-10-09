import { hash } from '../../substrate/hash.ts';
import Ajv from 'ajv';
import index from '../../../inputs/pii/current-inputs-index.json';
import schema from '../../../../schemas/pii-protected-current-input-v1.json';
import { piiInputCommitment } from './current-inputs.ts';
import { B11_FAMILIES, b11Commitment } from './beta11-qualification.ts';
import { deriveB11ProtectedDisposition, validateB11ProtectedSeal, validateB11ProtectedTrust } from './beta11-protected.ts';
import { b11ProfileCostAcceptance, piiProfileCostAcceptances } from './profile-cost-acceptance.ts';
import { piiReviewedProtectedRoute, type PiiProtectedRoute } from './support-semantics.ts';
import { validatePiiProtectedSupportBinding, type PiiProtectedSupportEvidence } from './protected-support-binding.ts';

const same = (a: unknown, b: unknown) => piiInputCommitment(a) === piiInputCommitment(b);
const shape = new Ajv({ allErrors: true, strict: false }).compile(schema);
const reject = (code: string): never => { throw new Error(`PII protected support binding rejected: ${code}`); };
const metric = (row: any) => Object.fromEntries(['id', 'numerator', 'denominator', 'threshold', 'direction', 'status', 'value']
  .filter(key => row[key] !== undefined).map(key => [key, structuredClone(row[key])]));

/** Only full, independently validated original inputs may prepare the compact current receipt. */
export function projectPiiProtectedEvidence(binding: PiiProtectedRoute, original: PiiProtectedSupportEvidence, source: unknown, sources: unknown[]) {
  if (original.currentInput !== undefined) throw new Error('Current projections cannot be used as their own original source');
  validatePiiProtectedSupportBinding(binding, original);
  const contracts = new Set(binding.families.map(row => row.coverage.contract).filter(Boolean));
  const data = {
    freeze: { populationPlanSet: original.freeze.populationPlanSet, benchmark: { baseRevision: original.freeze.benchmark.baseRevision }, candidate: { sourceCommit: original.freeze.candidate.sourceCommit }, freezeCommitment: original.freeze.freezeCommitment,
      contracts: original.freeze.contracts.filter((row: any) => contracts.has(row.path)) },
    report: { candidate: original.report.candidate, freeze: original.report.freeze, artifactCommitment: original.report.artifactCommitment,
      families: original.report.families.map((row: any) => ({ family: row.family, protected: { epochCommitment: row.protected.epochCommitment },
        gates: row.gates.map((gate: any) => ({ id: gate.id, status: gate.status,
          ...(gate.id === 'profile-cost' ? { evidence: { sizeRows: gate.evidence?.sizeRows ?? [] } } : {}) })),
        views: { reviewed: row.views.reviewed.map((view: any) => ({ view: view.view, cases: view.cases,
          sensitive: { cases: view.sensitive.cases }, nonSensitive: { cases: view.nonSensitive.cases }, notEstablished: { cases: view.notEstablished.cases },
          ...(view.metrics ? { metrics: view.metrics.map(metric) } : {}) })) } })),
    },
    disposition: { artifactCommitment: original.disposition.artifactCommitment, reportCommitment: original.disposition.reportCommitment },
    protectedDisposition: original.protectedDisposition, seal: original.seal, runs: original.runs,
    profileCost: {
      runs: { runs: original.profileCost.runs.runs.map((row: any) => ({ phase: row.phase, runId: row.runId })) },
      candidate: { sourceCommit: original.profileCost.candidate.sourceCommit, planCommitment: original.profileCost.candidate.planCommitment,
        runId: original.profileCost.candidate.runId, artifactCommitment: original.profileCost.candidate.artifactCommitment,
        evaluation: original.profileCost.candidate.evaluation.filter((row: any) => ['regression', 'invalid-measurement'].includes(row.verdict)) },
      size: { comparison: { sourceCommit: original.profileCost.size.comparison.sourceCommit },
        planCommitment: original.profileCost.size.planCommitment, artifactCommitment: original.profileCost.size.artifactCommitment },
    },
  };
  const originalCost = b11ProfileCostAcceptance({ report: original.report, profileCost: original.profileCost, ledger: original.ledger });
  const compactCost = b11ProfileCostAcceptance({ report: data.report, profileCost: data.profileCost, ledger: original.ledger });
  if (!same(originalCost, compactCost) || !same(deriveB11ProtectedDisposition({ ...data, costAcceptance: compactCost }), original.protectedDisposition))
    throw new Error('Compact PII input changes the original protected disposition or accepted cost');
  const value = { schema: 'redact-secret/pii-protected-current-input/v1', supportClaims: false, source, sources, bindingId: binding.id, data };
  return { ...value, projectionCommitment: piiInputCommitment(value) };
}

/** The separately reviewed index binds all projected fields, even if an attacker recomputes their self-hash. */
export function validateCurrentPiiProtectedEvidence(binding: PiiProtectedRoute, evidence: PiiProtectedSupportEvidence): PiiProtectedRoute {
  const receipt = evidence.currentInput as any;
  if (!shape(receipt) || !receipt || receipt.schema !== 'redact-secret/pii-protected-current-input/v1' || receipt.supportClaims !== false ||
      Object.keys(receipt).sort().join(',') !== ['schema', 'supportClaims', 'source', 'sources', 'bindingId', 'data', 'projectionCommitment'].sort().join(','))
    reject('current-input-schema');
  const expected = index.inputs.filter(row => row.role === 'protected-route');
  const { projectionCommitment, ...projection } = receipt;
  if (expected.length !== 1 || projectionCommitment !== expected[0].projectionCommitment || piiInputCommitment(projection) !== projectionCommitment ||
      !same(receipt.source, expected[0].source)) reject('current-input-source-or-projection-mismatch');
  const { currentInput: _input, ledger: _ledger, ...actual } = evidence;
  if (!same(actual, receipt.data)) reject('current-input-data-changed');
  const reviewed = piiReviewedProtectedRoute(binding?.id);
  if (!reviewed || !same(reviewed, binding) || receipt.bindingId !== binding.id) reject('not-a-reviewed-binding');
  if (!Array.isArray(receipt.sources) || new Set(receipt.sources.map((row: any) => row.path)).size !== receipt.sources.length ||
      receipt.sources.some((row: any) => !/^[a-f0-9]{64}$/.test(row.sha256))) reject('current-input-original-source-proof');
  const { freeze, report, disposition, protectedDisposition: record, seal, runs, profileCost } = evidence;
  if (freeze.candidate.sourceCommit !== binding.coreCommit || report.candidate.sourceCommit !== binding.coreCommit || record.candidate.sourceCommit !== binding.coreCommit)
    reject('core-commit-mismatch');
  if (freeze.freezeCommitment !== binding.freezeCommitment || report.freeze.freezeCommitment !== binding.freezeCommitment ||
      record.freezeCommitment !== binding.freezeCommitment) reject('freeze-mismatch');
  if (report.artifactCommitment !== binding.reportCommitment || disposition.reportCommitment !== binding.reportCommitment ||
      record.reportCommitment !== binding.reportCommitment) reject('report-mismatch');
  if (disposition.artifactCommitment !== binding.dispositionCommitment || record.dispositionCommitment !== binding.dispositionCommitment)
    reject('disposition-mismatch');
  validateB11ProtectedSeal(seal);
  if (seal.artifactCommitment !== binding.sealCommitment || record.sealCommitment !== binding.sealCommitment) reject('seal-mismatch');
  if (record.artifactCommitment !== b11Commitment({ ...record, artifactCommitment: undefined }) || record.artifactCommitment !== binding.artifactCommitment ||
      record.maximumStatus !== 'provisional' || record.distribution.stable !== 0) reject('protected-disposition-invalid');
  const ledger = evidence.ledger ?? piiProfileCostAcceptances, entry = ledger.find(row => row.id === binding.costAcceptance.id);
  if (!entry || hash(JSON.stringify(entry)) !== binding.costAcceptance.entryCommitment) reject('cost-acceptance-ledger-mismatch');
  const acceptance = b11ProfileCostAcceptance({ report, profileCost, ledger });
  if (acceptance.status !== 'accepted' || !same(acceptance, record.costAcceptance)) reject('cost-acceptance-ledger-mismatch');
  if (!Array.isArray(runs) || runs.length !== B11_FAMILIES.length || new Set(runs.map(row => row.aggregate.family)).size !== runs.length)
    reject('protected-runs-invalid');
  for (const family of B11_FAMILIES) {
    const run = runs.find(row => row.aggregate.family === family);
    if (!run) return reject(`custody-unresolved:${family}`);
    if (run.trust.decision !== 'accepted' || run.aggregate.status !== 'complete') reject(`custody-unresolved:${family}`);
    validateB11ProtectedTrust(run.trust, run.aggregate);
    const coverage = binding.families.find(row => row.family === family)!.coverage;
    if (coverage.contract && freeze.contracts.find((row: any) => row.path === coverage.contract)?.sha256 !== coverage.contractSha256)
      reject(`coverage-contract-mismatch:${family}`);
  }
  if (!same(deriveB11ProtectedDisposition({ report, disposition, seal, runs, costAcceptance: acceptance }), record))
    reject('protected-disposition-not-rederived');
  return structuredClone(binding);
}
