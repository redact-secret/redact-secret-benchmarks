# Beta.10 credential fixture-debt final measurement

Research context: [#367](https://github.com/redact-secret/redact-secret-benchmarks/issues/367). Execution issues: [#369](https://github.com/redact-secret/redact-secret-benchmarks/issues/369), [#370](https://github.com/redact-secret/redact-secret-benchmarks/issues/370), [#371](https://github.com/redact-secret/redact-secret-benchmarks/issues/371), [#372](https://github.com/redact-secret/redact-secret-benchmarks/issues/372), [#373](https://github.com/redact-secret/redact-secret-benchmarks/issues/373), and product [#858](https://github.com/redact-secret/redact-secret/issues/858). Product #857 and benchmark #365 are outside this work.

## Revisions and toolchain

- Frozen benchmark baseline: `4366b6a5ed03ac3633d9ae86063d23fce2169edb`; baseline record commit: `626c05cf0d2d4f1ee63467a446bd54f19c9451e4`.
- Frozen product baseline: `266204c87126a9de2c0ff28e7913bccabebd1d98`.
- Final measured pair: product `f5f91cbe1d3250dc99e32332477915e0e45a94cf`; benchmark `5b40436e9de00dddcf6c17c87d4f4e0e206244a2`.
- Published comparison package: `@redact-secret/core` `0.1.0-beta.9`.
- Peer scanners: Gitleaks `8.30.1`; TruffleHog `3.97.4` from the official Darwin arm64 release, placed read-only first on `PATH` after checksum verification.
- Fixture semantic index: 2,990 fixtures / `1e95492f1f0f3d1d6d1cb504b047e4ea910155885f72115d8e15a03b804135a7` before; 2,996 fixtures / `66d1dc47f829368e992a23af94e265e1ce5c683540309c89725d16ec7f715801` after.
- Candidate core artifact SHA-256: `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664`.

## Before and after

Cells are total / non-twin positives / benign controls / twins / positive axes / control axes / confusion axes.

| Family | Baseline cells | Final cells | Debt result | Final support result |
| --- | --- | --- | --- | --- |
| Slack user | 24 / 3 / 11 / 5 / 8 / 6 / 9 | 27 / 6 / 11 / 5 / 9 / 6 / 9 | positive 3/6 cleared | Provisional, formerly Stable: profile debt cleared, but 9 open critical mutation reviews and 3 open peer contract disagreements now block qualification. |
| Slack app-level | 24 / 5 / 9 / 5 / 10 / 5 / 8 | 25 / 6 / 9 / 5 / 10 / 5 / 8 | positive 5/6 cleared | Provisional: T2 corroboration/uncertainty/context requirements remain; 3 open critical mutation reviews and 1 open peer contract disagreement are also visible. |
| GitHub fine-grained PAT | 24 / 5 / 9 / 5 / 10 / 6 / 9 | 25 / 6 / 9 / 5 / 11 / 6 / 9 | positive 5/6 cleared | Provisional: T2 corroboration/uncertainty/context requirements remain; 5 open critical mutation reviews and 3 open peer contract disagreements are also visible. |
| Stripe webhook signing secret | 25 / 5 / 10 / 5 / 9 / 6 / 10 | 26 / 6 / 10 / 5 / 9 / 6 / 10 | positive 5/6 cleared | Provisional, formerly Stable: profile debt cleared, but 2 open peer contract disagreements now block qualification. |
| Vercel | Aggregate 20 / 15 / 5 / 0 / 1 / 3 / 3 | Aggregate unchanged; five modern families unmeasured | Aggregate debt unchanged; no debt transferred | Aggregate remains Pending/T0. `vcp`, `vci`, `vca`, `vcr`, and `vck` are separate Pending/T0 taxonomy rows with no detector, positive fixture, profile, or accuracy claim. |

The Stripe screenshot's 30 fixtures and the baseline profile's 25 remain consistent: 30 is the taxonomy-family view, while 25 was the detector-targeted profile; five shared `stripe-token` detector-coverage fixtures account for the difference. The new detector-targeted fixture makes the final profile 26, not 31.

## Independent evidence added

- Slack user: three non-twin positives cover a Python SCIM administration client, a curl form-body token, and a Bolt installation-store `user_token`. The wrappers differ by SDK configuration, HTTP form transport, and persisted installation data; only the installation-store context adds the new `structured-file` profile axis.
- Slack app-level: one non-twin Bolt JavaScript `App` constructor using `appToken` and Socket Mode. It is a runtime constructor path, not a duplicate of the existing Python handler, CLI, header, or environment wrappers.
- GitHub fine-grained PAT: one non-twin `git credential fill` output. It adds the `tool-output` axis and keeps the exact current T2 93-byte shape distinct from classic PAT and GitHub App credentials.
- Stripe webhook: one non-twin v2 event-destination creation response with nested `webhook_endpoint.signing_secret`. It is a different API lifecycle/object path from the existing endpoint-create response and keeps the public `ed_test_` identifier outside the secret span.
- Vercel: no positive fixtures were manufactured. Product #858 establishes semantic class/marker evidence only, which is insufficient for complete body or boundary grammar.

All six new positives are deterministic synthetic values, have no `twinOf`, and measured `EXACT` with one finding each, zero leaked bytes, and zero collateral bytes under both the published package and the measured candidate. Across the complete target-family candidate rows, Slack user was 11 exact / 16 clean, Slack app-level 11 exact / 14 clean, GitHub fine-grained PAT 11 exact / 14 clean, and Stripe 11 exact spans / 15 clean. There were no target-family exact-span misses, leaks, over-redaction, or false alarms. Vercel's 15 aggregate observations remain T0 and its five controls remain clean; those observations are not positive evidence.

## Vercel bounded decision

- `vercel:personal-access-token`: `vcp_` marker provider-backed; complete body/boundary unresolved. The REST response's unprefixed 24-character `bearerToken` beside metadata `prefix: vcp_` remains unresolved and is not labeled legacy, current, or stale.
- `vercel:integration-token`: only the `vci` stem is provider-backed; the underscore, body, and boundary remain unresolved.
- `vercel:app-access-token`: `vca_` marker provider-backed; one opaque example does not establish a grammar.
- `vercel:app-refresh-token`: `vcr_` marker provider-backed; reused opaque example data does not establish a grammar.
- `vercel:api-key`: `vck_` marker provider-backed; complete body/boundary unresolved.

The existing `vercel:access-token`/`vercel-token` row is retained as compatibility history only. Evidence needed to unblock a positive contract is a reviewed provider statement or sufficiently independent corroboration establishing each class's complete body and boundary rules, plus resolution of the unprefixed REST example. No T1 promotion or universal coverage is claimed.

## Review lifecycle

Refreshing the pinned peer observations after the semantic-index change re-keyed 154 existing review entries whose case, variant, fixture/content hashes, observations, classifications, and peer identities were byte-for-byte equivalent; their existing decisions were carried forward without deleting history. Thirty-three new qualification/full-evaluation occurrences introduced by the six fixtures were recorded `open`. No expectation was changed, no finding was auto-resolved, and no product rule was loosened.

## Verification

- `npm run build`, `npm run fixture-index:check`, `npm run profiles:check`, `npm run decisions:validate`, `npm run support:check:ui`, and `npm run arrival:check`: passed.
- `PATH=<trufflehog-3.97.4>:$PATH npm run peers:snapshots:refresh`: passed; 25/25 suites, then published-mode classification completed.
- `npm test`: 753/753 passed.
- `npm run queue:check`, `npm run ledger:provenance:check`, and `npm run ledger:decisions:check`: passed; 22,909 ledger entries, including the carried and open records above.
- `PATH=<trufflehog-3.97.4>:$PATH npm run compare`: passed, including fixture checks, unit tests, integration tests, and strict four-scanner benchmark execution.
- `PATH=<trufflehog-3.97.4>:$PATH npm run eval:classify`: passed in published mode; 61 Stable, 12 Provisional, 1 Pending across 74 detector families. Stable basis: 37 documented, 24 empirical.
- `PATH=<trufflehog-3.97.4>:$PATH npm run eval:matrix`: passed; 78 Stable, 12 Provisional, 6 Pending, 17 Unsupported across 113 taxonomy families.
- Product `npm run ci`: passed on `f5f91cbe1d3250dc99e32332477915e0e45a94cf`.
- Product `npm run benchmark:candidate -- --benchmark-ref 5b40436e9de00dddcf6c17c87d4f4e0e206244a2 --benchmark-repo <local-benchmark>`: complete and evidence validated. Fixed corpus: 150 rows, 0 required-positive misses after, 0 policy misses, 2 negative flags after. Expanded corpus: 2,846 rows, 0 required-positive misses after, 0 policy misses, 101 negative flags after. The negative-flag delta belongs to the broader product-main candidate versus beta.9, not to the documentation-only #858 change; no status in this report is promoted from that aggregate.

No package was published, no release or deployment was performed, and the PRs are not to be merged as part of this session.
