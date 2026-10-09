import Ajv from 'ajv';
import schema from '../../../../schemas/pii-benign-collision-evidence-v1.json';
import data from './benign-collision-evidence-v1.json';
import { hash } from '../../substrate/hash.ts';
import type { PiiBenignAccountingClass, PiiBenignCollisionEvidenceClass } from './benign-collision-classes.ts';
import type { PiiAuthority, PiiIdentityDomain, PiiScope, PiiSensitivityExpectation } from './types.ts';

export type PiiEvidenceClassId = PiiBenignCollisionEvidenceClass;
export type PiiEvidenceKind = 'benign' | 'mechanical-control' | 'collision';
export interface PiiEvidenceClass {
  id: PiiEvidenceClassId; kind: PiiEvidenceKind; accountingClasses: PiiBenignAccountingClass[];
  qualifies: ('type-identity' | 'validator' | 'sensitivity' | 'family-discrimination' | 'jurisdiction-discrimination')[];
}
export interface PiiEvidenceValidatorIdentity { id: string; version: number }
export interface PiiEvidenceValidatorExpectation extends PiiEvidenceValidatorIdentity { expected: 'valid' | 'invalid' | 'unavailable' }
export interface PiiEvidenceFamilyDescriptor {
  family: string; displayName: string; identityDomain: PiiIdentityDomain; scope: PiiScope;
  validator: PiiEvidenceValidatorIdentity | null; authority: PiiAuthority[];
}
export interface PiiCollisionParty { family: string; scope: PiiScope; validator: PiiEvidenceValidatorExpectation }
export type PiiEvidenceFixture = { prefix: string; suffix: string; candidate:
  { kind: 'authoritative-reserved'; value: string } |
  { kind: 'deterministic-pattern'; generator: 'sha256-pattern'; seed: string; pattern: string } };
export interface PiiBenignCollisionEntry {
  id: string; caseId: string; evidenceClass: PiiEvidenceClassId; accountingClass: PiiBenignAccountingClass | null;
  family: string; scope: PiiScope; identityDomain: PiiIdentityDomain; language: string; candidateCommitment: string; fixture: PiiEvidenceFixture;
  typeExpectation: 'valid' | 'invalid'; sensitivityExpectation: PiiSensitivityExpectation;
  validator: PiiEvidenceValidatorExpectation | null; contextGroup: string | null;
  context: { obligation: 'none' | 'reinforcing' | 'required-for-sensitive-classification'; class: 'sensitive' | 'neutral' | 'non-sensitive' };
  collision: null | { target: PiiCollisionParty; competitors: PiiCollisionParty[];
    expectedOutcomes: { family: 'correct' | 'wrong-family'; jurisdiction: 'correct' | 'wrong-jurisdiction'; sensitivity: PiiSensitivityExpectation } };
  provenance: { kind: 'authoritative'; sources: PiiEvidenceSource[] } |
    { kind: 'deterministic-synthetic'; sources: PiiEvidenceSource[]; generator: { id: 'sha256-pattern'; version: 1; seedCommitment: string } };
}
export interface PiiEvidenceSource { sourceKind: 'standard' | 'public-authority' | 'product-decision'; sourceId: string; locator: string; revision: string }
export interface PiiBenignCollisionEvidence {
  schemaVersion: 1; id: 'pii-benign-collision-v1'; version: 1; contentCommitment: string;
  accountingProfile: { id: 'pii-v1'; version: 1; benignAxes: PiiBenignAccountingClass[] };
  reporting: { evidenceClasses: 'evidenceByClass'; validatorCorrectness: 'evidence.validators'; familyDiscrimination: 'metrics.wrong-family-rate';
    jurisdictionDiscrimination: 'metrics.wrong-jurisdiction-rate'; sensitivity: ['metrics.sensitive-miss-rate', 'metrics.non-sensitive-flag-rate'] };
  classes: PiiEvidenceClass[]; families: PiiEvidenceFamilyDescriptor[]; entries: PiiBenignCollisionEntry[];
}

const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
const deepFreeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
/** Only the immutable committed roster is read here. Candidate generation and validator observation stay in the oracle. */
function readCommittedEvidence(): PiiBenignCollisionEvidence {
  if (!validateSchema(data)) throw new Error('Invalid committed PII benign collision contract');
  const corpus = structuredClone(data) as unknown as PiiBenignCollisionEvidence;
  const projection = { accountingProfile: corpus.accountingProfile, reporting: corpus.reporting, classes: corpus.classes,
    families: corpus.families, entries: corpus.entries };
  const commitment = hash(JSON.stringify(canonicalize(projection)));
  if (commitment !== corpus.contentCommitment || commitment !== 'b9a2f3b24a734c39489095be5855701d64d7a775ac865a2c3d68e0c1efa25b18')
    throw new Error('Canonical PII benign collision contract commitment mismatch');
  return deepFreeze(corpus);
}
export const piiBenignCollisionEvidence = readCommittedEvidence();
