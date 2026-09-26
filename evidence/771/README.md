# Evidence: redact-secret#771, adversarial score-evasion and negative-evidence abuse of the shadow scorer

**Result:** all four invariants hold over 2,765 deterministic variants in 9 attack classes (0 unresolved, 0 unstable). Protected findings stayed deterministic, negative evidence applied 10 times and never on a partial match, no statistical signal turned a finding into a non-finding, and the shadow path's legacy findings and actions equal a plain product scan for every variant. Under the projected promotion (flag a statistical finding at shadow band `medium` or above), 268 of 1,819 resolved positives would leak that the legacy path flags. That is expected research evidence while the scorer is shadow-only. Q4 is informational for beta.9 and reads `fail`, which a shadow-mode aggregate always does.

This is the adversarial evidence that the "Maintainer-local shadow evaluation"
section of redact-secret `docs/specs/engine.md` asks for before
qualification, produced for
[redact-secret-benchmarks#289](https://github.com/redact-secret/redact-secret-benchmarks/issues/289)
(cross-repo parent
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767)).
The published record is
[`score-evasion-aggregate.json`](score-evasion-aggregate.json), the closed
shape of [`schemas/score-evasion-aggregate-v1.json`](../../schemas/score-evasion-aggregate-v1.json).
The method is [`docs/specs/score-evasion.md`](../../docs/specs/score-evasion.md).
Variants, scores, bands and the operators that moved a band stay
maintainer-local and are not in this repository.

## Source revisions

| Item | Identity |
| --- | --- |
| Benchmark | redact-secret-benchmarks `5a161bfc9a0fbd17f91d4fc443e67308389b9609` (the #308 merge on `develop`), clean |
| Product | redact-secret `d4bab4ede21cae2b25f03a40f466b52dceadfda2` (`main`, the #771 merge, declares `0.1.0-beta.8`), clean detached checkout |
| Scoring artifact | `docs/contracts/scoring/shadow-scoring-artifact.json` at that commit: revision 2, sha256 `a162be567245f9f6db6dbf4d2b3aec959408e06b64231d510e9612db0bb944e0` |
| Model | `evidence-aggregation/v1` over `evidence-features/v1`, fingerprint `bf2ed67db72dabe69b97d248e547aa1e942cf98991a6b712dc6285629662afa9` |
| Scoring identity | `d6a8325c6cce09f628f595f88c5252245f0fbb5c01abb8ebb0eb0b7ec2e8a789` (the artifact's `calibration.scoring.identity`, from #255) |
| Tuning manifest | pending (`tuningManifestHash: null`), as the artifact records |
| Candidate | `candidateArtifactHash` `3ffbb2f8adc90ee73b279a6fbd4357235488b50d18b3d2d389070220504bcebe`: the compiled sources (workspace manifests, lockfile, core and CLI crates) at the product commit, because the shadow path compiles the core's own source ([spec](../../docs/specs/score-evasion.md) §2). It is not an npm candidate hash |
| Operator set | `6abd72be35a7910fdbd9c179d8f292509f25a6dc44a3c29e2fba40dd3359dbd5` |
| Host | macOS 26 (darwin 25.5.0) arm64, Node.js 22.16.0, Rust release build |

## Scanner versions

No peer scanner ran, so the TruffleHog pin does not apply. The only detector
is the product at the commit above, through two paths: the maintainer-local
shadow evaluation example (`cargo run --release --locked -p redact-secret
--example shadow_evaluation`, output format
`redact-secret/shadow-evaluation/1`, `full` profile), run twice, and the
product CLI's plain check mode (`cargo run --release --locked -p
redact-secret-cli -- --json`), run once.

## Command

```sh
git -C <redact-secret> checkout --detach d4bab4ede21cae2b25f03a40f466b52dceadfda2
npm ci
npm run evasion:run -- --product <redact-secret> \
  --publish evidence/771/score-evasion-aggregate.json
```

A rerun at the same two commits writes the same aggregate. Holdout is never
read.

## Aggregate

37 reviewed bases: 16 positives covered by a `generic-token` statistical
finding, 11 covered by a provider, structural or private-key finding, and
10 controls. "Shadow" is the projected promotion described above, "legacy"
the product's deterministic result. Collateral is in bytes.

| Attack class | Variants | Controls | Preserved (shadow / legacy) | Leaked (shadow / legacy) | Leaked only under shadow | False alarms (shadow / legacy) | Collateral (shadow / legacy) | Negative evidence (applied / partial) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| controlled-repetition | 259 | 70 | 75 / 140 | 114 / 49 | 65 | 21 / 32 | 1,419 / 2,024 | 0 / 0 |
| periodic-body | 264 | 129 | 39 / 107 | 96 / 28 | 68 | 60 / 71 | 2,177 / 2,714 | 0 / 0 |
| class-distribution | 192 | 53 | 62 / 104 | 77 / 35 | 42 | 17 / 25 | 899 / 1,258 | 0 / 0 |
| length-segmentation | 292 | 78 | 81 / 118 | 133 / 96 | 37 | 21 / 35 | 1,014 / 2,343 | 0 / 0 |
| placeholder-wrapping | 296 | 80 | 135 / 137 | 81 / 79 | 2 | 36 / 37 | 1,945 / 1,985 | 0 / 0 |
| embedded-reference | 296 | 80 | 129 / 129 | 87 / 87 | 0 | 23 / 25 | 1,212 / 1,267 | 0 / 0 |
| context-perturbation | 363 | 100 | 241 / 241 | 22 / 22 | 0 | 53 / 63 | 2,752 / 3,072 | 0 / 0 |
| negative-evidence-mixture | 451 | 262 | 129 / 131 | 60 / 58 | 2 | 32 / 44 | 1,835 / 2,127 | 10 / 0 |
| boundary-discontinuity | 352 | 94 | 95 / 147 | 163 / 111 | 52 | 21 / 39 | 3,502 / 4,990 | 0 / 0 |
| **Total** | **2,765** | **946** | **986 / 1,254** | **833 / 565** | **268** | **284 / 371** | **16,755 / 21,780** | **10 / 0** |

Every class has well over the contract's floor of 20 resolved variants.

| Invariant | Held |
| --- | --- |
| `protectedSpecificityNeverWeakened` | yes |
| `negativeEvidenceFullGrammarOnly` | yes |
| `noStatisticalPositiveToNonFinding` | yes |
| `shadowNonEnforcing` | yes |

## Reading it

- **No product defect.** No invariant broke, so nothing goes to the product
  as a defect.
- **The projected promotion is not safe as calibrated.** Lowering the
  randomness evidence of a value in a credential context drops it to the
  context-only band, which is below `medium`. That is the known cost the
  product spec already states for a promotion at `medium`. This run shows an
  attacker can produce it on purpose, in every value-reshaping class.
  Under the product's narrowest reading, where only band `none` drops a
  finding, far fewer positives leak. Those are bare values with no
  credential context. Either way, question 4 of the promotion gates would
  block a promotion of this model today, and it must be asked again in
  promotion-candidate mode for any future candidate.
- **The legacy leaks are the deterministic path's own coverage.** Many
  reshaped values are not flagged by the legacy path either, for example a
  provider value that no longer matches its grammar, or a generic value the
  legacy detector no longer covers in full. Those count on both sides, so
  they are not a scorer effect. A reviewed legacy gap enters the known-gap
  lifecycle ([spec](../../docs/specs/score-evasion.md) §6).
- **Negative evidence stayed strict.** It applied only to controls whose
  whole value is a reviewed placeholder form, and never to a mixture of
  placeholder text and real material.
- **Beta.9 is unaffected.** The scorer enforces nothing, and
  `shadowNonEnforcing` held for every variant.
