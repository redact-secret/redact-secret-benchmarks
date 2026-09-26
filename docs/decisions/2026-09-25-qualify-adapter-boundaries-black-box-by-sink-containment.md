---
decision_id: decision-qualify-adapter-boundaries-black-box-by-sink-containment
status: accepted
scope: benchmarks
title: Qualify adapter boundaries black-box by sink containment
decided_at: 2026-09-25
---

# Qualify adapter boundaries black-box by sink containment

## Context

[#281](https://github.com/redact-secret/redact-secret-benchmarks/issues/281)
asks for independent evidence that the MCP adapter
(`@redact-secret/adapter-mcp`, redact-secret-adapters#13) keeps plaintext
inside the boundary redact-secret#612 defines, and for its operational cost,
before the adapter is published. Until now every measurement here scored a
scanner's ranges against authored spans. An adapter boundary is judged
differently: what matters is whether a synthetic value reaches a place the
host writes to, not which bytes a scanner reported. The adapters repository
already replays the core's conformance fixture through its public API; this
repository must not become a second copy of that suite.

## Decision

1. An adapter boundary is qualified here as a black box: the exact published
   or publish-shaped tarballs, verified against the product's pin, installed
   into a clean consumer with the SDK at each declared endpoint, driven by a
   real client and a real server process. No adapter source, private API or
   vendored fixture is used. The workload corpus is authored here and its
   expectations come from the contract text.
2. The primary measure is **sink containment** per case: the model context,
   host log, store, audit trail and error text (and, for server-side
   wrappers, the server's wire output and handler input) are scanned for each
   synthetic value in full and as identifying fragments. Plaintext in a sink
   is a `leak`, unless it arrives through a documented exclusion
   (`known-false-negative`) or an explicit `warn`/`allow` policy
   (`delivered-by-policy`). A leak is a failure of the claim whatever the
   outcome label says.
3. Contract **deviations** (outcome, fixed result, dispatch, stop-pulling,
   cancellation) are counted separately from leaks and are never folded into
   one score.
4. Every run carries a **negative control**, an unprotected host writing the
   raw result to every sink. The run is invalid if the scan does not flag it.
5. Operational cost reuses the #143 adapter-overhead dimension: the same mode
   structure (host, adapter over a finds-nothing core, adapter over the real
   core), reported under its own adapter language so it never mixes with the
   log adapters' baseline. It is measured, not judged, until a baseline that
   includes it is promoted.

The mechanics are in [`docs/specs/mcp-qualification.md`](../specs/mcp-qualification.md).

## Consequences

- A failure is attributed to the observed boundary behavior. Whether the root
  cause is in core or adapters is decided when it is filed.
- The same shape applies to a future adapter boundary (another SDK, another
  host framework) as one more corpus and consumer, not a new decision.
- The adapters' conformance and compatibility evidence stays in their
  repository and is linked, not copied.
