import { generate, evaluate } from './common.mjs';
export const metamorphic = { id: 'metamorphic', version: 1, generate, evaluate,
  validateCase(c) { if (!c.operators.length) throw new Error('Metamorphic needs a transformation'); },
};
