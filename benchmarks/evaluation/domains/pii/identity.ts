export const piiIdentity = Object.freeze({
  domain: 'pii' as const,
  reportProfile: Object.freeze({ id: 'pii-evaluation', version: 1 as const }),
  evaluationProfile: 'pii-schema-v1' as const,
  domainAccountingVersion: 'pii-observation-v1' as const,
});

