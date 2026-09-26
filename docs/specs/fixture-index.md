# Fixture semantic index

`benchmarks/fixture-index.json` is the generated, versioned projection that
joins every public canonical fixture to reviewed credential-family and test-
scenario relationships. It records navigation and provenance metadata only;
the category corpus remains the single source of fixture bytes, expectations,
assessment tier/kind, and scan grouping.

## Authored inputs

- `benchmarks/fixture-semantics.json` contains one reviewed record for every
  canonical fixture slug. Family and scenario membership is never inferred by
  the generator from a fixture name, `group`, or scanner output.
- `benchmarks/scenarios.json` defines the controlled scenario vocabulary.
- `benchmarks/support/taxonomy.json` defines valid provider/family IDs.
- `benchmarks/categories.json` and its category corpora supply canonical IDs,
  paths, suite provenance, issue metadata, and twin relationships.

Run `npm run fixture-index:generate` after reviewing a semantic change. CI runs
`npm run fixture-index:check` and rejects stale output, incomplete membership,
unknown references, duplicate slugs or relations, missing unscoped reasons,
and invalid positive/twin relationships.

## Identity and peer snapshots

The reusable identity contract is the generated top-level object:

```json
{
  "schemaVersion": 1,
  "algorithm": "sha256",
  "digest": "<64 lowercase hex characters>",
  "fixtureCount": 2990
}
```

The digest covers canonical JSON for `{ schemaVersion, truth, sources,
fixtures }`, excluding the identity object itself. `sources` separately binds
the reviewed metadata, scenario registry, and taxonomy digests. A peer
observation snapshot must store and compare the complete identity object and
fail closed on a schema, digest, or fixture-count mismatch. A metadata-only
change intentionally invalidates reuse even when fixture bytes are unchanged;
this prevents observations from being presented against a semantically
different fixture set.

The TypeScript contract and copy helper are `FixtureSemanticIdentity` and
`fixtureSemanticIdentity()` in `benchmarks/lib/fixture-index.ts`.

## Boundaries

The index cannot add or move a fixture, read protected holdout inputs, change a
category corpus, or split a scanner invocation. Family/scenario/history views
are projections of the same suite-scoped observations. Multi-family fixtures
carry every reviewed relation; consumers remain responsible for a documented
one-row/one-display-bucket rule when producing aggregate UI counts.
