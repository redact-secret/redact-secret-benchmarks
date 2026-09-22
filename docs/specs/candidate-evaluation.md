# Local candidate evaluation

`eval:candidate` evaluates an immutable, locally built `@redact-secret/core`
candidate without changing this repository's manifest, lockfile, published
scanner adapter, or qualification pins. It is a development/revalidation
workflow and emits `reportType: "candidate"`; it is not Evaluation Engine
qualification and never implies whole-suite support.

Most callers never need the raw command below directly — it is what the two
wrappers in front of it call for you:

- **Already have the product repo checked out at the commit to measure?** Run
  `./scripts/measure-candidate.sh` from the product repo (or `npm run
  benchmark:candidate` if you want to drive it yourself). It builds the
  façade/N-API/Wasm tarballs, computes their hashes, runs `eval:candidate`
  against this repo, and runs `eval:validate` on the result — one command, no
  manual tarball paths or sha256s.
- **Measuring a commit you don't have checked out** (a release tag, a PR tip,
  anything not your active product checkout)? Use this repo's
  [`release-regression-check`](../../.agents/skills/release-regression-check/SKILL.md)
  skill/agent. It pins the commit in a disposable worktree, runs the same
  `benchmark:candidate` orchestration, and reports a fixture-level
  before/after regression view.

Reach for `eval:candidate` directly only when neither wrapper fits — for
example, tarballs built or supplied outside this repo's tooling, or a custom
`--ruleset`.

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
  --filter openai-token \
  --ruleset /absolute/path/to/ruleset.txt
```

`--ruleset` is optional and forwards a caller-supplied declarative ruleset
(raw bytes or UTF-8 text) to every `scan` call, mirroring the product's own
`ruleset` option on `scan`/`scanAndRedact`. Its sha256 and byte length are
recorded in the evidence's `scanner.configuration.ruleset` (or `null` when
omitted); its text is never embedded in the report.

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

## Measuring support status against a candidate

`eval:classify` (issue #80) accepts the same three tarballs, plus the
product's source commit, to substitute a candidate build for the pinned
`redact-secret` entry before running the full twin/benign/metamorphic/
mutation/differential suite:

```sh
npm run eval:classify -- \
  --candidate-package=/absolute/path/redact-secret-core.tgz \
  --candidate-node-package=/absolute/path/redact-secret-node-platform.tgz \
  --candidate-wasm-package=/absolute/path/redact-secret-wasm.tgz \
  --candidate-source-commit=<full-product-commit-sha>
```

All four flags are required together (or all omitted); a partial set is
refused rather than silently falling back to the published package. Peer
scanners (`gitleaks`, `trufflehog`) stay pinned and unchanged, so differential
evidence is unaffected. `results-output/support-status.json` gains a
`product` field — `null` for the default (published-package) run, or the
candidate's `sourceCommit`, `packageName`, `declaredVersion` and per-artifact
sha256 digests when one was supplied — so a support-status report can never
be mistaken for one about a different build. It reuses `installCandidate` /
`loadCandidate` from `scanners/candidate.mjs`; no second installer.
