import { isPiiJurisdiction } from './jurisdictions.ts';
import type { PiiOutcome } from './types.ts';

export interface PiiOutcomeExpectation {
  type: 'valid' | 'invalid';
  sensitivity: 'sensitive' | 'non-sensitive' | 'not-established';
}

const STATUSES = ['pass', 'fail', 'review-required', 'not-measured'] as const;
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const family = (value: unknown) => {
  if (typeof value !== 'string' || !/^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return false;
  const scope = value.split(':')[1];
  return scope === 'global' || isPiiJurisdiction(scope.toUpperCase());
};

/** Shared fail-closed validator for domain-owned outcome semantics. */
export function validatePiiOutcome(value: any, context: { scanner: string; variant: string; expectation: PiiOutcomeExpectation; scannerStatus?: string }): PiiOutcome {
  const typeStates = ['correct', 'miss', 'invalid-correct', 'invalid-accepted', 'wrong-family', 'wrong-jurisdiction', 'not-measured'];
  const sensitivityStates = ['correct', 'miss', 'false-positive', 'unresolved', 'not-measured'];
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
  const typeStatus = value.typeIdentity.state === 'not-measured' ? 'not-measured' : ['correct', 'invalid-correct'].includes(value.typeIdentity.state) ? 'pass' : 'fail';
  const sensitivityStatus = value.sensitivityContext.state === 'not-measured' ? 'not-measured' : value.sensitivityContext.state === 'unresolved'
    ? 'review-required' : value.sensitivityContext.state === 'correct' ? 'pass' : 'fail';
  const validTypeStates = context.expectation.type === 'valid' ? ['correct', 'miss', 'wrong-family', 'wrong-jurisdiction', 'not-measured'] :
    ['invalid-correct', 'invalid-accepted', 'not-measured'];
  const validSensitivityStates = context.expectation.sensitivity === 'not-established' ? ['unresolved', 'not-measured'] :
    context.expectation.sensitivity === 'sensitive' ? ['correct', 'miss', 'not-measured'] : ['correct', 'false-positive', 'not-measured'];
  if (value.typeIdentity.status !== typeStatus || value.sensitivityContext.status !== sensitivityStatus ||
      !validTypeStates.includes(value.typeIdentity.state) || !validSensitivityStates.includes(value.sensitivityContext.state) ||
      (context.scannerStatus !== undefined && context.scannerStatus !== 'complete' &&
        (value.typeIdentity.state !== 'not-measured' || value.sensitivityContext.state !== 'not-measured' || value.range !== 'not-applicable' ||
          value.observed.findingCount !== 0 || value.observed.families.length !== 0 || value.observed.jurisdictions.length !== 0)))
    throw new Error('PII outcome contradicts its authored expectation');
  return value as PiiOutcome;
}
