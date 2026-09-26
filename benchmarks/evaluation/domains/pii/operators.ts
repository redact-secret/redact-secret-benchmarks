import { createRegistry, type Registry } from '../../substrate/registry.ts';
import { validatePiiCase, validatePiiContract } from './contract-model.ts';
import type { PiiCase, PiiOperator, PiiOperatorResult } from './types.ts';

const exactKeys = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');

/** Operator hooks are untrusted: validate and reconstruct every domain-owned field. */
export function applyPiiOperator(operator: PiiOperator, c: PiiCase): PiiOperatorResult {
  const raw: unknown = operator.apply(structuredClone(c));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !exactKeys(raw, ['input', 'candidate', 'expectation']))
    throw new Error('Invalid PII operator result');
  const row = raw as { input?: unknown; candidate?: unknown; expectation?: unknown };
  if (!row.input || typeof row.input !== 'object' || Array.isArray(row.input) || !exactKeys(row.input, ['id', 'path', 'content']) ||
      !row.candidate || typeof row.candidate !== 'object' || Array.isArray(row.candidate) || !exactKeys(row.candidate, ['start', 'end']) ||
      !row.expectation || typeof row.expectation !== 'object' || Array.isArray(row.expectation) || !exactKeys(row.expectation, ['type', 'sensitivity']))
    throw new Error('Invalid PII operator result');
  const inputRow = row.input as { id?: unknown; path?: unknown; content?: unknown };
  const candidateRow = row.candidate as { start?: unknown; end?: unknown };
  const expectationRow = row.expectation as { type?: unknown; sensitivity?: unknown };
  if (typeof inputRow.id !== 'string' || typeof inputRow.path !== 'string' || typeof inputRow.content !== 'string' ||
      !Number.isInteger(candidateRow.start) || !Number.isInteger(candidateRow.end) ||
      !['valid', 'invalid'].includes(String(expectationRow.type)) || !['sensitive', 'non-sensitive', 'unresolved'].includes(String(expectationRow.sensitivity)))
    throw new Error('Invalid PII operator result');
  const result: PiiOperatorResult = { input: { id: inputRow.id, path: inputRow.path, content: inputRow.content },
    candidate: { start: candidateRow.start as number, end: candidateRow.end as number },
    expectation: { type: expectationRow.type as PiiOperatorResult['expectation']['type'],
      sensitivity: expectationRow.sensitivity as PiiOperatorResult['expectation']['sensitivity'] } };
  const contract = validatePiiContract({ ...structuredClone(c.contract), typeExpectation: { ...c.contract.typeExpectation, state: result.expectation.type },
    sensitivityExpectation: result.expectation.sensitivity });
  validatePiiCase({ ...structuredClone(c), input: result.input, candidate: result.candidate, contract });
  return result;
}

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
