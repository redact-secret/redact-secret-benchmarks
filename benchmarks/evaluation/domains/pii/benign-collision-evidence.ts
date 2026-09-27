import Ajv from 'ajv';
import schema from '../../../../schemas/pii-benign-collision-evidence-v1.json';
import data from './benign-collision-evidence-v1.json';
import { hash } from '../../substrate/hash.ts';
import {
  PII_BENIGN_ACCOUNTING_CLASSES, PII_BENIGN_COLLISION_EVIDENCE_CLASSES, PII_EVIDENCE_ACCOUNTING_CLASSES,
  type PiiBenignAccountingClass, type PiiBenignCollisionEvidenceClass,
} from './benign-collision-classes.ts';
import { piiContextEvidence, type PiiContextEvidence } from './context-evidence.ts';
import { validatePiiAuthority, validatePiiCase } from './contract-model.ts';
import { isPiiJurisdiction } from './jurisdictions.ts';
import {
  PII_VALIDATOR_CONSUMERS, PII_VALIDATOR_REGISTRATIONS, validatePiiValidatorConsumerMap, validatePiiValidatorRegistry,
  type PiiValidatorConsumerMap, type PiiValidatorRegistration,
} from './validator-qualification.ts';
import type { PiiAuthority, PiiCase, PiiIdentityDomain, PiiScope, PiiSensitivityExpectation } from './types.ts';

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
export interface PiiBenignCollisionValidationOptions {
  canonical?: boolean; registrations?: readonly PiiValidatorRegistration[]; consumerMap?: PiiValidatorConsumerMap; contextEvidence?: PiiContextEvidence;
}

const expectedClasses: PiiEvidenceClass[] = PII_BENIGN_COLLISION_EVIDENCE_CLASSES.map(id => ({
  id,
  kind: id === 'near-miss' ? 'mechanical-control' : id === 'cross-family-collision' ? 'collision' : 'benign',
  accountingClasses: [...PII_EVIDENCE_ACCOUNTING_CLASSES[id]],
  qualifies: id === 'near-miss' ? ['type-identity', 'validator'] : id === 'cross-family-collision'
    ? ['family-discrimination', 'jurisdiction-discrimination', 'sensitivity'] : ['sensitivity'],
}));
const canonicalContentCommitment = 'f027c8a63b6356932e759bae52037a2862e331bcc37e578c19dbbf816e06eeff';
const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
export const piiBenignCollisionProjection = (corpus: PiiBenignCollisionEvidence) => ({
  accountingProfile: corpus.accountingProfile, reporting: corpus.reporting, classes: corpus.classes, families: corpus.families, entries: corpus.entries,
});
export const piiBenignCollisionCommitment = (corpus: PiiBenignCollisionEvidence) => hash(JSON.stringify(canonicalize(piiBenignCollisionProjection(corpus))));
const validatorKey = (validator: PiiEvidenceValidatorIdentity) => `${validator.id}@${validator.version}`;
const scopeJurisdiction = (scope: PiiScope) => scope === 'global' ? null : scope.slice('jurisdiction:'.length);
const familyScope = (family: string): PiiScope => family.split(':')[1] === 'global' ? 'global' : `jurisdiction:${family.split(':')[1].toUpperCase()}`;

export function materializePiiEvidenceCandidate(entry: PiiBenignCollisionEntry): string {
  const spec = entry.fixture.candidate;
  if (spec.kind === 'authoritative-reserved') return spec.value;
  let token = 0;
  return [...spec.pattern].map(character => {
    if (character !== 'D' && character !== 'A') return character;
    const value = Number.parseInt(hash(`${spec.seed}/${token++}`).slice(0, 8), 16);
    return character === 'D' ? String(value % 10) : String.fromCharCode(65 + (value % 26));
  }).join('');
}

export function validatePiiBenignCollisionEvidence(value: unknown,
  options: PiiBenignCollisionValidationOptions = {}): PiiBenignCollisionEvidence {
  if (!validateSchema(value)) throw new Error('Invalid PII benign/collision evidence schema');
  const corpus = structuredClone(value as unknown as PiiBenignCollisionEvidence);
  if (piiBenignCollisionCommitment(corpus) !== corpus.contentCommitment) throw new Error('PII benign/collision evidence commitment mismatch');
  if (JSON.stringify(corpus.classes) !== JSON.stringify(expectedClasses) ||
      JSON.stringify(corpus.accountingProfile.benignAxes) !== JSON.stringify(PII_BENIGN_ACCOUNTING_CLASSES))
    throw new Error('PII evidence class or accounting-class mapping mismatch');
  if (options.canonical !== false && corpus.contentCommitment !== canonicalContentCommitment)
    throw new Error('Canonical PII benign/collision evidence commitment mismatch');
  const registrations = validatePiiValidatorRegistry(options.registrations ?? PII_VALIDATOR_REGISTRATIONS);
  const qualificationDescriptors = corpus.families.map(({ family, validator }) => ({ family, validator }));
  const consumerMap = validatePiiValidatorConsumerMap(options.consumerMap ?? PII_VALIDATOR_CONSUMERS, qualificationDescriptors);
  const contextEvidence = options.contextEvidence ?? piiContextEvidence;
  const registrationKeys = new Set(registrations.map(validatorKey));
  const descriptorMap = new Map(corpus.families.map(descriptor => [descriptor.family, descriptor]));
  const consumerKeys = new Set(consumerMap.mappings.flatMap(mapping => mapping.families.map(family => `${validatorKey(mapping.validator)}/${family}`)));
  const requireValidator = (validator: PiiEvidenceValidatorExpectation, descriptor: PiiEvidenceFamilyDescriptor) => {
    if (!descriptor.validator || !registrationKeys.has(validatorKey(validator)) || validatorKey(descriptor.validator) !== validatorKey(validator) ||
        !consumerKeys.has(`${validatorKey(validator)}/${descriptor.family}`)) throw new Error('PII evidence references an unregistered validator/family identity');
  };
  if (new Set(corpus.families.map(row => row.family)).size !== corpus.families.length ||
      new Set(corpus.entries.map(entry => entry.id)).size !== corpus.entries.length ||
      new Set(corpus.entries.map(entry => entry.caseId)).size !== corpus.entries.length) throw new Error('Duplicate PII evidence identity');
  for (const descriptor of corpus.families) {
    if (!/^[A-Za-z0-9][A-Za-z0-9 ()/.+-]{0,79}$/.test(descriptor.displayName) || descriptor.scope !== familyScope(descriptor.family) ||
        (scopeJurisdiction(descriptor.scope) !== null && !isPiiJurisdiction(scopeJurisdiction(descriptor.scope)!)))
      throw new Error('PII evidence family descriptor scope mismatch');
    descriptor.authority.forEach(validatePiiAuthority);
  }
  const classes = new Map(corpus.classes.map(row => [row.id, row]));
  for (const entry of corpus.entries) {
    const evidenceClass = classes.get(entry.evidenceClass), descriptor = descriptorMap.get(entry.family);
    if (!evidenceClass || !descriptor || entry.scope !== descriptor.scope || entry.identityDomain !== descriptor.identityDomain)
      throw new Error('PII evidence family, scope, or identity-domain mismatch');
    if ((entry.accountingClass === null) !== (evidenceClass.accountingClasses.length === 0) ||
        (entry.accountingClass !== null && !evidenceClass.accountingClasses.includes(entry.accountingClass)))
      throw new Error('PII evidence accounting-class mapping mismatch');
    const candidate = materializePiiEvidenceCandidate(entry);
    if (hash(candidate) !== entry.candidateCommitment) throw new Error('PII evidence candidate commitment mismatch');
    if ((entry.fixture.candidate.kind === 'authoritative-reserved') !== (entry.provenance.kind === 'authoritative'))
      throw new Error('PII evidence fixture provenance mismatch');
    if (entry.fixture.candidate.kind === 'deterministic-pattern' &&
        (entry.provenance.kind !== 'deterministic-synthetic' || hash(entry.fixture.candidate.seed) !== entry.provenance.generator.seedCommitment))
      throw new Error('PII evidence generator provenance mismatch');
    if (entry.contextGroup !== null) {
      const group = contextEvidence.groups.find(candidateGroup => candidateGroup.id === entry.contextGroup);
      if (!group || group.language !== entry.language || group.identityDomain !== entry.identityDomain ||
          !group.frames.some(frame => frame.contextClass === entry.context.class && frame.sensitivity === entry.sensitivityExpectation))
        throw new Error('PII evidence context identity mismatch');
    }
    if (entry.validator !== null) requireValidator(entry.validator, descriptor);
    if (entry.evidenceClass === 'near-miss') {
      if (entry.validator === null || entry.validator.expected !== 'invalid' || entry.typeExpectation !== 'invalid' ||
          entry.sensitivityExpectation !== 'not-established' || entry.collision !== null || entry.accountingClass !== null)
        throw new Error('PII near-miss evidence is validator/type-only');
      continue;
    }
    if (entry.evidenceClass === 'cross-family-collision') {
      const collision = entry.collision;
      if (!collision || entry.accountingClass !== null || collision.target.family !== entry.family || collision.target.scope !== entry.scope ||
          collision.target.validator.expected !== 'valid' || JSON.stringify(entry.validator) !== JSON.stringify(collision.target.validator) ||
          !collision.competitors.some(party => party.validator.expected === 'valid') ||
          collision.expectedOutcomes.sensitivity !== entry.sensitivityExpectation)
        throw new Error('Invalid PII collision target identity');
      const parties = [collision.target, ...collision.competitors];
      if (new Set(parties.map(party => party.family)).size !== parties.length) throw new Error('Duplicate PII collision family');
      for (const party of parties) {
        const partyDescriptor = descriptorMap.get(party.family);
        if (!partyDescriptor || party.scope !== partyDescriptor.scope || partyDescriptor.identityDomain !== entry.identityDomain)
          throw new Error('PII collisions require registered families in one identity domain');
        requireValidator(party.validator, partyDescriptor);
      }
      continue;
    }
    if (entry.collision !== null || evidenceClass.kind !== 'benign' || entry.sensitivityExpectation !== 'non-sensitive')
      throw new Error('Invalid PII benign evidence semantics');
  }
  return corpus;
}

export function piiEvidenceEntryForCase(c: PiiCase, corpus: PiiBenignCollisionEvidence): PiiBenignCollisionEntry | null {
  if (c.metadata?.evidenceId === undefined) return null;
  const entry = corpus.entries.find(candidate => candidate.id === c.metadata!.evidenceId), descriptor = corpus.families.find(row => row.family === entry?.family);
  const candidate = Buffer.from(c.input.content).subarray(c.candidate.start, c.candidate.end).toString('utf8');
  const metadataKeys = ['accountingClass', 'contextGroup', 'evidenceClass', 'evidenceId', 'validatorExpectation', ...(entry?.collision ? ['collision'] : [])];
  if (!entry || !descriptor || Object.keys(c.metadata).sort().join(',') !== metadataKeys.sort().join(',') ||
      entry.caseId !== c.id || entry.family !== c.contract.family || descriptor.displayName !== c.contract.displayName ||
      JSON.stringify(descriptor.authority) !== JSON.stringify(c.contract.authority) || entry.scope !== c.contract.scope ||
      entry.identityDomain !== c.contract.identityDomain || entry.language !== c.contract.context.language ||
      entry.context.obligation !== c.contract.context.obligation || entry.context.class !== c.contract.context.class ||
      entry.typeExpectation !== c.contract.typeExpectation.state || entry.sensitivityExpectation !== c.contract.sensitivityExpectation ||
      (entry.validator?.id ?? null) !== c.contract.typeExpectation.validator || JSON.stringify(entry.validator) !== JSON.stringify(c.metadata.validatorExpectation) ||
      entry.evidenceClass !== c.metadata.evidenceClass || entry.accountingClass !== c.metadata.accountingClass ||
      entry.contextGroup !== c.metadata.contextGroup || JSON.stringify(entry.collision) !== JSON.stringify(c.metadata.collision ?? null) ||
      entry.candidateCommitment !== hash(candidate) || c.provenance.sourceHash !== corpus.contentCommitment)
    throw new Error('Invalid PII evidence case identity');
  return entry;
}

export function loadPiiBenignCollisionCases(value: unknown = piiBenignCollisionEvidence,
  options: PiiBenignCollisionValidationOptions = {}): PiiCase[] {
  const corpus = validatePiiBenignCollisionEvidence(value, options), families = new Map(corpus.families.map(row => [row.family, row]));
  return corpus.entries.map(entry => {
    const family = families.get(entry.family)!;
    const candidate = materializePiiEvidenceCandidate(entry), content = `${entry.fixture.prefix}${candidate}${entry.fixture.suffix}`;
    const method = entry.evidenceClass === 'near-miss' ? 'type-validation' :
      entry.evidenceClass === 'cross-family-collision' ? 'jurisdiction-collision' : 'pii-benign';
    const metadata = { evidenceId: entry.id, evidenceClass: entry.evidenceClass, accountingClass: entry.accountingClass,
      validatorExpectation: entry.validator, contextGroup: entry.contextGroup,
      ...(entry.collision === null ? {} : { collision: structuredClone(entry.collision) }) };
    const result: PiiCase = {
      id: entry.caseId, method, visibility: 'development', input: { id: entry.caseId, path: `pii/evidence/${entry.caseId}.txt`, content },
      candidate: { start: Buffer.byteLength(entry.fixture.prefix), end: Buffer.byteLength(entry.fixture.prefix) + Buffer.byteLength(candidate) },
      contract: { category: 'pii', family: entry.family, displayName: family.displayName, identityDomain: entry.identityDomain, scope: entry.scope,
        typeExpectation: { state: entry.typeExpectation, validator: entry.validator?.id ?? null }, sensitivityExpectation: entry.sensitivityExpectation,
        context: { ...entry.context, language: entry.language }, authority: structuredClone(family.authority), referenceEvidence: null,
        qualificationProfile: { id: 'pii-v1', version: 1 } },
      provenance: { source: 'pii-benign-collision-v1', sourceHash: corpus.contentCommitment, seed: `pii-benign-collision-v1/${entry.id}`,
        rationale: 'Authoritative reserved or deterministic synthetic PII evidence.', sources: entry.provenance.sources.map(source => source.locator) }, metadata,
    };
    return validatePiiCase(result);
  });
}

const deepFreeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
export const piiBenignCollisionEvidence = deepFreeze(validatePiiBenignCollisionEvidence(data));
