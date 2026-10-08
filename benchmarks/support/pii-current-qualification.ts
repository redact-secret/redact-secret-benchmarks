import { readFile } from 'node:fs/promises';
import path from 'node:path';
import readiness from '../../docs/generated/pii-protected-readiness.json';
import registry from '../evaluation/domains/pii/support-registry-v1.json';
import { loadPiiCandidateComparison, comparisonDigest } from '../evaluation/domains/pii/candidate-comparison.mjs';

export interface PiiCurrentQualification {
  schemaVersion: 1;
  state: 'prepared' | 'recorded' | 'invalid';
  sourceCommit: string;
  supportClaims: false;
  qualified: false;
  evidenceScope: 'public-synthetic-only';
  publicMeasurement: {
    state: 'not-recorded' | 'recorded' | 'invalid';
    mode: 'exploratory' | 'official' | null;
    reason: string | null;
    receiptDigest: string | null;
    productArtifactDigest: string | null;
    baselineSourceCommit: string | null;
    engineBinaryDigest: string | null;
  };
  gates: { publicQualification: 'not-evaluated'; validator: 'not-measured'; runtimeAndPackageCost: 'unmeasured'; sizeRegressionBudget: 'unmeasured';
    profileCost: 'unmeasured'; protectedPath: 'pending-not-operational'; protectedPartition: 'not-run' };
  distribution: { stable: 0; provisional: 0; pending: number; unsupported: 0 };
  families: { family: string; status: 'pending'; reasonCodes: string[] }[];
}

/** Keeps current-target qualification apart from the immutable historical protected disposition. */
export function projectPiiCurrentQualification(comparison: any, receipt: unknown = null): PiiCurrentQualification {
  const recorded = comparison.state === 'recorded';
  if (recorded && (comparison.candidate.sourceCommit !== readiness.target.sourceCommit ||
      comparison.qualified !== false || comparison.publicOnly !== true || comparison.supportClaims !== false))
    throw new Error('Current PII comparison disagrees with the prepared target or measurement boundary');
  const state = recorded ? 'recorded' : comparison.state === 'invalid' ? 'invalid' : 'prepared';
  const reasons = [recorded ? 'product-validator-primitive-seam-unavailable' :
    state === 'invalid' ? 'current-public-comparison-invalid' : 'current-public-comparison-not-recorded',
    'public-qualification-gates-not-evaluated', 'runtime-and-package-cost-unmeasured', 'size-regression-budget-unmeasured', 'profile-cost-unmeasured',
    'protected-path-not-operational', 'protected-partition-not-run'];
  return {
    schemaVersion: 1, state, sourceCommit: readiness.target.sourceCommit,
    supportClaims: false, qualified: false, evidenceScope: 'public-synthetic-only',
    publicMeasurement: { state: recorded ? 'recorded' : state === 'invalid' ? 'invalid' : 'not-recorded',
      mode: recorded ? comparison.mode : null, reason: recorded ? null : comparison.reason,
      receiptDigest: recorded ? comparisonDigest(receipt) : null,
      productArtifactDigest: recorded ? comparison.candidate.packageTreeSha256 : null,
      baselineSourceCommit: recorded ? comparison.baseline.sourceCommit : null,
      engineBinaryDigest: recorded ? comparison.engine.binarySha256 : null },
    gates: { publicQualification: 'not-evaluated', validator: 'not-measured', runtimeAndPackageCost: 'unmeasured', sizeRegressionBudget: 'unmeasured',
      profileCost: 'unmeasured', protectedPath: 'pending-not-operational', protectedPartition: 'not-run' },
    distribution: { stable: 0, provisional: 0, pending: registry.families.length, unsupported: 0 },
    families: registry.families.map(row => ({ family: row.family, status: 'pending' as const, reasonCodes: [...reasons] }))
      .sort((a, b) => a.family < b.family ? -1 : a.family > b.family ? 1 : 0),
  };
}

/** Reads only the separate public comparison package; absent and malformed evidence cannot qualify a target. */
export async function buildPiiCurrentQualification(root: string): Promise<PiiCurrentQualification> {
  const directory = path.join(root, 'benchmarks/pii-candidate-comparison');
  const optional = async (file: string) => {
    try { return JSON.parse(await readFile(path.join(directory, file), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  };
  try {
    const plan = await optional('plan.json'), receipt = await optional('receipt.json'), record = await optional('record.json');
    if (!plan || !receipt) return projectPiiCurrentQualification(loadPiiCandidateComparison({ plan, receipt, record }));
    const artifacts = await Promise.all(['baseline', 'candidate'].flatMap(side => plan.populations.map(async (population: { view: string }) => {
      if (!/^[a-z0-9-]+$/.test(population.view)) throw new Error('Invalid public comparison view');
      return { side, view: population.view, text: await readFile(path.join(directory, `${side}.${population.view}.public-synthetic-artifact.json`), 'utf8') };
    })));
    return projectPiiCurrentQualification(loadPiiCandidateComparison({ plan, receipt, artifacts, record }), receipt);
  } catch {
    return projectPiiCurrentQualification({ state: 'invalid', reason: 'comparison-document-invalid' });
  }
}
