---
decision_id: decision-measure-batch-1-with-a-focused-corpus-before-any-full-run
status: accepted
scope: benchmarks
title: Measure Batch 1 with a focused corpus before any full run
decided_at: 2026-10-05
---

# Measure Batch 1 with a focused corpus before any full run

## Context

#717 asks for an independent baseline and a candidate replay of five bounded credential candidates (Figma, Asana, Airtable, Elastic ApiKey, Canva) from credential-evidence#232, ahead of the other 101 candidates, with no full performance run and no peer dependency. Adopting them into the evidence snapshot, the ledger and the support matrix is the qualification pipeline's job and is slower than the question needs.

## Decision

1. **A focused corpus owned here, authored from the issue's contract only.** `benchmarks/batch1/corpus.mjs` holds 82 cases with exact UTF-8 byte spans, an expected action, positive, control and unsupported classes, and the provider fact kept apart from the project-policy expectation per family. Values are seeded SHA-256, never scanner output.
2. **Measure product surfaces directly, product only.** Node, WASM, Python and CLI, whole and streamed, on the published packages and on an exact candidate build. No peer runs, so no TruffleHog classification and no peer disagreement; peers stay diagnostic and out of this lane.
3. **Unsupported variants are observed, not scored.** Bare prefixes, a key id alone, newline-separated values and prefixed header names carry no pass or fail. One class change was made after the first baseline (prefixed header names moved from control to unsupported, because such a header can carry the same credential) and is recorded in the evidence README.
4. **Route measured gaps only.** A generic pass is coverage validation. The baseline routes Airtable `macSecretBase64` and Elastic `ApiKey` (misses) and the Figma placeholder control (false positive) to the open core issues; Asana and Canva are no-code dispositions.
5. **The replay needs an implemented candidate, and it ran.** The harness replays any build unchanged against the same corpus. Current core `d4e86769` changed no case; the exact candidate `af1e71e0` (redact-secret#1215) fixed all 15 misses and the placeholder false positive with 0 regressions and full surface and stream agreement. The disposition is an exploratory replay for that exact commit, not an official run and not a support promotion.

## Consequences

`tests/batch1.test.mjs` pins corpus invariants and refuses observations from a different corpus; no test asserts a ledger value or a support status. The recorded run is exploratory evidence in `evidence/717/` and changes no pin, run, ledger row or authority. Spec: `docs/specs/batch1-focused-qualification.md`.
