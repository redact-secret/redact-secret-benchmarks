import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod } from '../types.ts';
import { evaluatePiiVariants } from './common.ts';

const classes = ['reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative'];
export const piiBenign: PiiMethod = {
  id: 'pii-benign', version: 1,
  validateCase(c) {
    validatePiiCase(c);
    const controlClass = c.metadata?.benignClass;
    if (c.method !== this.id || c.contract.sensitivityExpectation !== 'non-sensitive' || !classes.includes(String(controlClass)))
      throw new Error('Invalid PII benign control');
  },
  generate(c) { this.validateCase(c); return [piiVariant(c, String(c.metadata!.benignClass), c.input, c.contract, 'authored',
    { evidence: { kind: 'semantic-control', controlClass: c.metadata!.benignClass } })]; },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { control: context.variants[0].evidence } }; },
};
