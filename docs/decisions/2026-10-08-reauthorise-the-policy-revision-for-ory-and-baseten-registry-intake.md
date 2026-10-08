---
decision_id: decision-reauthorise-the-policy-revision-for-ory-and-baseten-registry-intake
status: accepted
scope: benchmarks
title: Re-authorise the credential policy revision for the Ory and Baseten registry intake while keeping the accepted runs
decided_at: 2026-10-08
---

# Re-authorise the credential policy revision for the Ory and Baseten registry intake

The owner, Milo Kang, explicitly authorised the new pin and owner approval in the 2026-10-08 working session
(“새버전 고정 소유자승인해”). This records that instruction for the benchmark registry and policy revision.

## Context

The [registry intake](2026-10-08-pin-the-registry-with-ory-and-baseten-ahead-of-the-release.md) pins core registry
`5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf`, adding Ory and Baseten T3 benchmark contracts and synthetic coverage.
The accepted measurement still uses the published `@redact-secret/core` 0.1.0-beta.14. Its release source is
`0c62fd38bca75c5b28b042dc79789b708ebf1d17`; the registry pin does not claim that beta.14 implements unreleased detectors.

Contract and taxonomy inputs change the benchmark-owned policy revision. The derived evaluation evidence file changes with the
contract table. The [2026-10-06 second-wave precedent](2026-10-06-reauthorise-the-policy-revision-for-the-second-wave-detector-contracts.md)
keeps accepted measurement identities while recording the policy revision and retaining the earlier methods-evidence digest.

## Decision

1. Authorise credential policy revision
   `rs-policy-1:sha256:94c247cf72ea74fa1f226af3392764e58a3bf64ad7af5056c3d68926a844f0da` in
   `benchmarks/qualification-authority.json`, with owner Milo Kang and date 2026-10-08. The authority stays `new`.
   This authorisation requires a rebuilt accepted view and a regenerated parity report with zero unexplained differences before merge.
2. Keep the accepted credential evidence `snapshot-2026.10.06.4`, engine `v0.1.0-alpha.16`
   (`66db9b53f2232eec5af9b7160da21be879143e6e`), published product beta.14 and all four recorded canonical runs.
   No new evidence snapshot, engine release or product build is accepted by this decision. The PII authority is unchanged.
3. Pin the derived methods evaluation evidence digest
   `sha256:faafddb76dfc0a26a5829707d5df78529f2f2702666d521a67d3e9d536fdf3f2`.
   Preserve the prior pinned digest
   `sha256:1a3be8dd354d683191998b6de425278ca01e19d604a672da797af580f7a7e2e9` in
   `methodsRun.evaluationEvidence.measuredWith`, alongside its existing history. The recorded methods run retains its own
   measured evidence digest, configuration hash and semantic digest. A future methods run reads the newly pinned file.
4. Regenerate the legacy oracle and qualification parity through the existing commands, preserving actual scanner versions and
   platform provenance. Legacy peer snapshots remain distinct from official credential-eval RunArtifacts. Support status is derived
   by the adapter; no status or review-ledger decision is set by hand here. The existing beta.14 oracle-exit and rollback record stays.

## Verified preparation

The current product inputs derive the policy revision and evaluation evidence digest recorded above.
The recorded `runs[]` objects are unchanged from `origin/develop`, including these semantic digests:

| Canonical population | Semantic digest |
| --- | --- |
| policy-corpus | `sha256:47854ffdc5d0f75a6088b395b8f84d62b17469d6c91a32b18d9c1df5e33bb1ef` |
| public-evidence-snapshot | `sha256:4bec6e539482ad55f5d2e9ad25d84b5958d24050ada07271a33d50c6d4118586` |
| public-evidence-snapshot+methods | `sha256:b39f42310579f0230678218b2c09fd061da27884d9a5b8817897b94ff1e6908f` |
| regression-corpus | `sha256:afedeab625b51e2bc842286c1ab93da7fcdc9e188c8b4b44573055e35d5f7e7b` |

The committed public axis overlay, twin-scope map and review-ledger re-key are each byte-identical to `origin/develop`.
Their policy-component canonical digests are, respectively, `sha256:4da96491ff36f313c2cb52070e0dcee3fc15c0bbfed17eb9a89981a9ec4e12ca`,
`sha256:bf9d9f26a9cc5c333b363d2ee7743bba6648fc54014855b49c05bf06a71e8284` and
`sha256:aa55c3d938f1b40867ce7f4be188106013ebc38b03f1f83caad657d8ccbe6198`.
This equality does not substitute for reconstructing the accepted view and checking its parity.

## Verification

The accepted view was rebuilt from the four byte-verified canonical artifacts and the current product inputs.
The three public derived inputs were reconstructed from the pinned snapshot and accepted runs and remained byte-identical.
The published beta.14 legacy oracle completed all 75 suites and refreshed portable peer snapshots with pinned TruffleHog 3.97.4.
Existing scanner findings and all 144 existing legacy family results remained unchanged; the registry intake added two provisional T3 families.
These local Darwin legacy snapshots are verification caches, not official credential-eval runs.

The parity command used the same committed adoption change report as the previous acceptance, including its changed Anthropic twins:

```sh
npm run qualification:parity -- \
  --legacy-status results-output/support-status.json --legacy-results public/results \
  --view public/results/qualification-v1.json --artifacts results-output/view-artifacts \
  --public-snapshot results-output/evidence-snapshot/credential-eval-corpus-snapshot.json \
  --change-report docs/generated/evidence-adoption/snapshot-2026.10.06.4.json \
  --out docs/generated/qualification-parity --strict
```

The artifact directory binds the immutable downloaded RunArtifacts and the separately derived product input metadata.
The regenerated report compares **43,529** values: **36,590 equal**, **6,939 expected structural differences**, and **0 unexplained**.
The review queue coverage gate also passes. Neither the comparison nor this decision edits support status or settles a ledger occurrence.

## Consequences

The policy authorisation and current methods-evidence pin follow the registry intake while the immutable accepted runs retain their identities.
A released-product repin, a new evidence snapshot or a new engine run requires its own actual evidence and owner acceptance.
Rollback remains setting the credential authority to `legacy` or reverting this change; PII keeps its independent authority.
