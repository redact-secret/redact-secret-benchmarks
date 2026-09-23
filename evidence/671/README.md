# Evidence: redact-secret#671 — ddapp_-prefixed Datadog application keys, benchmark follow-up

**Result (published package):** the 3 `ddapp_` positives `known-gaps.json`
record `product-671` names are still leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6) and by both pinned peers (gitleaks 8.30.1,
trufflehog 3.97.4: 0/3 each); the legacy 40-hex generation, now its own
`datadog-application-key-legacy` family, is detected exactly by the published
package and gitleaks (11/11 positives) and missed by trufflehog. The
fixed-candidate rerun below closes the benchmark gate: the candidate built
from product `main` (`065ec76`) detects all three `ddapp_` fixtures exactly.

This file records the benchmark side of
[redact-secret/redact-secret#671](https://github.com/redact-secret/redact-secret/issues/671)
("Rerun the independent benchmark and preserve measured failures"), per
[`evidence/README.md`](../README.md). The known-gap record `product-671`
moves `observed → reviewed → promoted → fixed` in the same change
(`fix.commit` = the merge of PR #679); `verified` waits for the product's
own conformance gate, whose "Artifact qualification" run on that merge commit
did not pass (run 35870455718), and for the rerun below.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; predates the split. |
| `redact-secret` (fix landed) | `2ca56a29ea19f93ec111370a5d4a8115cb8ddf33` (merge of PR #679) on `main`, unreleased at measurement time; registry pinned at `065ec76c7978ee60c5de8412bd04b91d39c2c275`. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `70214315a2f208670bad90710aab08dc43051163`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`aee0ba68-c99a-4afe-9223-84f2f606bc85`, all three `complete`, replays agreed.

## What changed in the corpus

The product split the bare 40-hex shape into `datadog-application-key-legacy`
(PR #679), so `benchmarks/detectors.json` mirrors that id and the legacy
fixtures follow it: `env-marker` positives (3), `missing-marker`, `short-key`
in `detector-coverage`, and the eight `context-edges` contexts, all re-assigned
from `datadog-application-key`; a length twin (39-byte body) and `mask` /
`reference` / `label-prose` controls were added so the new family carries the
seven arrival evidence kinds. `datadog-application-key` keeps the `ddapp_`
contract, its prefix twin and controls, with its mask now in the `ddapp_`
shape. No expectation was changed.

## Outcomes, per scanner (published package)

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 `ddapp_` positives (product-671's fixtures) | secret span | MISS ×3 | MISS ×3 | MISS ×3 |
| 3 `ddapp_` prefix twins (`ddapx_`) | silence | silent | FLAGGED ×3 (generic rule) | silent |
| 11 legacy positives (3 detector-coverage + 8 context-edges, policy) | secret span | EXACT ×11 | EXACT ×11 | MISS ×11 |
| 3 legacy length twins | silence | silent | FLAGGED ×3 (generic rule) | silent |
| legacy and current controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **`ddapp_` shape:** no pinned scanner recognizes it — the same observation
  `product-671` recorded; both peers are silent, so these stay agreements
  rather than review-queue rows. gitleaks's `generic-api-key` rule flags the
  `ddapx_` prefix twins (resolved `peer-only/gitleaks` rows).
- **legacy shape:** the published package and gitleaks agree byte-exactly on
  every marker-gated positive; trufflehog's `datadogtoken` detector is silent
  on all of them (11 resolved `redact-secret-only/trufflehog` rows). gitleaks's
  generic rule also flags the 39-byte twins.

## Fixed-candidate rerun

**PASS on the benchmark gate.** The product candidate built from
`065ec76c7978ee60c5de8412bd04b91d39c2c275` (product `main`, containing the
#671 fix merged as `2ca56a2`) detects all 3 `ddapp_` fixtures `product-671`
names byte-exactly (EXACT 3/3) and all 11 legacy positives (EXACT 11/11),
with 0 false alarms on the 15 Datadog application-key controls. Full run
identity, artifact hashes, corpus hash, the whole-suite table and the command
are in [`evidence/670/README.md`](../670/README.md), which shares the same
run (`02d79b79-7718-49b6-999b-f6ce603bba50`, full suite, 1429/1429 scanned)
and raw evidence file [`evidence/670/candidate-evidence-v1.json`](../670/candidate-evidence-v1.json).

| Fixture | expected | published 0.1.0-beta.6 | candidate 065ec76 |
| --- | --- | --- | --- |
| `datadog-application-key-prefixed-env-marker-bare` | [19,59) | MISS | EXACT |
| `datadog-application-key-prefixed-env-marker-quoted` | [26,66) | MISS | EXACT |
| `datadog-application-key-prefixed-env-marker-unicode-crlf` | [40,80) | MISS | EXACT |

`product-671` stays `fixed`, not `verified`: the product's own conformance gate
("Artifact qualification") fails on every `main` commit from `41fc366`
through `065ec76`, and the product manifest carries no record for it yet.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check
npm run eval -- --method=differential,benign,twin --detector=datadog-application-key,datadog-application-key-legacy
```
