# Generated populations and public evidence materialization

Issue: [#659](https://github.com/redact-secret/redact-secret-benchmarks/issues/659) (C7), part of the cleanup epic
[#651](https://github.com/redact-secret/redact-secret-benchmarks/issues/651).
Decision: [Separate public evidence materialization from product corpus generation](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-05-separate-public-evidence-materialization-from-product-corpus-generation.md).

This repository measures and records. This page and the files it names assert no product result and record no count.

## Two sources, three owners

`fixtures/generated/build.mjs` builds every generated credential category in memory. `benchmarks/generated-populations.json` says who owns each one,
using the population ids of [`benchmarks/qualification-inputs.json`](qualification-inputs.md):

| Population | Ownership | Categories | Canonical source |
| --- | --- | --- | --- |
| `regression-corpus` | product | listed explicitly (the generated categories of `corpora/regression/manifest.json`); `twin-scope-regressions` is qualification-only and built by `twin-scope.mjs`, never written as a file | this repository's generators (`regressions.mjs`, `closed-milestone.mjs`, `twin-scope.mjs`) |
| `policy-corpus` | product | listed explicitly (the category of `qualification-inputs.json`) | `policy-qualified-credentials.mjs` |
| `public-evidence-snapshot` | legacy oracle | the remainder: every other generated category | the pinned credential-evidence snapshot; the generator rules are the legacy path's input until the oracle exit |

A new family's category needs no edit to the file (it falls into the remainder). A product category cannot be absorbed silently: the generator fails
before writing anything on a category in two populations, a category no generator builds, a second remainder, or a product list that disagrees with
`corpora/regression/manifest.json` or `qualification-inputs.json`.

## Commands

| Command | Does | For |
| --- | --- | --- |
| `npm run fixtures:generate` | writes every generated corpus, the hash manifest, the legacy annotation and the detector assignments | an intentional generator change |
| `npm run fixtures:check` | the full check plus the storage rule (no generated credential JSON tracked) | CI `validate-sources`, `compare` |
| `node scripts/generate-fixtures.mjs --ensure` | the `prepare` and `pre*` hooks: write what is missing, fail on drift | every consumer of the public development corpora |
| `npm run fixtures:ensure:product` / `fixtures:check:product` | the same, for `regression-corpus` and `policy-corpus` only | consumers of the product populations only (the `view` job) |
| `npm run fixtures:check:public` | the check for the `public-evidence-snapshot` population's corpora only | reviewing a public generator change |
| `npm run evidence:materialize` | downloads the pinned snapshot into `results-output/evidence-snapshot` and verifies manifest digest, asset digest, release identity and corpus digest | reading the canonical public knowledge |
| `npm run evidence:public-check` | compares the public population's generator output with that snapshot | before a generator rule is proposed for removal |

`--population <id>` (repeatable) needs `--check` or `--ensure`: a population run never rewrites the hash manifest, the legacy annotation or the detector
assignments, and skips the whole-corpus gates (lexical separability across all corpora), which the full run keeps. The committed
`benchmarks/generated-corpora.json` is unchanged by the split; a population run compares only its own entries.

## What `evidence:public-check` decides

For each fixture the public population's rules write, it looks for a snapshot case with the same bytes.

- **Kept**: a case with the same bytes exists.
- **Differing expectation**: the bytes are kept but the span expectation is not the generator's. The snapshot is canonical, so this is listed and never fails;
  the attribution of each such difference is the parity report's ([qualification-parity](qualification-parity.md)).
- **Loss**: no case has those bytes. This fails. It is the "no unexplained fixture loss" gate: a rule whose fixtures are lost cannot be deleted until the
  loss is explained in the snapshot's evidence or the fixture is intentionally dropped by its owner.

The check never writes a file and never reads scanner output. Product populations are not compared: they are not public evidence and are never copied
into credential-evidence.

## Hook caller analysis (#659)

Every package hook runs the full ensure, because each hook's command reads public development corpora:

| Hook | Reads | Result |
| --- | --- | --- |
| `prepare`, `predev`, `prebuild` | the legacy site and `loadCases` over `categories.json` | full ensure kept |
| `prebench`, `precompare`, `pretest`, `pretest:integration`, `pretest:coverage` | `loadCases`, the root tests (each reads `fixtures/generated/*.json`) | full ensure kept |
| `prepins:manifest`, `prepins:manifest:check` | `corpusHashes` of every category in `categories.json` | full ensure kept |
| `preevasion:run`, `prefeatures:extract` | `loadCategoryInputs` over the development and regression partitions | full ensure kept |
| `web/scripts/docker-run.mjs` | the CI web job's inputs, which read the legacy corpora | full ensure kept |
| CI `view` job | `qualification:export` builds the two product populations in memory (`population-snapshot.ts` uses `buildCorpora()`), `official-runs:check --bindings`, `qualification:view` | `npm ci --ignore-scripts` then `fixtures:ensure:product` |

The `view` result was verified with every public generated JSON file absent. The full ensure takes well under a second, and `generated-corpora.json` is already
the digest check of the prepared set, so no shared CI dataset is added (see the decision). When the legacy path is removed (#660) the public development
output and its hooks go with it, and the product-only commands become the hook.

## What stays

Generated credential JSON stays untracked (`.gitignore`, `scripts/check-fixture-storage.mjs`); the clean-checkout materialization (`prepare`) stays; intentional
drift fails (`Generated corpus drift`, `Generated corpus hash drift`, `Assessment drift`, `Detector assignment drift`). No generator rule was removed.
