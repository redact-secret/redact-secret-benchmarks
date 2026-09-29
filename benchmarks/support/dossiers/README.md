# Provider dossiers

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
   [the decision](../../../docs/decisions/2026-09-29-keep-provider-research-in-validated-dossiers.md).

Never place a real, live or unrevoked credential in a dossier.
