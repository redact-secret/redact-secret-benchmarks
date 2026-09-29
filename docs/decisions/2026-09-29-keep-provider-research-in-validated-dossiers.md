---
decision_id: decision-keep-provider-research-in-validated-dossiers
status: accepted
scope: benchmarks
title: Keep provider research in schema-validated dossiers in this repository
decided_at: 2026-09-29
---

# Keep provider research in schema-validated dossiers in this repository

## Context

Provider and family research was opened as issues in either repository,
recorded in comments and closed. The next family for the same provider did not
reopen it, so it was redone or skipped
([#473](https://github.com/redact-secret/redact-secret-benchmarks/issues/473)).
Nothing recorded the stages before measurement: the support page shows only
`stable | provisional | pending | unsupported`. Hand-written prose drifts from
the data: `docs/specs/taxonomy.md` describes 79 families where
`benchmarks/support/taxonomy.json` holds 152.

The dossier is a new kind of artifact with its own edit rules, so this is a new
policy and not a note on an existing spec. It follows redact-secret's
[artifact placement decision](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-22-decide-artifact-taxonomy-spec-routing-and-evidence-placement.md):
iterative discussion stays in issue comments, final product-judgement evidence
stays frozen in the core repository under `docs/audits/evidence/`, and the
dossier is the living index that points to both. It does not conflict with any
record here. [Store benchmark measurement evidence per core issue](2026-09-22-store-benchmark-evidence-per-core-issue.md)
covers measurement evidence, which a dossier never holds.

## Options

1. **Keep research in issues.** No new artifact, and the problem above stays.
2. **A dossier per provider in the core repository.** Rejected: detector to
   family is many-to-many (one detector emits several types, one module spans
   several providers), and the core already records how it detects a family in
   module docs, the detector-families spec and its evidence folders.
3. **A dossier per provider in this repository, next to `taxonomy.json`.**
   Chosen.
4. **Put the research fields into `taxonomy.json`.** Rejected: every research
   edit would change the taxonomy digest recorded in `fixture-index.json`.

## Decision

- **Location.** One file per provider at `benchmarks/support/dossiers/<provider>.md`
  (`generic.md` for provider-less families). Each provider in `taxonomy.json`
  has exactly one dossier and each taxonomy family has exactly one entry in it.
  The frontmatter stays out of `taxonomy.json`, so a dossier edit never changes
  the taxonomy digest.
- **Core and benchmarks split.** The dossier holds facts about the provider:
  prefixes, grammar, sources, issuance feasibility, research verdict and
  blockers. The core repository holds how it detects the credential: gate,
  false-positive and false-negative trade-off, policy class, evidence for a
  product judgement. The dossier links to core evidence and never copies it.
- **Hand-written and derived.** Only research judgement is hand-written:
  `research.verdict`, `research.tier`, `research.sources`, `research.issues`,
  `research.evidence`, `research.researchedAt` and `blockedBy`, plus the prose
  body. Measured status, fixture counts, detector presence and the stage a
  family has reached are derived from `taxonomy.json`, `benchmarks/detectors.json`,
  the status criteria and the support matrix. The schema has no field for them,
  so they cannot be written by hand.
- **Verdicts.** `unresearched` (the stub default), `ready`, `issuance-gated`,
  `date-gated`, `not-found`, `rejected`. `ready` means the grammar is backed
  well enough to build fixtures and a detector. A recorded verdict carries a
  date and at least one research issue. `ready`, `issuance-gated` and
  `date-gated` carry a tier, and the two gated verdicts carry a `blockedBy`
  line.
- **Research closes through a dossier PR.** A research issue is closed by the
  pull request that records its verdict in the dossier, with `Closes #N`. A
  negative verdict (`not-found`, `rejected`) closes an issue the same way. An
  issue is not closed by a comment.
- **Validation.** `schemas/dossier-v1.json` validates the frontmatter.
  `npm run dossiers:check` runs in CI: schema validity, the provider id and every
  family id against `taxonomy.json` (a family must belong to the dossier's
  provider), and a dossier entry for every taxonomy family. Coverage is enforced
  from the start, not report-only, because the scaffold created a stub for every
  family before this record.
- **Permalinks.** A link to a repository file that records a past state is a
  40-hex commit permalink, and `research.evidence` must be one. A living-doc
  link into a `redact-secret` repository may use `main`. Branch, tag and short
  hash links are rejected, and a third-party repository is always pinned to a
  commit.
- **No secret-shaped literals.** A dossier describes a shape in words or as a
  grammar and quotes provider-documented prefixes only. It never holds a real,
  live or unrevoked credential or a newly written secret-shaped value.

## Consequences

- `dossiers:check` gains a YAML parser (`yaml`, dev dependency) and an `ajv`
  compile of the schema. Neither is a scanner package under test.
- A tier or verdict change is a reviewable diff in one file. It changes no
  measured status by itself, because status stays derived.
- The backfill of existing research and the follow-up automation (an issue form,
  a `family:new` scaffold, a `family:status` report, a site page) are separate
  issues under #473. Schema changes need a `dossier-v2.json`, as for the other
  versioned schemas.
- The Anthropic dossier is the pilot. It shows how a family with a documented
  prefix and an undocumented body records that split in `tier`, `blockedBy` and
  the prose.
