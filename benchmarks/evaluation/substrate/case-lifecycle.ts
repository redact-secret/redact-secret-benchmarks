export interface GeneratedInput<TInput extends { path: string }> { variants: { fixture: TInput }[] }

/** Generate every case before execution and enforce a single deterministic input namespace. */
export function evaluationInputs<TCase extends { id: string }, TInput extends { path: string }, TGenerated extends GeneratedInput<TInput>>(
  cases: TCase[],
  generate: (evaluationCase: TCase) => TGenerated,
) {
  if (!cases.length || new Set(cases.map(evaluationCase => evaluationCase.id)).size !== cases.length)
    throw new Error('Empty or duplicate evaluation cases');
  const generated = cases.map(generate);
  const fixtures = generated.flatMap(result => result.variants.map(variant => variant.fixture));
  if (new Set(fixtures.map(fixture => fixture.path)).size !== fixtures.length) throw new Error('Duplicate generated path');
  return { generated, fixtures };
}
