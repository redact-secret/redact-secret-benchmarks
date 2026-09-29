# Evidence: published 0.1.0-beta.11 (release source 94fc18a) re-measured in published mode

**Result:** published mode (`@redact-secret/core` 0.1.0-beta.11 from npm) reads **88 stable of 110** registered
families (documented 63, empirical 25; 20 provisional, 2 pending), against the beta.10 published baseline of 61 stable.
The support matrix reads 105 stable, 20 provisional, 9 pending and 18 unsupported of 152 taxonomy families.
Classifying the three published npm tarballs as a candidate bound to `94fc18a` gives byte-identical `families`, and
every family status matches the `8b6a5fd` candidate classification ([`../8b6a5fd/README.md`](../8b6a5fd/README.md)).
This records a measurement. It makes no release claim.

Benchmarks issue: [redact-secret-benchmarks#511](https://github.com/redact-secret/redact-secret-benchmarks/issues/511)
(carried over from #447). The core site feed (`docs/contracts/site-feed/v1/feed.json`) consumes these files through
[redact-secret#956](https://github.com/redact-secret/redact-secret/issues/956).

## Files

| File | Mode | Run |
| --- | --- | --- |
| [`support-status-published.json`](support-status-published.json) | published npm package 0.1.0-beta.11 (`publishedPackage`, no `product`) | `8f2a836b-9267-4034-b3af-7658ac389617` |
| [`support-matrix-published.json`](support-matrix-published.json) | the matrix generated from that file | |
| [`support-status-release-artifacts.json`](support-status-release-artifacts.json) | the three published npm tarballs, classified as a candidate bound to `94fc18a` (`product.declaredVersion` 0.1.0-beta.11) | `596058a9-2843-4488-8b9d-05c4f545a795` |
| [`support-matrix-release-artifacts.json`](support-matrix-release-artifacts.json) | the matrix generated from that file. **This is the file for core's `benchmarks/support-matrix.json`.** | |

Why two modes: the core feed takes `measuredProductVersion` and `measuredProductRevision` from
`sourceReport.product`, and a published-mode report records only `publishedPackage`. Both matrices have the same
`families`, `distribution` and `stableDistribution`. The release-artifacts matrix also names the version and the
source commit. With it, core's `generate-site-feed.py` writes `measuredProductVersion` `0.1.0-beta.11` and
`measuredProductRevision` `94fc18a…`, and `--check` passes. `gatedLatestRelease` reads `false` because the beta.11
release manifest's `support_matrix_drift.candidate` names the `ec9ffbe` run.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` | `v0.1.0-beta.11` peels to `94fc18a974f659ea882c89120dbf1adb3acf2f28`. Detector source (`crates/secret-scan-core/src`) is identical to `8b6a5fd` |
| npm tarballs (`npm pack` from the registry; integrity matches `npm view … dist.integrity`) | core `3e70490584e529be5097fc8a9a3655cb57a3d2f31b58ef173bf614aab4134b05`, node-darwin-arm64 `db1f0574d7f15e1346ffe16550dc32a5a4f5b99e2a29f9a6bf94f792fc07dccb`, wasm `5d9cb24714b5af25e2411644328b1d64f5583f92107cd2f5b9d2fbbe462813f6` |
| `redact-secret-benchmarks` | `a30282d90f31a7a059cd1a0262e9f1b3ec8423b3` (branch `beta11/447-published-repin`, clean). The re-pin is `fa102e5` and the ledger triage is `a30282d` |
| Fixture index / taxonomy | `5919a676…` / `c6a52802…518c` |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`). Committed snapshots from refresh run `8e6aaff0-245b-4d77-8c60-d614f254cebd` were reused and validated |

## What moved since the beta.10 published reading

- **61 → 88 stable (published).** 0.1.0-beta.11 ships the detectors the `8b6a5fd` candidate measured, so the published
  and candidate readings now agree.
- **Ledger.** The #508 fixture floors (PR #510) had been triaged against published 0.1.0-beta.10 only. That package
  read the values as `generic-token` or `bearer-token`. 0.1.0-beta.11 attributes them to their dedicated detectors,
  which changes 46 differential ids. Every one was checked against the fixture's authored span on the canonical
  variant:
  - 28 are `redact-secret-only`: the exact authored span under the target family, and the peer reports nothing. These
    are resolved as `redact-secret-only/<peer>/range-matches-corpus`.
  - 18 are gitleaks `generic-token` on the same span. These are not-assertable as
    `decision=differential.peer-coarser-classification`.

  None is recorded open. Without these rows the 10 affected families read provisional: 78 stable in both modes.
- **Family evidence.** 13 families differ from the `8b6a5fd` file in `evidence`/`fixtureProfile`, and cohere also in
  `reasons`. These are the #508 fixtures. No status changes.

## Other outputs of this re-pin

- `baselines/0.1.0-beta.11.json`: `npm run bench -- --strict` at clean `a30282d`, run
  `2026-09-29T18:58:05.676Z-c7bc1a`. `docs/generated/release-comparison.md` compares beta.10 → beta.11: 106 changed
  (fixture, scanner) outcomes and 1,294 fixtures added.
- `docs/specs/qualification/engine-v1.json`: `eval:qualify` run `19510b39-7f45-4b92-840a-424d3ae10297` at clean
  `eb728c7`, execution-qualified.
- Performance: `benchmarks/performance-criteria.json` `verifiedCommit` is `94fc18a` on its ACCEPTED evaluation
  ([`../94fc18a-release/README.md`](../94fc18a-release/README.md)). The regression-budget baseline stays 0.1.0-beta.8.
  Promoting it is a separate snapshot + derive.

## Commands

At `a30282d`, clean:

```sh
npm ci && npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog --version -> 3.97.4
npm pack @redact-secret/core@0.1.0-beta.11 @redact-secret/node-darwin-arm64@0.1.0-beta.11 @redact-secret/wasm@0.1.0-beta.11
npm run eval:classify -- --output=<dir>/support-status-published.json
npm run eval:classify -- --candidate-package=redact-secret-core-0.1.0-beta.11.tgz \
  --candidate-node-package=redact-secret-node-darwin-arm64-0.1.0-beta.11.tgz \
  --candidate-wasm-package=redact-secret-wasm-0.1.0-beta.11.tgz \
  --candidate-source-commit=94fc18a974f659ea882c89120dbf1adb3acf2f28 --output=<dir>/support-status-release-artifacts.json
npm run eval:matrix -- --input=<dir>/support-status-<mode>.json --output=<dir>/support-matrix-<mode>.json
npm run queue:check
```
