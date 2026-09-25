# Evidence: redact-secret#817 — fixed-candidate rerun of its beta9-external-inputs fixtures

**Result:** PASS. On the fixed candidate `192c964` all 5 of this gap's
`beta9-external-inputs` fixtures report no finding (first run: flagged),
and none of the pack's 80 fixtures regressed from the first run.

Gap: [redact-secret#817](https://github.com/redact-secret/redact-secret/issues/817),
generic-token flags non-secret references and identifiers under credential names (HTML-escaped placeholder, quoted `$VAR`, `env.X`, string concatenation, AWS ARN). Known-gap record `product-817`, fixed by
[`840266c`](https://github.com/redact-secret/redact-secret/commit/840266c3d8c46c9f308740719c3b0d8e54b5f6ba).
This is the benchmark-side rerun that
[`decision-govern-benchmark-promotion`](../../docs/decisions/2026-09-18-govern-benchmark-promotion.md)
requires before `verified`. It keeps no fixture content and no matched value.

## Fixture outcomes

Scored with the pack's own `compareResult`, the rule `first-run.json` is read
with. `redacted` means every expected byte and nothing else; `clean` means no
finding.

| Fixture | Action | First run (0.1.0-beta.8) | Candidate `192c964` |
| --- | --- | --- | --- |
| `beta9-external-inputs--np-html-escaped-placeholder` | must-not-flag | flagged | clean |
| `beta9-external-inputs--np-echo-concatenated-reference` | must-not-flag | flagged | clean |
| `beta9-external-inputs--np-env-attribute-reference` | must-not-flag | flagged | clean |
| `beta9-external-inputs--np-java-getter-concatenation` | must-not-flag | flagged | clean |
| `beta9-external-inputs--np-iam-managed-policy-arn` | must-not-flag | flagged | clean |

Whole pack on the candidate: 73/80 meet their expectation
(first run 48/80), 25 fixed since the first run, 0 regressed. The
7 that still miss or flag belong to the `policy-decision` records
`product-822` to `product-825`.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `192c9649deb88e342abc8071fb78e7b1d84ec475`, clean, product `main` (contains every #831–#838 fix) |
| `redact-secret-benchmarks` | `43655c91a6d1d2af4f7fd6488533e89d75cdf39a`, clean, `develop`; lockfile SHA-256 `2fd997ca616a659b7801cf630bfde2441b2df106499df3cfc86b6aee016d568b` |
| Pack | `beta9-external-inputs`, expectations digest `25472f6cf07968d72a9f43eaf4ba63c1da1585644f99a05b65c964d1b21e1670`, `first-run.json` SHA-256 `67adb3d11dfa04460ed9ed7916c8578120807d77685d27355277481b5af9f3a0` |

## Scanner and artifacts

Candidate-only rerun (`redact-secret-candidate`, adapter version 2, default
detectors, Node v22.16.0 on darwin-arm64); no peer scanner is involved. Installed
from isolated npm tarballs built at the candidate commit by
`npm run benchmark:candidate`:

- core facade `0.1.0-beta.8` SHA-256: `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33`
- node darwin-arm64 SHA-256: `9cae94c11057a0a2754ff3909528b24818aeb35a4bbe3a5f9224ceeb3475d3d0`
- wasm SHA-256: `1f898601183b5f3204edc81386ea801c1815d11960c5740513fc941959ae5179`

Run `317057bd-2c14-4e6a-a735-71b3f6e27b47`, 2026-09-25T23:06:15Z to 2026-09-25T23:06:16Z, status `complete`.
Raw ranges and outcomes:
[`adversarial/packs/beta9-external-inputs/reruns/192c964-43655c9.json`](../../adversarial/packs/beta9-external-inputs/reruns/192c964-43655c9.json).

The same tarballs also ran the full measurement-v4 candidate suite at the
same benchmark commit (run `0c64f27d-6a48-4027-8cfd-aa2ecef9ef18`, scope
`full-suite`, corpus hash `c30b888f…`, configuration hash `c1af1eee…`,
`eval:validate` passed): every must-not-flag and must-redact outcome equals
the published 0.1.0-beta.8 baseline, with 0 required-positive misses in
both the fixed (150) and expanded (2,840) corpus.

## Product conformance

The canonical regression fixtures of product manifest record
`benchmark-gap-817` pass in
[Artifact qualification run 36197068993](https://github.com/redact-secret/redact-secret/actions/runs/36197068993) at the same commit
`192c964`: Rust native host (ubuntu, macOS, Windows), the N-API addon, browser
WebAssembly (Chromium, Firefox, WebKit), the CLI, and the Python wheel.

## Command

From a clean `redact-secret` checkout at `192c9649deb88e342abc8071fb78e7b1d84ec475`:

```sh
npm run benchmark:candidate -- --benchmark-ref 43655c91a6d1d2af4f7fd6488533e89d75cdf39a \
  --benchmark-repo <redact-secret-benchmarks> --output-dir <out>
```

Then, from `redact-secret-benchmarks` at `43655c91a6d1d2af4f7fd6488533e89d75cdf39a`:

```sh
npm run adversarial:rerun -- --pack=beta9-external-inputs \
  --candidate-package=<out>/artifacts/redact-secret-core-0.1.0-beta.8.tgz \
  --candidate-node-package=<out>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz \
  --candidate-wasm-package=<out>/artifacts/redact-secret-wasm-0.1.0-beta.8.tgz \
  --candidate-source-commit=192c9649deb88e342abc8071fb78e7b1d84ec475 \
  --product-state=clean --out=<rerun.json>
```
