/** Shared benchmark data contracts. Offsets are UTF-8 bytes, never characters. */
export type Kind = 'must-redact' | 'must-not-flag' | 'policy';
export type Tier = 'T0' | 'T1' | 'T2' | 'T3';
export interface Range { start: number; end: number }
export interface ExpectedRange extends Range { role?: 'secret' | 'companion'; envelope?: Range & { reason?: string } }
export interface Assessment { kind: Kind; tier: Tier; reason: string; sources: string[]; contract?: string }
export interface Fixture {
  id: string; path: string; content: string; expected: ExpectedRange[];
  group: string; assessment: Assessment; detectors?: string[];
  twinOf?: string; mutation?: string; mutationKind?: string; formatReason?: string; issue?: number;
}
export interface Corpus { fixtures: Fixture[]; schemaVersion?: number; reviewStatus?: string; scope?: string; references?: unknown; milestoneReview?: unknown }
export interface Finding extends Range { path: string }
export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';
export interface RowScore { spanOutcomes?: Outcome[]; leakedBytes?: number; collateralBytes?: number; flagged?: boolean; findings?: number }
export interface ScoredRow extends RowScore {
  id: string; path: string; group: string; kind?: Kind; tier?: Tier; contract?: string; twinOf?: string;
  expected: ExpectedRange[]; actual: Range[];
}
export interface Group {
  files: number; scored?: boolean; spans?: number; secretBytes?: number; outcomes?: Record<string, number>;
  flaggedFiles?: number; findings?: number; falseAlarmRate?: number | null; meanFindingsPerFlagged?: number | null;
  leakedSpans?: number; leakedSpanRate?: number | null; leakedBytes?: number; leakedByteRate?: number | null;
  collateralBytes?: number; collateralRatio?: number | null;
  twins?: { positives: number; pairs: number; discriminated: number; rate: number | null };
  diagnostics?: { exact: { tp?: number; fp: number; fn?: number; tn?: number }; comparable: boolean };
}
export interface FormatContract {
  tier: Tier; pattern?: string; structural?: boolean; review?: string; companion?: string; references?: string[];
  providerSource?: { url: string; observedAt: string; formatVersion: string; covers: string };
  candidateSource?: FormatContract['providerSource']; corroboration?: { tool: string; label: string; url: string }[];
}
export interface Category { id: string; kind: string; corpus: string }
