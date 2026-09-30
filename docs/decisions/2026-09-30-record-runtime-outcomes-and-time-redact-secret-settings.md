---
decision_id: decision-record-runtime-outcomes-and-time-redact-secret-settings
status: accepted
scope: benchmarks
title: Record per-value outcomes and per-setting timings for the runtime comparison as a v2 plan beside v1
decided_at: 2026-09-30
---

# Record per-value outcomes and per-setting timings for the runtime comparison as a v2 plan beside v1

## Context

#562 and #563 (part of #543). `/comparison/runtime` shows, per question, one row per value in the text with what each
library did to it, the share hidden, and the time. The ledger held only times: `evidence/429` (schemaVersion 2) has 12
samples per tool and workload, on two workloads, for redact-secret at `pii:global` only. It has no per-line outcome, no
third "real-looking values" text, no credential text, and no timing per redact-secret setting (Default, PII, PII plus US).

The existing site reads `qualification/peer-pii-runtime-throughput-v1.json` and `evidence/429/` (the `/report` peer
section, `tests/peer-runtime-section.test.mjs`). Its published output must not change, and `qualification/pii-profile-cost-workloads-v1.json`
is bound by hash into the frozen #286 and #429 plans, so none of these can be edited.

## Decision

1. **A v2 plan beside v1, never over it.** `qualification/runtime-comparison-v2.json` (id `runtime-comparison-v2`,
   validator `benchmarks/evaluation/domains/pii/runtime-comparison.ts`) `extends` v1 by its content commitment and keeps
   its tools, calls, sample protocol (12 samples, 2 warmups, round-robin) and the two v1 workloads, which must render
   byte-identically to v1's. v1's plan, workload file, adapters, measurement script and `evidence/429/` are untouched.
   `validatePeerRuntimeThroughputReport` gained one line: a report whose `reportType` is `runtime-comparison` is validated
   by the v2 validator; every v1 report goes through the code it always did.
2. **What a line records.** Each line of each workload carries the value(s) it holds, each with an expected kind (`email`,
   `payment-card`, `github-token`, ...) and, for PII, the family that has to be switched on for it. A report records, per
   tool and line: `changed`, `valuesHidden` (how many of the line's values no longer appear verbatim in the output) and
   `replacement` (what took their place, values replaced by their index, at most 64 characters). No field can hold a verdict:
   outcomes are recorded, never graded. "Hidden", "Partly hidden" and "Left as is" are read from those three fields by the
   resolver; "Switch off" is only where the setting's own activation identity (in the report) does not list the value's family and the line came back unchanged.
3. **Six workloads.** PII: real-looking values (new, synthetic), validator-heavy and multilingual-context (v1's). Credentials:
   real, fake and context (new). All are the same `repeat-lines-v1` generator at 4,096 lines, so a time is comparable across
   them.
4. **Credential values are generated, never committed.** `scripts/check-fixture-storage.mjs` already says generated credential inputs must not be tracked. A credential value in the plan is a prefix plus
   seeded segments (`{alphabet, length}`), rendered at run time; no whole token is in any file (a test checks it), so
   push protection and history scans stay quiet. Only values with a literal (placeholders, textbook examples, PII) are literal.
5. **Three settings, one process each.** Default (`[]`, no PII), `pii:global`, and `pii:global` plus `pii:us`. The native
   add-on accepts one PII selection per process (a different second `initializePii` throws `PII_ACTIVATION_CONFLICT`), so
   `scripts/measure-runtime-comparison.mjs --setting=` measures one setting, and `scripts/run-runtime-comparison-docker.sh`
   runs the three in separate containers of the #513 image. Each run times all three tools; the two peers do not change with
   the setting, which makes their three sets of times the record of how much the machine moved between runs. The page states
   the largest spread and says a smaller time difference is noise.
6. **Where the runs happen.** The #513 rule holds for `evidence/562/` as for `evidence/429/`: a run writes it only from the
   pinned product commit on a native amd64 host. The repository's Apple Silicon machine is emulated, so the snapshots come from
   the `peer-pii-runtime-throughput` workflow (`workflow_dispatch`, input `measurement=runtime-comparison-v2`), on a
   GitHub-hosted `ubuntu-24.04` runner limited to 4 CPUs, the same environment as `evidence/429`.
7. **Which setting each panel uses.** External PII: redact-secret at `pii:global` (as in `evidence/429`), beside the two
   libraries, all from the `pii-global` run. External credentials: redact-secret at Default (credentials are on in every
   setting; no PII adds nothing to them), beside the libraries from the `default` run. Internal: one column per setting, each from its own run.
8. **All three libraries are timed on credentials.** Whether a library detects credentials is visible in its recorded
   outcomes, so none is excluded by assumption; a library that leaves every credential line as is shows "Left as is" on each.
9. **A panel is "Not measured yet" until a committed, validated report backs it.** The web service validates each report
   with `validatePeerRuntimeThroughputReport`; a missing or invalid one leaves that setting's cells "not measured" with the reason.
   With no v2 report at all the page is what it was (v1 times, outcomes "Not recorded").

## Consequences

- `/comparison/runtime` shows value rows, hidden shares and the legend, and `check:routes` recomputes every displayed
  outcome, share and time from the committed reports and the plan, independently of the resolvers.
- The times differ from `evidence/429` for the same tool and workload (a different run, and the workload set is larger). The v2
  numbers are the ones the new page shows; `/report` keeps showing `evidence/429`.
- A change to the plan, a workload or a summary that makes a report stale fails `tests/runtime-comparison.test.mjs`;
  the fix is a fresh run, not an edit.
- The dense credential workloads (every line carries a secret) time redact-secret on finding and replacing thousands of secrets,
  not on scanning mostly clean text, so they are not comparable with the throughput on `/performance`.
