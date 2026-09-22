# Benchmark measurement evidence, per core issue

Per
[`decision-decide-artifact-taxonomy-spec-routing-and-evidence-placement`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-22-decide-artifact-taxonomy-spec-routing-and-evidence-placement.md),
"final evidence, benchmark measurement" — anything a benchmark or scanner run
produced that a `redact-secret` ADR or release relies on — belongs in this
repository, never in `redact-secret/redact-secret`'s own frozen-evidence
archive. This directory is where. See
[`docs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md`](../docs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md)
for the decision record.

## Layout

```
evidence/<core-issue-number>/README.md
```

One directory per `redact-secret/redact-secret` issue whose measurement
evidence lives here, named by that issue's number — not by benchmark issue,
release version, or date. A benchmark-side finding that has not yet crossed
into a core issue (still `observed`/`reviewed` in `benchmarks/known-gaps.json`)
has no `evidence/` directory yet; one is added once a core issue exists to
key it to.

## What `README.md` must state

- **The one-line result** as the first line under the title — pass/fail or
  the headline before/after numbers, safe to read without the rest of the
  file (this is also the line a core-side stub, below, copies verbatim).
- **Source revisions** — the exact `redact-secret` commit or published
  version under test, and the `redact-secret-benchmarks` commit the
  corpus/scoring came from. Both clean, both named explicitly; never "current
  main" without a resolved SHA.
- **Pinned scanner versions** — every scanner that produced a finding in this
  evidence (`redact-secret`/`redact-secret-candidate`, and `gitleaks` /
  `trufflehog` when the run included them), with the exact version or
  artifact identity measured. State plainly when a run is candidate-only and
  carries no peer-scanner comparison.
- **The command** that reproduces the run, copy-pasteable.

A README may link to a fuller narrative report already committed under
`docs/reports/` instead of repeating its tables, but the four items above
must be self-contained here — a reader must not need the linked report to
get the result, the revisions, the scanner versions, and the command.

Supporting raw evidence (a `candidate-evidence-v1.json` or equivalent) may
sit alongside `README.md` in the same directory when it is worth keeping
past the run that produced it; it is optional, the README contract above is
not.

Never commit matched plaintext or raw scanner error text here, same as
everywhere else in this repository.

## What the core repository keeps instead

Per the same core ADR, `redact-secret/redact-secret` does not duplicate this
content. Its own `docs/audits/evidence/<issue>/` stub for a benchmark-owned
finding holds exactly two things:

1. A permalink to this file, pinned to a `main` commit per that ADR's
   permalink rule:
   `https://github.com/redact-secret/redact-secret-benchmarks/blob/<40-hex main commit>/evidence/<issue>/README.md`.
2. The one-line result copied from this file, so a reader of the core repo
   never has to cross the repo boundary just to learn pass/fail.

Nothing here writes that stub — it is authored in the core repository, by
whoever's core-side ADR or release relies on this evidence, once this
directory exists to point at.

## Scope

This applies forward only. A folder like `redact-secret`'s
`docs/audits/evidence/367/` that already exists there is not moved here by
this convention; whether and how existing core evidence folders get
resolved against the taxonomy is that repository's own DS epic (DS3/DS4),
not this repository's to decide.
