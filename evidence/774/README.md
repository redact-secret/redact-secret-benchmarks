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

## Update: re-pinned at f26dee2 (redact-secret PR #882, finding-type split) — a pre-existing ledger-churn defect surfaces

Product PR #882 (merge `f26dee26a9c2aa3cfff3543d784c02de5054de09`, parent #862/#863, this issue) splits the shared
`anthropic_api_key`/`openai_api_key` finding types the three anthropic/openai arrival families were riding inside:
`sk-ant-api01-` now reports `anthropic_enterprise_api_key`, `sk-ant-admin01-` reports `anthropic_admin_api_key`, and
`sk-admin-` reports `openai_admin_api_key`. `crates/secret-scan-core/src/detectors/mod.rs` (the registry list) is
unchanged; only `anthropic.rs`, `openai.rs` and `policy.rs`'s `ALWAYS_REDACT_TYPES` (72 → 75 entries) move.

**Benchmarks-side mapping (the actual change this re-pin makes):** `anthropic-api01-key`, `anthropic-admin01-key`
and `openai-admin-api-key` move off "unscored arrival" by the repo's existing #251/#730 mechanism — the same one
`github-fine-grained-pat`, `slack-app-level-token`, `slack-user-token` and `stripe-webhook-signing-secret` already
use — never a hand-edit of a derived file:

- `scanners/families.mjs` `arrivalFindingTypes`: added `'anthropic-token': { anthropic_enterprise_api_key: 'anthropic-api01-key', anthropic_admin_api_key: 'anthropic-admin01-key' }`
  and `'openai-token': { openai_admin_api_key: 'openai-admin-api-key' }`. This is what makes `scoredArrivalFamilies`
  (and therefore `scoredContractIds`, `familyCount`) include the three ids.
- `benchmarks/support/taxonomy.json`: the three families' `detectors` field moves from `[]` to `[<own arrival id>]`
  (`anthropic:compliance-access-key` → `["anthropic-api01-key"]`, `anthropic:admin-api-key` →
  `["anthropic-admin01-key"]`, `openai:admin-api-key` → `["openai-admin-api-key"]`) — the same convention every
  other scored arrival family's taxonomy row already follows (`tests/beta8.test.mjs`'s "a scored arrival family
  maps its taxonomy family to its own id" check enforces this).
- `benchmarks/lib/beta8/384a.ts`: each arrival family's `reason` text now names its new finding type, satisfied
  `tests/evaluation-methods.test.mjs`'s #251 check that the reason names both the shared detector and the type.
- `benchmarks/detectors.json` `sourceRevision` and `benchmarks/detector-inventory.json` `redactSecretRevision` move
  to `f26dee26a9c2aa3cfff3543d784c02de5054de09`; `redactSecretReleaseRevision` stays `f726f2f` (no new release).
  Regenerated `benchmarks/fixture-index.json` and `benchmarks/pin-manifest.json` from the taxonomy edit; no fixture
  content changed (fixture bytes are identical — this is a classification-plumbing change, not a corpus edit).

### A pre-existing, unrelated defect blocks almost every family from reading `stable` here

Running the full 13-family candidate suite (something #384's 2026-09-27 mistral/cohere/deepgram twin-reclassification
commit did not do — it only checked mistral/cohere/deepgram directly) surfaces that **`aws-bedrock-long-term-api-key`,
`aws-bedrock-short-term-api-key`, `elevenlabs-api-key`, `tavily-api-key` and `together-ai-api-key` no longer read
`stable`/`provisional` the way this README's prior entries describe** — they all now carry a nonzero
`differential.unresolvedContractDisagreements` count, which is untrue of anything this re-pin or #882 touches.

Root cause, isolated by re-running the *identical* f26dee2 candidate against three benchmarks states:

| Benchmarks tip | Candidate | tavily diff | bedrock (long/short) diff | elevenlabs diff | Result |
| --- | --- | --- | --- | --- | --- |
| `f00f215` (pre-mistral-fix) | f26dee2 | 0 | 0 / 0 | 0 | stable, matches this README's existing entries exactly (65/83 stable) |
| `99a7681` (this branch's tip, mistral/cohere/deepgram twin fix) | f26dee2 | 6 | 4 / 7 | 6 | provisional — regressed |
| `99a7681` (unmodified, none of this re-pin's edits) | f26dee2 | 6 | 4 / 7 | 6 | same regression, present before this re-pin touched anything |

`crates/secret-scan-core/src/detectors/{bedrock,elevenlabs,tavily,together,mistral,cohere,deepgram}.rs` did not
change between `f00f215`'s pin (`3ddfc29`) and `f26dee2` (only `anthropic.rs`/`openai.rs`/`policy.rs` did), so the
candidate cannot be the cause. The actual cause: `benchmarks/evaluation/domains/credential/cases.ts:57` computes
`const sourceHash = hash(corpus)` — one hash over the **entire** `detector-coverage` corpus (1,057 fixtures shared
by nearly every family), not per-fixture. `reviewEntryId(caseId, sourceHash, entry)`
(`benchmarks/evaluation/domains/credential/review.ts:4`) folds that corpus-wide hash into every differential
disagreement id. The 2026-09-27 mistral/cohere/deepgram twin reclassification edited three `detector-coverage`
fixtures; that shifted `sourceHash` for the whole corpus, which reshuffled the disagreement id of **every** case
across **every** family sharing it — silently invalidating previously-resolved `benchmarks/review-ledger.json` rows
for families the edit never touched. That commit's own message already named part of this ("a pre-existing,
unrelated backlog of 534 stale differential review-queue ids... predates this change and is out of scope",
confirmed independently here: `npm run queue:check` gives the identical 534 ids and the identical count whether run
against the untouched `99a7681` tip or this branch's edits) — what it did not check is that the *same* mechanism
also demotes the candidate-mode status of `aws-bedrock-*`, `elevenlabs-api-key`, `tavily-api-key` and
`together-ai-api-key`, because `queue:check` only exercises the **published** package, never a candidate build.

This is a pre-existing defect in already-committed work (the `99a7681` twin-reclassification commit), not something
`f26dee2` or this re-pin's mapping change introduces, and re-triaging 500+ ledger rows is out of scope for a re-pin.
It is not fixed here; `evidence/774/f26dee2/support-status.json` and `support-matrix.json` report the real,
unforced numbers below, including this effect.

### Per-family result (candidate mode, f26dee2) — read together with the defect above

| Family | Status | Tier | What actually blocks it |
| --- | --- | --- | --- |
| `anthropic-api01-key` | provisional | T1 | only `differential.unresolvedContractDisagreements: 19` (the ledger-churn defect); no other reason is listed |
| `anthropic-admin01-key` | provisional | T1 | `differential: 17`, plus real, pre-existing findings independent of the split: 1 benign false alarm, 7 metamorphic critical failures, 1 unresolved critical mutation |
| `openai-admin-api-key` | provisional | T2 | far from every empirical/corroboration floor (0 references/owners/classes, 9 of 10 required positive cases, 10 of 14 required benign controls, no declared uncertainty/mode/supported-context), plus `differential: 16`. Splitting the finding type made it scorable; it did not give it evidence |
| `aws-bedrock-long-term-api-key` | provisional (was stable/T1/documented) | T1 | only `differential: 4` — the ledger-churn defect above |
| `aws-bedrock-short-term-api-key` | provisional (was stable/T1/documented) | T1 | only `differential: 7` — ditto |
| `elevenlabs-api-key` | provisional (was stable/T1/documented) | T1 | only `differential: 6` — ditto |
| `tavily-api-key` | provisional (was stable/T2/empirical) | T2 | only `differential: 6` — ditto |
| `together-ai-api-key` | provisional (unchanged in kind) | T2 | unchanged corroboration shortfall (2 references/2 owners/1 non-summary class, needs 3/3/2), plus `differential: 6` |
| `mistral-api-key` | provisional | T2 | benign false alarms are now **0** (the twin reclassification worked: the instructional-placeholder/near-miss issue is gone); still short one corroboration class (1 of 2) and `differential: 6` |
| `cohere-api-key` | provisional | T2 | benign false alarms **0**, metamorphic clear; only `differential: 3` plus one short context-constrained axis — closest of the three to clearing once the ledger is re-triaged |
| `deepgram-api-key` | provisional | T2 | real, pre-existing gaps unrelated to the fix remain: 2 twin failures, 14 metamorphic critical failures, 4 unresolved critical mutations (the documented `createClient(key)`/WebSocket-subprotocol misses), plus `differential: 6` |
| `ai21-api-key` | pending | T0 | unchanged: no provider or scanner shape |
| `exa-api-key` | unscored arrival | — | unchanged: no Exa detector exists |

Candidate mode: 6 stable of 86 scored families (86 = 83 + the 3 newly-scored ids), 5 documented + 1 empirical.
Published mode (0.1.0-beta.9, predates #882): also 6 of 86 — the anthropic/openai split has no published-mode
effect since the published package does not yet report the new types. Both numbers are suppressed by the same
ledger-churn defect described above, not a genuine drop from 65/83.

### Source revisions (f26dee2)

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `f26dee26a9c2aa3cfff3543d784c02de5054de09` (PR #882 merge), clean |
| `redact-secret-benchmarks` | this branch tip |

Candidate artifact SHA-256: core `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` (unchanged: no
JS façade change), node darwin-arm64 `e58a8cae2b7e962590323a1838b21f903a67de456543ed176cc518f3bc4e8add`, wasm
`89dd94b6847c150289f0a6b84cae832d69ac9f630dd315638ab4c7ba14e458c9`. Candidate run: complete, 3,533/3,533 fixtures
(`f26dee2/candidate-evidence-v1.json`). Candidate classification `7846bf40-86e8-4c04-a762-2fb6a95f6ed2`
(`f26dee2/support-status.json`, `f26dee2/support-matrix.json`); published classification in `f26dee2/published/`.
Pinned scanners: trufflehog 3.97.4, gitleaks 8.30.1 (same provisioning as above).

### Performance evaluation: still REJECTED at f26dee2

Two independent dispatches of `performance-evaluation.yml` at f26dee2, full `scale-logs` `processing-ratio` table
(the finding-type split touches no scanning hot path, so this is expected to read like 3ddfc29's measurement, and
does):

| Surface / profile | Budget | Run [36319135388](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36319135388) | Run [36319146715](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36319146715) |
| --- | --- | --- | --- |
| browser-wasm / medium-fixed4096 | 10% | **1.1167 (regression)** | **1.1188 (regression)** |
| browser-wasm / small-whole | 30% | within budget | within budget |
| cli / medium-fixed4096 | 10% | **1.1425 (regression)** | **1.1157 (regression)** |
| cli / small-whole | 10% | **1.1274 (regression)** | **1.1054 (regression)** |
| node / medium-fixed4096 | 10% | within budget | within budget |
| node / small-whole | 10% | within budget | within budget |
| python / medium-fixed4096 | 10% | **1.1014 (regression)** | **1.1067 (regression)** |
| python / small-whole | 10% | within budget | within budget |
| rust-core / medium-fixed4096 | 10% | within budget | within budget |
| rust-core / small-whole | 10% | within budget | within budget |

Both runs regress the same four triggers on both dispatches: `browser-wasm`, `cli` (both profiles) and `python`
(medium profile only) on `scale-logs`, roughly 10.1-14.2%; `node` and `rust-core` clear both profiles on both runs
with margin. This is unchanged in kind from 3ddfc29's measurement (also REJECTED, cli 10.4-11.1%) — consistent with
the finding-type split (`anthropic.rs`/`openai.rs`/`policy.rs` only) touching no scanning hot path.
`baseline.verifiedCommit` is not advanced; `pins:check` and the `pin consistency` unit test keep failing on the
pre-existing #150 coupling. No performance criteria were hand-edited, no tradeoff was recorded, and no run was
forced or re-dispatched beyond these two.

### Commands (f26dee2)

```sh
npm run peers:provision -- --dir /path/peers && export PATH=/path/peers:$PATH   # trufflehog 3.97.4, gitleaks 8.30.1
npm run fixtures:generate && npm run fixture-index:generate
# candidate built manually (js:build, bindings/node napi build --release, wasm:build, wasm:build:common,
# scripts/pack-npm-candidate.mjs), same as every prior entry in this file — not npm run benchmark:candidate,
# so classification runs against the working corpus.
npm run eval:candidate -- --candidate-package <core.tgz> --candidate-node-package <node.tgz> --candidate-wasm-package <wasm.tgz> \
  --candidate-source-commit f26dee26a9c2aa3cfff3543d784c02de5054de09 --product-state clean --expected-artifact-sha256 <core sha> --output-dir evidence/774/f26dee2
npm run eval:classify -- --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> \
  --candidate-source-commit=f26dee26a9c2aa3cfff3543d784c02de5054de09 --output=evidence/774/f26dee2/support-status.json
npm run eval:matrix -- --input=evidence/774/f26dee2/support-status.json --output=evidence/774/f26dee2/support-matrix.json
gh workflow run performance-evaluation.yml --ref develop -f candidate_revision=f26dee26a9c2aa3cfff3543d784c02de5054de09
```

## Fix: `cases.ts:57` scoped `sourceHash` to the whole corpus instead of the fixture

Root cause, fix and re-measurement for the ledger-churn defect isolated above. Benchmarks-side of
[redact-secret-benchmarks#774](https://github.com/redact-secret/redact-secret-benchmarks/issues/774).

**Before.** `benchmarks/evaluation/domains/credential/cases.ts:57` computed `const sourceHash = hash(corpus)`
once per category, over every fixture the category's corpus file holds (1,057 fixtures for
`detector-coverage`, shared by nearly every family), and reused that single value as
`provenance.sourceHash` on every case built from that category. `reviewEntryId(caseId, sourceHash, entry)`
(`review.ts:4`) folds `sourceHash` into every differential/review-ledger id, and `publicEvaluation`'s
source-matching (`public-report.ts:15`) compares it directly. Editing even one family's fixture inside a
shared corpus file changed the *whole* corpus's hash, which reshuffled the disagreement id of every case in
every family sharing that file — including families the edit never touched — silently orphaning their
previously-resolved `benchmarks/review-ledger.json` rows. This is the mechanism the "pre-existing,
unrelated defect" section above traced to the 99a7681 mistral/cohere/deepgram twin-reclassification commit.

**Why whole-corpus hashing existed at all.** `qualify.ts`'s qualification report publishes one
`corpusHashes[categoryId]` fingerprint per category (`docs/specs/qualification/engine-v1.json`), and that
field legitimately needs a whole-file digest — it is category-level provenance, not case identity. The bug
was conflating that legitimate whole-corpus fingerprint with the case-level `sourceHash` that feeds
`reviewEntryId`, which the codebase's own established convention (`engine/model.ts`'s `variant()`:
`sourceHash: hash(c.seed)`, and every PII-domain case in `evaluation/domains/pii/cases.ts`) already scopes
to the specific seed fixture a case is actually about.

**After.** `cases.ts` now keeps `corpusHash = hash(corpus)` as a separate, category-level field on each
case's `provenance` (used only for `qualify.ts`'s `corpusHashes` map — the invariant it exists to protect is
unchanged), and sets `provenance.sourceHash` per case as `hash(c.seed)` — the fixture a `differential`,
`benign`, `metamorphic` or `mutation` case is seeded from, or the paired positive fixture for a `twin` case
(mirroring the same `hash(c.seed)` convention `engine/model.ts` already uses for generated variants). A
family's ledger identity now depends only on its own fixture(s), never on unrelated fixtures sharing the
same corpus file. `engine/types.ts`'s `CaseSeed.provenance` gained the optional `corpusHash` field;
`qualify.ts`'s `corpusHashes` map now reads `c.provenance.corpusHash` instead of `c.provenance.sourceHash`.
Cross-family interaction effects were considered and ruled out as a concern: every scanner runs one fixture
file at a time (`Scanner.scan(directory, fixtures)` normalizes per-file), so a case's actual dependency set
is exactly its own seed fixture (plus, for `twin`, the paired positive) — there is no batched-scan
interaction a whole-corpus hash could have been protecting.

**Migration.** Because `sourceHash`'s formula itself changed, every case's id changes once, for every
category, not only `detector-coverage` — an unavoidable, one-time consequence of fixing the scope, not a
new defect. `benchmarks/review-ledger.json`'s 23,962 entries were rekeyed by re-running the full
differential/twin/mutation queue against the same f26dee2 candidate and recomputing, for each entry, what
its legacy id would have been: for every category except `detector-coverage`, `c.provenance.corpusHash`
(computed against today's unchanged corpus content) equals the historical whole-corpus hash the ledger was
last keyed against (confirmed by diffing `hash(corpus)` at f00f215 against today's `hash(corpus)` for all 30
non-calibration categories — only `detector-coverage` differs); for `detector-coverage`, the legacy hash is
the corpus hash computed at f00f215 (immediately before 99a7681 edited three of its fixtures). 1,967 of
23,962 entries were rekeyed this way, preserving every entry's `status`/`note`/resolution history verbatim
under its new id (only the key changed, following the same "carry over by matching case content, not id"
practice as
[`2026-09-22-lift-five-families-out-of-un-probeable.md`](../../docs/decisions/2026-09-22-lift-five-families-out-of-un-probeable.md)'s
prior detector-coverage rekey); 21,995 keys were already correct and untouched. 52 current review-queue
entries had no legacy match at all — genuine new or changed disagreements (the mistral/cohere/deepgram
fixtures 99a7681 actually edited, and the brand-new per-family case ids `redact-secret#882`'s
anthropic/openai finding-type split created, which never existed under any id before), left as ordinary
unreviewed queue backlog rather than force-resolved.

### Corrected per-family result (candidate mode, f26dee2, fixed mechanism + rekeyed ledger)

| Family | Status | Tier | What actually blocks it now |
| --- | --- | --- | --- |
| `aws-bedrock-long-term-api-key` | **stable** (documented) | T1 | none — restored; `differential: 0` |
| `aws-bedrock-short-term-api-key` | **stable** (documented) | T1 | none — restored; `differential: 0` |
| `elevenlabs-api-key` | **stable** (documented) | T1 | none — restored; `differential: 0` |
| `tavily-api-key` | **stable** (empirical) | T2 | none — restored; `differential: 0` |
| `together-ai-api-key` | provisional | T2 | unchanged, genuine gap: corroboration 2 references / 2 owners / 1 non-summary class (needs 3/3/2); `differential: 0` |
| `mistral-api-key` | provisional | T2 | genuine remaining gaps: 1 corroboration class short of 2, `differential: 3` (real, unreviewed), `context-constrained-empirical` 1 fixture short. Benign false alarms are 0 (99a7681's fix held) |
| `cohere-api-key` | provisional | T2 | `differential: 3` (real, unreviewed), same `context-constrained-empirical` 1-short gap. Benign false alarms are 0 |
| `deepgram-api-key` | provisional | T2 | real, pre-existing gaps: 2 twin failures, 14 metamorphic critical failures, 4 unresolved critical mutations (documented `createClient(key)`/WebSocket-subprotocol misses), `differential: 6`, `context-constrained-empirical` 1 short |
| `ai21-api-key` | pending | T0 | unchanged: no provider or scanner shape |
| `anthropic-api01-key` | provisional | T1 | `differential: 19` — a genuine, never-before-triaged backlog: this exact per-family case id only started existing with #882's finding-type split, so no ledger row could have pre-dated it |
| `anthropic-admin01-key` | provisional | T1 | real, pre-existing findings independent of the split (1 benign false alarm, 7 metamorphic critical failures, 1 unresolved critical mutation) plus `differential: 17` (same never-before-triaged backlog as above) |
| `openai-admin-api-key` | provisional | T2 | far from every empirical/corroboration floor (0/0/0 references/owners/classes, 9 of 10 required positive cases, 10 of 14 required benign controls, no declared uncertainty/mode/supported-context) plus `differential: 16` (same never-before-triaged backlog). Splitting the finding type made it scorable; it did not give it evidence |
| `exa-api-key` | unscored (absent from `support-status.json`'s family list) | — | unchanged: no Exa detector exists |

Candidate mode: **64 stable of 86** scored families (39 documented + 25 empirical), matching the pre-#882
baseline of 65/83 exactly except `anthropic-token` (not one of the 13 families above), which the #882 split
already left `provisional` at f26dee2 *before* this fix (`differential: 12`, in the unfixed
`evidence/774/f26dee2/support-status.json`) — this fix improved it to `differential: 6` but did not clear
it; that remainder is the same never-before-triaged backlog pattern affecting the three newly-split
families, not a regression this fix introduced. No other previously-stable family changed status.

### Verification

Pinned trufflehog 3.97.4 / gitleaks 8.30.1 (provisioned by `npm run peers:provision`); candidate f26dee2
rebuilt from source in an isolated worktree (core/node-darwin-arm64/wasm SHA-256 unchanged from the original
f26dee2 measurement above, confirming an identical candidate). `npm run eval:candidate` (3,533/3,533
fixtures) → `npm run eval:classify --refresh-peer-snapshots` (required once: the `sourceHash` formula change
invalidates the `peer-observations/evaluation/suite-development/*.json` cache's input identity) →
`npm run eval:matrix`. Full outputs: [`f26dee2-fixed/candidate-evidence-v1.json`](f26dee2-fixed/candidate-evidence-v1.json),
[`f26dee2-fixed/support-status.json`](f26dee2-fixed/support-status.json),
[`f26dee2-fixed/support-matrix.json`](f26dee2-fixed/support-matrix.json) (run id
`1a798505-9fa9-43c9-a957-d2faa8da481e`).

Full repo verification (`redact-secret-benchmarks`, this fix's commit):

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm test` (790/792, incl. the browser-graph guard) | 2 known, pre-existing failures, neither introduced by this fix (confirmed by reproducing both against the unmodified branch tip before this fix): `pin-drift.test.mjs` "pin consistency check passes against the real, refreshed tree" fails on the pre-existing #150 performance-pin coupling (out of scope, untouched here); `peer-pins.test.mjs` "ordinary queue:check..." fails because the checked-in review queue still carries unreviewed backlog — reduced by this fix from 534 ids (documented pre-existing baseline, reproduced unchanged against branch tip 2b847a6) to 196 (all in families with documented real gaps above, plus a handful of other T2 arrival families' own pre-existing backlog) |
| `npm run fixtures:check` | pass |
| `npm run fixture-index:check` | pass (3,533 fixtures, unchanged digest) |
| `npm run arrival:check` | pass (90 families, 7 evidence kinds each) |
| `npm run profiles:check` | pass (90 families) |
| `npm run pins:manifest:check` | pass |
| `npm run queue:check` | fails: 196 ids without a ledger row (down from the pre-existing, documented 534; see above — not a regression, not resolved here, ordinary unreviewed backlog) |
| `npm run ledger:decisions:check` | pass |
| `npm run ledger:provenance:check` | pass (23,962 entries valid) |
| `npm run decisions:validate` | pass (0 errors) |

No performance evaluation was re-run (out of scope; see the REJECTED runs recorded above). No status or
ledger field was hand-edited; `benchmarks/review-ledger.json` was regenerated by the migration described
above and `peer-observations/evaluation/suite-development/{trufflehog,gitleaks}.json` were regenerated by
`--refresh-peer-snapshots`.
