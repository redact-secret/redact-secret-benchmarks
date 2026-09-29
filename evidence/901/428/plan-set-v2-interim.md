# #428 population plan set v2: interim validation on core `79c0a661`

**Interim evidence only.** This record re-runs the [#428 interim candidate](README.md) (core `79c0a66119fb72931fda9adddbe2973a52bb4833`) with the new population plan set `b11-population-v2`. It checks that the new plans close the benchmark-side population gaps on the gates that are not about cost. It is not the final beta.11 record and makes no support claim. The v1 interim record (`pii-beta11-*-v1.json`, `README.md`) is unchanged.

## What changed in the plans

`b11-population-v2` ([`beta11-population-v2.ts`](../../../benchmarks/evaluation/domains/pii/beta11-population-v2.ts)) adds one new plan per family. Each is derived from its frozen predecessor, which stays committed and unedited:

| Family | New plan | Predecessor |
| --- | --- | --- |
| network-address | `network-address-population-plan-v2.json` | `network-address-population-plan-v1.json` |
| email | `email-population-plan-v3.json` | `email-population-plan-v2.json` |
| payment-card | `card-iban-stress/payment-card-stress-v2.json` | `payment-card-stress-v1.json` |
| iban | `card-iban-stress/iban-stress-v2.json` | `iban-stress-v1.json` |
| us-ssn | `us-ssn-stress-v3.json` | `us-ssn-stress-v2.json` |
| phone | `phone-stress-v3.json` | `phone-stress-v2.json` |

Each new plan:

- keeps every predecessor case;
- carries the 14 pre-registered pii-context/v2 revisions and the three #426 corrections as native authored truth, so no overlay applies;
- declares population mass again under pii-context/v2. The emptied strata are gone: email `atext-joined-context` and `equidistant-unassociated` now have v2-benign members, network `dense-equidistant` is retired, and `net-dense-unassociated` is new. The contract-silent `net-p-port-suffix` keeps no mass and sits in the qualification-plan view only;
- appends new synthetic cases with #423 oracle labels. These cover email benign-heavy context twins, sensitive IBAN documentation-control twins, US SSN context twins, and phone 555 candidate twins. They also exercise #927: `Ip 주소`/`IP 주소`, `클라이언트 IP`, `이메일 주소`, `EMAIL ADDRESS`, `E-mail Address`, `카드번호`, `신용카드번호` and `직불카드번호`.

No new case depends on redact-secret#940. `npm run pii:beta11:plans -- --check` regenerates every plan byte for byte, and `tests/pii-beta11-population-v2.test.mjs` validates them.

## Result (freeze `4de7944`, report `2df3afca…`, disposition `0b112a30…`)

All six families stay `pending`. Every public gate that is not about cost is met, and there are 0 reviewed deviations and 0 regressions against the lockfile beta.10. The only failed or withheld gates are `runtime-and-package-cost`, `size-regression-budget`, `profile-cost` and `protected-partition` (not run). All six are eligible for a protected run except for cost; no protected run or epoch was spent.

| Family | Diagnostic-balanced sensitive | Diagnostic twins | Benign-heavy sensitive | Benign-heavy non-sensitive FA | Benign-heavy twins |
| --- | --- | --- | --- | --- | --- |
| network-address | 41/41 | 17 | 24/24 | 0/19 | 8 |
| email | 44/44 | 20 | 12/12 | 0/11 | 7 |
| payment-card | 71/71 | 59 | 13/13 | 0/10 | 5 |
| iban | 39/39 | 27 | 5/5 | 0/0 (by contract) | 4 |
| us-ssn | 9/9 | 5 | 7/7 | 0/0 (by contract) | 4 |
| phone | 9/9 | 5 | 7/7 | 0/7 | 4 |

IBAN and US SSN have no authority-reserved value by contract. Their `non-sensitive-flag-rate` therefore has no denominator and is `not-applicable`.

Rerun on the final candidate with `npm run pii:beta11 -- --core-commit=<sha> --core-repo=<path> --role=final`. It uses plan set v2 by default and writes `pii-beta11-*-v2.json`.
