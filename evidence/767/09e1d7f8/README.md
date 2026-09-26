# Final beta.9 explainable-evidence qualification

**Result:** QUALIFIED as a reproducible, non-enforcing shadow-scoring
foundation. **Not promotable:** scorer-driven enforcement remains deferred.

This replacement record binds core
`09e1d7f85cd2ada9f387cc5c9beef3b29023d17d` to benchmark
`90332d55e0a1f4f8002ed55a30eb7951bdf25bbb`. The earlier record under
[`evidence/767/README.md`](../README.md) remains historical for core
`93ddf510…` and benchmark `853149ff…`.

## Immutable identities

| Item | Identity |
| --- | --- |
| Product | clean `09e1d7f85cd2ada9f387cc5c9beef3b29023d17d`; `@redact-secret/core@0.1.0-beta.9` |
| Local candidate package / Node / WASM SHA-256 | `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` / `26815f44fcc4ecb859c991f63ec17167bebbadc0b28842dd4ab2fa1a1b9ac77d` / `9784a4bddbb0cd5bffb290b57a5d6fe9df4642b7148abe0713c978ffcb7c2375` |
| Qualified Linux package / Node / WASM SHA-256 | `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` / `84c33b02d012e614faddf6c0788d964dd621642819e964725e8f5a6b03973bcc` / `65cb5b74f55a8c8feba34829846fd5e26e02515065b6933ebd3c30c0a38815d7` |
| Benchmark | clean `90332d55e0a1f4f8002ed55a30eb7951bdf25bbb`; lockfile `2fd997ca616a659b7801cf630bfde2441b2df106499df3cfc86b6aee016d568b` |
| Candidate scanner | configuration `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783` |
| Scoring | artifact revision 3; model `4104fb2c6f046169f63e991dd7594c099af5fcea01deecae7afe1c7015579975`; identity `838aa57db8e2331c8540a42da823ffda8802d681952f4dc7af20e6001c5693a2` |
| Feature dataset | `candidate-features/2`; dataset `4ea0a82f61b719b4611f8e7e2caafd01edda5b5dfa7c2691bffd6ac17d0e199c`; schema `evidence-features/v1` |
| Calibration | selection `23683daf5738b9cf3de583ade589f06677cfb2bcf581bff38e889b1eddae9509`; public projection SHA-256 `86cb787d57541cf7e2181dafef4e4bebd92ab38fbcccadf26b1c00e6f3bbf284` |
| Fixed corpus | measurement-v4 `c30b888ffe9bde280e01373aa52238a512628ecabb5b797acd7457b4d36de950` |
| Performance policy | `regression-budgets-v1`, beta.8 baseline; exact source-bound CLI size tradeoff in [`evidence/772/09e1d7f8/README.md`](../../772/09e1d7f8/README.md) |

## Exact runs

- Candidate run `132da664-30d9-4fc6-b6b3-39265c9ae870`, complete: 2,990
  selected/scanned/written fixtures and no execution failures. Sanitized result:
  [`candidate-evidence-v1.json`](candidate-evidence-v1.json).
- Core [Artifact qualification 36243644354](https://github.com/redact-secret/redact-secret/actions/runs/36243644354)
  and [SAST 36243644250](https://github.com/redact-secret/redact-secret/actions/runs/36243644250): success at the exact source.
- [Performance evaluation 36245241233](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36245241233):
  exact benchmark/core sources, accepted with 46/46 checks and no failures;
  all 36 applicable regression-budget triggers were within budget.
- Blind run `95310b97-5b2e-4838-a297-5f95009388f1`: complete on the fresh
  `beta9-e2` epoch. Its separate record is
  [`2026-09-26-beta9-142-blind-evaluation-e2.md`](../../../docs/reports/2026-09-26-beta9-142-blind-evaluation-e2.md).

Pinned peer preflight reported TruffleHog `3.97.4`. Candidate-mode support
classification measured 74 scorer families: 63 stable (39 documented, 24
empirical), 10 provisional, 1 pending and 0 unsupported.

## Results

### Candidate corpus

All 927 must-redact rows retained detection and all 349 policy rows avoided a
MISS. The candidate emitted findings on 2 of 92 fixed-corpus negative rows and
101 of 1,622 expanded-corpus negative rows, versus zero in the beta.8 baseline
summary. This is unchanged from the byte-identical earlier beta.9 façade, but
it is recorded explicitly rather than described as no fixture-level change.

### Calibration

The public aggregate
[`calibration-public-projection-v1.json`](calibration-public-projection-v1.json)
binds the same scoring identity to the final benchmark. The fit used 186
independently reviewed authored rows across 77 applicable families, each with
positive and negative coverage; generated tuning share was 0 and no override
was applied. It evaluated 2,778 held-out development rows and 141 regression
rows without reading protected holdout. Evaluation measurability was 0.9973
(8 unresolved rows), and only 103 of 681 evaluation twin pairs were
discriminated. This is weak generalization evidence, not a probability claim.

### Adversarial evasion

[`score-evasion-aggregate.json`](score-evasion-aggregate.json) records 2,763
variants, 0 unresolved and 0 unstable. All product invariants passed, including
shadow-only non-enforcement. Candidate projection leaked 711 spans versus 540
under legacy, including 171 leaked only under the candidate; false alarms were
361 versus 371. Future-promotion Q4 fails. The scorer is therefore not
promotable and was not tuned against these evaluation rows.

### Determinism, performance and size

The exact Artifact qualification run produced identical full-profile shadow
output on Ubuntu, macOS, Windows and WASI: 0 mismatches over 3,862 comparisons
per runtime, output SHA-256
`916d2235624f27f2925f019686713d51c7cc873411850a8b3edcff20f6e2c9ab`.
The paired performance run passed all fixed criteria and applicable regression
budgets. The aarch64 Linux CLI remained byte-identical to the earlier reviewed
candidate at 930,616 bytes and SHA-256
`afd52fe2d45108e19e0764751605b7465d6c51f1588d378be088d1631df45d3d`;
the 5% budget was not widened.

### Blind result

The fresh one-run epoch measured 32/32 fixtures with no instability or scan
failure. It found 3 leaked spans out of 20 and 1 flagged control out of 12.
Wilson intervals and limitations are reported only in the separate #142
record. No raw fixture, stratum or matched plaintext was disclosed, and no
product change followed the result.

## Boundary

This record qualifies the beta.9 shadow foundation only. It does not expose a
score through the public API, make a probability claim, or enable scorer-driven
detection, confidence or action changes. Enforcement promotion requires all
hard constraints in benchmark #257; the present candidate fails that future
promotion contract.
