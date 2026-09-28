# Beta.11 PII C2: payment-card and IBAN validators vs benign collisions (benchmarks #425)

The exact released beta.10 candidate raises no false alarm on any payment-card or IBAN benign, near-miss, test-value or unsupported-shape case. It finds every IBAN sensitive case and 64 of 66 card sensitive cases. The two card misses come from one product defect, filed as [redact-secret#922](https://github.com/redact-secret/redact-secret/issues/922). No status changes.

This is development evidence for
[redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901)
(benchmark issue [#425](https://github.com/redact-secret/redact-secret-benchmarks/issues/425),
parent [#421](https://github.com/redact-secret/redact-secret-benchmarks/issues/421)). It works
through ledger axis-backlog items 12–22 of [`../pii-gap-ledger-v1.json`](../pii-gap-ledger-v1.json).
It does not edit that ledger, `evidence/875`–`880`, the v1 qualification plans or the
#423 oracle. It claims no support and promotes no status. No protected set was read or tuned.

## What was measured

| File | Content |
| --- | --- |
| [`payment-card-stress-v1.json`](../../../benchmarks/evaluation/domains/pii/card-iban-stress/payment-card-stress-v1.json) | 157 card cases, axes 12–18 |
| [`iban-stress-v1.json`](../../../benchmarks/evaluation/domains/pii/card-iban-stress/iban-stress-v1.json) | 85 IBAN cases, axes 19–22 |
| [`card-iban-stress-observation-v1.json`](card-iban-stress-observation-v1.json) | per-case public findings (type, detector, action, UTF-8 range) and redaction booleans, for 2 sides × 2 families × 4 lanes |
| [`card-iban-stress-report-v1.json`](card-iban-stress-report-v1.json) | the scored report; it re-scores byte for byte from the observation |

Plans are generated from the authored truth in
[`authoring.ts`](../../../benchmarks/evaluation/domains/pii/card-iban-stress/authoring.ts) and
must match byte for byte. Each case states its contract identity and sensitivity by hand.
Plan validation then checks, mechanically:

- **Contract identity.** A benchmark-side model of the frozen `payment-card-v1` and `iban-v1`
  text ([`contract-model.ts`](../../../benchmarks/evaluation/domains/pii/card-iban-stress/contract-model.ts))
  re-derives identity. It covers brand ranges and lengths, the `4-4-4-4`/`4-6-5` layouts,
  the 89 Release 103 country lengths and the print grammar.
- **#423 oracle labels.** Every case carries one. The unchanged shared validator checks them
  with the Luhn and ISO 13616 mod-97 reference validators applied to the authored
  candidate, never to detector output.
- **Plan structure.** It checks the reviewed `pii-context/v1` field form behind every
  `sensitive` label, one-property twins, view denominators, declared masses and
  independence minimums.

A checksum pass only establishes structure. The identity basis cites the validator, while
sensitivity needs the contract context rule, or for card only, an exact Visa Acceptance
test value.

Expectations were frozen and committed before any scan (`8564906`). One pre-evidence
revision (`bd9f66f`) replaced two 10-digit constructions that used an assignable area code
with unassignable `400`/`555-01xx` shapes. The expectations were unchanged. The earlier
observation of the first freeze was discarded unrecorded. The recorded run binds plans at
`bd9f66f` (commitments in the report).

## Artifacts

- **Candidate.** `@redact-secret/core`, `node-darwin-arm64` and `wasm` `0.1.0-beta.10`,
  packed from the registry. The facade SHA-1, the addon binary SHA-256 and all eight Wasm
  package-file SHA-256 digests equal the release-manifest digests frozen in the ledger
  (`af7f863f`). This is the cheapest faithful path, because those tarballs are what the
  release workflow published from that commit. A source rebuild would produce a
  different artifact.
- **Baseline.** The lockfile release `0.1.0-beta.9` (`f726f2ff`), checked against the
  lockfile integrity, as in `pii:observe:populations`. It ships no PII family, so every
  baseline sensitive case is a miss and every absence case is trivially clean.
- **Lanes.** Node addon and Node Wasm fallback, each under `pii:global`+`pii:us` (the
  plan's scope, all six families active for cross-family) and under the exact-family
  selector.
- **Platform.** `darwin-arm64`, Node 22.16.0. No peer scanner ran, and no credential stable
  count is claimed in either mode.

## Results (candidate, `pii:global`+`pii:us`; addon and Wasm identical)

| Family | Sensitive detected | Validator correctness (checksum/range/length/country rejects absent) | Semantic collision (identity valid, sensitivity not established, absent) | Official test value absent | Unsupported shape absent | Non-`redact` action | Value left after redaction (detected) | Sensitive left in output (missed) | Collateral (outside text changed / credential findings) | Cross-family findings (none-expected violations) | Identity-only |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| payment-card | 64/66 | 41/41 | 29/29 | 10/10 | 11/11 | 0 | 0 | 2 | 0 / 0 | 0 (0) | not measured (core#910) |
| iban | 34/34 | 18/18 | 17/17 | 0/0 (no authority value) | 16/16 | 0 | 0 | 0 | 0 / 0 | 2 card findings on not-authored cases (0) | not measured (core#910) |

Baseline beta.9 detects 0/66 card and 0/34 IBAN. The candidate has **no regression**
against it: 64 card and 34 IBAN cases improve, and 2 card cases stay wrong.

### Views (declared denominators and masses, `pii:global`+`pii:us`)

Each view's members are explicit case ids, and each evidence-class stratum gets a
declared mass. `diagnostic-balanced` weighs present classes equally. `benign-heavy-stress`
puts 1% on sensitive. The miss rate uses a stratum's sensitive members and the
false-alarm rate uses its non-sensitive members, so the two are never blended.

| Family | View | Denominator | Sensitive detected | Non-sensitive false alarms | Weighted miss | Weighted false alarm |
| --- | --- | --- | --- | --- | --- | --- |
| payment-card | qualification-plan | 110 | 60/62 | 0/48 | 0.258 | 0 |
| payment-card | diagnostic-balanced | 157 | 64/66 | 0/91 | 0.258 | 0 |
| payment-card | benign-heavy-stress | 51 | 9/9 | 0/42 | 0 | 0 |
| iban | qualification-plan | 43 | 33/33 | 0/10 | 0 | 0 |
| iban | diagnostic-balanced | 85 | 34/34 | 0/51 | 0 | 0 |
| iban | benign-heavy-stress | 42 | 1/1 | 0/41 | 0 | 0 |

The card weighted miss rate is high by design: one of the two sensitive members of the
equally weighted `cross-family-collision` stratum is the #922 case.

Korean: card 10/10 sensitive detected and 10/10 Korean negatives absent. IBAN 5/5 sensitive
detected and 4/4 negatives absent.

### Independence (recomputed from the plans)

| Family | Cases | Distinct positive values | Dominant value share | Positive constructions | Korean positives | Declared twins (value / layout / context) |
| --- | --- | --- | --- | --- | --- | --- |
| payment-card | 157 | 59 | 0.064 | 5 | 10 | 70 (40 / 16 / 14) |
| iban | 85 | 29 | 0.106 | 2 | 5 | 29 (4 / 11 / 14) |

Before this issue the ledger recorded 4 distinct card positives, with one value in 12 of
19 cases and no Korean case. IBAN had 1 positive value in 18 of 21 cases and one country.
The stress plans cover every frozen card brand, range edge and length bound (10/19 in,
9/20 out). IBAN covers 24 Release 103 countries and every Release 103 length from 15 to 33 (the registry has no 17).

## Findings

1. **Product defect → [redact-secret#922](https://github.com/redact-secret/redact-secret/issues/922).**
   A 10-digit value can be both a Luhn-valid Visa-range PAN and a NANP-shaped number.
   Under `pii:global`, the phone alternative at the identical range makes the
   `card_number` label "equidistant from two candidates", so the card finding is lost.
   Both affected cases are found under the exact card selector. The same mechanism hides a
   Luhn-valid phone number under `phone:` (#426's family, same root cause). Under the
   arbitration ADR, each alternative evaluates its own sensitivity.
2. **Contract false negative (not filed, literal `pii-context/v1`).** A field label that
   sits one scalar after an earlier candidate on the same line is equidistant and
   unassociated, for example `ip=… card_number=…` or `card_number=… iban=…`. With `; `
   in between, the value is found. Under the exact-family selector the earlier candidate
   is not selected, so the value is found (the 2 selection-dependent cases). The number of
   selected families therefore changes this outcome. This is a policy question for #901.
3. **Contract behaviour confirmed as authored.**
   - The unspaced Korean `카드번호` is not a `pii-context/v1` form, so a card under it is
     not redacted.
   - A parenthesised `(예시)`/`(example)` is not the whole example label and does not
     suppress. Whole `예시`/`example`/`documentation` labels before or after the value do.
   - All 7 supported-brand Visa Acceptance test values stay absent in compact and display
     layouts. A value that only shares the Visa test BIN, or sits under a `test` word,
     is still redacted.
   - The 3 Maestro test values and the published Discover test value's `601111` neighbour
     are out of claim.
   - The Luhn-blind `09→90` transposition twin is redacted, as the validator contract
     predicts.
4. **IBAN authority gap (recorded, no control invented).** `pii-v1`/`iban-v1` name no
   authority-reserved or test IBAN. Release 103 is frozen for country/length rows only,
   and its per-country examples carry no negative authority. The registry download also
   returned HTTP 403 on 2026-09-28. The IBAN `valid/non-sensitive` cell therefore stays 0.
5. **Cross-family.** An `AT` print IBAN whose four BBAN groups form a Luhn-valid Visa PAN
   yields only the IBAN finding under `iban:` and nothing under `card number:`. Other
   PII-family findings appeared only as the expected card finding in the two not-authored
   card+IBAN line cases. No credential detector fired on any case.

## Not measured here

- **Identity-only outcomes.** These are typed `not-measured` with
  `product-identity-seam-unavailable` until the redact-secret#910 seam exists (91 eligible
  card cases, 51 IBAN).
- **Owned by other issues.** Output bytes beyond the two leakage booleans, incremental
  sessions, browser Wasm and mixed documents belong to #427. Protected partition, cost and
  exact beta.11 binding belong to #428.

## Reproduce

```sh
npm ci
node --import tsx scripts/generate-pii-card-iban-stress.mjs --check
node --import tsx --test tests/pii-card-iban-stress.test.mjs   # includes the byte-for-byte re-score
node --import tsx scripts/observe-pii-card-iban-stress.mjs      # re-observes (needs npm registry access; refuses uncommitted plans)
```
