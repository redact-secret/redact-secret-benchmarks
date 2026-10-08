export interface PiiPeerReadiness {
  schema: 'pii-peer-readiness/1'; supportClaims: false; measurementState: 'not-measured';
  reviewedEvaluator: { repository: string; commit: string; inventorySha256: string; configurationSha256: string };
  expectationRules: string[]; populations: Array<{ view: string; populationId: string; populationDigest: string; method: 'schema-only' }>;
  peers: Array<{ scannerId: string; version: string; adapterState: 'unavailable'; accuracyState: 'not-measured'; reason: string; required: string[] }>;
  coverageGaps: string[]; sources: string[];
}
export function validatePiiPeerReadiness(value: unknown): PiiPeerReadiness;
