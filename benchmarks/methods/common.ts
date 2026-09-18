import type { Method, GenerationAttempt } from '../engine/types.ts';
import { evaluateAssertions } from '../engine/assertions.ts';
import { hash, safeParameters } from '../engine/model.ts';

export const generate: Method['generate'] = (c, { operators, variant, methodVersion = 1 }) => {
  const variants = [variant(c, 'canonical', c.seed, { method: c.method, methodVersion, operator: 'identity', operatorVersion: 1 })];
  const attempts: GenerationAttempt[] = [];
  if (new Set(c.operators.map(s => s.id)).size !== c.operators.length) throw new Error('Duplicate operator specification');
  for (const spec of c.operators) {
    const operator = operators.get(spec.id);
    const parameters = spec.parameters ?? {};
    const attempt: GenerationAttempt = { operator: operator.id, operatorVersion: operator.version,
      parameters: safeParameters(parameters), parametersHash: hash(parameters), status: 'generated' };
    attempts.push(attempt);
    try {
      if (!operator.supports(c, parameters)) {
        Object.assign(attempt, { status: 'unsupported', reason: 'Input or parameters are outside the operator contract.' });
        continue;
      }
      const output = operator.generate(structuredClone(c), structuredClone(parameters));
      const resolved = output.parameters ?? parameters;
      variants.push(variant(c, spec.id, output.fixture, {
        method: c.method, methodVersion, operator: operator.id, operatorVersion: operator.version,
        parameters: resolved, property: output.property,
        expectationEffect: output.expectationEffect ?? (output.strategy === 'review-required' ? 'defer' : output.relation === 'must-flip' ? 'invalidate' : 'preserve'),
        relation: output.relation, ...(output.integrity ? { integrity: output.integrity } : {}),
        ...(output.contractMatch === undefined ? {} : { contractMatch: output.contractMatch }),
      }, output.strategy));
      Object.assign(attempt, { variant: spec.id, parameters: safeParameters(resolved), parametersHash: hash(resolved) });
    } catch {
      Object.assign(attempt, { status: 'error', reason: 'Transformation generation or validation failed; raw error suppressed.' });
    }
  }
  return { variants, attempts };
}

export const evaluate: Method['evaluate'] = context => ({ scanners: evaluateAssertions(context), queue: [] });
