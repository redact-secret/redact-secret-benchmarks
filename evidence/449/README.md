# Evidence: the 0.1.0-beta.11 cross-domain release record (credentials + PII)

**Result:** [`release-record-v2.json`](release-record-v2.json) (schema 2, commitment `68e57ab0…9a97`) binds the published
source `94fc18a974f659ea882c89120dbf1adb3acf2f28` (0.1.0-beta.11). It carries the credential domain (a complete full-suite
candidate run and an `execution-qualified` engine-v1 qualification), the PII domain (reviewed v2 route
`beta11-8b6a5fd-pii-protected`: 5 `provisional`, 1 `pending`, 0 `stable`, all under `pii-v1`) and the ACCEPTED
performance report. The domain metrics are not combined. The PII evidence is at `8b6a5fd`. It binds `94fc18a` through
the reviewed source equivalence `beta11-8b6a5fd-to-94fc18a`: at one benchmark commit the two builds give the same
outcome and finding count on all 4,827 credential fixtures. Credential support status at benchmarks `c82a15a` is
**88 stable of 110** in both published mode (`@redact-secret/core` 0.1.0-beta.11) and candidate mode (`94fc18a`). The
record makes no support claim (`supportClaims: false`).

Issue: [#449](https://github.com/redact-secret/redact-secret-benchmarks/issues/449). It supersedes the beta.10 record
asked for in [#287](https://github.com/redact-secret/redact-secret-benchmarks/issues/287), which was never produced.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` release source | `94fc18a974f659ea882c89120dbf1adb3acf2f28` (tag `v0.1.0-beta.11`, PR #1007), clean, declares 0.1.0-beta.11 |
| `redact-secret` PII evidence commit | `8b6a5fde52ecb4dfce13f09c7a947062d21483c7` ([#428 final record](../901/428/final-core-8b6a5fde.md)) |
| Benchmarks, measurements | `c82a15ab797452fe200fc74674604ae9cd03cac3` (`develop`, clean): candidate runs, qualification, classification |
| Benchmarks, record | `deab84f2670bd9e0283a241c5465781e91c6a538` (branch `workbench/449-beta11-release-record`, clean): the commit that adds the schema 2 code and the inputs below. `identity.benchmarkRevision` names it |
| Candidate artifacts at `94fc18a` (darwin-arm64) | core `3e704905…4b05`, node `99ad6616…1a7c`, wasm `d89e0e6b…bcf9` |
| Candidate artifacts at `8b6a5fd` (rebuilt) | core `467111e2…f74c` and wasm `61d135ba…66f2d`: byte-identical to run `e795030e` ([`../860/8b6a5fd`](../860/8b6a5fd/README.md)). The node addon is not reproducible between builds (`1a07a55d…`) |
| Peers | trufflehog 3.97.4 (`~/.local/opt/trufflehog-3.97.4` first on `PATH`, `trufflehog --version` checked), gitleaks 8.30.1 |

## Files

| File | Content |
| --- | --- |
| [`release-record-v2.json`](release-record-v2.json) | The record. `validateReleaseRecordV2` re-assembles it from what it embeds; `verifyReleaseRecordEvidence` also re-derives the PII route and the parity from committed evidence (`tests/produce-release-record.test.mjs`) |
| [`credential-candidate-94fc18a-v1.json`](credential-candidate-94fc18a-v1.json) | Candidate run `e25b9b44-3309-4c28-96eb-300566b4b700`: complete, full suite, 4,827 fixtures, corpus `3cf8fc25…a89c`, `eval:validate` passed |
| [`credential-candidate-8b6a5fd-v1.json`](credential-candidate-8b6a5fd-v1.json) | Parity run `e2253e14-baa4-49a3-8fb1-e301bea0d6b1`: the same corpus at `c82a15a`, `eval:validate` passed |
| [`credential-qualification-engine-v1.json`](credential-qualification-engine-v1.json) | `eval:qualify` run `ff89a21b-ec8e-444f-b665-644ba39ee92f`: `execution-qualified`, scope `engine-conformance`, holdout `public-control` complete, milestone closed. Scanners: redact-secret 0.1.0-beta.11 (the published package in the lockfile), gitleaks 8.30.1, trufflehog 3.97.4. Its assertion failures are development findings for the three scanners, not engine failures |
| [`support-status-published.json`](support-status-published.json) | Classification `b54da434-d964-4d3c-b7a3-1909e6c471f7`, published mode |
| [`support-status-candidate.json`](support-status-candidate.json) | Classification `e7235367-4459-4919-9dbe-f7f0c5681eb3`, candidate mode (`94fc18a` artifacts) |

The performance report is not copied. The record embeds
[`../860/94fc18a-release/regression-budgets.json`](../860/94fc18a-release/regression-budgets.json) (run 36609010314,
ACCEPTED, `regression-budgets-v1`), which already names `94fc18a`.

## Credential stable counts

| Mode | Product | stable | provisional | pending | Stable profiles |
| --- | --- | ---: | ---: | ---: | --- |
| published | `@redact-secret/core` 0.1.0-beta.11 | 88 of 110 | 20 | 2 | documented 63, empirical 25 |
| candidate | `94fc18a` artifacts above | 88 of 110 | 20 | 2 | documented 63, empirical 25 |

The two `families` arrays are byte-identical. Fixture index `5919a676…9d42` (4,827 fixtures), taxonomy `c6a52802…518c`.

## Why the PII side uses the v2 protected route

The v1 trusted product binding (`trusted-product-bindings-v1.json`) accepts only `pii:qualify:candidate` output. Its
frozen per-family plans pin `vocabulary=pii-context/v1`, and Beta.11 reports `pii-context/v2`, so a v1 binding for
`8b6a5fd` or `94fc18a` would need plans rewritten after the fact. The Beta.11 disposition already reaches publication
through the reviewed v2 route (`protected-support-bindings-v1.json`, checked by `bindPiiProtectedSupport`). Schema 2 of
the record accepts that route. The decision is the amendment to
[`docs/decisions/2026-09-27-bind-the-beta10-cross-domain-release-record.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-27-bind-the-beta10-cross-domain-release-record.md).
Under #449's "Done when", this is option (a): Beta.11 evidence satisfies the single-commit binding.

## Source equivalence 8b6a5fd → 94fc18a

Reviewed entry `beta11-8b6a5fd-to-94fc18a` in
[`benchmarks/evaluation/release-source-equivalences-v1.json`](../../benchmarks/evaluation/release-source-equivalences-v1.json):

- **Product diff.** 54 files change. Every changed build input changes only the version string: `Cargo.toml`,
  `Cargo.lock`, the ten `bindings/*` package manifests and the lockfile, `packages/javascript/package.json` and
  `src/version.ts`. No `crates/**/*.rs`, binding source or package source changes. The rest are READMEs, docs,
  product-side support-matrix data and scripts. Read with `git diff --name-only 8b6a5fd 94fc18a` in `redact-secret`.
- **Credential parity.** At benchmarks `c82a15a`, the full-suite candidate runs of `8b6a5fd` and `94fc18a` cover the
  same 4,827 fixtures and corpus. Each fixture has the same outcome and finding count in both, so 0 differ.
  `verifySourceEquivalenceParity` recomputes this from the two committed files.
- **Performance.** The paired browser-initialization runs `8b6a5fd` → `94fc18a` are recorded in
  [`../860/94fc18a-release/README.md`](../860/94fc18a-release/README.md): pooled small-whole 0.971 [0.869, 1.084].

## Commands

```sh
export PATH="$HOME/.local/opt/trufflehog-3.97.4:$PATH"; trufflehog --version   # 3.97.4
# redact-secret, clean detached worktrees at 94fc18a and at 8b6a5fd:
npm run benchmark:candidate -- --benchmark-ref c82a15ab797452fe200fc74674604ae9cd03cac3 \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# redact-secret-benchmarks at c82a15a, clean:
npm run eval:qualify -- --output=<dir>/engine-v1.json
npm run eval:classify -- --output=<dir>/support-status-published.json
npm run eval:classify -- --candidate-package=<94fc18a artifacts>/redact-secret-core-0.1.0-beta.11.tgz \
  --candidate-node-package=<…>/redact-secret-node-darwin-arm64-0.1.0-beta.11.tgz \
  --candidate-wasm-package=<…>/redact-secret-wasm-0.1.0-beta.11.tgz \
  --candidate-source-commit=94fc18a974f659ea882c89120dbf1adb3acf2f28 --output=<dir>/support-status-candidate.json
# the record, at deab84f:
node --import tsx scripts/produce-release-record.mjs --release-version=0.1.0-beta.11 \
  --source-commit=94fc18a974f659ea882c89120dbf1adb3acf2f28 --benchmark-revision=deab84f2670bd9e0283a241c5465781e91c6a538 \
  --credential-profile=measurement-v4 --performance-budget=evidence/860/94fc18a-release/regression-budgets.json \
  --credential-candidate=evidence/449/credential-candidate-94fc18a-v1.json \
  --credential-qualification=evidence/449/credential-qualification-engine-v1.json \
  --pii-route=pii-b11-protected-v1 --pii-protected-binding=beta11-8b6a5fd-pii-protected \
  --source-equivalence=beta11-8b6a5fd-to-94fc18a --output=evidence/449/release-record-v2.json
```
