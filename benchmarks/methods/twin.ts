import type { Method } from '../engine/types.ts';
import { secrets } from '../engine/model.ts';
import { generate, evaluate } from './common.ts';
export const twin: Method = { id: 'twin', version: 1, generate, evaluate,
  validateCase(c) {
    if (!secrets(c.seed).length || c.operators.length !== 1) throw new Error('Twin needs a positive and one semantic mutation');
  },
};
