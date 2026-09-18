import type { Method } from '../engine/types.ts';
import { generate, evaluate } from './common.ts';
export const mutation: Method = { id: 'mutation', version: 1, generate, evaluate,
  validateCase(c) { if (!c.operators.length) throw new Error('Mutation needs an operator'); },
};
