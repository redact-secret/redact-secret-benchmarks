# Research records: owner, legacy dossiers and what the site shows

Decisions: [ownership and the #582 dispositions](../decisions/2026-10-08-own-canonical-research-in-credential-evidence-and-keep-benchmark-dossiers-as-legacy-presentation.md).

## Owner and compatibility boundary

| Record | Owner | Role here |
| --- | --- | --- |
| Provider, family, format contract revisions, claims, sources, open questions, review history | credential-evidence, at the release pinned by `benchmarks/official-runs.json` (`public-evidence-snapshot`) | canonical; read only, never written back |
| `benchmarks/support/dossiers/<provider>.md` (`schemas/dossier-v1.json`) | this repository | legacy and presentation: the existing readers below, product-facing notes, links into the core record; frozen vocabulary |
| `benchmarks/support/dossiers/_candidates-not-yet-families.md` | this repository | frozen index of the #860 and #1014 candidates as of #580; no reader in code; not validated |
| Detector mapping, support status, policy outcomes | the product and the qualification adapter | never a research field |

The dossier-v1 readers that stay (recompute with `grep -rn "support/dossiers" --exclude-dir=node_modules`):
`scripts/scaffold-dossiers.mjs` (`dossiers:check`, `dossiers:scaffold`), `benchmarks/generate-provider-dossiers.ts` (`dossiers:publish`,
`provider-dossiers-v1.json`, the Vite oracle's `/support/providers`), `web/services/dossiers.ts`, `web/scripts/check-export-rows.mjs`,
`scripts/family-new.mjs`, `scripts/family-status.mjs`, `scripts/contribution-readiness.mjs`, `scripts/check-support-ui.mjs`. Removing one
needs its own decision; nothing here removes them.

## Four concepts, kept apart

| Concept | Recorded as | Cited as |
| --- | --- | --- |
| Evidence verdict | `family.research.state`; each claim's `evidenceClass` | the family id; the claim id inside its contract revision |
| Decided policy ruling | a review history `decided` event; a `project-policy` claim | `<review history id>#<seq>` |
| Pending ruling or question | `format-contract.openQuestions[]` | `<contract id>#<question id>` |
| Research blocker | `family.research.blockers[]` (kind and a one-line summary per part) | the family id |
| Support status | the qualification view | never in a research record |

A core research ruling (R1 to R10, the #1014 questions Q1 to Q10) is cited by its id inside the core record's commit permalink, for #1014
`redact-secret@378581770a87751d72e27529796c4f790649fd00:docs/audits/evidence/1014/README.md`. No id is minted here for a ruling another
repository owns.

## Ids

Family ids are never renamed (credential-evidence ADR 0002). A naming correction is a display-name and alias change in the canonical
record; the taxonomy, the dossier and the evidence keep the id (`slack:workflow-webhook-token`, credential-evidence#268).
