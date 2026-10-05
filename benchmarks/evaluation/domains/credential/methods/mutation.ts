import type { Method } from '../../../model/types.ts';
import { generate, evaluate } from '../method-common.ts';
export const mutation: Method = { id: 'mutation', version: 1, generate, evaluate,
  validateCase(c) { if (!c.operators.length) throw new Error('Mutation needs an operator'); },
};
