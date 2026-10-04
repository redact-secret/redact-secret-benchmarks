---
decision_id: decision-accept-snapshot-2026-10-04-3-on-credential-eval-alpha-4
status: accepted
scope: benchmarks
title: Accept evidence snapshot-2026.10.04.3 on credential-eval v0.1.0-alpha.4 as the credential qualification evidence
decided_at: 2026-10-04
---

# Accept evidence snapshot-2026.10.04.3 on credential-eval v0.1.0-alpha.4 as the credential qualification evidence

Accepted by the owner of the repository, Milo Kang, on 2026-10-04 (#680, #690). The patch prepared by the adoption entry point was applied unchanged and the owner fields were set from this decision: `new.acceptedOn` and `new.acceptedBy` of the authority file and `candidate.ownerAcceptance` of `benchmarks/evidence-adoption.json`. **This candidate supersedes the earlier candidate `snapshot-2026.10.04` on credential-eval alpha.3, whose acceptance patch was removed.**

## Context

The candidate `snapshot-2026.10.04.3` (6,449 cases: 5,950 common, 499 added, 235 regrouped by credential-evidence; 342 cases carry representation facts, 55 of 55 decoded spans verified by the engine; 73 fixtures moved out of not-assertable and 96 fixtures are `maintainer-only` (ADR 0020, solo-maintainer period: finalized by the sole maintainer, never reviewed, never independent validation; 0 are `reviewed`); 5 invalid-UTF-8 cases are not exported and 29 twin lineages are not written) was replayed officially on credential-eval `v0.1.0-alpha.4` (CI run 37202404479, archive `official-runs-37202404479`; plain and methods, two engine runs each with equal semantic digests). The adoption report `docs/generated/evidence-adoption/snapshot-2026.10.04.3.md` lists every difference and its cause:

- **Engine effect** (alpha.1 to alpha.4, previous corpus fixed): no family, matrix entry or public case differs. The alpha.4 official configuration opts in to `decoded_mapping: "source-segment"`, so every config hash and semantic digest changes, and all review occurrence ids change with them (the re-key is regenerated; 4,268 of 4,268 legacy decisions map).
- **Engine effect on the added and changed cases** (alpha.3 to alpha.4): gitleaks unmeasured plain cases 10 to 0 and unmeasured methods variants 60 to 0; see the report for the case-level moves.
- **Corpus effect**: 11 credential families (18 matrix entries) move from stable to provisional (116 stable, 18 provisional, 1 pending); every reason is a methods-run gate on the added cases (unsettled gate-peer differential occurrences with no review decision, and the reference scanner's failed metamorphic and mutation assertions on added sendgrid fragment cases). No common case contributes a new reason.
- **Review state**: the 73 fixtures that left not-assertable are scored now (71 policy positives, 2 controls) and every one of them is maintainer-only; the report lists their outcomes per scanner and the families they belong to. They rest on one maintainer's decision, not on an independent review, and nothing in this repository treats them as reviewed.
- **Representation capability**: the engine verified the release's facts (facts digest equal). Base64 and hex segments reported by gitleaks are now placed on the whole encoded segment; fragments are carried and scored on the enclosing range; percent-encoded, UTF-16 and escaped-Unicode decoded findings stay unmeasured. Pending (T0) cases and expected rejections stay outside every denominator.
- **Parity**: 0 unexplained of 42,611 compared values against the legacy oracle at the same release (@redact-secret/core 0.1.0-beta.12).

## Decision

Accepted by the owner, Milo Kang, on 2026-10-04: credential-evidence `snapshot-2026.10.04.3` on credential-eval `v0.1.0-alpha.4` is the accepted public evidence population. The engine pin, the vendored RunArtifact and corpus-snapshot schemas, the recorded runs, the regenerated overlays, the parity report and the renewed authority file in `docs/generated/evidence-adoption/snapshot-2026.10.04.3.acceptance.patch` are the active evidence. The public numbers reach production only through `develop` staging and then `go-production`, which the owner asks for separately.

**Option A for the 96 `maintainer-only` fixtures.** They count in the numbers and are disclosed. The internal status name `maintainer-only` is part of the released snapshot and does not change; user-facing labels read, in Korean, "메인테이너 검토 (독립 검토 대기)" and, in English, "Maintainer-reviewed (independent review pending)", with the note: "Passed the project's own verification (source evidence, automated checks, recorded counter-arguments); not yet independently reviewed." The label is never "independent" validation, and this repository settles no review decision for these fixtures.

Rollback is reverting the acceptance commit, or setting the authority file's `authority` back to `legacy`.

## Consequences

- 11 credential families (18 support matrix entries) move from stable to provisional: 116 stable, 18 provisional, 1 pending (previously 127 stable, 7 provisional). The cause is unreviewed gate-peer differential occurrences on the added cases, plus the reference scanner's failed assertions on added fragment cases. It is not a product regression, and no common case contributes a new reason.
- A larger denominator is not an improvement and a lower stable count is not a regression of the product: the 499 added cases bring evidence no earlier run measured.
- Decoded and fragment semantics are claimed only where the engine verified them (facts digest equal); everything else stays unmeasured. Unmeasured cases are in no denominator and are never zero detections.
- The 18 provisional matrix entries stay provisional until a reviewer settles the added cases' occurrences. That work belongs to the product and to the independent review, not to this repository.
- The public credential qualification pages say which pipeline is the authority and show how many fixtures carry the maintainer-reviewed label.
- Open for production: `npm run go-production`, run when the owner asks for it.
