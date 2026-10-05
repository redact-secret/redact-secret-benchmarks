# Product candidate core-main-422e43e3 against the published control (#698)

Candidate: `@redact-secret/core` built from redact-secret 422e43e3dc1fb02536d9c617097fd45e78a92759 (redact-secret/redact-secret#1202, redact-secret/redact-secret#1204, redact-secret/redact-secret#1206), **unpublished**, exploratory/internal. Control: published 0.1.0-beta.13 (official-runs-37296823599). Same engine v0.1.0-alpha.5, evidence snapshot-2026.10.05, peers and configuration; only the product build differs.

**Worsened: no.** Fixed is a failing case that now passes; improved is a case that passed before and passes now with fewer unexpected findings or less collateral. This is a measurement, not a decision: no ledger row, status or evidence expectation changes.

| Population | Cases | Fixed | Improved | Regressed | Changed | Unchanged | Still failing | Peers identical | Repeat runs equal (control / candidate) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| public-evidence-snapshot | 6519 | 4 | 2 | 0 | 0 | 6513 | 93 | yes | true / true |
| regression-corpus | 153 | 0 | 0 | 0 | 0 | 153 | 0 | yes | true / true |
| policy-corpus | 19 | 0 | 0 | 0 | 0 | 19 | 0 | yes | true / true |

## Methods run (floors population)

Assertions of the product: control 48210, candidate 48210; fixed 40, regressed 0, still failing 1408. Review occurrences: control 11622, candidate 11613 (added 8, of which 8 on cases the candidate fixed and 0 elsewhere; removed 17). Generated variant cases changed: 31 (fixed 25, regressed 0). Repeat runs equal: true / true.

## public-evidence-snapshot: differing cases

| Case | Direction | Control | Candidate | Control findings | Candidate findings |
| --- | --- | --- | --- | --- | --- |
| `authored-provider-neutral--terraform-apply-sensitive` | fixed | flagged | clear | 780-790 generic-token warn | none |
| `docker-compose-resolution-authored--required-message` | improved | clear | clear | 117-130 generic-token warn | none |
| `exa--exa-api-key-your-key-here-placeholder` | fixed | flagged | clear | 12-33 generic-token redact | none |
| `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters` | fixed | MISS | EXACT | none | 14-31 connection-string redact |
| `jupyter-notebook-files-authored--same-value-in-source-stream-result-json-error-and-traceback` | improved | EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT | EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT/EXACT | 237-277 aws-secret-access-key redact; 377-417 aws-secret-access-key redact; 485-525 aws-secret-access-key redact; 688-728 aws-secret-access-key redact; 835-856 generic-token redact; 1063-1103 aws-secret-access-key redact; 1411-1451 aws-secret-access-key redact; 1510-1550 aws-secret-access-key redact; 1634-1674 aws-secret-access-key redact | 237-277 aws-secret-access-key redact; 377-417 aws-secret-access-key redact; 485-525 aws-secret-access-key redact; 688-728 aws-secret-access-key redact; 1063-1103 aws-secret-access-key redact; 1411-1451 aws-secret-access-key redact; 1510-1550 aws-secret-access-key redact; 1634-1674 aws-secret-access-key redact |
| `structured-credential-files-authored--documented-template-placeholders` | fixed | flagged | clear | 109-178 generic-token redact | none |

