import type { Method } from '../engine/types.ts';
import { secrets } from '../engine/model.ts';
import { generate, evaluate } from './common.ts';
export const benign: Method = { id: 'benign', version: 1, generate, evaluate,
  validateCase(c) {
    if (secrets(c.seed).length || c.seed.assessment.kind !== 'must-not-flag' || !c.taxonomy || c.operators.length)
      throw new Error('Benign needs a classified control and taxonomy');
  },
};
