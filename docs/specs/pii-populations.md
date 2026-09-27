# PII evaluation populations

`pii-populations-v1` keeps two views separate. `diagnostic-balanced` is a
development-only tuning population for comparing type, validator, and context
behavior. `benign-heavy-stress` is evaluation-only and deliberately assigns
almost all declared base-rate mass to non-sensitive occurrences. Neither view
is an operational prevalence claim, and the implementation never produces a
combined population score or a credential-plus-PII score.

The committed contract records integer base-rate mass, denominator unit,
closed rationale codes, corpus commitment, and an explicit evidence-ID/case-ID
roster. Every non-empty view carries one mass row for every committed stratum;
each child's sensitive, non-sensitive, and not-established mass must add to its
total, and all children must add exactly to the population totals. A cell may
carry mass only for its authored sensitivity state; near-miss evidence therefore
uses `notEstablishedMass` rather than being relabeled benign or sensitive.
Missing mass is never renormalized. The diagnostic view gives each present
evidence class equal mass; the stress view is strictly benign-dominant. When
evidence exists both views must be populated, and every committed
`pii-benign-collision-v1` entry belongs to exactly one of them.

Population membership is authored configuration, not something inferred from
observed scanner output. Tuning requires the development population, the full
case and protected-identity inventories, repository state, and a beta.9 tuning
manifest accepted by `validateTuningManifest`. Its recursive holdout checks
reject nested IDs, hashes, and paths. Evaluation-only members, holdout cases,
and protected values anywhere in an accounting row are rejected.

Reports contain only an allowlisted aggregate roster. Each committed cell is
stratified by family, global or jurisdictional scope, context class, the exact
eight-class authored evidence vocabulary, its explicit (possibly absent)
`pii-v1` accounting axis, sensitivity, and independent `validatorBacked` and
`contextDependent` booleans. Omitted cells fail validation. Reports bind the
exact #284 accounting rows plus scanner ID, scanner version, configuration
hash, run ID, candidate artifact, and their own artifact commitment. Product
reports cannot be validated without the bound rows. Empty canonical evidence
therefore produces an honest `not-measured` report, not synthetic observations
or rates.

The diagnostic-balanced report also publishes three independent diagnostic
blocks: type identity, validator correctness, and context discrimination. Each
has its own eligible/measured/pass/fail denominator, status, pass rate, and the
same committed strata. They are never averaged or merged into one diagnostic
score. A regression comparison carries one delta per diagnostic axis alongside
the separate benign false-alarm deltas.

Baseline/candidate comparisons require identical population, contract, corpus,
base-rate, weighting, denominator, and stratum commitments. A release verdict
requires two semantically revalidated, complete product-observation reports
with matching scanner configuration and distinct run and artifact identities.
Any applicable partial or unresolved mass makes the report and verdict
`not-measured`; a measured subset is never renormalized. Deltas remain per stratum,
so an aggregate reduction in false alarms cannot hide a regression in one
family, locale, context, or authored benign evidence class. Calibration is
reported with closed `not-used` / `not-measured` reason codes; public outputs
have no free-form rationale channel. This contract does not fit thresholds or
claim product output.

Release publication requires an explicit `--population-bundle` or
`--population-mode=not-measured`; it never auto-discovers a stale local file.
The site workflow deletes the conventional
`results-output/pii/population-release-v1.json` path before measurement, passes
a bundle created during that run when present, and otherwise explicitly
declares `not-measured`. The publisher
revalidates both reports against their bound accounting rows and projects only
report/artifact commitments, verdicts, and aggregate per-stratum deltas into
the content-addressed PII support matrix. Raw accounting rows, case identities,
paths, fixture bytes, seeds, and scanner errors are never published. When the
bundle is absent, both population comparisons are published explicitly as
`not-measured`; absence is visible rather than interpreted as clean evidence.
The support page renders the two verdicts separately and preserves any local
benign or diagnostic regression even when an aggregate improves.

Product activation is trusted only through a repository-reviewed binding. The
binding names an exact clean, complete, full-suite candidate-evidence
commitment, its product source commit and npm facade commitment, an activation
artifact commitment, and each family qualification artifact and plan
commitment. Runtime callers cannot create a trusted binding by supplying
well-shaped hashes or booleans: every tuple must match
`trusted-product-bindings-v1.json`. Activation evidence must also reconcile the
requested selectors, canonical activation identity, available family closure,
and at least two product surfaces. Qualification status and reason codes are
derived from the artifact's gate rows. A family becomes `provisional` only
when that trusted activation is available, qualification is complete, both
canonical populations are measured, and both baseline/candidate comparisons
show no regression. Otherwise it remains `pending` with the exact failed or
unmeasured gate reasons; this path never emits `stable`.

Tuning selection is fail-closed. Repository tuning manifests bind the file-byte
hash in the pin manifest, while the current PII population contract binds an
inner semantic corpus commitment and declares no dedicated tuning category.
Until a dedicated source commits both identities, even an otherwise valid
development manifest cannot authorize PII tuning. The benign-heavy population
remains evaluation-only.
