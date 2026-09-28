---
decision_id: decision-add-peer-runtime-pii-redaction-throughput
status: proposed
scope: benchmarks
title: Add an independent peer runtime PII-redaction throughput comparison (flare-redact, OpenRedaction)
decided_at: 2026-09-28
---

# Add an independent peer runtime PII-redaction throughput comparison (flare-redact, OpenRedaction)

## Context

[#286](https://github.com/redact-secret/redact-secret-benchmarks/issues/286)'s
frozen A/A measurement
([decision](2026-09-28-retry-transient-pii-profile-cost-adapter-launches.md))
found that PII profile activation measurably regresses redact-secret's own
latency (~6.3x on `rust-native/full/global/validator-heavy` whole-input
latency). That measurement is entirely self-referential — redact-secret
`off` vs `enabled`, same product, same build — and gives no way to tell
whether the resulting speed is still competitive with other runtime
PII-redaction libraries. Gitleaks and TruffleHog are not a valid comparison
point for this question: both are repository/file secret scanners, not
runtime redaction libraries, and neither is measured for throughput today
(`npm run bench`'s `durationMs` is a by-product of the accuracy-corpus run,
not a workload-sized performance measurement).

flare-redact is already integrated as an accuracy peer
(`scanners/index.mjs`, package.json-pinned `1.6.1`), with its `pii` family
disabled there because the accuracy corpus is secrets-only
(`scanners/README.md`'s flare-redact section). Nothing in this repository
measures its PII-detection speed. [#429](https://github.com/redact-secret/redact-secret-benchmarks/issues/429)
asks for that comparison, against flare-redact and a second peer,
OpenRedaction (`@openredaction/core`, npm, MIT, not yet a dependency of this
repository).

`benchmarks/evaluation/domains/pii/profile-cost.ts`'s plan
(`qualification/pii-profile-cost-v1.json`, schema `pii-profile-cost-v1`) is
not an extension point for this: its validators hard-require redact-secret's
own artifact identities (`report.sourceCommit`, `artifactCommitments` such
as `rust-release-helper`/`cli-linux-x64`/`node-native`, `SURFACE_IDS` —
all redact-secret's own runtime surfaces). Fitting a third-party package
into that shape would mean forging fields that assert something untrue
(that a peer package is a redact-secret build artifact) or weakening a
freeze this repository depends on elsewhere. A new, independent plan avoids
both.

## Decision (proposed)

Add a second, independent qualification plan,
`qualification/peer-pii-runtime-throughput-v1.json` (`id:
peer-pii-runtime-throughput-v1`, own `issue: 429`), following the same
freeze pattern as `pii-profile-cost-v1` (`contentCommitment`,
`implementationFreeze` file hashes) but with its own schema — it is never
merged into or validated against `pii-profile-cost-v1`.

1. **Independently measured, not reused.** redact-secret's own numbers are
   re-measured fresh in this plan's own harness and run, in the same job as
   the two peers. `pii-profile-cost-v1`'s frozen `off`/`enabled` numbers are
   not imported — different harness, different environment noise profile,
   not a fair three-way pairing.

2. **Same input corpus as `pii-profile-cost-v1`.** Reuse
   `qualification/pii-profile-cost-workloads-v1.json`'s two workloads
   (`validator-heavy`, `multilingual-context`) unchanged. Both are already
   reviewed synthetic PII shapes with no real-person provenance
   (`safety.realPersonOrAccountProvenance: false`), so this is the one input
   all three tools can be pointed at without a fresh safety review.

3. **Measure each tool's actual redact call, not a position-only scan.**
   Confirmed by reading each package's published type declarations
   (`@redact-secret/core@0.1.0-beta.9`'s `dist/index.d.ts`,
   `@openredaction/core@1.1.5`'s `dist/index.d.ts`, `flare-redact@1.6.1`'s
   `dist/index.d.ts`):
   - redact-secret: `scanAndRedact(input, options?): ScanResult`
     (synchronous) — not `scan()`, which only returns findings and never
     builds the redacted text. `scripts/pii-profile-cost/node-sample.mjs`
     times `core.scan()` for its `wholeInput` metric, but that plan is
     measuring detector cost specifically (per #286, the PII regression is
     in the validators `scan()` runs), not a cross-tool redact comparison;
     this plan needs the call that does the same amount of work as the
     other two tools' calls below, which `scanAndRedact` is and `scan` is
     not.
   - flare-redact: `redact<T>(input, opts): T` (synchronous) — not the
     `scan(input, opts): Finding[]` the accuracy adapter uses, which only
     returns match positions and never redacts.
   - OpenRedaction: `OpenRedaction#detect(text): Promise<DetectionResult>`
     (asynchronous), whose `DetectionResult.redacted` is the redacted
     output — not `#scan()`, which classifies by severity but does not
     redact.
   Each library names its detect-only call `scan`; using that name here
   would silently compare unequal amounts of work across all three tools.
   The plan document names the exact function symbol per tool for this
   reason.

4. **The async/sync split is a measured fact, stated in the report, not
   normalized away.** OpenRedaction's `detect()` is Promise-returning;
   flare-redact's `redact()` and redact-secret's `scan()` are synchronous.
   The harness times each with `performance.now()` around the actual call
   (`await`ed where applicable) and the spec document
   (`docs/specs/peer-pii-runtime-throughput.md`) states this difference
   explicitly, so a reader does not mistake one microtask tick of Node
   event-loop overhead for engine slowness.

5. **New dependency: `@openredaction/core`, not the `openredaction` umbrella
   package.** The umbrella package's own `dependencies` pull in
   `@openredaction/react`, `@openredaction/server`, and
   `@openredaction/express`, none of which this repository needs; pinning
   the core package alone avoids that unused surface. Exact-pinned in
   `package.json` (matching how `flare-redact` is pinned), and must clear
   this repository's `dependency-audit` skill (OSV/signature check) before
   the pin is merged — the same bar every other peer package cleared.

6. **Verdict policy: informational only, permanently.** No regression gate,
   no pass/fail, no ranking assertion — this repository's Boundary rule
   (`AGENTS.md`) holds here exactly as it already does for
   `pii-profile-cost-v1`'s own `thresholdPolicy.throughput.verdict:
   "informational"`: a competitor's number is evidence, never a gate this
   repository enforces. The published report states median and p95 latency
   and bytes/second per tool/workload with no accept/reject field at all —
   there is no threshold to breach.

## Consequences

- `scanners/index.mjs` gains an OpenRedaction adapter and `families.mjs`
  gains its label mapping, built for pattern-coverage reuse; unlike the
  existing flare-redact accuracy adapter (`disable: ['pii']`, secrets-only
  corpus), this one runs with PII detection enabled, since PII detection
  speed is exactly what's being measured.
- A regression in redact-secret's own PII latency (per #286) is now
  visible against two live external reference points, not only against
  its own `off` baseline — closing the gap #429 exists to close — but this
  repository still asserts nothing about which product is "better"; that
  judgment, if any, belongs elsewhere (Boundary rule).
- `@openredaction/core` becomes a new audited dependency; its maintenance
  and vulnerability posture is subject to the same ongoing
  `dependency-audit` scrutiny as gitleaks, trufflehog and flare-redact are
  today.
- Because the plan is independent of `pii-profile-cost-v1`, a future
  recalibration or re-pin of the latter (per
  [decision-decouple-pin-freshness-from-pin-consistency](2026-09-23-decouple-pin-freshness-from-pin-consistency.md))
  never invalidates this plan's freeze, and vice versa.
