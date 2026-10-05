---
decision_id: decision-read-comparison-and-scanner-pages-from-official-observations-with-separately-identified-denominators
status: accepted
scope: benchmarks
title: Read the comparison and scanner pages from official observations with separately identified denominators
decided_at: 2026-10-05
---

# Read the comparison and scanner pages from official observations with separately identified denominators

## Context

#658 (C6 of the cleanup epic #651) asks that the comparison, scanner and runtime pages stop reading legacy outputs under the new authority, and
warns not to "reinterpret different corpora as the same denominator". Until now `/comparison/`, `/comparison/accuracy/` and
`/evaluation/scanner/` read the legacy run files, the legacy fixture corpora and the committed peer snapshots under either authority, and
said so ("built from the legacy pipeline, kept as the oracle"). The report pages had already moved to the official run of the report
population (#608, #654).

The legacy figures and the official figures do not share a denominator. The legacy run scores the development and regression fixtures of this
repository, with peers replayed from committed snapshots. An official run scores one population (`public-evidence-snapshot`,
`regression-corpus`, `policy-corpus`), each its own set of cases, each run once by the official engine with every scanner in it. Adding the
two, or presenting one as the other's refresh, would give a rate with no single population behind it.

The owner has decided the question (stated in the task for C6, 2026-10-05): the comparison and scanner pages move to official observations
with **separately identified denominators**; each figure names the corpus (population) and the official run it came from; different corpora
are never pooled or reinterpreted as one denominator; the legacy figures stay as the rollback oracle.

This decision records that choice and how it is implemented. It is **not** an owner acceptance of any authority or oracle exit: the authority
value (`benchmarks/qualification-authority.json`) is unchanged, the legacy path is not removed (#660), and the oracle exit condition of the
[switch ADR](2026-10-02-switch-credential-qualification-authority-to-the-new-path.md) is not met or claimed by it.

## Decision

1. **One population per page, named.** Under authority `new`, `/comparison/accuracy/`, `/comparison/` (its accuracy line) and
   `/evaluation/scanner/` read the official run of the population the population policy gives the floors and gates, through the same seam as
   the report pages (`loadCredentialSource`). Every figure on them is a count of that population's cases. The page states the denominator as
   "N cases of the <population> population", names the official run by its semantic digest, its engine and the evidence release, and says the
   other populations were run separately and are not added in. The pipeline stamp of the page carries the same identity.
2. **No pooling, ever.** The regression and policy populations keep their own counts on `/evaluation/qualification/`. A page never sums
   cases or rates across populations, and never describes a legacy figure as a figure of an official population or the reverse.
3. **Scanner provenance is the artifact's.** Under `new`, a scanner's version, mode line, build and configuration hash on the scanner page, and
   the observation date on the accuracy page, are what the official run recorded for it. The committed peer snapshots
   (`peer-observations/`) are not read by any new-authority page; their dates are not described as observations of an official run. The pins,
   the lockfile and the pinned archive checksums stay product-owned inputs both pipelines show, labelled as pins. What an artifact does not
   record (the host operating system, CPU and Node of the run) is shown as "Not recorded", never inferred.
4. **The legacy pipeline is unchanged under `legacy`.** The same routes under authority `legacy` read the legacy run, the committed corpora and
   the peer snapshots exactly as before, and the rollback is still changing the one committed value. `loadLegacySource` stays as the oracle
   seam (tested); no legacy file, script or test is deleted.
5. **The recounts follow the pipeline.** The legacy recounts `web/scripts/check-export-accuracy.mjs` and `check-export-scanners.mjs` are
   intact and apply when the authority is `legacy` (they report that they are skipped under `new`). A new `check-export-comparison.mjs`
   applies under `new`: it recounts the accuracy grids, the differing-file lists, the denominator line, the scanner identities and the run
   named on each page from the qualification view, independently of `web/services` and `web/resolvers`. `check-export-credential.mjs` now
   expects the accuracy page to be stamped new/authority.
6. **Runtime and performance comparison pages are other-domain.** `/comparison/runtime/`, `/comparison/feature/` and
   `/comparison/performance/` read the recorded runtime comparison, the feature claims and the performance records (PII and runtime
   evidence); they never read the credential run, so there is nothing to re-point and they are not part of the credential cutover.

## Consequences

- A credential figure on a comparison or scanner page can be traced to one population and one official run, and an unavailable view shows no
  figure (the pages say so, with the commands), never a silent fallback to the legacy files.
- Under `new` the accuracy page now compares the scanners on the public evidence snapshot (thousands of cases) instead of the legacy
  development corpus; the figures differ from the legacy ones by construction, and the parity report remains the account of the difference.
- The shared validators and types of the legacy site moved to `benchmarks/shared/` (see the cutover record) so the Next app imports nothing
  from `src/` except the design tokens; `src/` keeps one-line re-exports so the Vite oracle site builds unchanged.
- Not decided here: the exit of the oracle, the removal of the legacy path, and the `/evaluation/` method pages, which still read the legacy
  evaluation run and stay oracle until C8.
