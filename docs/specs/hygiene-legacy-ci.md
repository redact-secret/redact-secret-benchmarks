# Legacy retention and validation reuse (#851, #852, #853)

This reconciliation uses the #846 inventory and the existing retirement
decisions. It removes no evaluator, oracle, rollback path or measurement lane.
The cleanup epic does not authorise a new authority or owner decision.

## Credential evaluator (#851)

The credential oracle exit is recorded. [#660](https://github.com/redact-secret/redact-secret-benchmarks/issues/660)
completed its caller-free retirement sweep on 2026-10-07; it is not superseded by
this epic. `npm run legacy-inventory:check` recomputes the 94 retained inventory
rows in [qualification cutover](qualification-cutover.md#file-level-inventory-and-cleanup-order-653).
Before proposing removal, run `node scripts/legacy-callers.mjs <file>` again.

The credential runner, contract, cases, methods, operators, classification,
reporting and baseline paths still have supported rollback callers through
`publish-site.yml`, `legacy-oracle.yml` and Next legacy services. The recorded
oracle exit is not approval to remove that rollback. Protected-holdout policy,
the frozen `benchmarks/support/legacy-review-queue.json`, product thresholds,
ledger, performance, MCP and calibration consumers remain owned inputs.

## PII evaluator (#851)

PII has its own authority and exit. Its public/synthetic measurement switched
on 2026-10-07, but its bounded TypeScript oracle remains. Retirement requires
one further release or candidate measured through both pipelines, a regenerated
dual-run report with zero unexplained differences, another rollback rehearsal
against it, and a reviewed removal PR listing and repointing every caller.
The owner decides the exit; the **2027-01-02** review date removes nothing.
See [PII authority](pii-authority.md#the-oracle-period-and-who-decides).

The checked PII inventory has 67 files: 31 generic engine files, 7 oracle tests,
15 files requiring a reviewed policy/calculation split, 4 benchmark scorers,
and 10 retained product-policy files. All removal candidates remain gated.
Run `npm run pii:legacy-inventory:check` before any removal proposal; scorer
basis acceptance alone does not remove the oracle-period requirement. Protected
execution and private audit remain pending, independent of public measurement.

## Vite site (#852)

Next is already the root of staging and production publication. Neither
`publish-site.yml` nor routine source validation builds the root Vite UI.
`scripts/assemble-site.mjs` assembles the Next export and public results;
`benchmarks/legacy-url-redirects.json` and the Next fixture lookup preserve old
URLs. This change alters no routes, redirects, metric denominators or export.

Only the shared design tokens are imported directly from `src/` by Next:
`tokens.css` and `tokens.json`. The remaining source still serves inventoried
oracle and test consumers under [#543](https://github.com/redact-secret/redact-secret-benchmarks/issues/543).
Root `start`, `dev`, `build` and `preview` remain local oracle commands;
`web/` owns the published app commands. Vite also serves the browser bundle
measurement tooling, so retiring the old site would not alone permit removing
the root Vite dependency. Source deletion and browser/screenshot parity are
deferred until those retirement callers and prerequisites are resolved.

## Same-run report reuse (#853)

`validate.yml` already generates the report inputs in `legacy-results`. The
two `legacy-oracle / web-legacy` jobs previously repeated benchmark, discovery
and publication before independently building and recounting the rollback
export. They now optionally download the same run's `legacy-results` artifact.
The download action has no external run ID or repository override. A missing
artifact fails the job rather than silently generating replacement evidence.

The caller waits for the producer and selects reuse only after its success.
A legacy-only plan whose web producer is explicitly skipped still runs the
oracle with local generation. A failed or cancelled selected producer prevents
reuse and fails the existing `validate` aggregate. Standalone oracle dispatch
defaults to local generation. Engine, scanner comparison, matrix/roadmap
consumption, route recounts, layout and e2e checks keep their names and commands.

### Measured baseline and verification

Two successful integration runs recorded this duplicate generation before the
change, including root installation and fixture preparation:

| Run | Layout generation | E2E generation | Duplicate total |
| --- | ---: | ---: | ---: |
| [37836513491](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37836513491) | 49s | 69s | 118s |
| [37822251101](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37822251101) | 58s | 68s | 126s |

These are measured baseline costs, not achieved savings or controlled cold/warm
measurements. Dependency installation and fixture preparation still run in
each browser job, artifact transfer adds cost, and waiting for the producer can
increase elapsed latency. After CI, compare runner duration and the download,
install, build and browser step durations against these runs. Cache warmth is
not established by job duration alone; report it only from explicit cache-hit
receipts. Do not report a dollar saving without runner/billing evidence.

Weekly full validation and manual official, population replay, peer refresh,
profile-cost and profile-cost-v2 workflows remain. These lanes have distinct
measurement and provenance contracts; dispatch-only lanes incur no recurring
cost while idle. Root script aliases remain because a historical name or lack
of a routine CI caller does not prove their measurement tooling obsolete.

The repository hygiene guard runs in `validate-sources`, so its failures feed
the existing required `validate` status instead of adding a workflow or check.
