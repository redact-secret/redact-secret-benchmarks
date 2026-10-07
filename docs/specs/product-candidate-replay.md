# Product candidate replay

How an unpublished product build is measured on the adopted evidence before a release (#698, #690). Decision:
[measure an unpublished product build as an exploratory candidate replay](../decisions/2026-10-04-measure-an-unpublished-product-build-as-an-exploratory-candidate-replay-on-the-engine-candidate.md).
This repository measures and records (the boundary rule): the replay reports an effect and decides nothing.

## Relation to the diagnostic lane (#705)

`official-runs.yml` has two exploratory mechanisms for an unreleased product build, with different questions, and a dispatch takes one of them (the `plan` job refuses both):

| | diagnostic lane (`mode: diagnostic`, #705) | candidate replay (`candidate`, #698) |
| --- | --- | --- |
| question | do the product's own findings on the regression and policy populations change, within one product scan | what does the build change on the adopted evidence, against the published control, with every peer unchanged |
| scanners, methods | the product only; no peers, no methods | the control's scanner roster (the four required scanners by default; five only when the control and the replay both opted OpenRedaction in, `--include-openredaction`, #812), plain and methods, two engine runs with equal semantic digests |
| product build | the registry's pinned candidate | a registered tarball set, byte-verified (`benchmarks/product-candidates.json`) |
| output | `diagnostic-<population>` artifacts and a summary; never recorded | `candidate-run-<population>` artifacts, the effect report, triage, an archive, the 2x2 on a new snapshot |

Use the lane to iterate on a fix; use the replay for the report a release decision sees. Neither is an accepted run or public evidence. Spec of the lane: [official runs, "The diagnostic lane"](official-runs.md).

## What is measured

The registered candidate (`benchmarks/product-candidates.json`) on the adoption's engine candidate (`benchmarks/evidence-adoption.json` `engineCandidate`), the accepted evidence, the plain runs of the floors, regression and policy populations and the floors methods run (metamorphic, mutation, differential), all five scanners, the engine's own configuration, linux-x64, two engine runs each with equal semantic digests. The control is the engine candidate's replay of the published build (`engineCandidate.replay.archive`), so the product build is the only difference.

| Class | Value |
| --- | --- |
| run class | `exploratory` (the engine refuses an unpinned build as official) |
| publication | `internal` |
| recorded in `runs[]` | never |
| public evidence | never |

**The engine and the control follow the acceptance (#657).** For an accepted adoption that also carries `engineProductAcceptance` (the engine and the published product accepted on the same evidence, #808), a candidate replay runs on the accepted engine (`engineProductAcceptance.engine`) and is compared with `candidate.replay.acceptedPinsCopy`: the published product at the accepted pins, measured once, recorded with its archive release and sha256, the engine tag and product version it was measured at, its semantic digests and its recorded runs. A copy for other pins is refused as stale and a missing one is refused with what to record; a record without an acceptance keeps `replay.replayCopy`. The acceptance block, the pins, `runs[]`, the ledger and the authority are never written. `scripts/candidate-control.mjs`, decision: [replay product candidates on the accepted pins](../decisions/2026-10-07-replay-product-candidates-on-the-accepted-engine-and-product-pins.md). A control copy is `official-runs.yml` in the default (full, four scanners) mode dispatched once on the tip of `develop`, archived with `scripts/replay-archive.mjs pack`; its plain and methods semantic digests equal the canonical official runs' when the pins are the same.

## Registry

`candidates[]`: `id`, `product` (repository, full commit, version, `published: false`, the PRs, the build description, the CI run the addon came from), `control` (the published pin), `platform`, `runClass`, `publication`, `release` (the release of this repository that holds the tarballs) and `packages[]` (name, file, sha256, size, platform). The core and wasm packages are platform-neutral; the node addon is the one built for the replay platform. After a replay the candidate carries `replay` (the CI run, the archive release and digest, the benchmark revision, the verdict counts, `repeatRunsEqual`). Gate: `npm run product-candidates:check` (`--bindings` also checks the release assets).

Registering a candidate: build the three packages from the exact commit (the core with `npm pack` after `js:build`, the addon and wasm from the commit's own CI run), upload them to a release of this repository, record the digests. Nothing is published.

## The scanner roster must match the control

The candidate diff and the effect report refuse a different roster (`candidate-diff.ts`, `scanner rosters differ`; the manifest's scanner list and `config_hash` move). Since #812 a replay measures the four required scanners by default and OpenRedaction is a positive opt-in, so the default replay matches a default control (the accepted adoption's control leaves the optional OpenRedaction default profile out, #763). The roster is checked at three points, none of which turns a scanner on to make it match or splices an old observation: `run-candidate-replay.mjs dispatch` compares the control's recorded scanner set (`recordedRuns[].caseCounts`) with the dispatch's effective selection **before any CI minute is spent**; the driver does the same before it runs the engine; `collect` refuses downloaded run records of another roster than the control's. An incompatible pair is reported with the way out: create the matching control explicitly (`node scripts/run-evidence-replay.mjs dispatch ... [--include-openredaction]`, which records the roster it measured as `replay.scannerSelection`), or dispatch the replay with the matching selection (`--include-openredaction`, about 50 minutes on the public population and explicit). `--omit-optional` is deprecated and changes nothing. The receipt records `omittedOptionalScanners` or `includedOptionalScanners`. A replay that includes OpenRedaction cannot be compared with a control that omitted it, nor the reverse.

## Install and refusal

`scripts/install-product-candidate.mjs` downloads each registered tarball, refuses unless its size and sha256 are the registered ones, empties `node_modules/<package>` of the shim and extracts the tarball over it. The shim must then load the candidate and report its version. The run script (`scripts/run-official-credential-eval.ts --candidate <id>`) does this before anything is measured and refuses when the engine checkout is not the engine candidate's revision, a configuration pin differs, an artifact is not exploratory and internal, or the two runs disagree. The receipt (`product-candidate-receipt.json`: the digest of every installed file) is kept with the run.

## Report

`scripts/candidate-replay-report.ts` and `scripts/compare-replay-effects.ts` (strict: every difference is an identity field or a per-case outcome keyed by semantic ids) produce `candidate-effect.json/.md`, `effect.json`, `triage.json/.md`. Per population: cases fixed (a failing case that now passes), improved (passing before and now, with fewer unexpected findings or less collateral: the scored outcome does not move, the findings do), regressed (worse), changed, unchanged and still failing, with the findings of both builds (UTF-8 byte ranges, family, action), the sanitized view of every differing plain case (derived from the recorded redact and block ranges with a `[action:family]` marker, not the product's own placeholder; `warn` leaves the text unchanged), the peers' unchanged check (every peer's case results equal) and the repeat-run agreement of both sides. Worse is only: a pass that now fails, more leaked or collateral bytes, a control that is now flagged, an assertion that now fails or a new review occurrence. `worsened` is the one flag.

The triage rules (`benchmarks/qualification/triage-decisions.ts`, `triage-core-1203.ts`, `triage-core-1205.ts`) take the product's classification of the base cases from redact-secret#1203 and #1205 and claim a fix only for a case the candidate replay shows passing that failed (fixed) or passing both times with the unexpected output removed (improved). An `evidenceProposal` is a proposed change to credential-evidence, kept apart from the disposition; the adopted snapshot is never edited here.

## One command

```bash
node scripts/run-candidate-replay.mjs all --candidate core-main-422e43e3   # on a pushed, clean feature branch (core main 422e43e3 carries PRs #1202, #1204 and #1206)
```

`dispatch` (checks the push, the registry and its release, dispatches `official-runs.yml` with `candidate`, finds the run), `wait`, `collect` (downloads the artifacts and the report, checks each run record is exploratory, internal, this candidate and repeat-equal, archives them as `candidate-runs-<run id>`, fetches the archive by its digest and compares every artifact byte, writes `docs/generated/evidence-adoption/product-<id>/` and the registry receipt) and `propose` (commit, push, draft pull request) can be run alone; each is idempotent and refuses with the reason. The workflow stays `contents: read`; the release and the pull request use the maintainer's `gh` credentials.

## The candidate diff and the saved baseline from artifacts (#657)

The legacy candidate diff (`eval:candidate`, `public/results/candidate-evidence-v1.json`, compared with `baselines/<version>.json`) re-runs the legacy engine. The same question,
what an unpublished build changes against the saved release, is answered from validated RunArtifacts by `npm run qualification:candidate-diff`
(`scripts/build-candidate-diff.ts`, `benchmarks/qualification/candidate-diff.ts`):

```bash
npm run qualification:candidate-diff -- --candidate core-main-1e45cecf --candidate-dir <downloaded candidate-run-* laid out per population> --verify-tarballs
```

| | Reads |
| --- | --- |
| candidate side | the `candidate-run-<population>` artifacts of a replay (plain populations and the methods run): run record, `product-candidate-receipt.json`, artifact bytes |
| saved baseline | the control the adoption record binds by archive release and sha256 (`candidate-control.mjs`, fetched with `replay-archive.mjs`, digest verified), never a directory taken on trust and never a legacy `baselines/<version>.json` |

Refused with exit 1, nothing written: a candidate artifact that is not exploratory and internal (record and manifest); a run record or receipt that does not name the registered candidate id, commit and exactly its tarball sha256 set
(a missing, extra or different package fails); artifact bytes or a semantic digest that differ from the run record; repeat runs that did not agree; a baseline that is itself a candidate run or measured a candidate build; and any difference between the
sides other than the product build (engine, protocol, configuration hash, evidence identity, scanner roster, every peer's identity, every peer's per-case results, the product's case universe). `--verify-tarballs` also downloads each registered tarball from the
candidate's release, requires its sha256 to be the registered one and requires the receipt to list exactly the files that tarball holds, so the claim is about the bytes and not a version string (the replay's manifest labels the build `released`
because the shim installs the published version first; the receipt, not that label, binds the bytes).

The output is an internal projection (`publication: internal`, `runClass: exploratory`): per population the cases fixed, regressed, changed, unchanged and still failing, the per-family pass counts, and a row per differing case with its id, family, kind, tier and a measurement label
(for example `MISS` and `EXACT`, `clear` and `flagged`). It carries no span, no byte and no finding text. `fixed` and `worsened` use the definitions of `scripts/candidate-replay-report.ts` (a pass is every span EXACT, or a control that is not flagged; worse is a pass that now fails,
more leaked or collateral bytes, a control now flagged), so the two readings can be compared; this consumer re-scores nothing. The command refuses an output path under `public/`, `web/` or `out/`. Candidate data never enters the published modes: `qualification:matrix --mode published`
refuses an internal run, an unrecorded digest and a candidate build (`tests/matrix-artifact.test.mjs`, `tests/candidate-diff.test.mjs`).

**Real-data result (#657).** Candidate `core-main-422e43e3` (run 37543028377, no OpenRedaction) against the adoption's control copy at the current pins (`candidate.replay.replayCopy`, run 37546897867, archive `official-runs-37546897867`, evaluation evidence `1a3be8dd`): the command writes the diff (`worsened=false`; public evidence 7,036 cases, fixed 6, regressed 0, changed 1, still failing 149; regression 153 and policy 19, all unchanged). A separate Python recount of the same artifacts (pass = every span EXACT or a control not flagged) gives the same fixed, regressed, differing and still-failing counts per population, and `candidate-effect.json` of the same run says fixed 6, improved 1, regressed 0. Against the earlier control replay, which predates the acceptance repin and holds evaluation evidence `8213183b`, the same command refuses (`public-evidence-snapshot/methods: the configuration hash differs`): a wrong artifact fails. The control copy is recorded beside the replay, which stays as recorded; `controlFor` prefers the copy.

**Baseline re-key and ledger occurrence mapping.** A legacy baseline row is keyed by a legacy slug (`<category>--<fixture>`), a case of an artifact by its canonical, semantic `case_id`; the two never meet here. The artifact baseline needs no re-key because both sides are keyed by the same case ids.
Review decisions made against legacy review-queue ids reach canonical occurrences through the generated mapping `benchmarks/support/public-review-ledger-map.json` (`npm run qualification:ledger-rekey`, `benchmarks/qualification/ledger-rekey.ts`, #638); the candidate diff does not read or change the ledger, and a review occurrence a candidate adds is reported by
`candidate-effect.json` (methods section), not decided. The legacy `baselines/*.json` stay with the oracle until its exit condition.

**Legacy matrix consumers.** `eval:publish:matrix`, `eval:matrix:drift`, the dossier roadmap, `family-status` and the legacy site validate the support matrix with `supportMatrixProblem` (`src/support-model.ts`), which requires `sourceReport` (a legacy run id, scanner observation provenance, the legacy fixture-index identity). The view matrix has none of that and
inventing it would claim a measurement that was not made. Decision ([ADR](../decisions/2026-10-05-read-the-candidate-diff-and-baseline-from-artifacts-and-give-the-legacy-matrix-consumers-no-forged-provenance.md)): no compatibility envelope is written. The view matrix is its own artifact
(`redact-secret/support-matrix-from-view/v1`) read by new consumers, the legacy consumers keep reading the legacy file until the oracle's exit condition, and `tests/candidate-diff.test.mjs` fails if the legacy validator ever accepts a view matrix by accident. A compatibility field is added only when a verified consumer needs it.

**Publication (#657).** Under the `new` authority `publish-site.yml` does not measure the candidate (`eval:candidate`) or classify it (`eval:classify`, `eval:matrix`). On staging it runs `scripts/credential-publication.ts candidate`: the qualified candidate's core tarball sha256 and product commit are looked up in `benchmarks/product-candidates.json`; a registered, replayed candidate has its replay archive fetched (digest verified) and `qualification:candidate-diff --verify-tarballs` reads it, and any refusal fails the publish; an unregistered or never-replayed candidate is reported as not recorded and nothing is published about it; a digest registered at another commit is a conflict and fails. The result is the internal projection (counts only, under `results-output/`, never `public/`). The diff proves only that the candidate and its control differ in the product build, so the seam also requires the diff to be bound to the current pins (`candidateDiffFreshnessProblems`): the control is the pinned `redact-secret` release, every population of the control carries the semantic digest of the canonical official run, and the candidate is a build of that release or a later one. The candidates registered before the acceptance were replayed on alpha.15 against a beta.13 control, which that check refuses at the current pins (beta.14 on alpha.16); `core-main-f537059f` was replayed at them (control copy 37665271345, replay 37666522330, an empty diff) and is the one a staging publication reads. A candidate diff at the current pins needs a replay at the exact tarball digest (a maintainer dispatch of `official-runs.yml`, with the control copy at the same pins, [decision](../decisions/2026-10-07-record-a-control-copy-at-the-current-pins-for-the-candidate-diff.md)). Decision: [publish the site from validated artifacts](../decisions/2026-10-07-publish-the-site-from-validated-artifacts-under-the-new-authority-and-keep-the-legacy-steps-as-the-rollback.md).

## A new evidence snapshot: the 2x2

When credential-evidence releases a newer snapshot, the SAME registered product bytes are measured on it and the effects are separated (decision [record a newer evidence release](../decisions/2026-10-04-record-a-newer-evidence-release-as-an-evidence-candidate-and-separate-corpus-product-and-interaction-effects-in-a-2x2.md)).

| | accepted evidence | new evidence |
| --- | --- | --- |
| control: published build | A (`engineCandidate.replay`) | C (`evidenceCandidate.replay`) |
| candidate: unpublished build | B (`replay`) | D (`evidenceReplays[<tag>]`) |

Corpus effect is A to C (and B to D), product effect is A to B and C to D, interaction is the product effect compared on the cases both corpora measure. Cases added or changed by the new snapshot exist only on the new side: their product effect cannot be separated from the corpus and is reported as such. `scripts/compare-candidate-2x2.ts` writes `two-by-two.json/.md` (plain, methods assertions, review occurrences, peers, the product-owned populations) and is strict: zero unexplained, or it exits 1. Every case carries whether the release records it as maintainer-only (ADR 0020); none is independently reviewed.

```bash
# 1. Verify and record the release as the evidence candidate (engine and published product as the pins). Nothing is accepted.
node scripts/adopt-evidence-snapshot.mjs prepare --tag <snapshot tag> --manifest-digest sha256:<hex> \
  --engine-tag v0.1.0-alpha.5 --engine-revision <40 hex> --engine-run-schema <run-artifact schema> --engine-schema <corpus-snapshot schema> \
  --product-version 0.1.0-beta.13 --product-integrity sha512-... [--supersede]
# 2. The control (C): replay the published build on it with a transient replay branch (pins: engine, product, `adopt-evidence-snapshot.mjs repin`), archive it and record `evidenceCandidate.replay`.
# 3. The candidate (D), the same bytes as the registry says, then the 2x2, the data and the receipt:
node scripts/run-candidate-replay.mjs all --candidate core-main-1e45cecf --evidence-tag <snapshot tag> --manifest-digest sha256:<hex>
```

`dispatch`, `collect` and `propose` take the same two options. The workflow inputs are `candidate`, `evidence_tag` and `evidence_manifest_digest` (the scanner jobs refuse an unrecorded adoption, a different manifest digest or a different release identity); `reuse_candidate_run_id` rebuilds the report alone from an earlier run's artifacts. The candidate registry's `evidenceReplays[<tag>]` holds the receipt; `npm run product-candidates:check` requires its 2x2 beside its data.

## Product scope (#622)

`scanners/product-scope.json` holds the product's own out-of-scope statements, read at a named product revision and validated by `npm run peer-rules:check` (no judgement words, bounded, permalinked sources). The scanner page shows them for redact-secret and states the revision the registered-detector count was read at.
