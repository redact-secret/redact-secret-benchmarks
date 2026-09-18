import { contracts } from '../lib/assessment.mjs';
import { bytes, secrets } from '../engine/model.mjs';

const supports = c => secrets(c.seed).length === 1 &&
  ['T1', 'T2'].includes(c.seed.assessment.tier) &&
  Boolean(contracts[c.seed.assessment.contract]?.pattern);

function mutate(c, change) {
  const span = secrets(c.seed)[0], original = bytes(c.seed, span);
  const replacement = change(original);
  const buffer = Buffer.from(c.seed.content), delta = Buffer.byteLength(replacement) - (span.end - span.start);
  const move = r => ({ ...r, start: r.start >= span.end ? r.start + delta : r.start,
    end: r.end >= span.end ? r.end + delta : r.end });
  const fixture = { ...c.seed,
    content: buffer.subarray(0, span.start).toString() + replacement + buffer.subarray(span.end).toString(),
    expected: c.seed.expected.map(r => ({ ...move(r), ...(r.envelope ? { envelope: move(r.envelope) } : {}) })),
  };
  const valid = new RegExp(contracts[c.seed.assessment.contract].pattern).test(replacement);
  // A failed lexical contract does not prove scanner silence: a valid
  // substring or independent contextual credential may remain. Review it.
  return { fixture, strategy: valid ? 'derived' : 'review-required',
    property: 'lexical', contractMatch: valid, relation: valid ? 'same-detection' : null };
}

export const lexicalOperators = [
  ['lexical.length-minus-one', s => s.slice(0, -1)],
  ['lexical.length-plus-one', s => s + 'A'],
  ['lexical.replace-last', s => s.slice(0, -1) + (s.endsWith('A') ? 'B' : 'A')],
  ['lexical.invalid-alphabet', s => s.slice(0, -1) + '!'],
].map(([id, change]) => ({ id, version: 1, supports, generate: c => mutate(c, change) }));
