# Official credential-eval runs

Issue: [#604](https://github.com/redact-secret/redact-secret-benchmarks/issues/604), part of epic
[#602](https://github.com/redact-secret/redact-secret-benchmarks/issues/602).
Decision: [Run credential-eval officially once per population](../decisions/2026-10-01-run-credential-eval-per-population-and-adapt-run-artifacts.md).
Populations: [qualification-inputs.md](qualification-inputs.md). Consumer: [qualification-adapter.md](qualification-adapter.md).

This repository measures and records. An official run measures one population with credential-eval and records the
identity of everything it used; it asserts nothing about the product and emits no support status.

## What is pinned

`benchmarks/official-runs.json` (checked by `npm run official-runs:check`) pins:

| Pin | Value |
| --- | --- |
| Engine | credential-eval `v0.1.0-alpha.4`, commit `57858c9d1bdfad3d65e22d24b089b27189a0cf33`, protocol `credential-eval-protocol/1` |
| RunArtifact schema | `schemas/credential-eval-run-artifact-v1.json`, vendored from the engine tag, digest pinned |
| Configuration | `credential-public-v1` at the engine tag: `credential-public-v1.json` (linux-x64, canonical) and `credential-public-v1.darwin-arm64.json` (local reproduction) |
| Scanners | gitleaks 8.30.1, TruffleHog 3.97.4 (archive and executable digests per platform), `@redact-secret/core` 0.1.0-beta.12 (the published release), flare-redact 1.6.1, `@openredaction/core` 1.1.5 (npm integrity) |
| Methods run | `methodsRun` of the registry: the methods (`differential`, `metamorphic`, `mutation`), the differential reference (`redact-secret`), the seed convention (`case-id`) and the product evaluation evidence file `benchmarks/qualification/evaluation-evidence.json` with its digest (see "The methods run") |
| Public population | evidence release `snapshot-2026.10.01.2`, manifest digest, `records-tree-sha256:` revision and corpus digest |
| Product populations | `regression-<12 hex>` and `policy-<12 hex>`: the corpus digest, the release manifest digest and the tag, all content-addressed |

The configuration, executable pins and Node version are the engine's own; the run refuses a scanner whose version or
executable digest differs from its pin (exit 4, no artifact). Every scanner runs with the network disabled.

## One population, one run

| Population | Input | Owner | Run class |
| --- | --- | --- | --- |
| `public-evidence-snapshot` | credential-evidence release asset `credential-eval-corpus-snapshot.json`, verified against `release-manifest.json` | credential-evidence | `public` |
| `regression-corpus` | `npm run qualification:export -- --population regression-corpus` (categories of `corpora/regression/manifest.json`, and its `qualificationCategories`: the project twin-scope category, #641) | redact-secret | `public` (a candidate run would be `internal`) |
| `policy-corpus` | `npm run qualification:export -- --population policy-corpus` (category `policy-qualified-credentials`) | redact-secret | `public` (a candidate run would be `internal`) |

A product snapshot is the authored fixtures projected the way credential-eval's legacy exporter projected them, sorted by
case id, with `source` `redact-secret-benchmarks/regression|policy`, `evidence_schema`
`redact-secret-benchmarks/fixtures/v2` and `revision` `corpus-<corpus digest>`. Its release manifest lists the one entry
`credential-eval/corpus-snapshot.json` with the snapshot's SHA-256, which is what credential-eval's verifier checks.
`case-metadata.json` carries product policy facts (expected action, conformance flag, context axis) keyed by case id; it
is never part of the snapshot.

## The methods run

The stable gates for metamorphic robustness, unresolved mutation findings and unresolved differential disagreements are measured by
evaluation methods, which credential-eval runs over generated variants of the corpus cases. They are not part of the plain
measurement, and they cannot be: a run with methods replaces the corpus cases by the generated variants (`<case id>--<method>--<variant>`)
and publishes no per-group figures, so the floors (counts of the corpus cases) can only come from a plain run. The methods run is
therefore a second official run of the floors population, over the same evidence release and the same configuration, and it is a
second artifact, never merged with the plain one.

How it is configured is not up to this repository: credential-eval refuses a configuration file that names methods ("the
configuration names evaluation methods; select them with `--methods`"), so no pinned configuration can enable them. The selection is
on the command line, and every part of it enters the artifact's `config_hash`:

| Part | Pin (registry `methodsRun`) |
| --- | --- |
| methods | `differential`, `metamorphic`, `mutation`. `twin` and `benign` are not selected: the stable gates read none of them, twins are authored cases already measured by the plain run, and the `benign` method refuses a control without a reviewed taxonomy, which the public snapshot does not carry |
| differential reference | `redact-secret` (the product scanner; every other pinned scanner is a peer) |
| seed convention | `case-id`: operators derive seeded choices from the canonical case id. The legacy convention (`legacy-category`) names a case by its legacy category, which the public snapshot does not carry, so legacy and canonical runs generate different mutation variants |
| evaluation evidence | `benchmarks/qualification/evaluation-evidence.json`, derived from the product contracts by `npm run qualification:evidence` (family patterns, the segment layouts of the structural operator, the four named value validators, the benign taxonomy vocabulary, the family allowlist rule) and pinned by digest. `official-runs:check --bindings` refuses a stale file. `evaluationEvidence.measuredWith` lists the digests of earlier files a recorded canonical methods run was measured with: a contract change re-derives the file, the recorded run keeps the digest it read (its record is never rewritten) until a new methods run is made |

The scanners, pins and configuration file are the plain run's (`credential-public-v1` at the engine tag), so no change to
credential-eval and no new engine tag is needed. The scanner configuration hashes are equal between the two artifacts; the adapter
requires it. The driver (`--methods`) runs the engine twice, without `--require-complete`: with methods the engine also exits 3 for a
recorded operator generation error (six `authored.twin` transformations of mutation seeds fail to generate and produce no variant), which is a
fact about the generated variants, not a scanner that did not measure. Scanner completeness, the evidence binding, the methods run and the equal semantic
digests are checked on the artifact. The methods artifact is a few hundred MB; the CI step raises the Node heap and reads each artifact in turn.

The methods run is recorded in `runs[]` as `public-evidence-snapshot+methods@<platform>` with `kind: methods`, its `methods`, its
`evaluation` (reference, seed, evidence digest) and its own `config_hash`. A review occurrence of the methods run is keyed by a canonical id;
a legacy review decision applies only through the generated mapping `benchmarks/support/public-review-ledger-map.json` (qualification-adapter.md, "The review-ledger re-key").

## How a run is made

CI (canonical): dispatch `.github/workflows/official-runs.yml`. Per population, in a linux-x64 job: the registry gate
with `--bindings`; the engine built at the pinned tag with a GitHub App token scoped to `credential-eval` (contents
read); the peer scanners provisioned at their pinned digests (`scripts/provision-official-peers.mjs`); the npm scanners
installed without install scripts from the engine lockfile; then `scripts/run-official-credential-eval.ts`. The
artifact, its run record and the inputs are uploaded as a build artifact. A job after them derives the snapshot-bound product inputs from the pinned snapshot and the methods artifact and builds the qualification view from them (docs/specs/evidence-adoption.md, "Derived inputs and the view stage"); `reuse_run_id` retries that job alone from an earlier run's artifacts.

The public job runs the driver a second time with `--methods` (writing `<out>/methods/`); the view job lays the artifacts out as
`<dir>/<population>/artifact.json` and `<dir>/public-evidence-snapshot/methods/artifact.json`.

**Cost-first execution (#707).** Each job appends per-stage timings (`scripts/ci-stage.sh`, rendered by
`scripts/stage-timing-summary.mjs`) to its job summary, with the engine build cache status and the artifact name. The engine build is
cached by runner OS/arch, release profile, `Cargo.lock`, toolchain file and engine tag; a hit saves dependency compilation only, and the
driver still checks the engine commit, version and protocol. Every completed stage (plain, and for the floors population methods) is uploaded as its own artifact the moment it ends (#762): `stage-plain-<population>` and `stage-methods-<population>`, 14 days, never read by the view, beside the final `official-run-<population>` upload (90 days, unchanged). Each carries `stage-receipt.json` (`scripts/stage-receipts.mjs`): the stage, the population, the engine revision, protocol, evidence corpus digest and configuration hash it was measured with, the candidate, attribution and evidence release if any, the methods selection, and the sha256 of `artifact.json` and `run-record.json`. A slow or failing later step therefore cannot hide a finished stage, and a cancelled job (`always()` uploads) still leaves it. The earlier `early-plain-<population>` copy is replaced by `stage-plain-<population>`; the retry still reads the `early-plain-*` artifacts of runs made before.
**Incomplete runs (#762).** From the moment the engine output of a stage is finished until its checks pass (schema, evidence binding, determinism, methods selection), the driver keeps `stage-incomplete.json` beside the output. A failed or cancelled check leaves the output and the marker in the job's artifact and the job names it in its summary and as an error: the run is explicitly INCOMPLETE, never a success, and the stage is never reused (the marker is refused by the retry). A verified stage removes the marker. The checks after the engine are re-read of the artifact; re-running them on a kept incomplete output is not offered by this workflow, so the stage measures again on a retry.
**Retry receipts.** `retry_run_id` retries a failed, cancelled or incomplete official or attribution run: for each population, `scripts/retry-receipts.mjs` lists the earlier run's artifacts and downloads every one that can hold a stage, best first: `stage-<stage>-<population>`, `early-plain-<population>` (plain, earlier runs), then the job-end `official-run-<population>` (or `attribution-<id>-<population>`, `candidate-run-<population>`; its `methods/` directory holds the methods stage). A stage with no such artifact (absent or expired) is `fresh`, with the reason in the log. The driver (`--reuse-receipt`, a comma-separated list of directories) checks each offered directory whole and takes the first that holds: no INCOMPLETE marker; the stage receipt, when there is one, names this stage, population, engine revision and the digests of the bytes beside it; and `benchmarks/qualification/receipt-reuse.ts` finds the same population, platform, stage kind, engine revision, scanner set, candidate, attribution, evidence release and methods selection, a determinism check at least as strong as this run's, and the digest the run record names. The artifact is then bound to the current pins like a fresh one. A directory that differs in any of these is rejected with its reason in the log and never partly used; identities are never mixed. When none holds, the stage measures fresh and the run record says why (`receiptReuse`). A reused stage skips its engine runs, and the driver logs `receipt reused (<stage> stage of <population>, source <artifact>, ...)`, so a late failure no longer repeats a finished stage. This is neither the view-only `reuse_run_id` nor the observation reuse of the candidate replay; it is exclusive with both and with diagnostic mode, and a retry that reuses a receipt is still a run of this
commit's pins, never a splice of artifacts. **Stage rehearsal (#762).** `populations` (`regression-corpus`, `policy-corpus`, never the public population) with `rehearse_post_step_failure` runs the stage-receipt path on the cheap populations: the plain stage is measured, verified and uploaded, then the job fails on purpose; `retry_run_id` of that run with `populations` must reuse the stage and log the receipt. A rehearsal is not an official run (no qualification view is built; it is exclusive with diagnostic, attribution, candidate and the reuse inputs). Peer and methods sharding into separate jobs is not done: each fresh runner repeats provisioning and build
overhead, so they wait for a measured runner-minute and critical-path comparison from these summaries (#709 owns the accuracy/performance
split).

**Optional scanners and the default scanner selection (#763, #812).** `benchmarks/support/scanner-roster.json` says which scanners the official run class must measure (`flare-redact`, `gitleaks`, `redact-secret`, `trufflehog`) and which it may leave out (the OpenRedaction default profile, `openredaction`). One policy, `benchmarks/qualification/scanner-selection.ts`, turns that into what a run executes, for the workflow dispatch, the direct driver, the execution plan, the replay scripts and provisioning. **With no input a Full run measures the four required scanners** under the engine's released without-OpenRedaction configuration (credential-eval `configs/official/credential-public-v1.without-openredaction*.json`); OpenRedaction scan invocations: zero. **OpenRedaction is a positive opt-in**: workflow input `include_openredaction` (default `false`), driver `--include-optional openredaction`, `run-candidate-replay.mjs --include-openredaction`, `run-evidence-replay.mjs --include-openredaction`, `plan-execution.ts --include-openredaction`. It selects the engine's full configuration, which stays available for explicit historical or manual reproduction. The opt-in is visible in the plan and its dispatch command, the run name, the job summary and the run record (`scannerSelection`: configuration file and hash, scanners, `includedOptionalScanners`); the registry check binds a recorded selection to the scanners the run measured. `omit_optional` / `--omit-optional` is **deprecated** and stays backwards compatible: omitting is the default, so naming it changes nothing and prints a notice (it contradicts `include_openredaction`).

*Availability is read from the pinned engine.* The driver asks the pinned engine's checkout whether the without-OpenRedaction configuration exists, not a claim about a release. A pinned engine without it is refused plainly: the default never falls back to the full configuration, because that would run the expensive scanner by accident (the pin moves only by the owner's repin; the full configuration stays reachable only by the opt-in). The roster's `engineRelease` (v0.1.0-alpha.13, the first release that ships the configurations) is informational.

*Retries, receipts and artifacts never change the selection.* A retry receipt is reused only when its scanner set, its configuration file and its opted-in optional scanners equal this run's (a five-scanner receipt is never reused by a default run, nor the reverse); the driver also refuses an artifact whose scanner set differs from the selection. `include_openredaction` is refused with diagnostic mode, the view-only reuse inputs and stage rehearsals. An attribution run uses the engine's attribution configuration; the engine ships no without-OpenRedaction variant of it, so the default attribution run needs `attributionRuns[<id>].withoutConfigs` in the registry and is otherwise refused with that instruction (the full-roster attribution run is the opt-in). A candidate replay is compared with its control's scanner roster ([product-candidate-replay.md](product-candidate-replay.md#the-scanner-roster-must-match-the-control)).

*Dry run.* `node --import tsx scripts/run-official-credential-eval.ts --population <id> --engine-dir <engine checkout> --platform linux-x64 --dry-run [--include-optional openredaction] [--out <dir>]` prints the effective selection (scanners, configuration, `openredaction scan invocations: 0` unless opted in) and starts nothing: no engine build, no scanner, no output unless `--out` is given. Every real run writes the same statement as `scanner-selection.{json,md}` next to its run record, and the job summary shows it.

The credential profile `openredaction-credential-bearing` (#764) is in no official configuration, so neither `--omit-optional` nor `--include-optional` accepts it (nothing to leave out or include). Its official-class measurement is one profile-only run of one population, pending the owner's approval ([decision](../decisions/2026-10-06-choose-the-openredaction-credential-bearing-profile-as-the-comparison-scanner.md#the-pending-official-measurement)); until then it is not measured in an official run. Decisions: [optional, manual measurement](../decisions/2026-10-06-make-the-openredaction-default-profile-an-optional-manual-measurement.md), [default four-scanner selection](../decisions/2026-10-07-run-the-four-required-scanners-by-default-and-make-openredaction-a-positive-opt-in.md). The view states what was not measured ([qualification-adapter.md](qualification-adapter.md#the-scanner-roster)).

Locally (verification): build the engine at the pinned tag, put pinned `trufflehog` and `gitleaks` first on `PATH`
(`node scripts/provision-official-peers.mjs --platform darwin-arm64 --out <dir>`), then run the driver. TruffleHog
self-updates and a patch bump re-keys the ledger, so `trufflehog --version` must print `3.97.4` in the exact shell that
runs it; the driver refuses otherwise. A local run is recorded with `npm run official-runs:record -- <run-record.json>`
and is marked non-canonical.

## What the driver enforces

- The engine checkout is at the pinned commit and prints the pinned version and protocol.
- The scanner selection is resolved first (#812): the required scanners by default, an optional one only on the explicit opt-in, the configuration file read from the pinned engine's checkout. An artifact whose scanner set differs from the selection is refused.
- The configuration's pins equal the registry's; each binary on `PATH` is the pinned version.
- The population's evidence equals its pin: the release manifest digest (public), or the rebuilt corpus digest, tag and
  manifest digest (product).
- The engine runs at least twice with `--run-class official --require-complete`. Any exit but 0 is a failed job and no
  artifact is accepted.
- Every artifact validates against the vendored schema, binds to the population (`manifest.evidence` equals the pin,
  `run_class` official, every scanner complete) and has the same semantic digest as the others. The semantic digest is
  recomputed independently (canonical JSON with `non_semantic` cleared, floats kept as written) and equals the
  engine's.

## What is recorded

`historicalRuns[]` (#690) holds the runs of an earlier pin, kept as receipts after a repin (`status: historical`, `supersededBy`); `runs[]` must match the current pins and the authority reads it only. See [evidence-adoption.md](evidence-adoption.md).

`runs[]` in the registry carries, per population and platform: the benchmark revision the run was made at, the engine
identity (name, version, commit, protocol), run class and publication, `config_hash`, the full `manifest.evidence`
identity, the artifact's semantic digest and byte digest, the schema digest, the determinism result, each scanner's
version, build, mode, adapter, configuration hash and executable digest or package integrity, and the case count.
The byte digest includes timestamps and differs per run; the semantic digest is the identity of the measurement.
Since #812 the entry also carries `omittedOptionalScanners` (the optional scanners the run left out) and `scannerSelection` (policy, configuration file and hash, scanners, `includedOptionalScanners`), so a result that includes OpenRedaction names its opt-in and configuration, and `official-runs:check` binds both to the scanners the run measured.

Artifacts are not committed (the public one is 28 MB). The canonical artifact is the CI build artifact, retained 90 days
with its run record; its digests are the committed record. Candidate and internal artifacts are never published outside
product qualification.

## Where the publish build gets the artifacts

The CI build artifacts expire after 90 days (those of run 36964984990 on 2026-12-30), and `publish-site.yml` builds the qualification view the
published Next pages read (decision: [serve the Next export at the site root](../decisions/2026-10-02-serve-the-next-export-at-the-site-root.md; the view and archive decisions are in the superseded [/next/ record](../decisions/2026-10-02-publish-the-next-export-under-next-with-the-qualification-view-built-from-archived-official-runs.md))).
So the canonical linux-x64 artifacts are also kept as one release asset of this repository, named by `benchmarks/official-run-archive.json`
(tag `official-runs-<ci run id>`, `official-run-artifacts.tar.gz`: `<population>/artifact.json` and `public-evidence-snapshot/methods/artifact.json`).

- Keep a run (a maintainer, once per recorded run, after the registry records it): `node scripts/official-run-archive.mjs pack --run <ci run id> --out <dir>`
  downloads that run's build artifacts, refuses them unless every file hashes to the `byteDigest` the registry records, writes the tarball and prints the
  `gh release create` command. Then set `release.tag` and `source.ciRun` in `benchmarks/official-run-archive.json` in the same PR as the registry entry.
- Use it: `node scripts/official-run-archive.mjs fetch --out <dir>` (the publish workflow's first step) and `verify --dir <dir>`. Each member is capped at 1 GiB (the alpha.3 methods artifact is 769 MB; it is hashed from a stream and read by `readRunArtifact` from its bytes). The registry is the authority: exact members, exact
  digests, fail closed. The product populations' `case-metadata.json` is not archived; `npm run qualification:export` writes it from the checkout, byte-identical to the CI run's input.
- The view built from them (`npm run qualification:view`) is byte-identical to the view the CI run built.

## The diagnostic lane

Issue [#705](https://github.com/redact-secret/redact-secret-benchmarks/issues/705), under #704. Decision: [run a product-only exploratory diagnostic lane beside the full official run](../decisions/2026-10-04-run-a-product-only-exploratory-diagnostic-lane-beside-the-full-official-run.md).

The lane is the fast, product-only check. The full comparative measurement of an unreleased build (all scanners, methods, a control, an effect report, the 2x2 on a new snapshot) is the candidate replay (`candidate` input, [product candidate replay](product-candidate-replay.md), #698); a dispatch takes one or the other.

`official-runs.yml` has two modes, chosen by the `mode` input (default `full`).

| | `full` (default) | `diagnostic` |
| --- | --- | --- |
| Purpose | official qualification | fast feedback on a product candidate |
| Populations | public, regression, policy | regression and policy; public only with `include_public` |
| Scanners | every pinned scanner | the product only (driver `--scanners`, the product is always included) |
| Engine run | `official`, at least two runs, equal semantic digests | `exploratory`, one run by default |
| Methods | the floors population's methods run | none; reported as unavailable |
| Peers and differential | measured | not run; stated as unavailable, never inferred |
| Class of the artifact | `official` / `public` or `internal` | `exploratory` / `internal`, promotion disallowed |
| Artifact name | `official-run-<population>` | `diagnostic-<population>` |
| Qualification view | built | skipped |

The driver is `scripts/run-official-credential-eval.ts --mode diagnostic`. The engine configuration is the pinned one restricted to the selected scanners (`diagnostic-config.json` in the output directory); each selected scanner keeps the engine's own pin, and the engine verifies the evidence release as it does for an official run. The driver additionally refuses unless the engine commit, version and protocol, the population's evidence and the product build (version and package integrity) are the registry's pins, so a wrong candidate tarball, engine or evidence fails. The candidate is selected the way the replay selects it: by the pins of the branch the workflow runs on (evidence-adoption.md, "Engine candidate on identical evidence").

Each population job writes, next to `artifact.json`, `diagnostic-record.json`, `diagnostic-summary.json` and `diagnostic-summary.md` (also appended to the job summary) and uploads them as soon as the population finishes, so regression and policy findings never wait for the public population or any peer. The summary states the scanners that ran and did not, the methods and peer comparison as unavailable with the reason, and outcome counts of the product scanner with the ids of the cases to look at (fixture ids, never values).

A diagnostic artifact cannot reach an official path: `bindingProblems` accepts official artifacts only; the view job reads `official-run-*` only and does not run in diagnostic mode; `official-runs:record` refuses a diagnostic record; the archive holds only the registry's recorded digests. Dispatch with `attribution` or `reuse_run_id` is refused in diagnostic mode. A diagnostic number is never compared with an official one: its `config_hash` differs by construction.

## Not covered here

- Methods runs of the regression and policy populations: the adapter reads methods from the floors population only (the legacy
  path pooled them; the population policy does not), so none is made.
- Candidate-regression inputs: they need a named candidate build; there is none, so there is no artifact yet.
- The protected holdout: it stays outside credential-eval (a specialized runner and an aggregate receipt).
- The canonical linux-x64 run is recorded: CI run 36933982377 of `official-runs.yml` ran all three populations with every
  scanner complete, equal semantic digests across its two engine runs, and the linux executable digests (from the upstream
  release checksum files) verified at run time. Its `config_hash` and artifact digests are the `*@linux-x64` entries of
  `runs[]`. CI run 36948851341 (#636) ran the same three plain runs again, with the same semantic digests and `config_hash`
  (the measurement is reproducible across runs), and the methods run, recorded as `public-evidence-snapshot+methods@linux-x64`:
  every scanner complete, equal semantic digests across its two engine runs, 32,297 generated variants per scanner, 10,739
  differential review occurrences (settled by a legacy decision only through the re-key mapping), and 46 failed assertions of
  `redact-secret` (35 metamorphic, 11 mutation), none attributed to a product detector family (untargeted fixtures and the `exa:api-key` policy fixtures). The darwin-arm64 entries remain local verification runs and are never compared with a linux run; the qualification
  view and the #607 comparison read the canonical artifacts.

**Accuracy reuse (#706).** A diagnostic run may reuse a verified accuracy observation set for unchanged peers; see [accuracy-reuse.md](accuracy-reuse.md). An official run never reuses.
