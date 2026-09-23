# Evidence: redact-secret#312 — Heroku API tokens, benchmark corpus extension

**Result:** 3/3 `HRKU-AA` positives and 3/3 legacy `HEROKU_API_KEY=<uuid>`
positives are leaked by the pinned published package (`@redact-secret/core`
0.1.0-beta.6 predates both detectors); gitleaks 8.30.1 and trufflehog 3.97.4
each match all 6 byte-exactly; both peers false-alarm on the `HEROKU_APP_ID=`
public-identifier control, and gitleaks additionally on the 3 legacy length
twins (its generic rule); 0 alarms on the other 14 controls and twins.

This file records the benchmark side of
[redact-secret/redact-secret#312](https://github.com/redact-secret/redact-secret/issues/312),
per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; contains neither detector. |
| `redact-secret` (detectors landed) | `c12c9e44027d53825eec5ea2addbc7b26b07be8c` (merge of PR #675) on `main`, unreleased at measurement time; registry pinned at `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `4970c8bc0af3e2d2904a99f8bafe28a2d6c0426f`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`79efc6b6-8d3a-42f6-b7c9-54f0f0ab59ca`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contracts in `benchmarks/lib/assessment.ts`: `heroku-api-key` (T1,
`^HRKU-AA[A-Za-z0-9_-]{58}$`; providerSource devcenter.heroku.com/articles/oauth:
"65 characters long and prefixed with HRKU-", worked example `HRKU-AA…`) and
`heroku-api-key-legacy` (T2 corroboration, a bare UUID with no grammar of its
own, scored as policy beside a same-line `heroku` keyword like
`twilio-auth-token`). 26 `detector-coverage` fixtures:

- current: 3 positives (`HRKU-AA` + 58 bytes × bare / quoted /
  Unicode+CRLF), 6 twins (length 64; prefix `HRKX-`), 5 controls
  (`prefix-only`, `short-body`, `mask`, `reference`, `label-prose`);
- legacy: 3 positives (`HEROKU_API_KEY=` + 8-4-4-4-12 UUID), 3 twins
  (35-character UUID), 6 controls (`missing-keyword`, `short-token`,
  `mask`, a `.netrc` `reference`, `label-prose`, `public-id` —
  `HEROKU_APP_ID=<a different uuid>`, the app id issue #312's scope requires
  to stay clean).

The changelog's 41-byte `HRKU-<uuid>` example (devcenter.heroku.com/changelog-items/2842)
is recorded on the contract as an undocumented-width variant outside the
pattern; it is neither a positive nor a control.

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 `HRKU-AA` positives | secret span | MISS ×3 | EXACT ×3 | EXACT ×3 |
| 3 legacy positives (policy) | secret span | MISS ×3 | EXACT ×3 | EXACT ×3 |
| 6 current twins | silence | silent | silent | silent |
| 3 legacy length twins (35-char UUID) | silence | silent | FLAGGED ×3 | silent |
| `public-id` (`HEROKU_APP_ID=<uuid>`) | silence | silent | FLAGGED | FLAGGED |
| 10 other controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives, a coverage gap of the
  pinned package, recorded as 12 `open` `differential-coverage-gap/heroku-api-key`
  and `…/heroku-api-key-legacy` ledger rows (one per peer per positive), each
  noting that PR #675 closed the gap on `main`; open until a release
  carrying the detectors is pinned. No `known-gaps.json` record (the product
  issue exists and is closed).
- **App-id false positive (both peers, and by construction the product's
  own keyword gate):** `HEROKU_APP_ID=<uuid>` names heroku on the same line
  as a UUID, so gitleaks's `heroku-api-key` rule (keyword + assignment +
  UUID) and trufflehog's `heroku/v1` (keyword + UUID) both flag a public
  identifier. Recorded as resolved `peer-only/<peer>/range-matches-corpus`
  rows (redact-secret 0.1.0-beta.6 is silent, matching the must-not-flag
  expectation). The product's `heroku-api-key-legacy` detector gates on the
  same substring, so this control is expected to become a candidate false
  alarm once a release carrying it is pinned; it is the tradeoff #312's
  "ordinary UUIDs, app names, and release IDs must stay clean" boundary
  asks to have recorded, not a corpus defect.
- **gitleaks 8.30.1:** 3 further false alarms on the legacy length twins —
  a 35-character value after `HEROKU_API_KEY=` no longer matches its UUID
  rule but does match its `generic-api-key` rule (keyword `key`, assignment,
  a long alphanumeric-dash value). Resolved `peer-only/gitleaks` rows.
- **trufflehog 3.97.4:** byte-exact on every positive; silent on every twin
  and, apart from the app id, on every control.
- 15 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Fixed-candidate rerun

The product candidate built from `065ec76c7978ee60c5de8412bd04b91d39c2c275`
(product `main`, which contains this detector) was run over the full corpus
after this family landed — heroku-api-key 3/3 and heroku-api-key-legacy 3/3 positives EXACT; 1 control flagged — `HEROKU_APP_ID=<uuid>`, the keyword-gate false alarm recorded above, now observed on the product itself. Run identity, artifact hashes and the
whole-suite table are in [`evidence/670/README.md`](../670/README.md) (run
`02d79b79-7718-49b6-999b-f6ce603bba50`, raw evidence
[`evidence/670/candidate-evidence-v1.json`](../670/candidate-evidence-v1.json)).
The open `differential-coverage-gap` ledger rows above describe the pinned
published package, not this candidate; they close when a release carrying
the detector is pinned.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check
npm run eval -- --method=differential,benign,twin --detector=heroku-api-key,heroku-api-key-legacy
```
