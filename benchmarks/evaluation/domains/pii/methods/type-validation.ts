import type { Registry } from '../../../substrate/registry.ts';
import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod, PiiValidator } from '../types.ts';
import { observePiiValidator } from '../validators.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';
import type { PiiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { piiBenignCollisionEvidence, piiEvidenceEntryForCase } from '../benign-collision-evidence.ts';

const methodVersion = 2;
export const typeValidation = (validators: Registry<PiiValidator>, evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence): PiiMethod => ({
  id: 'type-validation', version: methodVersion,
  validateCase(c) {
    validatePiiCase(c);
    if (c.method !== this.id || !c.contract.typeExpectation.validator) throw new Error('Type-validation method requires a validator');
    const validator = validators.get(c.contract.typeExpectation.validator);
    const entry = piiEvidenceEntryForCase(c, evidence);
    if (entry && (entry.evidenceClass !== 'near-miss' || entry.validator === null || entry.validator.id !== validator.id ||
        entry.validator.version !== validator.version || entry.validator.expected !== entry.typeExpectation))
      throw new Error('Invalid PII near-miss validator identity');
  },
  generate(c) {
    this.validateCase(c);
    const validator = validators.get(c.contract.typeExpectation.validator!);
    const validation = observePiiValidator(validator, candidateValue(c.input.content, c.candidate));
    if (validation.state !== 'unavailable' && validation.state !== c.contract.typeExpectation.state) throw new Error('PII validator expectation mismatch');
    const entry = piiEvidenceEntryForCase(c, evidence);
    return [piiVariant(c, 'validated', c.input, c.contract, validation.state === 'unavailable' ? 'review-required' : 'authored',
      { methodVersion, evidence: { kind: 'validator', validator: validator.id, validatorVersion: validator.version, state: validation.state,
        ...(entry ? { evidenceId: entry.id, evidenceClass: entry.evidenceClass, accountingClass: entry.accountingClass,
          contextGroup: entry.contextGroup, expected: entry.validator!.expected } : {}) } })];
  },
  evaluate(context) {
    const result = evaluatePiiVariants(context);
    const raw = context.variants[0].evidence!, evidence = { kind: 'validator', validator: String(raw.validator),
      validatorVersion: Number(raw.validatorVersion), state: String(raw.state),
      ...(raw.evidenceId === undefined ? {} : { evidenceId: String(raw.evidenceId), evidenceClass: String(raw.evidenceClass),
        accountingClass: raw.accountingClass ?? null, contextGroup: raw.contextGroup ?? null, expected: String(raw.expected) }) };
    if (evidence.state === 'unavailable') {
      for (const outcome of result.outcomes) outcome.typeIdentity = { axis: 'type-identity', status: 'not-measured', state: 'not-measured',
        reason: 'The required validator was unavailable.' };
      result.reviews.push(...result.outcomes.map(outcome => ({ id: `${outcome.scanner}/${outcome.variant}/validator`, variant: outcome.variant,
        reason: 'The required validator was unavailable.' })));
    }
    return { ...result, evidence: { validation: evidence } };
  },
});
