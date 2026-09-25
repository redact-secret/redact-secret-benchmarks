// Custodian-held blind evaluation (#142). Spec: docs/specs/blind-evaluation.md.
// Everything typed `Private*` lives only in the custodian's private root, outside
// every Git repository. Only `BlindAggregate` may leave it.

export type CredentialStatus = 'synthetic' | 'revoked';
export interface ByteRange { start: number; end: number }

export interface PrivateFixture {
  id: string; path: string; content: string;
  kind: 'must-redact' | 'must-not-flag';
  expected: (ByteRange & { envelope?: ByteRange })[];
  credentialStatus: CredentialStatus;
  /** Optional custodian label for a released stratum, e.g. a family id. Small strata are suppressed. */
  stratum?: string;
}

export interface PrivateCorpus {
  schemaVersion: 1; corpusType: 'blind-custodian-fixtures';
  epoch: string; nonce: string;
  custodian: { role: 'isolated-custodian-agent'; session: string };
  safetyReview: { status: 'passed'; reviewedAt: string; credentialStatuses: CredentialStatus[]; statement: string };
  fixtures: PrivateFixture[];
}

export interface ArtifactIdentity { role: string; sha256: string }
export interface CandidateArtifacts { sourceCommit: string; artifacts: (ArtifactIdentity & { file: string })[] }
export interface BenchmarkIdentity { sourceCommit: string; dirty: boolean; lockfileSha256: string }
export interface Environment { node: string; os: string; arch: string }

export interface PrivateFreeze {
  schemaVersion: 1; freezeType: 'blind-freeze'; freezeId: string; frozenAt: string;
  epoch: string; corpusCommitment: string;
  candidate: { sourceCommit: string; artifactSha256: string; artifacts: ArtifactIdentity[] };
  configuration: Record<string, unknown>; configurationHash: string; replays: number;
  benchmark: BenchmarkIdentity; environment: Environment;
}

export interface PrivateLedger {
  schemaVersion: 1; ledgerType: 'blind-ledger';
  epochs: { epoch: string; corpusCommitment: string; fixturesDigest: string }[];
  runs: { runId: string; freezeId: string; epoch: string; candidateArtifactSha256: string; status: 'reserved' | 'complete' | 'incomplete'; startedAt: string }[];
}

export interface Rate { count: number; of: number; value: number | null; interval: [number, number] | null }
export type WithheldReason = 'unstable-across-replays' | 'scan-error';

export interface BlindAggregate {
  schemaVersion: 1; reportType: 'blind-aggregate'; evidenceClass: 'custodian-blind';
  independence: { level: 'custodian-held-blind'; achieved: 'procedural-separation'; organisationalIndependence: false; statement: string };
  runId: string; startedAt: string; finishedAt: string; status: 'complete' | 'incomplete';
  candidate: { sourceCommit: string; packageName: string; declaredVersion: string; artifactSha256: string; artifacts: ArtifactIdentity[]; configurationHash: string };
  benchmark: { sourceCommit: string; lockfileSha256: string };
  environment: Environment;
  freeze: { freezeId: string; frozenAt: string; freezeHash: string };
  corpus: { epoch: string; commitment: string; fixtures: number };
  replays: number;
  measurability: { fixtures: number; measurable: number; share: number | null; withheld: number; withheldReasons: Record<WithheldReason, number> };
  instability: Rate;
  leakage: { fixtures: number; spans: number; leakedSpans: Rate; outcomes: Record<'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS', number> };
  falseAlarms: { controls: number; flaggedControls: Rate };
  strata: { status: 'released' | 'suppressed' | 'none'; minimumFixtures: number; rows: { label: string; fixtures: number; spans: number; leakedSpans: number; controls: number; flaggedControls: number }[] };
  uncertainty: { method: 'wilson-score'; confidence: 0.95; scope: string };
  failures: { phase: string; code: string }[];
}
