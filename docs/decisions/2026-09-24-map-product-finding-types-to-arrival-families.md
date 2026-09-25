---
decision_id: decision-map-product-finding-types-to-arrival-families
status: accepted
scope: benchmarks
title: Label arrival families typed inside a shared detector by the product's finding type
decided_at: 2026-09-24
---

# Label arrival families typed inside a shared detector by the product's finding type

Status: **accepted** (2026-09-24, #251; the legacy Pinecone section, #253).
Narrows: [`2026-09-24-settle-arrival-classification-by-owning-detector.md`](2026-09-24-settle-arrival-classification-by-owning-detector.md).
Extended by: [`2026-09-24-score-arrival-families-by-finding-type.md`](2026-09-24-score-arrival-families-by-finding-type.md)
(#730): a mapped arrival family is now scored under its own id.

## Context

The redact-secret adapter labelled every finding with its product detector id
(`scanners/families.mjs`, `findingFamily`). An arrival family that the product
matches inside a shared detector could therefore never carry its own id, however
specific the product's finding was. The owning-detector decision settled the
resulting canonical same-span rows as `not-assertable`. That kept the ledger
clean, but it exempted the rows instead of measuring the classification.

The product already reports the information. Each finding carries a `type`
next to its `detector`, and the product documents the finding types of every
detector (redact-secret `docs/reference/detection.md`, generated from
`docs/coverage/detector-inventory.json`). At product main 10263e5:

| Detector | Documented finding types (detection.md) |
| --- | --- |
| `github-token` | ..., `github_fine_grained_personal_access_token` (L53) |
| `stripe-token` | `stripe_webhook_signing_secret`, `stripe_credential` (L59) |
| `slack-token` | `slack_app_level_token`, `slack_user_token`, `slack_token` (L60) |
| `notion-token` | `notion_integration_token` (L75) |
| `mailgun-api-key` | `mailgun_api_key` (L96) |
| `pinecone-api-key` | `pinecone_api_key` (L107) |

## Decision

1. The redact-secret adapter, published and candidate alike, labels a finding
   with an arrival family id when the pair (product detector id, product
   finding type) is in `arrivalFindingTypes` (`scanners/families.mjs`). Every
   other finding keeps its detector id. The table is:

   | Shared detector | Finding type | Arrival family | Recorded reason |
   | --- | --- | --- | --- |
   | `github-token` | `github_fine_grained_personal_access_token` | `github-fine-grained-pat` | `benchmarks/lib/beta8/211.ts` (redact-secret#517) |
   | `stripe-token` | `stripe_webhook_signing_secret` | `stripe-webhook-signing-secret` | `benchmarks/lib/beta8/211.ts` (redact-secret#729) |
   | `slack-token` | `slack_app_level_token` | `slack-app-level-token` | `benchmarks/lib/beta8/211.ts` (redact-secret#729) |
   | `slack-token` | `slack_user_token` | `slack-user-token` | `benchmarks/lib/beta8/212.ts` (redact-secret#730) |

2. A row enters the table only when both recorded sources support it: the
   family's recorded `reason` names the shared detector and the finding type,
   and the product documents that type for that detector. Scanner output is
   never a source. `tests/evaluation-methods.test.mjs` checks every row against
   the arrival family's `reason`.
3. A detector that gives the arrival shape the same type as its registry shape
   gets no row: `notion-token` (`secret_` and `ntn_`), `pinecone-api-key`
   (`pcsk_` and the legacy UUID) and `mailgun-api-key` (`key-` and the
   triplet). Their findings keep the detector id.
4. A coarser type keeps the detector id. The published 0.1.0-beta.7 reports
   `whsec_` as `stripe_credential` and `xoxp-`/`xapp-` as `slack_token`, so its
   findings still read `stripe-token`/`slack-token`. A later build that stops
   typing a shape specifically is a new classification-disagreement row, never
   silently the same row.
5. The owning-detector decision now applies only to rows where redact-secret's
   label is the owning detector id, that is, a build or a family with no
   specific finding type. Rows where redact-secret's label is the arrival family
   are ordinary peer-coarser rows
   ([`2026-09-24-settle-peer-coarser-classification-disagreements.md`](2026-09-24-settle-peer-coarser-classification-disagreements.md)),
   because the label is then one of the row's targets.

The mapping labels findings only. It does not make an arrival id a registry id.
When this was decided `eval:classify` gave arrival ids no support status; since
[`2026-09-24-score-arrival-families-by-finding-type.md`](2026-09-24-score-arrival-families-by-finding-type.md)
(#730) every mapped family is scored under its own id.

### The legacy Pinecone key (#253)

Since product main 2420e80 (redact-secret#766 and its ADR
`2026-09-24-claim-a-legacy-pinecone-uuid-key-only-under-its-api-key-name.md`),
`pinecone-api-key` claims a legacy bare-UUID key at high confidence with the
redact action when the UUID is assigned to a Pinecone API-key name
(`PINECONE_API_KEY`, `pinecone_api_key`, `PINECONE_KEY`, or
`api_key`/`apiKey`/`Api-Key` on a line naming `pinecone`). A bare UUID stays
unclaimed.

- `pinecone-api-key` is the recorded owning detector of
  `pinecone-api-key-legacy`. Its `reason` in `benchmarks/lib/beta8/212.ts` and
  the `pinecone:legacy-api-key` taxonomy note say so.
- It gets no row in the finding-type table. The product reports the legacy
  UUID with the same `pinecone_api_key` type as the `pcsk_` shape, so the
  recorded sources name no type that tells the two apart (point 3). The
  finding keeps the `pinecone-api-key` detector id.
- The family stays a context-gated arrival family, and the taxonomy maps it to
  no detector. Mapping it to `pinecone-api-key` would score the name-gated UUID
  against the `pcsk_` contract. It is a separate provider generation that the
  product claims only in context.
- If a classification row ever settles on this family, the owning-detector
  decision applies to it with `pinecone-api-key` as the owner. The adapter
  maps no redact-secret `pinecone-api-key` label to a family yet, so no such
  row exists today.

## Consequences

- Both redact-secret adapters bump `adapterVersion` (published 2 → 3,
  candidate 1 → 2). Review ids exclude the product tool's configuration, so
  only rows whose redact-secret labels change re-key.
- Review ledger on 2026-09-24 (trufflehog 3.97.4, gitleaks 8.30.1; published
  0.1.0-beta.7 and candidate 10263e5):
  - the five candidate `beta8-211--stripe-webhook-signing-secret-*` gitleaks
    rows move from `differential.arrival-owning-detector-classification` to
    `differential.peer-coarser-classification`. Their published twins keep
    the owning-detector class, since beta.7 still types `whsec_` as
    `stripe_credential`;
  - 18 new trufflehog rows are `not-assertable` under the peer-coarser
    decision: ten `github-fine-grained-pat` positives (published and candidate,
    which agree) and eight candidate `slack-user-token` positives. TruffleHog's
    Github and Slack detectors each report one label for every token kind of
    their provider;
  - three new candidate rows on `detector-coverage--slack-token-shape-2-*`
    (`xoxp-` in the slack-token group, a T3 policy regression outside the
    xoxb-only slack-token contract) are `resolved`: the product's
    `slack-user-token` label is the family this benchmark's taxonomy files
    `xoxp-` under;
  - 34 carried candidate `redact-secret-only` rows change label only; their
    disposition does not depend on it.
- Twins scope to their family. A product finding on a twin that the adapter now
  labels with the twin's own arrival id counts as a false alarm, where it
  counted as `coDetected` before.
