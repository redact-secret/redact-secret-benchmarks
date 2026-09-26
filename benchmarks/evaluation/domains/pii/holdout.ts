import type { Candidate, Counts, HoldoutManifest, HoldoutReport } from '../../../../holdout/types.ts';
import type { HoldoutDomainAdapter, HoldoutLifecycleCommon } from '../../../../holdout/lifecycle.ts';
import { hash } from '../../substrate/hash.ts';
import { validatePiiCase } from './contract-model.ts';
import { executePiiEvaluation } from './execution.ts';
import { createPiiMethods } from './methods/index.ts';
import { piiHoldoutStorage, piiManifestEvaluation, validatePiiHoldoutCorpus } from './holdout-corpus.ts';
import { piiIdentity } from './identity.ts';
import type { PiiScanner } from './types.ts';

const counts = (): Counts => ({ pass: 0, fail: 0, 'review-required': 0 });
type Evaluation = Pick<HoldoutReport, 'startedAt' | 'finishedAt' | 'caseCount' | 'variantCount' | 'generationErrors' | 'scanners'>;

export const piiHoldoutDomain: HoldoutDomainAdapter<PiiScanner, ReturnType<typeof validatePiiHoldoutCorpus>, Evaluation, HoldoutReport> = {
  identity: { domain: piiIdentity.domain, evaluationProfile: piiIdentity.evaluationProfile, domainAccountingVersion: piiIdentity.domainAccountingVersion },
  holdoutMethod: { id: 'pii-holdout', version: 1 }, reportContract: { id: 'pii-holdout-v1', version: 1 },
  publicConformanceCorpus(seed) {
    const fixture = structuredClone(validatePiiCase({
      id: 'pii-public-control', method: 'schema-only', visibility: 'holdout',
      input: { id: 'pii-public-control', path: 'pii/public-control.txt', content: 'subject_id=SYNTHETIC-PERSON-ID-001' },
      candidate: { start: 11, end: 34 },
      contract: { category: 'personal-identifier', family: 'synthetic-person-id', scope: { kind: 'global' },
        typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'unresolved',
        context: { obligation: 'required', class: 'neutral', language: 'en' },
        authority: { kind: 'official-test-source', reference: 'benchmark:public-control', observedAt: '2026-09-26' },
        referenceEvidence: null, qualificationProfile: { id: 'pii-v1', version: 1 } },
      provenance: { source: 'pii-public-control', sourceHash: hash({ seed, source: 'pii-public-control' }), seed,
        rationale: 'Synthetic public lifecycle control.', sources: ['benchmark:public-control'] },
    }));
    return validatePiiHoldoutCorpus({ schemaVersion: 1, seed, fixtures: [fixture] });
  },
  validateCorpus: validatePiiHoldoutCorpus, serializeCorpus: piiHoldoutStorage.serializeCorpus,
  resolveManifestEvaluation: manifest => manifest.evaluation ?? piiManifestEvaluation,
  async evaluate({ corpus, scanners, runId, directory, planHash, toolPlan, candidate, verifyCandidate }) {
    const raw = await executePiiEvaluation({ cases: corpus.fixtures, methods: createPiiMethods(), scanners, runId, scratchParent: directory,
      provenance: { planHash } });
    const candidateStable = hash(await verifyCandidate()) === hash(candidate);
    const scannerResults = raw.scanners.map(scanner => {
      const expected = toolPlan.find(tool => tool.id === scanner.id)!;
      const status = scanner.status === 'complete' && (!candidateStable || scanner.version !== expected.version || scanner.configurationHash !== expected.configurationHash)
        ? 'error' as const : scanner.status;
      const assertions = counts(), byStratum: Record<string, Counts> = {};
      if (status === 'complete') for (const result of raw.results) for (const outcome of result.outcomes.filter(row => row.scanner === scanner.id)) {
        const bucket = byStratum[`${result.category}:${result.family}`] ??= counts();
        for (const axis of [outcome.typeIdentity, outcome.sensitivityContext]) {
          if (axis.status === 'not-measured') throw new Error('holdout-not-measured');
          bucket[axis.status]++; assertions[axis.status]++;
        }
      }
      return { id: scanner.id, version: scanner.version, configuration: expected.configuration,
        configurationHash: expected.configurationHash, status, assertions, byStratum };
    });
    return { startedAt: raw.startedAt, finishedAt: raw.finishedAt, caseCount: raw.caseCount, variantCount: raw.variantCount,
      generationErrors: raw.generationErrors.length, scanners: scannerResults };
  },
  buildReport(common: HoldoutLifecycleCommon, evaluated: Evaluation): HoldoutReport {
    const { runId, planHash, independence, manifest, candidate } = common;
    return { schemaVersion: 1, reportType: 'holdout', runId, planHash, startedAt: evaluated.startedAt, finishedAt: evaluated.finishedAt,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence,
      status: evaluated.scanners.every(s => s.status === 'complete') && !evaluated.generationErrors ? 'complete' : 'incomplete',
      corpus: { id: manifest.id, revision: manifest.revision, purpose: manifest.purpose, corpusHash: manifest.corpusHash,
        seedHash: manifest.seedHash, lifecycle: 'sealed-at-execution' }, candidate, caseCount: evaluated.caseCount,
      variantCount: evaluated.variantCount, generationErrors: evaluated.generationErrors, scanners: evaluated.scanners };
  },
  validateReport(report) {
    if (report.schemaVersion !== 1 || report.reportType !== 'holdout' || report.methodology !== 'frozen-candidate-canonical-cases-aggregate-only' ||
        !Array.isArray(report.scanners) || JSON.stringify(report).includes('SYNTHETIC-PERSON-ID')) throw new Error('Invalid PII holdout aggregate');
  },
};
