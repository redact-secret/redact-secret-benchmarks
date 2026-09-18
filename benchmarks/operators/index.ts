import type { Operator } from '../engine/types.ts';
import { createRegistry } from '../engine/registry.ts';
import { contextOperators } from './context.ts';
import { lexicalOperators } from './lexical.ts';
import { authoredTwin } from './authored-twin.ts';
import { boundary, structural } from './structural.ts';

export function createOperators() {
  const registry = createRegistry<Operator>('operator', ['supports', 'generate']);
  for (const operator of [authoredTwin, ...contextOperators, ...lexicalOperators, boundary, structural]) registry.register(operator);
  return registry;
}
