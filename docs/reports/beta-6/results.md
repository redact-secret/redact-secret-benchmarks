# Beta.6 published-package results

Measurement of the published `@redact-secret/core@0.1.0-beta.6` against this
repository's fixture corpus. Recorded as measurement, not as a product claim
(`AGENTS.md` boundary rule). The generated
[release comparison](../../generated/release-comparison.md) holds the full group tables and the
row-level diff; this page records provenance and separates product change from
corpus change.

## Provenance

| Field | Value |
| --- | --- |
| Package | `@redact-secret/core` `0.1.0-beta.6`, resolved from `https://registry.npmjs.org` (`package-lock.json`): core `sha512-AhD2iN+dcr6DpFlIC6yetQSFGqIonOzNSWf4I0x0EIJ6UmC5+VEzrBkWZngnbZkR4WSbdcBcuoY8RR3oPDPv/Q==`, wasm `sha512-LHjcykEkM9k/vWrG85jqOtY8L+ZZpLsgD1rfbkRCLJaspfK1MlJ5mQOMM6YQ0gVzPftHr5W8ioH/N301EdJ5pQ==`, node-darwin-arm64 `sha512-hVZJPQ4isPoLxBpGrOnJcVpNiRRRZT649fs/9WGiJBkdOz8IEDMGVDbm3F6OP7bQToM01iWD8BFc54kac2jSaQ==` |
| Release commit | redact-secret `v0.1.0-beta.6` = `079095e766e4a71e2b7e29413ed17be37bb3315d`; `benchmarks/detectors.json` is repinned there. No change under `crates/secret-scan-core/src/detectors` since the previous pin `8838b91e`, so the 46-detector registry is unchanged |
| Peer scanners | gitleaks 8.30.1, trufflehog 3.97.4 (the pinned Homebrew keg, first on `PATH`), flare-redact 1.6.1 |
| Baseline saved | [`baselines/0.1.0-beta.6.json`](../../../baselines/0.1.0-beta.6.json), schema v2, 1,071 fixtures × 4 scanners |
| Run ID | `2026-09-22T16:21:44.673Z-9289e6`, revision `fb708afa9b3f1878e727473222e514e3ec5a563c` (clean), `npm run bench -- --strict`, 11 of 11 suites |

## Product change, isolated from corpus change

`release-comparison.md`'s beta.5 → beta.6 table compares against
`baselines/0.1.0-beta.5.json`, which was saved on an older corpus (827
fixtures). Its 94 changed rows mix corpus edits made since then with product
change: 71 of them belong to peer scanners whose versions did not move.

To isolate the product, the same revision's corpus was also run with
`0.1.0-beta.5` installed (run `2026-09-22T16:22:28.566Z-5df47e`, identical
corpus hashes, not checked in). On that fixed corpus, the peer scanners'
outcomes are identical and exactly **43 redact-secret rows** change, all
toward the corpus's authored expectation:

| Change | Rows | Fixtures |
| --- | ---: | --- |
| `MISS` → `EXACT` | 9 | `detector-coverage--openai-token-shape-{1,2,3}-{bare,quoted,unicode-crlf}` (policy/T3) |
| `MISS` → `EXACT` | 9 | `detector-coverage--terraform-cloud-token-{user,organization,team}-shape-*` |
| `MISS` → `EXACT` | 9 | `detector-coverage--pulumi-access-token-{personal,organization,team}-shape-*` |
| `MISS` → `EXACT` | 6 | `detector-coverage--supabase-management-token-{classic,versioned}-shape-*` |
| `MISS` → `EXACT` | 3 | `detector-coverage--firebase-server-key-server-key-*` |
| `MISS` → `EXACT` | 3 | `detector-coverage--generic-token-{api-key,password,client-secret}-markdown-inline-code-boundary` (policy/T3) |
| `flagged:1` → `clean` | 4 | `detector-coverage--{linear-token-oauth,slack-token-rotation}-{trailing,dash}-identifier-embedding` |

No row moves away from its expectation. Across the whole beta.6 baseline,
redact-secret has no leaked span in any scored must-redact or policy group and
no false alarm in any must-not-flag group; the 30 T0 rows are unscored.

## Known gaps

`benchmarks/known-gaps.json` is unchanged by this measurement. One observation
for the promotion lifecycle (`promote-finding`), not acted on here:
**product-405** (OpenAI token shapes 1–3, status `observed`) is `MISS` on all
nine fixtures under beta.5 and `EXACT` on all nine under beta.6. The fixtures
for product-404, 406, 407, 408 and both product-428 records were already
`EXACT` under beta.5 on the current corpus.

## Review ledger

Published-package differential review-queue ids hash the redact-secret tool
version (`benchmarks/engine/execution.ts`), so the bump re-keyed all 531 of
them. The two queues were dumped on the identical corpus under beta.5 and
beta.6: 488 new ids match a beta.5 row on every field except the version and
carry its ledger status and note unchanged. The remaining 43 are rows where
beta.6 now reports a span that beta.5 did not, all `redact-secret-only` against
a silent peer. Four (the `openai-token-legacy-*-twin` rows) reuse the identical
candidate-keyed ledger decision (`twin-boundary-family-reassignment`). The other 39
match the authored expected span byte-exactly and are resolved under the
established `redact-secret-only/<peer>/range-matches-corpus` class with its
existing note text. `npm run queue:check` passes.

`qualification/suite-v1.json` still names `0.1.0-beta.4` for redact-secret;
re-qualifying the suite is a separate decision, as it was at beta.5.
