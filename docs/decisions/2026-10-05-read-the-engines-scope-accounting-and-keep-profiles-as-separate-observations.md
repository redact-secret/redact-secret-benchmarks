---
decision_id: decision-read-the-engines-scope-accounting-and-keep-profiles-as-separate-observations
status: accepted
scope: benchmarks
title: Read the engine's scope accounting, never recompute it, and keep a credential profile as a separate observation that changes no score or denominator
decided_at: 2026-10-05
---

# Read the engine's scope accounting, never recompute it, and keep a credential profile as a separate observation that changes no score or denominator

## Context

#724 (parent #723). In an OpenRedaction artifact 359,522 of 360,782 findings carried no family, and a missing family hid whether a finding was personal data, a resource identifier, a credential nobody mapped, an ambiguous type or an artifact that recorded no label. credential-eval ADR 0011 now preserves the native label, ADR 0012 reviews all 575 types, and ADR 0016 (credential-eval#58) makes the engine write `scope_accounting` for every complete scanner with a reviewed table.

## Decision

1. **The engine classifies; this repository reads.** `benchmarks/qualification/scope-accounting.ts` carries the engine's counts into the qualification view (`populations[].scope`, `methodsScope`, `profileEffects`). It never classifies a finding, filters a RunArtifact finding, changes a case outcome, a floor, a denominator or a status, and never reads `non_semantic`. An accounting that does not reconcile to the findings the artifact retains (dispositions sum, family-carrying findings, label-less findings, per-label counts, multi-label count) is refused at build time.
2. **Four axes stay apart.** Native type (what the scanner said), derived family (the adapter's), reviewed scope with its reason (the engine's table) and absence. An unknown native label (`~unrecognized`) is not an absent family; both are counted separately.
3. **Unknown is a word.** An artifact of an engine before contract v1.8 is legacy: coverage and every disposition are null and shown as "Unknown", never as zero unmapped, and nothing is classified retrospectively. A scanner with no reviewed table or one that did not complete is "Not accounted" / "Not measured". A completed scanner with no findings is a measured zero.
4. **Declared credential profile.** `scanners/peer-registry.json` (the #558 registry; no second registry) names the diagnostic profiles of a peer and their declared scope. A profile is a separate scanner identity; its results sit beside the default result, never in its place, and are never spliced. Scoring is unchanged: no finding is excluded, twin scoping and differential review read the same cases, method comparisons stay per scanner, and the evidence denominators are carried next to the comparison (`denominatorsEqual`). Unknowns are neither automatic false positives nor ignored. A scoring exclusion would need its own reviewed, version-bound record and visible report; none exists.
5. **Origin and limits.** Each row shows configuration, configuration hash, adapter version, engine version, classification table and accounting version, native-label coverage and fixed limits. Per-scanner measured or reused origin lives in operational telemetry (`non_semantic`) and run receipts, which this reader does not take as evidence; the page does not claim an origin the semantic artifact does not carry.
6. **The reader's schema stays the accepted one.** Reading an artifact that carries the new fields needs the engine's v1.8 schema, which is vendored with an engine repin through the evidence-adoption path (#690/#697), never here. This change therefore reads `scope_accounting` from artifacts already validated and does not touch the registry pin or any recorded run.

## Consequences

Out-of-scope personal-data findings are visible as diagnostics and are not advertised as credential detections; a smaller finding count from a profile is shown as a configuration effect and not as better accuracy. Until a v1.8 artifact is adopted the live pages show "Unknown" for every OpenRedaction row.
