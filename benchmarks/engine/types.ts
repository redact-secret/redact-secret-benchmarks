import type { Fixture, Finding, Range, ScoredRow } from '../types.ts';
import type { describeCase, describeVariant } from './reporting.ts';
import type { variant } from './model.ts';

export interface Registry<T> { register(entry: T): Registry<T>; get(id: string): T; values(): T[] }
export interface CaseSeed {
  seed: Fixture; twin?: Fixture; targets: string[]; visibility: 'development' | 'regression';
  source: { category: string; fixtureId: string; path: string };
  operators: { id: string; parameters?: Record<string, unknown> }[];
  provenance: { source: string; sourceHash: string; rationale: string; seed: string; reviewStatus?: string; sources: string[] };
}
export interface EvaluationCase extends CaseSeed { id: string; method: string; taxonomy?: string }
export type Strategy = 'authored' | 'derived' | 'review-required';
export type Relation = 'same-detection' | 'must-flip';
export interface Transformation {
  method: string; methodVersion: number; operator: string; operatorVersion: number;
  parameters?: Record<string, unknown>; property?: string; relation?: Relation | null;
  integrity?: { kind: string; property?: string }; contractMatch?: boolean;
}
export interface GeneratedVariant {
  id: string; parentCaseId: string; fixture: Fixture; strategy: Strategy; transformation: Transformation;
  provenance: { seed: string; sourceHash: string; fixtureHash: string; contentHash: string; transformationHash: string };
}
export interface Operator {
  id: string; version: number;
  supports(c: CaseSeed, parameters?: Record<string, unknown>): boolean;
  generate(c: EvaluationCase, parameters?: Record<string, unknown>): {
    fixture: Fixture; strategy: Strategy; property?: string; relation?: Relation | null;
    integrity?: Transformation['integrity']; contractMatch?: boolean;
  };
}
export interface Scanner {
  id: string; mode: string;
  version(directory: string): Promise<string>;
  scan(directory: string, fixtures: Pick<Fixture, 'id' | 'path' | 'content'>[]): Promise<Finding[]>;
}
export type Observation = { id: string; version: string | null; mode: string } & (
  { status: 'complete'; findings: Finding[]; durationMs: number } |
  { status: 'unavailable' | 'error'; message: string; findings?: never }
);
export type AssertionStatus = 'pass' | 'fail' | 'review-required';
export interface Assertion { type: string; status: AssertionStatus; reason?: string; variant?: string; baseline?: string; candidate?: string }
export interface ScannerResult { scanner: string; status: Observation['status']; variants: { id: string; row: ScoredRow }[]; assertions: Assertion[] }
export interface ReviewEntry { variant: string; peer?: string; disagreement?: string; status: 'review-required'; observations?: Record<string, Range[]> }
export interface EvaluationContext { case: EvaluationCase; variants: GeneratedVariant[]; observations: Observation[] }
export interface MethodResult {
  scanners: ScannerResult[]; queue: ReviewEntry[];
  comparisons?: { variant: string; peer: string; status: 'complete' | 'incomplete'; disagreement?: string }[];
  observations?: { scanner: string; status: Observation['status']; variants: { id: string; actual: Range[] }[] }[];
  capabilities?: { ranges: boolean; classification: boolean; redaction: boolean }; complete?: boolean;
}
export interface Method {
  id: string; version: number; validateCase(c: EvaluationCase): void;
  generate(c: EvaluationCase, context: { operators: Registry<Operator>; variant: typeof variant }): GeneratedVariant[];
  evaluate(context: EvaluationContext): MethodResult;
}
export type CaseResult = ReturnType<typeof describeCase> & MethodResult & { variants: ReturnType<typeof describeVariant>[] };
export type Summary = Record<string, Record<AssertionStatus, number>>;
