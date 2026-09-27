# Evidence: redact-secret#774 — Beta.10 credential families measured at cfe2aec, then 735797a, then 26efbba

**Current result (26efbba, superseding 735797a and cfe2aec below):** 4 of 13 Beta.10 families read `stable`: three T1
documented (`aws-bedrock-long-term-api-key`, `aws-bedrock-short-term-api-key`, `elevenlabs-api-key`) and one T2
empirical (`tavily-api-key`, qualified once redact-secret#870 removed its placeholder false alarm; unchanged by
#871's perf-only fix). Candidate mode 65 stable of 83 families; published mode (0.1.0-beta.9) unchanged at 61 of 83.
The registry re-pin to 26efbba is otherwise unblocked by detector-list changes (none across cfe2aec/735797a/26efbba),
but the performance evaluation reads REJECTED at every commit measured so far, most recently on `cli`'s
`scale-logs` surface specifically (see "Update: re-pinned at 26efbba" below), so
`benchmarks/performance-criteria.json baseline.verifiedCommit` is not advanced and `pins:check` still fails on the
pre-existing #150 coupling.

**Prior result (cfe2aec, first measured):** 3 of 13 families read `stable` (documented, T1), none empirical. Candidate
mode 64 stable of 83; published mode 61 stable of 83.

Benchmark side of [redact-secret#774](https://github.com/redact-secret/redact-secret/issues/774) (product #862-#868, PR #869),
[redact-secret-benchmarks#384](https://github.com/redact-secret/redact-secret-benchmarks/issues/384), per [`evidence/README.md`](../README.md).
No matched plaintext or example credential is retained here.

## Source revisions (cfe2aec, first measurement)

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `cfe2aecdde609c093a92d699c75b8166af753453` (PR #869 merge; tree identical to the reviewed branch tip `08cc3f6`), clean |
| `redact-secret-benchmarks` | `957c3dadee681eb10840121520f8b056a0727f9e` (branch `feat/beta10-empirical-promotion`), clean |

Candidate artifact SHA-256: core `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664`, node darwin-arm64
`f5a17e7bf96b65e2db4cfc77afc00db7e5b09ac5aec513f26708fafdce937dff`, wasm `e35f6abdca608d68d393636156ebc0371f8e6b4a24e872a06a254ca3b3f48e76`.
Candidate run `df6227bc-afc5-4ec4-be1b-9791a267d620`: complete, 3,527 of 3,527 fixtures ([`candidate-evidence-v1.json`](candidate-evidence-v1.json)).
Candidate classification run `fe831ef8-51d6-49f3-87fc-3199208d9f77` ([`support-status.json`](support-status.json), [`support-matrix.json`](support-matrix.json));
published classification in [`published/`](published/).

Pinned scanners: trufflehog 3.97.4 and gitleaks 8.30.1 (provisioned by `npm run peers:provision` into a read-only directory first on `PATH`;
the machine's own trufflehog was 3.97.6 and was not used).

## Per-family result (candidate mode, cfe2aec)

| Family | Before | After | Tier | Unmet floor or reason |
| --- | --- | --- | --- | --- |
| `aws-bedrock-long-term-api-key` | arrival, unscored | stable (documented) | T1 | none. Maintainer ruling 2026-09-27 (#778) |
| `aws-bedrock-short-term-api-key` | arrival, unscored | stable (documented) | T1 | none. Ruling (#779) |
| `elevenlabs-api-key` | arrival, unscored | stable (documented) | T1 | none. Ruling (#788); body twins unasserted |
| `tavily-api-key` | arrival | provisional | T2 | product flags the provider's own `Authorization: Bearer tvly-YOUR_API_KEY` placeholder (benign false alarm); no pinned scanner rule |
| `together-ai-api-key` | arrival | provisional | T2 | corroboration 2 references / 2 owners / 1 class (needs 3/3/2): one betterleaks rule plus research; no provider source states a shape |
| `mistral-api-key` | arrival | provisional | T2, gated | placeholder controls flagged (3 false alarms); one non-summary corroboration class (three rules read as one assertion) |
| `cohere-api-key` | arrival | provisional | T2, gated | placeholder controls flagged (3 false alarms), metamorphic and differential rows open |
| `deepgram-api-key` | arrival | provisional | T2, gated | product misses `createClient(key)` and the WebSocket subprotocol form; 2 twin failures; 3 false alarms |
| `ai21-api-key` | arrival | pending | T0 | no provider or scanner shape; nothing to qualify |
| `anthropic-api01-key`, `anthropic-admin01-key`, `openai-admin-api-key` | arrival | unscored arrival | T1, T1, T2 | the product types them inside `anthropic-token` / `openai-token` under one finding type, so no per-family attribution exists |
| `exa-api-key` | arrival | unscored arrival | T0 | the product registered no Exa detector |

`anthropic-token` stays `stable`: the four re-scoped api01/admin01 twins are replaced by three `beta8-384a` twins.

## Performance evaluation blocks the pin-consistency check

`performance-evaluation.yml` dispatched at cfe2aec was REJECTED twice (runs 36296467929 and 36297402221): `scale-logs`
processing-ratio +11 to +31% on cli, node, python, rust-core and browser-wasm against the reviewed budgets. A REJECTED run is
never recalibrated away, so `benchmarks/performance-criteria.json` `baseline.verifiedCommit` stays `0af4cb8`, and
`npm run pins:check` and the `pin consistency` unit test fail until a run reads ACCEPTED or the maintainer records an accepted tradeoff
in `benchmarks/accepted-regressions.json` (the same coupling that b06e81e deferred).

## Commands

```sh
npm run peers:provision -- --dir /path/peers && export PATH=/path/peers:$PATH   # trufflehog 3.97.4, gitleaks 8.30.1
npm run fixtures:generate
npm run eval:candidate -- --candidate-package <core.tgz> --candidate-node-package <node.tgz> --candidate-wasm-package <wasm.tgz> \
  --candidate-source-commit cfe2aecdde609c093a92d699c75b8166af753453 --product-state clean --expected-artifact-sha256 <core sha> --output-dir evidence/774
npm run eval:classify -- --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> \
  --candidate-source-commit=cfe2aecdde609c093a92d699c75b8166af753453 --output=evidence/774/support-status.json
npm run eval:matrix -- --input=evidence/774/support-status.json --output=evidence/774/support-matrix.json
```

The artifacts came from the product's own candidate build (`npm ci`, `js:build`, node addon, `wasm:build`, `wasm:build:common`, `npm pack`)
at cfe2aec, not through `npm run benchmark:candidate`, so the classification could run against the working corpus.

## Update: re-measured and re-pinned at 735797a (redact-secret PR #870)

Product follow-up PR #870 (merge `735797a7950dbb41c8f87bc94ca152d1f2ec9604`) fixes the `scale-logs` performance
regression (a cheap provider-keyword pre-scan gates the keyword-gated detectors before the full run scan) and the
`tvly-`/`MISTRAL_API_KEY=`/etc. instructional-placeholder false alarms, and updates the Bedrock/ElevenLabs doc comments
to the maintainer's 2026-09-27 T1 ruling text. `crates/secret-scan-core/src/detectors/mod.rs` (the registry list) is
unchanged between cfe2aec and 735797a, so the re-pin touches only `benchmarks/detectors.json` `sourceRevision` and
`benchmarks/detector-inventory.json` `redactSecretRevision` (`redactSecretReleaseRevision` stays `f726f2f`, the last
published beta.9 source — no new release happened).

### Source revisions (735797a)

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `735797a7950dbb41c8f87bc94ca152d1f2ec9604` (PR #870 merge), clean |
| `redact-secret-benchmarks` | this branch tip |

Candidate artifact SHA-256: core `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` (unchanged: no JS
façade change), node darwin-arm64 `c0bc886033fb13a6de98932f062af4c55f512edc86510fee9528b853d4a4b86d`, wasm
`d532eec1a517bc740dc18c7f33a90e5ce0fdd11de8a6c337e4e75639faba6f13`. Candidate run (`735797a/candidate-evidence-v1.json`):
complete, 3,527 of 3,527 fixtures. Candidate classification `21f0b8f1-af97-4c1e-8599-1b3c8d339079`
(`735797a/support-status.json`, `735797a/support-matrix.json`); published classification in `735797a/published/`.
Pinned scanners: trufflehog 3.97.4, gitleaks 8.30.1 (same provisioning as above).

### Per-family result (candidate mode, 735797a)

| Family | cfe2aec status | 735797a status | Tier | What changed / remaining unmet floor |
| --- | --- | --- | --- | --- |
| `aws-bedrock-long-term-api-key` | stable (documented) | stable (documented) | T1 | unchanged |
| `aws-bedrock-short-term-api-key` | stable (documented) | stable (documented) | T1 | unchanged |
| `elevenlabs-api-key` | stable (documented) | stable (documented) | T1 | unchanged |
| `tavily-api-key` | provisional | **stable (empirical)** | T2 | #870 removed the `tvly-YOUR_API_KEY` placeholder false alarm; the family already had the corroborated-route evidence (4 references, 4 owners, `peer-scanner-rule`/`provider-example`/`independent-research`) recorded in `benchmarks/support/empirical-observations.json`, so it now clears every empirical gate |
| `together-ai-api-key` | provisional | provisional | T2 | unchanged: corroboration 2 references / 2 owners / 1 non-summary class (needs 3/3/2); #870 fixed no Together-specific placeholder |
| `mistral-api-key` | provisional | provisional | T2, gated | improved (false alarms 3→1, metamorphic 29→15, mutation 3→1, differential 5→1) but one benign false alarm remains: the `detector-coverage--mistral-api-key-short-token` near-miss control (`MISTRAL_API_KEY=` + a 31-byte body, one short of the contracted 32) is still redacted, labelled `generic-token` — a named-assignment co-detection on a boundary value, not an instructional placeholder, so #870 does not touch it. One non-summary corroboration class also remains short (needs 2) |
| `cohere-api-key` | provisional | provisional | T2, gated | same pattern: false alarms 3→1 (the analogous `short-token` control), metamorphic 29→15; still short of the empirical floors |
| `deepgram-api-key` | provisional | provisional | T2, gated | false alarms 3→1 (same `short-token` pattern), metamorphic 43→29; still misses `createClient(key)` and the WebSocket subprotocol form, 2 twin failures remain |
| `ai21-api-key` | pending | pending | T0 | unchanged: no provider or scanner shape |
| `anthropic-api01-key`, `anthropic-admin01-key`, `openai-admin-api-key` | unscored arrival | unscored arrival | T1, T1, T2 | unchanged |
| `exa-api-key` | unscored arrival | unscored arrival | T0 | unchanged |

The `short-token` false alarm on mistral/cohere/deepgram is a genuine, reproducible product behavior, not a fixture
defect: `generic-token`'s credential-named-assignment rule (redact-secret#702) redacts any value assigned to an
`*_API_KEY=`-shaped name regardless of length, so a one-byte-short near-miss beside that exact name is still flagged
(labelled `generic-token`, not the family's own detector). The equivalent `travisci-api-token` control
(`TRAVIS_API_TOKEN=` + a 21-byte body) is not flagged, because travis's native body (22 bytes) minus one character
falls below whatever length threshold `generic-token`'s heuristic uses, while mistral/cohere/deepgram's longer
native bodies (32/40/40) do not. The fixture was kept at the strictest one-byte-short boundary per this repository's
near-miss convention rather than widened to dodge the interaction, so the finding is reported open, not resolved.

### Performance evaluation: still REJECTED at 735797a

Two independent dispatches of `performance-evaluation.yml` at 735797a both read REJECTED, each on `scale-logs`
`processing-ratio` (budget `allowedChange: 0.1`, i.e. 10%), on a different subset of surfaces each time (noise near
the budget line, not a single stable offender):

| Run | Surfaces over budget | Measured ratio |
| --- | --- | --- |
| [36300197486](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36300197486) | browser-wasm (medium-fixed4096), cli (medium-fixed4096), rust-core (medium-fixed4096) | 1.112, 1.107, 1.102 (node 1.064, python 1.065 — within budget) |
| [36300482562](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36300482562) | browser-wasm (medium-fixed4096), node (small-whole), rust-core (small-whole) | 1.117, 1.104, 1.114 |

This is a real, measured residual regression of roughly 10-12% on `scale-logs`, not the ~4-5% estimated before
dispatch. It clears the ~13-31% regression that rejected cfe2aec, but does not clear the reviewed 10% budget on both
runs. Per the documented re-pin procedure, a REJECTED run is never recalibrated away: `benchmarks/performance-criteria.json`
`baseline.verifiedCommit` stays `0af4cb8`, and `npm run pins:check` / the `pin consistency` unit test keep failing on
the pre-existing #150 coupling until a run reads ACCEPTED at 735797a (or a later commit) or the maintainer records an
accepted tradeoff in `benchmarks/accepted-regressions.json`. No performance criteria were hand-edited or forced.

### Commands (735797a)

```sh
npm run peers:provision -- --dir /path/peers && export PATH=/path/peers:$PATH   # trufflehog 3.97.4, gitleaks 8.30.1
npm run fixtures:generate
npm run eval:candidate -- --candidate-package <core.tgz> --candidate-node-package <node.tgz> --candidate-wasm-package <wasm.tgz> \
  --candidate-source-commit 735797a7950dbb41c8f87bc94ca152d1f2ec9604 --product-state clean --expected-artifact-sha256 <core sha> --output-dir evidence/774/735797a
npm run eval:classify -- --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> \
  --candidate-source-commit=735797a7950dbb41c8f87bc94ca152d1f2ec9604 --output=evidence/774/735797a/support-status.json
npm run eval:matrix -- --input=evidence/774/735797a/support-status.json --output=evidence/774/735797a/support-matrix.json
gh workflow run performance-evaluation.yml --ref develop -f candidate_revision=735797a7950dbb41c8f87bc94ca152d1f2ec9604
```

## Update: re-pinned at 26efbba (redact-secret PR #871, round-2 perf fix)

Product follow-up PR #871 (merge `26efbbaa5627ade0f9e7b248f4f88bdbe5334322`) replaces `contains_ascii_ci`'s
Boyer-Moore-Horspool scan (added in #870) with a first-byte linear scan, for the keyword-gated detectors'
provider-context pre-check. `crates/secret-scan-core/src/detectors/mod.rs` is unchanged, so this is a pure
performance change: candidate mode reads the identical distribution as 735797a (65 stable of 83, 25 empirical;
tavily-api-key still the only newly-qualified family). Node darwin-arm64 artifact SHA-256
`b6fd4681ef7d4195002d8b8e3269f190a1a4645a24bc7bac5fe17f2378814664`, wasm
`f4b97b6572d5a2d9de360c442e58a97634f301307f4d1af6a307090468ff1b96` (core façade unchanged:
`51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664`). Candidate classification
`1e1c7fbc-7407-4879-ae1e-f4d917593063` (`26efbba/support-status.json`, `26efbba/support-matrix.json`); published
classification in `26efbba/published/`. Same pinned scanners as above.

### Performance evaluation: still REJECTED, closer, `cli` is the persistent offender

Two independent dispatches at 26efbba, full `scale-logs` `processing-ratio` table (budget `allowedChange` shown per
row; 0.1 = 10% unless noted):

| Surface / profile | Budget | Run [36302356053](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36302356053) | Run [36302653920](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36302653920) |
| --- | --- | --- | --- |
| browser-wasm / medium-fixed4096 | 10% | **1.1097 (regression)** | 1.0931 (within budget) |
| browser-wasm / small-whole | 30% | 1.1364 (within budget) | 1.2634 (within budget) |
| cli / medium-fixed4096 | 10% | **1.1060 (regression)** | **1.1331 (regression)** |
| cli / small-whole | 10% | **1.1089 (regression)** | **1.1245 (regression)** |
| node / medium-fixed4096 | 10% | 1.0892 (within budget) | 1.0969 (within budget) |
| node / small-whole | 10% | 1.0889 (within budget) | 1.0815 (within budget) |
| python / medium-fixed4096 | 10% | 1.0895 (within budget) | 1.0879 (within budget) |
| python / small-whole | 10% | 1.0869 (within budget) | 1.0705 (within budget) |
| rust-core / medium-fixed4096 | 10% | 1.0968 (within budget) | 1.0930 (within budget) |
| rust-core / small-whole | 10% | 1.0845 (within budget) | 1.0918 (within budget) |

Both runs regress on `cli/scale-logs-medium-fixed4096` and `cli/scale-logs-small-whole` (10.6-13.3%); `browser-wasm`'s
`medium-fixed4096` regressed once (10.97%) and cleared once (9.31%) — noise near the 10% line, not a persistent
offender the way `cli` is. `node`, `python` and `rust-core` clear both runs and both profiles with margin (7-11%
below budget). This round's fix cleared the ~13-31% regression measured at cfe2aec and the ~10-12% still open at
735797a on most surfaces, but `cli` stays over budget on both dispatches — a real, reproducible residual regression
specific to the CLI runtime, not run-to-run noise. `baseline.verifiedCommit` is not advanced; `pins:check` and the
`pin consistency` unit test keep failing on the pre-existing #150 coupling. No performance criteria were hand-edited,
no tradeoff was recorded, and no run was forced or re-dispatched beyond these two.

### Commands (26efbba)

```sh
npm run peers:provision -- --dir /path/peers && export PATH=/path/peers:$PATH   # trufflehog 3.97.4, gitleaks 8.30.1
npm run fixtures:generate
npm run eval:candidate -- --candidate-package <core.tgz> --candidate-node-package <node.tgz> --candidate-wasm-package <wasm.tgz> \
  --candidate-source-commit 26efbbaa5627ade0f9e7b248f4f88bdbe5334322 --product-state clean --expected-artifact-sha256 <core sha> --output-dir evidence/774/26efbba
npm run eval:classify -- --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> \
  --candidate-source-commit=26efbbaa5627ade0f9e7b248f4f88bdbe5334322 --output=evidence/774/26efbba/support-status.json
npm run eval:matrix -- --input=evidence/774/26efbba/support-status.json --output=evidence/774/26efbba/support-matrix.json
gh workflow run performance-evaluation.yml --ref develop -f candidate_revision=26efbbaa5627ade0f9e7b248f4f88bdbe5334322
```
