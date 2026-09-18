import { evaluateAssertions } from '../engine/assertions.mjs';

export function generate(c, { operators, variant }) {
  const variants = [variant(c, 'canonical', c.seed, { method: c.method, methodVersion: 1, operator: 'identity', operatorVersion: 1 })];
  for (const spec of c.operators) {
    const operator = operators.get(spec.id);
    if (!operator.supports(c, spec.parameters ?? {})) throw new Error('Unsupported case operator');
    const output = operator.generate(structuredClone(c), spec.parameters ?? {});
    variants.push(variant(c, spec.id, output.fixture, {
      method: c.method, methodVersion: 1, operator: operator.id, operatorVersion: operator.version,
      parameters: spec.parameters ?? {}, property: output.property,
      relation: output.relation, ...(output.integrity ? { integrity: output.integrity } : {}),
      ...(output.contractMatch === undefined ? {} : { contractMatch: output.contractMatch }),
    }, output.strategy));
  }
  return variants;
}

export const evaluate = context => ({ scanners: evaluateAssertions(context), queue: [] });
