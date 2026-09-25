# Statistical scorer tuning and protected holdout

Status: normative for beta.9 (#256). Decided in
[Protect holdout from statistical scorer tuning](../decisions/2026-09-25-protect-holdout-from-statistical-scorer-tuning.md).
Enforced by `npm run tuning:check`
([`benchmarks/lib/tuning-manifest.ts`](../../benchmarks/lib/tuning-manifest.ts),
[`schemas/tuning-manifest-v1.json`](../../schemas/tuning-manifest-v1.json)).

Beta.9 adds an explainable, shadow-only evidence scorer to the product. Its
contract (evidence groups, caps, bands, integer arithmetic, no public score)
is frozen in redact-secret's
`decision-freeze-the-shadow-evidence-score-and-confidence-contract`
([redact-secret#768](https://github.com/redact-secret/redact-secret/issues/768)).
The scorer's features, weights and band thresholds are chosen from benchmark
evidence
([#254](https://github.com/redact-secret/redact-secret-benchmarks/issues/254),
[#255](https://github.com/redact-secret/redact-secret-benchmarks/issues/255)).
That creates a new way to fail: tuning until the public regression corpus
looks perfect. This page sets out what tuning may read, what it must record,
and why holdout stays a final check outside the optimization.

## 1. Corpus roles

| Source | Role for a scorer | May select features, weights or thresholds | May be evaluated against |
| --- | --- | --- | --- |
| Development categories (`corpora/development/manifest.json`) | tuning, or `development-evaluation` when a manifest keeps one out of the fit | yes, if listed under `corpora.tuning` | yes, if listed under `corpora.evaluation` |
| Regression categories (`corpora/regression/manifest.json`) | `regression`, evaluation-only | **no** | yes, as often as needed |
| Accepted external adversarial packs (`adversarial/packs/*`) | `adversarial`, evaluation-only | **no** | yes |
| Score-evasion and negative-evidence abuse variants ([#289](https://github.com/redact-secret/redact-secret-benchmarks/issues/289)) | evaluation-only, maintainer-local | **no** | yes |
| Public holdout conformance controls (`holdout/manifest.json`) | engine qualification only | **no** | **no** (not scorer evidence) |
| Protected holdout (custodian-held, [holdout lifecycle](../../holdout/README.md)) | final independent check on a frozen candidate | **no** | only through `eval:holdout run`, within its budget, after tuning is frozen |
| Sample adversarial packs | none | no | no |

A manifest lists each source under tuning or under evaluation, never both.
A regression category is evaluation-only because a fixture that freezes a
past defect stops being a check once the configuration is fitted to it. A
tuned scorer must still pass it.

## 2. Protected holdout is never part of tuning

1. No tuning step reads, runs, inspects or summarizes protected holdout. A
   tuning manifest names no holdout manifest id, corpus hash, seed hash or
   `holdout/` path (the check compares against every `holdout/*.json`), and it
   records `holdoutAccess: "none"`. That field is an attestation that no
   holdout content, result or aggregate informed the configuration.
2. Holdout runs only against a frozen candidate whose scoring identity comes
   from an active tuning manifest. The run freezes the candidate artifact
   hash, and the scorer is compiled into the product, so each scoring
   identity is a different candidate.
3. Each holdout run uses the existing lifecycle budget (`maxRuns`, the
   persisted reservation, one attempt per sealed epoch by default). A failed
   or interrupted run still counts. A new scoring identity does not reset
   the budget, and nothing resets it automatically.
4. **A holdout result is not a tuning signal.** Suppose a scoring change
   follows a holdout run and was prompted by that run's result, for example
   retuning after a holdout failure. The custodian first marks the epoch
   `npm run eval:holdout -- contaminate --reason=used-for-tuning`. All
   evidence carrying that corpus hash then stops counting as independent,
   and the next qualification needs a newly sealed epoch. A change that
   holdout did not prompt does not contaminate. The attestation in point 1
   is how the manifest says which case applies.
5. When the budget is exhausted, the epoch is rotated as the holdout
   lifecycle describes. It is never extended.

## 3. Tuning manifest

Every proposed scoring configuration has one tuning manifest,
`tuning/manifests/<id>.json`, validated by `npm run tuning:check`. It records:

- **product**: the frozen candidate (`sourceRevision`, `sourceHash`,
  `lockHash`, `candidateArtifactHash`). These are the same identity fields
  the holdout lifecycle freezes.
- **benchmark**: the benchmark commit, with `dirty: false`.
- **featureDataset**: the #254 extractor version, the extractor source
  hash, and the dataset hash, copied from the dataset's `manifestBinding`
  ([candidate-feature dataset](candidate-features.md), `npm run
  features:extract`). The dataset's per-category counts by origin, family
  and context have the same shape as `corpora.tuning[]`.
- **selection**: the #255 selection method, its source hash, and the fixed
  seed (or `none`).
- **scoring**: the contract decision id, the feature schema and aggregation
  contract versions, the feature-set, weight-set and threshold-set hashes,
  and `identity`, the SHA-256 of those fields' canonical JSON.
- **corpora**: the tuning categories, each with its corpus hash and
  generated and authored row counts in total, per family and per context,
  plus the evaluation-only sources and their roles.
- **generatedShare**: the cap and any reviewed override (section 5).
- **strata**: the report dimensions, which must include `family` and
  `context`.

**Reproduction.** Check out the recorded product and benchmark revisions.
Regenerate the feature dataset and confirm `datasetHash`. Rerun the
recorded selection procedure with its seed. The result must be the recorded
feature-set, weight-set and threshold-set hashes, and therefore the same
`identity`. The product's scoring artifact
([redact-secret#798](https://github.com/redact-secret/redact-secret/issues/798))
records the hash of the tuning manifest it came from.

A manifest holds hashes, counts and stratum names only. It never holds
fixture bytes, per-candidate feature vectors or scores, or the weight and
threshold values themselves. It is committed metadata and is not projected
to the public site.

## 4. Invalidation

- A changed feature set, weight set, threshold set, feature schema or
  aggregation contract version changes `scoring.identity`. The check rejects
  a manifest whose identity does not match its components.
- Calibration, qualification and holdout evidence records the tuning
  manifest hash, the scoring identity and the candidate artifact hash. If any
  of the three no longer matches, or the manifest is superseded, the evidence
  is stale (`evidenceStaleness`). It is regenerated, never carried over.
- An `active` manifest must match the current corpus hashes
  (`benchmarks/pin-manifest.json`). When a tuning or evaluation corpus
  changes, the configuration is either retuned under a new manifest, or the
  old manifest is marked `superseded` with `supersededBy`. A superseded
  manifest stays unchanged for audit.

## 5. Benchmark-generated rows cannot dominate

A row is **generated** when a benchmark generator produced its
credential-like body, such as the seeded bodies in
`fixtures/generated/build.mjs`. It is **authored** when a person wrote it or
it came from a provider-documented example. Generated bodies are close to
uniformly random. A scorer fitted mostly to them would learn that "uniformly
random means secret", which does not hold for real ambiguous input.

Generated rows may make up at most the cap, **0.5 by default**, of the
tuning rows overall **and within every family**, so a balanced total cannot
hide one family made almost entirely of generated rows. Only a
`generatedShare.override` can raise the cap, and it must carry a reason and
a reviewer. The override is part of the manifest, so it is reviewed with the
change.

The feature dataset counts origin per row (`originBasis`,
[candidate features](candidate-features.md) §2). The beta.9 calibration
experiments cannot meet the cap and carry a reviewed override, backed by a
reweighting sensitivity check
([calibration experiments](calibration-experiments.md) §7).

## 6. Strata

Every tuning or evaluation report for a manifest is broken down by each
dimension in `strata.dimensions`, at least by family and by context. Each
tuning source's family and context counts must add up to its rows. A
report may not state an aggregate improvement without the per-stratum
deltas beside it, and a regression in any stratum is reported whatever the
aggregate shows. Whether a stratum regression blocks promotion is for the
future promotion gates
([#257](https://github.com/redact-secret/redact-secret-benchmarks/issues/257))
to decide. This page only makes the regression visible.

## 7. Publication boundary

This follows the product contract. Public output never contains
per-candidate scores or feature vectors, fitted weights, band thresholds,
per-feature or per-group contributions, or score-evasion recipes. Public
projection may report aggregate security outcomes per stratum, plus the
identities and hashes above.
