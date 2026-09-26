# Score-evasion and negative-evidence abuse evaluation

Status: normative for beta.9
([#289](https://github.com/redact-secret/redact-secret-benchmarks/issues/289),
cross-repo parent
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767),
product evaluation path
[redact-secret#771](https://github.com/redact-secret/redact-secret/issues/771)).
Code: [`benchmarks/lib/score-evasion.ts`](../../benchmarks/lib/score-evasion.ts)
and [`benchmarks/score-evasion.ts`](../../benchmarks/score-evasion.ts).
Output shape:
[`schemas/score-evasion-aggregate-v1.json`](../../schemas/score-evasion-aggregate-v1.json),
read by question 4 of the [promotion gates](scorer-promotion-gates.md).

The product's shadow evidence scorer is open source, so this evaluation
assumes the attacker has read it. It is not a secrecy test. It asks whether
someone can reshape a real credential-like value, or the text around it, so
that the scorer's evidence drops, and whether any of the product's
invariants give way while they try. Beta.9 keeps the scorer shadow-only
(redact-secret `decision-freeze-the-shadow-evidence-score-and-confidence-contract`),
so nothing here changes what the product enforces.

## 1. Inputs

**Bases.** Reviewed fixtures from the development and regression manifests,
loaded with `loadCategoryInputs`, which never opens `holdout/`. Tier `T0`
(pending review) is skipped. A positive base is a `must-redact` or `policy`
fixture with exactly one `secret` span. A control base is a `must-not-flag`
fixture with no expected span, and its value is its longest token. Values
are 12 to 200 scalar values long and the fixture is at most 4 KiB. A
positive whose value already matches a whole-value exclusion grammar
(section 4) is not credential material and is left out.

The product scans every candidate base once. The result only chooses which
reviewed fixtures are drawn. It never changes a fixture's authored
expectation. Bases are drawn per bucket, in order of
`sha256("score-evasion-operators/1:" + id)`, with no randomness:

| Bucket | Drawn |
| --- | ---: |
| positive covered by a `statistical` (`contextual`) finding | 10 |
| positive covered by a `statistical` (`entropy`) finding | 6 |
| positive covered by a `provider` finding | 6 |
| positive covered by a `structural` finding | 3 |
| positive covered by a `private-key` finding | 2 |
| control the product flags | 6 |
| control the product does not flag | 4 |

`policy` fixtures count as positives here. The attacker's goal is to leak
the value, and a policy span is a value the product redacts today.

**Operators.** Each attack class the contract fixes is a family of
generic reshapings with small enumerated parameters. A value operator
rewrites the value and keeps a vendor prefix or PEM armour fixed. A context
operator rewrites the rest of the value's line and keeps the value. The
families:

| Attack class | Family |
| --- | --- |
| `controlled-repetition` | runs of repeated symbols in the body |
| `periodic-body` | the body tiled from its own prefix or mirrored; benign sequence alphabets as controls |
| `class-distribution` | the body mapped into fewer character classes |
| `length-segmentation` | truncation, separators every few symbols, padding past the scorer's 256-symbol bound |
| `placeholder-wrapping` | placeholder-like prefixes and suffixes around the value |
| `embedded-reference` | environment, command and template references inside, before or around the value |
| `context-perturbation` | separators, quoting, `export`, name case, comments, JSON members, a non-credential name |
| `negative-evidence-mixture` | placeholder and mask text mixed with the value; whole-grammar values as controls |
| `boundary-discontinuity` | step-wise flattening of the body's tail, and lengths either side of the 256-symbol bound |

No operator adds credential material to a control, and none removes the
original material from a positive: it stays in the value, reshaped. A
positive variant's expected span is the reshaped value. When the operator
only adds text around the value, the span is the original value, and the
added text is an envelope whose flagged bytes are never collateral. The
controls in `periodic-body` and `negative-evidence-mixture` replace a
statistical positive's value with a benign one in the same context, so they
differ from that positive by the value alone.

`operatorSetHash` is the SHA-256 of the canonical JSON of the operator ids
per class, the draw quotas, the drawn base ids, the seed (`enumerated`) and
the hash of the two source files. The operators' output is never
published.

## 2. Product paths

The product is a clean checkout of one exact commit. The runner refuses a
checkout with tracked changes.

- **Shadow path.** `cargo run --release --locked -p redact-secret --example
  shadow_evaluation` (redact-secret `docs/specs/engine.md`, "Maintainer-local
  shadow evaluation"). Its header must carry the artifact revision and model
  fingerprint of `docs/contracts/scoring/shadow-scoring-artifact.json` at
  that commit. Every variant runs through it at least twice.
- **Plain scan.** `cargo run --release --locked -p redact-secret-cli --
  --json`, the product CLI's check mode, over one file per variant. It is the
  public scan path with no evaluation sink.

**Identity.** `sourceRevision` is the product commit.
`scoringArtifactRevision` and `modelFingerprint` come from the shadow
header and must equal the artifact's. `scoringArtifactSha256` hashes the
artifact file at the commit, and `scoringIdentity` is the artifact's
`calibration.scoring.identity`. `tuningManifestHash` is the artifact's
`tuningManifest.hash`, which is `null` while the #256 manifest is pending.
The shadow path compiles the core's own source and is not a packaged
artifact, so `candidateArtifactHash` identifies what was compiled: the
SHA-256 of the canonical list of `[path, sha256]` for `Cargo.toml`,
`Cargo.lock`, `crates/secret-scan-core/**` and `crates/secret-scan-cli/**`
at the commit. It is not the npm candidate hash that `eval:candidate` and
the holdout record. A promotion-candidate aggregate binds the exact
promotion candidate instead.

## 3. Outcomes

For each variant:

- **unstable**: the shadow runs' records for the variant differ.
- **unresolved**: either path failed on the variant (`shadow-error` or a CLI
  failure).
- **flagged (legacy)**: a finding covers the whole expected span. For a
  control, any finding in the text. This is the measurement-v4 reading: a
  `warn` finding is flagged.
- **flagged (candidate projection)**: the same, over the findings a
  promotion would keep. Deterministic findings stay. A `statistical` finding
  stays only when its shadow band is at least `medium`, the operating point
  the #255 calibration and redact-secret `docs/specs/engine.md` ("Cost and
  trade-offs") measure a promotion at. That is deliberately the pessimistic
  reading. Under the product's narrowest reading, where only band `none`
  drops a finding (reason `band-none`), fewer variants leak. The runner
  keeps those counts locally as well.
- **leaked**: a positive that is not flagged. `leakedOnlyUnderCandidate`
  counts positives flagged by the legacy path and not by the projection.
- **false alarm**: a flagged control.
- **collateral**: flagged bytes outside the variant's envelope. For a
  control, every flagged byte.
- **negative evidence applied**: a record with a nonzero `negative`
  contribution. It counts as **on a partial match** when the benchmark's own
  whole-value grammar check (section 4) does not accept the finding's value.

The arithmetic `evasionAggregateProblems` checks holds by construction:
`variants = unresolved + unstable + controls + resolved positives`, and every
resolved positive is either preserved or leaked on each path.

Because the scorer is shadow-only in beta.9, `mode` is `shadow`. The
candidate columns describe what the projected promotion would do. They are
not an enforcement outcome, and `shadowNonEnforcing` states that none
changed. A shadow aggregate fails `q4-evaluated-against-candidate` by
design. Q4 is informational for beta.9.

## 4. Invariants

Each invariant is checked on every record of every variant. One violation
anywhere sets it to `false`.

| Invariant | Check |
| --- | --- |
| `protectedSpecificityNeverWeakened` | a `private-key`, `provider` or `structural` record has `authority: deterministic`, band equal to the legacy `Confidence`, `promotion: preserve`, and no score, group or signal |
| `negativeEvidenceFullGrammarOnly` | a record with negative evidence or an exclusion names a grammar, and the benchmark's independent re-implementation of the strict exclusion grammar accepts the whole finding value under that grammar |
| `noStatisticalPositiveToNonFinding` | every record, whatever its band, keeps a legacy action of `redact`, `block` or `warn`: a low score never turns a finding into a non-finding |
| `shadowNonEnforcing` | per variant, the shadow path's legacy fields (range, detector, type, `Confidence`, action) equal the plain CLI scan's findings exactly |

The independent grammar follows redact-secret `docs/specs/engine.md`,
"Strict exclusion grammar": a fully delimited template reference, a whole
environment reference, a whole command substitution, an angle placeholder,
a mask of one repeated symbol, or only placeholder-vocabulary words with at
least one marker. A prefix, suffix, substring or other resemblance never
matches.

## 5. Publication boundary

Public, and committed under `evidence/<core issue>/`: the aggregate only.
Its schema is closed, so it can carry counts per attack class and in total,
invariant verdicts, identities and hashes, and nothing else.

Maintainer-local, in the git-ignored `results-output/score-evasion/`: the
variant inputs, both raw shadow outputs, the plain scan, per-variant
outcomes, scores, bands and signals, band shifts per class, the boundary
sweeps, the variants whose band dropped or that leaked only under the
projection, and the band-`none` projection. That is the fitted map of the
decision boundary the product contract (section 11) keeps out of public
projection, and a set of working evasion recipes.

The operator code is public. It names generic families with small
enumerated parameters, which anyone who reads the scorer can derive. It
does not say which operator moved which band on which base.

`npm run features:check-public` fails when a file under `public/` or `dist/`
is named like, or embeds, score-evasion detail or raw shadow-evaluation
records, when any tracked file anywhere embeds them, or when the local
outputs stop being ignored. `tests/score-evasion.test.mjs` validates every
committed `score-evasion-aggregate.json` with `evasionAggregateProblems`.
`--publish` writes the aggregate only from a clean benchmark tree, only
under the name `score-evasion-aggregate.json`, and only when it has no
problems and no invariant was violated.

## 6. Failures

- **An invariant violation is a product defect.** The run exits nonzero and
  `--publish` refuses. The maintainer reports it on the product issue with a
  minimal synthetic reproduction and without the recipe that found it. The
  fix goes through the product's own review, and the evaluation reruns
  against the fixed commit.
- **A band that drops without an invariant violation** is expected research
  evidence, which the beta.9 scorer is allowed to produce. It stays local.
  Its only lifecycle is the one
  [statistical tuning](statistical-tuning.md) §1 gives #289 variants: an
  evaluation-only, maintainer-local source that the next scorer revision is
  evaluated against and never tuned on, and that question 4 reads again, in
  promotion-candidate mode, before any promotion.
- **A legacy-path leak** (a positive the deterministic path does not flag)
  is not a scorer result. Once reviewed it enters the known-gap lifecycle
  (`benchmarks/known-gaps.json`,
  [`promote-finding`](../../.agents/skills/promote-finding/SKILL.md)) like
  any other detection gap, with a synthetic fixture and not the variant.

## 7. Reproduce

From a clean benchmark checkout, with a clean product checkout at the
commit under test:

```sh
npm ci
npm run evasion:run -- --product <redact-secret checkout> \
  [--publish evidence/<core issue>/score-evasion-aggregate.json]
```

The run takes well under a minute after the product's release build. It
needs no scanner other than the product, so the TruffleHog pin does not
apply.
