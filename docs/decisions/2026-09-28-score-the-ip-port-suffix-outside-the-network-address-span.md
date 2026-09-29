---
decision_id: decision-score-the-ip-port-suffix-outside-the-network-address-span
status: accepted
scope: benchmarks
title: Score the IP port suffix outside the network-address span
decided_at: 2026-09-28
---

# Score the IP port suffix outside the network-address span

## Context

Neither the frozen network-address contract (`evidence/875`) nor #925 says how
`203.0.113.7:8443` or `[2001:db8::1]:443` is scored: whether the span includes
the port, and whether the port counts toward the network-address family. The
#428 population left one case, `net-p-port-suffix` (`ip: 10.60.1.5:8080`),
"contract-silent": it kept no declared population mass and stayed in the
qualification-plan view, unscored (`beta11-population-v2.ts`, `C1_SILENT`).
Benchmarks #451 asks the measurement to name the rule.

This repository measures and records; it does not assert product output. The rule
therefore has to be a scoring definition that a measurement can apply, chosen so
that it does not need the product to change.

Evidence used to pick it:

- **Product, today.** Core's `pii_network_address.rs` unit test asserts
  `ranges("ip: 192.168.1.7:8080") == [(4, 15)]`: the range is the IPv4 literal and the
  `:8080` stays outside. The IPv4 right boundary accepts a following `:`. The IPv6
  left and right boundaries accept `[` and `]`, so `[fd00::1]:443` matches the
  address between the brackets. This second point is read from the code, and
  core has no test for it. Core's `detector-families.md` row already says the
  trailing period "stays outside the range, like a `:port` suffix".
- **Frozen observation.** At core `79c0a661` and at the lockfile beta.10 baseline,
  on the Node addon and Node Wasm lanes, every non-off selection returns one
  `redact` finding at bytes 4 to 13 for `net-p-port-suffix`, which is the
  nine-byte address only.
- **Peer.** Presidio's `IpRecognizer` (`presidio_analyzer`, generic
  recognizers) matches only the address, with an optional CIDR suffix. Neither its IPv4
  nor its IPv6 pattern accepts a `:port` suffix or brackets, so its span
  excludes a port. No other peer scanner in this repository's PII lanes defines an
  IP port rule, so none is cited.
- **Data-protection reasoning.** A service port identifies a service, not a
  person. The address is the personal-data element; treating the port as part of
  it would make a scorer count a redacted `:8080` as a leak.

## Decision

1. **Span.** The network-address span is the address literal only. A `:port`
   suffix stays outside the span. For a bracketed IPv6 address, `[` and `]` also
   stay outside, so `[2001:db8::1]:443` has the span `2001:db8::1`.
2. **Family.** The finding for `addr:port` is the `pii:global:network-address`
   family (type `pii_global_network_address`), decided by the address alone. The
   port is not a finding of any family and is never a separate PII cell.
3. **Sensitivity.** It follows the address, as everywhere else in the contract:
   `203.0.113.7:8443` and `[2001:db8::1]:443` are documentation ranges and stay
   non-sensitive, while `ip: 10.60.1.5:8080` is sensitive with its label.
4. **Scoring.** A finding that ends at the end of the address is exact. One that
   extends over the port is a span mismatch (`span-includes-port`), never a better
   match. Port digits left in the output are not a leak.
5. **Unbracketed `addr:NNN` is not a port form.** `fd00::1:443` is a longer IPv6
   literal by grammar and is scored as that literal.

`net-p-port-suffix` is scored under this rule: authored truth is identity `valid`
at bytes [4, 13), sensitivity `sensitive`, action `redact`. Its result, computed by
`scripts/score-pii-port-suffix.mjs` from the frozen #428 observation into
`evidence/901/451/pii-network-port-suffix-scoring-v1.json`, is 12 of 12 scored
cells `exact`: the candidate and the beta.10 baseline, on both lanes, under the `union`,
`exact` and `closure` selections. The three `off` cells show no finding. No expectation, plan or frozen evidence file was
edited: the #428 freeze stays byte for byte, and the new record is additive. It scores one case
and does not change any family's status or the six-family disposition.

## Product comparison

The rule matches current product behaviour for IPv4. The bracketed IPv6 form is
consistent with the code but untested in core. That is a missing test, not a
mismatch, so no core issue is filed. Core's family row says the same thing for
`:port` in passing and does not mention brackets. A core test or one sentence for
the bracketed form would close that gap.

## Consequences

- `pii:parity:measure` and the population scorers read one boundary rule for
  `addr:port`; the rule is stated in `docs/specs/pii-populations.md`.
- The `C1_SILENT` basis text in the frozen v2 plan still says "until the contract
  states the port rule". It is left as is because the plan is hash-frozen. This
  record supplies the rule, and a later plan set can move the case into a
  population view.
- If core ever changes to include the port in the span, this rule stops matching
  and `score-pii-port-suffix.mjs` reports `span-mismatch`. That would be a
  finding to route through the promotion lifecycle, not a reason to edit the rule
  to keep a number.
