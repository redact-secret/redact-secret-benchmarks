import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod } from '../types.ts';
import type { PiiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { piiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { hash } from '../../../substrate/hash.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

function collision(c: Parameters<PiiMethod['validateCase']>[0]) {
  const value = c.metadata?.collision as { targetFamily?: unknown; competingFamilies?: unknown } | undefined;
  const family = (candidate: unknown) => typeof candidate === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate);
  if (!value || value.targetFamily !== c.contract.family || !Array.isArray(value.competingFamilies) || !value.competingFamilies.length ||
      !family(value.targetFamily) || value.competingFamilies.some(candidate => !family(candidate) || candidate === value.targetFamily))
    throw new Error('Invalid PII jurisdiction collision');
  return { targetFamily: value.targetFamily, competingFamilies: [...new Set(value.competingFamilies as string[])].sort() };
}

const methodVersion = 2;
export const jurisdictionCollision = (evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence): PiiMethod => ({
  id: 'jurisdiction-collision', version: methodVersion,
  validateCase(c) {
    validatePiiCase(c); if (c.method !== this.id) throw new Error('Jurisdiction-collision method mismatch');
    const authored = collision(c);
    if (c.metadata?.evidenceId !== undefined) {
      const entry = evidence.entries.find(candidate => candidate.id === c.metadata!.evidenceId);
      if (!entry?.collision || entry.caseId !== c.id || entry.family !== c.contract.family || entry.typeExpectation !== c.contract.typeExpectation.state ||
          entry.sensitivityExpectation !== c.contract.sensitivityExpectation || entry.candidateCommitment !== hash(candidateValue(c.input.content, c.candidate)) ||
          entry.collision.target.family !== authored.targetFamily || JSON.stringify(entry.collision.competitors.map(row => row.family).sort()) !== JSON.stringify(authored.competingFamilies))
        throw new Error('Invalid PII collision evidence identity');
    }
  },
  generate(c) { this.validateCase(c); return [piiVariant(c, 'collision', c.input, c.contract, 'authored',
    { methodVersion, evidence: { kind: 'jurisdiction-collision', ...collision(c),
      ...(c.metadata?.evidenceId === undefined ? {} : { evidenceId: c.metadata.evidenceId }) } })]; },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { collision: context.variants[0].evidence } }; },
});
