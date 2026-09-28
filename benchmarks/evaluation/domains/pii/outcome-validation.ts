import { isPiiJurisdiction } from './jurisdictions.ts';
import type { PiiOutcome } from './types.ts';

export interface PiiOutcomeExpectation {
  type: 'valid' | 'invalid';
  sensitivity: 'sensitive' | 'non-sensitive' | 'not-established';
}

const STATUSES = ['pass', 'fail', 'review-required', 'not-measured'] as const;
export type PiiAxisStatus = typeof STATUSES[number];
export const PII_TYPE_STATES = Object.freeze(['correct', 'miss', 'invalid-correct', 'invalid-accepted', 'wrong-family', 'wrong-jurisdiction', 'not-measured'] as const);
export const PII_SENSITIVITY_STATES = Object.freeze(['correct', 'miss', 'false-positive', 'unresolved', 'not-measured'] as const);
export type PiiTypeState = typeof PII_TYPE_STATES[number];
export type PiiSensitivityState = typeof PII_SENSITIVITY_STATES[number];

/** The authored expectation decides which states an observation can reach; the rest cannot occur, which is not the same as zero. */
export function piiReachableTypeStates(type: PiiOutcomeExpectation['type']): readonly PiiTypeState[] {
  return type === 'valid' ? ['correct', 'miss', 'wrong-family', 'wrong-jurisdiction', 'not-measured'] : ['invalid-correct', 'invalid-accepted', 'not-measured'];
}
export function piiReachableSensitivityStates(sensitivity: PiiOutcomeExpectation['sensitivity']): readonly PiiSensitivityState[] {
  return sensitivity === 'not-established' ? ['unresolved', 'not-measured'] :
    sensitivity === 'sensitive' ? ['correct', 'miss', 'not-measured'] : ['correct', 'false-positive', 'not-measured'];
}
/** Status is derived from state, never authored beside it. */
export const piiTypeStatus = (state: PiiTypeState): PiiAxisStatus =>
  state === 'not-measured' ? 'not-measured' : state === 'correct' || state === 'invalid-correct' ? 'pass' : 'fail';
export const piiSensitivityStatus = (state: PiiSensitivityState): PiiAxisStatus =>
  state === 'not-measured' ? 'not-measured' : state === 'unresolved' ? 'review-required' : state === 'correct' ? 'pass' : 'fail';
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const family = (value: unknown) => {
  if (typeof value !== 'string' || !/^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return false;
  const scope = value.split(':')[1];
  return scope === 'global' || isPiiJurisdiction(scope.toUpperCase());
};

/** Shared fail-closed validator for domain-owned outcome semantics. */
export function validatePiiOutcome(value: any, context: { scanner: string; variant: string; expectation: PiiOutcomeExpectation; scannerStatus?: string }): PiiOutcome {
  const typeStates: readonly string[] = PII_TYPE_STATES, sensitivityStates: readonly string[] = PII_SENSITIVITY_STATES;
  if (!exact(value, ['scanner', 'variant', 'typeIdentity', 'sensitivityContext', 'range', 'observed']) || value.scanner !== context.scanner || value.variant !== context.variant ||
      !exact(value.typeIdentity, ['axis', 'status', 'state', 'reason']) || value.typeIdentity.axis !== 'type-identity' ||
      !STATUSES.includes(value.typeIdentity.status) || !typeStates.includes(value.typeIdentity.state) || typeof value.typeIdentity.reason !== 'string' ||
      !exact(value.sensitivityContext, ['axis', 'status', 'state', 'reason']) || value.sensitivityContext.axis !== 'sensitivity-context' ||
      !STATUSES.includes(value.sensitivityContext.status) || !sensitivityStates.includes(value.sensitivityContext.state) || typeof value.sensitivityContext.reason !== 'string' ||
      !['exact', 'overbroad', 'partial', 'miss', 'not-applicable'].includes(value.range) ||
      !exact(value.observed, ['findingCount', 'families', 'jurisdictions']) || !Number.isInteger(value.observed.findingCount) || value.observed.findingCount < 0 ||
      !Array.isArray(value.observed.families) || new Set(value.observed.families).size !== value.observed.families.length || value.observed.families.some((item: unknown) => !family(item)) ||
      !Array.isArray(value.observed.jurisdictions) || new Set(value.observed.jurisdictions).size !== value.observed.jurisdictions.length ||
      value.observed.jurisdictions.some((item: unknown) => !isPiiJurisdiction(item))) throw new Error('Invalid PII outcome');
  const typeStatus = piiTypeStatus(value.typeIdentity.state), sensitivityStatus = piiSensitivityStatus(value.sensitivityContext.state);
  const validTypeStates: readonly string[] = piiReachableTypeStates(context.expectation.type);
  const validSensitivityStates: readonly string[] = piiReachableSensitivityStates(context.expectation.sensitivity);
  if (value.typeIdentity.status !== typeStatus || value.sensitivityContext.status !== sensitivityStatus ||
      !validTypeStates.includes(value.typeIdentity.state) || !validSensitivityStates.includes(value.sensitivityContext.state) ||
      (context.scannerStatus !== undefined && context.scannerStatus !== 'complete' &&
        (value.typeIdentity.state !== 'not-measured' || value.sensitivityContext.state !== 'not-measured' || value.range !== 'not-applicable' ||
          value.observed.findingCount !== 0 || value.observed.families.length !== 0 || value.observed.jurisdictions.length !== 0)))
    throw new Error('PII outcome contradicts its authored expectation');
  return value as PiiOutcome;
}
