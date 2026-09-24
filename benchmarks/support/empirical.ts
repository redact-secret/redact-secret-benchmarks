import Ajv from 'ajv';
import schema from '../../schemas/empirical-observations-v1.json';
import data from './empirical-observations.json';

export interface EmpiricalObservation {
  provider: string; credentialFamily: string; observedAt: string; issuedAt: string; issuanceRoute: string;
  subjectKind: 'account' | 'project'; subjectId: string;
  evidenceBasis: 'empirically-observed'; independenceClass: 'provider-issuance';
  structure: { totalLength: number; prefix: string | null; segmentLengths: number[]; alphabetClasses: string[]; separators: string[]; checksumBehavior: string };
  revokedAfterObservation: boolean; rawValueRetained: false;
}

/** Where a corroborating reference comes from (#177 amendment, 2026-09-24). */
export type CorroborationClass = 'peer-scanner-rule' | 'provider-owned-code' | 'provider-example' | 'independent-implementation' | 'independent-research';

/** One verified, dated source that corroborates the frozen shape. `owner` is who controls it: distinct owners are what makes references independent. */
export interface CorroborationReference { class: CorroborationClass; owner: string; reference: string; observedAt: string; supports: string }

/**
 * A disagreement among sources or observations, never deleted once recorded.
 * `unresolved` blocks empirical qualification. `bounded`: the contract
 * deliberately excludes the disputed shape, and `bound` says how (carried into
 * uncertainty and contexts). `settled`: a provider-owned source in this
 * family's own corroboration list (`settledBy`, class provider-owned-code or
 * provider-example) decides the question and the contract follows it; `bound`
 * says what it decides. A tool rule, blog or proposal can never settle one.
 */
export interface Contradiction { statement: string; status: 'bounded' | 'settled' | 'unresolved'; bound?: string; settledBy?: string }

/** The only classes that can settle a contradiction: the provider's own code or its own published example. */
const SETTLING_CLASSES: readonly CorroborationClass[] = ['provider-owned-code', 'provider-example'];

export interface EmpiricalFamilyRecord {
  family: string;
  mode: 'shape' | 'context-constrained';
  supportsBareValues: boolean;
  uncertainty: string;
  supportedContexts: string[];
  observations: EmpiricalObservation[];
  corroboration: CorroborationReference[];
  contradictions: Contradiction[];
}

export interface EmpiricalObservationFile { schemaVersion: 1; families: EmpiricalFamilyRecord[] }

const validate = new Ajv({ strict: true }).compile(schema);

/** Classes whose code references must be pinned to a tag or commit, so the cited rule or code cannot move under the claim. */
const PINNED_CLASSES: readonly CorroborationClass[] = ['peer-scanner-rule', 'provider-owned-code', 'independent-implementation'];
const MOVING_REF = /^https:\/\/(?:github\.com\/[^/]+\/[^/]+\/(?:blob|tree|raw)|raw\.githubusercontent\.com\/[^/]+\/[^/]+)\/([^/]+)\//;
/**
 * A GitHub code reference is pinned when its ref is a version tag or a hex
 * commit, never a branch such as main or master; any other GitHub URL is not a
 * code reference at all. Pages outside GitHub (provider docs, Purview SIT
 * definitions) are dated by `observedAt` instead.
 */
export function isPinnedReference(url: string) {
  const ref = MOVING_REF.exec(url)?.[1];
  if (ref === undefined) return !/^https:\/\/(?:github\.com|raw\.githubusercontent\.com)\//.test(url);
  return /^(?:v?\d[\w.+-]*|[0-9a-f]{7,40})$/.test(ref);
}

/** Fixed diagnostics only: malformed observation input is never interpolated into output. */
export function validateEmpiricalObservations(value: unknown): EmpiricalObservationFile {
  if (!validate(value)) throw new Error('Invalid empirical observation metadata');
  const file = value as unknown as EmpiricalObservationFile;
  if (new Set(file.families.map(family => family.family)).size !== file.families.length)
    throw new Error('Duplicate empirical observation family');
  if (file.families.some(family => family.observations.some(observation => observation.credentialFamily !== family.family)))
    throw new Error('Empirical observation family mismatch');
  if (file.families.some(family => new Set(family.corroboration.map(item => item.reference)).size !== family.corroboration.length))
    throw new Error('Duplicate corroboration reference');
  if (file.families.some(family => family.corroboration.some(item => PINNED_CLASSES.includes(item.class) && !isPinnedReference(item.reference))))
    throw new Error('Unpinned corroboration reference');
  const shaped = (item: Contradiction) => item.status === 'unresolved' ? item.bound === undefined && item.settledBy === undefined
    : item.status === 'bounded' ? item.bound !== undefined && item.settledBy === undefined : item.bound !== undefined && item.settledBy !== undefined;
  if (file.families.some(family => family.contradictions.some(item => !shaped(item))))
    throw new Error('Contradiction status and its bound or settling source disagree');
  if (file.families.some(family => family.contradictions.some(item => item.status === 'settled' &&
      !family.corroboration.some(reference => reference.reference === item.settledBy && SETTLING_CLASSES.includes(reference.class)))))
    throw new Error('Contradiction settled by a non-provider source');
  return file;
}

export const empiricalObservations = validateEmpiricalObservations(data);

export function empiricalEvidence(family: string, file: EmpiricalObservationFile = empiricalObservations) {
  const record = file.families.find(entry => entry.family === family);
  if (!record) return {
    observationCount: 0, observationSubjects: 0, observationIssuanceDates: 0,
    corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [] as string[],
    unresolvedContradictions: 0, boundedContradictions: 0, uncertainty: null,
    supportedContexts: [] as string[], empiricalMode: null, supportsBareValues: false,
  };
  return {
    observationCount: record.observations.length,
    observationSubjects: new Set(record.observations.map(observation => observation.subjectId)).size,
    observationIssuanceDates: new Set(record.observations.map(observation => observation.issuedAt)).size,
    corroborationReferences: record.corroboration.length,
    corroborationOwners: new Set(record.corroboration.map(item => item.owner)).size,
    corroborationClasses: [...new Set(record.corroboration.map(item => item.class))].sort(),
    unresolvedContradictions: record.contradictions.filter(item => item.status === 'unresolved').length,
    // Non-blocking, still visible: bounded by the contract or settled by a provider source.
    boundedContradictions: record.contradictions.filter(item => item.status !== 'unresolved').length,
    uncertainty: record.uncertainty,
    supportedContexts: [...record.supportedContexts].sort(),
    empiricalMode: record.mode,
    supportsBareValues: record.supportsBareValues,
  };
}
