# PII evaluator ownership and integration contract

Status: benchmark-side acceptance for #661–#665. This document records measurement; it does not switch PII authority or assert product output.

## Ownership

| Owner | Owns | Does not own here |
| --- | --- | --- |
| `pii-eval` | Scanner-neutral cases, variants, findings, observations, two outcome axes, seven methods, ten `pii-v1` metrics, accounting, replay and versioned artifacts | Product populations, thresholds, support status, release decisions or protected authorization |
| benchmarks | Product populations and immutable pins, activation acceptance, candidate/release binding, thresholds, support decisions, publication and UI | A second generic PII engine or protected corpus access |
| private-custodian | Protected authorization, budgets, isolation, execution, signing, disclosure, freshness and revocation | Product thresholds or support verdicts |
| private-ledger | Private policy/audit export and validation at its reviewed custodian compatibility pin | A benchmark CI data source or public review ledger |

The file-level upstream inventory is accepted from `pii-eval` commit `6157cbc5918b3888c8e84b1884719ea8f3278b36`, `docs/migration/ownership-map.md`. Generic code stays in the legacy tree as the compatibility oracle until #666; it is not copied into a new benchmark engine. Product policy remains in `qualification/pii-v1.json`, `benchmarks/evaluation/domains/pii/{profile,qualification,support,support-v2,product-binding,protected-support-binding}.ts`, the product population plans, publication scripts and UI.

## Frozen identities

The machine-checked record is [`benchmarks/pii-eval-migration.json`](../../benchmarks/pii-eval-migration.json). It pins:

- oracle `4b846967346505baca11e0b98cab1475fbce6773` and `pii-eval` source `6157cbc5918b3888c8e84b1884719ea8f3278b36` (schema 1.1, upstream parity) and `212d500de90ce97461275be1e8b9dd8acd663fb3` (schema 1.2, population dual run);
- schema `pii-eval.public-synthetic-artifact` 1.1 (accepted for the committed synthetic artifacts) and 1.2 (the product projection; the four benchmark populations); canonical `pii-v1` revision 2 and compatibility revision 1;
- all seven method versions and ten metrics through the upstream handoff, with mechanics `minDenominator=4`, `replays=2`, `z=1.96`, precision 6;
- `redact-secret-core-node` adapter 1.0.0, normalization 1, scanner package 0.1.0-beta.12, fixed parameters and activation selectors `pii:global`, `pii:us` with their digests;
- current custodian and ledger source revisions reviewed for this integration.

The benchmark population source is the six-family `b11-population-v2` plan set. `oracle-plan`, `qualification-plan`, `diagnostic-balanced` and `benign-heavy-stress` remain distinct. Their six plan files, exact candidate report and observation are content-pinned; `npm run pii:migration:check` refuses drift.

## Acceptance and remaining work

The upstream compatibility run is accepted as scanner-neutral evidence: 37 cases, 54 variants, 540 outcomes, 181 metric comparisons and 660 statistics vectors have zero compatibility differences and zero unexplained canonical differences. Canonical differences remain classified as intentional revision, legacy bug or compatibility representation; thresholds, cases and denominators were not changed.

That run is not benchmark population acceptance. The benchmark record separately freezes 146 oracle-plan, 266 qualification-plan, 477 diagnostic-balanced and 299 benign-heavy-stress cases from the Beta.13 candidate report. `pii-eval` schema 1.2 (commit `212d500de90ce97461275be1e8b9dd8acd663fb3`, ADR 0016) carries the view, family, language and control-class projections and the run mode, so the four populations are now run through both engines (#664): [`docs/reports/2026-10-05-pii-eval-population-dual-run.md`](../reports/2026-10-05-pii-eval-population-dual-run.md), recorded in `benchmarks/pii-eval-population-dual-run/` and pinned in `benchmarks/pii-eval-migration.json` (`benchmarkPopulationDualRun`). Result: zero unexplained differences over 1,032 carried case memberships, each population its own corpus snapshot and sealed schema 1.2 artifact, three byte-identical replays each, wrong bindings refused. The only classified differences are the two compatibility representations (`0007/D1`, `0007/D4`).

The acceptance is `accepted-representable-cases`, not `accepted`: 156 of 1,188 case memberships have an authored identity of `not-established`, which neither the oracle nor `pii-eval` can state (both contracts are closed over valid and invalid). They are counted and listed in the record, never given an invented identity, and stay scored by the benchmark's own scorer; retiring the legacy scorer (#666) needs either an engine contract that can state them or an explicit decision to drop them. The run is `exploratory` on a local verification build, never an official run, and no threshold, tolerance, case or denominator changed. Reproduce with `node --import tsx scripts/run-pii-population-dual-run.mjs --pii-eval=<checkout> --check`.

Protected evidence is never read from private-ledger. The benchmark consumer accepts only bounded canonical custodian envelopes with signed v2 destination binding and a valid current feed. A signature establishes origin and integrity, not independent ground truth; the projection's configuration is not signed because the projection contract does not contain it.

`benchmarks/evaluation/domains/pii/custodian-consumer.mjs` implements that consumer at private-custodian `23f75304d4cf53fc8604379255bbf058f642daeb`. It strictly parses the bridge request/manifest, v2 projection and revocation envelopes; reproduces `custodian-canonical-json/1`; verifies Ed25519 with out-of-band key domain, purpose, validity and revocation pins; requires the signed destination; and checks exact domain, candidate, population, disclosure policy and feed identities. Feed sequence, replay, fork, previous-link, freshness, revocation, supersession and projection expiry are stateful, and every feed update re-evaluates accepted projections.

The request/response, v2 projection and revocation schema SHA-256 pins and both upstream golden-vector hashes are recorded in `benchmarks/pii-eval-migration.json`. The synthetic bundle itself is pinned there as `d2dea176a0d785c8cdefa7403d72baa408410d853989fc03f46c4351642db508`.

The committed bundle is public synthetic data signed by disposable test keys. Its support-matrix projection is always marked `syntheticConformance=true`, `supportClaims=false` and `qualification=not-live-support-evidence`; binding it cannot change any family status. The request's configuration digest is recorded as `bridge-request-only-not-signed-projection`, never described as a signed projection field. A real protected consumer remains blocked on a custodian catalog/transport, production v2 signing-key authorization and cross-repository artifact access; no protected run, private-ledger read or production key is part of this integration.

Re-checked 2026-10-05 (#665): `private-custodian` `main` (`61f2a43e`) is 15 commits past the reviewed pin `23f75304d4cf53fc8604379255bbf058f642daeb`; none touches `custodian-contracts`, `custodian-bridge`, their schemas or golden vectors (the commits are worker/MicroVM isolation, deployment and ADRs), so every schema and golden digest in the migration record still matches. The custodian repository publishes no catalog, benchmark-facing transport or production v2 signing-key authorization yet, so there is no live protected artifact to consume and none was faked; the synthetic conformance path is unchanged.

## Public artifact consumer

`benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs` is benchmark-owned and imports no evaluator implementation. It validates the exact upstream JSON Schema of the artifact's version (1.1 or 1.2, the committed copies in `schemas/pii-eval-public-synthetic-artifact-v1.{1,2}.json`, digests pinned in the migration record), strict JSON structure and bounds, the upstream semantic-digest construction, engine/build provenance, candidate-versus-release identity, scanner/configuration/activation/population/manifest pins, completeness, supersession and all ten metrics. Populations and their denominators remain separate.

**Schema 1.2 product projection (#665).** A pin under schema 1.2 names, per population, its `projection` (`requiredViews`, `mode`, `rosterDigest`). The consumer then refuses: a duplicate (scanner, view, family) row (`projection-row-duplicate`); an absent required view (`projection-view-missing`); a pooled denominator, that is a row, stratum, metric or sum of rows counting more than its population (`projection-pooled-denominator`, or `projection-counts-mismatch` for less); an unknown view or mode, mixed modes or a mode other than the pinned one (`projection-view-unknown`, `projection-mode-unknown`, `projection-mode-mismatch`); a row whose scanner, configuration, activation, product (released or candidate) or population binding differs from its artifact (`projection-binding-mismatch`); another roster (`projection-roster-mismatch`); and a pinned projection that is absent (`projection-missing`). A 1.2 artifact is never read under a 1.1 pin and a 1.1 artifact never under a 1.2 pin. The consumer holds no view policy and derives no verdict.

The accepted report is bound to `pii-support-matrix-v2` by `scripts/publish-pii-support.ts` (`--pii-eval-pins` and `--pii-eval-artifact`, each repeatable): each artifact is judged only by the pin set that names its population, every pin set must be satisfied, and all must name one engine build. The matrix stores the validated block as `piiEvalMeasurement.populations[].productProjection` (family and view rows with the ten metrics, language and control-class strata, the run mode and each row's binding); a 1.1 population keeps its explicit `unavailable` fields and a 1.2 population has none. `schemas/pii-support-matrix-v2.json` and `validatePiiSupportMatrixV2` re-apply the same rules when the site reads the matrix back, so an edited matrix cannot show a projection the consumer would have refused. Each population also carries `productBinding`: a candidate is said to measure the publication's product only when its pin names exactly that source commit; otherwise it is another product, and a publication that measured no product claims none. A candidate is never described as a release. None of this changes a family verdict, threshold or authority file: the support matrix families and distribution are byte-equal with and without the measurement (a test asserts it), and `web/services/domains.ts` shows the projection as separate, labelled, unpooled rows with no qualification verdict.

The four benchmark populations (#664) are bound by `benchmarks/pii-eval-population-pins.json` and the committed artifacts in `benchmarks/pii-eval-population-dual-run/`; staging passes them next to the transport-verified CI measurement, production binds no pii-eval evidence.

The pinned local build at `pii-eval` `6157cbc5918b3888c8e84b1884719ea8f3278b36` produced:

- Cargo.lock SHA-256 `e646a917c7dc8a5d5f5744bbfc56456661ebeb5505ac18788b7d5262f29a956a`;
- source archive SHA-256 `e86756f8a556af326c712f1abdaca3624fdae2f59dd924a497791892c2b0b6e1`;
- macOS local verification binary SHA-256 `532b51347ae8696d444d7cf35b11ce00f975444a29f8ebc22a59f78c120bce26`.

That binary hash identifies this reproducible local verification only; it is not a canonical Linux Actions artifact. CI validates committed synthetic artifacts and policy, but does not execute a measurement run. The four population artifacts were produced by a local darwin build of `212d500` (see the dual-run report); their pins name the canonical linux engine artifact `11358475612` (binary `b2902d58e8fba5199fedca235c2b81264cd44c8ae9db4c33f07379722297e9af`) of the same commit, and the semantic digest is host independent by contract, but a replay with the linux binary is recorded below.

## Linux replay of the four populations (#665)

The committed population artifacts were built by a local darwin engine. `.github/workflows/pii-population-replay.yml` (dispatch only) mints the
same read-only App token as the staging transport, downloads and verifies only the pinned linux engine artifact (`fetch-engine` of
`scripts/fetch-pii-eval-public-synthetic.mjs`: run, artifact, archive, member and build-info digests), and in a later step that holds no token runs
`scripts/replay-pii-populations.mjs`. That script regenerates the four conversions, replays each frozen observation twice and compares the replayed
semantic digest and bytes with the committed artifact, the consumer pin and the migration record. It launches no scanner, writes no committed file and
changes no status, threshold or authority; a difference exits 1 and is named, never normalised. A run on another binary or platform is a verification
(`canonical: false` in the receipt). Locally: `npm run pii:population:replay -- --engine=<pii-eval binary>`.

Result (run `37350920750` on develop `91ac467f`, linux-x64, the pinned binary `b2902d58…`): the semantic digests of all four populations equal the committed artifacts, the consumer pins and the migration record, the two replays are byte-identical and the replayed bytes equal the committed files. The darwin-built artifacts are verified by the canonical engine; the runs stay
`exploratory` and the 156 not-representable memberships remain. The receipt is `benchmarks/pii-eval-population-dual-run/linux-replay.json`, bound in the migration record and checked by `pii:migration:check`; decision [`2026-10-05-accept-the-linux-engine-replay-of-the-four-pii-populations-as-verification`](../decisions/2026-10-05-accept-the-linux-engine-replay-of-the-four-pii-populations-as-verification.md).
The protected path was re-checked the same day and is still absent (`protectedPath` in the migration record): no custodian catalog or transport, no production v2 signing key, and `pii-eval` does not emit `worker-result/1`.

PII authority, its measured exit, the rollback rehearsal and the legacy caller inventory are in [`pii-authority.md`](pii-authority.md).

## Commands

```sh
npm run pii:migration:check
npm run pii:artifact:check
npm run pii:custodian:check
npm test -- --test-name-pattern='PII migration'

# At the pinned pii-eval checkout, scanner-free parity evidence:
cargo test -p pii-eval-cli --locked --test oracle_parity --test oracle_parity_cli --test oracle_parity_docs --test real_scanner

# A local immutable engine build when cross-repository artifact access is unavailable:
cargo build --release --locked
shasum -a 256 Cargo.lock target/release/pii-eval
git archive --format=tar 6157cbc5918b3888c8e84b1884719ea8f3278b36 | shasum -a 256

# Bind already-produced, pinned public artifacts to a candidate publication.
npm run eval:publish:pii-support -- \
  --pii-eval-pins=tests/fixtures/pii-eval/pins.json \
  --pii-eval-artifact=tests/fixtures/pii-eval/population-a-v2.public-synthetic-artifact.json \
  --pii-eval-artifact=tests/fixtures/pii-eval/population-b-v1.public-synthetic-artifact.json \
  --population-mode=not-measured
```

Cross-repository Actions artifacts require an explicit token or GitHub App installation with `actions:read` on the private `pii-eval` repository; another repository's `GITHUB_TOKEN` is insufficient. No credential or access setting is created by this integration.

## Staging public-synthetic artifact delivery

`pii-public-synthetic.yml` is a reusable and explicitly dispatchable workflow. App `5178533` uses the existing
`PII_EVAL_APP_PRIVATE_KEY` secret to mint an installation token scoped to `redact-secret/pii-eval`, Actions and contents
read only. Its isolated job has no publisher OIDC permission, no protected inputs and no scanner execution. It verifies
the pinned engine binary but does not execute it. Only the public projection and sanitized transport receipt are uploaded
to the calling run. `publish-site.yml` calls it on staging and passes the downloaded projection through the existing
benchmark-owned semantic consumer and atomic publisher. Production skips the job and receives no PII App secret.

The exact transport pins are `benchmarks/pii-eval-public-synthetic-source.json`; semantic bindings are
`benchmarks/pii-eval-public-synthetic-pins.json`. They bind successful push run `37340150108`, attempt 1, engine commit
`212d500de90ce97461275be1e8b9dd8acd663fb3`, engine artifact `11358475612`, projection measurement artifact `11357099796`, upload
archive digests, exact member rosters and byte digests, and the build-info and Cargo.lock provenance (the build-info expectations are the
source document's `buildInfo` block). A replacement, rerun, fork, expired artifact or absent population fails closed. No latest-run
fallback exists. The measurement artifact expires at `2026-10-19T16:22:45Z` and the engine artifact at `2026-11-04T16:22:30Z`.

The repin from run `37129550754` (commit `6157cbc5918b3888c8e84b1884719ea8f3278b36`, artifact `11276237723`, expiring 2026-10-17)
was reviewed, not automatic: the new pins were derived from the successful `main` run of the schema 1.2 commit, every archive and member digest was recomputed from a
read-only download, and `fetch` was run end to end against the live artifacts with a read-only token before the pins were committed. The
retired 1.1 artifact digest is recorded in `retiredArtifactDigests`. Because an Actions artifact outlives its run by only 14 days, the
sanitized public projection of the pinned run is also committed byte for byte at
`tests/fixtures/pii-eval/ci-37551091456-projection.public-synthetic-artifact.json` (public synthetic aggregates, no case text); `pii:artifact-source:check` verifies
that its digest is the pinned member digest and that the semantic consumer accepts it, so the pin can always be re-verified offline. The copy is
verification evidence and a test fixture; it is never a substitute for the verified transport, and no publication step reads it instead of the Actions artifact.

This run measures upstream `synthetic-demo-population` (3 authored cases, 6 variants, views `oracle-plan` and `qualification-plan`,
mode `exploratory`), candidate scanner beta.12, and now carries its schema 1.2 projection. It is separate from the staging site's product candidate and
from the four benchmark-owned populations in #664. It provides transport and consumer evidence only: family policy, support verdicts, thresholds, credential
outputs and PII authority remain unchanged. The UI retains public measurement when protected binding fails, hides all unvalidated protected
family/count/status facts, and presents each scanner/population's exact effective N, projection rows and withheld states separately.

```sh
npm run pii:artifact-source:check
# Read-only token required; do not put it in an engine/scanner environment.
GH_TOKEN=<installation-token> node scripts/fetch-pii-eval-public-synthetic.mjs fetch --out=/tmp/pii-public
npm run eval:publish:pii-support -- \
  --pii-eval-pins=benchmarks/pii-eval-public-synthetic-pins.json \
  --pii-eval-pins=benchmarks/pii-eval-population-pins.json \
  --pii-eval-artifact=/tmp/pii-public/public-synthetic-artifact.json \
  --pii-eval-artifact=benchmarks/pii-eval-population-dual-run/oracle-plan.public-synthetic-artifact.json \
  --pii-eval-artifact=benchmarks/pii-eval-population-dual-run/qualification-plan.public-synthetic-artifact.json \
  --pii-eval-artifact=benchmarks/pii-eval-population-dual-run/diagnostic-balanced.public-synthetic-artifact.json \
  --pii-eval-artifact=benchmarks/pii-eval-population-dual-run/benign-heavy-stress.public-synthetic-artifact.json \
  --population-mode=not-measured
```

Local verification at the exact pins successfully downloaded and verified both archives through existing read-only
GitHub authentication. The hosted workflow separately proves App installation access. If that token cannot access
pii-eval, the prerequisite is an existing App installation on that repository with Actions/contents read and the secret
available to benchmarks; this implementation neither creates credentials nor changes installation settings.
The publish-site mirror in `redact-secret/redact-secret-sites/docs/upstream/redact-secret-benchmarks--publish-site.yml`
must be synchronized by its owner after this benchmark PR lands.

## Schema 1.4: all 1,188 memberships (#796, #665 public part)

`pii-eval` `b1c097e40bad456e52f904f626cca00b69c45612` (schema 1.4, ADR 0017 and 0018; CI run 37551091456, engine artifact 11452747504, `Cargo.lock` unchanged) states the authored `not-established` identity and the absent range. The converter patch of the handoff
(`scripts/lib/pii-population-conversion.mjs`, digest `c44ad88a…`) carries the 156 range-less memberships; each population is again its own snapshot, manifest, observation set, roster and artifact, now sealed under schema 1.4 (oracle-plan 146, qualification-plan 266,
diagnostic-balanced 477, benign-heavy-stress 299; unresolved 51, 36, 49, 20). Located quantities are exactly the oracle's (0 unexplained differences over the 1,032 located memberships; the range-less ones are checked against what the authors wrote); `measurable-share` is the one
metric whose denominator grows. The metric boundary is [`pii-scorer-basis.md`](pii-scorer-basis.md), accepted by the owner on 2026-10-06 (scorer, denominator and label decision only).

Adoption is derived, not typed: `scripts/adopt-pii-engine.mjs --run=<id> --pii-eval=<checkout> --write` recomputes the transport source, both consumer pin files and the migration record from the CI run's artifacts and the dual-run report, and
`--replay-run=<id> --replay-receipt=<file>` records the canonical linux replay (`pii-population-replay.yml`, run 37552998602: the pinned linux engine reproduces all four artifacts byte for byte). The consumer reads a pin of exactly one schema minor (1.1, 1.2 or 1.4; 1.3 is not accepted)
and refuses a document of another minor, a mismatched digest or population, and an absent population (reported `missing`, never invented). The committed replays (`benchmarks/pii-eval-population-dual-run/`) are `exploratory`: replays of a frozen observation, kept as the oracle parity evidence. The pins read the fresh official execution recorded in `benchmarks/pii-eval-official-run/`
(run 37559349070, `scripts/record-pii-official-run.mjs`; the replays' digests are retired by the pins); see [`pii-official-execution-plan.md`](pii-official-execution-plan.md). An execution is evidence, not an accepted verdict.
