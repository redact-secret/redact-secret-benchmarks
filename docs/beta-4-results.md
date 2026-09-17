# Beta.4 published-package comparison

> Historical schema-v2 regression snapshot. These mixed-suite counts must not
> be interpreted as comparative provider-detection performance. The
> [corpus audit](corpus-audit.md) identifies malformed inputs and masking-policy
> differences; current schema-v3 reports separate those purposes.

Measured 2026-09-17 using the published `@redact-secret/core@0.1.0-beta.4`
package on macOS arm64 with Node.js v22.16.0. All scanners completed all nine
suites in strict mode. The **491 fixture files and 326 expected spans were
unchanged** from the beta.3 v2 run; only the pinned redact-secret package and
lockfile changed.

| Suite | beta.3 TP / FP / FN | beta.4 TP / FP / FN |
| --- | ---: | ---: |
| Detection accuracy | 5 / 0 / 0 | 5 / 0 / 0 |
| GitHub token contexts | 4 / 0 / 0 | 4 / 0 / 0 |
| Credential formats | 27 / 0 / 0 | 27 / 0 / 0 |
| Context & boundaries | 23 / 0 / 0 | 23 / 0 / 0 |
| Negative controls | 0 / 0 / 0 | 0 / 0 / 0 |
| SendGrid regressions | 30 / 0 / 0 | 30 / 0 / 0 |
| Reference syntax | 6 / 3 / 0 | 6 / 0 / 0 |
| Beta.3 regressions | 33 / 0 / 0 | 33 / 0 / 0 |
| Detector coverage | 195 / 0 / 3 | 198 / 0 / 0 |
| **Total** | **323 / 3 / 3** | **326 / 0 / 0** |

Beta.4 resolves every failure recorded in `benchmarks/known-gaps.json`:
Windows environment references, SQL bind parameters, and Azure App Service
Key Vault references no longer produce findings, while all three nested quoted
generic assignments now match their authored secret ranges exactly.

Gitleaks 8.30.1 and TruffleHog 3.97.4 were rerun against the same inputs and
their exact-range counts were unchanged. TruffleHog credential verification
remained disabled. These are synthetic, draft, project-maintained regression
and structural-coverage corpora, not a product ranking or a claim about
real-world accuracy.

The detector-coverage corpus remains the 25-family snapshot authored for
beta.3. Beta.4 adds detector families upstream; those require independently
authored fixtures and taxonomy review before they can be included here. This
run therefore verifies beta.4 against the existing corpus without claiming
complete structural coverage of beta.4's expanded registry.

## Reproduce

```sh
npm ci
npm run compare
npm run build
```

The update passed fixture drift validation, 84 unit/redaction tests, five
real-scanner integration tests, all 27 scanner/category executions in strict
mode, and the production build. Generated reports remain gitignored and record
versions, hashes, runtime, and repository revision for local inspection.
