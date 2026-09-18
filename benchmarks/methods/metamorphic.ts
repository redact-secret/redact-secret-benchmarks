import type { Method } from '../engine/types.ts';
import { generate, evaluate } from './common.ts';
export const metamorphic: Method = { id: 'metamorphic', version: 1, generate, evaluate,
  validateCase(c) { if (!c.operators.length) throw new Error('Metamorphic needs a transformation'); },
};
