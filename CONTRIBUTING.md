# Contributing

How to add a new accuracy case, a new measurement type, a new scanner, or
refresh the competitor detector inventory, and how a benchmark finding is
promoted into a product regression. For the standing schema and naming rules
these steps must follow, see [CONVENTIONS.md](CONVENTIONS.md). For how the
pieces fit together, see [ARCHITECTURE.md](ARCHITECTURE.md). For the
issue-to-PR workflow itself, see [AGENTS.md](AGENTS.md).

## Adding an accuracy case

To add an accuracy case, create a corpus and register a unique URL-safe `id`,
`title`, `description`, `kind: "accuracy"`, and `corpus` path in
`benchmarks/categories.json`. Add every fixture slug to
`benchmarks/fixture-detectors.json` with its detector IDs (or `[]` for a shared
case without a detector assignment). Add an assessment rule in
`benchmarks/lib/assessment.ts` and regenerate/check fixtures. Unknown formats
default to T0. Update the snapshot and assignments when adding detectors;
no local upstream checkout is needed to run this repository.

## Adding a new measurement type

For a new measurement type, add its validation/scoring handler to the runner
and a corresponding page renderer. Keep scanner execution separate from
measurement logic. To add a scanner, implement `version(root)` and
`scan(root, fixtures)` in the scanner registry, returning `{ path, start, end }`.

## Refreshing the competitor detector inventory

```sh
npm run detectors:refresh # Fetch pinned release registries and regenerate metadata
npm run detectors:check   # Fetch the same immutable sources and reject snapshot drift
```

Both commands use Python 3.11+ and `gh`; review the explicit family mappings
in `scripts/refresh-detector-inventory.py` when upgrading versions. The web app
loads only the checked-in snapshot and performs no external scanner queries.

## Recording a decision

`docs/decisions/` holds this repository's ADRs — benchmark-methodology and
process decisions, indexed in
[`docs/decisions/DECISIONS.md`](docs/decisions/DECISIONS.md) and validated by
`npm run decisions:validate` (frontmatter, an index entry, and a `Decision`
heading for every accepted record). A new record needs `decision_id`,
`status`, `scope: benchmarks`, `title` and `decided_at` frontmatter, a `#
Title` heading, and a `## Decision`/`## Decisions` section if accepted.

A decision that applies an existing policy to one more family or one more
fixture is a note on the relevant `docs/specs/*.md` page plus its supporting
evidence, not a new ADR (adopted from redact-secret's ADR criterion,
[`decision-decide-artifact-taxonomy-spec-routing-and-evidence-placement`](https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-22-decide-artifact-taxonomy-spec-routing-and-evidence-placement.md)).
A new ADR is warranted only for new policy, a new trade-off, or a precedent
that spans families. A resweep, review, or measurement run that led to a
decision belongs under `docs/reports/`, linked from the ADR's `Context`
section — never copied into the ADR body.

## Promoting a product regression

This repository owns discovery and evaluation evidence; the product owns the
small, release-blocking behavioral regression. The authoritative lifecycle,
transition evidence, fixed-candidate rerun commands, and two-gate acceptance
rule are in
[`docs/decisions/2026-09-18-govern-benchmark-promotion.md`](docs/decisions/2026-09-18-govern-benchmark-promotion.md).
The product-side placement and provenance rules are linked there. Do not copy a
discovery matrix, generated variants, competitor observations, holdout material,
or raw result bundles into `redact-secret`.

Durable evidence for one `redact-secret` issue — source revisions, pinned
scanner versions, the reproduce command, and the one-line result — is
committed to [`evidence/<issue>/README.md`](evidence/README.md), not to a
git-ignored `results-output/` path; `redact-secret`'s own evidence archive
keeps only a permalink to it plus that one-line result. See
[the evidence decision record](docs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md).

The `promote-finding` skill (see [AGENTS.md](AGENTS.md)) drives one
`benchmarks/known-gaps.json` record through this lifecycle end to end.
