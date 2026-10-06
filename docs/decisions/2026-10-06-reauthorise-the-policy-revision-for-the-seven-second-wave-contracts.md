---
decision_id: decision-reauthorise-the-policy-revision-for-the-seven-second-wave-contracts
status: accepted
scope: benchmarks
title: Re-authorise the policy revision for the seven second-wave contracts without accepting any new evidence, engine or product build
decided_at: 2026-10-06
---

# Re-authorise the policy revision for the seven second-wave contracts without accepting any new evidence, engine or product build

Accepted by the owner of the repository, Milo Kang, on 2026-10-06 (#583, #776; explicit instruction in the working session: complete the work end to end without intervention, including the merge). This re-authorises **one value**, the benchmark-owned policy revision. It is not an acceptance of an evidence snapshot, an engine or a product build.

## Context

Slices 583b to 583h replaced the seven T3 placeholder contracts (Xata, Sourcegraph, Unkey, Buildkite, Pydantic Logfire, Mapbox, Fly) with T1 registry contracts and corpora, and moved the taxonomy notes, the calibration rows' classification and the derived axis overlay, twin-scope map and review-ledger re-key. Any such change moves the policy revision that `benchmarks/qualification-authority.json` pins, so `authority:check`, the evaluation-evidence digest and the jobs that depend on them failed on #776 by design until the owner renewed it.

## Decision

1. **The policy revision `rs-policy-1:sha256:7b4e41c22fad63e30397cc21268d7d8485144861c7fe25d35679c4f11ad34b7a` is authorised** (`acceptedBy` Milo Kang, `acceptedOn` 2026-10-06), replacing `20f1b70b…` of [the previous re-authorisation](2026-10-06-reauthorise-the-policy-revision-for-the-second-wave-detector-contracts.md). The release, the semantic digests and the accepted runs are unchanged.
2. **Kept exactly as accepted:** evidence `snapshot-2026.10.05`, engine credential-eval `v0.1.0-alpha.5`, public run 37296823599 with `@redact-secret/core` 0.1.0-beta.13. Not accepted and not repinned: `snapshot-2026.10.06.2` and `snapshot-2026.10.06.4` stay candidates (their replays are recorded in `benchmarks/evidence-adoption.json`).
3. **Nothing was re-measured for the accepted runs.** The accepted artifacts of run 37296823599 were downloaded and the view rebuilt from them locally: 123 stable, 20 provisional, 1 pending, 0 unsupported of 144 families, as accepted.
4. **The evaluation evidence file was re-derived** (`npm run qualification:evidence`): `sha256:1a3be8dd…` is the pinned digest; the two earlier digests the recorded canonical methods run read stay in `measuredWith`, so its record is never rewritten.
5. **The legacy oracle was regenerated** at beta.13 with the pinned trufflehog 3.97.4 and gitleaks 8.30.1 (`npm run bench`, `npm run eval:classify`) and `docs/generated/qualification-parity.json` rebuilt: 43,365 values compared, 42,485 equal, 880 expected-structural (each attributed to a cause), 0 unexplained.
6. **The seven new families stay provisional** in the published mode (127 stable of 144 scored families, unchanged): the published release contains none of the detectors, and every dependency on an open ruling (Q1, Q7, Q9, Q10) is a `policy-*` field, never T1. See [the decision on the contracts](2026-10-06-author-the-seven-second-wave-contracts-and-leave-the-open-rulings-unclaimed.md).

## Consequences

- `authority:check`, `official-runs:check --bindings` and the evaluation-evidence assertion pass on this change, so #776 can merge.
- Rollback: revert this change, or set `authority` back to `legacy` (`docs/specs/qualification-cutover.md`).
- Cost: no official run was dispatched for this change.
