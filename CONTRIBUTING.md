# Contributing

This repository measures and records; it does not assert product output (see
the [boundary rule](AGENTS.md#boundary-rule)). Pick the path that matches what
you want to do. Each row names the minimum reading; everything else is
reference and is linked from the section for that path.

## Which path should I use?

| I want to... | Path | Start here | Minimum reading |
| --- | --- | --- | --- |
| Report a wrong result or missing support I saw in the product | [Reporter](#reporter) | the product's issue forms | none |
| Suggest a provider or family to research | [Reporter](#reporter) | the "Research a provider or family" issue form | none |
| Find provider-authored evidence for a family | [Researcher](#researcher) | `npm run family:status -- <provider>` | the provider's dossier |
| Add one synthetic edge case | [Fixture contributor](#fixture-contributor) | an issue or PR with the case described in words | [CONVENTIONS.md](CONVENTIONS.md) |
| Contribute an independently authored adversarial pack | [Adversarial-pack contributor](#adversarial-pack-contributor) | [`adversarial/README.md`](adversarial/README.md) | that README |
| Add a scanner, measurement type or corpus, or change a verdict, tier or promotion | [Maintainer](#maintainer) | the sections under [Maintainer reference](#maintainer-reference) | [ARCHITECTURE.md](ARCHITECTURE.md), [CONVENTIONS.md](CONVENTIONS.md) |
| Understand what the adapter results do and do not show | [Adapter evidence map](docs/specs/adapter-evidence-map.md) | that page | that page |

Rules for every path: synthetic data only (never a real, live, revoked or
real-derived credential, and never a matched value in an issue, comment or
result file), and a submission does not by itself make a family supported or
`stable`. That status is derived from recorded evidence
([support status](docs/specs/support-status.md)), not granted by a PR.

## Reporter

You saw the product miss a secret, flag a benign value, or lack a provider.
File it against the product, not here, using its issue forms (the detector
request, missed-detection and false-positive forms in
[redact-secret](https://github.com/redact-secret/redact-secret/issues/new/choose)).
To ask that a provider's format be researched for the benchmark, open the
"Research a provider or family" issue form in this repository and describe the
credential shape in words or as a grammar. You do not need to know the taxonomy,
tiers or dossier schema; a maintainer or researcher takes it from there.

## Researcher

You can find authoritative, provider-authored evidence (the provider's own
documentation for a token format, its issuance rules, a revocation or
scanning-partner list). The work lands in a validated dossier; see
[Adding or researching a provider](#adding-or-researching-a-provider) for the
commands (`family:status` to find work, `family:new` to add a family,
`dossiers:check` to validate) and the link and verdict rules. Iterative
findings stay in the research issue's comments; the dossier links them by
permalink.

## Fixture contributor

A one-off synthetic edge case (a boundary, an encoding, a lookalike that must
not be flagged) does not require an external adversarial pack. Describe the
case in an issue or open a PR against `develop` that adds it following
[Adding an accuracy case](#adding-an-accuracy-case). Author the expected result
from how the value was constructed, never from any scanner's output. Use
prefixes and bodies no provider issues.

## Adversarial-pack contributor

Only a set of fixtures written outside this project, independently of the
detector implementation, needs the stronger intake: one `intake.json` with
attribution, implementation exposure, synthetic provenance, scanner-free
expectations and license, a maintainer safety review, and an immutable first
run. The full model is in [`adversarial/README.md`](adversarial/README.md) and
[Submitting an external adversarial pack](#submitting-an-external-adversarial-pack).
Project-authored evidence is never described as independent.

## Maintainer

You own taxonomy normalization, verdict and tier decisions, qualification and
promotion. Everything below the next heading is your reference; none of it is
required reading for the other paths.

### How work moves between the product and this repository

The public vocabulary is the same on both sides: an **intake** (an issue or a
suggestion) becomes **research** (a dossier verdict here), then an
**observation** in this repository, **reviewed**, and **promoted** to a product
issue that carries the handoff; the product fixes it and this repository
re-measures at a pinned commit (**fixed**, **verified**). The authoritative
lifecycle is
[`docs/decisions/2026-09-18-govern-benchmark-promotion.md`](docs/decisions/2026-09-18-govern-benchmark-promotion.md),
driven by the `promote-finding` skill. Contributors never coordinate both
repositories by hand: the product issue and the `evidence/<issue>/` record link
each other.

## Maintainer reference

For the standing schema and naming rules these steps must follow, see
[CONVENTIONS.md](CONVENTIONS.md). For how the pieces fit together, see
[ARCHITECTURE.md](ARCHITECTURE.md). For the issue-to-PR workflow itself, see
[AGENTS.md](AGENTS.md). For what the adapter results show, see the
[adapter evidence map](docs/specs/adapter-evidence-map.md).

### Adding an accuracy case

To add an accuracy case, create a corpus and register a unique URL-safe `id`,
`title`, `description`, `kind: "accuracy"`, and `corpus` path in
`benchmarks/categories.json`. Add every fixture slug to
`benchmarks/fixture-detectors.json` with its detector IDs (or `[]` for a shared
case without a detector assignment). Add an assessment rule in
`benchmarks/lib/assessment.ts` and regenerate/check fixtures. Unknown formats
default to T0. Update the snapshot and assignments when adding detectors;
no local upstream checkout is needed to run this repository.

### Adding a new measurement type

For a new measurement type, add its validation/scoring handler to the runner
and a corresponding page renderer. Keep scanner execution separate from
measurement logic. To add a scanner, implement `version(root)` and
`scan(root, fixtures)` in the scanner registry, returning `{ path, start, end }`.

### Refreshing the competitor detector inventory

```sh
npm run detectors:refresh # Fetch pinned release registries and regenerate metadata
npm run detectors:check   # Fetch the same immutable sources and reject snapshot drift
```

Both commands use Python 3.11+ and `gh`; review the explicit family mappings
in `scripts/refresh-detector-inventory.py` when upgrading versions. The web app
loads only the checked-in snapshot and performs no external scanner queries.

### Submitting an external adversarial pack

Adversarial fixtures written outside the project enter through the intake in
[`adversarial/README.md`](adversarial/README.md): one `intake.json` per pack
recording attribution, implementation exposure, synthetic provenance,
scanner-free expectations, threat categories and license, followed by a
safety review and an immutable first run. `npm run adversarial:check`
validates every pack; `npm run evidence:query -- --class=<class>` lists
public adversarial, protected holdout and maintainer regression evidence
separately. Project-authored evidence is never described as independent.

### Adding or researching a provider

Every provider in `benchmarks/support/taxonomy.json` has one dossier at
`benchmarks/support/dossiers/<provider>.md` (`generic.md` for provider-less
families). Open it first: it shows each family's research verdict, tier, sources,
blocker and open questions, so you can pick up the next piece of work. Rules are
in [`benchmarks/support/dossiers/README.md`](benchmarks/support/dossiers/README.md)
and the
[decision](docs/decisions/2026-09-29-keep-provider-research-in-validated-dossiers.md).

0. Finding work: `npm run family:status -- <provider>[:<family>]` is offline
   and prints each family's dossier verdict, detector mapping, fixture
   shortfall against `status-criteria.json` and one next step (counts only,
   never fixture values).
1. New provider or family: `npm run family:new -- <provider> <family>` adds the
   `taxonomy.json` draft, the dossier entry and an inert fixture stub, prints
   the seven-item evidence checklist, and refuses to overwrite anything. (By
   hand: edit `taxonomy.json`, then run `npm run dossiers:scaffold`.)
2. Researching: hand-write only the provider facts (verdict, tier, `sources`,
   `issues`, `evidence`, `researchedAt`, `blockedBy`, prose). Status, fixture
   counts and detector presence are derived and have no field. Verdicts are
   `unresearched`, `ready`, `issuance-gated`, `date-gated`, `not-found` and
   `rejected`. `anthropic.md` is the worked example.
3. Links: a past state is a 40-hex commit permalink, a living `redact-secret`
   doc may use `main`, and branch links are rejected. Never write a real, live
   or new secret-shaped value: describe a shape in words or as a grammar.
4. Open research with the "Research a provider or family" issue form. A
   research issue closes only via a dossier PR's `Closes #N`, including a
   `not-found` or `rejected` verdict; never close it by hand. Iterative findings
   stay in issue comments and the dossier links them by permalink.
5. Run `npm run dossiers:check` (schema, taxonomy ids, permalinks, coverage).

### Recording a decision

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

### Promoting a product regression

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
