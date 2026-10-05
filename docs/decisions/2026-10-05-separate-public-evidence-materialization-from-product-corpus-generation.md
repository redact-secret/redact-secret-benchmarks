---
decision_id: decision-separate-public-evidence-materialization-from-product-corpus-generation
status: accepted
scope: benchmarks
title: Separate public evidence materialization from product corpus generation
decided_at: 2026-10-05
---

# Separate public evidence materialization from product corpus generation

## Context

#659, part of the cleanup epic #651, after C1 (#653) and credential-evidence#79. `scripts/generate-fixtures.mjs` built every generated
category in one pass: the public development corpora (the legacy oracle's input, authored in this repository before credential-evidence
existed), the product regression corpus and the product policy corpus. It validated all of them together, and every `prepare` and `pre*` hook
ran that one pass, including the `view` CI job, which reads only the two product populations (and builds them in memory).

The new path already takes the public evidence population from a pinned credential-evidence snapshot (`public-evidence-snapshot`,
`scripts/fetch-pinned-public-snapshot.mjs`). What was missing is an explicit ownership record for the generated categories, a way to run the
generator for one population, and evidence that the snapshot holds what the generator rules produce, so that the rules can later be retired
without losing a fixture unexplained.

## Experiment

The pinned snapshot was downloaded and verified (`npm run evidence:materialize`) and every fixture the public population's generator rules
write was joined to a snapshot case by the sha256 of its bytes (`npm run evidence:public-check`). Every generated public fixture has a case with
the same bytes in the snapshot (no loss). For a small number of those the snapshot's span expectation differs from the generator's (the
snapshot gives a shape no spans, which the evidence owners decided); the check lists them and does not fail, because the snapshot is the
canonical source. The case-by-case attribution of such differences stays the parity report's (`docs/generated/qualification-parity.json`).
Exporting the two product populations, and building the qualification view from them, was then run with every public generated JSON file absent
and only the product ones materialized: it succeeds, so the `view` job does not need the public development corpora.

## Decision

1. **Ownership is one committed file.** `benchmarks/generated-populations.json` assigns every generated category to a population whose id is a
   population of `benchmarks/qualification-inputs.json`: `regression-corpus` and `policy-corpus` list their categories (product-owned, they stay);
   `public-evidence-snapshot` is the remainder (the legacy oracle's input, owned by credential-evidence, retired only at the oracle exit). A
   category in two populations, a category no generator builds, a second remainder, or a product list that disagrees with
   `corpora/regression/manifest.json` or `qualification-inputs.json` fails the generator before anything is written. The file records ownership,
   never a count, digest or fixture; hashes stay in `benchmarks/generated-corpora.json`, which is unchanged (the generator's bytes are unchanged).
2. **The generator can be run for one population.** `--population <id>` (repeatable) with `--check` or `--ensure` builds, validates, ensures and
   checks only that population's corpora and their manifest entries. The whole-corpus gates (the hash manifest as a whole, the legacy annotation,
   lexical separability, the detector assignments) stay in the full run, which stays the default, so `fixtures:check` and every existing hook
   mean what they meant. Generated credential JSON stays untracked, the storage exclusion check is unchanged, a clean checkout still
   materializes and drift still fails.
3. **Public knowledge is verified from its canonical source.** `npm run evidence:materialize` downloads and verifies the pinned snapshot;
   `npm run evidence:public-check` compares the public population's generator output with it: bytes absent from the snapshot are an unexplained
   loss and fail, a differing expectation is reported. No generator rule is deleted by this change: a rule can be retired only after this check
   shows no loss for its fixtures and the oracle exit (Gate O) is recorded.
4. **Hooks are narrowed by caller, not by name.** The analysis is in the spec. The `view` job reads only the product populations, so it installs
   with `--ignore-scripts` and runs `npm run fixtures:ensure:product`. Every package hook's callers read public development corpora
   (`loadCases`, `pins:manifest`, `features:extract`, `evasion:run`, the test suites, the legacy site), so they keep the full ensure, which costs well
   under a second.
5. **No shared prepared dataset.** The prepared set costs under a second and is already digest-checked by `generated-corpora.json`, keyed by the
   generators' output rather than by a branch. A CI cache would add a stale-hit risk for no measurable gain, so none is added; if one is ever
   needed it must be keyed by the generator sources, the pin, the schema versions and the hash manifest, and verified against the manifest on restore.

## Consequences

- The `view` job no longer builds the public development corpora. A change to a public generator no longer touches that job's materialization.
- Product populations stay active and unchanged: their digests, tags and the committed pins do not move.
- `evidence:public-check` needs `gh` and network, so it is a local and review command, not a required CI job.
- #660 can cite the check's result and `benchmarks/generated-populations.json` when it lists generator rules for removal.
