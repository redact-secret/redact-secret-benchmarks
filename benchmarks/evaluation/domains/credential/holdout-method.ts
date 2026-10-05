import type { Method, Operator } from '../../model/types.ts';
import { createRegistry } from '../../substrate/registry.ts';
import { generate, evaluate } from './method-common.ts';

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

// A holdout case never names an operator (`validateCase` refuses any), so the registry the run is given is never consulted: the protected
// lifecycle gets an empty one instead of the development operators, and no removable operator code is imported by it (#660).
export function createHoldoutOperators() {
  return createRegistry<Operator>('operator', ['supports', 'generate']);
}
