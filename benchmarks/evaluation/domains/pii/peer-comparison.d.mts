import type { PiiEvalMeasurement } from './support-v2';
export type PiiPeerComparison = { publicOnly: true; qualified: false; supportClaims: false; mode: 'exploratory' } & (
  { state: 'absent' | 'invalid'; reason: string } | {
    state: 'recorded'; scope: 'local-default-family-type-and-range-only';
    engine: { commit: string; binarySha256: string; platform: 'darwin-arm64' };
    withheld: string[];
    peers: Array<{ peer: string; version: string; limitations: string[]; configuration: unknown;
      identity: { artifactDigest: string; configurationDigest: string; activationDigest: string };
      measurement: PiiEvalMeasurement }>;
  });
export function loadPiiPeerComparison(input?: { record?: unknown; populationPins?: unknown; populationPlan?: unknown;
  pins?: Array<{ peer: string; text: string }>; artifacts?: Array<{ peer: string; view: string; text: string }> }): PiiPeerComparison;
