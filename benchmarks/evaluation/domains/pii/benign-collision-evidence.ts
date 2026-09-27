import Ajv from 'ajv';
import schema from '../../../../schemas/pii-benign-collision-evidence-v1.json';
import data from './benign-collision-evidence-v1.json';
import { hash } from '../../substrate/hash.ts';
import { PII_CONTROL_CLASSES } from './accounting.ts';
import { piiContextEvidence, type PiiContextEvidence } from './context-evidence.ts';
import { isPiiJurisdiction } from './jurisdictions.ts';
import {
  PII_VALIDATOR_CONSUMERS, PII_VALIDATOR_FAMILIES, PII_VALIDATOR_REGISTRATIONS,
  validatePiiValidatorConsumerMap, validatePiiValidatorRegistry,
  type PiiValidatorConsumerMap, type PiiValidatorFamilyDescriptor, type PiiValidatorRegistration,
} from './validator-qualification.ts';
import type { PiiIdentityDomain, PiiSensitivityExpectation } from './types.ts';

export type PiiBenignAccountingAxis = typeof PII_CONTROL_CLASSES[number];
export type PiiEvidenceClassId = 'reserved-documentation' | 'official-test' | 'public-operational' | 'ordinary-reference-account' |
  'near-miss' | 'placeholder' | 'context-negative' | 'cross-family-collision';
export type PiiEvidenceKind = 'benign' | 'mechanical-control' | 'collision';
export interface PiiEvidenceClass {
  id: PiiEvidenceClassId; kind: PiiEvidenceKind; accountingAxes: PiiBenignAccountingAxis[];
  qualifies: ('type-identity' | 'validator' | 'sensitivity' | 'family-discrimination' | 'jurisdiction-discrimination')[];
}
export interface PiiEvidenceValidatorExpectation { id: string; version: number; expected: 'valid' | 'invalid' | 'unavailable' }
export interface PiiCollisionParty { family: string; jurisdiction: string | null; validator: PiiEvidenceValidatorExpectation }
export interface PiiBenignCollisionEntry {
  id: string; caseId: string; evidenceClass: PiiEvidenceClassId; accountingAxis: PiiBenignAccountingAxis | null;
  family: string; jurisdiction: string | null; identityDomain: PiiIdentityDomain; language: string; candidateCommitment: string;
  typeExpectation: 'valid' | 'invalid'; sensitivityExpectation: PiiSensitivityExpectation;
  validator: PiiEvidenceValidatorExpectation | null; contextGroup: string | null;
  collision: null | { target: PiiCollisionParty; competitors: PiiCollisionParty[];
    expectedOutcomes: { family: 'correct' | 'wrong-family'; jurisdiction: 'correct' | 'wrong-jurisdiction'; sensitivity: PiiSensitivityExpectation } };
  provenance: { kind: 'authoritative'; sources: PiiEvidenceSource[] } |
    { kind: 'deterministic-synthetic'; sources: PiiEvidenceSource[]; generator: { id: string; version: number; seedCommitment: string } };
}
export interface PiiEvidenceSource { sourceKind: 'standard' | 'public-authority' | 'product-decision'; sourceId: string; locator: string; revision: string }
export interface PiiBenignCollisionEvidence {
  schemaVersion: 1; id: 'pii-benign-collision-v1'; version: 1; contentCommitment: string;
  accountingProfile: { id: 'pii-v1'; version: 1; benignAxes: PiiBenignAccountingAxis[] };
  reporting: { validatorCorrectness: 'evidence.validators'; familyDiscrimination: 'metrics.wrong-family-rate';
    jurisdictionDiscrimination: 'metrics.wrong-jurisdiction-rate'; sensitivity: ['metrics.sensitive-miss-rate', 'metrics.non-sensitive-flag-rate'] };
  classes: PiiEvidenceClass[]; entries: PiiBenignCollisionEntry[];
}

const expectedClasses: PiiEvidenceClass[] = [
  { id: 'reserved-documentation', kind: 'benign', accountingAxes: ['reserved', 'documentation'], qualifies: ['sensitivity'] },
  { id: 'official-test', kind: 'benign', accountingAxes: ['test-value'], qualifies: ['sensitivity'] },
  { id: 'public-operational', kind: 'benign', accountingAxes: ['public-operational'], qualifies: ['sensitivity'] },
  { id: 'ordinary-reference-account', kind: 'benign', accountingAxes: ['public-operational'], qualifies: ['sensitivity'] },
  { id: 'near-miss', kind: 'mechanical-control', accountingAxes: [], qualifies: ['type-identity', 'validator'] },
  { id: 'placeholder', kind: 'benign', accountingAxes: ['placeholder'], qualifies: ['sensitivity'] },
  { id: 'context-negative', kind: 'benign', accountingAxes: ['context-negative'], qualifies: ['sensitivity'] },
  { id: 'cross-family-collision', kind: 'collision', accountingAxes: [], qualifies: ['family-discrimination', 'jurisdiction-discrimination', 'sensitivity'] },
];
const canonicalContentCommitment = '06be9ad7a6fb0cfdefb84f9f5785dfb0ff823b6eaa96e86e2e928c1c11ceaf56';
const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
export const piiBenignCollisionProjection = (corpus: PiiBenignCollisionEvidence) => ({
  accountingProfile: corpus.accountingProfile, reporting: corpus.reporting, classes: corpus.classes, entries: corpus.entries,
});
export const piiBenignCollisionCommitment = (corpus: PiiBenignCollisionEvidence) => hash(JSON.stringify(canonicalize(piiBenignCollisionProjection(corpus))));
const validatorKey = (validator: { id: string; version: number }) => `${validator.id}@${validator.version}`;
const familyJurisdiction = (family: string) => family.split(':')[1] === 'global' ? null : family.split(':')[1].toUpperCase();

export function validatePiiBenignCollisionEvidence(value: unknown, options: {
  canonical?: boolean; registrations?: readonly PiiValidatorRegistration[]; consumerMap?: PiiValidatorConsumerMap;
  familyDescriptors?: readonly PiiValidatorFamilyDescriptor[]; contextEvidence?: PiiContextEvidence;
} = {}): PiiBenignCollisionEvidence {
  if (!validateSchema(value)) throw new Error('Invalid PII benign/collision evidence schema');
  const corpus = structuredClone(value as unknown as PiiBenignCollisionEvidence);
  if (piiBenignCollisionCommitment(corpus) !== corpus.contentCommitment) throw new Error('PII benign/collision evidence commitment mismatch');
  if (JSON.stringify(corpus.classes) !== JSON.stringify(expectedClasses) ||
      JSON.stringify(corpus.accountingProfile.benignAxes) !== JSON.stringify(PII_CONTROL_CLASSES))
    throw new Error('PII evidence class or accounting-axis mapping mismatch');
  if (options.canonical !== false && corpus.contentCommitment !== canonicalContentCommitment)
    throw new Error('Canonical PII benign/collision evidence commitment mismatch');
  const registrations = validatePiiValidatorRegistry(options.registrations ?? PII_VALIDATOR_REGISTRATIONS);
  const familyDescriptors = options.familyDescriptors ?? PII_VALIDATOR_FAMILIES;
  const consumerMap = validatePiiValidatorConsumerMap(options.consumerMap ?? PII_VALIDATOR_CONSUMERS, familyDescriptors);
  const contextEvidence = options.contextEvidence ?? piiContextEvidence;
  const registrationKeys = new Set(registrations.map(validatorKey));
  const descriptorMap = new Map(familyDescriptors.map(descriptor => [descriptor.family, descriptor]));
  const consumerKeys = new Set(consumerMap.mappings.flatMap(mapping => mapping.families.map(family => `${validatorKey(mapping.validator)}/${family}`)));
  const requireValidator = (validator: PiiEvidenceValidatorExpectation, family: string) => {
    if (!registrationKeys.has(validatorKey(validator)) || !consumerKeys.has(`${validatorKey(validator)}/${family}`))
      throw new Error('PII evidence references an unregistered validator/family identity');
  };
  if (new Set(corpus.entries.map(entry => entry.id)).size !== corpus.entries.length ||
      new Set(corpus.entries.map(entry => entry.caseId)).size !== corpus.entries.length) throw new Error('Duplicate PII evidence identity');
  const classes = new Map(corpus.classes.map(row => [row.id, row]));
  for (const entry of corpus.entries) {
    const evidenceClass = classes.get(entry.evidenceClass), descriptor = descriptorMap.get(entry.family);
    if (!evidenceClass || !descriptor || entry.jurisdiction !== familyJurisdiction(entry.family) ||
        (entry.jurisdiction !== null && !isPiiJurisdiction(entry.jurisdiction))) throw new Error('PII evidence family or jurisdiction identity mismatch');
    if ((entry.accountingAxis === null) !== (evidenceClass.accountingAxes.length === 0) ||
        (entry.accountingAxis !== null && !evidenceClass.accountingAxes.includes(entry.accountingAxis)))
      throw new Error('PII evidence accounting-axis mapping mismatch');
    if (entry.contextGroup !== null) {
      const group = contextEvidence.groups.find(candidate => candidate.id === entry.contextGroup);
      if (!group || group.language !== entry.language || group.identityDomain !== entry.identityDomain) throw new Error('PII evidence context identity mismatch');
    }
    if (entry.validator !== null) requireValidator(entry.validator, entry.family);
    if (entry.evidenceClass === 'near-miss') {
      if (entry.validator === null || entry.validator.expected !== 'invalid' || entry.typeExpectation !== 'invalid' ||
          entry.sensitivityExpectation !== 'not-established' || entry.collision !== null)
        throw new Error('PII near-miss evidence is validator/type-only');
      continue;
    }
    if (entry.evidenceClass === 'cross-family-collision') {
      const collision = entry.collision;
      if (!collision || entry.accountingAxis !== null || collision.target.family !== entry.family || collision.target.jurisdiction !== entry.jurisdiction ||
          collision.target.validator.expected !== 'valid' || JSON.stringify(entry.validator) !== JSON.stringify(collision.target.validator) ||
          collision.competitors.some(party => !['valid', 'invalid'].includes(party.validator.expected)) ||
          collision.expectedOutcomes.sensitivity !== entry.sensitivityExpectation)
        throw new Error('Invalid PII collision target identity');
      const parties = [collision.target, ...collision.competitors];
      if (new Set(parties.map(party => party.family)).size !== parties.length) throw new Error('Duplicate PII collision family');
      for (const party of parties) {
        if (!descriptorMap.has(party.family) || party.jurisdiction !== familyJurisdiction(party.family) ||
            (party.jurisdiction !== null && !isPiiJurisdiction(party.jurisdiction))) throw new Error('Invalid PII collision family/jurisdiction');
        requireValidator(party.validator, party.family);
      }
      continue;
    }
    if (entry.collision !== null || evidenceClass.kind !== 'benign' || entry.sensitivityExpectation !== 'non-sensitive')
      throw new Error('Invalid PII benign evidence semantics');
  }
  return corpus;
}

const deepFreeze = <T>(value: T): T => { if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; };
export const piiBenignCollisionEvidence = deepFreeze(validatePiiBenignCollisionEvidence(data));
export function piiBenignCollisionEntry(id: string) {
  const entry = piiBenignCollisionEvidence.entries.find(candidate => candidate.id === id);
  if (!entry) throw new Error('Unknown PII benign/collision evidence identity');
  return structuredClone(entry);
}
