# Batch 2 (#739): readiness inventory and disposition ledger for 58 bounded-context families

**Result at generation:** 0 of 58 rows are ready to measure. Nothing was measured, so no baseline or candidate observation, no false negative, true negative or passing coverage exists for any Batch 2 family. This is the honest state, not a finding about the product.

| group | ready | carrier-unresolved | blocked | total |
| --- | ---: | ---: | ---: | ---: |
| G1 (#740) | 0 | 8 | 15 | 23 |
| G2 (#741) | 0 | 6 | 7 | 13 |
| G3 (#742) | 0 | 8 | 4 | 12 |
| G4 (#743) | 0 | 2 | 2 | 4 |
| G5 (#744) | 0 | 2 | 1 | 3 |
| G6 (#745) | 0 | 1 | 2 | 3 |
| total | 0 | 27 | 31 | 58 |

Why no row is ready (the gate recorded in #739's comment 6001248816 and credential-evidence#235 comment 6001249222):

- credential-evidence `c34976b7`: every one of the 58 rows has a living contract `@1`, but all are `proposed`/`draft`, `currentContract: null`, authored by an agent run, with no human review event. Most claims establish existence, lifecycle or opacity only. #235 posts no per-row ready status yet.
- `blocked / awaiting-evidence-review` (29 rows): the draft contract mentions a carrier (an Authorization Bearer/Basic/ApiKey header or a named field) but it is unreviewed. `blocked / representation-policy-undecided` (2 rows): `x:app-only-bearer-token` (unspecified format, percent forms are only tool leads) and `mongodb-atlas:database-user-password` (caller-chosen, percent encoding needs a policy limit).
- `carrier-unresolved` (27 rows): no provider-documented carrier/field/config slot is recorded; the missing source is named per row in `readiness.md`. Named by the issues: `elastic:ece-api-key`, `hubspot:personal-access-key` (config field name), `jfrog:myjfrog-api-token`, Atlas programmatic private key (Digest hashes are not the key).
- Product contract: redact-secret#1223 to #1226 are open with 0 of 8 gates ticked; no `docs/audits/evidence/<issue>/` exists, so no intended output could be frozen.
- Independent baseline: none for any Batch 2 row (the Batch 1 corpus covers five other families).
- Classification is mechanical (`scripts/batch2-readiness.mjs`): carrier mentions are pattern hits on claim text, not reviewed layouts. Reviewing them is evidence's job.

Files: `readiness.json` / `readiness.md` (per-row status, reason, claim IDs, open questions, public siblings, authored case records) and `ledger.json` (the 58-family disposition ledger, every row `not-measured`, `complete: false`).

## Reproduce

```bash
git clone https://github.com/redact-secret/credential-evidence.git ev && git -C ev checkout c34976b707b42eb41cbbad2e17deed5c94be1e07
node scripts/batch2-readiness.mjs --evidence-dir ev
```

When #235 progresses: check out the new evidence commit, update `benchmarks/batch2/sources.json` (`evidence.commit` and the observed issue state), re-run, and the rows whose contract is reviewed move to `ready`. Only then author the corpus (`benchmarks/batch2/`, separate from the pinned Batch 1 corpus), freeze expectations, and measure with the Batch 1 harness parameterized rather than forked.

## Measurement plan once rows are ready

Baseline: `@redact-secret/core` 0.1.0-beta.13 (npm latest at generation, integrity in `benchmarks/batch2/sources.json`). Candidate: a separately pinned unpublished commit that contains the Batch 1 fixes (#1215) and the later core fixes (core main was `3b1a5aa9` when observed); pin the exact commit when measuring, never a floating branch. Surfaces: Node, WASM, Python, Rust CLI, whole and streamed; peers only with TruffleHog 3.97.4 first on `PATH`. No official run, repin, support promotion, release or authority change.
