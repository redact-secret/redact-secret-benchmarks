---
decision_id: decision-map-product-finding-types-to-arrival-families
status: accepted
scope: benchmarks
title: Label arrival families typed inside a shared detector by the product's finding type
decided_at: 2026-09-24
---

# Label arrival families typed inside a shared detector by the product's finding type

Status: **accepted** (2026-09-24, #251).
Narrows: [`2026-09-24-settle-arrival-classification-by-owning-detector.md`](2026-09-24-settle-arrival-classification-by-owning-detector.md).

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

The mapping labels findings only. It does not make an arrival id a registry id,
and `eval:classify` still gives arrival ids no support status
(`docs/specs/beta8-evidence.md`).

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
