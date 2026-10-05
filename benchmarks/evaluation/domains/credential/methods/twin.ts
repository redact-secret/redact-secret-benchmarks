import type { Method } from '../../../model/types.ts';
import { secrets } from '../../../model/model.ts';
import { generate, evaluate } from '../method-common.ts';
export const twin: Method = { id: 'twin', version: 1, generate, evaluate,
  validateCase(c) {
    if (!secrets(c.seed).length || c.operators.length !== 1) throw new Error('Twin needs a positive and one semantic mutation');
  },
};
