import { piiVariant, validatePiiCase } from '../contract-model.ts';
import type { PiiContract, PiiMethod } from '../types.ts';
import { candidateValue, evaluatePiiVariants } from './common.ts';

const rows = [
  { id: 'sensitive', class: 'sensitive', expectation: 'sensitive', text: 'private onboarding record' },
  { id: 'neutral', class: 'neutral', expectation: 'unresolved', text: 'unclassified record' },
  { id: 'non-sensitive', class: 'non-sensitive', expectation: 'non-sensitive', text: 'published documentation example' },
] as const;

export const contextDiscrimination: PiiMethod = {
  id: 'context-discrimination', version: 1,
  validateCase(c) { validatePiiCase(c); if (c.method !== this.id || c.contract.typeExpectation.state !== 'valid') throw new Error('Invalid context-discrimination case'); },
  generate(c) {
    this.validateCase(c);
    const value = candidateValue(c.input.content, c.candidate);
    return rows.map(row => {
      const prefix = `context=${row.text}; value=`;
      const input = { ...c.input, id: `${c.input.id}-${row.id}`, path: c.input.path.replace(/\.txt$/, `-${row.id}.txt`), content: `${prefix}${value}` };
      const contract: PiiContract = { ...structuredClone(c.contract), sensitivityExpectation: row.expectation,
        context: { ...c.contract.context, class: row.class } };
      return piiVariant(c, row.id, input, contract, 'derived', { candidate: { start: Buffer.byteLength(prefix), end: Buffer.byteLength(prefix + value) },
        operator: 'context-frame', sensitivityEffect: 'change', evidence: { kind: 'context', contextClass: row.class } });
    });
  },
  evaluate(context) { return { ...evaluatePiiVariants(context), evidence: { contexts: rows.map(({ id, class: contextClass, expectation }) => ({ id, contextClass, expectation })) } }; },
};
