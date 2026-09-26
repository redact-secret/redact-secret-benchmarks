export function generatedVariant<
  TFixture extends { content: string },
  TTransformation,
  TStrategy extends string,
>(options: {
  caseId: string;
  id: string;
  fixture: TFixture;
  strategy: TStrategy;
  transformation: TTransformation;
  seed: string;
  sourceHash: string;
  identity: (value: unknown) => string;
}) {
  return {
    id: options.id,
    parentCaseId: options.caseId,
    fixture: options.fixture,
    strategy: options.strategy,
    transformation: options.transformation,
    provenance: {
      seed: options.seed,
      sourceHash: options.sourceHash,
      fixtureHash: options.identity(options.fixture),
      contentHash: options.identity(options.fixture.content),
      transformationHash: options.identity(options.transformation),
    },
  };
}
