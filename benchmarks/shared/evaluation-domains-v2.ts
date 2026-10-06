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

/** The credential evidence an index commits to: one evaluation bundle (#785, #790), named by its id and the SHA-256 of its immutable manifest. */
export interface CredentialBundleReference { bundleId: string; manifestSha256: string }
export const credentialBundleHref = (bundleId: string) => `/results/evaluation-bundles/${bundleId}/manifest.json`;

/**
 * v2 identity change (#790): the credential evaluation descriptor references the evaluation bundle manifest and commits to its digest, like PII support's content-addressed href. It never
 * references `/results/evaluation-v1.json`: that full report is the legacy contract (evaluation-domains-v1, produced only by the explicit `--legacy-v1` export) and a manifest is not that report.
 */
export function buildEvaluationDomainsV2(piiSupportCommitment: string, credential: CredentialBundleReference): EvaluationDomainsFileV2 {
  if (!/^[a-f0-9]{64}$/.test(piiSupportCommitment)) throw new Error('Invalid PII support artifact commitment');
  if (!/^[a-f0-9]{32}$/.test(credential?.bundleId ?? '') || !/^[a-f0-9]{64}$/.test(credential?.manifestSha256 ?? '')) throw new Error('Invalid credential evaluation bundle reference');
  const piiHref = `/results/pii-support-matrix-v2-${piiSupportCommitment}.json`;
  return {
    schemaVersion: 2, reportType: 'evaluation-domains', supportClaims: false,
    domains: [{
      domain: credentialIdentity.domain, reportProfile: credentialIdentity.reportProfile,
      evaluationProfile: credentialIdentity.evaluationProfiles.evaluation, domainAccountingVersion: credentialIdentity.domainAccountingVersion,
      qualificationProfiles: [{ id: 'documented', version: 1 }, { id: 'empirical', version: 1 }],
      evaluation: { state: 'published', href: credentialBundleHref(credential.bundleId), artifactCommitment: credential.manifestSha256 },
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
  if (credential?.domain !== 'credential' || pii?.domain !== 'pii') return 'Unknown or incompatible evaluation-domain v2 identity';
  if (credential.evaluation.href === '/results/evaluation-v1.json') return 'The credential evaluation must reference an evaluation bundle manifest: evaluation-v1.json is the legacy full report (evaluation-domains-v1)';
  const bundle = /^\/results\/evaluation-bundles\/([a-f0-9]{32})\/manifest\.json$/.exec(credential.evaluation.href ?? '');
  if (!bundle || !credential.evaluation.artifactCommitment) return 'The credential evaluation must reference an evaluation bundle manifest with its digest';
  try {
    if (JSON.stringify(file) !== JSON.stringify(buildEvaluationDomainsV2(pii.support.artifactCommitment ?? '', { bundleId: bundle[1], manifestSha256: credential.evaluation.artifactCommitment })))
      return 'Unknown or incompatible evaluation-domain v2 identity';
  } catch { return 'Unknown or incompatible evaluation-domain v2 identity'; }
  return null;
}
export function domainDescriptorV2(value: unknown, id: EvaluationDomainId): EvaluationDomainDescriptorV2 | null {
  if (evaluationDomainsV2Problem(value)) return null;
  return (value as EvaluationDomainsFileV2).domains.find(domain => domain.domain === id) ?? null;
}
