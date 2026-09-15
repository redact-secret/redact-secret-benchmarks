# redact-secret-benchmarks

Independent, reproducible accuracy benchmarks comparing
[redact-secret](https://github.com/redact-secret/redact-secret) against
established secret-scanning tools on identical fixture sets.

## Why this is a separate repository

This work is deliberately kept out of `redact-secret/redact-secret`:

- **License isolation.** TruffleHog is AGPL-3.0. This repo shells out to its
  released binary as an arm's-length external process for comparison
  purposes; it never vendors, links, or redistributes TruffleHog source. That
  entanglement — even at arm's length — has no reason to exist anywhere near
  the main product repository or its CI.
- **Governance scope.** The main repo's `assessment/` directory is governed
  by [`decision-define-cross-language-evaluation-protocol`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-12-define-cross-language-evaluation-protocol.md),
  which explicitly places "comparisons against competing products" out of
  scope. Doing this work here avoids reopening or amending that decision.
- **Real external-consumer testing.** This repo depends on redact-secret only
  through its published packages (`@redact-secret/core` on npm,
  `redact-secret` on PyPI) — never through internal APIs or a path import
  into the main repo's source tree. That means every benchmark run also
  exercises the actual installed-package experience any other consumer gets.

## What this measures

The same question, asked identically of every tool: given a fixed set of
input files with independently reviewed ground truth (a secret is present or
absent, at a known byte range), what does each scanner report?

- [**redact-secret**](https://github.com/redact-secret/redact-secret) — via
  its published CLI/npm/PyPI packages.
- [**Gitleaks**](https://github.com/gitleaks/gitleaks) — MIT, regex/pattern-based,
  local.
- [**TruffleHog**](https://github.com/trufflesecurity/trufflehog) —
  AGPL-3.0 (invoked as an external binary only, never vendored), adds live
  credential verification.

## Ground-truth schema (tool-agnostic)

Unlike `redact-secret`'s own `assessment/fixtures/accuracy-corpus.json`,
which carries a `policyOutcome` (`block`/`redact`/`warn`) specific to its own
policy model, ground truth here is reduced to what every scanner can be
judged against without favoring one tool's concepts over another's:

```json
{
  "id": "fixture-id",
  "path": "relative/file/path",
  "expected": [
    { "start": 0, "end": 0, "note": "human-readable, no matched value" }
  ]
}
```

An empty `expected` array is a negative (false-positive trap) fixture.
Fixtures are materialized as real files in a scratch directory (and, where a
scanner requires it, a scratch git repository with real commits) rather than
fed as in-memory strings, since Gitleaks and TruffleHog scan files/repos, not
raw text.

## Non-goals

- Not a release gate for `redact-secret`, and not affiliated with or a
  criticism of the Gitleaks or TruffleHog projects.
- No live-credential validation against real provider APIs.
- No real, active, or reconstructable credentials anywhere in fixtures,
  results, logs, or commit history — synthetic or explicitly revoked values
  only, on the same terms as the main repo's `SECURITY.md` and
  `conformance/README.md#fixture-safety-review`.

## Status

Early scaffold. Fixture corpus, the scanner-invocation harness, and the
scoring pipeline are tracked as issues in this repository.

## License

MIT — see [LICENSE](./LICENSE). This license covers this repository's own
code and fixtures only; it does not extend to, and this repo does not
redistribute, any third-party scanner's source.
