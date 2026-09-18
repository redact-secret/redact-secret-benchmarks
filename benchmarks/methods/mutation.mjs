import { generate, evaluate } from './common.mjs';
export const mutation = { id: 'mutation', version: 1, generate, evaluate,
  validateCase(c) { if (!c.operators.length) throw new Error('Mutation needs an operator'); },
};
