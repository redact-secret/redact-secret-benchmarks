# Evidence: redact-secret#308 — Databricks personal access tokens, benchmark corpus extension

**Result:** 6/6 authored positives are leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6 predates the detector); gitleaks 8.30.1
matches all 6 byte-exactly, trufflehog 3.97.4 reports none of the 21 fixtures;
0 false alarms on the 15 must-not-flag controls from any scanner.

This file records the benchmark side of
[redact-secret/redact-secret#308](https://github.com/redact-secret/redact-secret/issues/308)
("Extend the separate benchmark corpus and detector assignments, compare
default-scanner outcomes without changing expectations to fit results, and
record both FP/FN tradeoffs"), per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6) — the last release tag; it does not contain the detector. |
| `redact-secret` (detector landed) | `cea02acc5ccfa40501e4350ffd28f2728f47210f` (merge of PR #665), on `main`, unreleased at measurement time. `benchmarks/detectors.json` is refreshed to `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`, the `main` commit carrying every post-beta.6 family. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `7342b3cb2c044757914266c2eaefe1b075fe2c31`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners
(`qualification/suite-v1.json`): `redact-secret` 0.1.0-beta.6 (npm package,
default detectors), `gitleaks` 8.30.1, `trufflehog` 3.97.4 (keg at
`/opt/homebrew/Cellar/trufflehog/3.97.4/bin`, self-reported version checked in
the same shell). Run id `7001931a-afd3-4297-bb4d-e430bd5dc8b9`, all three
`complete`, replays agreed.

## What was authored (before any scanner ran)

Contract `databricks-personal-access-token` (T2, tool-corroborated:
`^dapi[0-9a-f]{32}(?:-[0-9])?$`) in `benchmarks/lib/assessment.ts`; 21
`detector-coverage` fixtures in `fixtures/generated/detector-coverage.mjs`:

- 6 positives — `bare-shape` (dapi + 32 hex) and `rotated-shape` (+ `-2`),
  each bare / quoted / Unicode-prefix+CRLF;
- 9 negative twins — length (31-byte body, backed by Microsoft Purview's
  32-character statement), alphabet (one non-hex byte), boundary (two-digit
  rotation suffix);
- 6 independent controls — `prefix-only`, `short-body`, `mask`, `reference`
  (`DATABRICKS_TOKEN=${DATABRICKS_TOKEN}`), `label-prose`, `public-id`
  (workspace host + cluster id).

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 6 positives (both shapes × 3 contexts) | secret span | MISS ×6 | EXACT ×6 | MISS ×6 |
| 9 twins | silence | silent | silent | silent |
| 6 controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives — a coverage gap of the
  pinned package, not of the corpus. Recorded as 6 `open`
  `differential-coverage-gap/databricks-personal-access-token` rows in
  `benchmarks/review-ledger.json` (gitleaks peer), each noting that PR #665
  closed the gap on `main`; they stay open until a release carrying the
  detector is pinned. No `known-gaps.json` record is opened: the product
  issue already exists and is closed, so there is nothing to promote.
- **trufflehog 3.97.4:** 6 false negatives by design — its `databrickstoken`
  detector emits a result only when a workspace domain
  (`*.cloud.databricks.com`, `*.gcp.databricks.com`, `*.azuredatabricks.net`)
  is found alongside the token; none of these fixtures pairs the two.
  Because the published redact-secret is also silent, these are agreements,
  not review-queue rows.
- **gitleaks 8.30.1:** byte-exact on every positive, including both rotation
  forms; no false alarm on any control or twin.
- **Twins:** every scanner stays silent on all nine (31-byte body, non-hex
  byte, two-digit rotation suffix), so no twin-discrimination failure is
  recorded for any tool.
- 33 mutation review-queue rows (`lexical.*`, `boundary.remove-delimiter`)
  are `not-assertable` under the D7 operator classes, as for every other
  patterned family.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH   # pinned 3.97.4, not the 3.97.6 on PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check                 # the queue this ledger covers
npm run eval -- --method=differential,benign,twin --detector=databricks-personal-access-token
```
