# Conventions

Standing rules for fixtures, the evaluation registry, and code style. For how
the system fits together, see [ARCHITECTURE.md](ARCHITECTURE.md). For the
step-by-step of adding something new, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Ground-truth schema (tool-agnostic)

Ranges use a common representation, but expectations are not automatically
tool-neutral. Each fixture must declare its measurement purpose and rationale;
reviewed format fixtures also require a source-backed contract:

```json
{
  "id": "fixture-id",
  "path": "relative/file/path",
  "content": "postgres://fixture:s3cret@db.example.invalid/app",
  "expected": [
    { "start": 19, "end": 25, "role": "secret",
      "envelope": { "start": 0, "end": 48, "reason": "Whole URI may be redacted; only the password must be." } }
  ],
  "assessment": { "kind": "policy", "tier": "T3", "reason": "…", "contract": "connection-string", "sources": [] }
}
```

An empty `expected` array with `kind: "must-not-flag"` is an authored control;
a control may declare `twinOf`, `mutation` and `mutationKind` to pair with a
positive that differs by exactly one structural property. For a family whose
value has no grammar the twin keeps the value and mutates one property of the
assignment context (`mutationKind: "context"`); a family with nothing
documented to mutate is recorded `unprobeable` on its contract instead, and
`/coverage` publishes discriminated, not discriminated and un-probeable as
separate lines
([decision](docs/specs/decisions/2026-09-20-extend-twins-to-assignment-context.md)). Envelopes, tiers and
twins are authored from construction and provider evidence, hashed with the
corpus, and never widened in response to scanner output. Fixtures are
materialized in a scratch filesystem directory.

Classification describes authored test intent and never depends on which
scanner detects a value. Ground truth must be authored independently of
scanner results; unknown formats default to T0.

## Registry naming and identity

- Registry detector IDs and case IDs must not collide.
- Every fixture slug in `benchmarks/fixture-detectors.json` needs its detector
  IDs (or `[]` for a shared case without a detector assignment). The catalog
  tests reject missing, orphaned, or unknown assignments.
- Slugs on evidence pages are `<case-id>--<fixture-id>` to avoid collisions.
- Different scanner versions, modes, lockfiles, and matching rules remain
  separate; only reports sharing the newest run id are aggregated together,
  and detector views overlap, so their totals are never summed.

## Code style

- `src/tokens.css`, `src/tokens.json`: Redact Secret design tokens, copied
  from the design system — a test fails on drift.
- `src/style.css`: tokens only, no hex, no raw px, no shadows.
- Keep scanner execution separate from measurement logic. A scanner adapter
  implements `version(root)` and `scan(root, fixtures)`, returning
  `{ path, start, end }`, and nothing else.
