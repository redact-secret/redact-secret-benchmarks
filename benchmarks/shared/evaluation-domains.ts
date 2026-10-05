import Ajv from 'ajv';
import schema from '../../schemas/evaluation-domains-v1.json';
import { credentialIdentity } from '../evaluation/domains/credential/identity.ts';
import { piiIdentity } from '../evaluation/domains/pii/identity.ts';
import { piiV1Profile } from '../evaluation/domains/pii/profile.ts';

export type EvaluationDomainId = 'credential' | 'pii';
export interface DomainPublication { state: 'published' | 'schema-only'; href: string | null }
export interface EvaluationDomainDescriptor {
  domain: EvaluationDomainId;
  reportProfile: { id: string; version: 1 };
  evaluationProfile: string;
  domainAccountingVersion: string;
  qualificationProfiles: { id: string; version: 1 }[];
  evaluation: DomainPublication;
  support: DomainPublication;
}
export interface EvaluationDomainsFile {
  schemaVersion: 1;
  reportType: 'evaluation-domains';
  supportClaims: false;
  domains: EvaluationDomainDescriptor[];
}

/** Canonical public registry. Existing credential artifacts remain unchanged and are referenced, never rewritten. */
export const evaluationDomains: EvaluationDomainsFile = Object.freeze({
  schemaVersion: 1,
  reportType: 'evaluation-domains',
  supportClaims: false,
  domains: Object.freeze([
    Object.freeze({
      domain: credentialIdentity.domain,
      reportProfile: credentialIdentity.reportProfile,
      evaluationProfile: credentialIdentity.evaluationProfiles.evaluation,
      domainAccountingVersion: credentialIdentity.domainAccountingVersion,
      qualificationProfiles: Object.freeze([Object.freeze({ id: 'documented', version: 1 as const }), Object.freeze({ id: 'empirical', version: 1 as const })]),
      evaluation: Object.freeze({ state: 'published' as const, href: '/results/evaluation-v1.json' }),
      support: Object.freeze({ state: 'published' as const, href: '/results/support-matrix-v1.json' }),
    }),
    Object.freeze({
      domain: piiIdentity.domain,
      reportProfile: piiIdentity.reportProfile,
      evaluationProfile: piiV1Profile.evaluationProfile,
      domainAccountingVersion: piiV1Profile.domainAccountingVersion,
      qualificationProfiles: Object.freeze([Object.freeze({ id: piiV1Profile.id, version: piiV1Profile.version })]),
      evaluation: Object.freeze({ state: 'schema-only' as const, href: null }),
      support: Object.freeze({ state: 'schema-only' as const, href: null }),
    }),
  ]),
} as unknown as EvaluationDomainsFile);

const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonical = JSON.stringify(evaluationDomains);

/** Schema validation plus exact identity/profile coupling rejects duplicates and cross-domain combinations. */
export function evaluationDomainsProblem(value: unknown): string | null {
  if (!validateSchema(value)) return 'Invalid evaluation-domain index contract';
  if (JSON.stringify(value) !== canonical) return 'Unknown or incompatible evaluation-domain identity';
  return null;
}

export function domainDescriptor(value: unknown, id: EvaluationDomainId): EvaluationDomainDescriptor | null {
  if (evaluationDomainsProblem(value)) return null;
  return (value as EvaluationDomainsFile).domains.find(domain => domain.domain === id) ?? null;
}
