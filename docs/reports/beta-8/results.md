# Beta.8 published-package results

Measurement of the published `@redact-secret/core@0.1.0-beta.8` against this
repository's fixture corpus. This records measurement, not a product claim
(`AGENTS.md` boundary rule). The generated
[release comparison](../../generated/release-comparison.md) contains the full
group tables and row-level diff.

## Provenance

| Field | Value |
| --- | --- |
| Package | `@redact-secret/core` `0.1.0-beta.8` from `https://registry.npmjs.org` (`package-lock.json`): core `sha512-vM1f1U6/mvMiqLoG1j6vaSE3dvr2neWI32+nCWDsOnLvyrssHEEfkEarp5htTZ+SgMoUicuo3cMMBM8ed+lRuA==`, wasm `sha512-h4a3UV0upmJuTqP6Ungu6p89hfmEh31qa+6wKKcYKIA0PFWAaety7IX0yg4TgAMaBrYFz8CDggAUb3OR2O47cw==`, node-darwin-arm64 `sha512-f7tPThtBfKvinQUV9HbYb+SqPalir2Uc1vcw5nQnFGkengPEIzXrqql4gPyByHKfXnJt6AmUkU+WOj6I8/sjaA==` |
| Release identity | Annotated tag `v0.1.0-beta.8` points to `5639a0ea02e0eefbd1533bea23a05c749b529bef`; npm metadata does not expose `gitHead`. The detector registry remains pinned to the already measured candidate `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`, because no file under `crates/secret-scan-core/src/detectors` changed between that commit and the release tag |
| Peer scanners | gitleaks 8.30.1, trufflehog 3.97.4 from the checksum-pinned read-only peer directory, flare-redact 1.6.1 |
| Baseline saved | [`baselines/0.1.0-beta.8.json`](../../../baselines/0.1.0-beta.8.json), 2,990 fixtures × 4 scanners |
| Run ID | `2026-09-25T11:31:19.010Z-8cee5a`, `npm run bench -- --strict`, 25 of 25 suites, mode: published (`Published npm package · default detectors`) |

## Published-mode observations

The released package recorded zero leaked spans in all scored redact-secret
groups: T1 0/500, T2 0/403, and policy T3 0/350. It flagged zero authored
must-not-flag files: T1 0/9, T2 0/1,030, and T3 0/663. It discriminated all
686 authored twin pairs (T1 317/317, T2 186/186, policy T3 183/183).

With TruffleHog 3.97.4, `eval:classify` in **published mode** recorded 66
stable, 7 provisional, 1 pending, and 0 unsupported of 74 registered families;
the stable profiles split into 40 documented and 26 empirical families.
`eval:matrix` recorded 83 stable, 7 provisional, 1 pending, and 17 unsupported
of 108 taxonomy families.

## Comparison with beta.7

The generated comparison records 71 changed `(fixture, scanner)` rows, 1,524
fixtures added, and none removed. Because the corpus changed substantially,
that row diff is descriptive only; it must not be interpreted as a package-only
causal comparison.
