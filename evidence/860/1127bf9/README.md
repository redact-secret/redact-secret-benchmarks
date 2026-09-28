# Evidence: redact-secret#860 families graduated at product main 1127bf9

**Result:** candidate mode (product `1127bf9`) reads 86 stable of 110 families (documented 61, empirical 25; 22
provisional, 2 pending). 22 of the 24 #860 families are documented-stable; `inngest-signing-key` and `resend-api-key`
stay provisional on generic-token warnings over handoff-listed placeholders (redact-secret#949). Of the 86 families
that existed before, 64 are stable (published: 61): `heroku-api-key-legacy`, `stripe-token` and `twilio-auth-token`
move to stable with the #933/#934/#941 fixes. Published mode (`@redact-secret/core` 0.1.0-beta.10) reads 61 stable of
110 (documented 38, empirical 23; 47 provisional, 2 pending); the 24 new families are all provisional there, because
the release predates their detectors. Nothing here is a release claim.

Benchmark side of [redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860) Tier A
([#903](https://github.com/redact-secret/redact-secret/issues/903)–[#909](https://github.com/redact-secret/redact-secret/issues/909))
and Tier B ([#912](https://github.com/redact-secret/redact-secret/issues/912)–[#917](https://github.com/redact-secret/redact-secret/issues/917)),
graduation step of [redact-secret-benchmarks#434](https://github.com/redact-secret/redact-secret-benchmarks/issues/434) and
[#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436) (parent #376). Earlier measurements:
[`../README.md`](../README.md) (Tier A at `feb7aea`) and [`../436/README.md`](../436/README.md) (Tier B at `2a27c76`).
No matched plaintext or example credential is retained here.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `1127bf91323797be89b4413c8051f9a9a85da43b` (main: PR #938 merged as `ea5c7bd`, then PR #947), clean |
| `redact-secret-benchmarks` | `0495c5bf54e4b4bbc9040d91c78a6254efc4db6d` (branch `beta11/376-batch-3`, the graduation commit), clean; lockfile `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Published product | `@redact-secret/core` 0.1.0-beta.10 (the benchmark lockfile's version) |

Candidate artifacts (product `npm run benchmark:candidate`, declared version 0.1.0-beta.10): core
`4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1`, node darwin-arm64
`c708e195427fdd8685acb033ddc333a55c41af090ed7ba7db83a5a712948a897`, wasm
`e62e3f26931e0e0c1ae17e4d10586417f7a378380ad705f0ecae4a4715e1201f` (the core hash reproduced across two builds; the
node addon did not, as before). Candidate run `8235fa6d-feb9-477c-b54b-d2c8c4ff5c64`: complete, full suite, 4,768
fixtures, corpus hash `a89a8d117ef2e3b80fb2a7e6b612fc5c464030bfc4d9cd05c52204aba8706d75`
([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`). Fixture index digest
`e893fa62ccdf42d447218cdde2c178084d7163dfea6b51caa4dc5fd32b69220c`, taxonomy digest
`86380e3596b4aa7ffc79a2c0d95fbae846c87101b5cde5ccb2712529becd60dc`, fixture profiles v1, criteria schema v1.

Classification runs at `0495c5b` (clean): candidate `5187b87b-cba8-44b3-a90e-aecb81a9b3c5`
([`support-status-candidate.json`](support-status-candidate.json)), published `6f752e23-cb30-4b13-a061-88889cdd6c4e`
([`support-status-published.json`](support-status-published.json)).

Pinned scanners: trufflehog 3.97.4 and gitleaks 8.30.1 (`npm run peers:provision`, checksum-verified read-only
`.peer-bin` first on `PATH`; the machine's Homebrew trufflehog self-updated past the pin and was not used). Peer
observations are the validated snapshots committed at `0495c5b`.

## What graduated

`benchmarks/detectors.json` moves from `f26dee2` to `1127bf9` (79 → 92 detectors). The thirteen detector-id families
(`doppler-token`, `trigger-dev-token`, `e2b-api-key`, `posthog-token`, `helicone-api-key`, `firecrawl-api-key`,
`composio-api-key`, `convex-deployment-key`, `onepassword-service-account-token`, `inngest-signing-key`,
`resend-api-key`, `apify-api-token`, `wandb-api-key`) become registry families with their authored contracts in
`registryContracts`; the eleven sibling types stay arrival families scored by their product finding type
(`scanners/families.mjs` `arrivalFindingTypes`, from redact-secret `docs/reference/detection.md`). Peer mappings deferred
by #436 are added: gitleaks `1password-service-account-token`, trufflehog `Apify` and `WeightsAndBiases`. Layout:
[`docs/specs/beta8-evidence.md`](../../../docs/specs/beta8-evidence.md) ("Graduation at the 1127bf9 re-pin").

## Per-family status (the 24 #860 families)

| Family | Kind | Published 0.1.0-beta.10 | Candidate 1127bf9 |
| --- | --- | --- | --- |
| `doppler-token` | registry | provisional | stable (documented) |
| `doppler-personal-token`, `-cli-token`, `-service-account-token`, `-service-account-identity-token`, `-scim-token`, `-audit-token` | scored arrival (finding type) | provisional | stable (documented), each |
| `trigger-dev-token` | registry | provisional | stable (documented) |
| `trigger-dev-personal-access-token` | scored arrival | provisional | stable (documented) |
| `e2b-api-key` | registry | provisional | stable (documented) |
| `posthog-token` | registry | provisional | stable (documented) |
| `posthog-project-secret-api-key` | scored arrival | provisional | stable (documented) |
| `helicone-api-key` | registry | provisional | stable (documented) |
| `helicone-write-api-key` | scored arrival | provisional | stable (documented) |
| `firecrawl-api-key` | registry | provisional | stable (documented) |
| `composio-api-key` | registry | provisional | stable (documented) |
| `composio-org-api-key`, `composio-user-api-key` | scored arrival | provisional | stable (documented), each |
| `convex-deployment-key` | registry | provisional | stable (documented) |
| `onepassword-service-account-token` | registry | provisional | stable (documented) |
| `inngest-signing-key` | registry | provisional | provisional: 1 benign false alarm, 7 metamorphic critical failures, 1 unresolved critical mutation, 1 unresolved differential |
| `resend-api-key` | registry | provisional | provisional: 2 benign false alarms, 14 metamorphic critical failures, 2 unresolved critical mutations, 3 unresolved differentials |
| `apify-api-token` | registry | provisional | stable (documented) |
| `wandb-api-key` | registry | provisional | stable (documented) |

The two provisional families are held by one product behaviour: `generic-token` reports a medium, warn-only
`contextual_secret` on the handoff-listed placeholders `signingKey: "signkey-test-<digits>"`,
`RESEND_API_KEY=re_<digits>` and `resend.api_key = "re_your<word>"` (redact-secret#949, known gap `product-949`,
observed). The Inngest Bearer placeholder that 0.1.0-beta.10 flagged is silent at `1127bf9` (#918), and the three Convex
placeholders `2a27c76` flagged are silent too (#919).

## The 86 existing families

Published 61 stable, candidate 64 stable; no family loses status. `heroku-api-key-legacy` (empirical), `stripe-token`
(documented) and `twilio-auth-token` (empirical) become stable in candidate mode. The #379 families at `1127bf9`:

| Family | Published | Candidate | Candidate blocker |
| --- | --- | --- | --- |
| `new-relic-license-key`, `aws-bedrock-long-term-api-key`, `github-token` | stable | stable | — |
| `heroku-api-key-legacy`, `twilio-auth-token`, `stripe-token` | provisional | stable | — |
| `mailchimp-api-key` | provisional | provisional | 4 unresolved differentials (the #931 positives are EXACT now) |
| `confluent-cloud-api-secret-legacy` | provisional | provisional | 4 unresolved differentials |
| `deepgram-api-key` | provisional | provisional | 2 twin failures, 14 metamorphic, 4 mutation, 8 differential |
| `cohere-api-key` | provisional | provisional | 7 metamorphic, 1 mutation, 4 differential |
| `anthropic-admin01-key` | provisional | provisional | 1 benign false alarm, 7 metamorphic, 1 mutation, 17 differential |
| `anthropic-api01-key` | provisional | provisional | 19 differential |
| `together-ai-api-key`, `openai-admin-api-key` | provisional | provisional | empirical corroboration floors (T2) |
| `connection-string` | provisional | provisional | policy protected holdout not run |

Fixed-candidate outcomes for the #379 known gaps (candidate run above): product-931 (Mailchimp, 3 fixtures), product-933
(Heroku, Confluent, Twilio previous-line context, 3), product-934 (repeated-filler placeholders, 2) and product-935
(`postgresql+psycopg`, 1) are all resolved at `1127bf9`; product-932 resolves 3 of 4 (the LiteLLM `masked_` Cohere line
stays unreported, which the product records as policy on #932). The records move to `reviewed`; `promoted` needs product
provenance-manifest records (`conformance/benchmark-regressions.json`) that `1127bf9` does not carry, so `fixed` and
`verified` are not recorded.

## Review ledger

The graduation changes the beta8-434/436 fixture objects (`detectors` instead of `arrivalTargets`), which re-keys their
rows: 1,097 rows (773 not-assertable, 324 open) are carried to their new ids by structural identity, and 8 rows that the
new peer mappings superseded are dropped. The open #434/#436 differential rows are then re-triaged with real bases:

- Published-mode rows (650): 247 twin co-detection, 199 `redact-secret-only/<peer>/range-matches-corpus`, 69
  `classification-disagreement/<peer>/published-predates-detector` (the published release labels the authored span
  generic, the peer and candidate `1127bf9` label it with the family), 34 `peer-only/<peer>/range-matches-corpus`, 4
  twin co-detection on range or classification disagreements, 3 `peer-narrower-boundary` resolved; 86
  `differential-coverage-gap/<family>/<peer>` rows stay open per the boundary rule (0.1.0-beta.10 predates the detector
  and `1127bf9` reports the authored span with the family), plus 2 `differential-boundary-unconfirmed/convex-deployment-key`
  (the published release reports part of the Convex key; `1127bf9` reports the authored span) and 6
  `benign-false-alarm-unconfirmed` (the Inngest and Resend placeholders; `1127bf9` no longer flags the Inngest Bearer one).
- Candidate-mode rows (662, raised by `1127bf9` output): 432 `redact-secret-only/<peer>/range-matches-corpus`, 214
  `decision=differential.peer-coarser-classification` (the candidate labels the authored span with the family, the peer
  with a coarser one), 8 twin co-detection, 4 `peer-narrower-boundary`, 2 `peer-only` resolved; 2 stay open
  (`real-world-shapes--pytest-fake-fixtures`, the #911 residual span, known gap product-911).
- 175 new detector-coverage mutation rows use the decided operator classes.

## Pin status

`npm run pins:check` fails until the pinned core revision has an ACCEPTED performance evaluation (#150,
`2026-09-23-decouple-pin-freshness-from-pin-consistency`). `performance-evaluation.yml` at `1127bf9` (run
[36463844435](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36463844435)) is REJECTED against
the 0.1.0-beta.8 budgets: processing p95 ratios 1.13–1.42 on every surface and `size/wasm` gzip common 120,676 bytes
(budget baseline 100,058), full 176,383 (137,639). `benchmarks/performance-criteria.json` is therefore not advanced; the
tradeoff is a maintainer decision.

## Commands

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog 3.97.4, gitleaks 8.30.1
# product worktree at 1127bf9 (clean)
npm run benchmark:candidate -- --benchmark-ref 0495c5bf54e4b4bbc9040d91c78a6254efc4db6d \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at 0495c5b (clean)
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=1127bf91323797be89b4413c8051f9a9a85da43b --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
```
