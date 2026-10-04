---
decision_id: decision-record-a-newer-evidence-release-as-an-evidence-candidate-and-separate-corpus-product-and-interaction-effects-in-a-2x2
status: accepted
scope: benchmarks
title: Record a newer evidence release as an evidence candidate next to the accepted adoption, and separate corpus, product and interaction effects of a product candidate in a 2x2
decided_at: 2026-10-04
---

# Record a newer evidence release as an evidence candidate next to the accepted adoption, and separate corpus, product and interaction effects of a product candidate in a 2x2

## Context

#698, #690. snapshot-2026.10.04.3 is the accepted evidence; the owner holds the engine candidate (credential-eval alpha.5 with `@redact-secret/core` beta.13) and the unpublished core build 1e45cecf until a core release. credential-evidence then released snapshot-2026.10.04.4 (+70 cases, 5 changed, 0 removed). Two questions have to stay separable: what the new corpus changes, and what the unreleased core build changes. `prepare` for a newer tag used to replace the whole adoption record, which would have dropped the accepted .04.3 adoption and the engine candidate.

## Decision

1. **`evidenceCandidate`.** When the record is `accepted`, `adopt-evidence-snapshot.mjs prepare` for a newer tag writes the candidate as `evidenceCandidate` beside the accepted adoption and the `engineCandidate`, which stay as they are (`--supersede` replaces a recorded evidence candidate). The gate (`adoption:check`) requires it to be a newer release than the active pin, compatible with its engine, without an owner acceptance, with an existing change report and a well-formed product integrity. `repin` accepts it only on the owner's explicit run. The active pins, the registry and the authority file do not move.
2. **The product candidate is the same bytes on every evidence.** `evidenceCandidate.productCandidates` names the registered candidate, its commit and `packagesDigest` (sha256 over the sorted `name sha256` lines of its packages); the gate compares them with `benchmarks/product-candidates.json`. A candidate that is rebuilt is a different candidate.
3. **A named snapshot is an input.** `official-runs.yml` takes `evidence_tag` and `evidence_manifest_digest` with `candidate`: the floors population is read from that release (manifest digest, listed asset bytes, records tree, schema and case count verified) and the artifact must bind to the release's own identity; the product-owned populations are unchanged. The control is the adoption record's recorded replay of the published build on that release (`scripts/candidate-control.mjs`); a missing record or archive refuses with what to do first.
4. **A 2x2.** `scripts/compare-candidate-2x2.ts` takes control and candidate on the accepted and on the new evidence, keyed by semantic ids: the corpus effect (control, and candidate), the product effect on each corpus, and the interaction (the product effect compared on the cases both corpora measure). Added and changed cases are only measured on the new corpus. Unexplained is a corpus effect on a common case, a product effect that differs between the corpora, a regression, a changed peer or a product-owned population that differs; the command is strict.
5. **Receipts.** The replay on a new snapshot is recorded as `evidenceReplays[<tag>]` of the candidate registry, never in place of `replay`, with the 2x2 beside its data.

## Consequences

The new corpus and the unreleased build can be measured together without either effect being attributed to the other. Nothing is accepted: the owner's holds (the engine candidate until the core release, the ledger proposals) stand, and every number carries the maintainer-only disclosure (96 maintainer-only fixtures, 0 independently reviewed).
