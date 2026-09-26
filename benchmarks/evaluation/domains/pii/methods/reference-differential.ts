import type { Registry } from '../../../substrate/registry.ts';
import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod, PiiValidator } from '../types.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

export const referenceDifferential = (validators: Registry<PiiValidator>): PiiMethod => ({
  id: 'reference-differential', version: 1,
  validateCase(c) {
    validatePiiCase(c);
    if (c.method !== this.id || !c.contract.referenceEvidence) throw new Error('Reference-differential method requires reference evidence');
    const validator = validators.get(c.contract.referenceEvidence.id);
    if (validator.version !== c.contract.referenceEvidence.version) throw new Error('PII reference version mismatch');
  },
  generate(c) {
    this.validateCase(c);
    const validator = validators.get(c.contract.referenceEvidence!.id);
    const observation = validator.validate(candidateValue(c.input.content, c.candidate));
    return [piiVariant(c, 'reference', c.input, c.contract, observation.state === 'unavailable' ? 'review-required' : 'authored',
      { evidence: { kind: 'reference-observation', reference: validator.id, referenceVersion: validator.version,
        state: observation.state, role: 'observation-not-truth' } })];
  },
  evaluate(context) {
    const result = evaluatePiiVariants(context), observation = context.variants[0].evidence!;
    const disagrees = observation.state === 'unavailable' || observation.state !== context.case.contract.typeExpectation.state;
    if (observation.state === 'unavailable') for (const outcome of result.outcomes) outcome.typeIdentity = {
      axis: 'type-identity', status: 'not-measured', state: 'not-measured', reason: 'Independent reference evidence was unavailable.',
    };
    if (disagrees) result.reviews.push(...result.outcomes.map(outcome => ({ id: `${outcome.scanner}/${outcome.variant}/reference`, variant: outcome.variant,
      reason: observation.state === 'unavailable' ? 'Reference validator unavailable.' : 'Reference observation differs from the authored expectation.' })));
    return { ...result, evidence: { reference: observation, disposition: disagrees ? 'review-required' : 'observed' } };
  },
});
