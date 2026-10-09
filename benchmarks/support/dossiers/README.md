# Provider dossiers

> **Owner (#582).** Canonical public research on providers, families and formats is credential-evidence's, read from the release
> pinned in `benchmarks/official-runs.json`. These dossiers are this repository's legacy and presentation records: their schema and
> vocabulary are frozen, their readers stay, and a taxonomy family still needs its entry. Record new research in credential-evidence and
> link it here. Evidence verdicts, policy rulings, research blockers and support status are four separate things:
> [`docs/specs/research-records.md`](../../../docs/specs/research-records.md).

One file per provider in [`../taxonomy.json`](../taxonomy.json) (plus
`generic.md` for provider-less families). A dossier is the living index of what
we know about a provider's credentials and how far each family is from a
benchmark and a core detector. Tracking issue: #473.

## What goes where

| Record | Where |
| --- | --- |
| Facts about the provider: shapes, sources, issuance, research verdict, blockers | here |
| How the core detects it: gate, FP/FN trade-off, policy class | `redact-secret` `docs/specs/detector-families.md`, detector module docs |
| Final product-judgement evidence | `redact-secret` `docs/audits/evidence/<issue>/`, linked by permalink |
| Iterative research discussion | the research issue's comments, linked from the Research log |
| Measured support status, fixture counts, detector mapping | derived from `taxonomy.json`, `benchmarks/detectors.json` and the support matrix — never hand-written here |

## Research verdicts

| Verdict | Meaning |
| --- | --- |
| `unresearched` | stub; nobody has recorded research yet |
| `ready` | grammar is backed well enough to build fixtures and a detector |
| `issuance-gated` | needs a minted-and-revoked sample we cannot yet obtain |
| `date-gated` | waiting on a provider rollout or deprecation date |
| `not-found` | no reviewed source establishes the grammar |
| `rejected` | deliberately not pursued (not a secret, generic coverage suffices, …) |

A research issue is closed by the PR that records its verdict here
(`Closes #N`), including `not-found` and `rejected`.

## Adding a provider or family

Shortcut: `npm run family:new -- <provider> <family>` does steps 1-2 and adds
an inert fixture stub under `fixtures/generated/families/`;
`npm run family:status -- <provider>[:<family>]` shows what a family needs next.

1. Add the provider/family to `taxonomy.json`.
2. Run `npm run dossiers:scaffold` — it creates a stub for every provider that
   has no dossier yet from [`_TEMPLATE.md`](_TEMPLATE.md). It never overwrites
   an existing file; for a new family in an existing dossier it prints the
   entry to add.
3. `npm run dossiers:check` fails if a taxonomy family has no dossier entry,
   if the frontmatter breaks [`schemas/dossier-v1.json`](../../../schemas/dossier-v1.json),
   if a provider or family id is not in `taxonomy.json`, or if a GitHub file
   link is not a permalink (40-hex commit; `main` only for a living
   `redact-secret` doc). The rules are recorded in
   [the decision](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-29-keep-provider-research-in-validated-dossiers.md).

## Where it shows up

`npm run dossiers:publish` (run by `publish-site.yml` after the support matrix)
joins every dossier with `taxonomy.json`, `benchmarks/detectors.json`, the
fixture-profile floors and the support matrix into
`public/results/provider-dossiers-v1.json`
([`schemas/provider-dossiers-v1.json`](../../../schemas/provider-dossiers-v1.json)),
and the site renders it at `/support/providers`. Per family the stages are
researched, in taxonomy, benchmarked (fixtures meet the stable floors), core
detector (in the pinned inventory) and measured (support matrix reads `stable`
or `provisional`). Only your verdict, tier, `blockedBy`, `researchedAt` and
links are read from the dossier; the stages are derived, so the page answers
"when will X be supported?" with a stage and a blocker, never a date. Do not put
a forecast date in `blockedBy`. `blockedBy` names what blocks the next stage, so
it is `null` for a `ready` family: only `issuance-gated` and `date-gated` carry
it. A caveat worth keeping for a `ready` family goes in the prose, not the field. `npm run support:check:ui` keeps the page in
step with the taxonomy and both schemas.

Research on a candidate whose provider is not in `taxonomy.json` has no
dossier of its own. Until it is promoted into the taxonomy, its disposition
lives in [`_candidates-not-yet-families.md`](_candidates-not-yet-families.md), a frozen record that no code reads (#582); research on a
new candidate goes to credential-evidence.

Never place a real, live or unrevoked credential in a dossier.
