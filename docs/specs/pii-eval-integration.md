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

- oracle `4b846967346505baca11e0b98cab1475fbce6773` and `pii-eval` source `6157cbc5918b3888c8e84b1884719ea8f3278b36`;
- schema `pii-eval.public-synthetic-artifact` 1.1; canonical `pii-v1` revision 2 and compatibility revision 1;
- all seven method versions and ten metrics through the upstream handoff, with mechanics `minDenominator=4`, `replays=2`, `z=1.96`, precision 6;
- `redact-secret-core-node` adapter 1.0.0, normalization 1, scanner package 0.1.0-beta.12, fixed parameters and activation selectors `pii:global`, `pii:us` with their digests;
- current custodian and ledger source revisions reviewed for this integration.

The benchmark population source is the six-family `b11-population-v2` plan set. `oracle-plan`, `qualification-plan`, `diagnostic-balanced` and `benign-heavy-stress` remain distinct. Their six plan files, exact candidate report and observation are content-pinned; `npm run pii:migration:check` refuses drift.

## Acceptance and remaining work

The upstream compatibility run is accepted as scanner-neutral evidence: 37 cases, 54 variants, 540 outcomes, 181 metric comparisons and 660 statistics vectors have zero compatibility differences and zero unexplained canonical differences. Canonical differences remain classified as intentional revision, legacy bug or compatibility representation; thresholds, cases and denominators were not changed.

That run is not benchmark population acceptance. The benchmark record separately freezes 146 oracle-plan, 266 qualification-plan, 477 diagnostic-balanced and 299 benign-heavy-stress cases from the Beta.13 candidate report. Schema 1.1 cannot carry those view identities or per-family projections, so a four-population `pii-eval` dual run cannot yet be represented without inventing a mapping. #664 therefore remains blocked on the additive schema request in the parity report, while ownership/contracts are accepted and the independent consumer work proceeds.

Protected evidence is never read from private-ledger. The benchmark consumer accepts only bounded canonical custodian envelopes with signed v2 destination binding and a valid current feed. A signature establishes origin and integrity, not independent ground truth; the projection's configuration is not signed because the projection contract does not contain it.

`benchmarks/evaluation/domains/pii/custodian-consumer.mjs` implements that consumer at private-custodian `23f75304d4cf53fc8604379255bbf058f642daeb`. It strictly parses the bridge request/manifest, v2 projection and revocation envelopes; reproduces `custodian-canonical-json/1`; verifies Ed25519 with out-of-band key domain, purpose, validity and revocation pins; requires the signed destination; and checks exact domain, candidate, population, disclosure policy and feed identities. Feed sequence, replay, fork, previous-link, freshness, revocation, supersession and projection expiry are stateful, and every feed update re-evaluates accepted projections.

The request/response, v2 projection and revocation schema SHA-256 pins and both upstream golden-vector hashes are recorded in `benchmarks/pii-eval-migration.json`. The synthetic bundle itself is pinned there as `d2dea176a0d785c8cdefa7403d72baa408410d853989fc03f46c4351642db508`.

The committed bundle is public synthetic data signed by disposable test keys. Its support-matrix projection is always marked `syntheticConformance=true`, `supportClaims=false` and `qualification=not-live-support-evidence`; binding it cannot change any family status. The request's configuration digest is recorded as `bridge-request-only-not-signed-projection`, never described as a signed projection field. A real protected consumer remains blocked on a custodian catalog/transport, production v2 signing-key authorization and cross-repository artifact access; no protected run, private-ledger read or production key is part of this integration.

## Public artifact consumer

`benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs` is benchmark-owned and imports no evaluator implementation. It validates the exact upstream 1.1 JSON Schema, strict JSON structure and bounds, the upstream semantic-digest construction, engine/build provenance, candidate-versus-release identity, scanner/configuration/activation/population/manifest pins, completeness, supersession and all ten metrics. Populations and their denominators remain separate. The accepted projection can be bound to `pii-support-matrix-v2` by `scripts/publish-pii-support.ts`; it is committed by the matrix digest and read back by the Next service.

The pinned local build at `pii-eval` `6157cbc5918b3888c8e84b1884719ea8f3278b36` produced:

- Cargo.lock SHA-256 `e646a917c7dc8a5d5f5744bbfc56456661ebeb5505ac18788b7d5262f29a956a`;
- source archive SHA-256 `e86756f8a556af326c712f1abdaca3624fdae2f59dd924a497791892c2b0b6e1`;
- macOS local verification binary SHA-256 `532b51347ae8696d444d7cf35b11ce00f975444a29f8ebc22a59f78c120bce26`.

That binary hash identifies this reproducible local verification only; it is not a canonical Linux Actions artifact. CI validates committed synthetic artifacts and policy, but does not execute a measurement run. Schema 1.1 lacks family/view projections, language/control-class breakdowns, population views and official/exploratory mode, so the matrix and UI show those fields as explicitly unavailable and the artifact cannot change a family verdict.

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
`benchmarks/pii-eval-public-synthetic-pins.json`. They bind successful push run `37129550754`, attempt 1, engine commit
`6157cbc5918b3888c8e84b1884719ea8f3278b36`, engine artifact `11276785421`, measurement artifact `11276237723`, upload
archive digests, exact member rosters and byte digests, build-info and Cargo.lock provenance. A replacement, rerun, fork,
expired artifact or absent population fails closed. No latest-run fallback exists. The measurement artifact expires at
`2026-10-17T14:27:06Z`; reviewed repinning or durable upstream artifact delivery is required before that date.

This run measures upstream `synthetic-demo-population` (3 authored cases, 6 variants), candidate scanner beta.12.
It is separate from the staging site's product candidate and the four benchmark-owned populations in #664. It provides
transport and consumer evidence only: family policy, support verdicts, thresholds, credential outputs and PII authority
remain unchanged. The UI retains public measurement when protected binding fails, hides all unvalidated protected
family/count/status facts, and presents each scanner/population's exact effective N and withheld states separately.

```sh
npm run pii:artifact-source:check
# Read-only token required; do not put it in an engine/scanner environment.
GH_TOKEN=<installation-token> node scripts/fetch-pii-eval-public-synthetic.mjs fetch --out=/tmp/pii-public
npm run eval:publish:pii-support -- \
  --pii-eval-pins=benchmarks/pii-eval-public-synthetic-pins.json \
  --pii-eval-artifact=/tmp/pii-public/public-synthetic-artifact.json \
  --population-mode=not-measured
```

Local verification at the exact pins successfully downloaded and verified both archives through existing read-only
GitHub authentication. The hosted workflow separately proves App installation access. If that token cannot access
pii-eval, the prerequisite is an existing App installation on that repository with Actions/contents read and the secret
available to benchmarks; this implementation neither creates credentials nor changes installation settings.
The publish-site mirror in `redact-secret/redact-secret-sites/docs/upstream/redact-secret-benchmarks--publish-site.yml`
must be synchronized by its owner after this benchmark PR lands.
