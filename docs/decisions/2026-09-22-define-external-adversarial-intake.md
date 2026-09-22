---
decision_id: decision-define-external-adversarial-intake
status: accepted
scope: benchmarks
title: Define external adversarial fixture intake and provenance
decided_at: 2026-09-22
---

# Define external adversarial fixture intake and provenance

## Context

[#139](https://github.com/redact-secret/redact-secret-benchmarks/issues/139),
part of epic [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138),
which adds evidence that is harder to overfit than the project's own
fixtures. Every corpus here so far is written by project maintainers, and
the holdout checked in today is a public conformance control. Before the
first externally authored suite (#140) arrives, the benchmark needs a rule
for how outside fixtures enter, what they must record, and what they may be
called, so that they are never confused with maintainer regression coverage
or with custodian-held holdout evidence.

## Decision

1. **One intake record per pack.** `adversarial/packs/<id>/intake.json`,
   validated by `schemas/adversarial-intake-v1.json` and
   `benchmarks/lib/adversarial-intake.ts`, records author attribution (or a
   durable pseudonym) and affiliation, whether the author inspected the
   detector implementation, credential provenance and construction,
   independently authored expected ranges and actions, threat categories,
   license and redistribution permission, lifecycle history, the frozen first
   run, and every maintainer edit. The contributor guide is
   [`adversarial/README.md`](../../adversarial/README.md).
2. **Lifecycle.** `submitted → safety-review → frozen-first-run → accepted`,
   with `rejected` (reason required) reachable before acceptance and
   `converted-to-maintainer-regression` reachable after the first run.
3. **Only synthetic material.** Live, revoked, real-derived and
   unknown-provenance credential material is a rejection ground, at pack or
   fixture level. A validator cannot prove a value was never real; the
   declaration plus the safety review is the control, and a declared
   non-synthetic value can never be accepted.
4. **Expectations precede every scanner.** The submitter commits a digest of
   fixtures, ranges and actions at submission; the first run carries that
   digest, and a pack whose author consulted scanner output is rejected.
5. **The first run is immutable and separate.** `first-run.json` records each
   scanner's version, configuration and artifact digest and each result as
   ranges only. Its SHA-256 is pinned in the intake record, and
   `npm run adversarial:check` fails when a frozen first run changes or
   disappears relative to `origin/main`. Later fixes live in reports and
   evidence, never in this file.
6. **Material edits convert.** A maintainer edit to fixture content, an
   expected range or an action removes `externally-authored`; the pack is
   reported as maintainer regression from then on.
7. **Three separately queryable classes.** `public-adversarial`,
   `protected-holdout` and `maintainer-regression`
   (`npm run evidence:query -- --class=…`), never merged into one count.
   Public holdout controls are in none of them.
8. **Wording.** Only protected, custodian-held holdout evidence may be called
   independent. Project-authored evidence never is; accepted outside packs
   are "externally authored", because their authors may have read the
   detector source. `adversarial:check` rejects unnegated independence
   wording in the rendered site.

## Consequences

- #140 adds its suite as packs under `adversarial/packs/` and must pass
  `adversarial:check`; #142's blind evaluation uses the `protected-holdout`
  class, not this intake.
- Wiring accepted packs into `npm run bench` scoring and the site is left to
  #140, when there is a pack to score. This record defines admission, not
  measurement.
- A pack that needs expectation fixes after its first run stops being
  external evidence. That cost is intentional: it keeps "externally
  authored" meaning what it says.
