import type { Registry } from '../../../substrate/registry.ts';
import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod, PiiOperator } from '../types.ts';
import { applyPiiOperator } from '../operators.ts';
import { evaluatePiiVariants } from './common.ts';

export const mutation = (operators: Registry<PiiOperator>): PiiMethod => ({
  id: 'mutation', version: 1,
  validateCase(c) { validatePiiCase(c); if (c.method !== this.id || typeof c.metadata?.operator !== 'string') throw new Error('Invalid PII mutation case'); operators.get(c.metadata.operator); },
  generate(c) {
    this.validateCase(c);
    const operator = operators.get(c.metadata!.operator as string), transformed = applyPiiOperator(operator, c);
    const contract = { ...structuredClone(c.contract), typeExpectation: { ...c.contract.typeExpectation, state: transformed.expectation.type },
      sensitivityExpectation: transformed.expectation.sensitivity };
    return [piiVariant(c, 'mutated', transformed.input, contract, 'derived', { candidate: transformed.candidate, operator: operator.id,
      operatorVersion: operator.version, typeEffect: transformed.expectation.type === c.contract.typeExpectation.state ? 'preserve' : 'invalidate',
      evidence: { kind: 'mutation', operator: operator.id, operatorVersion: operator.version, expectation: transformed.expectation } })];
  },
  evaluate(context) {
    const raw = context.variants[0].evidence!;
    return { ...evaluatePiiVariants(context), evidence: { mutation: { kind: 'mutation', operator: String(raw.operator),
      operatorVersion: Number(raw.operatorVersion), expectation: { type: String((raw.expectation as Record<string, unknown>).type),
        sensitivity: String((raw.expectation as Record<string, unknown>).sensitivity) } } } };
  },
});
