# Local candidate evaluation

`eval:candidate` evaluates an immutable, locally built `@redact-secret/core`
candidate without changing this repository's manifest, lockfile, published
scanner adapter, or qualification pins. It is a development/revalidation
workflow and emits `reportType: "candidate"`; it is not Evaluation Engine
qualification and never implies whole-suite support.

The JavaScript package has three runtime artifacts. Supply the façade tarball,
the current host's N-API package tarball, and the WebAssembly package tarball:

```sh
npm run eval:candidate -- \
  --candidate-package /absolute/path/redact-secret-core.tgz \
  --candidate-node-package /absolute/path/redact-secret-node-platform.tgz \
  --candidate-wasm-package /absolute/path/redact-secret-wasm.tgz \
  --candidate-source-commit <full-product-commit-sha> \
  --product-state clean \
  --expected-artifact-sha256 <core-tarball-sha256> \
  --output-dir /absolute/path/to/evidence \
  --filter openai-token
```

The adapter creates a temporary npm consumer, uses local-tarball overrides for
the native and Wasm dependencies, initializes the installed public package,
scans materialized fixtures, and removes both the consumer and fixture trees.
No install points back to either worktree. Install, initialization, identity,
or scan failure writes explicit failed/incomplete evidence and exits nonzero;
it cannot become a zero-finding success.

Omit `--filter` for the full measurement-v4 corpus. A filter selects existing
fixtures through `benchmarks/fixture-detectors.json`; it does not change their
authored classification, expected ranges, or twin relations. Evidence labels
such a run `filtered-development`, so it cannot be confused with a full suite.

`candidate-evidence-v1.json` records product and benchmark revisions and dirty
states, all package hashes, declared package identity, lockfile and corpus
hashes, scanner configuration, runtime, exact argv, selection, completeness,
and safe per-fixture before/after outcomes. It contains counts and ranges only,
never fixture content, matched plaintext, or raw scanner errors. Validate a
stored report with `npm run eval:validate -- <path>`.

Each result is labeled `fixed-corpus` for the reviewed `common-formats`
regressions or `expanded-corpus` for broader coverage. Consumers must report
those sections separately; an expanded-corpus observation cannot rewrite or
invalidate the authored fixed-corpus result.

The ordinary `redact-secret` scanner in `scanners/index.mjs` continues to load
the lockfile-pinned published package, and `eval:qualify` continues to require
the versions in `qualification/suite-v1.json`.
