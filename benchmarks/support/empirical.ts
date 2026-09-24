import Ajv from 'ajv';
import schema from '../../schemas/empirical-observations-v1.json';
import data from './empirical-observations.json';

export interface EmpiricalFamilyRecord {
  family: string;
  mode: 'shape' | 'context-constrained';
  supportsBareValues: boolean;
  uncertainty: string;
  supportedContexts: string[];
  observations: {
    provider: string; observedAt: string; issuedAt: string; issuanceRoute: string; subjectKind: 'account' | 'project'; subjectId: string;
    evidenceBasis: 'empirically-observed'; independenceClass: 'provider-issuance';
    structure: { totalLength: number; prefix: string | null; segmentLengths: number[]; alphabetClasses: string[]; separators: string[]; checksumBehavior: string };
    revokedAfterObservation: boolean; rawValueRetained: false;
  }[];
  corroboration: { class: string; reference: string }[];
  contradictions: string[];
}

export interface EmpiricalObservationFile { schemaVersion: 1; families: EmpiricalFamilyRecord[] }

const validate = new Ajv({ strict: true }).compile(schema);

/** Fixed diagnostics only: malformed observation input is never interpolated into output. */
export function validateEmpiricalObservations(value: unknown): EmpiricalObservationFile {
  if (!validate(value)) throw new Error('Invalid empirical observation metadata');
  const file = value as unknown as EmpiricalObservationFile;
  if (new Set(file.families.map(family => family.family)).size !== file.families.length)
    throw new Error('Duplicate empirical observation family');
  return file;
}

export const empiricalObservations = validateEmpiricalObservations(data);

export function empiricalEvidence(family: string, file: EmpiricalObservationFile = empiricalObservations) {
  const record = file.families.find(entry => entry.family === family);
  if (!record) return {
    evidenceBasis: 'none' as const, observationCount: 0, observationSubjects: 0, observationIssuanceDates: 0,
    corroborationClasses: [] as string[], observationContradictions: 0, uncertainty: null,
    supportedContexts: [] as string[], empiricalMode: null, supportsBareValues: false,
  };
  return {
    evidenceBasis: 'empirically-observed' as const,
    observationCount: record.observations.length,
    observationSubjects: new Set(record.observations.map(observation => observation.subjectId)).size,
    observationIssuanceDates: new Set(record.observations.map(observation => observation.issuedAt)).size,
    corroborationClasses: [...new Set(record.corroboration.map(item => item.class))].sort(),
    observationContradictions: record.contradictions.length,
    uncertainty: record.uncertainty,
    supportedContexts: [...record.supportedContexts].sort(),
    empiricalMode: record.mode,
    supportsBareValues: record.supportsBareValues,
  };
}
