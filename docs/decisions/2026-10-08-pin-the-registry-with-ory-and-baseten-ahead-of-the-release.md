---
decision_id: decision-pin-the-registry-with-ory-and-baseten-ahead-of-the-release
status: accepted
scope: benchmarks
title: Pin the Ory and Baseten registry ahead of the published release with pending benchmark contracts
decided_at: 2026-10-08
---

# Pin the Ory and Baseten registry ahead of the published release with pending benchmark contracts

The owner authorised the new-version pin and owner approval in the 2026-10-08 working session. This implements the
registry-only part at the exact existing core commit; it records no future release or measurement.

## Decision

1. The registry and finding-type snapshots pin core `main` `5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf` after
   [core PR #1282](https://github.com/redact-secret/redact-secret/pull/1282). Both added registry detectors,
   `ory-token` and `baseten-api-key`, have T3 pending benchmark contracts, taxonomy rows, research dossiers and
   independent synthetic coverage/calibration. Provider shapes come from the adopted research handoffs and their
   provider sources, never from detector implementation. Coverage is project policy; it claims no reviewed T1 format.
2. Published `@redact-secret/core` remains 0.1.0-beta.14, release source
   `0c62fd38bca75c5b28b042dc79789b708ebf1d17`. Runtime and performance measurement identities remain tied to that
   released build. A registry pin includes unreleased detectors without claiming the old release implements them.
3. The full Ory reviewed corpus and independent measurement remain in #827; admin keys remain issuance-gated.
   Baseten independent benchmark intake remains separate from core #1111. No support status is set by hand.
4. The changed product policy and evaluation-evidence digest require recording this session's owner authorisation
   against their actual derived identities. Accepted measured run artifacts remain unchanged. Policy-only acceptance
   follows the [second-wave precedent](2026-10-06-reauthorise-the-policy-revision-for-the-second-wave-detector-contracts.md)
   only after reconstructing the accepted view and proving unchanged semantic digests and zero unexplained parity.

## Consequences

The pin-drift gate can recognise the current core registry without waiting for a published release. The T3 pending
contracts cannot establish stable support. A later released-package repin and full intake still require their actual
artifact identities and measurement evidence. No official run was dispatched by this registry intake.
