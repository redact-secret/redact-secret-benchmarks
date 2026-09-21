import type { Method } from '../engine/types.ts';
import { secrets } from '../engine/model.ts';
import { AXES, REAL_WORLD_AXES } from '../lib/assessment.ts';
import { generate, evaluate } from './common.ts';
// Two disjoint, equally valid taxonomies feed this method: AXES (family-control
// vocabulary, #91) and REAL_WORLD_AXES (untargeted `real-world-shapes`, #95).
const VOCABULARY: readonly string[] = [...AXES, ...REAL_WORLD_AXES];
export const benign: Method = { id: 'benign', version: 1, generate, evaluate,
  validateCase(c) {
    if (secrets(c.seed).length || c.seed.assessment.kind !== 'must-not-flag' || !c.taxonomy || c.operators.length || !VOCABULARY.includes(c.taxonomy))
      throw new Error('Benign needs a classified control and taxonomy');
  },
};
