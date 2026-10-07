# Product candidate core-main-f537059f against the published control (#698)

Candidate: `@redact-secret/core` built from redact-secret f537059f07590be28233eca3e3184d5ec5284e1e (redact-secret/redact-secret#1272, redact-secret/redact-secret#1277), **unpublished**, exploratory/internal. Control: published 0.1.0-beta.14 (official-runs-37665271345). Same engine v0.1.0-alpha.16, evidence snapshot-2026.10.06.4, peers and configuration; only the product build differs.

**Worsened: no.** Fixed is a failing case that now passes; improved is a case that passed before and passes now with fewer unexpected findings or less collateral. This is a measurement, not a decision: no ledger row, status or evidence expectation changes.

| Population | Cases | Fixed | Improved | Regressed | Changed | Unchanged | Still failing | Peers identical | Repeat runs equal (control / candidate) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| public-evidence-snapshot | 7036 | 0 | 0 | 0 | 0 | 7036 | 112 | yes | true / true |
| regression-corpus | 153 | 0 | 0 | 0 | 0 | 153 | 0 | yes | true / true |
| policy-corpus | 19 | 0 | 0 | 0 | 0 | 19 | 0 | yes | true / true |

## Methods run (floors population)

Assertions of the product: control 52346, candidate 52346; fixed 0, regressed 0, still failing 1720. Review occurrences: control 8134, candidate 8134 (added 0, of which 0 on cases the candidate fixed and 0 elsewhere; removed 0). Generated variant cases changed: 0 (fixed 0, regressed 0). Repeat runs equal: true / true.

