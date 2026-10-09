# Benchmark evidence retention

Historical measurement payloads are preserved outside the current checkout. A measurement having existed, a test reading it, or a manual reproduction command referring to it does not make its full history a current machine input.

## Original bytes and retrieval

The #879 original snapshot contains 684 files, 191,515,606 bytes, from benchmark commit `65ffe7dcb3e7124e7f66cff96cab814f0365f69a`. The permanent source tag is `hygiene-evidence-before-removal-879-20261008`; keep it indefinitely without moving or deleting it.

Download [evidence-original-879-v1.tar.gz](https://github.com/redact-secret/redact-secret-benchmarks/releases/download/hygiene-before-cleanup-845-20261008/evidence-original-879-v1.tar.gz). Its SHA256 is `8aea6b5af11369c4b8df6c1d22e6209133297ef5c12194deadb67b0af1ef7370`, size 12,287,622 bytes. The archive has 685 regular members: the 684 original paths and `evidence-original-879-v1.manifest.json`. That manifest has SHA256 `8d5166a4a1d1757e3040e00077c244996065251a22cdc672985b08efe80cc37b`; each row binds the original path, byte length, SHA256 and Git blob SHA1, with its reviewed public access classification.

The release is an asset host; its tag is not the original snapshot revision. A fresh download was independently checked against every original Git blob before retirement. GitHub permalinks alone are not the preservation mechanism.

Extract only into an ignored scratch directory after validating the archive digest and member paths. Validate each member against the manifest and original source commit. Replay historical commands from their matching preserved source checkout with their original pins; do not run them against current candidates or overwrite current receipts. Existing SHA-pinned references retain their original source identities. The retirement manifest separately records pre-rebase benchmark source preservation and any preexisting unavailable implementation revision; archived output bytes do not recover a missing source tree.

## Current inputs

Current consumers use explicitly selected, source-bound contracts under `benchmarks/inputs/credential/`, `benchmarks/inputs/performance/`, `benchmarks/inputs/runtime/` and `benchmarks/inputs/pii/`. Their validators retain the exact consumed measurements, original candidate/artifact identities and accepted facts. The retirement manifest records each original file's disposition and consumers. Frozen historical locator strings remain provenance; they do not authorize a new candidate or imply that a payload must remain in HEAD.

Authority, official runs, accepted ledgers, protected seals and owner exits have their own gates. This cleanup grants no authority, performs no protected run, changes no accepted result and provides no permission to retire the remaining #851 oracle or rollback code.

## Producing new measurements

Write exploratory runs and reproduction outputs into ignored `results-output/`. Retain a new current input only through explicit review, with its execution role, schema, original source/artifact identity, digest, size and affected readers. Publish reviewed historical records as checksum-bound release assets rather than creating issue, release or session payload trees in this directory.

Never publish matched plaintext, raw scanner errors, private corpus bytes, protected fixtures, case text, private seeds or tuning material. The preserved archive contains reviewed public metadata and synthetic observations; protected references contain only existing sanitized aggregate or custody receipts.
