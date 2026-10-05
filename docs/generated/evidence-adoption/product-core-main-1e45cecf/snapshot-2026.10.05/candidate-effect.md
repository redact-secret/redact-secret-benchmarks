# Product candidate core-main-1e45cecf against the published control (#698)

Candidate: `@redact-secret/core` built from redact-secret 1e45cecf674344726e59bd35a37f28ba1966a06e (redact-secret/redact-secret#1202, redact-secret/redact-secret#1204), **unpublished**, exploratory/internal. Control: published 0.1.0-beta.13 (official-runs-37296823599). Same engine v0.1.0-alpha.5, evidence snapshot-2026.10.05, peers and configuration; only the product build differs.

**Worsened: no.** This is a measurement, not a decision: no ledger row, status or evidence expectation changes.

| Population | Cases | Fixed | Regressed | Changed | Unchanged | Still failing | Peers identical | Repeat runs equal (control / candidate) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| public-evidence-snapshot | 6519 | 4 | 0 | 0 | 6515 | 93 | yes | true / true |
| regression-corpus | 153 | 0 | 0 | 0 | 153 | 0 | yes | true / true |
| policy-corpus | 19 | 0 | 0 | 0 | 19 | 0 | yes | true / true |

## Methods run (floors population)

Assertions of the product: control 48210, candidate 48210; fixed 32, regressed 0, still failing 1416. Review occurrences: control 11622, candidate 11617 (added 8, of which 8 on cases the candidate fixed and 0 elsewhere; removed 13). Generated variant cases changed: 24 (fixed 24, regressed 0). Repeat runs equal: true / true.

## public-evidence-snapshot: differing cases

| Case | Direction | Control | Candidate | Control findings | Candidate findings |
| --- | --- | --- | --- | --- | --- |
| `authored-provider-neutral--terraform-apply-sensitive` | fixed | flagged | clear | 780-790 generic-token warn | none |
| `exa--exa-api-key-your-key-here-placeholder` | fixed | flagged | clear | 12-33 generic-token redact | none |
| `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters` | fixed | MISS | EXACT | none | 14-31 connection-string redact |
| `structured-credential-files-authored--documented-template-placeholders` | fixed | flagged | clear | 109-178 generic-token redact | none |

