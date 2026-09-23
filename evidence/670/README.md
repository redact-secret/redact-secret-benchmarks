# Evidence: redact-secret#670 — discord-bot-token current shapes, fixed-candidate rerun

**Result:** PASS on the benchmark gate — the product candidate built from
`065ec76c7978ee60c5de8412bd04b91d39c2c275` (product `main`, which contains the
#670 fix merged as `c053505`) detects all 6 current-shape fixtures
`known-gaps.json` record `product-670` names byte-exactly (EXACT 6/6), and
all 11 remaining Discord positives (legacy shape and context-edges) stay
EXACT with 0 false alarms on the 7 Discord controls. The published
`@redact-secret/core` 0.1.0-beta.6 still misses the same 6 (unchanged
observation). Whole suite: 0 fixed-corpus required-positive misses; 6
expanded-corpus misses remain, all outside this record (see below).

This file records the benchmark side of
[redact-secret/redact-secret#670](https://github.com/redact-secret/redact-secret/issues/670),
per [`evidence/README.md`](../README.md). `product-670` moves
`observed → reviewed → promoted → fixed` (`fix.commit` = `c053505`, proposed
manifest record `benchmark-gap-670`). It is **not** `verified`: the product's
own conformance gate is not passed — its "Artifact qualification" workflow
fails on every `main` commit from `41fc366` through `065ec76` (runs
35861814332, 35867161029, 35870455718, 35873340299) — and the product manifest
carries no record for it yet. This rerun is the benchmark half of the two-gate
rule; the record advances once both halves exist.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (candidate under test) | `065ec76c7978ee60c5de8412bd04b91d39c2c275`, `main`, clean detached worktree; contains the #670 fix (`c053505335844d763491a85eb57826cbb7aeee8a`, merge of PR #676). |
| `redact-secret` (published package, for comparison) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6). |
| `redact-secret-benchmarks` | `b385ca9202f7fee61419af67dc6ba6297491a695`, clean, branch `milocosmopolitan/new-detectors-fixture` (the commit that advanced `product-670` to `fixed`). |

## Pinned scanner versions

Candidate-only run — no peer-scanner comparison. `benchmark:candidate`
(product repo) built the three npm artifacts from the candidate worktree and
ran this repository's `eval:candidate` over the full measurement-v4 corpus
(1429 fixtures, `full-suite`, 1429/1429 scanned).

- `redact-secret-candidate` — declared version `0.1.0-beta.6` (the package
  version is unchanged on `main`), core artifact SHA-256
  `882a853f3640a0a86d458cf915329461b7559759e03a36a5bbd134f8f3bf78b4`, node
  (darwin-arm64) artifact SHA-256
  `4b2ebefb4f4663e2400d1e35df995f5be478bed5e02260da499fb618caafd08f`, wasm
  artifact SHA-256
  `8833dc3ad518ef427ab98ca2560968335043ebf510342e073109d0991f0b7575`; default
  detectors, isolated npm-tarball install with overrides, Node v22.16.0 on
  darwin arm64.
- Corpus hash `bc85ff9606f9c61e102131c6ffe27ddf62f954f1d49b3d33663b790630ee3407`
  (detector-coverage `47600c267336c2e7fc0f60f201fd59ff18d3d712d22cac2cb9873ff581a54850`).
- Run id `02d79b79-7718-49b6-999b-f6ce603bba50`, status `complete`, 0
  failures. Raw evidence: [`candidate-evidence-v1.json`](candidate-evidence-v1.json)
  (validated with `npm run eval:validate`; counts and ranges only).

## Outcomes for this record's fixtures

| Fixture | expected | published 0.1.0-beta.6 | candidate 065ec76 |
| --- | --- | --- | --- |
| `discord-bot-token-three-segments-current-new-bot-bare` | [0,72) | MISS | EXACT |
| `discord-bot-token-three-segments-current-new-bot-quoted` | [7,79) | MISS | EXACT |
| `discord-bot-token-three-segments-current-new-bot-unicode-crlf` | [21,93) | MISS | EXACT |
| `discord-bot-token-three-segments-current-reset-bot-bare` | [0,70) | MISS | EXACT |
| `discord-bot-token-three-segments-current-reset-bot-quoted` | [7,77) | MISS | EXACT |
| `discord-bot-token-three-segments-current-reset-bot-unicode-crlf` | [21,91) | MISS | EXACT |

Published-package run for the comparison column: run id
`a6fd946c-b39a-4656-940d-b0e3c73b2bca` (redact-secret 0.1.0-beta.6, gitleaks
8.30.1, trufflehog 3.97.4); neither peer detects any Discord shape in
`detector-coverage`, gitleaks detects the legacy shape only inside the
`context-edges` assignments.

## Whole-suite view of the same run

The same evidence file covers every family this branch added; per family,
positives EXACT / total and controls flagged / total on the candidate:

| Family | positives | controls flagged |
| --- | --- | --- |
| discord-bot-token | 17/17 | 0/7 |
| datadog-application-key (`ddapp_`, #671) | 3/3 | 0/7 |
| datadog-application-key-legacy (#671) | 11/11 | 0/8 |
| databricks-personal-access-token (#308) | 6/6 | 0/15 |
| confluent-cloud-api-secret / -legacy (#309) | 3/3, 3/3 | 0/12, 0/8 |
| postman-api-key (#310) | 3/3 | 0/15 |
| netlify-token (#311) | 6/6 | 0/12 |
| heroku-api-key (#312) | 3/3 | 0/11 |
| heroku-api-key-legacy (#312) | 3/3 | 1/9 — `HEROKU_APP_ID=<uuid>`, the keyword-gate false alarm `evidence/312` predicted |
| mailchimp-api-key (#313) | 6/6 | 0/12 |
| mailgun-api-key (#314) | 6/6 | 0/15 |
| okta-api-token (#315) | 6/6 | 0/15 |

Remaining expanded-corpus misses on the candidate (6, none in this record):
`microsoft-entra-client-secret-leading-dash-*` ×3 (redact-secret-benchmarks#161,
open on the product side) and `new-relic-license-key-current-format-*` ×3
(`product-672`, still `observed`). Fixed corpus: 2 negative flags after
(24 before, the beta.4 baseline), 0 required-positive misses.

## Command

Run from a clean detached worktree of the product at the candidate commit,
pointing at a clean clone of this repository at `b385ca9`:

```sh
git -C <redact-secret> worktree add --detach <scratch>/product-065ec76 065ec76c7978ee60c5de8412bd04b91d39c2c275
cd <scratch>/product-065ec76
npm run benchmark:candidate -- \
  --benchmark-ref b385ca9202f7fee61419af67dc6ba6297491a695 \
  --benchmark-repo <clean clone of redact-secret-benchmarks> \
  --output-dir <dir>
npm run eval:validate -- <dir>/candidate-evidence-v1.json   # from this repository
```
