/** Shared benchmark data contracts. Offsets are UTF-8 bytes, never characters. */
export type Kind = 'must-redact' | 'must-not-flag' | 'policy';
export type Tier = 'T0' | 'T1' | 'T2' | 'T3';
export interface Range { start: number; end: number }
export interface ExpectedRange extends Range { role?: 'secret' | 'companion'; envelope?: Range & { reason?: string } }
/** Recorded, never inferred (docs/decisions/2026-09-21-check-lexical-separability.md): a `must-not-flag`
 * fixture whose value is provider-published vocabulary that also satisfies its contract's frozen pattern,
 * so no lexical rule can separate it from a positive of the same family. `citation` is the provider page. */
export interface LexicalExemption { reason: string; citation: string }
export interface Assessment { kind: Kind; tier: Tier; reason: string; sources: string[]; contract?: string; lexicalExemption?: LexicalExemption }
export interface Fixture {
  id: string; path: string; content: string; expected: ExpectedRange[];
  group: string; assessment: Assessment; detectors?: string[];
  twinOf?: string; mutation?: string; mutationKind?: string; formatReason?: string; issue?: number;
}
export interface Corpus { fixtures: Fixture[]; schemaVersion?: number; reviewStatus?: string; scope?: string; references?: unknown; milestoneReview?: unknown }
/** `action` (#95, docs/decisions/2026-09-21-add-untargeted-benign-corpus.md Decision 3): the product
 * policy action a finding carried, when the scanner reports one. Only the redact-secret adapter
 * threads it; other scanners carry no action concept and leave it undefined. */
export interface Finding extends Range { path: string; family?: string; action?: string }
export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';
/** `coDetected` is set only on a scoped twin (`flagged` scoped to its declared contract family): a finding attributed
 * to a different, known family fired on the fixture. It is evidence, not a failure of the twin's own contract. */
/** `actionCounts` (#95): tally of the product policy action (`redact`/`warn`/`block`/`allow`) carried
 * by a control's findings, when the scanner reports one (redact-secret only). Present only when at
 * least one finding carries an action; never changes `flagged`/`findings` (docs/decisions/2026-09-21-
 * add-untargeted-benign-corpus.md, Decision 3 — additive, never a redefinition of falseAlarmRate). */
export interface RowScore { spanOutcomes?: Outcome[]; leakedBytes?: number; collateralBytes?: number; flagged?: boolean; findings?: number; coDetected?: boolean; actionCounts?: Record<string, number> }
export interface ScoredRow extends RowScore {
  id: string; path: string; group: string; kind?: Kind; tier?: Tier; contract?: string; twinOf?: string;
  expected: ExpectedRange[]; actual: (Range & { family?: string; action?: string })[];
}
export interface Group {
  files: number; scored?: boolean; spans?: number; secretBytes?: number; outcomes?: Record<string, number>;
  flaggedFiles?: number; findings?: number; falseAlarmRate?: number | null; meanFindingsPerFlagged?: number | null;
  leakedSpans?: number; leakedSpanRate?: number | null; leakedBytes?: number; leakedByteRate?: number | null;
  collateralBytes?: number; collateralRatio?: number | null;
  twins?: { positives: number; pairs: number; discriminated: number; coDetected: number; rate: number | null };
  diagnostics?: { exact: { tp?: number; fp: number; fn?: number; tn?: number }; comparable: boolean };
}
/** Engine v1.1 accounting (docs/specs/evaluation-engine-v1.1.md). Floors live in qualification/suite-v1.json. */
export type Floor = number | ({ default: number } & Record<string, number>);
export interface AccountingConfig {
  version: '1.1'; minDenominator: number; resolvedRateFloor: Floor; measurableShareFloor: Floor; twinCoverageFloor: Floor;
  replays: number; intervalZ: number; intervalPrecision: number;
}
/** `bound` is the pessimistic Wilson endpoint; unbounded ratios carry `bound: null` by decision. */
export interface Rate { point: number; bound: number | null; n: number; direction: 'upper' | 'lower' | null }
export type Published = Rate | 'insufficient-evidence' | null;
export interface AccountedGroup {
  files: number; scored?: boolean; candidateKinds?: Record<string, number>;
  spans?: number; secretBytes?: number; outcomes?: Record<string, number>;
  pendingFiles?: number; measurableShare?: Published; envelopeWidth?: { spans: number; bytes: number };
  flaggedFiles?: number; findings?: number; falseAlarmRate?: Published; meanFindingsPerFlagged?: Published;
  leakedSpans?: number; leakedSpanRate?: Published; leakedBytes?: number; leakedByteRate?: Published;
  collateralBytes?: number; collateralRatio?: Published;
  twins?: { positives: number; pairs: number; discriminated: number; coDetected: number; coverage: Published; rate: Published | 'insufficient-coverage' };
  diagnostics?: Group['diagnostics'];
}
export type DeltaCause = 'unresolved' | 't0-share' | 'overbroad-twin' | 'not-measured' | 'twin-coverage' | 'interval' | 'unstable';
export interface AccountingDelta {
  version: '1.0 -> 1.1';
  groups: Record<string, { v10: Record<string, number | null>; v11: Record<string, Published | 'insufficient-coverage'>; cause: DeltaCause[] }>;
}
export interface AccountedCounts {
  pass: number; fail: number; 'review-required': number; 'not-measured': number;
  total: number; resolved: number; unresolved: number; resolvedRate: Published;
}
export interface FormatContract {
  tier: Tier; pattern?: string; structural?: boolean; review?: string; companion?: string; references?: string[];
  providerSource?: { url: string; observedAt: string; formatVersion: string; covers: string };
  candidateSource?: FormatContract['providerSource']; corroboration?: { tool: string; label: string; url: string }[];
  /** Documentation establishing the one property this family's twins mutate, when the tier carries no `providerSource` (#36). */
  twinSource?: FormatContract['providerSource'];
  /** No twin is authored: documentation establishes nothing mutable. Published as its own line, never inside the twin rate (#36). */
  unprobeable?: { reason: string; observedAt: string };
  /** An explicit claim of a fixture profile (benchmarks/support/fixture-profiles.json, #206). A claim is always enforced: a family that does not meet it cannot read stable. Absent, a T1 provider-documented family is measured against `stable-documented` at that profile's own enforcement mode. */
  fixtureProfile?: 'arrival-provisional' | 'stable-documented' | 'stable-empirical' | 'context-constrained-empirical';
  /** The contexts a `context-constrained-empirical` family supports; required by that profile, and the family makes no bare-value support claim. */
  supportedContext?: string[];
  /** A structural constraint `pattern` alone can't express (#128). `lexical.mutate()` consults this, when present, in addition to `pattern`: a value the regex matches but this rejects is still contract-invalid. */
  validate?: (value: string) => boolean;
}
export interface Category { id: string; kind: string; corpus: string }
