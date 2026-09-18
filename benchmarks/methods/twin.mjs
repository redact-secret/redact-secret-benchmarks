import { secrets } from '../engine/model.mjs';
import { generate, evaluate } from './common.mjs';
export const twin = { id: 'twin', version: 1, generate, evaluate,
  validateCase(c) {
    if (!secrets(c.seed).length || c.operators.length !== 1) throw new Error('Twin needs a positive and one semantic mutation');
  },
};
