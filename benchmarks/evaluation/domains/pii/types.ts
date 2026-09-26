import type { RuntimeFinding, RuntimeInput, RuntimeObservation, RuntimeScanner } from '../../substrate/runtime.ts';

export type PiiScope = { kind: 'global' } | { kind: 'jurisdictional'; jurisdiction: string };
export type PiiSensitivityExpectation = 'sensitive' | 'non-sensitive' | 'unresolved';
export type PiiAssertionStatus = 'pass' | 'fail' | 'review-required' | 'not-measured';
export type PiiRangeOutcome = 'exact' | 'overbroad' | 'partial' | 'miss' | 'not-applicable';

export interface PiiAuthority {
  kind: 'standard' | 'public-authority' | 'official-test-source';
  locator: string;
  version: string;
  claim: 'format' | 'allocation' | 'context' | 'test-vector';
  observedAt: string;
}

export interface PiiContract {
  category: string;
  family: string;
  scope: PiiScope;
  typeExpectation: { state: 'valid' | 'invalid'; validator: string | null };
  sensitivityExpectation: PiiSensitivityExpectation;
  context: { obligation: 'required' | 'optional' | 'forbidden'; class: 'sensitive' | 'neutral' | 'non-sensitive'; language: string };
  authority: PiiAuthority;
  referenceEvidence: { id: string; version: number } | null;
  qualificationProfile: { id: 'pii-v1'; version: 1 };
}

export interface PiiCase {
  id: string;
  method: string;
  visibility: 'development' | 'regression' | 'holdout';
  input: RuntimeInput;
  candidate: { start: number; end: number };
  contract: PiiContract;
  provenance: { source: string; sourceHash: string; seed: string; rationale: string; sources: string[] };
  metadata?: Record<string, unknown>;
}

export interface PiiTransformation {
  method: string;
  methodVersion: number;
  operator: string;
  operatorVersion: number;
  expectationEffect: { type: 'preserve' | 'invalidate' | 'defer'; sensitivity: 'preserve' | 'change' | 'defer' };
}

export interface PiiVariant {
  id: string;
  parentCaseId: string;
  fixture: RuntimeInput;
  strategy: 'authored' | 'derived' | 'review-required';
  transformation: PiiTransformation;
  contract: PiiContract;
  candidate: { start: number; end: number };
  evidence?: Record<string, unknown>;
  provenance: { seed: string; sourceHash: string; fixtureHash: string; contentHash: string; transformationHash: string };
}

export interface PiiFinding extends RuntimeFinding {
  family?: string;
  jurisdiction?: string;
  sensitive?: boolean;
}

export interface PiiAxisAssertion<TState extends string> {
  axis: 'type-identity' | 'sensitivity-context';
  status: PiiAssertionStatus;
  state: TState;
  reason: string;
}

export interface PiiOutcome {
  scanner: string;
  variant: string;
  typeIdentity: PiiAxisAssertion<'correct' | 'miss' | 'invalid-correct' | 'invalid-accepted' | 'wrong-family' | 'wrong-jurisdiction' | 'not-measured'>;
  sensitivityContext: PiiAxisAssertion<'correct' | 'miss' | 'false-positive' | 'unresolved' | 'not-measured'>;
  range: PiiRangeOutcome;
  observed: { findingCount: number; families: string[]; jurisdictions: string[] };
}

export interface PiiMethodResult {
  outcomes: PiiOutcome[];
  reviews: { id: string; variant: string; reason: string }[];
  evidence?: Record<string, unknown>;
}

export interface PiiGeneratedCase { case: PiiCase; variants: PiiVariant[]; attempts: { operator: string; status: 'generated' | 'unsupported' | 'error'; reason?: string }[]; method: PiiMethod }
export interface PiiMethodContext { case: PiiCase; variants: PiiVariant[]; observations: RuntimeObservation<PiiFinding>[] }
export interface PiiMethod {
  id: string; version: number;
  validateCase(c: PiiCase): void;
  generate(c: PiiCase): PiiVariant[];
  evaluate(context: PiiMethodContext): PiiMethodResult;
}

export type PiiValidationState = 'valid' | 'invalid' | 'unavailable';
export interface PiiValidator {
  id: string; version: number;
  validate(value: string): { state: PiiValidationState };
}
export interface PiiOperatorResult {
  input: RuntimeInput; candidate: { start: number; end: number };
  expectation: { type: PiiContract['typeExpectation']['state']; sensitivity: PiiSensitivityExpectation };
}
export interface PiiOperator {
  id: string; version: number;
  apply(c: PiiCase): PiiOperatorResult;
}

export type PiiScanner = RuntimeScanner<PiiFinding>;
