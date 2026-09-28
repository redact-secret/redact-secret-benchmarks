---
decision_id: decision-bind-pii-publication-to-the-measured-product
status: accepted
scope: benchmarks
title: Bind PII publication evidence to the one product the publication measured
decided_at: 2026-09-27
---

# Bind PII publication evidence to the one product the publication measured

## Context

The PII support matrix could carry two kinds of product evidence, and the site
published neither. Committed activation records (`evidence/875`–`evidence/880`)
bind a sanctioned product commit, but `eval:publish:pii-support` never passed
them to the builder. The publish workflow deletes and then reads
`results-output/pii/population-release-v1.json`, but nothing produced it, so
every publication read `--population-mode=not-measured`. The matrix builder
also does not cross-check a product binding against the product that produced
the population observations, so the two could describe different builds.

## Decision

A PII publication describes exactly one product: the product this publication
measured.

1. **Activation.** `eval:publish:pii-support --product-commit --product-core`
   binds the committed `evidence/<n>/` record whose activation names that
   source commit and whose core artifact commitment is the SHA-256 of that
   core tarball. No match leaves activation not-measured. Two records for one
   product fail closed.
2. **Populations.** `pii:observe:populations` scans both populations with the
   released lockfile package as the baseline (packed from the registry and
   checked against the lockfile `sha512` integrity) and the measured candidate
   as the candidate, under one scanner identity and one requested selection
   (one selector per registered scope). Only `pii-domain` findings are read. A
   bundle binds only when its candidate is the measured product.
3. **Environments.** Staging measures a qualified product candidate, so it runs
   the observer and passes the product. Production measures the release, has
   no activation record for it, and keeps both not-measured.
4. **Adapter.** The candidate adapter maps every product PII finding type back
   to its family through the product's own naming rule. The inverse is exact,
   because family slugs never contain `_`. A PII finding reads as a sensitive
   classification, the same rule the reviewed SSN mapping already used.
   Credential runs never activate PII, so `candidateConfiguration` and the
   candidate review-queue keys are unchanged.

## Why this and not the alternatives

- *Publish the newest committed record on every environment.* Production would
  show families as available in a release that has no PII activation.
- *Pair any committed record with any staging run.* The matrix would combine
  one product's activation with another product's observations.
- *Use the previous staging candidate as the baseline.* That needs artifact
  retention across runs. The release is the comparison a user decision needs:
  does shipping this candidate add benign false alarms relative to what runs today?

## Consequences

- A staging run whose product commit has a committed record shows real
  activation. Product `main` at `2e1bdcf` binds `evidence/880`.
- Recorded activation is shown as recorded. `evidence/880` requested only
  `pii:global`, so `pii:us:ssn` reads "not in the recorded activation", which
  the page states is not a claim that the product lacks it. Re-recording that
  activation with `pii:us` is a sanctioned-binding change for a later arrival.
- The population corpus currently holds only `pii:us:ssn` controls, so only
  that family has measured strata. A local run of `2e1bdcf` against released
  `0.1.0-beta.9` reads `diagnostic-balanced` no-regression and
  `benign-heavy-stress` regression. The only regressed stratum is the
  `stress-placeholder` case, which authors a structurally valid SSN under
  `placeholder_ssn=` as non-sensitive. The product's own `us-ssn-v1` contract
  says an unlisted placeholder word does not suppress, so the redaction is the
  contracted behaviour and the corpus expectation is what is wrong. It is
  tracked as a corpus fix in
  [#408](https://github.com/redact-secret/redact-secret-benchmarks/issues/408),
  not promoted as a product defect. With #408's corpus fix (the control is now
  the type-invalid `999999999` placeholder) the same local run reads both
  populations no-regression.
