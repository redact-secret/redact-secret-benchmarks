import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod, PiiValidator } from '../types.ts';
import type { PiiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { piiBenignCollisionEvidence, piiEvidenceEntryForCase } from '../benign-collision-evidence.ts';
import { PII_BENIGN_ACCOUNTING_CLASSES } from '../benign-collision-classes.ts';
import type { Registry } from '../../../substrate/registry.ts';
import { observePiiValidator } from '../validators.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

const methodVersion = 3;
export const piiBenign = (validators: Registry<PiiValidator>, evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence): PiiMethod => ({
  id: 'pii-benign', version: methodVersion,
  validateCase(c) {
    validatePiiCase(c);
    const accountingClass = c.metadata?.accountingClass ?? c.metadata?.benignClass;
    if (c.method !== this.id || c.contract.sensitivityExpectation !== 'non-sensitive' || !PII_BENIGN_ACCOUNTING_CLASSES.includes(accountingClass as any))
      throw new Error('Invalid PII benign control');
    const entry = piiEvidenceEntryForCase(c, evidence);
    if (entry && (entry.accountingClass !== accountingClass || entry.collision !== null || entry.evidenceClass === 'near-miss' || entry.evidenceClass === 'cross-family-collision'))
      throw new Error('Invalid PII benign evidence identity');
  },
  generate(c) {
    this.validateCase(c); const entry = piiEvidenceEntryForCase(c, evidence), accountingClass = c.metadata?.accountingClass ?? c.metadata?.benignClass;
    const validation = entry?.validator ? (() => { const validator = validators.get(entry.validator!.id);
      if (validator.version !== entry.validator!.version) throw new Error('PII evidence validator version mismatch');
      const observed = observePiiValidator(validator, candidateValue(c.input.content, c.candidate)).state;
      if (observed !== entry.validator!.expected) throw new Error('PII evidence validator expectation mismatch');
      return { ...entry.validator!, observed };
    })() : null;
    return [piiVariant(c, String(accountingClass), c.input, c.contract, 'authored', { methodVersion,
      evidence: { kind: 'semantic-control', controlClass: accountingClass,
        ...(entry ? { evidenceId: entry.id, evidenceClass: entry.evidenceClass, accountingClass: entry.accountingClass,
          contextGroup: entry.contextGroup, validator: validation } : {}) } })];
  },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { control: context.variants[0].evidence } }; },
});
