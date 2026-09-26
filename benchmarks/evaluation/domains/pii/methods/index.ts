import { createRegistry } from '../../../substrate/registry.ts';
import type { PiiMethod } from '../types.ts';
import { schemaOnly } from './schema-only.ts';

export function createPiiMethods() {
  return createRegistry<PiiMethod>('PII method', ['validateCase', 'generate', 'evaluate']).register(schemaOnly);
}

