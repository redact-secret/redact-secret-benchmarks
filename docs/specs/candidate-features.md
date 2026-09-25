# Candidate-feature dataset

Status: normative for beta.9
([#254](https://github.com/redact-secret/redact-secret-benchmarks/issues/254),
cross-repo parent
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767)).
Implemented in
[`benchmarks/lib/candidate-features.ts`](../../benchmarks/lib/candidate-features.ts),
structure in
[`schemas/candidate-features-v1.json`](../../schemas/candidate-features-v1.json).
The publication boundary follows redact-secret's
`decision-freeze-the-shadow-evidence-score-and-confidence-contract` (§8, §11)
and [statistical tuning](statistical-tuning.md) §7.

The dataset is what offline threshold and model experiments
([#255](https://github.com/redact-secret/redact-secret-benchmarks/issues/255))
read: one row per candidate value from a reviewed fixture, with a small,
closed set of numeric and categorical features. It runs no scanner and does
not change the measurement-v4 scorer.

```sh
npm run features:extract            # -> results-output/calibration/candidate-features-v1.json
npm run features:extract -- --output=results-output/calibration/<name>.json
npm run features:check-public       # CI: no dataset in public/ or dist/
```

## 1. Inputs and partitions

- Categories come only from `corpora/development/manifest.json`
  (`partition: "development"`, `tuningEligible: true`) and
  `corpora/regression/manifest.json` (`partition: "regression"`,
  `tuningEligible: false`, evaluation-only). Each corpus must resolve,
  including through symlinks, inside `fixtures/`, `corpora/development/` or
  `corpora/regression/`.
- **Holdout is never read.** No path under `holdout/` is opened except the
  checked-in holdout manifests. Their ids, corpus hashes and seed hashes are
  read only so that the build can refuse a dataset that names one. The
  dataset records `holdoutAccess: "none"`. Adversarial packs and #289 abuse
  variants are not inputs either.
- T0 fixtures are pending review and have no ground truth. They are left out
  and counted in `corpora[].excluded.pendingT0Fixtures`.
- `corpusHash` is the SHA-256 of the corpus file's bytes, the same value
  `benchmarks/pin-manifest.json` records, so a tuning manifest's per-category
  `corpusHash` can be checked against the dataset.

## 2. Candidates per fixture

| Fixture | Candidates | `candidateSource` | `role` |
| --- | --- | --- | --- |
| has expected spans | one per expected span, in authored order | `expected-span` | the span's `secret` or `companion` |
| has no expected span (a control) | its longest token | `control-longest-token` | `none` |

A **token** is a maximal run of Unicode scalar values that are neither
whitespace (`\s`) nor one of ``" ' ` = : , ; ( ) [ ] { } < > |``. The
longest token is the one with the most scalar values, the earliest on a tie.
A control with no token (empty or whitespace-only content) contributes no
row and is counted in `excluded.controlsWithoutToken`. This rule is the
benchmark's own. It is not product candidate generation, and a row does not
say the product would emit a candidate there.

Ground truth is copied, never derived: `kind` and `tier` come from the
fixture's `assessment`, `role` from its span, and `contract`, `contextAxis`,
`twinOf` and `mutationKind` from the fixture. `family` is the contract, or
`uncontracted`. `targets` are the fixture's `fixture-detectors.json`
detectors plus arrival targets, sorted. No feature value ever changes any of
these fields.

`origin` is corpus-level: a corpus under `fixtures/generated/` is
`generated`, anything else is `authored`. It is what a tuning manifest's
generated-share cap counts (statistical tuning §5). A per-row refinement
(for example, an authored placeholder inside a generated corpus) is deferred.
Today nearly every row is `generated`, so a tuning manifest built on this
dataset needs a reviewed `generatedShare.override` or more authored rows.

## 3. Feature definitions (extractor `candidate-features/1`)

`s` is the candidate value, decoded from its UTF-8 byte range. It is read
as a sequence of Unicode scalar values `s[0..n)`, the unit redact-secret's
`shannon_entropy` counts (`crates/secret-scan-core/src/entropy.rs`: "bits per
Unicode scalar value"). `c_x` is the count of symbol `x`, `k` the number of
distinct symbols, and `log2` the base-2 logarithm. Real-valued features are
stored as integers `round(v × 1 000 000)` (suffix `Micro`, JavaScript
`Math.round`). Every feature is 0 for an empty value.

| Feature | Group | Formula |
| --- | --- | --- |
| `lengthCodePoints` | lexical | `n` |
| `lengthBytes` | lexical | UTF-8 byte length of `s` |
| `distinctSymbols` | lexical | `k` |
| `distinctRatioMicro` | lexical | `k / n` |
| `shannonEntropyBitsMicro` | randomness | `H = −Σ_x (c_x/n) · log2(c_x/n)`, summed over symbols in first-occurrence order (the core's summation order, so the `f64` is bit-identical before rounding) |
| `minEntropyBitsMicro` | randomness | `−log2(max_x c_x / n)` |
| `informationBitsMicro` | randomness | `n · H` (total empirical information in bits) |
| `alphabet` | lexical | the first of `decimal` `[0-9]+`, `hex-lower` `[0-9a-f]+`, `hex-upper` `[0-9A-F]+`, `base32` `[A-Z2-7]+=*`, `alphanumeric` `[A-Za-z0-9]+`, `base64url` `[A-Za-z0-9_-]+`, `base64` `[A-Za-z0-9+/]+=*`, `printable-ascii` `[\x20-\x7e]+` that matches the whole value, else `other`; `empty` when `n = 0` |
| `upperRatioMicro`, `lowerRatioMicro`, `digitRatioMicro` | lexical | share of symbols in `[A-Z]`, `[a-z]`, `[0-9]` |
| `symbolRatioMicro` | lexical | share of ASCII punctuation (`0x21–0x2F`, `0x3A–0x40`, `0x5B–0x60`, `0x7B–0x7E`) |
| `whitespaceRatioMicro` | lexical | share of space, `\t`, `\n`, `\v`, `\f`, `\r` |
| `otherRatioMicro` | lexical | share of every other scalar value (non-ASCII, controls) |
| `classesPresent` | lexical | how many of upper, lower, digit, symbol occur (0–4) |
| `maxRunLength` | randomness | longest run of one repeated symbol |
| `maxMonotonicStepRun` | randomness | longest run in which each code point is the previous `+1`, or each is the previous `−1` (`abcdef`, `987654`); 1 for any non-empty value |
| `repeatedBigramRatioMicro` | randomness | `(n − 1 − distinct adjacent pairs) / (n − 1)`; 0 when `n < 2` |
| `smallestPeriod` | randomness | smallest `p` with `1 ≤ p ≤ ⌊n/2⌋` and `s[i] = s[i+p]` for every `i < n − p` (KMP prefix function), else 0 |
| `maxAutocorrelationMicro` | randomness | `max` over lags `L = 1 … min(⌊n/2⌋, 64)` of `#{i < n − L : s[i] = s[i+L]} / (n − L)` |

The randomness and lexical group labels follow the product contract's
evidence groups. The features are measurements. They carry no weight, cap or
threshold. Those belong to #255 and the product's scoring artifact
(redact-secret#798).

### Contextual evidence class (`contextClass`)

Read from the candidate's own line only: up to 64 scalar values before it
(`before`), and the rest of the line after it (`after`, a trailing `\r`
dropped). The first class that applies, in this order:

1. `url-userinfo`: `before` ends with `scheme://user:` (`/[a-z][a-z0-9+.-]*:\/\/[^\s/@:]*:$/i`)
   and `after` starts with `@`.
2. `authorization-header`: `before` ends with `authorization` `:`/`=` and an
   optional `bearer`/`basic`/`token`/`digest` scheme, or with a bare
   `bearer `/`basic `.
3. `credential-name` / `other-name`: `before` ends with an assignment
   (`NAME` + optional quote or `]` + `:=`, `=>`, `=` or `:` + optional quote)
   or a CLI flag (`--NAME=` or `--NAME `). `NAME` is normalized (camelCase →
   snake_case, lower-case, `.` and `-` → `_`) and split on `_`. It is
   `credential-name` when a segment is one of `apikey auth bearer credential
   credentials key pass passwd password pwd secret token`, otherwise
   `other-name`. This vocabulary is the benchmark's, deliberately coarse, and
   not the product's name list.
4. `bare`: none of the above.

### Negative-evidence class (`negativeClass`)

The product contract (§6) allows negative evidence only when the **whole**
value matches a named grammar. Here the value either is the delimited form,
or is the entire interior of delimiters that immediately surround it on its
line. The first class that applies:

1. `template-reference`: `{{ … }}` with no inner brace.
2. `environment-reference`: `${NAME}` (with optional `:-default`), `$NAME`
   or `%NAME%`, `NAME` being `[A-Za-z_][A-Za-z0-9_]*`.
3. `command-substitution`: `$( … )` with no inner parenthesis, or a
   backtick-delimited value.
4. `angle-placeholder`: `<` `[A-Za-z0-9_ .-]+` `>`.
5. `mask`: three or more of one symbol from `* x X • # . - 0`.
6. `placeholder-vocabulary`: split on `[_\-.\s]+`, every word (lower-cased)
   is in the placeholder vocabulary (`a access an api auth change changeme
   client dummy example fake goes here id insert key me my nil none null
   password placeholder redacted replace replaceme sample secret tbd the
   todo token undefined value your`) and at least one is a marker
   (`changeme dummy example fake here insert nil none null placeholder
   redacted replace replaceme sample tbd todo undefined your`).
7. `dotted-reference`: an identifier path with at least one `.`
   (`process.env.API_KEY`, `secrets.TOKEN`).
8. `none`.

A prefix, suffix or substring resemblance is never negative. A value that
starts with `EXAMPLE` and continues with random-looking material is `none`.

## 4. Schema, identity and determinism

The dataset (`schemaVersion: 1`, `datasetType: "candidate-features"`,
`visibility: "maintainer-local"`) records:

- `extractor.version`: `candidate-features/1`. Any change to a formula,
  vocabulary, candidate rule or row field bumps it. Reconciling these
  definitions with the product's #769 feature semantics is such a change.
- `extractor.sourceHash`: SHA-256 over the canonical JSON of
  `[{file, sha256}]` for `benchmarks/lib/candidate-features.ts` and
  `benchmarks/candidate-features.ts`.
- `benchmark`: the commit and whether the tree was dirty. A dirty dataset is
  not citable in a tuning manifest.
- `datasetHash`: SHA-256 over the canonical JSON of every field except
  `benchmark`, `datasetHash` and `manifestBinding`. The same inputs and
  extractor therefore give the same hash on any commit.
- `manifestBinding`: exactly the `featureDataset` block a tuning manifest
  records (`schemaVersion`, `extractorVersion`, `extractorSourceHash`,
  `datasetHash`).
- `corpora[]`: per category, the partition, origin, corpus path and hash,
  and row counts by origin, per family and per `contextClass`. These have
  the same shape as a tuning manifest's `corpora.tuning[]` counts.

Rows are sorted by category, then fixture order, then candidate index. The
output has no timestamp. Two runs over the same tree are byte-identical.

## 5. Publication boundary

Candidate-level rows, feature vectors and anything fitted from them are not
public benchmark data.

- A row carries identity (category, fixture id, candidate index, UTF-8
  range), authored ground truth, closed-vocabulary classes and integer
  features. It never carries candidate bytes, a substring of them, a
  character-class run, or any hash of the value. The build refuses a
  dataset in which any string contains an expected-span value of eight or
  more scalar values (`assertNoCandidateBytes`), or names a holdout
  identifier or `holdout/` path (`assertNoHoldout`).
- The dataset is written only under `results-output/`, which is
  git-ignored and never part of the site build. Any other `--output` is
  refused. The file is created with mode `0600`.
- `npm run features:check-public` (CI, after `npm run build`) fails if any
  file under `public/` or `dist/` is named `candidate-features*` or embeds
  the dataset's markers, or if `results-output/` stops being ignored.
- Public projection may report aggregate security outcomes per stratum and
  the dataset's identity (`extractor.version`, `extractor.sourceHash`,
  `datasetHash`), and nothing else from this file.
