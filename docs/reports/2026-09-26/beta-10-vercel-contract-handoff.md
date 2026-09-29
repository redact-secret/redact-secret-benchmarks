# Beta.10 Vercel contract handoff

Research context: [benchmark #367](https://github.com/redact-secret/redact-secret-benchmarks/issues/367),
[benchmark #373](https://github.com/redact-secret/redact-secret-benchmarks/issues/373),
[product #858](https://github.com/redact-secret/redact-secret/issues/858), and
the superseded product audit [#516](https://github.com/redact-secret/redact-secret/issues/516).

## Pinned decision

- Benchmark integration input: `ca39f9cb190e558acc950e77b669632f9ffda60e`.
- Frozen benchmark baseline: `4366b6a5ed03ac3633d9ae86063d23fce2169edb`.
- Product contract baseline: `266204c87126a9de2c0ff28e7913bccabebd1d98`.
- Reviewed product contract decision: `f5f91cbe1d3250dc99e32332477915e0e45a94cf`.

The product decision changes no runtime detector. It records five modern
semantic classes separately, keeps each positive contract pending/T0, and
leaves opaque unprefixed examples outside the modern positive contract.

## Safe benchmark representation

The runtime `vercel-token` detector and its `vercel_token` finding type are an
aggregate compatibility surface. They cannot attribute a match or the existing
fixture corpus independently to one of the five reviewed semantic contracts.
The existing `vercel:access-token` taxonomy row therefore remains only as a
bounded compatibility aggregate. It is not a provider credential-family claim.

Each modern family is a separate taxonomy row with no attributed detector.
Consequently the support matrix represents it as Pending with no dedicated,
measurable rule and with `null` fixture/profile coverage. This does not re-tier
the product contract: the underlying positive grammar remains pending/T0. `null`
means unmeasured and blocked; it must not be rendered as `0/24`, because no
approved positive contract exists against which such a profile could be
scored.

| Modern family | Evidence-backed marker | Benchmark status/profile | Exact evidence needed to unblock |
| --- | --- | --- | --- |
| `vercel:personal-access-token` | `vcp_` | no independently attributable detector; profile unmeasured/blocked | A reviewed complete body grammar and boundary; provider clarification of the unprefixed `bearerToken` example versus `prefix: vcp_`. |
| `vercel:integration-token` | `vci` stem only | no independently attributable detector; profile unmeasured/blocked | Provider-controlled evidence that `_` is literal, followed by a reviewed complete body grammar and boundary. |
| `vercel:app-access-token` | `vca_` | no independently attributable detector; profile unmeasured/blocked | A reviewed complete body grammar and boundary; the single opaque example is not a universal rule. |
| `vercel:app-refresh-token` | `vcr_` | no independently attributable detector; profile unmeasured/blocked | A reviewed complete body grammar and boundary backed independently of the reused app-access example body. |
| `vercel:api-key` | `vck_` | no independently attributable detector; profile unmeasured/blocked | A reviewed complete body grammar and boundary; provider masking/labeling code proves only the marker. |

Opaque or unprefixed values remain outside all five modern positive contracts.
They need either a provider-stated lexical contract or a separately reviewed,
context-bounded generic contract. Example width alone is insufficient.

## Why the old five-cell debt does not move

At the frozen baseline, the aggregate `vercel-token` profile measured
`20 / 15 / 5 / 0 / 1 / 3 / 3` (total / non-twin positives / benign controls /
twins / positive axes / control axes / confusion axes), with five reported
arrival-profile debt cells. Those 20 fixtures were generated from the runtime's
five unreviewed prefix-plus-suffix branches: three wrappers for each branch,
plus five aggregate controls. Repeated wrappers do not establish independent
contexts, and the product contract rejects the suffix floor/alphabet as
provider-backed grammar.

Accordingly:

- none of the 15 aggregate positives is transferred to a modern family;
- no prefix-only or short-body control is promoted to a semantic negative;
- no sibling credential is treated as globally benign;
- no twin is authored without a reviewed property whose mutation falls outside
  every supported class; and
- the aggregate's five debt cells remain compatibility-history measurements,
  not five debts copied onto each split family.

No issued, real-derived, or provider-example credential value was used in this
record. No new fixture was authored.
