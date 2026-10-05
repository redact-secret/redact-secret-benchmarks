import Ajv from 'ajv';
import schema from '../../schemas/evaluation-domains-v2.json';
import { credentialIdentity } from '../evaluation/domains/credential/identity.ts';
import { piiIdentity } from '../evaluation/domains/pii/identity.ts';
import { piiV1Profile } from '../evaluation/domains/pii/profile.ts';
import type { EvaluationDomainId } from './evaluation-domains.ts';

export interface DomainPublicationV2 { state: 'published' | 'schema-only'; href: string | null; artifactCommitment: string | null }
export interface EvaluationDomainDescriptorV2 {
  domain: EvaluationDomainId; reportProfile: { id: string; version: 1 }; evaluationProfile: string;
  domainAccountingVersion: string; qualificationProfiles: { id: string; version: 1 }[];
  evaluation: DomainPublicationV2; support: DomainPublicationV2;
}
export interface EvaluationDomainsFileV2 { schemaVersion: 2; reportType: 'evaluation-domains'; supportClaims: false; domains: EvaluationDomainDescriptorV2[] }

export function buildEvaluationDomainsV2(piiSupportCommitment: string): EvaluationDomainsFileV2 {
  if (!/^[a-f0-9]{64}$/.test(piiSupportCommitment)) throw new Error('Invalid PII support artifact commitment');
  const piiHref = `/results/pii-support-matrix-v2-${piiSupportCommitment}.json`;
  return {
    schemaVersion: 2, reportType: 'evaluation-domains', supportClaims: false,
    domains: [{
      domain: credentialIdentity.domain, reportProfile: credentialIdentity.reportProfile,
      evaluationProfile: credentialIdentity.evaluationProfiles.evaluation, domainAccountingVersion: credentialIdentity.domainAccountingVersion,
      qualificationProfiles: [{ id: 'documented', version: 1 }, { id: 'empirical', version: 1 }],
      evaluation: { state: 'published', href: '/results/evaluation-v1.json', artifactCommitment: null },
      support: { state: 'published', href: '/results/support-matrix-v1.json', artifactCommitment: null },
    }, {
      domain: piiIdentity.domain, reportProfile: piiIdentity.reportProfile, evaluationProfile: piiV1Profile.evaluationProfile,
      domainAccountingVersion: piiV1Profile.domainAccountingVersion, qualificationProfiles: [{ id: piiV1Profile.id, version: piiV1Profile.version }],
      evaluation: { state: 'schema-only', href: null, artifactCommitment: null },
      support: { state: 'published', href: piiHref, artifactCommitment: piiSupportCommitment },
    }],
  };
}

const validateSchema = new Ajv({ strict: true }).compile(schema);
export function evaluationDomainsV2Problem(value: unknown): string | null {
  if (!validateSchema(value)) return 'Invalid evaluation-domain v2 index contract';
  const file = value as unknown as EvaluationDomainsFileV2, [credential, pii] = file.domains;
  if (credential?.domain !== 'credential' || pii?.domain !== 'pii' ||
      JSON.stringify(file) !== JSON.stringify(buildEvaluationDomainsV2(pii.support.artifactCommitment ?? '')))
    return 'Unknown or incompatible evaluation-domain v2 identity';
  return null;
}
export function domainDescriptorV2(value: unknown, id: EvaluationDomainId): EvaluationDomainDescriptorV2 | null {
  if (evaluationDomainsV2Problem(value)) return null;
  return (value as EvaluationDomainsFileV2).domains.find(domain => domain.domain === id) ?? null;
}
