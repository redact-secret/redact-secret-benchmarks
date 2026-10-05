# Product candidate on the old and the new evidence: the 2x2 (#698)

A measurement, not a decision: nothing here asserts a product result, moves a status or edits the evidence. Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): `maintainerOnly` marks a case the release records as maintainer-only (credential-evidence ADR 0020); none is independently reviewed.

| | old corpus | new corpus |
| --- | --- | --- |
| control (published) | A | C |
| candidate (unpublished) | B | D |

Corpus: 6449 to 6519 cases (added 70, removed 0, changed 8, common 6441).

## Corpus effect (control, A to C)

On the 6441 common cases: 0 differ (fixed 0, regressed 0, changed 0).
On the 8 changed cases: fixed 3, regressed 0, changed 3.

Added cases on the control: cases 70, pass 58, fail 7, pending 5, notMeasured 0, absent 0; on the candidate: cases 70, pass 58, fail 7, pending 5, notMeasured 0, absent 0. Pending and not-measured cases are in no denominator.

### Changed cases on the control

- `structured-credential-files-authored--service-account-key-file-minified-json`: PARTIAL to EXACT
- `structured-credential-files-authored--service-account-key-file-pretty-json`: PARTIAL to EXACT
- `twilio-compound-credentials-authored--api-key-sid-alone`: flagged to clear
- `structured-credential-files-authored--aws-credentials-file-two-profiles`: EXACT/EXACT/EXACT to EXACT/EXACT/EXACT
- `twilio-compound-credentials-authored--api-key-secret-before-sid`: EXACT to EXACT
- `twilio-compound-credentials-authored--api-key-sid-and-secret-env`: EXACT to EXACT

### Added cases the control fails

- `graphql-requests-and-responses-authored--get-url-variables-value`: absent to MISS
- `har-exports-authored--bearer-token-in-postdata-params`: absent to MISS
- `har-exports-authored--bearer-token-in-url-and-querystring-array`: absent to EXACT/MISS
- `har-exports-authored--session-cookie-in-headers-and-cookies-arrays`: absent to MISS/MISS/MISS/MISS
- `hashicorp-terraform-authored--state-json-output-password-with-sensitive-true`: absent to MISS
- `jupyter-notebook-files-authored--source-value-split-between-array-elements`: absent to MISS
- `jupyter-notebook-files-authored--stdout-mask-where-source-has-environment-reference`: absent to flagged

## Product effect (control to candidate)

Old corpus (A to B): fixed 4, regressed 0, changed 0.
- `authored-provider-neutral--terraform-apply-sensitive`: flagged to clear
- `exa--exa-api-key-your-key-here-placeholder`: flagged to clear
- `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters`: MISS to EXACT
- `structured-credential-files-authored--documented-template-placeholders`: flagged to clear

New corpus (C to D): fixed 4, regressed 0, changed 0.
- `authored-provider-neutral--terraform-apply-sensitive`: flagged to clear
- `exa--exa-api-key-your-key-here-placeholder`: flagged to clear
- `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters`: MISS to EXACT
- `structured-credential-files-authored--documented-template-placeholders`: flagged to clear

## Interaction

On the common cases the product effect differs between the corpora in 0 cases. Only on the new corpus (not separable from the corpus): 8 changed and 70 added cases.

## Methods run

```json
{
 "assertions": {
  "counts": {
   "A": 47632,
   "B": 47632,
   "C": 48210,
   "D": 48210,
   "addedByNewCorpus": 578,
   "addedFailingOnControl": 96
  },
  "corpusEffectControlOnCommon": {
   "fixed": [],
   "regressed": [],
   "absentInTarget": []
  },
  "productEffectOld": {
   "fixed": [
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|same-detection||canonical|context.indent",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|same-detection||canonical|context.unicode-prefix",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|same-detection||canonical|encoding.crlf",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|canonical||",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|context.indent||",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|context.unicode-prefix||",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|encoding.crlf||",
    "authored-provider-neutral--terraform-apply-sensitive--mutation|mutation|absent|canonical||",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|same-detection||canonical|context.indent",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|same-detection||canonical|context.unicode-prefix",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|same-detection||canonical|encoding.crlf",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|absent|canonical||",
    "... 20 more"
   ],
   "regressed": [],
   "absentInTarget": []
  },
  "productEffectNew": {
   "fixed": [
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|same-detection||canonical|context.indent",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|same-detection||canonical|context.unicode-prefix",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|same-detection||canonical|encoding.crlf",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|canonical||",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|context.indent||",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|context.unicode-prefix||",
    "authored-provider-neutral--terraform-apply-sensitive--metamorphic|metamorphic|absent|encoding.crlf||",
    "authored-provider-neutral--terraform-apply-sensitive--mutation|mutation|absent|canonical||",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|same-detection||canonical|context.indent",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|same-detection||canonical|context.unicode-prefix",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|same-detection||canonical|encoding.crlf",
    "exa--exa-api-key-your-key-here-placeholder--metamorphic|metamorphic|absent|canonical||",
    "... 20 more"
   ],
   "regressed": [],
   "absentInTarget": []
  },
  "interactionOnCommon": []
 },
 "reviewOccurrences": {
  "sizes": {
   "A": 11525,
   "B": 11520,
   "C": 11622,
   "D": 11617
  },
  "productOld": {
   "added": [
    "authored-provider-neutral--terraform-apply-sensitive--differential|openredaction|peer-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|flare-redact|range-disagreement|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|gitleaks|reference-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|openredaction|reference-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|trufflehog|reference-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|flare-redact|peer-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|openredaction|peer-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|trufflehog|peer-only|canonical||differential"
   ],
   "removed": [
    "authored-provider-neutral--terraform-apply-sensitive--differential|flare-redact|reference-only|canonical||differential",
    "authored-provider-neutral--terraform-apply-sensitive--differential|gitleaks|reference-only|canonical||differential",
    "authored-provider-neutral--terraform-apply-sensitive--differential|openredaction|range-disagreement|canonical||differential",
    "authored-provider-neutral--terraform-apply-sensitive--differential|trufflehog|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|flare-redact|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|gitleaks|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|openredaction|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|trufflehog|reference-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|flare-redact|peer-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|flare-redact|range-disagreement|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|gitleaks|reference-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|openredaction|range-disagreement|canonical||differential",
    "... 1 more"
   ]
  },
  "productNew": {
   "added": [
    "authored-provider-neutral--terraform-apply-sensitive--differential|openredaction|peer-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|flare-redact|range-disagreement|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|gitleaks|reference-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|openredaction|reference-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|trufflehog|reference-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|flare-redact|peer-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|openredaction|peer-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|trufflehog|peer-only|canonical||differential"
   ],
   "removed": [
    "authored-provider-neutral--terraform-apply-sensitive--differential|flare-redact|reference-only|canonical||differential",
    "authored-provider-neutral--terraform-apply-sensitive--differential|gitleaks|reference-only|canonical||differential",
    "authored-provider-neutral--terraform-apply-sensitive--differential|openredaction|range-disagreement|canonical||differential",
    "authored-provider-neutral--terraform-apply-sensitive--differential|trufflehog|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|flare-redact|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|gitleaks|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|openredaction|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|trufflehog|reference-only|canonical||differential",
    "generic-connection-grammar-authored--amqp-uri-all-sub-delimiters--differential|flare-redact|peer-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|flare-redact|range-disagreement|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|gitleaks|reference-only|canonical||differential",
    "structured-credential-files-authored--documented-template-placeholders--differential|openredaction|range-disagreement|canonical||differential",
    "... 1 more"
   ]
  },
  "corpusControl": {
   "added": [
    "docker-compose-resolution-authored--default-literal--differential|trufflehog|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|flare-redact|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|gitleaks|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|openredaction|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|trufflehog|reference-only|canonical||differential",
    "docker-compose-resolution-authored--resolved-config-literal--differential|trufflehog|reference-only|canonical||differential",
    "github-actions-workflow-commands-authored--add-mask-literal-argument--differential|trufflehog|reference-only|canonical||differential",
    "github-actions-workflow-commands-authored--base-token--differential|trufflehog|reference-only|canonical||differential",
    "github-actions-workflow-commands-authored--env-file-echo--differential|trufflehog|reference-only|canonical||differential",
    "github-actions-workflow-commands-authored--multiline-record-eof-delimiter--differential|trufflehog|reference-only|canonical||differential",
    "github-actions-workflow-commands-authored--multiline-record-guid-delimiter--differential|trufflehog|reference-only|canonical||differential",
    "github-actions-workflow-commands-authored--multiline-record-written-by-brace-group--differential|trufflehog|reference-only|canonical||differential",
    "... 92 more"
   ],
   "removed": [
    "twilio-compound-credentials-authored--api-key-secret-before-sid--differential|flare-redact|reference-only|canonical||differential",
    "twilio-compound-credentials-authored--api-key-secret-before-sid--differential|openredaction|reference-only|canonical||differential",
    "twilio-compound-credentials-authored--api-key-sid-alone--differential|flare-redact|reference-only|canonical||differential",
    "twilio-compound-credentials-authored--api-key-sid-alone--differential|openredaction|reference-only|canonical||differential",
    "twilio-compound-credentials-authored--api-key-sid-alone--differential|trufflehog|reference-only|canonical||differential",
    "twilio-compound-credentials-authored--api-key-sid-and-secret-env--differential|flare-redact|reference-only|canonical||differential",
    "twilio-compound-credentials-authored--api-key-sid-and-secret-env--differential|openredaction|reference-only|canonical||differential"
   ]
  }
 },
 "semanticDigests": {
  "A": "sha256:27d4a77fb55aed3c3139e28ec053a5eeea2f3157749f448c54674b14e553155f",
  "B": "sha256:50e1b4673273f6025d043c43547b463bd2a1b468303acd69bf522b5e80a0247c",
  "C": "sha256:3b5c750a1f973760b4f08d748525e280b6a516feb0e013ccfdc8c87ff66e2442",
  "D": "sha256:da4d957dbe7f9416ca88536df66ddc530802810338ff16eb11608f8b83049215"
 }
}
```

## Unexplained

none: every difference is an added or changed case, or the product change itself.
