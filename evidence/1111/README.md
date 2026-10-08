# Baseten independent arrival measurement, core #1111 / benchmarks #829

The full/native candidate detected all 6 authored positive spans exactly, left all 14 structural twins and 8 benign siblings clean, and reproduced the same findings twice. This is focused development evidence, not stable-support qualification.

## Scope and source evidence

The independently authored [generator](../../fixtures/generated/baseten-arrival.mjs) takes its grammar only from [Baseten's own API-key documentation](https://docs.baseten.co/organization/api-keys.md), retrieved 2026-10-08: `b10_` + exactly 8 alphanumerics + `.` + exactly 32 alphanumerics. Its T1 positives and structural twins are distinct from T3 authored benign controls. Every value is built at runtime from a public never-issued seed; no provider example, issued credential, product detector implementation or scanner result is an authoring input.

The 6 positive contexts share one synthetic value. The 14 twins mutate one property: identifier/body length, identifier/body alphabet, separator, or prefix. The 8 independent controls include an identifier, prefix, unprefixed synthetic sibling, placeholder, mask, reference, guidance and benign name. The unprefixed sibling is not an observed old key. Keys created before **2026-10-01 15:00 GMT** have no documented grammar and remain a stated false negative.

## Immutable inputs and result

- Product source: [502eaab6771529130b7f9ca2ac77cd7203ff55ba](https://github.com/redact-secret/redact-secret/commit/502eaab6771529130b7f9ca2ac77cd7203ff55ba), clean detached checkout. Only JavaScript was compiled locally; the existing [successful qualification run 37789349223](https://github.com/redact-secret/redact-secret/actions/runs/37789349223) supplied native and WASM binaries.
- Benchmark corpus/scorer source: [83748e8a8a233661ff87b32549c6ed5b4d1c12e3](https://github.com/redact-secret/redact-secret-benchmarks/commit/83748e8a8a233661ff87b32549c6ed5b4d1c12e3), clean during measurement. The shared measurement-v4 lattice and v1.1 accounting are used; this standalone contract does not change the accepted qualification registry.
- Scanner: locally packed `@redact-secret/core` **0.1.0-beta.14**, unpublished candidate at the product SHA above, **full profile / native addon / PII off**, Node **v22.16.0**, darwin-arm64. Version alone is not its identity; [the report](baseten-arrival.json) records all three package SHA-256s and the native binary hash. The native manifest's embedded source revision is **null**; exact source binding comes from the retained [qualification inventory](qualification-inventory.json) and matching binary hashes.
- All **17 shipped input files** (one native binary and sixteen full/common WASM files) match the qualification inventory before scanning. Supplying and hashing WASM packages does not measure a WASM backend. No common-profile, browser or peer-scanner comparison was run.
- Pinned `trufflehog 3.97.4` was checked before measurement, but TruffleHog did not produce findings. No stable count or support promotion is claimed; accepted pins, authority and support status remain unchanged.
- Report SHA-256: `11e237cbc7da86844b9806cac9c49914d5fa8a5160054f8fb84490a5b35d4482`. Corpus SHA-256: `3e2f4aeb46ec1f9f01a7b2be52abf25bb067150cb5181a872160994312733c08`. Inventory SHA-256: `1de320cae44ff8c28b9bb6786b226381a007515fda08522c3a50a37aed2d744d`. The report has counts/ranges only and `supportClaims: false`.

Observed groups stay separate: T1 must-redact **6 EXACT / 6 spans**, T1 twins **0 flagged / 14 files**, T3 benign controls **0 flagged / 8 files**. There were no leaked or collateral bytes. These small project-maintained structural cases do not establish real-world performance or whole-suite support. Registering the T1 contract in the active policy and changing support status requires a separate owner-reviewed policy revision and qualification decision.

## Reproduce

On darwin-arm64, check out the exact product source above in a clean directory, run `npm run js:build`, and download only `node-addon-aarch64-apple-darwin`, `wasm-web` and `wasm-web-common` from qualification run 37789349223. Pack with that source's `scripts/pack-npm-candidate.mjs` into `/tmp/redact-secret-829-candidate-packages`; the package hashes in the report identify the measured inputs. Use the archived inventory here, and a clean checkout of the benchmark source above:

```sh
export PATH="/absolute/path/to/pinned-3.97.4:$PATH"
trufflehog --version
node --import tsx benchmarks/baseten-arrival.ts \
  --core /tmp/redact-secret-829-candidate-packages/redact-secret-core-0.1.0-beta.14.tgz \
  --node /tmp/redact-secret-829-candidate-packages/redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz \
  --wasm /tmp/redact-secret-829-candidate-packages/redact-secret-wasm-0.1.0-beta.14.tgz \
  --source-commit 502eaab6771529130b7f9ca2ac77cd7203ff55ba \
  --qualification-inventory /absolute/path/to/qualification-inventory.json \
  --output /tmp/baseten-arrival.json
```

The command fails on dirty benchmark source, mismatched qualification inputs, unsupported host, initialization/scanner failure or differing repeat findings. Outcomes are recorded even when they are misses or false alarms, and no fixture expectation is adjusted after observing them. Public Actions binary artifacts have finite retention; the input inventory and digests are retained here, but binary availability is not promised.
