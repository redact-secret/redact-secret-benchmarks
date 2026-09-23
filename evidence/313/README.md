# Evidence: redact-secret#313 — Mailchimp Marketing API keys, benchmark corpus extension

**Result:** 6/6 authored positives are leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6 predates the detector); gitleaks 8.30.1
and trufflehog 3.97.4 each match all 6 byte-exactly (gitleaks the single-digit
data-center keys via its generic rule, not its Mailchimp rule); gitleaks
false-alarms on all 6 twins and 2 near-miss controls through the same generic
rule, trufflehog on none; 0 alarms on the other 4 controls.

This file records the benchmark side of
[redact-secret/redact-secret#313](https://github.com/redact-secret/redact-secret/issues/313),
per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; does not contain the detector. |
| `redact-secret` (detector landed) | `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1` (merge of PR #678) on `main`, unreleased at measurement time; this is also the registry pin. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `6b990a50624673826561a337ca6ed50183e9e7bc`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`6bd09836-da37-4bc1-9a37-45e8ff296d52`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contract `mailchimp-api-key` (T2, tool-corroborated: `^[0-9a-f]{32}-us[0-9]{1,2}$`;
mailchimp.com/developer documents the shape only by a worked example whose
body is 31 hex bytes, so the 32-byte body rests on both pinned tools and the
`us<N>` suffix on the provider example, which backs the marker twin). Every
positive sits in a `MAILCHIMP_API_KEY=` assignment: the product's frozen
grammar requires a same-line `mailchimp` keyword and gitleaks's rule a keyword
plus an assignment, so this is the context both gates share. 18
`detector-coverage` fixtures:

- 6 positives — `<32 hex>-us6` and `<32 hex>-us21`, each bare / quoted /
  Unicode-prefix+CRLF;
- 6 negative twins — length (31-byte body, two-digit shape), marker
  (`-eu6`, single-digit shape);
- 6 independent controls — `missing-marker` (32 hex, no suffix),
  `short-key`, `mask`, `reference`, `label-prose`, `public-id` (audience id
  and server prefix).

A key with no `mailchimp` keyword on its line is an accepted product false
negative and is not fixtured, per the `new-relic-license-key` precedent for
keyword-gated grammars; the contract review records it.

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 single-digit (`-us6`) positives | secret span | MISS ×3 | EXACT ×3 (generic rule) | EXACT ×3 |
| 3 two-digit (`-us21`) positives | secret span | MISS ×3 | EXACT ×3 | EXACT ×3 |
| 6 twins (31-byte body; `-eu6`) | silence | silent | FLAGGED ×6 | silent |
| `missing-marker`, `short-key` | silence | silent | FLAGGED ×2 | silent |
| `mask`, `reference`, `label-prose`, `public-id` | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives, a coverage gap of the
  pinned package, recorded as 12 `open` `differential-coverage-gap/mailchimp-api-key`
  ledger rows (one per peer per positive), each noting that PR #678 closed
  the gap on `main`; open until a release carrying the detector is pinned.
  No `known-gaps.json` record (the product issue exists and is closed).
- **gitleaks 8.30.1:** its `mailchimp-api-key` rule requires exactly two
  data-center digits (`-us\d\d`), so it cannot match the provider's own
  single-digit example shape; the single-digit positives are nevertheless
  reported byte-exactly because its `generic-api-key` rule (keyword `key`,
  assignment, long value) fires on the same line. That generic rule is also
  what flags all six twins and the two near-miss controls — 8 false alarms
  against authored silence, recorded as resolved
  `peer-only/gitleaks/range-matches-corpus` rows. Precision against this
  family's twins therefore rests on the Mailchimp-specific rules of
  trufflehog and the product, not on gitleaks's default set.
- **trufflehog 3.97.4:** byte-exact on all six positives (its `mailchimp`
  detector accepts one or two digits and needs no keyword) and silent on
  every twin and control.
- 33 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check
npm run eval -- --method=differential,benign,twin --detector=mailchimp-api-key
```
