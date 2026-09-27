# Evidence: redact-secret#774 — Beta.10 credential families measured at cfe2aec

**Result:** 3 of 13 Beta.10 families read `stable` (documented, T1) in candidate mode: `aws-bedrock-long-term-api-key`,
`aws-bedrock-short-term-api-key`, `elevenlabs-api-key`. No family qualifies for `Stable · Empirical` (T2). Candidate mode
64 stable of 83 families; published mode (0.1.0-beta.9) 61 stable of 83, unchanged from `develop`.

Benchmark side of [redact-secret#774](https://github.com/redact-secret/redact-secret/issues/774) (product #862-#868, PR #869),
[redact-secret-benchmarks#384](https://github.com/redact-secret/redact-secret-benchmarks/issues/384), per [`evidence/README.md`](../README.md).
No matched plaintext or example credential is retained here.

## Source revisions

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
