# beta9-external-inputs

The first adversarial pack for
[#140](https://github.com/redact-secret/redact-secret-benchmarks/issues/140).
It has 80 fixtures (38 `must-redact`, 42 `must-not-flag`). Every input is either
copied verbatim from an externally authored, redistributable public source or
put together from such excerpts. No credential-like value was generated here.

## What this pack is not

**It is not externally authored.** The inputs were written outside the
project, by IETF RFC authors, the AWS CLI documentation team, and the
detect-secrets, Nosey Parker, Big List of Naughty Strings and Trojan Source
authors. None of them wrote with redact-secret in mind. The project chose the
excerpts, wrote the compositions, and set every action and range, and it did
so after reading the product's contextual-detection spec. So the intake record
names the project as author, and the validator gives it the
`maintainer-regression` qualification. Report it only as maintainer
regression. Do not call it independent or externally authored, and do not add
it to support qualification.

A pack qualifies as `externally-authored` only when an outside author
submits it through [the intake contract](../../README.md). Getting that
submission is still open for #140.

## Files

| File | Role |
| --- | --- |
| `intake.json` | The intake record (`schemas/adversarial-intake-v1.json`). |
| `sources.json` | Provenance for each fixture: source, pinned upstream revision, license, `verbatim` or `composed`, and the #140 category. |
| `build-intake.mjs` | The authoring tool. Credential parts are marked in the text and converted to UTF-8 byte ranges. It never imports a scanner. It refuses to rewrite an intake that has moved past `submitted`. |
| `first-run.json` | The frozen first run (added at `frozen-first-run`). |

## Sources and licenses

| Key | Source | License |
| --- | --- | --- |
| `rfc6749`, `rfc6750`, `rfc7515`, `rfc7519`, `rfc7617`, `rfc7636`, `rfc8959`, `rfc3986` | IETF RFC example values (rfc-editor.org text) | IETF Trust Legal Provisions; code components BSD-3-Clause |
| `detect-secrets` | [Yelp/detect-secrets@5e14193](https://github.com/Yelp/detect-secrets/tree/5e141933554a0b74e7341841f318be21e895339c/tests) test cases | Apache-2.0 |
| `noseyparker` | [praetorian-inc/noseyparker@2e6e7f3](https://github.com/praetorian-inc/noseyparker/tree/2e6e7f36ce36619852532bbe698d8cb7a26d2da7/crates/noseyparker/data/default/builtin/rules) rule examples | Apache-2.0 |
| `blns` | [minimaxir/big-list-of-naughty-strings@db33ec7](https://github.com/minimaxir/big-list-of-naughty-strings/blob/db33ec7b1d5d9616a88c76394b7d0897bd0b97eb/blns.txt) | MIT |
| `trojan-source` | [nickboucher/trojan-source@e3dc153](https://github.com/nickboucher/trojan-source/tree/e3dc153fcf465f4a84424ea874ff39be29adb1f7/JavaScript) | MIT |
| `aws-cli` | [aws/aws-cli@4a54791](https://github.com/aws/aws-cli/blob/4a54791df2da35778bca1325f71b1cb0b4ba770a/awscli/examples/iam/create-access-key.rst) | Apache-2.0 |

## Sources left out, and why

- **Gitleaks, TruffleHog and flare-redact test data.** These are evaluated
  scanners. Their fixtures encode their own expected output, so using them
  would tilt the comparison.
- **SecretBench and FPSecretBench.** Both were mined from real repositories
  and may contain live credentials. Access is also gated behind a
  data-protection agreement.
- **Leaky Repo.** Its values are described as "randomized or redacted" real
  leaks. The intake contract rejects real-derived material.
- **Nosey Parker positive examples whose origin is unclear** (for example
  the .NET `NetworkCredential` samples). Only their negative examples and
  plainly invented phrases are used here.
- **Negative examples that reflect a rule's scope, not the meaning of the
  value** (for example Nosey Parker's unquoted `password = super$ecret`,
  and detect-secrets' "quotes required" misses). They say what one scanner
  does, not what the value is.

## Scope

The pack covers every #140 category except streaming chunk splits. Intake v1
evaluates whole fixtures only and has no chunk dimension, so the multiline
fixtures cover only line-split values. Results describe these 80 fixtures and
nothing else. They say nothing about overall accuracy.

Use this pack for evaluation only, not for tuning. It is public, so it cannot
act as a protected holdout (#256), and nobody should pick detector features,
weights or thresholds by fitting to it.

## Known gaps

Every redact-secret failure in `first-run.json` (21 misses, 4 partial, 7
flagged benign inputs) and the 5 `must-redact` fixtures whose finding only
warns is a record in
[`benchmarks/known-gaps.json`](../../../benchmarks/known-gaps.json), keyed
`beta9-external-inputs--<fixture id>` with the pack's expectations digest as
its corpus hash. One product issue backs each root cause:

| Record | Product issue | Status | Fixtures |
| --- | --- | --- | ---: |
| `product-815` | [assignment forms: escaped JSON quotes, `:=`, `@"..."`, braces in the value](https://github.com/redact-secret/redact-secret/issues/815) | fixed | 4 |
| `product-816` | [URL query, fragment and form-body parameters](https://github.com/redact-secret/redact-secret/issues/816) | fixed | 7 |
| `product-817` | [references and identifiers flagged under credential names](https://github.com/redact-secret/redact-secret/issues/817) | fixed | 5 |
| `product-818` | [`Proxy-Authorization`, mid-line Basic, header-anchored Bearer floor](https://github.com/redact-secret/redact-secret/issues/818) | fixed | 3 |
| `product-819` | [RFC 8959 `secret-token:` URIs](https://github.com/redact-secret/redact-secret/issues/819) | fixed | 3 |
| `product-820` | [http(s)/ftp URL userinfo passwords](https://github.com/redact-secret/redact-secret/issues/820) | fixed | 1 |
| `product-821` | [JWK secret members](https://github.com/redact-secret/redact-secret/issues/821) | fixed | 1 |
| `product-822` | [policy: RFC display line breaks, percent-encoded query in JSON](https://github.com/redact-secret/redact-secret/issues/822) | policy-decision | 3 |
| `product-823` | [policy: reversed comparison, C++ constructor, `db_pass`](https://github.com/redact-secret/redact-secret/issues/823) | policy-decision | 3 |
| `product-824` | [policy: `warn` on short literals in benign code](https://github.com/redact-secret/redact-secret/issues/824) | policy-decision | 2 |
| `product-825` | [policy: short values warn instead of redact](https://github.com/redact-secret/redact-secret/issues/825) | policy-decision | 5 |

`product-815` to `product-821` are `fixed`, each by the redact-secret merge
commit named in its `fix.commit`. On that code every fixture in them reports
its expected range. A maintainer confirmed the four policy records. The
`product-823` disposition also notes that its `db_pass` fixture is fixed by
redact-secret#838; the other two fixtures in that record stay out of
contract. Reaching `verified` needs a product regression record for each
gap, and the pin manifest has listed pack fixtures only since #310. The first
run stays frozen; fixed candidates are measured by a separate rerun.
