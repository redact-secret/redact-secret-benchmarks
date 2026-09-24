# Beta.7 published-package results

Measurement of the published `@redact-secret/core@0.1.0-beta.7` against this
repository's fixture corpus, taken for #200. Recorded as measurement, not as a
product claim (`AGENTS.md` boundary rule). The generated
[release comparison](../../generated/release-comparison.md) holds the full group
tables and the row-level diff.

## Provenance

| Field | Value |
| --- | --- |
| Package | `@redact-secret/core` `0.1.0-beta.7` from `https://registry.npmjs.org` (`package-lock.json`): core `sha512-3qjqKpmj8APbD+5sYJp7vtZQFBz1ctlPSHsWuZryC40vThEpkfj5MnagxxpIzMC5v+vCase0FK0H7zDxiA17yQ==`, wasm `sha512-dgTi+xGTc2kvwBpTmZkiGZFitwGxr0sQv656+Yqh5sZZ0qR/QtqqfFEc91rESjf5ojmxjWfArVqKN891hhyurQ==`, node-darwin-arm64 `sha512-q5r31KQNZIjLjKDTshFCUsp8QF5KoSuw/ATqXcYqDVVv9QJeooan/P9Awal6I8sM2zDdAiP8eYOwb8I70eYKHg==` |
| Release commit | npm `gitHead` = `2b98027bbf38d63f07b75129fe2864ef32ed4732` (no `v0.1.0-beta.7` git tag existed when this was recorded); `benchmarks/detectors.json` is repinned there. The only file changed under `crates/secret-scan-core/src/detectors` since the previous pin `fdca511d` is `heroku.rs` (redact-secret#714); the 57-detector registry is unchanged |
| Peer scanners | gitleaks 8.30.1, trufflehog 3.97.4 (the pinned Homebrew keg, first on `PATH`), flare-redact 1.6.1 |
| Baseline saved | [`baselines/0.1.0-beta.7.json`](../../../baselines/0.1.0-beta.7.json), 1,466 fixtures × 4 scanners |
| Run ID | `2026-09-24T11:27:52.885Z-43bb90`, `npm run bench -- --strict`, 11 of 11 suites, mode: published (`Published npm package · default detectors`) |

## Reading against the #200 target

Local `npm run bench -- --strict` → `npm run eval` → `npm run eval:publish`,
read from `public/results/summary.json`.

| Target | beta.6 (production, per #200) | beta.7 published |
| --- | --- | --- |
| T1 leaked spans | 24 / 306 (11.4% bound) | 0 / 306 (1.2% bound) |
| T2 leaked spans | 33 / 89 (47.5% bound) | 0 / 89 (4.1% bound) |
| Twin probe | families at 0 of N | 398 of 398 pairs discriminated (T1 270/270, T2 54/54, T3 74/74) |
| must-not-flag | — | 0 flagged files: T1 0/6, T2 0/545, T3 0/291 |

## Review ledger

Review-queue ids no longer hash the product version (#173), so the bump re-keyed
none of the 2,595 rows that persist. 33 rows are new: differential rows for
discord-bot-token, databricks-personal-access-token,
confluent-cloud-api-secret-legacy and okta-api-token, where beta.6 reported no
finding and beta.7 does. Each matches the authored expected span byte-exactly
against a silent peer, and is resolved as `redact-secret-only/<peer>/range-matches-corpus`.
63 earlier `differential-coverage-gap` rows for families beta.7 now detects no
longer occur in the queue; their ledger entries are left in place as history.

## Stable count

`eval:classify` in published mode with trufflehog 3.97.4: 34 stable, 21
provisional, 2 pending, 0 unsupported of 57 families. `eval:matrix`: 51 stable,
21 provisional, 2 pending, 19 unsupported of 93 taxonomy families.

### Beta.8 profile re-evaluation for #177

Re-evaluated on 2026-09-24 in **published mode** against the same beta.7
package, with the required pinned peers (Gitleaks 8.30.1 and TruffleHog
3.97.4), after applying the documented and empirical fixture profiles. The
classifier measured 0 stable (0 documented, 0 empirical), 55 provisional and
2 pending detector families. The taxonomy matrix measured 0 stable (0
documented, 0 empirical), 72 provisional, 2 pending and 19 unsupported
families.

This is a measurement of the stricter profile, not a product-output assertion.
No T2 family has committed provider-issued observation metadata yet, so none
can clear the empirical profile. Existing fixture-cell debt also remains
visible in each result's reasons; the re-evaluation does not silently preserve
the earlier T1-only stable labels. This is the beta.8 input that must precede
#213's 15-family portfolio selection.

## Open

`benchmarks/performance-criteria.json` `baseline.sourceCommit` is still
`fdca511d`, so `pins:check` and `tests/pin-drift.test.mjs` fail on the #150
coupling until the performance evaluation is re-run at `2b98027`.
