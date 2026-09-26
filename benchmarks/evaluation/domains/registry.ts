import { credentialDomain } from './credential/contract.ts';

export interface EvaluationDomainDescriptor {
  domain: string; evaluationProfile: string; domainAccountingVersion: string;
}
export interface EvaluationDomainContracts {
  credential: typeof credentialDomain;
}

/** Closed keyed contract map. Adding a domain registers it once; CLIs never branch on semantic names. */
const domains: EvaluationDomainContracts = Object.freeze({ credential: credentialDomain });
export type EvaluationDomainId = keyof EvaluationDomainContracts;

export function resolveEvaluationDomain<K extends EvaluationDomainId>(id: K): EvaluationDomainContracts[K];
export function resolveEvaluationDomain(id: string): EvaluationDomainContracts[EvaluationDomainId];
export function resolveEvaluationDomain(id: string) {
  if (!Object.hasOwn(domains, id)) throw new Error(`Unknown evaluation domain: ${id}`);
  return domains[id as EvaluationDomainId];
}

export const evaluationDomainIds = (): EvaluationDomainId[] => Object.keys(domains).sort() as EvaluationDomainId[];
