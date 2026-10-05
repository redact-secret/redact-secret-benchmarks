---
decision_id: decision-run-a-product-only-exploratory-diagnostic-lane-beside-the-full-official-run
status: accepted
scope: benchmarks
title: Run a product-only exploratory diagnostic lane beside the full official run
decided_at: 2026-10-04
---

# Run a product-only exploratory diagnostic lane beside the full official run

## Context

#705, under #704. A candidate product fix is checked by dispatching `official-runs.yml`, which runs five scanners over three populations twice, plus a methods run whose OpenRedaction scan alone takes about 29 minutes. The product's own regression and policy findings are ready long before that, yet a fix cycle waits for unchanged peers.

## Decision

1. **A `mode` input, `full` by default.** `full` is the existing workflow, unchanged in populations, scanners, methods, two engine runs and the qualification view. `diagnostic` is a second mode of the same workflow and driver, so the pins, the engine build and the evidence checks are the same code.
2. **Diagnostic is an exploratory engine run over the product scanner only.** The engine still verifies the evidence release and every selected scanner's pin; the driver still checks the engine commit and version, the evidence binding and that the product build is the registry's pinned candidate (version and package integrity). A wrong candidate tarball, engine or evidence fails as it does in a full run. The class is `exploratory`, so the engine derives `publication: internal`. It is not made `official`, because an official run needs every scanner pinned and verified.
3. **Regression and policy first, public on request.** The population jobs are independent matrix jobs, one engine run each, no methods, no peers, no OpenRedaction; the public population is a separate job behind `include_public`, so it never delays the other receipts. Each job uploads its artifact (`diagnostic-<population>`) and writes its summary as soon as it ends.
4. **Unavailable, not inferred.** The summary names the scanners and methods that ran and did not. Differential and every peer comparison are stated as unavailable when a peer did not run. Metamorphic and mutation are not run by this lane.
5. **No path to promotion.** A diagnostic artifact fails the official binding (`run_class`), is named outside the `official-run-*` pattern the view job reads, writes `diagnostic-record.json` instead of `run-record.json`, is refused by `official-runs:record`, and is not in the archive's registry-digest set. The view stage is skipped in diagnostic mode, and the workflow refuses a diagnostic dispatch that carries `attribution` or `reuse_run_id`.

## Consequences

A candidate fix gets product findings in the time of one product scan per population. It is a diagnosis, never a qualification: the support status, the ledger and the published pages still come only from a full official run on the pins. The diagnostic engine run uses a configuration restricted to the selected scanners, so its `config_hash` differs from the official one by design and is never compared with it. Spec: `docs/specs/official-runs.md`, "The diagnostic lane".
