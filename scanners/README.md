# scanners

Per-tool invocation adapters (redact-secret, Gitleaks, TruffleHog, flare-redact)
that run a scanner against the materialized `fixtures/` corpus and normalize
its output to the common ground-truth schema for scoring.

`index.mjs` defines the adapter registry. redact-secret and flare-redact use
only the public API of their pinned npm packages; Gitleaks and TruffleHog are
external binaries on `PATH`. No competitor's source or binary is bundled.

Adapters return `{ path, start, end, family? }` in UTF-8 bytes. `families.mjs`
maps explicitly recognized native detector labels to shared families; unknown
labels remain unmapped. For redact-secret the native label is the product
detector id, except where `arrivalFindingTypes` maps the product finding type
of a shared detector to a Beta.8 arrival family (#251,
`docs/decisions/2026-09-24-map-product-finding-types-to-arrival-families.md`). No family is inferred from the expected fixture. Raw external findings
are mapped using the file, matched value, and reported line, then discarded.
Ambiguous mappings fail closed rather than manufacturing a range. TruffleHog
verification and update checks are disabled. Missing binaries and execution
failures remain distinct from successful scans with no findings.

The evaluation engine records adapter configuration, exact command arguments
(with an input-root placeholder), process limits, mapping version, tool version
and a configuration hash. `npm run eval -- --method=differential --strict`
compares all installed adapters and writes a review queue with this evidence.
Differential classification is only comparable where both sides supply mapped
families at identical ranges. Unmapped classification is unsupported, not an
agreement or a scanner execution failure. Scanner silence is never used to
infer that a detector family is unsupported.

Schema-v3 reporting separates reviewed formats, standalone masking policy,
malformed/example controls and unscored review. Scanner adapters never select
cohorts or change expectations based on their results.

## Composite credential findings

TruffleHog 3.97.4 AWS findings put the ID in `Raw` and `ID:secret` in `RawV2`.
The adapter maps both reported secret components to unique source ranges.
Shopify findings concatenate `token + shop-domain` in `Raw`; the adapter maps
the token and checks the companion domain exists, without marking the public
domain secret. Neither transformation reads expected ranges. Unknown layouts
and ambiguous occurrences fail explicitly. Real-binary integration tests use
Anthropic, AWS pairs and Shopify with Unicode/CRLF and empty adapter expectations.

TruffleHog's URI detector re-serializes userinfo through Go's `url.URL`, so a
literal `!` in a password comes back as `%21`. When a reported `Raw` carries a
percent escape and does not occur in the file verbatim, the adapter matches each
escape of a printable ASCII byte as either the escape or the literal byte, on the
reported line, and keeps the source span. Zero or several candidate spans still
fail the observation closed; no finding is dropped (#213).

Output contracts: [AWS](https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/aws/access_keys/accesskey.go),
[Shopify](https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/shopify/shopify.go).

The external command contracts follow the upstream
[Gitleaks README](https://github.com/gitleaks/gitleaks#usage) and
[TruffleHog README](https://github.com/trufflesecurity/trufflehog#usage).
Run `npm run bench -- --strict` with released binaries installed to validate
the complete integration on your machine; unit tests alone do not establish
compatibility with every binary release.

## Validated releases

The local comparison has been exercised with Gitleaks **8.30.1**,
TruffleHog **3.97.4**, `@redact-secret/core` **0.1.0-beta.4**, and
`flare-redact` **1.6.1** on macOS arm64. Install the external tools using
`brew install gitleaks trufflehog`. Other systems can use the upstream
installation instructions above.

CI (`.github/workflows/validate.yml`, `scanner-comparison` job) installs the
same pinned releases on `ubuntu-latest` (linux x64) directly from GitHub,
verifies the downloaded archive against the release's published checksum,
then verifies the installed binary's own `version` output matches the pin
before running anything — a silently upgraded binary must not be able to
change published numbers:

```sh
curl -sSL -O https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
tar xzf gitleaks_8.30.1_linux_x64.tar.gz gitleaks   # -> ./gitleaks, `gitleaks version` reports 8.30.1

curl -sSL -O https://github.com/trufflesecurity/trufflehog/releases/download/v3.97.4/trufflehog_3.97.4_linux_amd64.tar.gz
tar xzf trufflehog_3.97.4_linux_amd64.tar.gz trufflehog   # -> ./trufflehog, `trufflehog --version` reports 3.97.4
```

With both on `PATH`, `npm run test:integration` and `npm run bench -- --strict`
exercise all four adapters with no other change; the job fails closed if
either scanner is missing, mismatched, or unstable across replays.

### TruffleHog silence on a hand-written fixture is not a missing detector

Every TruffleHog detector matches a specific structural contract (prefix,
character alphabet, length range) before it ever runs verification, and
reports nothing when a hand-written fixture falls outside it — even with
verification disabled and `--results=verified,unknown,unverified` passed (the
adapter already passes this). Two confirmed examples: TruffleHog's `github`
v2 detector only matches `\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,255}\b`
(github.com/trufflesecurity/trufflehog `pkg/detectors/github/v2/github.go`), so
a hand-written token one character short of 36 reports nothing — exactly why
this corpus's `ghp`/`gitlab`/... twin fixtures (one character shorter than
the contracted length) are true negatives, not a missing-detector gap; and
TruffleHog reports nothing for a real `openssl genpkey -algorithm Ed25519`
PEM (verified locally against 3.97.4/3.97.5), likely for the same reason —
its detector expects a specific PEM shape. It does report this corpus's own
positives, because this corpus's `synthetic()` values are constructed to
satisfy the contracted grammars. Read TruffleHog silence on a fixture you
wrote by hand as "the fixture doesn't satisfy that detector's structural
contract", not "the tool lacks the detector" — `--results=verified,unknown,unverified`
does not change this, since it only affects live verification, not the
structural match.

`npm run test:integration` requires all four actual scanners (three of which
are external binaries; flare-redact and redact-secret run through their
pinned npm packages instead). For each, it checks exact byte ranges for a
synthetic GitHub-shaped positive with Unicode and CRLF before the token, then
checks a negative-only directory. Missing tools fail rather than skip. These
tests never use live verification and never write raw scanner output.
`npm run compare` runs these controls before generating strict comparison
reports. Installed versions are recorded in every report, so results remain
attributable when binaries or packages are upgraded.

## flare-redact

[flare-redact](https://github.com/flare-collection/flare-redact) is a
runtime redaction library (MIT licensed, zero npm dependencies) rather than
a repository scanner; it is measured only through its published npm package
(`flare-redact`, pinned to an exact version), never a source import, and only
through its JavaScript engine — the package's Python and Rust engines are not
published to a registry and are not measured. Its detectors implement its own
FRS-1 spec, independent of this corpus's fixtures.

**Secrets-only scope.** flare-redact also detects PII (email, phone, IBAN,
card numbers, national IDs); this corpus defines ground truth for credentials
only, so its `pii`-tagged detectors are disabled (`disable: ['pii']`). Every
other detector runs at its package default: `minConfidence` and
`refineConfidence` stay at 0 and `false`, matching how this repo measures the
other three tools at their own default configuration rather than introducing
an independent tuning pass over flare-redact's confidence threshold.

**`generic_assignment` is also disabled**, alongside `pii`. It is a keyword-
before-`=`/`:` catch-all (covering `password`, `secret`, `token`, `key`, ... in
80+ languages) that fires on any `KEY=value`-shaped assignment. Its span
includes the assignment's key name, and its overlap-resolution weighting
(risk tier, then confidence, then span length) ties with nearly every
format-specific detector on that exact shape — the single most common
credential shape in this corpus — so it wins on span length and the finding
is reported under the generic label instead of the tool's actual
purpose-built format detector. Left enabled, this relabels most named-format
findings (`github-token`, `slack-token`, ...) under the generic family with
an OVERBROAD range, making format-specific comparison against the other
three tools impossible for exactly the fixtures this corpus exists to test —
it flattens an entire dedicated corpus segment (`context-edges`, which wraps
one credential in many syntactic contexts) to a uniform, uninformative
OVERBROAD result regardless of the tool's real per-context detection. The
trade-off is explicit: flare-redact's own "detected something, but only a
generic assignment shape, no named format" recall (the `generic-token`
family) is not measured, in exchange for every named format being scored
against the detector that actually recognizes it. `high_entropy` (also a
generic catch-all) is already off by default and needs no explicit exclusion.

Offsets: `scan()` reports UTF-16 string indices (like `@redact-secret/core`),
already translated back through FRS-1's zero-width-normalization matching, so
the adapter converts with the same `Buffer.byteLength(text.slice(0, r.start))`
pattern used for redact-secret. This is verified against the corpus's
existing Unicode/CRLF fixtures in `tests/benchmark.test.mjs`. `includeValues`
is never set to `true`, and the adapter reads only `fixtures[].path`, never
`fixtures[].expected`.

Label mapping in `families.mjs` covers only ids whose matched format is
genuinely the same credential type as an existing family; providers with no
family in this corpus (Sentry, Airtable, Postman, Figma, Notion, Doppler,
Square, Azure, Discord, Telegram, New Relic, Databricks, GCP, Mailgun,
Netlify, Google, Twilio, Stripe webhook secrets) stay unmapped. Groq, xAI,
OpenRouter, Replicate and Perplexity ids map to the Beta.8 arrival families
measured in `beta8-208`/`beta8-212` (#208, #212; `docs/specs/beta8-evidence.md`). `aws_secret_key` shares the
`aws-access-key` family with `aws_access_key`, matching how the TruffleHog
adapter already families both halves of an AWS pair under one label.

**Result-reporting note:** flare-redact's own streaming guarantee covers
placeholder *restoration* across chunk boundaries; this corpus's streaming
methods cover *detection* across chunk boundaries with partition equivalence.
Those are different properties, and this corpus's whole-input fixtures
measure neither — any published comparison should say so, alongside the
secrets-only restriction and the (default, unfiltered) confidence threshold
above, so the numbers are not mistaken for a full-product comparison.

## PostgreSQL normalization

TruffleHog 3.97.4's Postgres detector (968) exports a normalized `Raw` URI:
it inserts a default port and drops the database path. The adapter matches
that credential/host/port identity against candidate source URIs, constrained
by reported line and database metadata, and accepts exactly one candidate.
It returns the original **whole URI**, not the ground-truth password span.
Ambiguous candidates still fail; expectations are never read during mapping.
Unit tests cover malformed/mismatching output and ambiguity; a real-binary
integration test covers Unicode/CRLF and the normalized URI transformation.
The external output contract was inspected in
[TruffleHog's v3.97.4 Postgres detector](https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/postgres/postgres.go).


## Gitleaks decoded PEM normalization

Gitleaks 8.30.1 can report a PEM twice: once with its encoded body and once
tagged `decoded:base64` / `decode-depth:1`, with public fixture prose replacing
that body. The adapter reconstructs the latter only when a single-line
canonical base64 PEM body, decoded text, matching delimiter pair, source file,
and start line uniquely identify the original range. It never reads expected
ranges. Both findings then deduplicate under the existing scorer.

A decoded row that repeats a plain row's location (same rule, file, lines and
start column; only `Secret` decoded, and `EndColumn`, which 8.30.1 reports as
0 on the decoded row after a UTF-8 BOM) is dropped before
normalization: it names no new range. Gitleaks does this for a Discord bot
token, whose first segment is base64 text. Any other decoded transformation
remains an explicit normalization failure.
Unit tests cover mismatched/unsupported output and missing source lines; a
real-binary integration check covers the encoded and decoded PEM path.
