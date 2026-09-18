import { createRegistry } from '../engine/registry.mjs';
import { contextOperators } from './context.mjs';
import { lexicalOperators } from './lexical.mjs';
import { authoredTwin } from './authored-twin.mjs';

export function createOperators() {
  const registry = createRegistry('operator', ['supports', 'generate']);
  for (const operator of [authoredTwin, ...contextOperators, ...lexicalOperators]) registry.register(operator);
  return registry;
}
