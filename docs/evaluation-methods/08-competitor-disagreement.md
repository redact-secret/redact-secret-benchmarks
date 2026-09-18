# Competitor disagreement

Status: evaluation method definition v1

## Purpose

Compare redact-secret, Gitleaks, TruffleHog, and other registered adapters on
identical inputs to find useful disagreements. Competitors are observations and
corroboration sources, never ground truth.

## Inputs

- Validated evaluation cases with authored assertions.
- At least two scanner adapters with pinned versions and modes.
- Optional reviewed mappings between detector families.

## Procedure

1. Generate and validate all fixtures before any adapter receives input.
2. Give adapters only fixture identity and bytes, not expectations or tiers.
3. Normalize findings to fixture IDs and UTF-8 byte ranges; fail closed on
   unmappable output.
4. Compare outcomes by case, assertion, range, and mapped family.
5. Create a stable review-queue entry for each material disagreement.

## Assertions

- Authored expectations decide pass or fail independently for each scanner.
- Majority agreement cannot promote, demote, or rewrite an expectation.
- `unavailable`, `error`, and `unsupported` are distinct from disagreement.
- Raw scanner failures must not leak sensitive environment data into reports.

## Reporting

Each queue item records case and fixture hashes, scanner versions and modes,
normalized findings, authored expectation, disagreement type, and stable ID.
Summaries count disagreements separately from assertion failures.

## Exit criteria

Every comparison uses identical bytes, every adapter result is attributable to
a pinned tool configuration, and reviewers can resolve queue items without
treating a competitor as an oracle.
