import { createRegistry } from '../engine/registry.mjs';
import { twin } from './twin.mjs';
import { benign } from './benign.mjs';
import { metamorphic } from './metamorphic.mjs';
import { mutation } from './mutation.mjs';
import { differential } from './differential.mjs';
export function createMethods() {
  const registry = createRegistry('method', ['validateCase', 'generate', 'evaluate']);
  for (const method of [twin, benign, metamorphic, mutation, differential]) registry.register(method);
  return registry;
}
