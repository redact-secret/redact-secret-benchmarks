# Corpus audit and separated measurements

Reviewed 2026-09-17 against TruffleHog 3.97.4 and Gitleaks 8.30.1 source
contracts. This is source/structure review by the project, not independent
human certification or proof of provider issuance. Corpus review status stays
draft. All existing 491 inputs and expected ranges are preserved.

## What changed

All 549 fixture instances (491 existing + 58 new) carry an assessment:

| Purpose | Files | Authored expected spans | Interpretation |
| --- | ---: | ---: | --- |
| Reviewed credential formats | 190 | 195 | Source-backed lexical formats, required companion context, or locally validated cryptographic structure |
| Standalone values & masking policy | 69 | 69 | Isolated IDs, generic literals, bearer values, URI passwords and OTP seeds |
| Malformed, examples & controls | 254 | 86 | Malformed shapes and public examples, plus benign/reference/placeholder controls; historical policy expectations retained |
| Format review pending | 36 | 36 | Raw observations only; no TP/FP/FN or rates |

These are counts of fixture instances, not independent providers or unique
credentials. Repeated contexts and suites reuse shapes. Detector pages overlap.
No score aggregates different purposes. Overview, detector pages, suite pages
and schema-v3 exports all preserve the split. Legacy v1/v2 reports are rejected.

The new `common-formats` suite adds 58 cases / 60 secret spans over 18 families.
It includes lexical shapes from pinned sources, AWS ID/secret pairs, Shopify
tokens with shop domains, an explicit Vault endpoint, and a parseable Ed25519
key and locally signed EdDSA JWT from a fixed public test seed. No test key has
been deployed. Lexical controls do not establish provider checksum/payload
validity. Unsupported formats remain in the suite; inclusion never depends on
which scanner reports a match.

## Review of all 25 families

Pinned evidence and machine-readable acceptance rules are in
[`benchmarks/lib/cohorts.mjs`](../benchmarks/lib/cohorts.mjs). Every reviewed
fixture exposes its source links in the dashboard and corpus JSON.

| Family | Audit finding and treatment |
| --- | --- |
| AWS | Existing cases isolate the ID/secret, so they measure masking. ASIA also requires session material. New AKIA ID + secret cases supply both. No ASIA session-validity claim. |
| GitHub | Generated five-prefix, 36-character shapes fit lexical rules. Obvious starter `SYNTHETIC`/filler cases stay example regressions. Token checksums are not validated. |
| GitLab | Existing 20-character PAT bodies match the inspected legacy lexical shape. Routable/newer variants are not implied. |
| OpenAI | Existing arbitrary 48-character bodies omit the internal marker and modern lengths. New legacy, project and service-account lexical shapes retain the marker. |
| Anthropic | Existing body has 80 characters. New API shape has 93 characters plus `AA`. Legacy cases are malformed-shape regressions. |
| Shopify | Existing hex tokens lack the shop domain TruffleHog requires: standalone masking. New cases include a shop domain. |
| Vault | Existing 32-character service/batch bodies are too short for the inspected rules. Recovery-token variant remains unreviewed. New service shape includes endpoint context; encoded payload validity is not claimed. |
| Stripe | Live/test lexical shapes stay reviewed, even though TruffleHog’s rule only targets live values. Organization/webhook variants require independent contracts. |
| Slack | Prefix + 48 arbitrary characters omits numeric/segmented structure. New bot cases include numeric team/bot fields. `xwfp-` remains pending evidence. |
| PyPI | Arbitrary `pypi-` + 90 characters lacks the macaroon prefix/structure. Existing cases are malformed regressions. No new normal-format claim until a serialized macaroon control is added. |
| Hugging Face | Pinned rules disagree: letters-only in Gitleaks versus alphanumeric in TruffleHog. Existing digit-containing bodies remain unreviewed, not automatically invalid. New letters-only bodies satisfy both lexical contracts. |
| Docker | PAT body was 32 rather than 27 characters; organization-token body was already 32. New PAT/OAT controls preserve misses by unsupported scanners. |
| Cloudflare | Existing `cfut_` lacks the eight hexadecimal suffix characters. New lexical controls include them. Checksums are not validated. |
| DigitalOcean | Existing three prefixes plus 64 hex characters match inspected lexical contracts; retained as reviewed. |
| Linear | API token shape is reviewed. OAuth variant requires a separate contract and remains unscored. |
| Supabase | Inspected TruffleHog detector targets `sbp_` management tokens; corpus uses `sb_secret_` project credentials. Do not infer parity or replace a credential class to improve scores. Pending. |
| Vercel | Inspected TruffleHog rule is a contextual 24-character token, unlike five prefixed variants in the corpus. Those variants remain unreviewed. |
| npm | Existing prefix + 36-character lexical shapes match inspected rules. No issuance or token-generation-era claim. |
| SendGrid | Segmented 22/43-character lexical shapes stay reviewed, including punctuation/boundary cases. Partial range findings remain visible; results do not determine classification. |
| Private keys | Existing PEM labels wrap public prose, not key bytes. New PKCS#8 Ed25519 control is parseable offline. A miss on the valid control is retained, not reclassified to improve scores. |
| JWT | Existing expired HS256 token has a fabricated signature. TruffleHog explicitly skips HMAC JWTs. New EdDSA control verifies locally against the public test key. |
| Bearer | Transport syntax does not identify a provider or validate an arbitrary value. Generic masking policy. |
| Connection strings | Password-only expectations differ from scanners returning whole URIs. Separate masking purpose; preserve whole-URI output and containment. |
| OTP URI | Seed-only expectations test masking granularity, not equal provider/detector support. |
| Generic values | Sensitive-field literals are project masking expectations, not provider-format ground truth. |

The pending queue contains Hugging Face digit bodies, Vault recovery, Stripe
organization/webhook, Slack workflow, Linear OAuth, Supabase project and Vercel
variants. It is explicit incomplete format coverage, not a claim of failure by
any scanner. All samples and their original expectations remain inspectable.

## Adapter defects uncovered

- [AWS output](https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/aws/access_keys/accesskey.go)
  includes ID in `Raw` and ID/secret in `RawV2`. The old adapter used only the
  former. The new adapter maps both reported secret components independently.
- [Shopify output](https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/shopify/shopify.go)
  concatenates token and domain. The new adapter maps the token, checks the
  companion domain, and does not manufacture a contiguous composite range.
- PostgreSQL continues to retain the full URI. No adapter trims a finding to
  match an expected range. Unsupported and ambiguous transformations fail.

Tests deliberately pass empty or unrelated expectations into these adapters.
TruffleHog still uses `--no-verification --no-update` and includes unverified
output. A scanner failure is never treated as a successful scan with no hits.

## New-suite observations

Local macOS arm64 run: redact-secret 0.1.0-beta.4, Gitleaks 8.30.1,
TruffleHog 3.97.4. These positive-only controls are not a product ranking.

| Scanner | Exact matched spans / 60 | Extra ranges | Unmatched spans |
| --- | ---: | ---: | ---: |
| redact-secret | 60 / 60 | 0 | 0 |
| Gitleaks | 54 / 60 | 0 | 6 |
| TruffleHog | 56 / 60 | 0 | 4 |

Gitleaks misses remain on Docker PAT/OAT and Cloudflare prefixed tokens.
TruffleHog misses remain on Stripe test-mode tokens and the parseable Ed25519
PKCS#8 control. Each shape appears in two contexts. The Stripe rule’s live-only
scope is explicit in source; the Ed25519 observation is reproduced but its
internal cause has not been established. Do not generalize it to all PEM keys.
Anthropic and AWS pair controls are now detected by all three tools.

## Reproduce and maintain

```sh
npm run fixtures:check
npm test
npm run test:integration
npm run bench -- --strict
npm run build
```

Generation is deterministic. Reviewed lexical shapes, required companions,
PKCS#8 parsing and JWT signatures are checked before scanning. Every future
fixture needs assessment metadata; unknown inputs default to pending review.
Classification cannot depend on scanner results. New independently sourced
formats should be added even if one or all scanners miss them. Generated
reports are gitignored; each run records versions, corpus/lock hashes,
revision and matching protocol. Historical mixed-score documents are retained
as regression snapshots, with a notice directing comparative interpretation
to this audit and the separated reports.
