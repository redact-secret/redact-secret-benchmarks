---
decision_id: decision-accept-snapshot-2026-10-06-4-on-credential-eval-alpha-15
status: accepted
scope: benchmarks
title: Accept evidence snapshot-2026.10.06.4 on credential-eval v0.1.0-alpha.15 with the published @redact-secret/core 0.1.0-beta.13 as the credential qualification evidence
decided_at: 2026-10-06
---

# Accept evidence snapshot-2026.10.06.4 on credential-eval v0.1.0-alpha.15 with the published @redact-secret/core 0.1.0-beta.13

Accepted by the owner of the repository, Milo Kang, on 2026-10-06 (#690, #697, #763, #773; explicit instruction in the working session: update to the new evidence and measure it, completing the work without intervention). This candidate replaces the accepted `snapshot-2026.10.05` on credential-eval alpha.5 and supersedes the evidence candidate `snapshot-2026.10.06.2` (alpha.13, never accepted). Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): owner acceptance is not an independent review.

## Context

`snapshot-2026.10.06.4` (manifest `sha256:d2e966e6106d4e5de2b79cc301149a70c950bec313ae981f3877ab2e81fcdda3`, corpus `sha256:2319e44084d4db2fc984c31fd07f091c6228e360ea5e6b9b5d65dabaae9d809a`) supersedes the accepted `snapshot-2026.10.05`. Candidate view: {"pending":1,"provisional":27,"stable":116,"unsupported":0}; the report is docs/generated/evidence-adoption/snapshot-2026.10.06.4.md.

## Decision

Accepted by the owner, Milo Kang, on 2026-10-06:

1. **(a)** `snapshot-2026.10.06.4` on credential-eval `v0.1.0-alpha.15` with the published `@redact-secret/core` 0.1.0-beta.13 is the accepted public evidence population. The engine pin and its run-artifact schema, the evidence pin, the recorded runs (control replay run 37469753365), the regenerated overlays, the parity report and the renewed authority file in this change are the active evidence. The previous floors runs stay as `historicalRuns[]` receipts (alpha.5); the previous regression and policy runs of alpha.5 are no longer runs of the pinned engine and stay in git history.
2. **(b)** OpenRedaction's default profile is **not measured** in the accepted runs, on purpose: it takes too long (optional by the evaluation contract, #763; the scanner roster states it and the view fabricates no zero). The recorded runs carry `omittedOptionalScanners`, the registry check accepts only an optional scanner a run states it left out, and the parity report attributes its absence (`optional-scanner-not-measured`). Its last measurement stays the previous accepted run's; a manual measurement is a separate act.
3. **(c)** Going to production (`npm run go-production`) is **not** decided here: this ADR records no deployment. Staging is the push to `develop`.
4. **(d)** The disclosure wording stays: "Maintainer-reviewed (independent review pending)" and, in Korean, "메인테이너 검토 (독립 검토 대기)", with the maintainer-only counts read from data. Owner acceptance is not an independent review.
5. **(e)** The #698 triage settlements of this release (`docs/generated/evidence-adoption/snapshot-2026.10.06.4.ledger-settlements.json`) are proposals and are **not** applied to `benchmarks/review-ledger.json` by this decision.

The engine effect (the accepted corpus on alpha.15, run 37502638892) is separated from the corpus effect; with OpenRedaction out of both, the contrast against the accepted control has 4,995 differences, 0 unexplained, 0 regressions. The legacy oracle is regenerated at the same release (beta.13) with the pinned trufflehog 3.97.4: the parity report compares the legacy path with the new one; its causes now include `optional-scanner-not-measured`, `corpus-twin-change` and `engine-twin-scoring`, each recognised only when an exact residual matches.

## Consequences

On acceptance the active evidence pin, the recorded runs (the previous ones as historical receipts), the derived overlays, the parity report and the authority file move to this release; the public numbers change only when this is merged and deployed. Rollback: revert the acceptance, or set the authority back to `legacy` (docs/specs/qualification-cutover.md).
