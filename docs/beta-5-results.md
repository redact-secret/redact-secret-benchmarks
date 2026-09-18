# Beta.5 candidate precision gate (issue #376)

> Unpublished-candidate schema-v4 evidence, not a published-package regression
> snapshot like [`beta-4-results.md`](beta-4-results.md). Measured with the
> `eval:candidate` / `benchmark:candidate` pipeline (redact-secret#390,
> redact-secret-benchmarks#10/#12) against immutable local package tarballs,
> never against the published npm registry. Fixed-corpus and expanded-corpus
> results are reported separately and never aggregated into one score, per
> [measurement protocol v4](measurement-v4.md).

## Provenance

| Field | Value |
| --- | --- |
| Candidate product commit | `a637ac1c156a05630243185a6adccadc28f5a1ab` (clean at measurement time). Current `main` HEAD is two commits ahead (`8131459f`); the diff between them is a Rust `#[cfg(test)]` unit test addition only ([redact-secret#375 checkbox 5](https://github.com/redact-secret/redact-secret/commit/8131459)) — no production detector or registry code changed, so this candidate remains representative of current `main`. |
| Candidate artifact SHA-256 | `1245d813d665994bc352e87e5a1a730369104dde3c42896c89dec69df8d62677` (package), `87c32b382e10fbac9e5f309393ddd0b1d17b3bb16395996acbde0efb95fdaf37` (node), `891fde4fbaf20eea52ca8c86e9358dc4dd0f40a0713083c14bd4bff0491d4e75` (wasm) |
| Benchmark commit | `c1f777ae20bb38c105a615ffa28005f64d4d6596` (clean, `main` HEAD) |
| Corpus hash | `c896dc80d571ae8dbb2dbe567468b825cf0152711c4bb59f7645644de6520e1f` |
| Baseline compared | `0.1.0-beta.4` via the pinned [`baselines/0.1.0-beta.4.json`](../baselines/0.1.0-beta.4.json) snapshot |
| Run ID | `808cd7dd-b356-4bdf-9521-9045b4893900`, status `complete`, 612/612 fixtures scanned, 0 failures |
| Scanner | `redact-secret-candidate`, default detectors, isolated npm-tarball install with overrides |

## Fixed-corpus (`common-formats`, 114 fixtures) — this issue's tracked metric

| Metric | Numerator / denominator |
| --- | --: |
| Twin false alarms, before → after | 24 → 0 (out of 56 must-not-flag rows) |
| Twin discrimination | 56 / 56 (target met) |
| Required-positive misses (T1/T2), before → after | 0 → 0 (58 / 58 preserved) |
| Leaked spans (T1/T2 positives) | 0 / 0 (unchanged) |

All 56 must-not-flag rows in `common-formats` are clean on the candidate; the
24 rows beta.4 flagged (12 unique mutations, each in a plain and a
Unicode/CRLF context) are now silent. One row scored `PARTIAL` against a
`EXACT` baseline for a reason unrelated to detection — see **Anomalies**.

## Expanded-corpus (498 fixtures)

| Metric | Numerator / denominator |
| --- | --: |
| Negative flags, before → after | 0 → 0 |
| Required-positive misses (T1/T2), before → after | 0 → 0 (168 / 168 preserved) |
| Policy/T3 rows newly silent | 18 / 158 (see **Policy changes**) |
| Rows with no beta.4 baseline (new DigitalOcean coverage, redact-secret-benchmarks#10) | 7 (4 must-not-flag/T0, 3 must-redact/T1 — reported distinctly, never scored as regressions) |

## Per-issue fixture mapping

| Issue | Family | Fixed-corpus mutations affected | Contract |
| --- | --- | --- | --- |
| [#368](https://github.com/redact-secret/redact-secret/issues/368) | `openai-token` | legacy marker, `proj`/`svcacct` segment width | `sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}` (+ `proj`/`svcacct` variants) |
| [#369](https://github.com/redact-secret/redact-secret/issues/369) | `digitalocean-token` | `dop`/`doo`/`dor` 63-vs-64 byte body | `<prefix>[0-9a-f]{64}` |
| [#370](https://github.com/redact-secret/redact-secret/issues/370) | `docker-token` | `pat` 26-vs-27, `oat` 31-vs-32 | `dckr_pat_[A-Za-z0-9_-]{27}`, `dckr_oat_[A-Za-z0-9_-]{32}` |
| [#371](https://github.com/redact-secret/redact-secret/issues/371) | `slack-token` | `bot` missing section separator | `xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{18,}` |
| [#372](https://github.com/redact-secret/redact-secret/issues/372) | `huggingface-token` | `user` 33-vs-34 byte body | `hf_[A-Za-z0-9]{34}` |
| [#373](https://github.com/redact-secret/redact-secret/issues/373) | `cloudflare-token` | `user` non-hex checksum suffix | `cfut_[A-Za-z0-9]{40}[0-9a-f]{8}` |
| [#374](https://github.com/redact-secret/redact-secret/issues/374) | `linear-token` | `api` 39-vs-40 byte body | `lin_api_[A-Za-z0-9]{40}` |
| [#375](https://github.com/redact-secret/redact-secret/issues/375) | shared context/streaming | paired-precision context matrix (product-side conformance only; no benchmark corpus change) | — |
| [#367](https://github.com/redact-secret/redact-secret/issues/367) | all seven | contract freeze this table's fixes implement | [precision-contracts.json](https://github.com/redact-secret/redact-secret/blob/main/docs/audits/evidence/367/precision-contracts.json) |

Twelve unique mutations produce the 24 fixed-corpus context instances (each
mutation frozen in a plain and a Unicode/CRLF context); see
`redact-secret`'s [issue #367 evidence](https://github.com/redact-secret/redact-secret/blob/main/docs/audits/evidence/367/README.md)
for the full mutation table and source ledger. No must-not-flag classification
was corrected by the contract audit — every one of the 24 twins was already
authored `expected: []` under beta.4; only the candidate's own flagged/silent
outcome changed. There is therefore no frozen-baseline-vs-corrected-contract
split to show for this gate: the 24→0 result is a genuine detection change,
not a reclassification.

## Policy changes

Eighteen `detector-coverage` policy/T3 rows move from `EXACT` (beta.4) to
`MISS` (candidate). All eighteen are the generic, unreviewed `detector-coverage`
synthetic shapes for four of the seven frozen families, in `-bare`/`-quoted`/
`-unicode-crlf` variants:

| Fixture prefix | Shape no longer matched |
| --- | --- |
| `openai-token-shape-1/2/3` | 48-byte random body, no `T3BlbkFJ` marker |
| `slack-token-shape-1` | `xoxb-` + random body, no dash-sectioning |
| `docker-token-shape-1` | `dckr_pat_` + 32-byte body (not the contracted 27) |
| `cloudflare-token-shape-1` | `cfut_` + 40-byte body, no hex checksum tail |

This is the intended, reviewed policy change from the seven contract fixes
(redact-secret's [precision-contracts freeze](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-17-freeze-precision-contracts-for-seven-provider-families.md)):
the provider finding is deliberately removed for shapes that don't match the
reviewed grammar; cases are kept, not deleted, so the policy change stays
visible. `detector-coverage.mjs`'s generic `synthetic()` body generator
predates the seven contracts and hasn't been regenerated against them — see
**Remaining limitations**.

Known T0 pending forms and interim guards are unaffected: `slack-token-shape-2,3,5,6,7`
(`xoxp-`/`xapp-`/`xoxe-`/`xoxe.xoxb-`/`xoxe.xoxp-`), `slack-token-shape-4`
(`xwfp-`), `huggingface-token-shape-1`, `linear-token-shape-2` (`lin_oauth_`)
all remain flagged by their beta.4 interim guards, unchanged.

## Anomalies (not product regressions)

1. **`common-formats--sendgrid-token-segmented-unicode-crlf` scored `PARTIAL`.**
   `benchmarks/fixtures/generated/common-formats.json` and
   `detector-coverage.json` both independently define a fixture literally
   named `sendgrid-token-segmented-unicode-crlf`; `fixture()`'s materialized
   path is `cases/<id>.txt` with no category namespacing, and
   `benchmarks/candidate.ts` materializes every category into one shared
   scratch directory, so whichever category is later in `categories.json`
   (`detector-coverage`) silently overwrites the other's file content before
   scanning. Isolated reproduction against the exact candidate artifact and
   the fixture's own authored content scores a byte-perfect `EXACT`. Two more
   path collisions with the same shape exist (`cases/prefix-only.txt`,
   `cases/masked.txt`, both `sendgrid-regressions` vs `negative-controls`) but
   both are must-not-flag/must-not-flag pairs, so the collision is invisible
   in the score. **Not fixed by this gate** — recommended follow-up: globally
   unique fixture IDs, or category-prefixed materialization paths, before
   this pipeline is trusted for detector-family-level regression detection.
2. **Stale `detector-coverage` generic fixtures for four narrowed providers**
   (openai/slack/docker/cloudflare `-shape-1`-class fixtures). Their generic
   `synthetic()` bodies (plain mixed-case alphanumeric, no marker/sectioning/
   checksum) no longer satisfy the reviewed grammars — expected, correct
   behavior under the frozen contracts (see **Policy changes**), not a
   regression. **Not fixed by this gate** — recommended follow-up: regenerate
   these four providers' `detector-coverage` fixtures against
   `precision-contracts.json`'s reviewed shapes.
3. **`scanners/index.mjs`'s `locate()` ambiguity on repeated identical
   secrets — fixed by this gate.** `detector-coverage--digitalocean-token-repeated`
   (added by redact-secret-benchmarks#10's DigitalOcean coverage expansion,
   unbaselined against beta.4) places the same 71-byte DigitalOcean token
   twice on one line. Gitleaks emits one row per physical occurrence (with
   distinct columns); TruffleHog collapses both into one deduplicated row.
   `locate()` required exactly one textual match per `(file, raw, line)` and
   threw `Ambiguous or unmappable scanner finding` for both tools, failing
   `npm run bench -- --strict` (and therefore `npm run compare`) for reasons
   unrelated to any redact-secret precision change — redact-secret's own
   candidate scanner reports byte offsets natively and was unaffected.
   `locate()` now accepts an optional per-scan `claim` map: repeated calls
   reporting the identical `(file, raw, line)` tuple claim occurrences in
   ascending byte order (matching both tools' left-to-right scan order), while
   a single isolated call with no claim context still throws exactly as
   before — never silently guessing without scanner-reported position. See
   `tests/benchmark.test.mjs`.

## Required checks

`npm run fixtures:check`, `npm test` (164 tests), `npm run test:integration`
(6 tests), `npm run bench -- --strict` (27 scanner/category executions), and
`npm run build` all pass against this candidate commit and the `locate()` fix
above. No scanner error, stale report, or missing surface was present at the
end of this run.

## Remaining limitations

- The two `detector-coverage` anomalies above (fixture-ID collisions;
  stale generic shapes for four providers) remain open benchmark-side work,
  not tracked as product issues.
- `redact-secret`'s own release-qualification accuracy corpus
  (`assessment/fixtures/accuracy-corpus.json`, a separate, bounded
  cross-language protocol — see
  [`decision-define-cross-language-evaluation-protocol`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-12-define-cross-language-evaluation-protocol.md))
  is re-pinned by the same gate; see that repository's own evidence and
  decision record for the corpus-hash and accuracy-count re-pin. This
  repository's corpus, fixtures, and known-gaps lifecycle are unaffected —
  per [`docs/decisions/2026-09-18-govern-benchmark-promotion.md`](decisions/2026-09-18-govern-benchmark-promotion.md),
  the two corpora stay independent and neither is copied into the other.
- `known-gaps.json` is unaffected by this gate: issues #368–#375 originated
  from proactive contract review (redact-secret#367), not from this
  repository's benchmark-discovery → `known-gap` → promotion lifecycle, so
  no `known-gap` record transitions state here.

## Reproduce

```sh
npm ci
npm run compare
npm run build
```

Candidate reproduction (unpublished artifact, from the product repository):

```sh
npm run benchmark:candidate -- \
  --benchmark-ref c1f777ae20bb38c105a615ffa28005f64d4d6596 \
  --benchmark-repo /absolute/path/to/redact-secret-benchmarks
```
