---
decision_id: decision-own-canonical-research-in-credential-evidence-and-keep-benchmark-dossiers-as-legacy-presentation
status: accepted
scope: benchmarks
title: Own canonical research in credential-evidence, keep benchmark dossiers as legacy presentation, and dispose of each dossier tooling gap
decided_at: 2026-10-08
---

# Own canonical research in credential-evidence, keep benchmark dossiers as legacy presentation, and dispose of each dossier tooling gap

## Context

#582 lists five gaps found while recording the redact-secret #1012, #1013 and #1014 research as dossiers (#580): the candidates
file `benchmarks/support/dossiers/_candidates-not-yet-families.md` is not validated; the dossier verdict vocabulary has no value for
"pending a maintainer ruling" or "blocked, no path"; pending rulings (R2, R3, the R5 exception, relabel and close requests, Q1 to
Q10) have no id; `blockedBy` is one line of 240 characters and must be null for `ready`; and `slack:workflow-webhook-token` names a
workflow token, not a webhook. Its acceptance is "fixed or explicitly declined per item".

Since #580, canonical public research has moved. credential-evidence holds a schema-validated record per provider, family, format
contract revision, evidence source and review history, released as an immutable snapshot that this repository pins
(`benchmarks/official-runs.json`, population `public-evidence-snapshot`, today `snapshot-2026.10.06.4`, schema 1.8.0). Every
dossier family was imported there (the import is recorded per family as a `legacy-taxonomy-import` reference and a review event
that re-expresses the dossier verdict and tier as `research.state` and an evidence class, with no product status). The release
asset `records-bundle.json` carries the records byte for byte and is bound by the release manifest's digest.

What the pinned records already represent (measured at `snapshot-2026.10.06.4`, commit `77ce7618d104ff30588a6ec96cc392645a5c0e5b`):

- `family.research.state` (`unresearched`, `researched`, `not-found`, `rejected`) and `researchedAt`: how far the facts are
  established, "not whether any tool supports the family" (the schema's words).
- `family.research.blockers[]`: any number of `{ kind: issuance-gated | date-gated | documentation-gated | other, summary }`, on
  any state. 91 blockers on the 290 families; 34 families have more than one.
- `format-contract.claims[]`: one per statement, each with `evidenceClass` (`provider-documented`, `tool-corroborated`,
  `project-policy`, `unresolved`), `observedAt` and cited sources; `openQuestions[]` with a slug id and `raisedAt`.
- `evidence-review-history.events[]`: append-only, `seq`-numbered; a `decided` event is a maintainer's policy ruling and must
  state its strongest dissent and the evidence that would reverse it (credential-evidence ADR 0020).
- Ids are never renamed: a rebrand adds an alias and keeps the id (credential-evidence ADR 0002).

The consumers of the candidates file and of the dossiers, recomputed from the tree on 2026-10-08:

| File | Code that reads it | Human-facing link |
| --- | --- | --- |
| `_candidates-not-yet-families.md` | none: `dossiers:check` (`scripts/scaffold-dossiers.mjs`) opens only `<provider>.md` for each taxonomy provider; `web/services/dossiers.ts`, `web/scripts/check-export-rows.mjs` and `benchmarks/generate-provider-dossiers.ts` skip files starting with `_` | `benchmarks/support/dossiers/README.md` |
| `<provider>.md` (dossier-v1) | `scripts/scaffold-dossiers.mjs` (`dossiers:check`, `dossiers:scaffold`), `benchmarks/generate-provider-dossiers.ts` (`dossiers:publish`, `public/results/provider-dossiers-v1.json`, the Vite oracle's `/support/providers`), `web/services/dossiers.ts` (family page notes and status), `web/scripts/check-export-rows.mjs` (legacy recount of the family page), `scripts/family-new.mjs`, `scripts/family-status.mjs`, `scripts/contribution-readiness.mjs`, `scripts/check-support-ui.mjs` | README, CONTRIBUTING, research issue form |

Of the 66 candidates in the candidates file that are not taxonomy families, six already have a credential-evidence family record
(`airtable:personal-access-token`, `algolia:admin-api-key`, `asana:personal-access-token`, `elastic:cloud-api-key`,
`figma:personal-access-token`, `hubspot:private-app-access-token`). Nine taxonomy families have no credential-evidence record at
the pin (`square:access-token`, `square:oauth-application-secret`, `xata:api-key`, `sourcegraph:access-token`, `unkey:root-key`,
`buildkite:access-token`, `pydantic:logfire-token`, `mapbox:secret-access-token`, `fly:access-token`; promoted by #583).

## Options

1. **Extend dossier-v1 into a dossier-v2** with ruling ids, a pending-ruling verdict, multi-part blockers and a validated candidates
   file. Rejected: it builds a second canonical research corpus beside credential-evidence, with a vocabulary that would drift from
   the one the pinned evidence and the qualification adapter already use.
2. **Delete the dossiers now.** Rejected: ten code paths read them (table above), the Vite oracle and the `legacy` authority's
   rollback reach `provider-dossiers-v1.json`, and nine taxonomy families have no upstream record yet.
3. **Rule ownership, keep dossier-v1 frozen as legacy presentation, represent the open concepts with the upstream fields, and dispose
   of each gap.** Chosen.

## Decision

**Ownership.** Canonical public research on providers, families and formats is credential-evidence's: its records at the pinned
release are the source; this repository reads them and never writes back. A benchmark dossier is a legacy and presentation record:
the hand-written frontmatter and prose that the existing readers above consume, plus the product-facing notes the core repository
does not hold. Product overlays (detector mapping, support status, policy outcomes) stay with the product and the qualification
adapter and are never research fields. `schemas/dossier-v1.json`, `dossiers:check`, `dossiers:publish` and every reader in the table
stay as they are; no dossier-v2 is created (#590 and #591 project the upstream records instead,
[their ADR](2026-10-08-show-the-research-review-state-format-revision-and-format-facts-from-the-pinned-credential-evidence-records.md)).
A taxonomy family still needs its dossier entry (the intake and `dossiers:check` are unchanged); new research lands in
credential-evidence and the dossier links to it.

**Four concepts, four places, never one field.**

| Concept | Where it is recorded | What it is not |
| --- | --- | --- |
| Evidence verdict | credential-evidence `family.research.state` and each claim's `evidenceClass` | a support status, a tier of the product |
| Policy ruling, decided | credential-evidence review `decided` event (`seq`, dissent, reversing evidence) or a `project-policy` claim; a product policy ruling stays in the core repository's record | a verdict value |
| Policy ruling, pending | credential-evidence `format-contract.openQuestions[]`; a pending core research ruling stays in the core record that asks it | a blocker or a verdict |
| Research blocker | credential-evidence `family.research.blockers[]`, one entry per part | a forecast date, a support status |
| Support status | the qualification view (product-owned policy, `benchmarks/qualification-authority.json` picks the pipeline) | anything in a research record |

The dossier-v1 `verdict` and `tier` stay as written (legacy); they are not extended, and pages label them as the benchmark dossier's.

**Stable references.** A ruling is cited by the reference its owner gives it, never by an id minted here:

- a decided upstream ruling: `<review history id>#<seq>` (for example `review-scenario-credential-in-base64-or-hex-form#2`);
- a pending upstream question: `<contract id>#<question id>` (for example
  `github:fine-grained-personal-access-token@1#checksum-applies-to-fine-grained`);
- a core research ruling: the question id inside the core record's commit permalink, for #1014
  `redact-secret@378581770a87751d72e27529796c4f790649fd00:docs/audits/evidence/1014/README.md` with `Q1` to `Q10`.

**Per-item disposition of #582.**

1. *The candidates file is not validated.* **Declined.** No code reads it (table above), so a validator would guard nothing and would
   make the file a second canonical source. It is frozen as of #580 (a note at its head says so); research on a candidate goes to
   credential-evidence (six candidates are there already) or the core record, and promotion stays a family-intake change.
2. *No verdict for "pending ruling" or "blocked, no path".* **Declined for dossier-v1, represented upstream.** A pending ruling is an
   open question and a blocker is a blocker, each separate from `research.state`; adding a verdict value would merge the concepts the
   table keeps apart.
3. *Pending rulings have no id.* **Fixed for upstream-recorded rulings** by the reference scheme above, and the family page lists the
   family's open questions with their ids (#590). **Declined** for minting benchmark ids for core's pending rulings (R2, R3, the R5
   exception, the relabel and close requests): their owner is the core maintainer, and Q1 to Q10 already have the stable reference
   above.
4. *`blockedBy` is one line and null for `ready`.* **Declined for dossier-v1** (the one-line field is what its readers render), **fixed
   upstream**: `research.blockers[]` is an array allowed on any state, and the family page shows every part (#590).
5. *`slack:workflow-webhook-token` should be `slack:workflow-token`.* **Declined as an id rename** here and upstream: ids are never
   renamed (credential-evidence ADR 0002), and the id is in `taxonomy.json`, the Slack dossier, 27 committed support-matrix evidence
   files and the pinned evidence release, so a rename would re-key the family in every one of them and break the frozen evidence. The naming correction is a display-name and alias change in the canonical record, requested
   as [credential-evidence#268](https://github.com/redact-secret/credential-evidence/issues/268) with the id kept; the taxonomy's
   display name stays until that record changes.

## Consequences

- No schema, ledger, taxonomy id, support status or measurement changes. `dossiers:check` and every dossier reader are untouched; the
  candidates file gains a frozen note only.
- The open concepts are visible without a local vocabulary once #590 and #591 show the projected records; until then they are in the
  pinned release.
- Superseded or amended: [Keep provider research in schema-validated dossiers in this repository](2026-09-29-keep-provider-research-in-validated-dossiers.md)
  is amended, not superseded: its validation and permalink rules stand for the legacy dossiers, and its "living index" role for new
  research passes to credential-evidence. Spec: [`docs/specs/research-records.md`](../specs/research-records.md).
