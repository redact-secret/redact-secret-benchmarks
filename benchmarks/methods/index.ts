import type { Method } from '../engine/types.ts';
import { createRegistry } from '../engine/registry.ts';
import { twin } from './twin.ts';
import { benign } from './benign.ts';
import { metamorphic } from './metamorphic.ts';
import { mutation } from './mutation.ts';
import { differential } from './differential.ts';
export function createMethods() {
  const registry = createRegistry<Method>('method', ['validateCase', 'generate', 'evaluate']);
  for (const method of [twin, benign, metamorphic, mutation, differential]) registry.register(method);
  return registry;
}
