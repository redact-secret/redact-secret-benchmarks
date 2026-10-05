import type { Scanner, EvaluationCase } from '../../model/types.ts';
import type { Candidate, Counts, HoldoutManifest, HoldoutReport } from '../../../../holdout/types.ts';
import { hash } from '../../substrate/hash.ts';
import { executeEvaluation } from './execution.ts';
import { createHoldoutMethods, createHoldoutOperators } from './holdout-method.ts';
import { normalizeFinding } from './normalization.ts';
import { publicConformanceCorpus } from '../../../../holdout/conformance.ts';
import { credentialHoldoutStorage, credentialManifestEvaluation, validateCredentialHoldoutCorpus } from './holdout-corpus.ts';
import { validateEvidence } from '../../evidence.ts';
import { credentialAccountingIdentity } from './accounting.ts';
import type { HoldoutDomainAdapter, HoldoutLifecycleCommon } from '../../../../holdout/lifecycle.ts';

const counts = (): Counts => ({ pass: 0, fail: 0, 'review-required': 0 });
type CredentialHoldoutEvaluation = Pick<HoldoutReport, 'startedAt' | 'finishedAt' | 'caseCount' | 'variantCount' | 'generationErrors' | 'scanners'>;

export const credentialHoldoutDomain: HoldoutDomainAdapter<Scanner, ReturnType<typeof validateCredentialHoldoutCorpus>, CredentialHoldoutEvaluation, HoldoutReport> = {
  identity: credentialAccountingIdentity('evaluation-v1'),
  holdoutMethod: { id: 'credential-holdout', version: 1 },
  reportContract: { id: 'holdout-v1', version: 1 },
  publicConformanceCorpus: seed => validateCredentialHoldoutCorpus(publicConformanceCorpus(seed)),
  validateCorpus: validateCredentialHoldoutCorpus,
  serializeCorpus: credentialHoldoutStorage.serializeCorpus,
  resolveManifestEvaluation: manifest => manifest.evaluation ?? credentialManifestEvaluation,
  async evaluate({ corpus, manifest, scanners, runId, directory, planHash, toolPlan, candidate, verifyCandidate }: {
    corpus: ReturnType<typeof validateCredentialHoldoutCorpus>; manifest: HoldoutManifest; scanners: Scanner[]; runId: string; directory: string;
    planHash: string; toolPlan: { id: string; version: string; configuration: Record<string, unknown>; configurationHash: string }[];
    candidate: Candidate; verifyCandidate: () => Promise<Candidate>;
  }) {
    const cases: EvaluationCase[] = corpus.fixtures.map((f, i) => ({
      id: `holdout-${i}`, method: 'holdout', visibility: 'holdout', seed: f, targets: [], operators: [],
      source: { category: 'holdout', fixtureId: f.id, path: 'protected' },
      provenance: { source: 'holdout', sourceHash: manifest.corpusHash, rationale: f.assessment.reason,
        seed: corpus.seed, reviewStatus: manifest.review, sources: f.assessment.sources },
    }));
    const raw = await executeEvaluation({ cases, methods: createHoldoutMethods(), operators: createHoldoutOperators(), scanners,
      runId, scratchParent: directory, provenance: { planHash }, normalizeFinding });
    const candidateStable = hash(await verifyCandidate()) === hash(candidate);
    const scannerResults = raw.scanners.map(s => {
      const expected = toolPlan.find(t => t.id === s.id)!;
      const status = s.status === 'complete' && (!candidateStable || s.version !== expected.version || s.configurationHash !== expected.configurationHash)
        ? 'error' as const : s.status;
      const assertions = counts(), byStratum: Record<string, Counts> = {};
      if (status === 'complete') for (const result of raw.results) {
        const scored = result.scanners.find(o => o.scanner === s.id)!;
        for (const a of scored.assertions) {
          const v = result.variants.find(v => v.id === a.variant)!;
          const bucket = byStratum[`${v.kind}:${v.tier}`] ??= counts();
          if (a.status === 'not-measured') throw new Error('holdout-not-measured');
          bucket[a.status]++; assertions[a.status]++;
        }
      }
      return { id: s.id, version: s.version, configuration: expected.configuration, configurationHash: expected.configurationHash,
        status, assertions, byStratum };
    });
    return { startedAt: raw.startedAt, finishedAt: raw.finishedAt, caseCount: raw.caseCount, variantCount: raw.variantCount,
      generationErrors: raw.generationErrors.length, scanners: scannerResults };
  },
  buildReport(common: HoldoutLifecycleCommon, evaluated: CredentialHoldoutEvaluation): HoldoutReport {
    const { runId, planHash, independence, manifest, candidate } = common;
    return {
      schemaVersion: 1, reportType: 'holdout', runId, planHash, startedAt: evaluated.startedAt, finishedAt: evaluated.finishedAt,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence,
      status: evaluated.scanners.every(s => s.status === 'complete') && !evaluated.generationErrors ? 'complete' : 'incomplete',
      corpus: { id: manifest.id, revision: manifest.revision, purpose: manifest.purpose, corpusHash: manifest.corpusHash,
        seedHash: manifest.seedHash, lifecycle: 'sealed-at-execution' },
      candidate, caseCount: evaluated.caseCount, variantCount: evaluated.variantCount,
      generationErrors: evaluated.generationErrors, scanners: evaluated.scanners,
    };
  },
  validateReport: (report: HoldoutReport) => validateEvidence(report, 'holdout'),
};
