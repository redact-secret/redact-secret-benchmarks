/** Stable identities for credential artifacts. Legacy wire versions remain readable separately. */
export const credentialIdentity = Object.freeze({
  domain: 'credential' as const,
  reportProfile: Object.freeze({ id: 'credential-evaluation', version: 1 as const }),
  evaluationProfiles: Object.freeze({ measurement: 'measurement-v4' as const, evaluation: 'evaluation-v1' as const }),
  domainAccountingVersion: 'credential-v4' as const,
});
