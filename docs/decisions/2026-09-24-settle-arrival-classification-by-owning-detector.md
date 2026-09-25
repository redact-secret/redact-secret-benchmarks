---
decision_id: decision-settle-arrival-classification-by-owning-detector
status: accepted
scope: benchmarks
title: Settle arrival-family classification rows labelled by the owning shared detector
decided_at: 2026-09-24
---

# Settle arrival-family classification rows labelled by the owning shared detector

Status: **accepted** (2026-09-24, Beta.8 arrival re-measure for #211).
Amends: [`2026-09-24-settle-peer-coarser-classification-disagreements.md`](2026-09-24-settle-peer-coarser-classification-disagreements.md).
Narrowed by: [`2026-09-24-map-product-finding-types-to-arrival-families.md`](2026-09-24-map-product-finding-types-to-arrival-families.md)
(#251). The adapter now labels a finding with the arrival family when the
product gives the family its own finding type, so this decision applies only
where redact-secret's label is still the owning detector id: a build with a
coarser type (the published 0.1.0-beta.7's `stripe_credential`) or a family the
product does not type separately.

## Context

The peer-coarser decision settles a same-span `classification-disagreement`
row only when redact-secret's label is one of the families the row targets. It
kept the five `stripe-webhook-signing-secret` rows open because "the product
labels `stripe-token`, not `stripe-webhook-signing-secret`".

An arrival family can never meet that condition. Its id is a case target and
never a detector id (`docs/specs/beta8-evidence.md`), and the benchmark's
redact-secret adapter maps findings by product detector id
(`scanners/families.mjs`, `scanners/candidate.mjs`). When the product types a
family inside a shared detector, every correct finding for that family carries
the shared detector's label. The label says which detector the product routes
the shape to, not what the product claims about the span.

For Stripe webhook signing secrets the routing is recorded on both sides:

- the arrival family's `reason` in `benchmarks/lib/beta8/211.ts` names the
  shared `stripe-token` detector as the owner (redact-secret#513, and #729 at
  the registry pin `f2082ab`);
- the product source (`crates/secret-scan-core/src/detectors/stripe.rs` at
  `4f92665`) keeps `whsec_` in `stripe-token`. Candidate `4f92665` reports it
  with the finding type `stripe_webhook_signing_secret`, and the published
  0.1.0-beta.7 reports it as `stripe_credential`. The span is the same in both.

gitleaks 8.30.1 has no `whsec_` rule. It reaches the same span only through
its catch-all `generic-api-key` rule, which the adapter maps to
`generic-token`. That label is coarser than the product's.

## Decision

A `classification-disagreement` differential row is **not assertable against
redact-secret**, class `differential.arrival-owning-detector-classification`,
when all of the following hold:

1. the variant is `canonical`;
2. redact-secret's ranges, the peer's ranges and the fixture's authored expected
   ranges are identical;
3. the row targets an arrival family (no registry detector id), and every
   label redact-secret gives those ranges is the registry detector that the
   family's recorded `reason` names as its product owner;
4. the peer's label is `generic-token`, that is, the peer has no rule of its own
   for the family.

The note records the product finding type observed on the build that was
measured, so a later build that stops typing the shape specifically is visible
in the record.

These rows stay open:

- rows where the product's label is `generic-token` or any detector other than
  the recorded owner;
- rows where any range differs from the authored range;
- rows on twins or mutated variants.

Families are never settled because they look alike.

## Consequences

- The five `beta8-211--stripe-webhook-signing-secret-*` canonical rows move to
  `not-assertable` with `Class: decision=differential.arrival-owning-detector-classification`.
  Their ids do not depend on which build was measured: the published beta.7 and
  candidate `4f92665` outputs agree on range and detector.
- `benchmarks/ledger-decisions.json` maps the class to this file, and
  `npm run ledger:decisions:check` enforces it.
- The same rule applies to the other arrival families the product types inside a
  shared detector (`slack-app-level-token` and `slack-user-token` in
  `slack-token`). They had no row of this class when this was decided.
- Since #251 the candidate-keyed rows of this class read the arrival family and
  are settled by the peer-coarser decision instead. The five published-keyed
  rows keep this class while the pinned release types `whsec_` as
  `stripe_credential`.
- If an arrival family graduates to a registry detector, its rows re-key and
  the peer-coarser decision applies directly.
