# SendGrid misses: investigation, 2026-09-16

The original `sendgrid-1`, `sendgrid-2`, and `sendgrid-3` fixtures are three
samples of one missing provider format. Runtime checks of the pinned,
published `@redact-secret/core@0.1.0-beta.1` package reproduced no findings
for the complete synthetic token when bare or assigned to `SENDGRID_TOKEN`.
Changing only the field to `api_key` produced an exact-range, high-confidence
`contextual_secret` finding with `redact` action for each sample.

| Context | Expected byte range | Actual beta.1 behavior |
| --- | --- | --- |
| `SENDGRID_TOKEN=` + token | `[15, 84)` | No finding |
| Bare token | `[0, 69)` | No finding |
| `api_key=` + token | `[8, 77)` | Exact contextual finding |

The values come from the deterministic public seeds in `build.mjs`; no
provider-issued credential or live verification is involved.

## Existing work and resolution

Reviewed all 15 open/closed items in
[milestone 6](https://github.com/redact-secret/redact-secret/milestone/6)
(`v0.1.0-beta.3`) and searched repository-wide issues and PRs for SendGrid
and `SG.`. No existing SendGrid fix or tracking issue was found at review
time. Filed [#285](https://github.com/redact-secret/redact-secret/issues/285)
in that milestone with a standalone public-package reproducer and acceptance
criteria. It is labeled as a coverage enhancement, not three unrelated bugs.

Static inspection of main commit
`a464d75d20ea7536913359eb56edde0c57785289` found no SendGrid registration in
[the detector registry](https://github.com/redact-secret/redact-secret/blob/a464d75d20ea7536913359eb56edde0c57785289/crates/secret-scan-core/src/detectors/mod.rs)
or
[additional provider definitions](https://github.com/redact-secret/redact-secret/blob/a464d75d20ea7536913359eb56edde0c57785289/crates/secret-scan-core/src/detectors/additional_providers.rs).
The generic detector uses a specific credential-name list and does not
recognize arbitrary `*_TOKEN` names. The likely solution is a narrow SendGrid
provider detector with segmented URL-safe syntax, exact ranges, and negative
conformance tests. Broadening arbitrary variable-name detection would change
false-positive behavior beyond this format.

Main was inspected, not built or runtime-tested. The npm registry still
reported beta.1 as the current package when checked. No benchmark dependency
was replaced with internal source code, and no claim is made that the
benchmark evaluates unpublished beta.3 fixes.

## Follow-up benchmark

Run `npm run compare`, then open `#/sendgrid-regressions` and
`#/reference-syntax`. The first adds 30 complete-token cases and eight
near misses; the second adds 20 negative code/reference examples and six
literal-secret controls linked to existing milestone issues. Related issue
links and scope are embedded in the generated reports and shown in the UI.

Compare exact ranges, not just whether a scanner returned something. For
example, a range that includes Markdown backticks or drops the final token
character receives one FP and one FN under the documented protocol. These
synthetic shape tests do not establish provider validity or overall scanner
quality. Do not aggregate the two new categories into a product ranking.

## Published beta.3 follow-up

The benchmark now pins published `@redact-secret/core@0.1.0-beta.3`.
All 30 SendGrid regression positives match exactly and all eight negatives
remain clean. The three original format fixtures also match exactly.
The earlier beta.1 investigation above is retained as historical evidence.
See the [release comparison](../beta-3/results.md) for the complete results.
