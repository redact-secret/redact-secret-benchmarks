import Ajv from 'ajv';
import observationSchema from '../../../../schemas/pii-validator-observation-v1.json';
import qualificationSchema from '../../../../schemas/pii-validator-qualification-v1.json';
import { hash } from '../../substrate/hash.ts';

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export const PII_VALIDATOR_PRODUCT_CONTRACT = deepFreeze({
  repository: 'redact-secret/redact-secret',
  mergeCommit: '266204c87126a9de2c0ff28e7913bccabebd1d98',
  decision: 'decision-define-the-bounded-built-in-structured-validator-registry',
  conformanceSurface: 'crate-private-pending' as const,
});

export const PII_VALIDATOR_PRIMITIVE_CLASSES = Object.freeze([
  'luhn', 'mod-97', 'weighted-mod-10', 'weighted-mod-11', 'iso-7064', 'verhoeff', 'bounded-parser-classifier',
] as const);
export type PiiValidatorPrimitiveClass = typeof PII_VALIDATOR_PRIMITIVE_CLASSES[number];
export type PiiValidatorOutcome = 'valid' | 'candidate-too-long' | 'malformed' | 'checksum-mismatch' | 'unknown-validator' | 'unavailable';
export type PiiValidatorVectorClass = 'positive' | 'mechanical-invalid' | 'boundary' | 'maximum-length';
export type PiiValidatorTarget = 'native' | 'wasm';

interface ValidatorVector {
  id: string;
  class: PiiValidatorVectorClass;
  candidate: string;
  expected: Exclude<PiiValidatorOutcome, 'unknown-validator' | 'unavailable'>;
}

export interface PiiValidatorRegistration {
  id: string;
  version: number;
  primitiveClass: PiiValidatorPrimitiveClass;
  maxCandidateBytes: number;
  normativeSources: { sourceKind: 'standard' | 'patent' | 'product-decision'; sourceId: string; locator: string; revision: string; claim: 'algorithm' | 'lexical-contract' }[];
  implementation: { repository: 'redact-secret/redact-secret'; component: 'secret-scan-core'; identity: string; version: number; mergeCommit: string };
  vectorSet: { id: string; version: 1 };
}

export interface PiiValidatorConsumerMap {
  schemaVersion: 1;
  mappings: { validator: { id: string; version: number }; families: string[] }[];
}

export interface PiiValidatorFamilyDescriptor {
  family: string;
  validator: { id: string; version: number } | null;
}

export interface PiiValidatorObservationArtifact {
  schemaVersion: 1;
  reportType: 'pii-validator-simulation';
  producer: { kind: 'benchmark-simulation'; repository: 'redact-secret/redact-secret-benchmarks' };
  contractUnderTest: { repository: 'redact-secret/redact-secret'; commit: string; conformanceSurface: 'unavailable' };
  targets: { id: PiiValidatorTarget; adapterHash: string }[];
  observations: { target: PiiValidatorTarget; validator: { id: string; version: number }; vectorId: string; outcome: PiiValidatorOutcome }[];
}

export interface PiiValidatorQualificationReport {
  schemaVersion: 1;
  reportType: 'pii-validator-qualification';
  domain: 'pii';
  profile: { id: 'pii-validator-qualification'; version: 1 };
  productContract: typeof PII_VALIDATOR_PRODUCT_CONTRACT;
  status: 'not-measured';
  familySupportClaims: false;
  familyQualification: 'not-evaluated';
  primitiveClasses: PiiValidatorPrimitiveClass[];
  evidenceTrust: 'not-measured' | 'untrusted-simulation';
  inputs: { observationCommitment: string | null; consumerMapCommitment: string; familyDescriptorsCommitment: string };
  registryContract: { status: 'not-measured'; observations: { expected: number; measured: number };
    simulationMismatches: { target: PiiValidatorTarget; vectorId: string; expected: string; observed: string }[] };
  primitives: {
    validator: { id: string; version: number; primitiveClass: PiiValidatorPrimitiveClass; maxCandidateBytes: number };
    normativeSources: PiiValidatorRegistration['normativeSources'];
    implementation: PiiValidatorRegistration['implementation'];
    vectorSet: { id: string; version: 1; counts: Record<PiiValidatorVectorClass, number> };
    consumers: string[];
    status: 'not-measured';
    parity: { status: 'not-measured' | 'simulation'; agreement: 'not-measured' | 'matched' | 'divergent' };
    observations: { expected: number; measured: number };
    simulationMismatches: { target: PiiValidatorTarget; vectorId: string; expected: string; observed: string; consumers: string[] }[];
  }[];
}

const luhnVectors: ValidatorVector[] = [
  { id: 'luhn-even-positive', class: 'positive', candidate: '1230', expected: 'valid' },
  { id: 'luhn-odd-positive', class: 'positive', candidate: '12344', expected: 'valid' },
  { id: 'luhn-checksum-invalid', class: 'mechanical-invalid', candidate: '1231', expected: 'checksum-mismatch' },
  { id: 'luhn-empty-boundary', class: 'boundary', candidate: '', expected: 'malformed' },
  { id: 'luhn-one-character-boundary', class: 'boundary', candidate: '0', expected: 'malformed' },
  { id: 'luhn-separator-boundary', class: 'boundary', candidate: '0000-0000', expected: 'malformed' },
  { id: 'luhn-exact-maximum', class: 'maximum-length', candidate: '0000000000000000000', expected: 'valid' },
  { id: 'luhn-over-maximum', class: 'maximum-length', candidate: '00000000000000000000', expected: 'candidate-too-long' },
  { id: 'luhn-adversarial-oversize', class: 'maximum-length', candidate: '9'.repeat(1_000_000), expected: 'candidate-too-long' },
];
const ibanVectors: ValidatorVector[] = [
  { id: 'iban-positive', class: 'positive', candidate: 'ZZ50SYNTHETIC000000', expected: 'valid' },
  { id: 'iban-checksum-invalid', class: 'mechanical-invalid', candidate: 'ZZ51SYNTHETIC000000', expected: 'checksum-mismatch' },
  { id: 'iban-short-boundary', class: 'boundary', candidate: 'ZZ50SYNTHETIC', expected: 'malformed' },
  { id: 'iban-below-minimum-boundary', class: 'boundary', candidate: 'ZZ75SYNTHETIC0', expected: 'malformed' },
  { id: 'iban-exact-minimum-boundary', class: 'boundary', candidate: 'ZZ75SYNTHETIC00', expected: 'valid' },
  { id: 'iban-case-boundary', class: 'boundary', candidate: 'zz50SYNTHETIC000000', expected: 'malformed' },
  { id: 'iban-exact-maximum', class: 'maximum-length', candidate: `ZZ25SYNTHETIC${'0'.repeat(21)}`, expected: 'valid' },
  { id: 'iban-over-maximum', class: 'maximum-length', candidate: `ZZ25SYNTHETIC${'0'.repeat(22)}`, expected: 'candidate-too-long' },
  { id: 'iban-adversarial-oversize', class: 'maximum-length', candidate: 'Z'.repeat(1_000_000), expected: 'candidate-too-long' },
];

const vectors = new Map<string, ValidatorVector[]>([
  ['luhn-v1', luhnVectors],
  ['iban-mod97-v1', ibanVectors],
]);
const registryVectors = [
  { id: 'unknown-validator-identity', validator: { id: 'unknown-validator', version: 1 }, candidate: '0'.repeat(1_000_000), expected: 'unknown-validator' as const },
  { id: 'unknown-validator-version', validator: { id: 'luhn', version: 2 }, candidate: '1230', expected: 'unknown-validator' as const },
];

export const PII_VALIDATOR_REGISTRATIONS: readonly PiiValidatorRegistration[] = deepFreeze([{
  id: 'luhn', version: 1, primitiveClass: 'luhn', maxCandidateBytes: 19,
  normativeSources: [
    { sourceKind: 'patent', sourceId: 'us-2950048', locator: 'https://patents.google.com/patent/US2950048A/en', revision: '1960-08-23', claim: 'algorithm' },
    { sourceKind: 'product-decision', sourceId: PII_VALIDATOR_PRODUCT_CONTRACT.decision,
      locator: 'https://github.com/redact-secret/redact-secret/blob/266204c87126a9de2c0ff28e7913bccabebd1d98/docs/decisions/2026-09-26-define-the-bounded-built-in-structured-validator-registry.md',
      revision: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit, claim: 'lexical-contract' },
  ],
  implementation: { repository: 'redact-secret/redact-secret', component: 'secret-scan-core', identity: 'luhn', version: 1,
    mergeCommit: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit }, vectorSet: { id: 'luhn-v1', version: 1 },
}, {
  id: 'iban-mod97', version: 1, primitiveClass: 'mod-97', maxCandidateBytes: 34,
  normativeSources: [
    { sourceKind: 'standard', sourceId: 'iso-13616-1', locator: 'https://www.iso.org/standard/81090.html', revision: '2020', claim: 'algorithm' },
    { sourceKind: 'product-decision', sourceId: PII_VALIDATOR_PRODUCT_CONTRACT.decision,
      locator: 'https://github.com/redact-secret/redact-secret/blob/266204c87126a9de2c0ff28e7913bccabebd1d98/docs/decisions/2026-09-26-define-the-bounded-built-in-structured-validator-registry.md',
      revision: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit, claim: 'lexical-contract' },
  ],
  implementation: { repository: 'redact-secret/redact-secret', component: 'secret-scan-core', identity: 'iban-mod97', version: 1,
    mergeCommit: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit }, vectorSet: { id: 'iban-mod97-v1', version: 1 },
}]);

export const PII_VALIDATOR_CONSUMERS: PiiValidatorConsumerMap = deepFreeze({ schemaVersion: 1, mappings: [
  { validator: { id: 'luhn', version: 1 }, families: [] },
  { validator: { id: 'iban-mod97', version: 1 }, families: [] },
] });
export const PII_VALIDATOR_FAMILIES: readonly PiiValidatorFamilyDescriptor[] = deepFreeze([
  { family: 'pii:global:email', validator: null },
  { family: 'pii:us:ssn', validator: null },
]);

const ajv = new Ajv({ strict: true });
const validateObservationSchema = ajv.compile(observationSchema);
const validateQualificationSchema = ajv.compile(qualificationSchema);
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const family = (value: unknown) => typeof value === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const key = (id: string, version: number) => `${id}@${version}`;

function validateRegistration(registration: PiiValidatorRegistration) {
  if (!exact(registration, ['id', 'version', 'primitiveClass', 'maxCandidateBytes', 'normativeSources', 'implementation', 'vectorSet']) ||
      !slug(registration.id) || !Number.isInteger(registration.version) || registration.version < 1 ||
      !PII_VALIDATOR_PRIMITIVE_CLASSES.includes(registration.primitiveClass) || !Number.isInteger(registration.maxCandidateBytes) || registration.maxCandidateBytes < 1 ||
      !Array.isArray(registration.normativeSources) || registration.normativeSources.length < 2 || registration.normativeSources.some(source =>
        !exact(source, ['sourceKind', 'sourceId', 'locator', 'revision', 'claim']) || !['standard', 'patent', 'product-decision'].includes(source.sourceKind) ||
        !slug(source.sourceId) || typeof source.locator !== 'string' || !source.locator.startsWith('https://') || typeof source.revision !== 'string' ||
        !['algorithm', 'lexical-contract'].includes(source.claim)) ||
      !exact(registration.implementation, ['repository', 'component', 'identity', 'version', 'mergeCommit']) ||
      registration.implementation.repository !== PII_VALIDATOR_PRODUCT_CONTRACT.repository || registration.implementation.component !== 'secret-scan-core' ||
      registration.implementation.identity !== registration.id || registration.implementation.version !== registration.version ||
      registration.implementation.mergeCommit !== PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit ||
      !exact(registration.vectorSet, ['id', 'version']) || registration.vectorSet.version !== 1) throw new Error('Invalid PII validator registration');
  const corpus = vectors.get(registration.vectorSet.id);
  if (!corpus || corpus.length === 0 || new Set(corpus.map(row => row.id)).size !== corpus.length ||
      !['positive', 'mechanical-invalid', 'boundary', 'maximum-length'].every(category => corpus.some(row => row.class === category)) ||
      corpus.some(row => !slug(row.id) || !['positive', 'mechanical-invalid', 'boundary', 'maximum-length'].includes(row.class) ||
        !['valid', 'candidate-too-long', 'malformed', 'checksum-mismatch'].includes(row.expected) ||
        (row.expected === 'candidate-too-long') !== (Buffer.byteLength(row.candidate) > registration.maxCandidateBytes)))
    throw new Error('Invalid PII validator vector corpus');
  return registration;
}

export function validatePiiValidatorRegistry(registrations: readonly PiiValidatorRegistration[] = PII_VALIDATOR_REGISTRATIONS) {
  const copy = structuredClone(registrations) as PiiValidatorRegistration[];
  if (copy.length === 0 || new Set(copy.map(row => key(row.id, row.version))).size !== copy.length) throw new Error('Invalid PII validator registry');
  copy.forEach(validateRegistration);
  return copy;
}

export function validatePiiValidatorConsumerMap(value: unknown,
  familyDescriptors: readonly PiiValidatorFamilyDescriptor[] = PII_VALIDATOR_FAMILIES): PiiValidatorConsumerMap {
  const map = structuredClone(value as PiiValidatorConsumerMap), registrations = validatePiiValidatorRegistry();
  if (!exact(map, ['schemaVersion', 'mappings']) || map.schemaVersion !== 1 || !Array.isArray(map.mappings) || map.mappings.length !== registrations.length ||
      new Set(map.mappings.map(row => key(row?.validator?.id, row?.validator?.version))).size !== map.mappings.length) throw new Error('Invalid PII validator consumer map');
  const descriptors = structuredClone(familyDescriptors), expected = new Set(registrations.map(row => key(row.id, row.version)));
  if (new Set(descriptors.map(row => row?.family)).size !== descriptors.length || descriptors.some(row =>
    !exact(row, ['family', 'validator']) || !family(row.family) || (row.validator !== null &&
      (!exact(row.validator, ['id', 'version']) || !expected.has(key(row.validator.id, row.validator.version))))))
    throw new Error('Invalid PII validator family descriptors');
  const byFamily = new Map(descriptors.map(row => [row.family, row.validator]));
  for (const row of map.mappings) if (!exact(row, ['validator', 'families']) || !exact(row.validator, ['id', 'version']) ||
      !expected.has(key(row.validator.id, row.validator.version)) || !Array.isArray(row.families) || new Set(row.families).size !== row.families.length ||
      row.families.some(candidate => {
        const declared = byFamily.get(candidate);
        return !family(candidate) || declared === undefined || declared === null ||
          key(declared.id, declared.version) !== key(row.validator.id, row.validator.version);
      }))
    throw new Error('Invalid PII validator consumer map');
  for (const descriptor of descriptors) if (descriptor.validator !== null && !map.mappings.some(row =>
    key(row.validator.id, row.validator.version) === key(descriptor.validator!.id, descriptor.validator!.version) && row.families.includes(descriptor.family)))
    throw new Error('Incomplete PII validator consumer map');
  return map;
}

export const piiValidatorCorpusSummary = () => validatePiiValidatorRegistry().map(registration => ({
  validator: { id: registration.id, version: registration.version }, vectorSet: structuredClone(registration.vectorSet),
  counts: Object.fromEntries(['positive', 'mechanical-invalid', 'boundary', 'maximum-length'].map(category =>
    [category, vectors.get(registration.vectorSet.id)!.filter(row => row.class === category).length])),
}));

function observation(value: unknown): { outcome: PiiValidatorOutcome } {
  if (!exact(value, ['outcome'])) throw new Error('Invalid PII validator runner observation');
  const outcome = (value as { outcome?: unknown }).outcome;
  if (typeof outcome !== 'string' || !['valid', 'candidate-too-long', 'malformed', 'checksum-mismatch', 'unknown-validator', 'unavailable'].includes(outcome))
    throw new Error('Invalid PII validator runner observation');
  return { outcome: outcome as PiiValidatorOutcome };
}

export async function capturePiiValidatorObservations(options: {
  productCommit: string;
  targets: { id: PiiValidatorTarget; adapterHash: string;
    observe(request: { validator: { id: string; version: number }; vector: { id: string; candidate: string } }): Promise<unknown> | unknown }[];
}): Promise<PiiValidatorObservationArtifact> {
  const registrations = validatePiiValidatorRegistry();
  if (options.productCommit !== PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit || options.targets.length !== 2 ||
      new Set(options.targets.map(row => row.id)).size !== 2 || !options.targets.every(row => ['native', 'wasm'].includes(row.id) && digest(row.adapterHash)) ||
      new Set(options.targets.map(row => row.adapterHash)).size !== options.targets.length) throw new Error('Invalid PII validator capture target');
  const observations: PiiValidatorObservationArtifact['observations'] = [];
  for (const target of options.targets) for (const registration of registrations) for (const vector of vectors.get(registration.vectorSet.id)!) {
    const request = { validator: { id: registration.id, version: registration.version }, vector: { id: vector.id, candidate: vector.candidate } };
    const first = observation(await target.observe(structuredClone(request))), second = observation(await target.observe(structuredClone(request)));
    if (first.outcome !== second.outcome) throw new Error('Unstable PII validator runner observation');
    observations.push({ target: target.id, validator: request.validator, vectorId: vector.id, outcome: first.outcome });
  }
  for (const target of options.targets) for (const vector of registryVectors) {
    const request = { validator: structuredClone(vector.validator), vector: { id: vector.id, candidate: vector.candidate } };
    const first = observation(await target.observe(structuredClone(request))), second = observation(await target.observe(structuredClone(request)));
    if (first.outcome !== second.outcome) throw new Error('Unstable PII validator runner observation');
    observations.push({ target: target.id, validator: request.validator, vectorId: vector.id, outcome: first.outcome });
  }
  return validatePiiValidatorObservationArtifact({ schemaVersion: 1, reportType: 'pii-validator-simulation',
    producer: { kind: 'benchmark-simulation', repository: 'redact-secret/redact-secret-benchmarks' },
    contractUnderTest: { repository: PII_VALIDATOR_PRODUCT_CONTRACT.repository, commit: options.productCommit, conformanceSurface: 'unavailable' },
    targets: options.targets.map(({ id, adapterHash }) => ({ id, adapterHash })), observations });
}

export function validatePiiValidatorObservationArtifact(value: unknown): PiiValidatorObservationArtifact {
  if (!validateObservationSchema(value)) throw new Error('Invalid PII validator observation schema');
  const artifact = structuredClone(value) as unknown as PiiValidatorObservationArtifact, registrations = validatePiiValidatorRegistry();
  if (artifact.producer.kind !== 'benchmark-simulation' || artifact.producer.repository !== 'redact-secret/redact-secret-benchmarks' ||
      artifact.contractUnderTest.repository !== PII_VALIDATOR_PRODUCT_CONTRACT.repository ||
      artifact.contractUnderTest.commit !== PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit || artifact.contractUnderTest.conformanceSurface !== 'unavailable' ||
      new Set(artifact.targets.map(row => row.id)).size !== 2 || !['native', 'wasm'].every(target => artifact.targets.some(row => row.id === target)) ||
      new Set(artifact.targets.map(row => row.adapterHash)).size !== artifact.targets.length) throw new Error('Invalid PII validator observation identity');
  const expected = registrations.flatMap(registration => artifact.targets.flatMap(target => vectors.get(registration.vectorSet.id)!.map(vector =>
    `${target.id}/${key(registration.id, registration.version)}/${vector.id}`))).concat(
      artifact.targets.flatMap(target => registryVectors.map(vector => `${target.id}/${key(vector.validator.id, vector.validator.version)}/${vector.id}`)));
  const actual = artifact.observations.map(row => `${row.target}/${key(row.validator.id, row.validator.version)}/${row.vectorId}`);
  if (artifact.observations.length !== expected.length || new Set(actual).size !== actual.length || expected.some(cell => !actual.includes(cell)))
    throw new Error('Incomplete PII validator target-vector matrix');
  return artifact;
}

function assemblePiiValidatorQualification(artifact: unknown | undefined, consumerMap: unknown,
  familyDescriptors: readonly PiiValidatorFamilyDescriptor[]): PiiValidatorQualificationReport {
  const registrations = validatePiiValidatorRegistry(), consumers = validatePiiValidatorConsumerMap(consumerMap, familyDescriptors);
  const observed = artifact === undefined ? null : validatePiiValidatorObservationArtifact(artifact);
  const primitives = registrations.map(registration => {
    const corpus = vectors.get(registration.vectorSet.id)!, mapped = consumers.mappings.find(row =>
      row.validator.id === registration.id && row.validator.version === registration.version)!.families;
    const rows = observed?.observations.filter(row => row.validator.id === registration.id && row.validator.version === registration.version) ?? [];
    const simulationMismatches = rows.flatMap(row => {
      const expected = corpus.find(vector => vector.id === row.vectorId)!.expected;
      return row.outcome === expected ? [] : [{ target: row.target, vectorId: row.vectorId, expected, observed: row.outcome, consumers: [...mapped] }];
    });
    const divergent = observed ? corpus.some(vector => {
      const outcomes = rows.filter(row => row.vectorId === vector.id).map(row => row.outcome);
      return new Set(outcomes).size !== 1;
    }) : false;
    return { validator: { id: registration.id, version: registration.version, primitiveClass: registration.primitiveClass,
      maxCandidateBytes: registration.maxCandidateBytes }, normativeSources: structuredClone(registration.normativeSources),
      implementation: structuredClone(registration.implementation), vectorSet: { ...registration.vectorSet,
        counts: Object.fromEntries(['positive', 'mechanical-invalid', 'boundary', 'maximum-length'].map(category =>
          [category, corpus.filter(row => row.class === category).length])) as Record<PiiValidatorVectorClass, number> }, consumers: [...mapped],
      status: 'not-measured' as const,
      parity: observed ? { status: 'simulation' as const, agreement: divergent ? 'divergent' as const : 'matched' as const }
        : { status: 'not-measured' as const, agreement: 'not-measured' as const },
      observations: { expected: observed ? corpus.length * 2 : 0, measured: rows.length }, simulationMismatches };
  });
  const registryRows = observed?.observations.filter(row => registryVectors.some(vector => vector.id === row.vectorId)) ?? [];
  const registryMismatches = registryRows.flatMap(row => {
    const expected = registryVectors.find(vector => vector.id === row.vectorId)!.expected;
    return row.outcome === expected ? [] : [{ target: row.target, vectorId: row.vectorId, expected, observed: row.outcome }];
  });
  const report: PiiValidatorQualificationReport = { schemaVersion: 1, reportType: 'pii-validator-qualification', domain: 'pii',
    profile: { id: 'pii-validator-qualification', version: 1 }, productContract: PII_VALIDATOR_PRODUCT_CONTRACT,
    status: 'not-measured',
    familySupportClaims: false, familyQualification: 'not-evaluated', primitiveClasses: [...PII_VALIDATOR_PRIMITIVE_CLASSES],
    evidenceTrust: observed ? 'untrusted-simulation' : 'not-measured',
    inputs: { observationCommitment: observed ? hash(observed) : null, consumerMapCommitment: hash(consumers),
      familyDescriptorsCommitment: hash(familyDescriptors) },
    registryContract: { status: 'not-measured', observations: { expected: observed ? registryVectors.length * 2 : 0, measured: registryRows.length },
      simulationMismatches: registryMismatches }, primitives };
  return report;
}

export function qualifyPiiValidators(artifact?: unknown, consumerMap: unknown = PII_VALIDATOR_CONSUMERS,
  familyDescriptors: readonly PiiValidatorFamilyDescriptor[] = PII_VALIDATOR_FAMILIES): PiiValidatorQualificationReport {
  const report = assemblePiiValidatorQualification(artifact, consumerMap, familyDescriptors);
  return validatePiiValidatorQualificationReport(report, { artifact, consumerMap, familyDescriptors });
}

export function validatePiiValidatorQualificationReport(value: unknown, inputs: { artifact?: unknown; consumerMap?: unknown;
  familyDescriptors?: readonly PiiValidatorFamilyDescriptor[] } = {}): PiiValidatorQualificationReport {
  if (!validateQualificationSchema(value)) throw new Error('Invalid PII validator qualification schema');
  const consumerMap = inputs.consumerMap ?? PII_VALIDATOR_CONSUMERS, familyDescriptors = inputs.familyDescriptors ?? PII_VALIDATOR_FAMILIES;
  const expected = assemblePiiValidatorQualification(inputs.artifact, consumerMap, familyDescriptors);
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error('Inconsistent PII validator qualification report');
  return structuredClone(expected);
}

/** Independent benchmark oracle for corpus QA only; never product evidence. */
export function benchmarkReferenceValidator(request: { validator: { id: string; version: number }; vector: { id: string; candidate: string } }): { outcome: PiiValidatorOutcome } {
  const registration = PII_VALIDATOR_REGISTRATIONS.find(row => row.id === request.validator.id && row.version === request.validator.version);
  if (!registration) return { outcome: 'unknown-validator' };
  const value = request.vector.candidate;
  if (Buffer.byteLength(value) > registration.maxCandidateBytes) return { outcome: 'candidate-too-long' };
  if (registration.id === 'luhn') {
    if (value.length < 2 || !/^[0-9]+$/.test(value)) return { outcome: 'malformed' };
    let sum = 0, parity = value.length % 2;
    for (let index = 0; index < value.length; index++) { let digit = Number(value[index]); if (index % 2 === parity) { digit *= 2; if (digit > 9) digit -= 9; } sum += digit; }
    return { outcome: sum % 10 === 0 ? 'valid' : 'checksum-mismatch' };
  }
  if (registration.id === 'iban-mod97') {
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(value)) return { outcome: 'malformed' };
    let remainder = 0;
    for (const character of `${value.slice(4)}${value.slice(0, 4)}`) for (const digit of /[0-9]/.test(character) ? character : String(character.charCodeAt(0) - 55))
      remainder = (remainder * 10 + Number(digit)) % 97;
    return { outcome: remainder === 1 ? 'valid' : 'checksum-mismatch' };
  }
  return { outcome: 'unavailable' };
}
