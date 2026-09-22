# Corpus audit and separated measurements

Reviewed 2026-09-17 under measurement protocol v4 (`measurement-v4.md`):
provider documentation first, TruffleHog 3.97.4 and Gitleaks 8.30.1 sources as
corroboration. This is source/structure review by the project, not independent
human certification or proof of provider issuance. Corpus review status stays
draft. All existing inputs and expected ranges are preserved.

## What changed

All 605 fixture instances (549 existing + 56 twins) carry a `(kind, tier)`
assessment; every span carries a role and, where authored, an envelope:

| Kind | Tier | Files | Secret spans | Interpretation |
| --- | --- | ---: | ---: | --- |
| Must redact | T1 provider-documented | 130 | 135 | Provider documents the prefix scheme; body corroborated by pinned tools |
| Must redact | T2 tool-corroborated | 60 | 60 | No usable provider format documentation; pinned tools agree |
| Must not flag | T1 | 6 | 0 | Documented public prefixes and public key material |
| Must not flag | T2 | 114 | 0 | Malformed-by-construction shapes, near misses, public identifiers, 50 twins |
| Must not flag | T3 | 104 | 0 | Placeholders, references, templates, masks, prose |
| Policy | T3 | 158 | 158 | Standalone IDs, generic literals, URI passwords, OTP seeds, retained legacy expectations |
| Pending | T0 | 33 | 33 | Raw observations only; unscored |

Counts are fixture instances, not independent providers or unique credentials.
No score aggregates different kinds or tiers, and cross-suite views aggregate
only reports sharing one run id. Legacy v1/v2/v3 reports are rejected. 55
spans carry envelopes: every connection-string password (URI), OTP seed
(otpauth URI), Bearer value (Authorization header) and quoted generic
assignment (key plus quotes).

## Evidence tiers for all 25 families (protocol v4, phase 5)

Tier is assigned from provider documentation first; the pinned TruffleHog
3.97.4 and Gitleaks 8.30.1 sources are corroboration only and never sufficient
for T1. Provider pages were fetched on 2026-09-17 (`observedAt`). `Covers`
records what the provider document actually establishes; anything else in the
contract pattern is tool-corroborated and says so. Machine-readable contracts
are in [`benchmarks/lib/assessment.ts`](../../../benchmarks/lib/assessment.ts).

| Family | Tier | Provider source (observed 2026-09-17) | Covers | Corroboration / reason |
| --- | --- | --- | --- | --- |
| AWS | T1 | [IAM unique-ID prefixes](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes) | AKIA/ASIA/ABIA/ACCA prefixes | 16-char base32 body and 40-char secret from TruffleHog + Gitleaks; standalone IDs stay policy |
| GitHub | T1 | [Token formats](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats) | ghp_/gho_/ghu_/ghs_/ghr_, `_` separator, 6-char checksum (github.blog 2021-04-05) | 36-char body from TruffleHog + Gitleaks |
| GitLab | T1 | [Token prefixes](https://docs.gitlab.com/security/tokens/) | glpat- prefix | 20-char legacy body from tools; routable tokens not covered |
| OpenAI | T2 | — (platform docs require authentication) | — | marker + lengths from TruffleHog + Gitleaks |
| Anthropic | T2 | — (API docs describe headers, not key format) | — | TruffleHog + Gitleaks |
| Shopify | T1 | [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) | shpat_/shppa_ opaque tokens | 32-hex body from tools; shop-domain companion required |
| Vault | T1 | [Token concepts](https://developer.hashicorp.com/vault/docs/concepts/tokens) | hvs./hvb./hvr. + "24 or more" characters, structure opaque | contract is now `hv[sbr].` + ≥24; tools' 90–120 rule is corroboration; endpoint companion required |
| Stripe | T1 | [API keys](https://docs.stripe.com/keys) | sk_/rk_ live/test, pk_ publishable (safe to expose), sk_org_ | 32-char body from tools; pk_ twins are T1 controls; sk_org_/whsec_ pending |
| Slack | T1 | [Token types](https://docs.slack.dev/authentication/tokens) | xoxb-/xoxp-/xapp-/xwfp- prefixes, dash-separated sections, secret last | numeric widths + 24-char secret from tools; xwfp- body pending |
| PyPI | T1 | [pypi.org/help](https://pypi.org/help/#apitoken) | pypi- prefix, base64 macaroon | no lexical contract; existing 90-char bodies are policy until a serialized macaroon control exists |
| Hugging Face | T2 | — (docs show `hf_...` placeholder only) | — | tools disagree on alphabet; letters-only intersection; digit bodies pending |
| Docker | T2 | — (access-token docs omit format) | — | TruffleHog dockerhub/v2 |
| Cloudflare | T1 | [Create token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) | cfut_ scannable format | 40+8 structure from TruffleHog |
| DigitalOcean | T1 | [API release notes 2022-03-29](https://docs.digitalocean.com/release-notes/api/) | dop_v1_/doo_v1_/dor_v1_ | 64-hex body from tools |
| Linear | T2 | — (API docs omit format) | — | TruffleHog + Gitleaks; OAuth variant pending |
| Supabase | T0 | [API keys](https://supabase.com/docs/guides/api/api-keys) (prefix only, recorded as candidate) | sb_secret_/sb_publishable_ prefixes | body undocumented; pinned detector covers sbp_; pending |
| Vercel | T0 | — (REST API reference omits prefixes) | — | contextual 24-char detector only; pending |
| npm | T1 | [npm token format changelog](https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/) | npm_ prefix, `_` delimiter, 6-char Base62 CRC32 checksum | 36-char body from tools |
| SendGrid | T2 | — (docs mention length only in passing) | — | SG. 22/43 segments from TruffleHog + Gitleaks |
| Private keys | T1 | [RFC 7468](https://www.rfc-editor.org/rfc/rfc7468) | PEM labels and base64 body | Ed25519 PKCS#8 control parsed offline; prose-body PEMs are policy; PUBLIC KEY twin is a T1 control |
| JWT | T1 | [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) | three base64url segments | EdDSA control verified offline; fabricated HS256 token is policy |
| Bearer | T3 | [RFC 6750 §2.1](https://www.rfc-editor.org/rfc/rfc6750#section-2.1) (reference) | transport scheme | project masking policy; whole header is the envelope |
| Connection strings | T3 | [RFC 3986 §3.2.1](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1) (reference) | userinfo password | policy; whole URI is the envelope, so TruffleHog's canonical Postgres output is COVERED |
| OTP URI | T3 | [Key URI format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format) (reference) | seed parameter | policy; whole otpauth URI is the envelope |
| Generic values | T3 | — | — | policy; quoted assignment is the envelope |

The pending (T0) queue is now 33 files: Hugging Face digit bodies, Stripe
organization/webhook, Slack workflow, Linear OAuth, Supabase project and Vercel
variants. The three Vault recovery contexts moved from pending to policy because
the provider documents the `hvr.` prefix; they lack the endpoint companion. All
samples and their original expectations remain inspectable.

## Twins (phase 6)

Every `common-formats` positive except the AWS ID/secret pair has a negative
twin that mutates exactly one structural property (length, alphabet, prefix
namespace, boundary character, or a documented public prefix). 56 twins; the
Stripe `pk_` and RFC 7468 `PUBLIC KEY` twins are T1 controls. Twin
discrimination is reported per (kind × tier) group as `discriminated / pairs`,
with `pairs / positives` as the coverage gap. Suites beyond common-formats are
un-twinned; #316–#325 remain the authoring plan.

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

## Observations from the v4 baseline run

Local macOS arm64 run `2026-09-17T18:58:05.028Z-fe936e`: redact-secret
0.1.0-beta.4, Gitleaks 8.30.1, TruffleHog 3.97.4. Saved as
`baselines/0.1.0-beta.4.json`; the generated
[release comparison](../../generated/release-comparison.md) is the maintained view. Suites are
summed below for readability only; these are not a product ranking.

| Group | Scanner | Leaked spans | Collateral | Twins discriminated |
| --- | --- | ---: | ---: | ---: |
| must-redact/T1 | redact-secret | 0 / 135 | 0.000 | 28 / 38 |
| must-redact/T1 | Gitleaks | 2 / 135 | 0.000 | 32 / 38 |
| must-redact/T1 | TruffleHog | 10 / 135 | 0.000 | 32 / 38 |
| must-redact/T2 | redact-secret | 0 / 60 | 0.000 | 4 / 18 |
| must-redact/T2 | Gitleaks | 7 / 60 | 0.000 | 14 / 18 |
| must-redact/T2 | TruffleHog | 10 / 60 (all PARTIAL) | 0.000 | 14 / 18 |

| Group | Scanner | False alarms |
| --- | --- | ---: |
| must-not-flag/T2 | redact-secret | 24 / 114 |
| must-not-flag/T2 | Gitleaks | 5 / 114 |
| must-not-flag/T2 | TruffleHog | 8 / 114 |
| must-not-flag/T3 | TruffleHog | 10 / 104 |

Twin discrimination is the number v3 could not produce: redact-secret covers
every positive but flags twins for OpenAI, Slack, Hugging Face, Docker,
Cloudflare, DigitalOcean and Linear (a one-character-shorter or mis-delimited
body still triggers a finding). Gitleaks flags the Slack and unsigned-JWT twins;
TruffleHog flags the OpenAI project/service-account and Slack twins. TruffleHog's
whole-URI Postgres findings are now `COVERED` (12 of 12) instead of FP + FN,
and its T2 misses are `PARTIAL` (SendGrid findings that omit a boundary
character). Envelopes and twins were authored before this run and were not
adjusted after it.

## Reproduce and maintain

```sh
npm run fixtures:check
npm test
npm run test:integration
npm run bench -- --strict
npm run build
```

Generation is deterministic. Reviewed lexical shapes, required companions,
envelopes, twins, PKCS#8 parsing and JWT signatures are checked before
scanning. Every future fixture needs `(kind, tier)` metadata; unknown inputs
default to T0. Save a baseline with `npm run baseline -- --save <version>` after
a complete run and regenerate the comparison with `npm run baseline:report`.
Classification cannot depend on scanner results. New independently sourced
formats should be added even if one or all scanners miss them. Generated
reports are gitignored; each run records versions, corpus/lock hashes,
revision and matching protocol. Historical mixed-score documents are retained
as regression snapshots, with a notice directing comparative interpretation
to this audit and the separated reports.
