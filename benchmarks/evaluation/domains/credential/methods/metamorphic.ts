import type { Method } from '../../../model/types.ts';
import { generate, evaluate } from '../method-common.ts';
export const metamorphic: Method = { id: 'metamorphic', version: 1, generate, evaluate,
  validateCase(c) { if (!c.operators.length) throw new Error('Metamorphic needs a transformation'); },
};
