# Support status in the benchmark UI: `/support`

Issue: [#50](https://github.com/redact-secret/redact-secret-benchmarks/issues/50)
(A9; the benchmarks half of
[redact-secret#510](https://github.com/redact-secret/redact-secret/issues/510)).
Page `src/pages/support.ts`, read side `src/support-model.ts`, data
`public/results/support-matrix-v1.json` (generated, gitignored), CI gate
`scripts/check-support-ui.mjs` (`npm run support:check:ui`).

## Why this exists

The [support matrix](support-matrix.md) (#509, A8) is the one generated file
that says what is supported per provider × credential family. Until this issue
nothing displayed it, and the only place a reader met the word "supported" was
prose someone typed. `/support` renders the artifact and nothing else: the site
holds no status of its own, and none can be edited into it.

## Data path

```sh
npm run eval:classify        # A3 (#504): evidence per detector  -> results-output/support-status.json
npm run eval:matrix          # A8 (#509): projected onto the taxonomy -> results-output/support-matrix.json
npm run eval:publish:matrix  # A9 (#50):  validated, then copied -> public/results/support-matrix-v1.json
```

`publish-support-matrix.ts` copies bytes; it never edits a field. It runs
`supportMatrixProblem`, the same validator the page runs before rendering, so
an artifact the UI would reject never reaches `public/results/`.

`supportMatrixProblem` re-checks what the file claims rather than trusting it:
the published `distribution` is recounted from the families, every family is
looked up in the checked-in `benchmarks/support/taxonomy.json` (a matrix
generated before a taxonomy change reads as stale, not as a wrong status),
every non-`stable` status must carry its reason, and a detectorless family must
carry no evidence. A page only renders a matrix that answers `null`.

## What a reader sees

- **The status, in the matrix's own word.** `Stable`, `Provisional`, `Pending`,
  `Unsupported` — the UI may not rename one, and the CI gate enforces it.
- **What each status means**, in one sentence, for someone who has never opened
  the qualification profile, beside the profile's own rationale from
  `benchmarks/support/status-criteria.json`. `Provisional` says outright that
  the evidence is incomplete and that this is *not* "almost stable"; the floors
  a family would have to clear to read `Stable` are listed from the criteria
  file, thresholds and all, so no number is repeated in UI code.
- **Every family, including the ones nothing detects.** An `unsupported` family
  is listed with the reason recorded in the taxonomy, never omitted.
- **The evidence behind the status**, per family: the deciding detector (linked
  to its coverage page), the format-evidence tier and its title, the provider
  source with the version and the date it was observed, corroborating scanners,
  twin coverage — un-probeable families say so rather than reading as zero
  twins — and the unresolved critical metamorphic, mutation and differential
  items.
- **Provenance**: the family and provider counts, and the `sourceReport` run
  id, date, revision and dirty flag carried through from `support-status.json`.

`?status=<status>` filters to one status. With nothing published the page says
what is missing and which three commands produce it.

## The CI gate

`npm run support:check:ui` (a step in `.github/workflows/validate.yml`, and
asserted again from `tests/support-ui.test.mjs`) fails when:

- the page's status copy carries a status that is not in
  `schemas/support-matrix-v1.json`, or misses one that is, or renames one;
- rendering a matrix in which every family carries one status shows any other
  status, or drops a family — which is what a status hard-coded into markup
  looks like;
- a second file under `src/` starts rendering statuses, out of the gate's reach
  (the gate finds them by the `data-support-status` attribute the page marks
  every rendered status with);
- a matrix is published that the page would refuse, or that lacks a status the
  page renders.

The first three run from the checked-in taxonomy and schema alone, so the gate
is deterministic and needs no evaluation run.
