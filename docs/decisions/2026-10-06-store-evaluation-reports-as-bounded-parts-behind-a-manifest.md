---
decision_id: decision-store-evaluation-reports-as-bounded-parts-behind-a-manifest
status: accepted
scope: benchmarks
title: Store evaluation reports as bounded, digested parts behind a versioned manifest instead of one whole-document JSON string
decided_at: 2026-10-06
---

# Store evaluation reports as bounded, digested parts behind a versioned manifest instead of one whole-document JSON string

## Context

The maintainer reported a roughly 420 MB report near the runtime limit (#785, #786). The measurement ([baseline](../generated/evaluation-report-baseline.json), [spec](../specs/evaluation-report-storage.md)) identifies it: `results-output/evaluation.json`, the pretty-printed discovery source, 420,169,790 bytes and 419,813,243 UTF-16 characters, 78.2% of V8's 536,870,888-character string limit on Node v22.16.0 (20,009 cases, 52,075 variants; `results` is 81.7% of its compact form). The public projection `evaluation-v1.json` is 76.5 MB (14.3% of the limit), the observed ledger 26.9 MB, the qualification aggregate 1.5 MB. The 311.9 MB Next export and 461 MB site of staging run 37513643096 are site totals, not report sizes. Reading the discovery file and parsing it peaks at 2.17 GB RSS; the whole-report projection takes 10.4 s. At the measured ratio the pretty file reaches the string limit at about 25,600 cases, the compact form at about 41,900.

Options considered: (1) compact JSON, which removes 39% of the bytes and about 1.6 times the headroom but keeps one string proportional to the corpus; (2) a streaming JSON parser over the same single file, which fixes reading but leaves a 420 MB artifact that every consumer must stream and that cannot be fetched per method; (3) one file per method, which is still unbounded per file (metamorphic alone is 86 MB compact) and was excluded by the issue; (4) bounded parts behind a manifest.

## Decision

1. **Parts behind a manifest, not one document.** The discovery report is stored as `results-output/evaluation/` (header, JSON Lines parts for results, failures and the review queue, and `manifest.json` written last as the completion marker). The public report is stored as an immutable bundle `public/results/evaluation-bundles/<bundleId>/` (manifest, summary, per-method case parts, review parts) and a mutable pointer `public/results/evaluation-bundle-v1.json`. Every part has a SHA-256 over its exact bytes, a size and a record count in the manifest, and is checked before it is trusted.
2. **Limit and oversized records.** Parts are at most 8 MiB, recorded in the manifest. 8 MiB is a chosen operating point, not an expansion factor: the largest observed record is 33,825 characters (0.4% of it) and a part is 1.56% of the string limit. A single record larger than the limit is stored whole in its own part, marked `oversized`; nothing is cut, sampled or dropped. The summary is one document of at most 4 MiB (measured 1.0 MB).
3. **Deterministic layout.** Case parts group by method in the canonical order and keep discovery order inside a method; reviews keep discovery order. Case and review ids are unique across the whole bundle. `bundleId` is derived from the part digests.
4. **Storage version is separate from scoring identity.** The layout is `redact-secret/evaluation-bundle/v1` and `redact-secret/evaluation-discovery-store/v1`; the stored report identity (evaluation-public schema 2, accounting 1.1, the public allowlist) is carried unchanged in the manifest. A storage change may re-key digests; it cannot change a case, a denominator, a scanner identity or a ledger decision, and equivalence with the old report is checked.
5. **Complete means validated, streaming.** Publication writes details, validates them by reading them back one part at a time (digests, sizes, counts, the closed public schema, global id uniqueness, run binding, references, T0/review-required/not-measured rules, corpus hashes, operator and manifest totals), binds the observed ledger to the same run, and only then moves the pointer. A bundle without a manifest, a mixed-run, stale, protected-field or inconsistent bundle is refused and never published as complete. The whole report is never rebuilt to validate it.
6. **Public paths.** The credential domain descriptor's `evaluation.href` becomes `/results/evaluation-bundles/<bundleId>/manifest.json` and its `artifactCommitment` the SHA-256 of that manifest file; the mutable pointer is `/results/evaluation-bundle-v1.json`. A manifest is never placed at `/results/evaluation-v1.json`.
7. **Legacy stays until explicitly retired.** The legacy discovery file is read through an explicit path of the same reader and never triggers a scanner run; `evaluation-v1.json` is still produced by `eval:publish -- --legacy-v1` for the oracle and unmigrated consumers. Retiring either needs a removal PR listing every caller and an ADR. Rollback is moving the pointer to a retained bundle or serving the legacy file. Compact JSON is recorded as a measured temporary option and is not adopted.
8. **Honest limits.** This bounds serialization and reading. Evaluation execution still retains the generated inputs, the observations and the assembled results, so the heap bounds the run itself; reducing that is separate work, taken only where measurement shows the need.
9. **Ownership.** The spec's caller inventory assigns every tracked caller to #787 (discovery I/O), #788 (public bundle), #789 (Next readers), #790 (domain and PII publishers and descriptors) or #791 (workflows, the sites mirror, assembly, retention and rollback).

## Consequences

- Reading or writing the discovery report and validating or reading the public report take memory proportional to one part, plus one small index entry per case and per review in the validator, not to the corpus. The next corpus doubling no longer meets the string limit in these paths.
- Digests of stored artifacts change (a new layout and a content-addressed bundle id); the scoring identity, cases, reviews, summaries and the ledger are semantically identical to the old report, which `verify-evaluation-bundle --legacy` and the synthetic tests prove.
- A site that serves the bundle serves about a dozen files for the public report instead of one; a page can fetch the summary and one method's parts only.
- Consumers must follow the pointer and re-check what they read; a repository that still publishes only the legacy file keeps working until a consumer is migrated.
- The oracle and the unmigrated consumers keep the whole-report cost (and its limit) until they are retired; this ADR does not retire them.
