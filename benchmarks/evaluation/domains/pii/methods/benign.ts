import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiMethod } from '../types.ts';
import type { PiiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { piiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { hash } from '../../../substrate/hash.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

const classes = ['reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative'];
const methodVersion = 2;
export const piiBenign = (evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence): PiiMethod => ({
  id: 'pii-benign', version: methodVersion,
  validateCase(c) {
    validatePiiCase(c);
    const controlClass = c.metadata?.benignClass;
    if (c.method !== this.id || c.contract.sensitivityExpectation !== 'non-sensitive' || !classes.includes(String(controlClass)))
      throw new Error('Invalid PII benign control');
    if (c.metadata?.evidenceId !== undefined) {
      const entry = evidence.entries.find(candidate => candidate.id === c.metadata!.evidenceId);
      if (!entry || entry.caseId !== c.id || entry.family !== c.contract.family || entry.accountingAxis !== controlClass ||
          entry.sensitivityExpectation !== c.contract.sensitivityExpectation || entry.collision !== null ||
          entry.candidateCommitment !== hash(candidateValue(c.input.content, c.candidate))) throw new Error('Invalid PII benign evidence identity');
    }
  },
  generate(c) { this.validateCase(c); return [piiVariant(c, String(c.metadata!.benignClass), c.input, c.contract, 'authored',
    { methodVersion, evidence: { kind: 'semantic-control', controlClass: c.metadata!.benignClass,
      ...(c.metadata?.evidenceId === undefined ? {} : { evidenceId: c.metadata.evidenceId }) } })]; },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { control: context.variants[0].evidence } }; },
});
