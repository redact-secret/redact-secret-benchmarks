# scanners

Per-tool invocation adapters (redact-secret, Gitleaks, TruffleHog) that run a
scanner against the materialized `fixtures/` corpus and normalize its output
to the common ground-truth schema for scoring.

`index.mjs` defines the adapter registry. redact-secret uses only the public
API of its pinned npm package; Gitleaks and TruffleHog are external binaries
on `PATH`. Neither competitor's source or binary is bundled.

Adapters return `{ path, start, end, family? }` in UTF-8 bytes. `families.mjs`
maps explicitly recognized native detector labels to shared families; unknown
labels remain unmapped. No family is inferred from the expected fixture. Raw external findings
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
TruffleHog **3.97.4**, and `@redact-secret/core` **0.1.0-beta.4** on macOS
arm64. Install the external tools using `brew install gitleaks trufflehog`.
Other systems can use the upstream installation instructions above.

`npm run test:integration` requires all three actual scanners. For each, it
checks exact byte ranges for a synthetic GitHub-shaped positive with Unicode
and CRLF before the token, then checks a negative-only directory. Missing
tools fail rather than skip. These tests never use live verification and
never write raw scanner output. `npm run compare` runs these controls before
generating strict comparison reports. Installed versions are recorded in
every report, so results remain attributable when binaries are upgraded.

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

Other decoded transformations remain explicit normalization failures.
Unit tests cover mismatched/unsupported output and missing source lines; a
real-binary integration check covers the encoded and decoded PEM path.
