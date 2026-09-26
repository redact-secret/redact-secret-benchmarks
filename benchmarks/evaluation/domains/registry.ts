import { credentialDomain } from './credential/contract.ts';

/** Closed internal resolver. Adding a domain registers a contract here; CLIs do not branch on domain semantics. */
const domains = new Map<string, unknown>([[credentialDomain.domain, credentialDomain]]);

export function resolveEvaluationDomain(id: 'credential'): typeof credentialDomain;
export function resolveEvaluationDomain(id: string): typeof credentialDomain;
export function resolveEvaluationDomain(id: string) {
  const domain = domains.get(id);
  if (!domain) throw new Error(`Unknown evaluation domain: ${id}`);
  return domain as typeof credentialDomain;
}

export const evaluationDomainIds = () => [...domains.keys()].sort();
