---
decision_id: decision-score-arrival-families-by-finding-type
status: accepted
scope: benchmarks
title: Score arrival families the product types inside a shared detector
decided_at: 2026-09-24
---

# Score arrival families the product types inside a shared detector

Status: **accepted** (2026-09-24, on maintainer direction for
[redact-secret#730](https://github.com/redact-secret/redact-secret/issues/730)).
Amends: [`docs/specs/beta8-evidence.md`](../specs/beta8-evidence.md), the rule
that `eval:classify` skips arrival ids.
Builds on: [`2026-09-24-map-product-finding-types-to-arrival-families.md`](2026-09-24-map-product-finding-types-to-arrival-families.md)
(#251).

## Context

Since #251 the redact-secret adapter labels a finding with an arrival family id
when the pair (product detector, product finding type) is listed in
`arrivalFindingTypes` (`scanners/families.mjs`). Four families are listed:
`github-fine-grained-pat` (in `github-token`), `stripe-webhook-signing-secret`
(in `stripe-token`), `slack-app-level-token` and `slack-user-token` (both in
`slack-token`).

Their findings, twins, controls and ledger rows were already measured under
their own ids. But `eval:classify` scored registry detector ids only, and the
beta8 evidence spec said arrival ids get no status. The taxonomy therefore
mapped `slack:user-token` and the other three families to no detector, and the
matrix read them as `unsupported`, even though the product detects them and
reports them under their own finding type.

redact-secret#730 asks that each of five selected families be "registered and
scored provisional or better". `slack-user-token` is one of them. The product
does not give it its own detector: it is `slack_user_token` inside
`slack-token`. The maintainer weighed three options: split the product
detector, relax #730's criterion, or score the family by its finding type. The
maintainer chose the third.

## Decision

1. **A mapped arrival family is scored like a registry family.** An arrival
   family that is the target of a row in `arrivalFindingTypes` is a scored id
   (`scoredArrivalFamilies` in `scanners/families.mjs`, re-exported as
   `scoredArrivalIds` from `benchmarks/lib/assessment.ts`). `eval:classify`
   classifies `scoredContractIds`, which are the registry ids plus the scored
   arrival ids. Each scored arrival family is assessed on:
   - its own contract (`benchmarks/lib/beta8/211.ts`, `212.ts`);
   - its own fixture profile, derived from the claim its contract makes:
     `stable-documented` for the T1 families and `arrival-provisional` for the
     T2 families, which have no empirical mode yet;
   - the review-queue rows and ledger entries that target its id.

   Nothing is borrowed from the shared detector's contract, profile, empirical
   record or ledger rows.
2. **The taxonomy maps to the scored id.** Each family's taxonomy entry lists
   the arrival id as its detector:

   | Taxonomy family | Scored id |
   | --- | --- |
   | `github:fine-grained-personal-access-token` | `github-fine-grained-pat` |
   | `stripe:webhook-signing-secret` | `stripe-webhook-signing-secret` |
   | `slack:app-level-token` | `slack-app-level-token` |
   | `slack:user-token` | `slack-user-token` |

   The matrix then carries the measured status, not `unsupported`. The id is
   still an arrival id: it is not in `benchmarks/detectors.json`, it gets no
   coverage page (the support page names it without a link) and no
   `detector-coverage` minimum, and `validateBeta8` still rejects it if it ever
   collides with a registry id.
3. **Tier rules follow the family's contract tier.** `classifyFamilySupport`
   is unchanged:
   - T1 (`stripe-webhook-signing-secret`, `slack-user-token`) can reach
     documented stable. That needs a provider source and the documented floors.
   - T2 (`github-fine-grained-pat`, `slack-app-level-token`) can reach
     empirical stable only through its own record in
     `benchmarks/support/empirical-observations.json`. Neither has one, so
     both read provisional until one is authored.
   - T3 stays provisional, and T0 is pending.
4. **Families without a mapping stay unscored arrival ids.** These are
   `notion-integration-token`, `pinecone-api-key-legacy` and
   `mailgun-api-key-triplet`. Their owning detectors give them the same finding
   type as the registry shape, so their findings keep the detector id and
   carry no evidence of their own to score. A family enters the scored set only
   through a new `arrivalFindingTypes` row, and that row still needs both
   recorded sources (#251, point 2).

## Why this is not a relaxation

- **The same gates apply.** The floors, zero twin failures, zero benign false
  alarms, zero metamorphic critical failures, zero unresolved critical
  mutation rows, zero unresolved differential contract disagreements, and the
  profile cells are all unchanged. No threshold, criterion or ledger
  disposition was edited to produce a status.
- **The evidence is the family's own.** A registry family's status describes
  a product detector through its findings. A mapped arrival family's findings
  carry its own id, so the same evaluation reads that family directly. No
  status is inherited from the shared detector, which reads `stable` in both
  modes for `github-token`, `stripe-token` and `slack-token`.
- **A build that does not type the family is still held to the gates.** The
  published 0.1.0-beta.7 reports `xoxp-`/`xapp-` as `slack_token` and `whsec_`
  as `stripe_credential`, so its findings carry the owning detector id. A
  twin flagged under that label reads as co-detection in the twin method (an
  upper bound, as `docs/specs/beta8-evidence.md` already says for twins). The
  differential method still queues the disagreement, and an open row blocks
  stable. In published mode the four `slack-app-level-token` rows where beta.7
  flags a negative twin through `slack-token` stay `open`, and so do the two
  `slack-user-token` rows where beta.7 misses a positive. Neither family reads
  stable in published mode.
- **The criterion #730 states is met, not reworded.** The two rejected
  options were to split `slack-token` in the product, a product architecture
  change the benchmark does not get to demand, and to relax "scored
  provisional or better" into "labelled". This decision takes neither. It
  scores the family as the product ships it.

## Consequences

- `eval:classify` reports 74 families (70 registry + 4 scored arrival). A
  reader comparing a count with an earlier report must compare like with like.
  The registry-only count is the earlier unit.
- Measured on 2026-09-24 (trufflehog 3.97.4, gitleaks 8.30.1):

  | Family | Published 0.1.0-beta.7 | Candidate 10263e5 |
  | --- | --- | --- |
  | `github-fine-grained-pat` | provisional (T2, no empirical record) | provisional (T2, no empirical record) |
  | `stripe-webhook-signing-secret` | stable (documented) | stable (documented) |
  | `slack-app-level-token` | provisional (T2, no empirical record; 4 open differential rows) | provisional (T2, no empirical record) |
  | `slack-user-token` | provisional (7 metamorphic, 7 mutation failures; 2 open differential rows) | stable (documented) |

  Stable counts: published 41/74 (40/70 registry-only), candidate 56/74
  (54/70 registry-only, as #262 read at 3144bb3).
- No ledger row was added or re-keyed. The scoring change edits no fixture,
  case or adapter, so every review-queue id is unchanged. Some existing rows
  now count toward these four families' status: the six published-keyed `open`
  rows above.
- Tests: `tests/classify-support.test.mjs` pins the scored set to the mapping,
  and `tests/taxonomy.test.mjs` / `tests/beta8.test.mjs` accept a scored arrival
  id as a taxonomy detector only for its own taxonomy family.
- If the product registry gains a detector for one of these families, it
  graduates as `docs/specs/beta8-evidence.md` describes. Its
  `arrivalFindingTypes` row is removed in the same change, and the family
  leaves the scored arrival set for the registry set.
