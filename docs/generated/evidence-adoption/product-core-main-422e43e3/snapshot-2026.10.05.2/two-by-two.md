# Product candidate on the old and the new evidence: the 2x2 (#698)

A measurement, not a decision: nothing here asserts a product result, moves a status or edits the evidence. Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): `maintainerOnly` marks a case the release records as maintainer-only (credential-evidence ADR 0020); none is independently reviewed.

| | old corpus | new corpus |
| --- | --- | --- |
| control (published) | A | C |
| candidate (unpublished) | B | D |

Corpus: 6519 to 6519 cases (added 0, removed 0, changed 11, common 6508).

## Corpus effect (control, A to C)

On the 6508 common cases: 0 differ (fixed 0, regressed 0, changed 0).
On the 11 changed cases: fixed 0, regressed 0, changed 11.

Added cases on the control: cases 0, pass 0, fail 0, pending 0, notMeasured 0, absent 0; on the candidate: cases 0, pass 0, fail 0, pending 0, notMeasured 0, absent 0. Pending and not-measured cases are in no denominator.

### Changed cases on the control

- `polar--polar-api-credential-body-42-twin`: clear to pending
- `polar--polar-api-credential-body-44-twin`: clear to pending
- `polar--polar-api-credential-checkout-link-secret-public-id`: clear to pending
- `polar--polar-api-credential-client-id-in-url-public-id`: clear to pending
- `polar--polar-api-credential-leading-glue-twin`: clear to pending
- `polar--polar-api-credential-setting-names-public-id`: clear to pending
- `polar--polar-token-body-44-twin`: clear to pending
- `polar--polar-token-leading-glue-twin`: clear to pending
- `polar--polar-token-oauth-client-id-public-id`: clear to pending
- `polar--polar-token-trailing-hyphen-twin`: clear to pending
- `polar--polar-token-trailing-underscore-twin`: clear to pending

### Added cases the control fails

- none

## Product effect (control to candidate)

Old corpus (A to B): fixed 4, improved 2, regressed 0, changed 0.
- `authored-provider-neutral--terraform-apply-sensitive`: flagged to clear
- `exa--exa-api-key-your-key-here-placeholder`: flagged to clear
- `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters`: MISS to EXACT
- `structured-credential-files-authored--documented-template-placeholders`: flagged to clear

Improved (passing before and after, fewer unexpected findings or less collateral):
- `docker-compose-resolution-authored--required-message`: clear to clear
- `jupyter-notebook-files-authored--same-value-in-source-stream-result-json-error-and-traceback`: EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT to EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT

New corpus (C to D): fixed 4, improved 2, regressed 0, changed 0.
- `authored-provider-neutral--terraform-apply-sensitive`: flagged to clear
- `exa--exa-api-key-your-key-here-placeholder`: flagged to clear
- `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters`: MISS to EXACT
- `structured-credential-files-authored--documented-template-placeholders`: flagged to clear

Improved:
- `docker-compose-resolution-authored--required-message`: clear to clear
- `jupyter-notebook-files-authored--same-value-in-source-stream-result-json-error-and-traceback`: EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT to EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT

## Interaction

On the common cases the product effect differs between the corpora in 0 cases. Only on the new corpus (not separable from the corpus): 11 changed and 0 added cases.

## Methods run

```json
{
 "assertions": {
  "counts": {
   "A": 48210,
   "B": 48210,
   "C": 48210,
   "D": 48210,
   "addedByNewCorpus": 27,
   "addedFailingOnControl": 27
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
    "... 28 more"
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
    "... 28 more"
   ],
   "regressed": [],
   "absentInTarget": []
  },
  "interactionOnCommon": []
 },
 "reviewOccurrences": {
  "sizes": {
   "A": 11622,
   "B": 11613,
   "C": 11622,
   "D": 11613
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
    "docker-compose-resolution-authored--required-message--differential|flare-redact|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|gitleaks|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|openredaction|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|trufflehog|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|flare-redact|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|gitleaks|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|openredaction|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|trufflehog|reference-only|canonical||differential",
    "... 5 more"
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
    "docker-compose-resolution-authored--required-message--differential|flare-redact|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|gitleaks|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|openredaction|reference-only|canonical||differential",
    "docker-compose-resolution-authored--required-message--differential|trufflehog|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|flare-redact|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|gitleaks|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|openredaction|reference-only|canonical||differential",
    "exa--exa-api-key-your-key-here-placeholder--differential|trufflehog|reference-only|canonical||differential",
    "... 5 more"
   ]
  },
  "corpusControl": {
   "added": [],
   "removed": []
  }
 },
 "semanticDigests": {
  "A": "sha256:3b5c750a1f973760b4f08d748525e280b6a516feb0e013ccfdc8c87ff66e2442",
  "B": "sha256:d4d5fa97ea23ccf715079faff769ace48f8e9dedbe00d9ffb4402911cb00f2cb",
  "C": "sha256:b6b0e83ad24567004eec16e484031a5babacddc7fc5215c89578f29ec69024d5",
  "D": "sha256:95d14ba9b8006fe5a961c65ef0d7844c6b64ece9214500179747944edc61f52b"
 }
}
```

## Unexplained

none: every difference is an added or changed case, or the product change itself.
