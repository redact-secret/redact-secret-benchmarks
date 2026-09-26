/** Named internal profile for the migrated evaluator. Serialized report versions remain unchanged in #276. */
export const credentialIdentity = Object.freeze({
  domain: 'credential' as const,
  reportProfile: Object.freeze({ id: 'credential-evaluation', version: 1 as const }),
});
