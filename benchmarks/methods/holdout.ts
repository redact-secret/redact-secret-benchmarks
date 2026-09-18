import type { Method } from '../engine/types.ts';
import { createRegistry } from '../engine/registry.ts';
import { generate, evaluate } from './common.ts';

export const holdout: Method = {
  id: 'holdout', version: 1, generate, evaluate,
  validateCase(c) {
    if (c.visibility !== 'holdout' || c.operators.length || c.twin || c.seed.assessment.tier === 'T0')
      throw new Error('Holdout requires frozen, scored cases without development operators');
  },
};

// Intentionally absent from createMethods(): registration requires opting in
// through the separate lifecycle, not merely selecting a CLI method name.
export function createHoldoutMethods() {
  return createRegistry<Method>('method', ['validateCase', 'generate', 'evaluate']).register(holdout);
}
