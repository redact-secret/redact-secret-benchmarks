# Contrast of snapshot-2026.10.05 with the previous snapshots (#680)

Every case, assertion and review occurrence of the newer run is compared by semantic id with the older run (`scripts/contrast-snapshots.ts`, `--strict`). A difference is attributed to the evidence change that explains it; anything else is unexplained, and a worse outcome that no evidence change explains is a regression. **Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기).**

| Comparison | Differences | Explained | Unexplained | Regressions |
| --- | ---: | ---: | ---: | ---: |
| control: published beta.13 on alpha.5: snapshot-2026.10.05 (run 37296823599) vs snapshot-2026.10.04.4 (run 37241828378) | 161 | 161 | 0 | 0 |
| control: published beta.13 on alpha.5: snapshot-2026.10.05 (run 37296823599) vs snapshot-2026.10.04.3 (run 37220835061) | 269 | 269 | 0 | 0 |
| candidate: unpublished core-main-1e45cecf (exploratory, internal): snapshot-2026.10.05 (run 37304036245) vs snapshot-2026.10.04.4 (run 37253769074) | 161 | 161 | 0 | 0 |
| candidate: unpublished core-main-1e45cecf (exploratory, internal): snapshot-2026.10.05 (run 37304036245) vs snapshot-2026.10.04.3 (run 37235723441) | 269 | 269 | 0 | 0 |

The plain-population differences are listed per case below; the methods run adds the generated variants and the assertions of the same cases, all attributed to the same cause (see the data file).

## control: published beta.13 on alpha.5: snapshot-2026.10.05 (run 37296823599) against snapshot-2026.10.04.4 (run 37241828378)

Differences by cause: 161 x expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05). By population and kind: public-evidence-snapshot case 15; public-evidence-snapshot+methods case 90; public-evidence-snapshot+methods assertion 56.

| Scanner | Case | Before | After | Cause |
| --- | --- | --- | --- | --- |
| flare-redact | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/MISS collateral 40 leaked 138 | positive EXACT/EXACT/MISS leaked 138 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| gitleaks | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| openredaction | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/PARTIAL collateral 20 leaked 98 | positive EXACT/EXACT/PARTIAL leaked 98 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| openredaction | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL collateral 64 leaked 2 | positive EXACT collateral 64 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| openredaction | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL collateral 73 leaked 2 | positive EXACT collateral 73 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| redact-secret | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/EXACT collateral 40 | positive EXACT/EXACT/EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| trufflehog | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-minified-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |

## control: published beta.13 on alpha.5: snapshot-2026.10.05 (run 37296823599) against snapshot-2026.10.04.3 (run 37220835061)

Differences by cause: 161 x changed in snapshot-2026.10.04.4/.05 (expected); 108 x changed in snapshot-2026.10.04.4 (content). By population and kind: public-evidence-snapshot case 27; public-evidence-snapshot+methods case 162; public-evidence-snapshot+methods assertion 80.

| Scanner | Case | Before | After | Cause |
| --- | --- | --- | --- | --- |
| flare-redact | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/MISS collateral 40 leaked 138 | positive EXACT/EXACT/MISS leaked 138 | changed in snapshot-2026.10.04.4/.05 (expected) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| flare-redact | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| flare-redact | `twilio-compound-credentials-authored--api-key-sid-alone` | control clear | control flagged | changed in snapshot-2026.10.04.4 (content) |
| flare-redact | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| gitleaks | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | changed in snapshot-2026.10.04.4/.05 (expected) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| gitleaks | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| gitleaks | `twilio-compound-credentials-authored--api-key-sid-alone` | control flagged | control flagged | changed in snapshot-2026.10.04.4 (content) |
| gitleaks | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| openredaction | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/PARTIAL collateral 20 leaked 98 | positive EXACT/EXACT/PARTIAL leaked 98 | changed in snapshot-2026.10.04.4/.05 (expected) |
| openredaction | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL collateral 64 leaked 2 | positive EXACT collateral 64 | changed in snapshot-2026.10.04.4/.05 (expected) |
| openredaction | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL collateral 73 leaked 2 | positive EXACT collateral 73 | changed in snapshot-2026.10.04.4/.05 (expected) |
| openredaction | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| openredaction | `twilio-compound-credentials-authored--api-key-sid-alone` | control clear | control flagged | changed in snapshot-2026.10.04.4 (content) |
| openredaction | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| redact-secret | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/EXACT collateral 40 | positive EXACT/EXACT/EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| redact-secret | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| redact-secret | `twilio-compound-credentials-authored--api-key-sid-alone` | control flagged | control clear | changed in snapshot-2026.10.04.4 (content) |
| redact-secret | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| trufflehog | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | changed in snapshot-2026.10.04.4/.05 (expected) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-minified-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | changed in snapshot-2026.10.04.4/.05 (expected) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | changed in snapshot-2026.10.04.4/.05 (expected) |

## candidate: unpublished core-main-1e45cecf (exploratory, internal): snapshot-2026.10.05 (run 37304036245) against snapshot-2026.10.04.4 (run 37253769074)

Differences by cause: 161 x expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05). By population and kind: public-evidence-snapshot case 15; public-evidence-snapshot+methods case 90; public-evidence-snapshot+methods assertion 56.

| Scanner | Case | Before | After | Cause |
| --- | --- | --- | --- | --- |
| flare-redact | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/MISS collateral 40 leaked 138 | positive EXACT/EXACT/MISS leaked 138 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| gitleaks | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| openredaction | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/PARTIAL collateral 20 leaked 98 | positive EXACT/EXACT/PARTIAL leaked 98 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| openredaction | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL collateral 64 leaked 2 | positive EXACT collateral 64 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| openredaction | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL collateral 73 leaked 2 | positive EXACT collateral 73 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| redact-secret | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/EXACT collateral 40 | positive EXACT/EXACT/EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| trufflehog | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-minified-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | expected spans corrected in credential-evidence #225 / ADR 0021 (changed in snapshot-2026.10.05) |

## candidate: unpublished core-main-1e45cecf (exploratory, internal): snapshot-2026.10.05 (run 37304036245) against snapshot-2026.10.04.3 (run 37235723441)

Differences by cause: 161 x changed in snapshot-2026.10.04.4/.05 (expected); 108 x changed in snapshot-2026.10.04.4 (content). By population and kind: public-evidence-snapshot case 27; public-evidence-snapshot+methods case 162; public-evidence-snapshot+methods assertion 80.

| Scanner | Case | Before | After | Cause |
| --- | --- | --- | --- | --- |
| flare-redact | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/MISS collateral 40 leaked 138 | positive EXACT/EXACT/MISS leaked 138 | changed in snapshot-2026.10.04.4/.05 (expected) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| flare-redact | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| flare-redact | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| flare-redact | `twilio-compound-credentials-authored--api-key-sid-alone` | control clear | control flagged | changed in snapshot-2026.10.04.4 (content) |
| flare-redact | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| gitleaks | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | changed in snapshot-2026.10.04.4/.05 (expected) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| gitleaks | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| gitleaks | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| gitleaks | `twilio-compound-credentials-authored--api-key-sid-alone` | control flagged | control flagged | changed in snapshot-2026.10.04.4 (content) |
| gitleaks | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| openredaction | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/PARTIAL collateral 20 leaked 98 | positive EXACT/EXACT/PARTIAL leaked 98 | changed in snapshot-2026.10.04.4/.05 (expected) |
| openredaction | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL collateral 64 leaked 2 | positive EXACT collateral 64 | changed in snapshot-2026.10.04.4/.05 (expected) |
| openredaction | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL collateral 73 leaked 2 | positive EXACT collateral 73 | changed in snapshot-2026.10.04.4/.05 (expected) |
| openredaction | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| openredaction | `twilio-compound-credentials-authored--api-key-sid-alone` | control clear | control flagged | changed in snapshot-2026.10.04.4 (content) |
| openredaction | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive MISS leaked 32 | positive MISS leaked 32 | changed in snapshot-2026.10.04.4 (content) |
| redact-secret | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive EXACT/EXACT/EXACT collateral 40 | positive EXACT/EXACT/EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-minified-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| redact-secret | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive PARTIAL leaked 2 | positive EXACT | changed in snapshot-2026.10.04.4/.05 (expected) |
| redact-secret | `twilio-compound-credentials-authored--api-key-secret-before-sid` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| redact-secret | `twilio-compound-credentials-authored--api-key-sid-alone` | control flagged | control clear | changed in snapshot-2026.10.04.4 (content) |
| redact-secret | `twilio-compound-credentials-authored--api-key-sid-and-secret-env` | positive EXACT | positive EXACT | changed in snapshot-2026.10.04.4 (content) |
| trufflehog | `structured-credential-files-authored--aws-credentials-file-two-profiles` | positive MISS/MISS/MISS leaked 218 | positive MISS/MISS/MISS leaked 218 | changed in snapshot-2026.10.04.4/.05 (expected) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-minified-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | changed in snapshot-2026.10.04.4/.05 (expected) |
| trufflehog | `structured-credential-files-authored--service-account-key-file-pretty-json` | positive MISS collateral 66 leaked 416 | positive MISS collateral 66 leaked 414 | changed in snapshot-2026.10.04.4/.05 (expected) |

## Reading

- Against `.04.4` only three cases differ, all because credential-evidence corrected their expected spans in PR #225 / ADR 0021: `service-account-key-file` pretty and minified JSON now end at the END footer (PARTIAL to EXACT for flare-redact, gitleaks, openredaction and redact-secret; trufflehog still misses, 2 fewer leaked bytes) and `aws-credentials-file-two-profiles` lists the two key ids as `companion` spans (no collateral bytes for the scanners that redact them). Their generated variants and assertions follow. Everything else is identical.
- Against `.04.3` the same, plus the three Twilio cases that credential-evidence re-authored in `.04.4` (content changed; the SID-alone control is now clear for redact-secret and flagged for flare-redact and openredaction, whose generic detectors read the corrected value).
- The control and the unpublished candidate show the same pattern; the candidate's own effect (4 fixed, 0 regressed) is in the 2x2 (`product-core-main-1e45cecf/snapshot-2026.10.05/two-by-two.md`).
- Zero unexplained differences and zero regressions in all four comparisons.
