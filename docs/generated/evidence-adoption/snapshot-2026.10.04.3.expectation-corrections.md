# Expectation corrections proposed to credential-evidence (#698, core #1203)

**Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: 96 maintainer-only fixtures, 0 independently reviewed. These are the product maintainers' proposals; the evidence owners decide, and the evidence is not edited here. Tracking: credential-evidence#221, redact-secret#1203 and PR #1204.

| Case | Proposed change | Why (product disposition) | Root causes |
| --- | --- | --- | ---: |
| `authored-provider-neutral--pytest-fake-fixtures` | allow a warn-level finding on the control (policy-ambiguous, review-required) or rename the variable | a low-entropy literal under a credential name is `medium`, action `warn`, text unchanged, by the assignment contract; the control expects no finding at all | 2 |
| `exa--exa-api-key-other-host-twin` | scope the twin to the Exa family or accept a generic finding | the Exa-gated detector does not fire off its host; the generic `x-api-key` header assignment redacts the UUID at high confidence on every host | 1 |
| `http-auth-carriers-authored--basic-empty-password` | expect `redact` (or review-required); an expectation that needs base64 decoding is not assertable on the raw-input contract | the product claims an `Authorization: Basic` value without decoding (#491), so an empty password cannot be told from a credential; the value is redacted by contract | 6 |
| `http-auth-carriers-authored--basic-rfc-published-example` | expect `redact` (or review-required); not assertable without decoding | the product claims an `Authorization: Basic` value without decoding (#491), so a published RFC 7617 example cannot be told from a credential; the value is redacted by contract | 6 |
| `structured-credential-files-authored--aws-credentials-file-two-profiles` | add the two `aws_access_key_id` values as expected secret spans or allowed co-detections | the three secret spans are exact in every variant; the `aws-access-key` family redacts the two key ids, which the expectation does not list, so every variant fails the envelope check on collateral only | 3 |
| `structured-credential-files-authored--service-account-key-file-minified-json` | expected span 134-548 (ends at the footer), not 134-550 | a private-key block ends at its footer, as a raw PEM does; the escaped `\n` after `-----END PRIVATE KEY-----` is a line separator and stays in the output | 5 |
| `structured-credential-files-authored--service-account-key-file-pretty-json` | expected span 150-564 (ends at the footer), not 150-566 | a private-key block ends at its footer, as a raw PEM does; the escaped `\n` after `-----END PRIVATE KEY-----` is a line separator and stays in the output | 5 |
| `twilio-compound-credentials-authored--api-key-sid-alone` | re-author the value as `SK` + 32 lowercase hex (the product returns clean) or expect a redact | the documented identifier excluded under every contextual name is `SK` + 32 lowercase hex (#746); the evidence value is not that shape, so the generic assignment claims it | 5 |

## Post-release replays (a product fix, no evidence change)

Fixed in redact-secret PRs #1202 and #1204 and replayed clean on the unpublished candidate 1e45cecf; they appear in an official run only after a release carries the fix.

- `authored-provider-neutral--terraform-apply-sensitive`
- `exa--exa-api-key-your-key-here-placeholder`
- `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters`
- `structured-credential-files-authored--documented-template-placeholders`
