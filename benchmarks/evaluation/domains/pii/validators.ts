import { createRegistry, type Registry } from '../../substrate/registry.ts';
import type { PiiValidator } from './types.ts';

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
