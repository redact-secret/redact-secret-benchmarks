import type { Fixture, Range } from '../types.ts';
import type { EvaluationCase, Transformation, Strategy, GeneratedVariant, Registry, Method, Operator } from './types.ts';
import { createHash } from 'node:crypto';
import { validateCorpus } from '../lib/scoring.ts';
import { validateAssessment } from '../lib/assessment.ts';

export const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
// Parameters containing arbitrary text stay hashed; built-in resolved choices
// are numeric and can safely be retained for exact replay.
export const safeParameters = (parameters: Record<string, unknown>) => Object.fromEntries(
  Object.entries(parameters).filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(key) &&
    (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))),
) as Record<string, number | boolean>;

export const secrets = (fixture: Fixture) => fixture.expected.filter(r => r.role === 'secret');
export const bytes = (fixture: Fixture, range: Range) => Buffer.from(fixture.content).subarray(range.start, range.end).toString('utf8');
export function independentFixture(fixture: Fixture) {
  const { twinOf, mutation, mutationKind, ...rest } = structuredClone(fixture);
  return rest;
}

/** EvaluationCase wraps an existing schema-2 seed without changing its truth.
 * GeneratedVariant adds a transformation, expectation strategy and provenance.
 * All offsets remain UTF-8 byte offsets, including operator-generated spans.
 */
export function validateCase(c: EvaluationCase) {
  if (!c || !/^[a-z0-9-]+$/.test(c.id) || typeof c.method !== 'string' ||
      !['development', 'regression', 'holdout'].includes(c.visibility) ||
      ((c.visibility === 'holdout') !== (c.method === 'holdout')) ||
      !Array.isArray(c.targets) || c.targets.some(t => !/^[a-z0-9-]+$/.test(t)) ||
      !c.provenance?.source || !c.provenance?.rationale || !c.provenance?.seed ||
      !Array.isArray(c.operators)) throw new Error('Invalid evaluation case or visibility/method boundary');
  validateCorpus({ fixtures: [independentFixture(c.seed)] });
  validateAssessment(c.seed);
  return c;
}

export function variant(c: EvaluationCase, id: string, fixture: Fixture, transformation: Transformation, strategy: Strategy = 'authored'): GeneratedVariant {
  if (!/^[a-z0-9.-]+$/.test(id) || !['authored', 'derived', 'review-required'].includes(strategy))
    throw new Error('Invalid generated variant');
  const f = independentFixture(fixture);
  f.id = `${c.id}--${id.replaceAll('.', '-')}`;
  f.path = `cases/${c.id}/${id}.txt`;
  if (strategy === 'review-required') f.assessment = {
    kind: f.expected.length ? 'must-redact' : 'must-not-flag', tier: 'T0',
    reason: 'Mutation semantics require review; no negative truth inferred from scanner output.', sources: [],
  };
  validateCorpus({ fixtures: [f] });
  // Derived context variants can transform a structural fixture (e.g. CRLF
  // PEM). Source validation runs before generation; ranges are validated here.
  if (strategy !== 'review-required') validateAssessment({ ...f,
    ...(fixture.twinOf ? { twinOf: fixture.twinOf, mutation: fixture.mutation, mutationKind: fixture.mutationKind } : {}) });
  return { id, parentCaseId: c.id, fixture: f, strategy, transformation,
    provenance: { seed: c.provenance.seed, sourceHash: hash(c.seed), fixtureHash: hash(f),
      contentHash: hash(f.content), transformationHash: hash(transformation) } };
}

export function generateCase(c: EvaluationCase, methods: Registry<Method>, operators: Registry<Operator>) {
  validateCase(c);
  const method = methods.get(c.method);
  method.validateCase(c);
  const output = method.generate(c, { operators, variant, methodVersion: method.version });
  const { variants, attempts } = Array.isArray(output) ? { variants: output, attempts: [] } : output;
  if (!Array.isArray(variants) || !variants.length || new Set(variants.map(v => v.id)).size !== variants.length)
    throw new Error('Empty or duplicate variants');
  validateCorpus({ fixtures: variants.map(v => v.fixture) });
  return { case: c, method, variants, attempts };
}
