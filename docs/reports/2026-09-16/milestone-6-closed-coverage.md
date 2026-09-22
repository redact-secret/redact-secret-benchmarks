# Milestone 6: closed-issue coverage

Reviewed 2026-09-16 against main revision
`530cafe9737eb5abc9702945394584aeb701d8c1`. The
[milestone](https://github.com/redact-secret/redact-secret/milestone/6)
targets `v0.1.0-beta.3`; 14 issues were closed at this snapshot. Closure and
checked acceptance items are source evidence, not proof of benchmark outcomes.
The scanner dependency now uses the published `@redact-secret/core@0.1.0-beta.3`
package. See the [release comparison](../beta-3/results.md) for measured outcomes.

The `milestone-6-closed` category adds **92 independently constructed cases**
(59 negatives, 33 positive guards). Reproduce with `npm run compare`; open
`/benchmark/milestone-6-closed`. All findings, including warning-only findings, count
as detections. The category is labeled **Beta.3 regressions** and measures
the published npm package against the original independent expectations.

| Closed issue | Coverage added | Negative / positive fixtures | Remaining validation |
| --- | --- | ---: | --- |
| [#254](https://github.com/redact-secret/redact-secret/issues/254) | Exact AWS documentation literals, bare/env/JSON, one-character mutations | 4 / 2 | Other surfaces (Python, WASM, CLI, streaming) |
| [#255](https://github.com/redact-secret/redact-secret/issues/255) | Tutorial passwords in Postgres/MySQL/MariaDB/Redis/MongoDB; synthetic literal passwords in each | 5 / 5 | Other surfaces (Python, WASM, CLI, streaming) |
| [#256](https://github.com/redact-secret/redact-secret/issues/256) | Fill-in prose and repeated filler in URLs; mixed/embedded-word positives | 7 / 3 | Other surfaces (Python, WASM, CLI, streaming) |
| [#257](https://github.com/redact-secret/redact-secret/issues/257) | Whitespace, digit suffix, compounds; weak-password digits and unrelated words retained | 5 / 5 | Other surfaces (Python, WASM, CLI, streaming) |
| [#262](https://github.com/redact-secret/redact-secret/issues/262) | YAML blocks, prompts, SSH output, CRLF/tabs/blank lines/Korean; same-line values | 6 / 2 | Incremental and cross-surface parity |
| [#263](https://github.com/redact-secret/redact-secret/issues/263) | Quoted/unquoted/JSON/Helm/Go templates; prefix-only and embedded-template literals | 6 / 2 | Other surfaces (Python, WASM, CLI, streaming) |
| [#264](https://github.com/redact-secret/redact-secret/issues/264) | Stars and Unicode bullets in prompts/env/YAML; mixed-character near misses | 4 / 2 | Other surfaces (Python, WASM, CLI, streaming) |
| [#265](https://github.com/redact-secret/redact-secret/issues/265) | Two nested negative examples and all three nested positive shapes | 2 / 3 | **Whole-input only here.** CLI file/stdin and incremental partitions are unverified |
| [#266](https://github.com/redact-secret/redact-secret/issues/266) | Flow maps and sequences; scalar and quoted-brace literals | 3 / 2 | Other surfaces (Python, WASM, CLI, streaming) |
| [#278](https://github.com/redact-secret/redact-secret/issues/278) | Roots, Terraform attributes, calls/subscripts/types; dotted and near-root literals | 8 / 3 | Other surfaces (Python, WASM, CLI, streaming) |
| [#280](https://github.com/redact-secret/redact-secret/issues/280) | All seven reference schemes, GCP/Azure variants; four malformed-scheme positive guards | 9 / 4 | Other surfaces (Python, WASM, CLI, streaming) |
| [#273](https://github.com/redact-secret/redact-secret/issues/273) | Reviewed Linux criteria-selection fix and regression-check description | — | Upstream workflow/host acceptance; not a detection fixture |
| [#274](https://github.com/redact-secret/redact-secret/issues/274) | Reviewed baseline re-pinning and live corpus-hash criteria | — | Upstream baseline artifacts and both host profiles; not claimed by local fixture-drift tests |
| [#275](https://github.com/redact-secret/redact-secret/issues/275) | Reviewed Python synchronous redaction coverage; added analogous npm checks over every local fixture | — | **Python remains unverified.** npm pipeline tests do not prove Python parity |

## Final decisions matter

For #257, the accepted
[placeholder decision](https://github.com/redact-secret/redact-secret/blob/530cafe9737eb5abc9702945394584aeb701d8c1/docs/decisions/2026-09-15-match-placeholder-words-on-token-boundaries.md)
excludes `REDACTED-EXAMPLE`, but intentionally keeps detecting
`REDACTED-EXAMPLE-VALUE`, `password1`, and `SECRET01`. The tests encode that
distinction instead of treating every original issue example as a negative.

For #278 and #280, the source decisions specify narrow code-expression and
reference grammars. Corresponding positive guards ensure that unrelated
dotted literals, similar-but-different roots, and scheme-prefixed literal
values do not silently disappear. Reference pointers contain no secrets;
synthetic positive controls are never provider-issued.

Tutorial-password exclusions (#255–257) reflect this project's chosen policy,
not a universal claim that a weak/default password can never authenticate a
real deployment. Every URL here uses synthetic identities and reserved
example hosts. The scores should not be used as a cross-product ranking.

## Redaction and scanner-output checks

`npm run test:redaction` verifies `scanAndRedact` equals `scan` followed by
`redact` across all registered fixture files (currently 491). It independently constructs default
placeholder output from reported actions/ranges and checks preservation of
surrounding text. Failures name only the fixture ID. These are API-consistency
checks, separate from the measured detector expectations, and do not replace
upstream Python or streaming tests.

Connection-string ground truth marks only the password bytes. TruffleHog's
Postgres `Raw` output is normalized (port added, database removed), so the
adapter recovers a unique original source URI without using expected ranges.
The recovered whole-URI span stays a range mismatch under exact scoring.
This prevents normalization errors from hiding the rest of the cohort while
keeping the difference between detection and exact localization visible.

The beta.3 update reruns these same corpora without changing fixture inputs
or expected ranges. Historical issue-review provenance remains unchanged;
report metadata identifies the package actually measured.
