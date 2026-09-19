export type Kind = 'must-redact' | 'must-not-flag' | 'policy';
export type Tier = 'T0' | 'T1' | 'T2' | 'T3';
export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';
export interface Range { start: number; end: number }
export interface Span extends Range { role: 'secret' | 'companion'; envelope?: Range & { reason?: string }; note?: string }
export interface Row {
  id: string;
  path: string;
  group: string;
  kind: Kind;
  tier: Tier;
  contract?: string;
  twinOf?: string;
  expected: Span[];
  actual: Range[];
  spanOutcomes?: Outcome[];
  leakedBytes?: number;
  collateralBytes?: number;
  flagged?: boolean;
  findings?: number;
}
/** Engine v1.1: a published rate is the pessimistic bound beside its point and n, or the reason it is withheld. */
export interface Rate { point: number; bound: number | null; n: number; direction: 'upper' | 'lower' | null }
export type Published = Rate | 'insufficient-evidence' | null;
export interface RedactGroup {
  files: number; spans: number; secretBytes: number;
  outcomes: Record<Outcome, number>;
  pendingFiles: number; measurableShare: Published; envelopeWidth: { spans: number; bytes: number };
  leakedSpans: number; leakedSpanRate: Published;
  leakedBytes: number; leakedByteRate: Published;
  collateralBytes: number; collateralRatio: Published;
  twins: { positives: number; pairs: number; discriminated: number; coverage: Published; rate: Published | 'insufficient-coverage' };
  diagnostics: { exact: { tp: number; fp: number; fn: number }; comparable: false };
}
export interface ControlGroup {
  files: number; flaggedFiles: number; falseAlarmRate: Published; findings: number; meanFindingsPerFlagged: Published;
  diagnostics: { exact: { fp: number; tn: number }; comparable: false };
}
export interface PendingGroup { files: number; scored: false; candidateKinds: Record<string, number> }
export type Group = RedactGroup | ControlGroup | PendingGroup;
export interface Scanner {
  id: string;
  name: string;
  mode: string;
  version: string | null;
  status: 'complete' | 'unavailable' | 'error' | 'unstable';
  message?: string;
  replays?: { count: number; agreed: boolean };
  durationMs?: number;
  rows?: Row[];
  groups?: Record<string, Group>;
}
export interface Report {
  schemaVersion: number;
  accounting: { minDenominator: number; replays: number; measurableShareFloor: Record<string, number>; twinCoverageFloor: Record<string, number>; resolvedRateFloor: Record<string, number> };
  runId: string;
  category: string;
  generatedAt: string;
  reviewStatus: string;
  scope?: string;
  references?: string[];
  milestoneReview?: {
    milestone: number;
    targetRelease: string;
    reviewedAt: string;
    sourceRevision: string;
    validation: string;
    outOfScopeIssues: { issue: number; reason: string }[];
    unverifiedSurfaces: string[];
  };
  corpusHash: string;
  lockHash: string;
  revision: string;
  dirty: boolean | null;
  runtime: { node: string; platform: string; arch: string };
  fixtureCount: number;
  expectedCount: number;
  matching: string;
  scanners: Scanner[];
}
export interface Run {
  schemaVersion: number; runId: string; startedAt: string; finishedAt: string; categories: string[]; partial: boolean;
  scannerVersions: Record<string, string>; lockHash: string; revision: string; dirty: boolean | null;
}
export interface Baseline {
  schemaVersion: number; version: string; runId: string; savedAt: string; revision: string;
  scanners: Record<string, string>; corpusHashes: Record<string, string>;
  groups: Record<string, Record<string, Record<string, Group>>>;
  rows: Record<string, Record<string, string>>;
}
export interface Summary {
  key: string; kind: string; tier: Tier; scanner: string; name: string; version: string | null; mode: string;
  lockHash: string; matching: string; runId: string | null; selectedCount: number; rows: (Row & { slug: string; category: string })[];
  sources: string[]; statuses: string[]; reviews: string[]; metrics: Group | null;
}
export const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const percent = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
export const ratio = (value: number | null | undefined) => (value == null ? '—' : value.toFixed(3));
/** The bound is the headline; the point is secondary. A withheld rate renders its reason verbatim. */
export const published = (rate: Published | 'insufficient-coverage' | undefined, format: (value: number) => string = v => percent(v)) =>
  rate == null ? '—' : typeof rate === 'string' ? rate
    : rate.bound == null ? `${format(rate.point)} (n ${rate.n})`
    : `${rate.direction === 'upper' ? '≤' : '≥'} ${format(rate.bound)} (point ${format(rate.point)}, n ${rate.n})`;
