import { piiVariant, validatePiiCase } from '../contract-model.ts';
import { piiContextGroup } from '../context-evidence.ts';
import type { PiiContract, PiiMethod } from '../types.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

const methodVersion = 2;

function groupFor(c: Parameters<PiiMethod['validateCase']>[0]) {
  const id = c.metadata?.contextEvidenceGroup;
  if (typeof id !== 'string') throw new Error('Missing PII context evidence group');
  const group = piiContextGroup(id);
  if (group.language !== c.contract.context.language || group.identityDomain !== c.contract.identityDomain)
    throw new Error('PII context evidence group does not match its contract');
  return group;
}

export const contextDiscrimination: PiiMethod = {
  id: 'context-discrimination', version: methodVersion,
  validateCase(c) {
    validatePiiCase(c);
    if (c.method !== this.id || c.contract.typeExpectation.state !== 'valid' ||
        c.contract.context.obligation !== 'required-for-sensitive-classification') throw new Error('Invalid context-discrimination case');
    groupFor(c);
  },
  generate(c) {
    this.validateCase(c);
    const value = candidateValue(c.input.content, c.candidate);
    return groupFor(c).frames.map(frame => {
      const [prefix, suffix] = frame.template.split('{{candidate}}');
      const input = { ...c.input, id: `${c.input.id}-${frame.id}`, path: c.input.path.replace(/\.txt$/, `-${frame.id}.txt`), content: `${prefix}${value}${suffix}` };
      const contract: PiiContract = { ...structuredClone(c.contract), sensitivityExpectation: frame.sensitivity,
        context: { ...c.contract.context, class: frame.contextClass } };
      return piiVariant(c, frame.id, input, contract, 'derived', { candidate: { start: Buffer.byteLength(prefix), end: Buffer.byteLength(prefix + value) },
        methodVersion, operator: 'context-frame', sensitivityEffect: 'change', evidence: { kind: 'context', contextClass: frame.contextClass,
          language: c.contract.context.language, entry: frame.entry, effect: frame.effect, features: frame.features } });
    });
  },
  evaluate(context) {
    return { ...evaluatePiiVariants(context), evidence: { contexts: context.variants.map(variant => ({ id: variant.id,
      contextClass: variant.contract.context.class, expectation: variant.contract.sensitivityExpectation,
      language: variant.contract.context.language, entry: variant.evidence?.entry, effect: variant.evidence?.effect,
      features: variant.evidence?.features })) } };
  },
};
