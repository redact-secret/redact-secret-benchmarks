# Evidence: the seven second-wave detectors, contracts and corpora (#583, slices b to h)

**Result.** Published mode only. `@redact-secret/core` 0.1.0-beta.13 contains none of the eight second-wave detectors, so
all seven families read **`provisional`**, none `stable`: **127 stable of 144 scored families** (`eval:matrix`: 144 stable of
182 taxonomy families), the same as before these corpora. Nothing here is a release claim and no status was set by hand.
The candidate mode (an unpublished build of product `main`) was **not measured** in this pass; the reasons on each family
below are the published release's miss of a detector it does not have, not a verdict on the unreleased detector.

No matched plaintext or example credential is retained here; every value is built at generation time from synthetic filler.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret-benchmarks` | branch `feat/583-second-wave-corpora` on `develop` `56cee45b` |
| Published package | `@redact-secret/core` 0.1.0-beta.13 |
| Pinned peers | trufflehog 3.97.4 first on `PATH` (provisioned by `npm run peers:provision`, digests checked against `scanners/peer-checksums.json`; the host's own binary is not the pin), gitleaks 8.30.1 |
| Corpus | fixture index digest `e486ab4d8ebbc8e5a6f06c1cdd9d3093f228e8c0720050b7dd24bb73f980f254`, 6,423 fixtures |
| Classification | `4c5c6941-6190-4e86-81e8-a1c7dfea0fc4` ([`support-status-published.json`](support-status-published.json), [`support-matrix-published.json`](support-matrix-published.json)) |

```sh
export PATH="$(npm run -s peers:provision -- --dir <dir> | sed -n 's/^export PATH="\(.*\):\$PATH"$/\1/p'):$PATH"   # trufflehog --version prints 3.97.4
npm run eval:classify -- --output=evidence/583/second-wave/support-status-published.json
npm run eval:matrix -- --input=evidence/583/second-wave/support-status-published.json --output=evidence/583/second-wave/support-matrix-published.json
```

## Corpora

| Slice | Detector | Fixtures | Unclaimed twins (read T0) |
| --- | --- | ---: | ---: |
| `583b` | `xata-api-key` | 46 | 2 |
| `583c` | `sourcegraph-token` | 38 | 3 |
| `583d` | `unkey-root-key` | 55 | 5 |
| `583e` | `buildkite-token` | 61 | 5 |
| `583f` | `pydantic-logfire-token` | 50 | 9 |
| `583g` | `mapbox-token` | 40 | 2 |
| `583h` | `fly-token` | 44 | 2 |

Every fixture traces to its handoff (`docs/audits/evidence/1014/<family>.md` at `3b1a5aa`) through the contract's `references`.
Policy parts (`policy-*` fields) are never T1: the Q1 checksum post-check (Xata, Unkey), the Q7 floors (Buildkite, Pydantic
Logfire, Mapbox, Fly), the Sourcegraph union grammar and identifier cap, and the Xata width window.

## Peer lag and overreach per contract

Measured on the asserted fixtures of each corpus (T0 twins excluded). Positives are `must-redact` T1; controls are the asserted
`must-not-flag` T2 twins and benign controls. Exact / partial / miss compare each peer's spans with the authored expected span.

| Contract | Positives | gitleaks exact / partial / miss | gitleaks flagged controls | trufflehog exact / partial / miss | trufflehog flagged controls |
| --- | ---: | --- | --- | --- | --- |
| `xata-api-key` | 17 | 14 / 0 / 3 | 8 of 19 | 0 / 0 / 17 | 0 of 19 |
| `sourcegraph-token` | 13 | 11 / 1 / 1 | 6 of 16 | 9 / 0 / 4 | 0 of 16 |
| `unkey-root-key` | 18 | 13 / 0 / 5 | 14 of 26 | 0 / 0 / 18 | 0 of 26 |
| `buildkite-token` | 29 | 19 / 0 / 10 | 6 of 19 | 10 / 0 / 19 | 2 of 19 |
| `pydantic-logfire-token` | 16 | 10 / 0 / 6 | 7 of 18 | 0 / 0 / 16 | 0 of 18 |
| `mapbox-token` | 17 | 12 / 0 / 5 | 8 of 16 | 3 / 0 / 14 | 1 of 16 |
| `fly-token` | 19 | 1 / 2 / 16 | 1 of 18 | 0 / 2 / 17 | 0 of 18 |

Reading: trufflehog 3.97.4 has no rule for Xata, Unkey, Pydantic Logfire or Fly (zero exact reads) and reads Sourcegraph,
Buildkite (only `bkua_` + 40 hex) and part of Mapbox. gitleaks 8.30.1 reads most single-token shapes through
`generic-api-key` keyword assistance, so its exact reads on positives sit beside a high flag rate on twins (it flags the
length and alphabet twins, which is an overreach against the contract, not a defect of the corpus). Fly's comma-joined
bundle span is read in full by neither peer. Lag is per this corpus only; peers are measured, not ranked.

## Review queue

`queue:check` failed on 792 rows the corpora add; each is settled under the established classes
(`docs/decisions/2026-09-22-settle-differential-disagreements-on-pending-fixtures.md` and the operator classes), none by hand
outside them: 549 mutation rows `not-assertable` by operator; 167 differential rows `resolved` (the product's generic-token
detection matches the authored span and the peer is silent, a peer-only flag on a must-not-flag, or a co-detection on a
twin); 25 `not-assertable` on T0 twins; 51 differential rows stay `open`, 37 of them `differential-coverage-gap` on
positives the published release does not detect, the rest `differential-false-alarm-unconfirmed` placeholder controls and
`differential-boundary-unconfirmed` span-boundary rows. Open rows are for a person or a `promote-finding` pass.

## What this does not claim

- No candidate-mode measurement: the unpublished detectors are not measured here.
- No stable claim: the conformance and arrival gates and the open ruling questions (Q1, Q7, Q9, Q10) decide, not this page.
- The policy revision moves with any contract change; the owner re-authorised it in the same change (decision `2026-10-06-reauthorise-the-policy-revision-for-the-seven-second-wave-contracts`). That is a re-authorisation of one value: no evidence snapshot, engine or product build is accepted here.
