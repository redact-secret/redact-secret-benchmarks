import type { Scanner, EvaluationCase } from '../../model/types.ts';
import type { Candidate, HoldoutManifest } from '../../../../holdout/types.ts';
import type { Fixture, Finding, Outcome } from '../../../types.ts';
import type { HoldoutDomainAdapter, HoldoutLifecycleCommon } from '../../../../holdout/lifecycle.ts';
import { executeEvaluation } from '../credential/execution.ts';
import { createHoldoutMethods, createHoldoutOperators } from '../credential/holdout-method.ts';
import { normalizeFinding } from '../credential/normalization.ts';
import { scoreRow } from '../../../scoring/lattice.ts';
import { hash } from '../../substrate/hash.ts';
import { buildCorpora } from '../../../../fixtures/generated/build.mjs';
import Ajv from 'ajv';
import reportSchema from '../../../../schemas/credential-policy-holdout-report-v1.json';
import { credentialPolicyIdentity } from './identity.ts';
import { credentialPolicyHoldoutStorage, credentialPolicyManifestEvaluation, validateCredentialPolicyHoldoutCorpus } from './holdout-corpus.ts';

const families = ['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token'] as const;
type Family = typeof families[number];
type Counts = { cases: number; positives: number; benign: number; twins: number; spans: number; exact: number; covered: number; overbroad: number; partial: number; miss: number; collateralBytes: number; actionMismatches: number; blockFindings: number; failures: number };
const counts = (): Counts => ({ cases: 0, positives: 0, benign: 0, twins: 0, spans: 0, exact: 0, covered: 0, overbroad: 0, partial: 0, miss: 0, collateralBytes: 0, actionMismatches: 0, blockFindings: 0, failures: 0 });
export interface CredentialPolicyHoldoutReport {
  schemaVersion: 1; reportType: 'credential-policy-holdout'; domain: 'credential-policy'; evaluationProfile: 'credential-policy-v1'; domainAccountingVersion: 'credential-policy-v1';
  reportProfile: { id: 'credential-policy-holdout'; version: 1 }; supportClaims: false; runId: string; planHash: string; startedAt: string; finishedAt: string;
  status: 'complete' | 'incomplete'; methodology: 'frozen-candidate-canonical-cases-aggregate-only'; independence: 'public-control' | 'custodian-declared';
  corpus: { id: string; revision: number; purpose: 'public-conformance' | 'protected'; corpusHash: string; seedHash: string; lifecycle: 'sealed-at-execution' };
  candidate: Candidate; caseCount: number; variantCount: number; generationErrors: number;
  scanners: { id: string; version: string | null; configuration: Record<string, unknown>; configurationHash: string; status: string }[];
  families: Record<Family, Counts>;
}

function publicCorpus(seed: string) {
  const fixtures = (buildCorpora()['policy-qualified-credentials'].fixtures as Fixture[])
    .filter(fixture => fixture.policyConformance && fixture.policyFamily)
    .map(fixture => ({ ...structuredClone(fixture), id: `${seed.slice(0, 8)}-${fixture.id}`,
      ...(fixture.twinOf ? { twinOf: `${seed.slice(0, 8)}-${fixture.twinOf}` } : {}) }));
  return validateCredentialPolicyHoldoutCorpus({ schemaVersion: 2, seed, fixtures });
}

type Evaluation = { startedAt: string; finishedAt: string; caseCount: number; variantCount: number; generationErrors: number; scanners: CredentialPolicyHoldoutReport['scanners']; families: Record<Family, Counts> };
export const credentialPolicyHoldoutDomain: HoldoutDomainAdapter<Scanner, ReturnType<typeof validateCredentialPolicyHoldoutCorpus>, Evaluation, CredentialPolicyHoldoutReport> = {
  identity: { domain: credentialPolicyIdentity.domain, evaluationProfile: credentialPolicyIdentity.evaluationProfiles.evaluation, domainAccountingVersion: credentialPolicyIdentity.domainAccountingVersion },
  holdoutMethod: { id: 'credential-policy-holdout', version: 1 }, reportContract: { id: 'credential-policy-holdout', version: 1 },
  publicConformanceCorpus: publicCorpus, validateCorpus: validateCredentialPolicyHoldoutCorpus,
  serializeCorpus: credentialPolicyHoldoutStorage.serializeCorpus,
  resolveManifestEvaluation: manifest => manifest.evaluation ?? credentialPolicyManifestEvaluation,
  async evaluate({ corpus, manifest, scanners, runId, directory, planHash, toolPlan, candidate, verifyCandidate }) {
    const cases: EvaluationCase[] = corpus.fixtures.map((fixture, index) => ({ id: `policy-holdout-${index}`, method: 'holdout', visibility: 'holdout', seed: fixture,
      targets: [fixture.policyFamily!], operators: [], source: { category: 'credential-policy-holdout', fixtureId: fixture.id, path: 'protected' },
      provenance: { source: 'credential-policy-holdout', sourceHash: manifest.corpusHash, rationale: fixture.assessment.reason, seed: corpus.seed, reviewStatus: manifest.review, sources: fixture.assessment.sources } }));
    const raw = await executeEvaluation({ cases, methods: createHoldoutMethods(), operators: createHoldoutOperators(), scanners, runId,
      scratchParent: directory, provenance: { planHash }, normalizeFinding });
    const candidateStable = hash(await verifyCandidate()) === hash(candidate);
    const scannerSummary = raw.scanners.map(scanner => { const expected = toolPlan.find(tool => tool.id === scanner.id)!;
      return { id: scanner.id, version: scanner.version, configuration: expected.configuration, configurationHash: expected.configurationHash,
        status: scanner.status === 'complete' && (!candidateStable || scanner.version !== expected.version || scanner.configurationHash !== expected.configurationHash) ? 'error' : scanner.status }; });
    const aggregate = Object.fromEntries(families.map(family => [family, counts()])) as Record<Family, Counts>;
    const byId = new Map(cases.map((entry, index) => [entry.id, corpus.fixtures[index]]));
    for (const result of raw.results) {
      const fixture = byId.get(result.id)!, family = fixture.policyFamily!, row = aggregate[family], positive = fixture.expected.length > 0;
      row.cases++; positive ? row.positives++ : fixture.twinOf ? row.twins++ : row.benign++;
      const scanner = result.scanners.find(entry => entry.scanner === 'redact-secret');
      if (!scanner || scanner.status !== 'complete') { row.failures++; continue; }
      const actual = (scanner.variants[0]?.row.actual as Finding[]).filter(finding => finding.family === family);
      row.blockFindings += actual.filter(finding => finding.action === 'block').length;
      if (positive) {
        const scored = scoreRow(fixture.expected, actual, family);
        row.collateralBytes += scored.collateralBytes ?? 0;
        for (const outcome of scored.spanOutcomes ?? []) { row.spans++; row[outcome.toLowerCase() as Lowercase<Outcome>]++; }
        if (actual.length === 0 || actual.some(finding => finding.action !== fixture.expectedAction)) row.actionMismatches++;
        if ((scored.spanOutcomes ?? []).some(outcome => outcome !== 'EXACT') || scored.collateralBytes || actual.some(finding => finding.action !== fixture.expectedAction)) row.failures++;
      } else if (actual.length) row.failures++;
    }
    return { startedAt: raw.startedAt, finishedAt: raw.finishedAt, caseCount: raw.caseCount, variantCount: raw.variantCount,
      generationErrors: raw.generationErrors.length, scanners: scannerSummary, families: aggregate };
  },
  buildReport(common: HoldoutLifecycleCommon, evaluated: Evaluation) {
    const complete = !evaluated.generationErrors && evaluated.scanners.every(scanner => scanner.status === 'complete');
    return { schemaVersion: 1, reportType: 'credential-policy-holdout', domain: 'credential-policy', evaluationProfile: 'credential-policy-v1', domainAccountingVersion: 'credential-policy-v1',
      reportProfile: { id: 'credential-policy-holdout', version: 1 }, supportClaims: false, runId: common.runId, planHash: common.planHash,
      startedAt: evaluated.startedAt, finishedAt: evaluated.finishedAt, status: complete ? 'complete' : 'incomplete', methodology: 'frozen-candidate-canonical-cases-aggregate-only',
      independence: common.independence, corpus: { id: common.manifest.id, revision: common.manifest.revision, purpose: common.manifest.purpose,
        corpusHash: common.manifest.corpusHash, seedHash: common.manifest.seedHash, lifecycle: 'sealed-at-execution' }, candidate: common.candidate,
      caseCount: evaluated.caseCount, variantCount: evaluated.variantCount, generationErrors: evaluated.generationErrors, scanners: evaluated.scanners, families: evaluated.families };
  },
  validateReport: report => validateCredentialPolicyHoldoutReport(report),
};

export function validateCredentialPolicyHoldoutReport(report: CredentialPolicyHoldoutReport) {
  const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
  const safe = JSON.stringify(report);
  const schemaValid = new Ajv({ strict: true }).compile(reportSchema)(report);
  if (!report || !schemaValid || !exact(report, ['schemaVersion', 'reportType', 'domain', 'evaluationProfile', 'domainAccountingVersion', 'reportProfile', 'supportClaims',
      'runId', 'planHash', 'startedAt', 'finishedAt', 'status', 'methodology', 'independence', 'corpus', 'candidate', 'caseCount', 'variantCount', 'generationErrors', 'scanners', 'families']) ||
      !exact(report.corpus, ['id', 'revision', 'purpose', 'corpusHash', 'seedHash', 'lifecycle']) ||
      !exact(report.candidate, ['sourceHash', 'lockHash', 'candidateArtifactHash']) ||
      report.scanners.some(scanner => !exact(scanner, ['id', 'version', 'configuration', 'configurationHash', 'status']) || hash(scanner.configuration) !== scanner.configurationHash) ||
      report.reportType !== 'credential-policy-holdout' || report.domain !== 'credential-policy' || report.evaluationProfile !== 'credential-policy-v1' ||
      report.domainAccountingVersion !== 'credential-policy-v1' || report.reportProfile?.id !== 'credential-policy-holdout' || report.reportProfile.version !== 1 ||
      report.supportClaims !== false || !digest(report.planHash) || ![report.candidate?.sourceHash, report.candidate?.lockHash, report.candidate?.candidateArtifactHash].every(digest) ||
      !digest(report.corpus?.corpusHash) || !digest(report.corpus?.seedHash) || report.caseCount !== report.variantCount ||
      !/^[a-f0-9-]{36}$/.test(report.runId) || !Number.isFinite(Date.parse(report.startedAt)) || Date.parse(report.finishedAt) < Date.parse(report.startedAt) ||
      !['public-conformance', 'protected'].includes(report.corpus.purpose) ||
      ((report.corpus.purpose === 'public-conformance') !== (report.independence === 'public-control')) ||
      Object.keys(report.families ?? {}).sort().join(',') !== [...families].sort().join(',') ||
      Object.values(report.families).some(row => row.cases !== row.positives + row.benign + row.twins || row.spans !== row.exact + row.covered + row.overbroad + row.partial + row.miss ||
        row.positives < 1 || row.benign < 1 || row.twins < 1 || Object.values(row).some(value => !Number.isInteger(value) || value < 0)) ||
      (report.status === 'complete') !== (report.generationErrors === 0 && report.scanners.every(scanner => scanner.status === 'complete')) ||
      /"content"|"expected"|"start"|"end"|"seed"|"expectedAction"|"twinOf"/.test(safe)) throw new Error('Invalid credential-policy holdout aggregate');
  const plan = { runId: report.runId, candidate: report.candidate,
    tools: report.scanners.map(scanner => ({ id: scanner.id, version: scanner.version, configuration: scanner.configuration, configurationHash: scanner.configurationHash })),
    corpusHash: report.corpus.corpusHash, revision: report.corpus.revision,
    holdoutMethod: { id: 'credential-policy-holdout', version: 1 }, reportContract: { id: 'credential-policy-holdout', version: 1 },
    evaluation: { domain: 'credential-policy', evaluationProfile: 'credential-policy-v1', domainAccountingVersion: 'credential-policy-v1' } };
  if (hash(plan) !== report.planHash) throw new Error('Invalid credential-policy holdout aggregate');
  return report;
}
