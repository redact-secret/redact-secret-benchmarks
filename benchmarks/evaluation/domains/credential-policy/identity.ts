export const credentialPolicyIdentity = Object.freeze({
  domain: 'credential-policy' as const,
  reportProfile: Object.freeze({ id: 'credential-policy-holdout', version: 1 as const }),
  evaluationProfiles: Object.freeze({ measurement: 'credential-policy-v1' as const, evaluation: 'credential-policy-v1' as const }),
  domainAccountingVersion: 'credential-policy-v1' as const,
});

