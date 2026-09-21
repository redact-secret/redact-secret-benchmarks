# Ruleset names-section impact on `generic-token`, 2026-09-21

Measures the before/after finding-set impact of loading a caller-supplied
declarative ruleset with an ambiguous-bucket `names` section (product issue
[#484](https://github.com/redact-secret/redact-secret/issues/484)), against
this repo's own harness rather than the product repo's test suite (issue
[#73](https://github.com/redact-secret/redact-secret-benchmarks/issues/73)).

## Candidate build

Product commit
[`0e4bad596b63647c18674cc91c2dae207b0ddfa3`](https://github.com/redact-secret/redact-secret/commit/0e4bad596b63647c18674cc91c2dae207b0ddfa3)
("refactor(ruleset): update ruleset parser and detector logic"), the tip of
`milocosmopolitan/add-the-declarative-ruleset-names-section-on-top` that is
actually reachable on `origin`. A later local-only `wip: #484` commit
(`9c3c2ac`, one commit ahead) existed in a shared product worktree at
measurement time but was recycled by a concurrent process before this build
started and was never pushed, so it is not reproducible; `0e4bad59` is the
newest commit both containing the full names-section implementation and
independently verifiable from a clean clone. The checkout was clean
(`git status --porcelain` empty) before building.

Built with the same steps as `scripts/benchmark-candidate.mjs`'s
`buildCandidate` (`npm run js:build`, `napi build --platform --release`,
`node scripts/build-browser-artifact.mjs` for both the full and `common`
detector profiles, then `npm pack` each of the three runtime artifacts):

| Artifact | SHA-256 |
| --- | --- |
| `@redact-secret/core@0.1.0-beta.5` (façade) | `a8f7abedfff82b41f33264ff5e7f31326f8280b818d66644139a8a6ddd233ed7` |
| `@redact-secret/node-darwin-arm64@0.1.0-beta.5` | `dd5146ea4770343443f489649d716fe7917e7db08ca965677c3702a60c007a80` |
| `@redact-secret/wasm@0.1.0-beta.5` | `c2f069ef107ffec708877ce194ee01c79de0ff8bcbe08c3717e5365682c5d523` |

## Ruleset plumbing

`npm run eval:candidate` (`benchmarks/candidate.ts`) gained an optional
`--ruleset <path>` argument. The referenced file's raw bytes are threaded
through `scanners/candidate.mjs`'s `loadCandidate` into every
`module.scan(text, { ruleset })` call, mirroring the product's own `ruleset`
option on `scan`/`scanAndRedact`. The evidence report's free-form
`scanner.configuration` (not the closed `candidate` schema object) records
`{ sha256, byteLength }` for the loaded ruleset, or `null` when omitted, so a
report's identity captures whether one was loaded without ever embedding its
text.

The committed reference ruleset,
[`benchmarks/rulesets/ambiguous-names-reference.ruleset`](../benchmarks/rulesets/ambiguous-names-reference.ruleset),
is byte-identical to the `names` fixture's `ruleset` text in the product
repo's `conformance/fixtures/ruleset-reference.json`:

```
ruleset-revision: 1
names: ambiguous
name: corp_token
name: api_key
name: Auth
```

## Fixed+expanded corpus run: zero change

Two `eval:candidate --filter generic-token` runs against the pinned build
above, one without `--ruleset` and one with it loaded, both against this
repo's existing 125 `generic-token`-assigned fixtures (10 corpus categories,
fixed and expanded sections):

| Run | Status | Fixtures scanned | Fixtures with a changed `outcome`/`actualFindings` |
| --- | --- | --- | --- |
| Baseline (no ruleset) | complete | 125/125 | — |
| Ruleset loaded | complete | 125/125 | **0** |

Every one of the 125 existing `generic-token` fixtures produced an identical
`outcome` and `actualFindings` count in both runs. No fixture in the current
corpus assigns a value to a field literally named `corp_token` (or any other
non-built-in ambiguous name this reference ruleset declares), so the ruleset
adds nothing to today's fixed+expanded coverage — a real, measured zero, not
an assumption. Both `candidate-evidence-v1.json` reports validate cleanly
under `npm run eval:validate`.

## Direct probe: the ruleset does resolve its declared case

Because no committed fixture exercises the ambiguous name, the corpus-level
run alone can't distinguish "the ruleset adds nothing here" from "the
plumbing is broken." A direct scan against the same real candidate build (via
`installCandidate`/`loadCandidate` from `scanners/candidate.mjs`, bypassing
the fixture-scoring harness to see per-finding detail) reproduces the
product's own reference conformance case:

| Input | Before (no ruleset) | After (ruleset loaded) |
| --- | --- | --- |
| `corp_token=SYNTHETIC_REVOKED_RULESET_AMBIGUOUS_1234` | no finding | `generic-token-ruleset-names`, `contextual_secret`, confidence **medium**, action `warn`, range `[11, 51)` |
| `unrelated_field=SYNTHETIC_REVOKED_RULESET_AMBIGUOUS_1234` (name not declared) | no finding | no finding |
| `api_key=SYNTHETIC_REVOKED_CONTEXT_VALUE` (built-in high-signal name, redundantly declared) | `generic-token`, confidence **high**, action `redact`, range `[8, 39)` | unchanged: `generic-token`, confidence **high**, action `redact`, range `[8, 39)` |

This is the magnitude: loading this reference ruleset resolves exactly one
new case shape (a caller-declared ambiguous name absent from the built-in
list) at `Confidence::Medium`, adds nothing for undeclared names, and leaves
the built-in `generic-token` detector's own resolved findings on already-covered
names byte-for-byte unchanged — no built-in finding is overturned. The
`@redact-secret/core` public JavaScript binding (`packages/javascript/dist/types.d.ts`)
does not expose a `specificity` field on a finding; `Specificity::Contextual`
for this case is the product's declared, structurally-contained architecture
(`docs/audits/evidence/484/README.md` on the product side), not something
this repo's harness can independently observe through the scan API it drives.

## Scope

This confirms containment on the corpus that exists today and demonstrates
the actual delta the ruleset produces. It does not add a `corp_token`-named
fixture to this repo's ground-truth corpus (out of scope for issue #73) and
does not modify the product repo's `scripts/benchmark-candidate.mjs` wrapper,
which has no `--ruleset` forwarding of its own yet. Per this repo's boundary
(`AGENTS.md`: "This repository does not assert product output; it measures
and records"), linking this evidence back into
[redact-secret#484](https://github.com/redact-secret/redact-secret/issues/484)
and its `docs/audits/evidence/484/README.md` is a follow-up in that repo, not
part of this change.
