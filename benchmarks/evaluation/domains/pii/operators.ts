import { createRegistry, type Registry } from '../../substrate/registry.ts';
import type { PiiOperator } from './types.ts';

const invalidateFinalDigit: PiiOperator = {
  id: 'invalidate-final-digit', version: 1,
  apply(c) {
    const bytes = Buffer.from(c.input.content);
    const value = bytes.subarray(c.candidate.start, c.candidate.end).toString();
    if (!/\d$/.test(value)) throw new Error('PII mutation needs a final digit');
    const changed = `${value.slice(0, -1)}${(Number(value.at(-1)) + 1) % 10}`;
    const content = Buffer.concat([bytes.subarray(0, c.candidate.start), Buffer.from(changed), bytes.subarray(c.candidate.end)]).toString();
    return { input: { ...c.input, id: `${c.input.id}-mutated`, path: c.input.path.replace(/\.txt$/, '-mutated.txt'), content },
      candidate: { start: c.candidate.start, end: c.candidate.start + Buffer.byteLength(changed) },
      expectation: { type: 'invalid', sensitivity: c.contract.sensitivityExpectation } };
  },
};

export function createPiiOperators(entries: PiiOperator[] = [invalidateFinalDigit]): Registry<PiiOperator> {
  const registry = createRegistry<PiiOperator>('PII operator', ['apply']);
  for (const entry of entries) registry.register(entry);
  return registry;
}
