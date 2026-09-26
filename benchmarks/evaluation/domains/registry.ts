import { credentialDomain } from './credential/contract.ts';
import { piiDomain } from './pii/contract.ts';

export interface EvaluationDomainDescriptor {
  domain: string; domainAccountingVersion: string;
}

/** Preserve each domain's full structural type without coupling the registry to one domain. */
export const defineEvaluationDomains = <T extends Record<string, EvaluationDomainDescriptor>>(entries: T) => Object.freeze(entries);

/** Closed keyed contract map. Adding a public entry point registers it once. */
const domains = defineEvaluationDomains({ credential: credentialDomain, pii: piiDomain });
export type EvaluationDomainContracts = typeof domains;
export type EvaluationDomainId = keyof typeof domains;

export function resolveEvaluationDomain<K extends EvaluationDomainId>(id: K): EvaluationDomainContracts[K];
export function resolveEvaluationDomain(id: string): EvaluationDomainContracts[EvaluationDomainId];
export function resolveEvaluationDomain(id: string) {
  if (!Object.hasOwn(domains, id)) throw new Error(`Unknown evaluation domain: ${id}`);
  return domains[id as EvaluationDomainId];
}

export const evaluationDomainIds = (): EvaluationDomainId[] => Object.keys(domains).sort() as EvaluationDomainId[];

/** Credential-shaped CLIs remain fail-closed until their public contracts become domain-aware. */
export function resolveCredentialDomain(id: string) {
  const domain = resolveEvaluationDomain(id);
  if (domain.domain !== 'credential') throw new Error(`Credential entry point does not support domain: ${id}`);
  return credentialDomain;
}
