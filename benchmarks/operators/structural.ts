import type { Operator, EvaluationCase } from '../engine/types.ts';
import { bytes, secrets } from '../engine/model.ts';
import { mutate, seededChoice, supportsLexical } from './lexical.ts';

const value = (c: EvaluationCase) => bytes(c.seed, secrets(c.seed)[0]);
const separators = (s: string) => [...s.matchAll(/[._-]/g)].map(m => m.index!);
const validIndex = (p: Record<string, unknown>, allowed: number[]) =>
  Object.keys(p).every(k => k === 'index') && (p.index === undefined || allowed.includes(Number(p.index)) && typeof p.index === 'number');

// Removing a delimiter probes a boundary, not an authored negative. Other
// detectors or valid substrings may still apply, so a broken contract defers.
export const boundary: Operator = {
  id: 'boundary.remove-delimiter', version: 1,
  supports: (c, p = {}) => supportsLexical(c) &&
    /[._-]/.test(bytes(c.seed, secrets(c.seed)[0])) && validIndex(p, separators(bytes(c.seed, secrets(c.seed)[0]))),
  generate(c, p = {}) {
    const positions = separators(value(c));
    const index = Number(p.index ?? positions[seededChoice(c, 'boundary.remove-delimiter', positions.length)]);
    return { ...mutate(c, s => s.slice(0, index) + s.slice(index + 1)), property: 'boundary', parameters: { index } };
  },
};

// Explicit segmented lexical formats only. PEM/DER/JWT structure is not
// inferred from punctuation and is intentionally unsupported here.
export const structural: Operator = {
  id: 'structural.remove-segment', version: 1,
  supports: (c, p = {}) => supportsLexical(c) &&
    ['sendgrid-token', 'slack-token'].includes(c.seed.assessment.contract ?? '') &&
    validIndex(p, c.seed.assessment.contract === 'sendgrid-token' ? [1, 2] : [1, 2, 3]),
  generate(c, p = {}) {
    const delimiter = c.seed.assessment.contract === 'sendgrid-token' ? '.' : '-';
    const parts = value(c).split(delimiter);
    const index = Number(p.index ?? (1 + seededChoice(c, 'structural.remove-segment', parts.length - 1)));
    return { ...mutate(c, s => s.split(delimiter).filter((_, i) => i !== index).join(delimiter)),
      property: 'structural', parameters: { index } };
  },
};
