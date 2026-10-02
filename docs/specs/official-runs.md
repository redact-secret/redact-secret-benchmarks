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
| Engine | credential-eval `v0.1.0-alpha.1`, commit `379e677b8e92db93105d26eb1b7f8c84df6ee5fc`, protocol `credential-eval-protocol/1` |
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
| evaluation evidence | `benchmarks/qualification/evaluation-evidence.json`, derived from the product contracts by `npm run qualification:evidence` (family patterns, the segment layouts of the structural operator, the four named value validators, the benign taxonomy vocabulary, the family allowlist rule) and pinned by digest. `official-runs:check --bindings` refuses a stale file |

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
artifact, its run record and the inputs are uploaded as a build artifact. A job after them builds the qualification view.

The public job runs the driver a second time with `--methods` (writing `<out>/methods/`); the view job lays the artifacts out as
`<dir>/<population>/artifact.json` and `<dir>/public-evidence-snapshot/methods/artifact.json`.

Locally (verification): build the engine at the pinned tag, put pinned `trufflehog` and `gitleaks` first on `PATH`
(`node scripts/provision-official-peers.mjs --platform darwin-arm64 --out <dir>`), then run the driver. TruffleHog
self-updates and a patch bump re-keys the ledger, so `trufflehog --version` must print `3.97.4` in the exact shell that
runs it; the driver refuses otherwise. A local run is recorded with `npm run official-runs:record -- <run-record.json>`
and is marked non-canonical.

## What the driver enforces

- The engine checkout is at the pinned commit and prints the pinned version and protocol.
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

`runs[]` in the registry carries, per population and platform: the benchmark revision the run was made at, the engine
identity (name, version, commit, protocol), run class and publication, `config_hash`, the full `manifest.evidence`
identity, the artifact's semantic digest and byte digest, the schema digest, the determinism result, each scanner's
version, build, mode, adapter, configuration hash and executable digest or package integrity, and the case count.
The byte digest includes timestamps and differs per run; the semantic digest is the identity of the measurement.

Artifacts are not committed (the public one is 28 MB). The canonical artifact is the CI build artifact, retained 90 days
with its run record; its digests are the committed record. Candidate and internal artifacts are never published outside
product qualification.

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
