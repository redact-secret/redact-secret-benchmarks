---
name: release-regression-check
description: Pin an exact redact-secret release-candidate commit — even one not checked out anywhere — build it as immutable npm candidate artifacts, evaluate it against this benchmark's fixed and expanded corpora, and surface a fixture-level before/after regression view ahead of a release decision.
---

# release-regression-check

The counterpart to `benchmark-candidate`, run from this side of the repo
boundary. That skill requires the product repo's checked-out `HEAD` to already
be the commit under test; this one exists because a pre-release candidate
(a release-branch tip, a tag, a merge commit) is rarely what anyone already
has checked out. It never touches the product repo's active checkout — the
candidate commit is pinned in a disposable detached worktree — and it never
implements benchmark logic itself: `benchmark:candidate` and `eval:candidate`
still own build, install, scoring, and the evidence contract.

## Inputs

Require one explicit lowercase full 40-character `redact-secret` commit — the
release candidate. Do not resolve a branch, tag, abbreviated SHA, or a moving
release/default branch on the user's behalf. If it is absent or not a full
40-character SHA, stop and request it.

Optional:

- an explicit lowercase full 40-character `redact-secret-benchmarks` commit
  (defaults to this repo's current clean `HEAD`);
- `--filter <detector-id>` to scope the run (marks evidence
  `filtered-development`; never treat it as a full-suite substitute);
- a path to an earlier `candidate-evidence-v1.json` to diff against in
  addition to the per-fixture `baseline` comparison every run already
  carries — useful for a release-over-release trend, not just candidate-vs-
  currently-published.

## Preflight

```sh
rtk git -C ../redact-secret remote get-url origin   # must be redact-secret/redact-secret
rtk git status --porcelain                          # this repo must be clean when its HEAD is the benchmark ref
rtk git rev-parse HEAD
```

Resolve the product commit to an exact SHA and confirm it is present locally,
fetching once if it is not:

```sh
git -C ../redact-secret rev-parse <requested>^{commit}
git -C ../redact-secret fetch --no-tags origin <requested>   # only if the line above fails
```

Reject anything that does not resolve to exactly the requested 40-character
SHA.

## Pin the candidate without touching the active checkout

```sh
scratch=$(mktemp -d)
git -C ../redact-secret worktree add --detach "$scratch/candidate" <product-commit>
```

This worktree — never the user's `../redact-secret` branch — is what gets
built and evaluated. Do not run the steps below against the user's active
checkout; that would force them to detach `HEAD` on their own branch.

## Execute and validate

From inside the pinned worktree, reuse the product's own orchestration end to
end, pointing it explicitly at this repo so it can never fall back to an
ambiguous sibling guess or a network clone:

```sh
benchmarks_repo=$(git rev-parse --show-toplevel)   # this repo, captured before cd
benchmark_commit=<benchmark-commit-or-current-HEAD>
outdir="$benchmarks_repo/results-output/release-regression/<product-commit:0:12>-<benchmark_commit:0:12>"

(cd "$scratch/candidate" && npm run benchmark:candidate -- \
  --benchmark-ref "$benchmark_commit" \
  --benchmark-repo "$benchmarks_repo" \
  --output-dir "$outdir" \
  [--filter <detector-id>])
```

`--output-dir` is mandatory here: omitting it would place evidence inside the
disposable worktree removed in the next step, deleting it along with the
worktree. That command already builds the façade/N-API/Wasm tarballs, runs
`eval:candidate`, and runs `eval:validate`. Treat any nonzero exit, non-
`complete` status, failure entry, or identity mismatch (candidate source
commit, benchmark source commit, artifact SHA-256) as incomplete evidence.
Never produce a regression view from incomplete evidence.

Then clean up unconditionally, including on failure:

```sh
git -C ../redact-secret worktree remove --force "$scratch/candidate"
rm -rf "$scratch"
```

## Interpret: the regression view

Read `<outdir>/candidate-evidence-v1.json`. Every result row already pairs
`baseline.outcome` (the currently pinned published version) with the
candidate's own `outcome` / `actualFindings` — that pairing is the before and
after. For each row, classify:

- **regressed** — baseline was `EXACT`/`COVERED`/not-flagged and the candidate
  is `MISS`/`PARTIAL`, or a `must-not-flag` fixture now flags;
- **fixed** — the inverse;
- **unchanged**; or
- **new** — no `baseline.outcome` (not yet present in a published baseline).

Report, separated by `corpusSection` (`fixed-corpus` vs `expanded-corpus`,
never summed together) and labeled `filtered-development` whenever `--filter`
was used:

- product commit and clean state, benchmark commit and clean state;
- candidate façade SHA-256 and every component hash;
- every **regressed** fixture by `fixtureId`, with its baseline and candidate
  outcome — this is release-blocking-*shaped* evidence, not itself a release
  gate;
- every **fixed** fixture by `fixtureId`;
- counts for unchanged/new so the totals reconcile against `completeness`; and
- the absolute evidence path.

When a second evidence file was supplied, additionally diff this run's rows
against it (candidate-over-candidate, e.g. this release vs the previous one)
the same way, joining on `fixtureId`.

## Boundaries

This produces discovery evidence only. Per
`docs/specs/decisions/2026-09-18-govern-benchmark-promotion.md`, a regression found
here is not itself a release-blocking product bug until it is entered into
`benchmarks/known-gaps.json`'s `observed → reviewed → promoted → fixed →
verified` lifecycle, and this workflow "does not authorize versioning,
publication, deployment, or issue closure." Do not use this skill's output by
itself to approve or block a release — hand the regressed fixture list to that
lifecycle and to the product's two-gate acceptance rule. Do not modify
benchmark ground truth based on candidate output. Do not invoke `resolve-issue`
or `review-pr` from here.

`<outdir>` here stays a general, git-ignored release sweep — it is not
per-issue evidence. When one of its rows backs a specific `redact-secret`
issue reaching `known-gaps.json`'s `verified` state, that issue's durable
evidence is committed separately to `evidence/<issue>/README.md` (see
[`evidence/README.md`](../../../evidence/README.md)), not left only in this
disposable output directory.
