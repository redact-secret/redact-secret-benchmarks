# The official public/synthetic PII measurement: frozen plan and provenance (#796)

Status: benchmark-side record; measures and records, asserts no product output. Plan file (derived, never typed): [`benchmarks/pii-eval-official-execution-plan.json`](../../benchmarks/pii-eval-official-execution-plan.json),
`node scripts/pii-official-plan.mjs --check` (`npm run pii:official-plan:check`). Public synthetic only: no EC2, custodian, private ledger, protected corpus or production key is needed or used.

## What the plan freezes

The exact pii-eval engine (commit `b1c097e4…`, Linux CI artifact and binary digest), protocol `pii-v1` revision 2 and artifact schema 1.4, the candidate (`0.1.0-beta.13`, source commit, artifact-set commitment), scanner adapter, configuration and activation digests,
each of the four complete populations (snapshot, manifest and roster digests; 146, 266, 477 and 299 memberships, 156 of them range-less), the benchmark policy (`qualification/pii-v1.json` digest, the scorer-basis decision and its status).

## Execution versus replay

| Evidence | What it is | Launched a scanner | Mode |
| --- | --- | --- | --- |
| The four committed artifacts (`benchmarks/pii-eval-population-dual-run/`) | `pii-eval replay` of the frozen Beta.13 observation, built by a local darwin build of the engine | no | exploratory |
| The linux replay receipt (`linux-replay.json`, `pii-population-replay.yml`) | the pinned linux CI engine replays the same observation to the same bytes | no | exploratory, canonical platform |
| The official run record (`benchmarks/pii-eval-official-run/`, run 37559349070 of `pii-official-run.yml`) | a fresh `pii-eval run --config` of the pinned scanner package, canonical linux-x64 | yes | official |

Only the official run record is an official measurement. A replay proves deterministic reproduction; it is never relabelled as an execution, an official run or an acceptance.

## The recorded execution

Run [37559349070](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37559349070) (`develop` `e97a9152`, first and only dispatch, success, about 30 s): the canonical engine binary on linux-x64 (Node v22.23.3), the product commit's qualified `0.1.0-beta.13` package, four populations of 146, 266, 477 and 299 memberships, every
run `official`, two agreeing scanner replays each, `pii-eval validate` of the public and run artifacts, the production consumer complete under the derived pins. The fresh metric cells equal the exploratory replay's (240 of 240; descriptive, in each receipt entry as `exploratoryParity`). The
record (`benchmarks/pii-eval-official-run/record.json`), the receipt, the four durable copies and the re-derived pins are written by `scripts/record-pii-official-run.mjs --run-id=<id> --write` and held by `pii:migration:check`
(`scripts/lib/pii-official-record.mjs`); [decision](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-07-record-the-first-official-public-synthetic-pii-run-and-repin-the-four-populations.md). It is evidence: no verdict is accepted from it and PII authority stays `legacy`.

## The candidate identity of a run (resolved with evidence)

The question was whether the scanner package tree digest an official `pii-eval run` pins (`package.treeSha256`, the candidate digest) equals the recorded artifact-set commitment `a26968fe…`. It does not, and cannot:

| | Construct | Value |
| --- | --- | --- |
| Recorded commitment | `sha256` of the canonical JSON `{core, node, wasm}` of three npm tarball digests (`piiArrivalCommitment`), of the frozen darwin-arm64 observation | `a26968fe74077d1b814c5069488b8a7537833a231d981da2b515c393af6212f5` (recomputed from the recorded components: equal) |
| Run identity | tree digest of the installed `@redact-secret/core` directory: `sha256` of the sorted listing `<file sha256>  <relative path>`, recomputed by the engine before a scanner starts | `36a59622…` for `0.1.0-beta.13` (derived from the qualified tarball; the run recomputes and records it) |

The inputs differ as well: the `core` tarball is the same everywhere (`8e281e29…` in the frozen observation, in the product's own CI qualification run 37093118224 for `401158d0…` and in a local repack), but the recorded `node` and `wasm` tarballs (`bd42ad8d…`, `f1991945…`) are a local build and
the product's qualified linux-x64 set is another (`node-linux-x64-gnu` `90ca2c60…`, so its commitment is `94c64a3c…`, not `a26968fe…`). The manifest binds the scanner identity, and the engine derives a candidate's identity from the package tree digest, so a fresh run needs a manifest
rebuilt for that digest: the snapshot, roster, cases, configuration and activation digests are byte-identical, the manifest digest and every artifact digest differ from the replays by construction. `scripts/run-pii-official.mjs` rebuilds it (`writeConversion(.., { candidateDigest })`),
records both numbers in its receipt (`candidate.equalsRecordedArtifactSetCommitment: false`) and refuses an artifact whose candidate digest is not the tree digest of the package it launched.

## The workflow

[`.github/workflows/pii-official-run.yml`](../../.github/workflows/pii-official-run.yml), dispatch only: its default `pinned-official` lane runs this plan at the dispatched commit (`pii-official-plan.mjs --check` equals the pins, `--github-output` names the exact commit, qualification run and core tarball). The separate `candidate-comparison` lane uses [its own exact paired plan](pii-candidate-comparison.md) and requires a fresh owner cost decision. The historical #796 waiver does not authorise that lane. The default lane

1. mints a read-only pii-eval installation token, downloads the pinned linux engine artifact (digest of the archive, of each member and of the binary against the pin) and fetches the Node shim at the pinned engine commit (its digest is compiled into the engine);
2. mints a read-only redact-secret token, requires the planned run to be a successful `artifact-qualification` push of the planned commit on `main`, downloads and verifies the qualified binaries, checks out the commit and repacks with the product's own script, requires every tarball to equal the bytes the product qualified and the core tarball to equal the recorded one;
3. installs the three tarballs with `--ignore-scripts` and no lockfile, and makes `@redact-secret` read-only;
4. runs `scripts/run-pii-official.mjs --require-canonical` with no token and no secret: four `pii-eval run --config` (`mode: official`, `host.resources: enforce`, `output.overwrite: refuse`, projection roster pinned), `pii-eval validate` of each public artifact (recomputed projection) and run artifact (accounting verifier),
   the strict official-mode contract (`artifactProblems`), then the production consumer under the committed pins with only the artifact, manifest and candidate digests changed and the mode official, so any other difference is a rejection;
5. uploads the receipt, the artifacts and the inputs that reproduce them (90 days). It records nothing in the repository: the recording (provenance, pins, durable copies, rollback rehearsal, exit states) is a separate reviewed change that reads the run.

Tokens: the two App tokens live only in the steps that download from those repositories; the steps that run product code (`npm ci`, `js:build`, the package install, the scanner) have none. Cost: the owner waived the CI-cost gate for exactly one dispatch (2026-10-06, #796). A failed run caused by an infrastructure or
workflow defect may be fixed and dispatched once more, and the record says so; there is no default re-dispatch.

## What stopped the dispatch (before this change) and what remains

1. The scorer-basis decision (#795): accepted by the owner on 2026-10-06 (scorer, denominator and label decision only). It is not an acceptance of any verdict of this run.
2. The candidate package identity: resolved above.
3. The workflow: added, reviewed (actionlint, zizmor, `tests/pii-official-run.test.mjs`).
4. CI cost: waived for one dispatch. The intended command is recorded in the plan (`dispatch.intendedCommand`).

The run is evidence. Which product, release or candidate verdict the owner accepts from it (`owner-accepted-verdict`, `new.authorisation`) is the owner's, and PII authority stays `legacy` (#666).

Once an official artifact exists it feeds the existing consumer (schema 1.4, `popPins.projection.mode: official`), the durable public copy is committed beside the Actions artifact (coordinated with #785; no new storage is invented), and the #666 rehearsal is regenerated against the same pins
(`npm run pii:authority:rehearse -- --write`). Local darwin runs are verification only and are never compared with a linux run.
