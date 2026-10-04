# Product candidate core-main-1e45cecf against the published control (#698)

Candidate: `@redact-secret/core` built from redact-secret 1e45cecf674344726e59bd35a37f28ba1966a06e (redact-secret/redact-secret#1202, redact-secret/redact-secret#1204), **unpublished**, exploratory/internal. Control: published 0.1.0-beta.13 (official-runs-37220835061). Same engine v0.1.0-alpha.5, evidence snapshot-2026.10.04.3, peers and configuration; only the product build differs.

**Worsened: YES, see the regressed rows.** This is a measurement, not a decision: no ledger row, status or evidence expectation changes.

| Population | Cases | Fixed | Regressed | Changed | Unchanged | Still failing | Peers identical | Repeat runs equal (control / candidate) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| public-evidence-snapshot | 6449 | 4 | 0 | 0 | 6445 | 89 | yes | true / true |
| regression-corpus | 153 | 0 | 0 | 0 | 153 | 0 | yes | true / true |
| policy-corpus | 19 | 0 | 0 | 0 | 19 | 0 | yes | true / true |

## Methods run (floors population)

Assertions of the product: control 47632, candidate 47632; fixed 32, regressed 0, still failing 1352. Review occurrences: control 11525, candidate 11520 (added 8, removed 13). Generated variant cases changed: 24 (fixed 24, regressed 0). Repeat runs equal: true / true.

## public-evidence-snapshot: differing cases

| Case | Direction | Control | Candidate | Control findings | Candidate findings |
| --- | --- | --- | --- | --- | --- |
| `authored-provider-neutral--terraform-apply-sensitive` | fixed | flagged | clear | 780-790 generic-token warn | none |
| `exa--exa-api-key-your-key-here-placeholder` | fixed | flagged | clear | 12-33 generic-token redact | none |
| `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters` | fixed | MISS | EXACT | none | 14-31 connection-string redact |
| `structured-credential-files-authored--documented-template-placeholders` | fixed | flagged | clear | 109-178 generic-token redact | none |

