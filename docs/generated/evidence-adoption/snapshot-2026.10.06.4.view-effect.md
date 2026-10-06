# View effect of snapshot-2026.10.06.4 if it were accepted (candidate, not accepted)

Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): 598 of the release's 7,041 fixtures are maintainer-only (ADR 0020), 0 independently reviewed. A larger denominator is not an improvement. Nothing here is accepted.

Basis: View A: the accepted runs (snapshot-2026.10.05, alpha.5, run 37296823599) read by the current code and the committed accepted inputs. View C: the candidate control replay (run 37469753365: published beta.13 on alpha.15 without OpenRedaction default), built by the replay's own view job (qualification-view artifact). Same adapter and policy code; the policy revision differs because its axis overlay, twin-scope map and review-ledger re-key are derived from the corpus.

|  | Accepted (A) | Candidate (C) |
| --- | ---: | ---: |
| stable | 123 | 116 |
| provisional | 20 | 27 |
| pending | 1 | 1 |
| unsupported | 0 | 0 |
| stable by documented / empirical | 87 / 36 | 83 / 33 |
| families in the support matrix | 144 | 144 |
| families the corpus names but no registry entry maps (unmapped) | 16 | 72 |
| undetected | 21 | 21 |

Policy revision: accepted `rs-policy-1:sha256:20f1b70bde51fc9ac0f866cdf78713f02d1458001cbc35a65fcf942b2874067c`, candidate `rs-policy-1:sha256:6ecac2a89458f07cbbad698217a57f4789bb0af1ead07f8e65e6128fadecc606` (its derived inputs follow the corpus).

## Families whose status or reasons change

| Family | Before | After | Reasons added | Reasons removed | Effect |
| --- | --- | --- | --- | --- | --- |
| `anthropic-admin01-key` | stable | provisional | mutation.unresolvedCritical: 2 > 0 | none | engine: alpha.15 removes the twin failure of draft 01 (the `api03-prefix` twin is no longer scored flagged: no engine-attributed difference remains on it); corpus: the twin carries `sibling_family` in the snapshot, so the 2 mutation assertions that flip to it read as an unresolved critical mutation finding until reviewed (the contrast attributes them to the corpus change) |
| `anthropic-api01-key` | stable | provisional | mutation.unresolvedCritical: 2 > 0 | none | engine and corpus: as above (draft 01, alpha.15 removes the twin failure; the corpus twin change leaves 2 unresolved critical mutation findings) |
| `polar-api-credential` | stable | provisional | documented.minimumBenignCases: 6 < 8; documented.minimumTwinPairs: 4 < 5 | none | corpus: the 11 Polar cases moved to unresolved (outcome pending, outside the denominators), so the documented fixture profile floors are no longer met |
| `polar-token` | stable | provisional | documented.minimumTwinPairs: 4 < 5 | none | corpus: as above (twin pairs 4 < 5) |
| `vercel-app-access-token` | stable | provisional | empirical.minimumTwinPairs: 5 < 8; fixtureProfile stable-empirical: 37 total fixtures < 40 (3 short); fixtureProfile stable-empirical: 5 twin pairs < 8 (3 short); mutation.unresolvedCritical: 2 > 0; twinFailures: 1 > 0 | none | corpus: three Vercel twins per family (`body-57`, `hyphen-in-body`, `underscore-in-body`) move from tool-corroborated to unresolved and leave the denominators, so the empirical profile floor (40 fixtures, 8 twin pairs) is no longer met and their mutation assertions read as unresolved critical findings; engine: one twin failure remains (`body-55`) under the product's documented security-first fallback (core #1036; expectation strength: credential-evidence draft 02), 12 engine-attributed differences against 48 under alpha.13 |
| `vercel-app-refresh-token` | stable | provisional | empirical.minimumTwinPairs: 5 < 8; fixtureProfile stable-empirical: 37 total fixtures < 40 (3 short); fixtureProfile stable-empirical: 5 twin pairs < 8 (3 short); mutation.unresolvedCritical: 2 > 0; twinFailures: 1 > 0 | none | as above (Vercel: corpus moves out of the denominators, one fallback twin failure) |
| `vercel-personal-access-token` | stable | provisional | empirical.minimumTwinPairs: 5 < 8; fixtureProfile stable-empirical: 37 total fixtures < 40 (3 short); fixtureProfile stable-empirical: 5 twin pairs < 8 (3 short); mutation.unresolvedCritical: 2 > 0; twinFailures: 1 > 0 | none | as above (Vercel: corpus moves out of the denominators, one fallback twin failure) |
| `bearer-token` | provisional | provisional | policy.positive-axes: 2 (requires 4) | policy.positive-axes: 1 (requires 4); policy.public-conformance: not-run (requires pass) | reason delta read from the two views; its cause is not isolated here (no isolating replay), see the contrast |
| `connection-string` | provisional | provisional | policy.positive-axes: 2 (requires 4) | policy.positive-axes: 1 (requires 4); policy.public-conformance: not-run (requires pass) | reason delta read from the two views; its cause is not isolated here (no isolating replay), see the contrast |
| `generic-token` | provisional | provisional | policy.positive-axes: 2 (requires 4); twinFailures: 1 > 0 | policy.positive-axes: 1 (requires 4); policy.public-conformance: not-run (requires pass) | reason delta read from the two views; its cause is not isolated here (no isolating replay), see the contrast (generic-token also gains one twin failure) |
| `otpauth-uri` | provisional | provisional | policy.benign-axes: 3 (requires 4); policy.positive-axes: 3 (requires 4) | policy.benign-axes: 1 (requires 4); policy.positive-axes: 1 (requires 4); policy.public-conformance: not-run (requires pass) | reason delta read from the two views; its cause is not isolated here (no isolating replay), see the contrast |

7 families lose `stable` and 0 gain it.

## Scanner roster

openredaction: not measured in this run (optional) openredaction-credential-bearing: not measured in this run (optional) Measured in the candidate: flare-redact, gitleaks, redact-secret, trufflehog.

