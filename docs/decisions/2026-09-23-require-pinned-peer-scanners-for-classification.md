---
decision_id: decision-require-pinned-peer-scanners-for-classification
status: accepted
scope: benchmarks
title: Require pinned peer scanners for classification claims
decided_at: 2026-09-23
---

# Require pinned peer scanners for classification claims

## Context

[Issue #180](https://github.com/redact-secret/redact-secret-benchmarks/issues/180)
showed that support classification silently depended on the TruffleHog patch
version found on `PATH`. The controlled experiment and option comparison are in
[`docs/reports/2026-09-23/peer-scanner-patch-version-classification.md`](../reports/2026-09-23/peer-scanner-patch-version-classification.md).

On the current corpus, TruffleHog 3.97.4, 3.97.6, and 3.97.8 produced identical
differential observations, but the latter two changed all 394 TruffleHog ledger
ids because peer version is part of their hash. Stable families consequently
fell from 27 to 5 without a behavior change or an error.

Removing peer version from the key would repair this sample but could silently
reuse a human decision when a future scanner release really changes behavior.
A behavior fingerprint could distinguish those cases, but it requires a new,
versioned definition of the behavior surface and a ledger migration. Exact pin
validation is smaller and preserves the existing conservative review boundary.

## Decision

- A support classification or review-queue coverage claim is valid only when
  every resolved peer scanner version exactly matches its entry in
  `qualification/suite-v1.json`.
- Claim-producing commands fail before evaluation on an unavailable,
  unparseable, or mismatched peer version and provide an actionable diagnostic.
- Automated scanner-comparison jobs provision checksum-verified artifacts for
  the suite pins in an isolated tool directory; they do not rely on a
  runner-global executable.
- Scanner adapters disable self-update where the tool supports it. This is
  defense in depth, not a substitute for version validation or provisioning.
- Peer version remains part of review-ledger identity. A future behavior-keyed
  design requires its own evidence and decision.
- Exploratory evaluation may intentionally use other peer versions, but its
  output is not a support classification or ledger-coverage claim.

Implementation is tracked by
[#182](https://github.com/redact-secret/redact-secret-benchmarks/issues/182)
and [#183](https://github.com/redact-secret/redact-secret-benchmarks/issues/183).

## Documentation location

This ADR is the authority for the evidence rule. The evaluation specification
will carry the operational setup and remediation when #182 lands. The rule does
not belong in `AGENTS.md` (repository boundary and agent workflow) or the README
(project orientation).

## Consequences

- An incidental peer patch change cannot silently alter a published support
  distribution: the run stops before producing one.
- CI and local claim-producing runs use the same declared peer identities.
- Updating a peer remains an explicit suite-pin and ledger-review event.
- Exploratory cross-version research remains possible without weakening the
  evidence used for support claims.
