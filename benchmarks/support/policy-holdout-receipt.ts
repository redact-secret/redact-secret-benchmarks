import type { PolicyHoldoutReceipt } from './policy-qualified.ts';
import { validateCredentialPolicyHoldoutReport } from '../evaluation/domains/credential-policy/holdout.ts';

// Node-only: validating a receipt hashes with node:crypto and pulls the holdout runner, so the browser-bundled
// `policy-qualified.ts` must not import it (that made the deployed site crash with "Buffer is not defined").
export function validatePolicyHoldoutReceipt(value: unknown): PolicyHoldoutReceipt {
  const r = value as PolicyHoldoutReceipt;
  if (!r || Object.keys(r).sort().join(',') !== 'benchmarkRevision,productRevision,profileId,report,schemaVersion' ||
      r.schemaVersion !== 2 || r.profileId !== 'credential-policy-v1' ||
      !/^[a-f0-9]{40}$/.test(r.productRevision) || !/^[a-f0-9]{40}$/.test(r.benchmarkRevision))
    throw new Error('Invalid policy-qualified credential holdout receipt');
  try { validateCredentialPolicyHoldoutReport(r.report); } catch { throw new Error('Invalid policy-qualified credential holdout receipt'); }
  const product = r.report.scanners.find(scanner => scanner.id === 'redact-secret');
  if (r.report.status !== 'complete' || r.report.corpus.purpose !== 'protected' || r.report.independence !== 'custodian-declared' ||
      !product || product.status !== 'complete')
    throw new Error('Invalid policy-qualified credential holdout receipt');
  return r;
}
