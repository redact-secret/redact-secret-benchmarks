---
name: sast-sweep
description: Run semgrep over this repository's own eval/CI/ledger scripts for injection, path-traversal, and unsafe-dynamic-execution patterns, then check each hit against the controls docs/specs/threat-model.md already documents. Use when asked for a SAST pass, before touching scanners/candidate.mjs or scripts/qualified-candidate.mjs, or for "sast-sweep", "/sast-sweep scripts/". Report-only unless asked to apply.
---

# sast-sweep

Static-analyze this repository's own JavaScript/TypeScript for the exact bug
classes its threat model already names, using an independent tool rather
than eyeballing diffs. Per the [Boundary rule](../../../AGENTS.md), this is
about this repository's own code — never a benchmarked scanner's detection
quality.

## Scope

- Target: the path given as an argument, or else the current diff
  (`git diff develop...HEAD`), or else `scripts/`, `scanners/`, and
  `benchmarks/lib/`.
- Read `docs/specs/threat-model.md` first, specifically the "Candidate
  execution" and "CI publish pipeline" surfaces — they already name which
  dynamic-execution and unvalidated-input patterns are *accepted* (candidate
  code running with full ambient access is by design) versus which are
  *supposed to be guarded* (a 40-hex check on `product_sha`, a digest check
  before a tarball is trusted). A hit inside an already-accepted pattern is
  not a finding unless your read shows the guard next to it is missing or
  weaker than the threat model claims.

## Run

`semgrep --config p/javascript --config p/nodejsscan <scope>` for a general
pass, plus a small custom ruleset for this repository's specific shapes:

- `readFile(path.join(<dynamic root>, <externally influenced path>))` without
  a prior normalization/containment check — the shape `scanners/candidate.mjs`
  uses safely (`fixture.path` is joined under the corpus root, not
  user-supplied) but worth re-checking on every touch to that function.
- `execFile`/`exec`/`spawn` where any argument traces back to a
  `workflow_dispatch` input, a fixture field, or an adversarial-pack field,
  without going through the kind of validation `scripts/qualified-candidate.mjs`
  already applies to `PRODUCT_SHA` (`/^[0-9a-f]{40}$/`) or a digest
  (`/^sha256:([0-9a-f]{64})$/`).
- `import(` / `require(` with a non-literal, runtime-constructed specifier
  outside `scanners/candidate.mjs`'s `loadCandidate` (that one dynamic import
  of a freshly-installed candidate package is the documented, accepted
  pattern; the same shape appearing somewhere else in the codebase is not).
- Any `JSON.parse` of untrusted or external input (an adversarial intake
  file, a fetched artifact-inventory) without a schema check immediately
  after it.
- Prototype-pollution-shaped merges (`Object.assign`, spread, or manual
  key-copy loops) over parsed JSON from an external source (adversarial
  packs, fetched artifact manifests) that could carry a `__proto__` key.

## Output

| Severity | Rule/class | file:line | Evidence | Already-guarded? | Fix |
| --- | --- | --- | --- | --- | --- |

"Already-guarded?" cites the specific validation this repository already has
nearby (or states there is none). End with the semgrep version and rule sets
used, and a one-line verdict: `no confirmed findings` or the count by
severity.

## Rules

- Use synthetic values only in any reproduction you write. Never paste real
  secrets or holdout/blind fixture bytes.
- Do not apply fixes, install semgrep rules permanently, or add a CI job
  unless asked.
- Do not report a bare semgrep hit as a finding without reading the
  surrounding code — this repository intentionally does some of what generic
  JS security rulesets flag (dynamic `import()` of candidate code, running
  external binaries by design); the threat model's Surfaces section is the
  authority on what's accepted.
