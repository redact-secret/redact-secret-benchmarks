---
decision_id: decision-peer-rule-family-map
status: accepted
scope: benchmarks
title: Map each peer scanner's rules to credential families by reviewed authoring, validated in the ledger pipeline, and keep it out of the adapter identity
decided_at: 2026-09-30
---

# Map each peer scanner's rules to credential families by reviewed authoring, validated in the ledger pipeline, and keep it out of the adapter identity

## Context

#558 (part of #543). The `/report` peer section is designed with three columns per
scanner: the inputs the scanner's own rules target, what it left readable on them, and
what it left readable everywhere else, plus a one-line description of what the scanner is
built for. The ledger held none of it: no map from a peer's rules to
`benchmarks/support/taxonomy.json`, and no kind or description per scanner. The site showed
what the run records (spans left readable across all inputs) and hid the three columns.

Two facts shaped the decision.

1. A peer snapshot's identity hashes `scanners/index.mjs` and `scanners/families.mjs`
   (`repositoryPeerIdentity`, `benchmarks/lib/peer-observations.ts`), and the fixture index
   and suite file are part of the input identity. Editing any of them re-keys every peer
   snapshot, which the site must not do (the existing site's published output is unchanged).
2. A rule's family cannot be read off its pattern by a program. Gitleaks `github-app-token`
   is one regex for two families (`ghu_`, `ghs_`); TruffleHog `datadogtoken` is two keyword-gated
   lengths of which one is the legacy 40-hex key; Gitleaks `netlify-access-token` reads any
   40-46 character body beside a keyword. Whether a rule "targets" a family is a reading of
   the pinned rule file against the family's documented grammar.

## Decision

1. **The map is authored and reviewed, not generated.** `scanners/peer-rule-families.json`
   lists, for each pinned peer, the rules that target a taxonomy family, each with its
   families and the pattern evidence it was read from. It was written from the primary
   sources at the pinned revisions: the Gitleaks config (v8.30.1), the TruffleHog detector
   sources (v3.97.4, including the CLI's default enabling of every feature-gated detector), the
   flare-redact spec (v1.6.1) and OpenRedaction's `getPatterns()` (1.1.5). It is never derived from
   what a peer found on the fixtures: that would make "left readable on the inputs its rules
   target" true by construction.
2. **A rule targets a family when its pattern, with the keyword gate or wrapper it requires,
   can match a credential of that family, or it is the peer's rule for that credential class.** A rule for
   the same provider but another token class (a different prefix or shape) is not mapped. A rule
   whose name looks like a provider and is not mapped is listed in `reviewedNoFamily` with the
   reason (75 of 1,770 rules across the four peers), so "reviewed" is enforceable.
3. **Validation lives in the ledger pipeline, not in `web/`.** `benchmarks/lib/peer-rule-families.ts`
   checks that every mapped rule exists in the pinned rule file, every family exists in the taxonomy,
   the counts match, entries are sorted, and every provider-looking rule is mapped or reviewed. `npm
   run peer-rules:check` runs it (a `validate-sources` step) and `tests/peer-rule-families.test.mjs`
   runs it and its negative cases in the unit-test shards. It needs no network, no peer binary and
   no pin (the Gitleaks, TruffleHog and flare-redact ids come from `benchmarks/detector-inventory.json`,
   whose sha256 the map records; OpenRedaction's from the installed package). A new pin fails the check
   until the map is re-reviewed.
4. **Kind and description live in `scanners/peer-registry.json`**, beside the adapters but outside
   their identity: `repository-scanner` or `runtime-library`, and one sentence of what the scanner is
   built for. The validator rejects ranking words. `scanners/index.mjs`, `scanners/families.mjs`, the
   fixture index and the suite file are unchanged, so no snapshot is re-keyed.
5. **The site reads the two files through `services/peers.ts`** (validated again at build time) and
   `resolvers/peers.ts` counts, per peer and level, the inputs a peer's rules target (a fixture is
   targeted when any family it is related to is), the spans it left readable there and everywhere
   else, with redact-secret's figure on the same inputs. "Left readable" is the run's own definition
   (`PARTIAL` or `MISS`). The two slices must add up to the summary's own figure for the peer at that
   level; when they do not, or an input has no row, the columns say "Not measured". The build check
   (`web/scripts/check-export-rows.mjs`) recounts all twelve peer-by-level cells from the suite reports
   and the map, independently, and compares them with the built page.
6. **Copy states what a scanner's rules target and what was recorded, never which scanner is better.**
   The quote guidance uses the targeted slice ("On 557 provider-documented inputs that match Gitleaks
   8.30.1's default rules, ... left 68 of 564 secret spans readable").

## Consequences

- 209 rules map to 120 of the 173 families across the four peers (Gitleaks 71 of 222, TruffleHog
  78 of 892, flare-redact 37 of 81, OpenRedaction 23 of 575). The page says how many of a peer's rules
  are involved, so a small number reads as scope, not as a verdict.
- A keyword-gated rule counts as targeting the family its pattern can match beside the keyword. The
  fixtures of that family are "targeted" even when the peer's keyword is absent in a given input; the
  readable count on them is exactly what the column reports.
- Adding a peer needs an inventory, a map entry set and a registry entry; the validator names what is
  missing. Re-pinning a peer re-runs the review (the check fails until `source.revision` and `sha256`
  match the inventory).
- Rejected: generating the map from rule patterns (cannot separate families that share a shape),
  deriving it from findings (circular), editing `scanners/index.mjs` to carry it (re-keys the ledger),
  and a hand-maintained rule count (the validator compares against the pinned file).
