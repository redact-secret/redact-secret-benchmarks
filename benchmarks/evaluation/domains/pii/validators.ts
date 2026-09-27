import { createRegistry, type Registry } from '../../substrate/registry.ts';
import type { PiiValidationState, PiiValidator } from './types.ts';

/** Validator hooks are untrusted: admit one exact enum and reconstruct it. */
export function observePiiValidator(validator: PiiValidator, value: string): { state: PiiValidationState } {
  const raw: unknown = validator.validate(value);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 1 || !Object.hasOwn(raw, 'state'))
    throw new Error('Invalid PII validator observation');
  const state: unknown = (raw as { state?: unknown }).state;
  if (typeof state !== 'string' || (state !== 'valid' && state !== 'invalid' && state !== 'unavailable'))
    throw new Error('Invalid PII validator observation');
  return { state };
}

const syntheticChecksum: PiiValidator = {
  id: 'synthetic-mod10', version: 1,
  validate(value) {
    if (!/^SYNTHETIC-[0-9]{4}$/.test(value)) return { state: 'invalid' };
    const digits = [...value.slice(-4)].map(Number);
    return { state: digits.slice(0, 3).reduce((sum, digit) => sum + digit, 0) % 10 === digits[3] ? 'valid' : 'invalid' };
  },
};

export const usSsnAllocationV1: PiiValidator = {
  id: 'us-ssn-allocation', version: 1,
  validate(value) {
    if (!/^\d{9}$/.test(value)) return { state: 'invalid' };
    const area = Number(value.slice(0, 3));
    if (area === 0 || area === 666 || area >= 900 || value.slice(3, 5) === '00' || value.slice(5) === '0000')
      return { state: 'invalid' };
    return { state: 'valid' };
  },
};

export function createPiiValidators(entries: PiiValidator[] = [syntheticChecksum, usSsnAllocationV1]): Registry<PiiValidator> {
  const registry = createRegistry<PiiValidator>('PII validator', ['validate']);
  for (const entry of entries) registry.register(entry);
  return registry;
}
