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

export function createPiiValidators(entries: PiiValidator[] = [syntheticChecksum]): Registry<PiiValidator> {
  const registry = createRegistry<PiiValidator>('PII validator', ['validate']);
  for (const entry of entries) registry.register(entry);
  return registry;
}
