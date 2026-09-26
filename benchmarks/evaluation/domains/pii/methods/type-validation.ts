import type { Registry } from '../../../substrate/registry.ts';
import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod, PiiValidator } from '../types.ts';
import { observePiiValidator } from '../validators.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

export const typeValidation = (validators: Registry<PiiValidator>): PiiMethod => ({
  id: 'type-validation', version: 1,
  validateCase(c) {
    validatePiiCase(c);
    if (c.method !== this.id || !c.contract.typeExpectation.validator) throw new Error('Type-validation method requires a validator');
    validators.get(c.contract.typeExpectation.validator);
  },
  generate(c) {
    this.validateCase(c);
    const validator = validators.get(c.contract.typeExpectation.validator!);
    const validation = observePiiValidator(validator, candidateValue(c.input.content, c.candidate));
    if (validation.state !== 'unavailable' && validation.state !== c.contract.typeExpectation.state) throw new Error('PII validator expectation mismatch');
    return [piiVariant(c, 'validated', c.input, c.contract, validation.state === 'unavailable' ? 'review-required' : 'authored',
      { evidence: { kind: 'validator', validator: validator.id, validatorVersion: validator.version, state: validation.state } })];
  },
  evaluate(context) {
    const result = evaluatePiiVariants(context);
    const raw = context.variants[0].evidence!, evidence = { kind: 'validator', validator: String(raw.validator),
      validatorVersion: Number(raw.validatorVersion), state: String(raw.state) };
    if (evidence.state === 'unavailable') {
      for (const outcome of result.outcomes) outcome.typeIdentity = { axis: 'type-identity', status: 'not-measured', state: 'not-measured',
        reason: 'The required validator was unavailable.' };
      result.reviews.push(...result.outcomes.map(outcome => ({ id: `${outcome.scanner}/${outcome.variant}/validator`, variant: outcome.variant,
        reason: 'The required validator was unavailable.' })));
    }
    return { ...result, evidence: { validation: evidence } };
  },
});
