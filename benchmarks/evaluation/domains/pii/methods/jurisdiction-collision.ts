import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod } from '../types.ts';
import { evaluatePiiVariants } from './common.ts';

function collision(c: Parameters<PiiMethod['validateCase']>[0]) {
  const value = c.metadata?.collision as { targetFamily?: unknown; competingFamilies?: unknown } | undefined;
  const family = (candidate: unknown) => typeof candidate === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(candidate);
  if (!value || value.targetFamily !== c.contract.family || !Array.isArray(value.competingFamilies) || !value.competingFamilies.length ||
      !family(value.targetFamily) || value.competingFamilies.some(candidate => !family(candidate) || candidate === value.targetFamily))
    throw new Error('Invalid PII jurisdiction collision');
  return { targetFamily: value.targetFamily, competingFamilies: [...new Set(value.competingFamilies as string[])].sort() };
}

export const jurisdictionCollision: PiiMethod = {
  id: 'jurisdiction-collision', version: 1,
  validateCase(c) { validatePiiCase(c); if (c.method !== this.id) throw new Error('Jurisdiction-collision method mismatch'); collision(c); },
  generate(c) { this.validateCase(c); return [piiVariant(c, 'collision', c.input, c.contract, 'authored',
    { evidence: { kind: 'jurisdiction-collision', ...collision(c) } })]; },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { collision: context.variants[0].evidence } }; },
};
