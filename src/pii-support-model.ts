import Ajv from 'ajv';
import schema from '../schemas/pii-support-matrix-v2.json';
import { piiSupportRegistryProjection, piiSupportSemanticProblem } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';

export type PiiSupportStatus = 'pending' | 'provisional' | 'stable' | 'unsupported';
export interface PiiSupportMatrixFile {
  schemaVersion: 2; reportType: 'pii-support-matrix'; supportClaims: false; domain: 'pii'; evaluationProfile: 'pii-v1';
  domainAccountingVersion: 'pii-v1'; qualificationProfile: { id: 'pii-v1'; version: 1 }; registryCommitment: string;
  activationContract: { repository: string; decision: string; mergeCommit: string; productArtifact: 'not-measured' | 'trusted' };
  populationReports: { id: string; status: string; contractCommitment: string; corpusCommitment: string; reportCommitment: string }[];
  populationComparisons: Array<{ id: string; status: 'not-measured' | 'compared'; verdict: 'not-measured' | 'no-regression' | 'regression';
    benignFalseAlarmDeltas: Array<{ family: string; scope: string; contextClass: string; evidenceClass: string; delta: number | null; regressed: boolean }>;
    diagnosticDeltas: Array<{ axis: string; delta: number | null; baselineFailed: number; candidateFailed: number; failedDelta: number; regressed: boolean }> }>;
  distribution: Record<PiiSupportStatus, number>;
  families: Array<{ family: string; displayName: string; identityDomain: string; familyContractVersion: number; scope: string; jurisdiction: string | null;
    qualificationProfile: { id: 'pii-v1'; version: 1 }; authority: unknown[]; contextObligation: string; validatorApplicable: boolean;
    activation: { state: string; selector: string; activationIdentity: string | null; productArtifactCommitment: string | null };
    status: { state: PiiSupportStatus; profile: { id: 'pii-v1'; version: 1 }; reasonCodes: string[] };
    populationEvidence: unknown[]; qualificationArtifactCommitment: string | null }>;
  artifactCommitment: string;
}

const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');
export async function piiSupportMatrixProblem(value: unknown, expectedCommitment?: string): Promise<string | null> {
  if (!validateSchema(value)) return 'Invalid PII support-matrix v2 contract';
  const matrix = value as unknown as PiiSupportMatrixFile;
  const { artifactCommitment: _artifactCommitment, ...projection } = matrix;
  if (matrix.artifactCommitment !== await sha256(JSON.stringify(canonical(projection)))) return 'PII support artifact commitment is invalid';
  const registryCommitment = await sha256(JSON.stringify(canonical(piiSupportRegistryProjection(matrix))));
  if (registryCommitment !== matrix.registryCommitment) return 'PII support registry commitment is invalid';
  if (expectedCommitment && matrix.artifactCommitment !== expectedCommitment) return 'PII support artifact does not match the domain index';
  if (new Set(matrix.families.map(row => row.family)).size !== matrix.families.length) return 'PII support matrix repeats a family';
  const semanticProblem = piiSupportSemanticProblem(matrix);
  if (semanticProblem) return semanticProblem;
  for (const state of ['pending', 'provisional', 'stable', 'unsupported'] as const)
    if (matrix.distribution[state] !== matrix.families.filter(row => row.status.state === state).length) return 'PII support distribution does not recount';
  if (/RAW-CANARY|SYNTHETIC-PERSON-ID|"(?:content|candidate|seed|fixture|path|raw|caseId|variant)"/i.test(JSON.stringify(matrix)))
    return 'PII support artifact carries unsafe detail';
  return null;
}
