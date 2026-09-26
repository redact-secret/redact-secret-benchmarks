import type { Candidate, HoldoutManifest } from '../../../../holdout/types.ts';
import type { HoldoutDomainAdapter, HoldoutLifecycleCommon } from '../../../../holdout/lifecycle.ts';
import { HoldoutError } from '../../../../holdout/storage.ts';
import { hash } from '../../substrate/hash.ts';
import { validatePiiCase } from './contract-model.ts';
import { executePiiEvaluation } from './execution.ts';
import { createPiiMethods } from './methods/index.ts';
import { piiHoldoutStorage, validatePiiHoldoutCorpus } from './holdout-corpus.ts';
import { piiIdentity } from './identity.ts';
import type { PiiAssertionStatus, PiiScanner } from './types.ts';

type AxisCounts = Record<PiiAssertionStatus, number>;
interface AxisAggregate { typeIdentity: AxisCounts; sensitivityContext: AxisCounts }
interface PiiHoldoutScanner {
  id: string; version: string | null; configurationHash: string; configuration: Record<string, unknown>;
  status: 'complete' | 'unsupported' | 'unavailable' | 'error' | 'unstable'; axes: AxisAggregate; byStratum: Record<string, AxisAggregate>;
}
interface Evaluation { startedAt: string; finishedAt: string; caseCount: number; variantCount: number; generationErrors: number; scanners: PiiHoldoutScanner[] }
export interface PiiHoldoutReport {
  schemaVersion: 1; reportType: 'pii-holdout'; domain: 'pii'; evaluationProfile: string; domainAccountingVersion: string;
  reportProfile: { id: 'pii-holdout'; version: 1 }; supportClaims: false;
  runId: string; planHash: string; startedAt: string; finishedAt: string; status: 'complete' | 'incomplete';
  methodology: 'frozen-candidate-canonical-cases-aggregate-only'; independence: 'public-control' | 'custodian-declared';
  corpus: { id: string; revision: number; purpose: HoldoutManifest['purpose']; corpusHash: string; seedHash: string; lifecycle: 'sealed-at-execution' };
  candidate: Candidate; caseCount: number; variantCount: number; generationErrors: number; scanners: PiiHoldoutScanner[];
}

const counts = (): AxisCounts => ({ pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 });
const axes = (): AxisAggregate => ({ typeIdentity: counts(), sensitivityContext: counts() });
const unresolved = (row: AxisAggregate) => row.typeIdentity['review-required'] + row.typeIdentity['not-measured'] +
  row.sensitivityContext['review-required'] + row.sensitivityContext['not-measured'];
const countTotal = (row: AxisCounts) => Object.values(row).reduce((sum, value) => sum + value, 0);

export function validatePiiHoldoutReport(report: PiiHoldoutReport) {
  const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const exactKeys = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
  const validCounts = (value: AxisCounts) => value && Object.keys(value).sort().join(',') === 'fail,not-measured,pass,review-required' &&
    Object.values(value).every(count => Number.isInteger(count) && count >= 0);
  const validAxes = (value: AxisAggregate) => value && Object.keys(value).sort().join(',') === 'sensitivityContext,typeIdentity' &&
    validCounts(value.typeIdentity) && validCounts(value.sensitivityContext);
  const strataEqual = (scanner: PiiHoldoutScanner) => (['typeIdentity', 'sensitivityContext'] as const).every(axis =>
    (['pass', 'fail', 'review-required', 'not-measured'] as const).every(status =>
      Object.values(scanner.byStratum).reduce((sum, row) => sum + row[axis][status], 0) === scanner.axes[axis][status]));
  const safe = JSON.stringify(report);
  if (!report || !exactKeys(report, ['schemaVersion', 'reportType', 'domain', 'evaluationProfile', 'domainAccountingVersion', 'reportProfile',
      'supportClaims', 'runId', 'planHash', 'startedAt', 'finishedAt', 'status', 'methodology', 'independence', 'corpus', 'candidate',
      'caseCount', 'variantCount', 'generationErrors', 'scanners']) || report.schemaVersion !== 1 || report.reportType !== 'pii-holdout' || report.domain !== piiIdentity.domain ||
      report.evaluationProfile !== piiIdentity.evaluationProfile || report.domainAccountingVersion !== piiIdentity.domainAccountingVersion ||
      !exactKeys(report.reportProfile, ['id', 'version']) || report.reportProfile.id !== 'pii-holdout' || report.reportProfile.version !== 1 || report.supportClaims !== false ||
      report.methodology !== 'frozen-candidate-canonical-cases-aggregate-only' || !['public-control', 'custodian-declared'].includes(report.independence) ||
      !['complete', 'incomplete'].includes(report.status) || !Number.isInteger(report.caseCount) || report.caseCount < 1 ||
      !Number.isInteger(report.variantCount) || report.variantCount < 1 || !Number.isInteger(report.generationErrors) || report.generationErrors < 0 ||
      !Array.isArray(report.scanners) || !report.scanners.length || !/^[a-f0-9-]{36}$/.test(report.runId) || !digest(report.planHash) ||
      !exactKeys(report.corpus, ['id', 'revision', 'purpose', 'corpusHash', 'seedHash', 'lifecycle']) || !digest(report.corpus.corpusHash) ||
      !digest(report.corpus?.seedHash) || ![report.candidate?.sourceHash, report.candidate?.lockHash, report.candidate?.candidateArtifactHash].every(digest) ||
      !exactKeys(report.candidate, ['sourceHash', 'lockHash', 'candidateArtifactHash']) || !Number.isFinite(Date.parse(report.startedAt)) ||
      !Number.isFinite(Date.parse(report.finishedAt)) || Date.parse(report.finishedAt) < Date.parse(report.startedAt) ||
      report.scanners.some(scanner => !exactKeys(scanner, ['id', 'version', 'configurationHash', 'configuration', 'status', 'axes', 'byStratum']) ||
        !/^[a-z][a-z0-9.-]+$/.test(scanner.id) || !digest(scanner.configurationHash) || !validAxes(scanner.axes) || !strataEqual(scanner) ||
        Object.values(scanner.byStratum).some(row => !validAxes(row)) ||
        (scanner.status === 'complete' && (countTotal(scanner.axes.typeIdentity) !== report.variantCount || countTotal(scanner.axes.sensitivityContext) !== report.variantCount))) ||
      (report.status === 'complete') !== (report.generationErrors === 0 && report.scanners.every(scanner => scanner.status === 'complete' && !unresolved(scanner.axes))) ||
      /SYNTHETIC-PERSON-ID|"content"|"candidateRange"|"start"|"end"|"fixtureHash"|"contentHash"|"seed"/.test(safe))
    throw new Error('Invalid PII holdout aggregate');
  return report;
}

export const piiHoldoutDomain: HoldoutDomainAdapter<PiiScanner, ReturnType<typeof validatePiiHoldoutCorpus>, Evaluation, PiiHoldoutReport> = {
  identity: { domain: piiIdentity.domain, evaluationProfile: piiIdentity.evaluationProfile, domainAccountingVersion: piiIdentity.domainAccountingVersion },
  holdoutMethod: { id: 'pii-holdout', version: 1 }, reportContract: { id: 'pii-holdout-v1', version: 1 },
  publicConformanceCorpus(seed) {
    const fixture = structuredClone(validatePiiCase({
      id: 'pii-public-control', method: 'schema-only', visibility: 'holdout',
      input: { id: 'pii-public-control', path: 'pii/public-control.txt', content: 'subject_id=SYNTHETIC-PERSON-ID-001' }, candidate: { start: 11, end: 34 },
      contract: { category: 'personal-identifier', family: 'synthetic-person-id', scope: { kind: 'global' },
        typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'unresolved',
        context: { obligation: 'required', class: 'neutral', language: 'en' },
        authority: { kind: 'official-test-source', locator: 'benchmark:public-control', version: '1', claim: 'test-vector', observedAt: '2026-09-26' },
        referenceEvidence: null, qualificationProfile: { id: 'pii-v1', version: 1 } },
      provenance: { source: 'pii-public-control', sourceHash: hash({ seed, source: 'pii-public-control' }), seed,
        rationale: 'Synthetic public lifecycle control.', sources: ['benchmark:public-control'] },
    }));
    return validatePiiHoldoutCorpus({ schemaVersion: 1, seed, fixtures: [fixture] });
  },
  validateCorpus: validatePiiHoldoutCorpus, serializeCorpus: piiHoldoutStorage.serializeCorpus,
  resolveManifestEvaluation(manifest) {
    if (!manifest.evaluation) throw new HoldoutError('manifest-evaluation-missing');
    return manifest.evaluation;
  },
  async evaluate({ corpus, scanners, runId, directory, planHash, toolPlan, candidate, verifyCandidate }) {
    const raw = await executePiiEvaluation({ cases: corpus.fixtures, methods: createPiiMethods(), scanners, runId, scratchParent: directory,
      provenance: { planHash } });
    const candidateStable = hash(await verifyCandidate()) === hash(candidate);
    const scannerResults = raw.scanners.map(scanner => {
      const expected = toolPlan.find(tool => tool.id === scanner.id)!;
      const status = scanner.status === 'complete' && (!candidateStable || scanner.version !== expected.version || scanner.configurationHash !== expected.configurationHash)
        ? 'error' as const : scanner.status;
      const aggregate = axes(), byStratum: Record<string, AxisAggregate> = {};
      if (status === 'complete') for (const result of raw.results) for (const outcome of result.outcomes.filter(row => row.scanner === scanner.id)) {
        const bucket = byStratum[`${result.category}:${result.family}`] ??= axes();
        aggregate.typeIdentity[outcome.typeIdentity.status]++; bucket.typeIdentity[outcome.typeIdentity.status]++;
        aggregate.sensitivityContext[outcome.sensitivityContext.status]++; bucket.sensitivityContext[outcome.sensitivityContext.status]++;
      }
      return { id: scanner.id, version: scanner.version, configuration: expected.configuration,
        configurationHash: expected.configurationHash, status, axes: aggregate, byStratum };
    });
    return { startedAt: raw.startedAt, finishedAt: raw.finishedAt, caseCount: raw.caseCount, variantCount: raw.variantCount,
      generationErrors: raw.generationErrors.length, scanners: scannerResults };
  },
  buildReport(common: HoldoutLifecycleCommon, evaluated: Evaluation): PiiHoldoutReport {
    const { runId, planHash, independence, manifest, candidate } = common;
    return { schemaVersion: 1, reportType: 'pii-holdout', domain: 'pii', evaluationProfile: piiIdentity.evaluationProfile,
      domainAccountingVersion: piiIdentity.domainAccountingVersion, reportProfile: { id: 'pii-holdout', version: 1 }, supportClaims: false,
      runId, planHash, startedAt: evaluated.startedAt, finishedAt: evaluated.finishedAt,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence,
      status: evaluated.generationErrors === 0 && evaluated.scanners.every(scanner => scanner.status === 'complete' && !unresolved(scanner.axes)) ? 'complete' : 'incomplete',
      corpus: { id: manifest.id, revision: manifest.revision, purpose: manifest.purpose, corpusHash: manifest.corpusHash,
        seedHash: manifest.seedHash, lifecycle: 'sealed-at-execution' }, candidate, caseCount: evaluated.caseCount,
      variantCount: evaluated.variantCount, generationErrors: evaluated.generationErrors, scanners: evaluated.scanners };
  },
  validateReport: validatePiiHoldoutReport,
};
