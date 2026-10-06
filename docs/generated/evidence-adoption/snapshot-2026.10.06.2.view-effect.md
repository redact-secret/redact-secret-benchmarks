# View effect of snapshot-2026.10.06.2 if it were accepted (candidate, not accepted)

Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): 598 of the release's 7,041 fixtures are maintainer-only (ADR 0020), 0 independently reviewed. A larger denominator is not an improvement. Nothing here is accepted.

Basis: View A: the accepted runs (snapshot-2026.10.05, alpha.5, run 37296823599) read by the current code and the committed accepted inputs. View C: the candidate control replay (run 37447804171: published beta.13 on alpha.13 without OpenRedaction default), built by the replay's own view job (qualification-view artifact). Same adapter and policy code; the policy revision differs because its axis overlay, twin-scope map and review-ledger re-key are derived from the corpus.

| | Accepted (A) | Candidate (C) |
| --- | ---: | ---: |
| stable | 123 | 116 |
| provisional | 20 | 27 |
| pending | 1 | 1 |
| unsupported | 0 | 0 |
| stable by documented / empirical | 87 / 36 | 83 / 33 |
| families in the support matrix | 144 | 144 |
| families the corpus names but no registry entry maps (unmapped) | 16 | 72 |
| undetected | 21 | 21 |

Policy revision: accepted `rs-policy-1:sha256:20f1b70bde51fc9ac0f866cdf78713f02d1458001cbc35a65fcf942b2874067c`, candidate `rs-policy-1:sha256:37dcfb3f7066a4485f29b22358f7a94fca0b154e4e260b6714e242ac596eb729` (its derived inputs follow the corpus).

## Families whose status or reasons change

| Family | Before | After | Reasons added | Effect |
| --- | --- | --- | --- | --- |
| `anthropic-admin01-key` | stable | provisional | mutation.unresolvedCritical: 2 > 0; twinFailures: 1 > 0 | engine: twin scoping (alpha.13, ADR 0018) records one twin failure and unresolved critical mutation findings on identical findings |
| `anthropic-api01-key` | stable | provisional | mutation.unresolvedCritical: 2 > 0; twinFailures: 1 > 0 | engine: as above |
| `generic-token` | provisional | provisional | twinFailures: 1 > 0 | engine: provisional before and after; one more reason (a twin failure) under alpha.13 |
| `polar-api-credential` | stable | provisional | documented.minimumBenignCases: 6 < 8; documented.minimumTwinPairs: 4 < 5 | corpus: the 11 Polar cases moved to unresolved (outcome pending, outside the denominators), so the documented fixture profile floors (benign controls, twin pairs) are no longer met |
| `polar-token` | stable | provisional | documented.minimumTwinPairs: 4 < 5 | corpus: as above (twin pairs 4 < 5) |
| `vercel-app-access-token` | stable | provisional | mutation.unresolvedCritical: 8 > 0; twinFailures: 4 > 0 | engine: as above (4 twin failures) |
| `vercel-app-refresh-token` | stable | provisional | mutation.unresolvedCritical: 8 > 0; twinFailures: 4 > 0 | engine: as above |
| `vercel-personal-access-token` | stable | provisional | mutation.unresolvedCritical: 8 > 0; twinFailures: 4 > 0 | engine: as above |

Seven families lose `stable` (two by the corpus, five by the engine's twin scoring) and no family gains it. The five engine-effect families change on identical findings: the same twin controls were scored clear by alpha.5 and are scored flagged by alpha.13 (see the contrast). The beta.13 product bytes are the same in both views.

## Scanner roster

OpenRedaction default: not measured in this run (optional). Last measurement: engine 0.1.0-alpha.5 on 2026-10-05 (historicalRuns: public-evidence-snapshot+methods@linux-x64, public-evidence-snapshot@linux-x64). Measured in the candidate: flare-redact, gitleaks, redact-secret, trufflehog. The OpenRedaction credential profile stays not measured in an official run (ADR 2026-10-06).

## Not claimed

The 517 added cases (320 must-not-flag, 197 policy) enter the denominators of the registry families they map to (the 56 new families have no registry entry and stay unmapped); a bigger denominator is not an improvement. Decoded and fragment semantics are the release's facts (55 decoded spans, 18 fragmented spans, all marked verified by the manifest); the measured effect is in `replay.representationEffect` of the change report and only mapped findings the engine verified are read as such. The product build is the published beta.13 in both views. The Square families have no cases in this snapshot (0 positives, 0 benign controls in every population), so the Square placeholder false alarms (product#1236) are not measured by this view.
