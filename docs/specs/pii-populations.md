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
reports cannot be validated without the bound rows. Absent product observations
therefore produce an honest `not-measured` report, not synthetic observations
or rates. The canonical roster may be non-empty; unbound support projections
still publish zero measured strata until their source reports and accounting
rows are supplied together.

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

When a family binds exact-source conformance in addition to installed npm
artifacts, the source checkout must be clean and equal the candidate source
commit. Source commands are selected by repository-owned allowlist IDs; plans
cannot supply executables, arguments, shells, or environment fragments. The
evidence keeps installed addon/Wasm lanes distinct from Rust, Python, and CLI
source lanes, commits the command definitions, toolchains, and fixture bytes,
and sanctions the source-conformance commitment with the family qualification.
JavaScript-native UTF-16 ranges and canonical UTF-8 byte ranges are both
recorded; normalization never overwrites the native observation. Public absence
does not establish an identity-only result, so that gate remains unresolved
unless separately bound evidence measures it.

The US SSN arrival binds the exact product parent
`63a834e0a2b44c11f307ece8c539b933dabb68f1` and candidate
`a0709d2a41b70217874da9afeffb40fb2a1a2596`. Its two disjoint authored rosters
each declare 10,000 units of assumption mass: five diagnostic cases and ten
benign-stress cases. The source identity artifact must pass five distinct
lanes (private identity, validator, native conformance, Python, and CLI);
public absence is not substituted for any lane. Operational evidence uses ten
paired samples for every credentials-only, global PII, exact-family, and US
jurisdiction activation on both Node addon and forced-Wasm surfaces. Package
and latency limits are committed in `pii-national-id-arrival-v1` before any
measurement.

Protected SSN evidence is a separate, custodian-declared one-run lifecycle.
The runner freezes the clean full-suite candidate, core/node/Wasm artifact-set
commitment, `pii:us` selector configuration, and identity-source commitment
before opening sealed corpus bytes. Only aggregate type-identity and
sensitivity-context counts leave the lifecycle. A reviewed trust-resolution
record must bind that aggregate, and every unresolved or failed count must be
zero. The public-control lifecycle cannot satisfy this gate. Qualification is
`provisional` only after identity, both population comparisons, operational
limits, protected evidence, and trust resolution all validate with empty
reason codes; this route never emits `stable`.

If a mechanically validated public population or operational gate has already
failed, the protected run is not spent merely to repeat a known rejection. A
separate redacted `unspent` attestation may then bind the exact family and
arrival contracts, product source and candidate artifacts, identity, public
population and operational commitments, plus opaque sealed-epoch and manifest
commitments. It must declare one maximum run, zero runs, `not-run`, and
`public-gates-failed`, with distinct implementation and custodian identities
and an independent reviewer. It carries no corpus path or content and is
rejected when both public gates pass. This path forces the protected gate to
remain unresolved and the family to remain `not-qualified` / `pending`; it is
procedural custody evidence, never protected-performance evidence.

The issue-879 candidate takes that unspent path. Its diagnostic population and
all process-isolated runtime comparisons pass, but one benign placeholder
stratum regresses and the common Wasm payload grows against a frozen zero-growth
budget. The protected ledger therefore remains 0/1. The immutable artifacts
and exact reason codes are recorded under `evidence/879/`; neither
`provisional` nor `stable` is claimed.

The IBAN family binding pins family contract v1, SWIFT ISO 13616 IBAN Registry
Release 103 (89 derived country/length rows), and the bounded `iban-mod97` v1
validator. Its safe plan uses only the recorded `SYNX`-marked issue-878
synthetic construction and accounts validator correctness separately from
wrong-country-length rejection and checksum-valid context collisions. Installed
addon/Wasm and exact-source Rust/Python/CLI lanes are measured, while
identity-only classification, both population views and comparisons, and the
protected partition remain unresolved. The generated row is therefore
`pending`; no absent population mass is inferred or renormalized.

The payment-card binding pins family contract v1, ISO/IEC 7812 structure, the
frozen Visa Acceptance issuer-range subset, and the bounded `luhn` v1
validator. Its safe plan confines raw values to authoritative test controls or
deterministic no-real-world-provenance constructions. Mechanical checksum
failures are accounted separately from Luhn-valid order/reference, account,
phone, random-number, and cooking-object collisions. Installed addon/Wasm and
exact-source Rust/Python/CLI lanes are measured, while identity-only
classification, both population views and comparisons, and the protected
partition remain unresolved. The generated row is therefore `pending`; a Luhn
pass alone is never treated as sensitivity or support evidence.

The phone binding pins family contract v1, E.164 and the deliberately narrow
NANPA grammar, plus the exact 555-0100 through 555-0199 exchange-and-line
reserved control. Deterministic no-provenance positives are measured separately
from that authority control, real N11 exclusions, accepted 988 exchanges,
semantic collisions, supported extension bounds, malformed continuation seams,
ordinary prose suffixes, Korean context normalization, whole-candidate
boundaries, and bounded shared-context association. Installed addon/Wasm and
exact-source Rust/Python/CLI lanes are measured. Identity-only classification,
both population views and comparisons, and the protected partition remain
unresolved, so the generated row remains `pending`; neither `provisional` nor
`stable` is claimed.

Tuning selection is fail-closed. Repository tuning manifests bind the file-byte
hash in the pin manifest, while the current PII population contract binds an
inner semantic corpus commitment and declares no dedicated tuning category.
Until a dedicated source commits both identities, even an otherwise valid
development manifest cannot authorize PII tuning. The benign-heavy population
remains evaluation-only.
