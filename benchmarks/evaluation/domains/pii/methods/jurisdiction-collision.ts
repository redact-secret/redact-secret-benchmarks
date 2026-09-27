import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod, PiiValidator } from '../types.ts';
import type { PiiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { piiBenignCollisionEvidence, piiEvidenceEntryForCase } from '../benign-collision-evidence.ts';
import type { Registry } from '../../../substrate/registry.ts';
import { observePiiValidator } from '../validators.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

function collision(c: Parameters<PiiMethod['validateCase']>[0]) {
  const value = c.metadata?.collision as { targetFamily?: unknown; competingFamilies?: unknown;
    target?: { family?: unknown }; competitors?: { family?: unknown }[] } | undefined;
  const targetFamily = value?.targetFamily ?? value?.target?.family;
  const competingFamilies = value?.competingFamilies ?? value?.competitors?.map(row => row.family);
  const family = (candidate: unknown) => typeof candidate === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate);
  if (!value || targetFamily !== c.contract.family || !Array.isArray(competingFamilies) || !competingFamilies.length ||
      !family(targetFamily) || competingFamilies.some(candidate => !family(candidate) || candidate === targetFamily))
    throw new Error('Invalid PII jurisdiction collision');
  return { targetFamily: targetFamily as string, competingFamilies: [...new Set(competingFamilies as string[])].sort() };
}

const methodVersion = 3;
export const jurisdictionCollision = (validators: Registry<PiiValidator>, evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence): PiiMethod => ({
  id: 'jurisdiction-collision', version: methodVersion,
  validateCase(c) {
    validatePiiCase(c); if (c.method !== this.id) throw new Error('Jurisdiction-collision method mismatch');
    const authored = collision(c);
    const entry = piiEvidenceEntryForCase(c, evidence);
    if (entry) {
      if (!entry.collision ||
          entry.collision.target.family !== authored.targetFamily || JSON.stringify(entry.collision.competitors.map(row => row.family).sort()) !== JSON.stringify(authored.competingFamilies))
        throw new Error('Invalid PII collision evidence identity');
    }
  },
  generate(c) {
    this.validateCase(c); const entry = piiEvidenceEntryForCase(c, evidence), authored = collision(c);
    const validations = entry?.collision ? [entry.collision.target, ...entry.collision.competitors].map(party => {
      const validator = validators.get(party.validator.id);
      if (validator.version !== party.validator.version) throw new Error('PII collision validator version mismatch');
      const observed = observePiiValidator(validator, candidateValue(c.input.content, c.candidate)).state;
      if (observed !== party.validator.expected) throw new Error('PII collision validator expectation mismatch');
      return { family: party.family, validator: party.validator.id, version: party.validator.version, expected: party.validator.expected, observed };
    }) : [];
    return [piiVariant(c, 'collision', c.input, c.contract, 'authored', { methodVersion,
      evidence: { kind: 'jurisdiction-collision', ...authored,
        ...(entry ? { evidenceId: entry.id, evidenceClass: entry.evidenceClass, accountingClass: entry.accountingClass,
          contextGroup: entry.contextGroup, expectedOutcomes: entry.collision!.expectedOutcomes, validators: validations } : {}) } })];
  },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { collision: context.variants[0].evidence } }; },
});
