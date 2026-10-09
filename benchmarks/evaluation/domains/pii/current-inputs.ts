import Ajv from 'ajv';
import { createHash } from 'node:crypto';
import gapData from '../../../inputs/pii/gap-policy.json';
import correctionData from '../../../inputs/pii/fixture-corrections.json';
import indexData from '../../../inputs/pii/current-inputs-index.json';
import indexSchema from '../../../../schemas/pii-current-inputs-index-v1.json';
import gapSchema from '../../../../schemas/pii-gap-policy-v1.json';
import correctionSchema from '../../../../schemas/pii-fixture-corrections-v1.json';
import type { PiiGapLedger } from './gap-ledger.ts';

export interface PiiInputSource { commit: string; path: string; sha256: string; contentCommitment?: string }
interface Projection { schema: string; supportClaims: false; source: PiiInputSource; projectionCommitment: string }
export interface PiiGapPolicy extends Projection {
  finalCandidate: Pick<PiiGapLedger['finalCandidate'], 'status' | 'repository' | 'version' | 'tag' | 'sourceCommit' |
    'releaseManifest' | 'artifactInventorySha256' | 'conformanceIdentity' | 'artifacts'>;
  axisBacklog: Array<Omit<PiiGapLedger['axisBacklog'][number], 'detail'>>;
}
export interface PiiFixtureCorrections extends Projection {
  contract: { repository: string; commit: string; files: string[] };
  corrections: Array<{ family: string; caseId: string; reasonCode: string; contractBasis: string;
    frozen: { publicFinding: boolean; identity: string; sensitivity: string };
    corrected: { publicFinding: boolean; oracle: { identity: string; identityBasis: string[]; sensitivity: string; sensitivityBasis: string[] } } }>;
}
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
export const piiInputCommitment = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const ajv = new Ajv({ allErrors: true, strict: false });
const indexShape = ajv.compile<any>(indexSchema);
export function validatePiiCurrentInputIndex(value: any) {
  if (!indexShape(value) || new Set(value.inputs.map((row: any) => row.role)).size !== 4 ||
      value.inputs.some((row: any) => row.path !== `benchmarks/inputs/pii/${row.role}.json`))
    throw new Error('Invalid, missing or ambiguous current PII input role index');
  return structuredClone(value);
}
validatePiiCurrentInputIndex(indexData);
const gapShape = ajv.compile<PiiGapPolicy>(gapSchema), correctionShape = ajv.compile<PiiFixtureCorrections>(correctionSchema);

/** The original ledger locator remains part of frozen plan identities, not a filesystem dependency. */
export const PII_GAP_LEDGER_LOCATOR = 'evidence/901/pii-gap-ledger-v1.json';
export const PII_FIXTURE_CORRECTION_LOCATOR = 'evidence/901/426/pii-c3-reviewed-corrections-v1.json';

function bound(role: string, value: Projection) {
  const entries = indexData.inputs.filter(row => row.role === role);
  if (entries.length !== 1 || entries[0].path !== `benchmarks/inputs/pii/${role}.json`) throw new Error('Ambiguous or missing current PII input binding');
  const { projectionCommitment, ...projection } = value;
  if (piiInputCommitment(projection) !== projectionCommitment || projectionCommitment !== entries[0].projectionCommitment ||
      piiInputCommitment(value.source) !== piiInputCommitment(entries[0].source)) throw new Error('Current PII input source or projection binding mismatch');
}
export function validatePiiGapPolicy(value: unknown): PiiGapPolicy {
  if (!gapShape(value)) throw new Error('Invalid current PII gap policy schema');
  bound('gap-policy', value);
  const owner = (family: string) => ['pii:global:email', 'pii:global:network-address'].includes(family) ? '#424' :
    ['pii:global:payment-card', 'pii:global:iban'].includes(family) ? '#425' : '#426';
  if (new Set(value.axisBacklog.map(row => row.id)).size !== value.axisBacklog.length ||
      value.axisBacklog.some((row, i) => row.order !== i + 1 || row.owner !== owner(row.family)) ||
      value.finalCandidate.artifacts.some(row => row.digest.length !== (row.algorithm === 'sha1' ? 40 : 64)))
    throw new Error('Current PII gap policy identities or axis ownership mismatch');
  return structuredClone(value);
}
export function validatePiiFixtureCorrections(value: unknown): PiiFixtureCorrections {
  if (!correctionShape(value)) throw new Error('Invalid current PII fixture correction schema');
  bound('fixture-corrections', value);
  if (new Set(value.corrections.map(row => `${row.family}/${row.caseId}`)).size !== value.corrections.length)
    throw new Error('Duplicate current PII fixture correction');
  return structuredClone(value);
}
export const piiGapPolicy = validatePiiGapPolicy(gapData);
export const piiFixtureCorrections = validatePiiFixtureCorrections(correctionData);
