import type { Range } from '../types.ts';
import type { Operator, EvaluationCase } from '../engine/types.ts';
import { contracts } from '../lib/assessment.ts';
import { bytes, secrets, hash } from '../engine/model.ts';

export const supportsLexical: Operator['supports'] = c => secrets(c.seed).length === 1 &&
  ['T1', 'T2'].includes(c.seed.assessment.tier) &&
  Boolean(contracts[c.seed.assessment.contract ?? '']?.pattern);

export function mutate(c: EvaluationCase, change: (value: string) => string): ReturnType<Operator['generate']> {
  const span = secrets(c.seed)[0], original = bytes(c.seed, span);
  const replacement = change(original);
  const buffer = Buffer.from(c.seed.content), delta = Buffer.byteLength(replacement) - (span.end - span.start);
  const move = <T extends Range>(r: T): T => ({ ...r, start: r.start >= span.end ? r.start + delta : r.start,
    end: r.end >= span.end ? r.end + delta : r.end });
  const fixture = { ...c.seed,
    content: buffer.subarray(0, span.start).toString() + replacement + buffer.subarray(span.end).toString(),
    expected: c.seed.expected.map(r => ({ ...move(r), ...(r.envelope ? { envelope: move(r.envelope) } : {}) })),
  };
  const valid = new RegExp(contracts[c.seed.assessment.contract ?? ''].pattern!).test(replacement);
  // A failed lexical contract does not prove scanner silence: a valid
  // substring or independent contextual credential may remain. Review it.
  return { fixture, strategy: valid ? 'derived' : 'review-required',
    property: 'lexical', expectationEffect: valid ? 'preserve' : 'defer', contractMatch: valid, relation: valid ? 'same-detection' : null };
}

const mutations: [string, (value: string) => string][] = [
  ['lexical.length-minus-one', s => s.slice(0, -1)],
  ['lexical.length-plus-one', s => s + 'A'],
  ['lexical.replace-last', s => s.slice(0, -1) + (s.endsWith('A') ? 'B' : 'A')],
  ['lexical.invalid-alphabet', s => s.slice(0, -1) + '!'],
];
export const lexicalOperators: Operator[] = mutations.map(([id, change]) => ({
  id, version: 1,
  supports: (c, parameters = {}) => !Object.keys(parameters).length && supportsLexical(c),
  generate: c => ({ ...mutate(c, change), property: id.includes('length') ? 'length' : 'alphabet' }),
}));

/** Stable seed-to-choice mapping; resolved choices are part of provenance. */
export function seededChoice(c: EvaluationCase, operator: string, size: number) {
  return Number.parseInt(hash({ seed: c.provenance.seed, operator }).slice(0, 12), 16) % size;
}

lexicalOperators.push({
  id: 'lexical.prefix-change', version: 1,
  supports: (c, p = {}) => supportsLexical(c) && Object.keys(p).every(k => k === 'choice') &&
    (p.choice === undefined || (Number.isInteger(p.choice) && Number(p.choice) >= 0 && Number(p.choice) < 25)),
  generate(c, p = {}) {
    const value = bytes(c.seed, secrets(c.seed)[0]);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(ch => ch !== value[0].toUpperCase()).join('');
    const choice = Number(p.choice ?? seededChoice(c, 'lexical.prefix-change', 25));
    return { ...mutate(c, s => alphabet[choice] + s.slice(1)), property: 'prefix', parameters: { choice } };
  },
});
