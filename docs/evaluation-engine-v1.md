# Evaluation Engine v1.0 qualification

This engine is benchmark infrastructure owned by `redact-secret-benchmarks`.
`redact-secret` owns detector implementation; this repository owns evaluation
truth and evidence; the main project's documentation owns published support
claims with links to that evidence. Passing engine execution does not qualify
every detector or authorize a stable-support claim.

## Reproduce from a clean checkout

Use a supported Node version from `package.json` and the released scanners pinned
in `qualification/suite-v1.json`: redact-secret 0.1.0-beta.4, Gitleaks 8.30.1 and
TruffleHog 3.97.4. `npm ci` installs the pinned npm scanner and tooling; install
the two external binaries from their official release distributions and put
them on `PATH`. Qualification rejects missing or different versions before
reading a protected corpus.

```sh
npm ci
npm run fixtures:check
npm test
npm run test:integration
npm run build
npm run eval:qualify
npm run eval:validate -- results-output/qualification/engine-v1.json
```

The default uses the public lifecycle controls in `holdout/manifest.json`.
Generated inputs are rebuilt; previous results, private corpora and npm global
packages are not prerequisites. Every run gets a fresh identity and timestamps;
case construction, seeds and source hashes are reproducible. Exact scanner
observations depend on the recorded platform and pinned artifacts. For an
authorized protected run, add
`--holdout-manifest=holdout/candidate-manifest.json` to `eval:qualify`.

## Suite and evidence

The suite runs all six methods with all three scanners:

| Method | Required evidence |
| --- | --- |
| Twin | Authored positive/negative pairs and must-flip assertions. |
| Benign | Classified negative controls and silence assertions. |
| Metamorphic | Context/encoding variants, absolute and relation assertions; explicit unsupported attempts. |
| Mutation | Registered operators, seeded choices, effects, unsupported attempts and review-required outputs. |
| Differential | Complete primary/peer comparisons; disagreements remain review evidence, never truth. |
| Holdout | Explicit isolated execution of frozen canonical cases; aggregate-only output. |

`execution-qualified` requires nonempty coverage for every method, all selected
scanners complete, no generation errors, stable candidate identity and a
complete holdout lifecycle. Detector assertion failures remain visible and do
not pretend that the infrastructure itself malfunctioned. The standalone
holdout command separately fails on any holdout assertion failure.

Qualification records a shared run ID, suite hash, Git revision/dirty state,
engine/source hash, installed candidate artifact hash, lockfile hash, runtime,
development corpus hashes and seed, holdout corpus/seed commitments, frozen
plan hash, and scanner versions/configuration hashes. The source fingerprint
explicitly excludes ignored holdout inputs; default provenance collection
does not read protected payloads. Protected seeds remain in the custodian's
corpus; public controls have a public seed in their manifest.

The reports are validated with Ajv against the checked-in JSON Schemas under
`schemas/`, plus consistency checks for coverage, run identity, candidate hashes,
aggregate counts and false completeness. Unknown fields in the public holdout
structure are rejected. `eval:validate` reruns these checks on stored evidence.
The full development report remains a separate discovery workflow; the v1
artifact contains per-detector development aggregates and no holdout rows.

The repository evidence artifact is
[`docs/qualification/engine-v1.json`](qualification/engine-v1.json). It can be
consumed by support-matrix work as execution evidence and unresolved detector
findings. `supportClaims: false` and `independence: public-control` prevent the
public-control run from masquerading as independent detector qualification.

## Internal extension contracts

The internal `Method` contract lives in `benchmarks/engine/types.ts`:
`id`, `version`, `validateCase`, `generate`, and `evaluate`. Add a module under
`benchmarks/methods/`, register it in `createMethods()`, and add a case source in
the development corpus bridge. Generation returns variants plus attempt
records; each variant uses the common constructor to validate UTF-8 ranges and
retain provenance. Evaluation returns scanner assertions and an optional review
queue. Existing `generate`/`evaluate` helpers can be reused for ordinary absolute
and relational methods. Engine dispatch needs no method-specific branch.

The holdout method intentionally registers through `createHoldoutMethods()` in
the isolated lifecycle instead of the default registry. `runner.ts` rejects
holdout cases before execution. Both entry points reuse `execution.ts`; only
the lifecycle code sees the private row report, and it returns an allowlisted
aggregate. A new access-sensitive method needs an equivalent lifecycle review,
not automatic admission into development scans.

An internal `Operator` declares `id`, `version`, `supports`, and `generate`.
Add a module under `benchmarks/operators/` and register it in `createOperators()`.
Declare a precise applicability contract and reject unsupported parameters.
Generation must be deterministic from source/seed/parameters, must not mutate
source truth, and must retain UTF-8 ranges and envelopes. Return the expectation
strategy (`authored`, `derived`, `review-required`), effect
(`preserve`, `invalidate`, `defer`), relation, and resolved numeric parameters.
Never derive validity from a scanner response. Add focused tests for boundary
mapping, seed replay, support checks and the expectation decision. The current
case bridge selects operators by namespace; add an explicit source selection
there when a new namespace needs one.

No public plugin API, loader, third-party execution model, compatibility promise
or extension SemVer guarantee is supported. The `1.0.0` qualification label
describes the internal milestone; report schema versions and existing integer
engine format versions remain independent.

## Milestone and remaining limits

`qualification/milestone-status.json` records a dated GitHub status snapshot.
Refresh it with `npm run eval:milestone` before milestone sign-off. The current
snapshot lists #1–#8 as open; implemented code and successful local tests do
not silently close GitHub issues. No required issue has been removed from scope.
After changes are reviewed and the corresponding issues are closed, refresh
the snapshot and run `npm run eval:qualify -- --require-milestone-closed`.
That gate fails while any prerequisite is open. Local execution evidence and
formal milestone completion are distinct fields.

Other limits: source corpora retain their review labels; public synthetic
controls do not establish independent generalization, provider issuance or
credential liveness. Unknown detector mappings stay unsupported. Redaction,
cross-binding parity, streaming and live verification are not claimed by this
qualification suite. Detector failures require fixes in the implementation
repository and new candidate evidence. Private holdout contamination and
rotation follow [the lifecycle procedure](../holdout/README.md).
