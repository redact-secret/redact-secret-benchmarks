# Batch 2 (#739): readiness inventory and disposition ledger for 58 bounded-context families

**State:** inventory only. 30 of 58 rows are READY per credential-evidence's reviewed handoff, 28 are carrier-unresolved. Nothing has been measured and no expectation is frozen: measurement waits for the adopted product contract (redact-secret#1231, an ADR plus four contract docs for #1223 to #1226). No row is a false negative, true negative or passing coverage.

| group | ready | carrier-unresolved | total |
| --- | ---: | ---: | ---: |
| G1 (#740) | 15 | 8 | 23 |
| G2 (#741) | 5 | 8 | 13 |
| G3 (#742) | 4 | 8 | 12 |
| G4 (#743) | 2 | 2 | 4 |
| G5 (#744) | 1 | 2 | 3 |
| G6 (#745) | 3 | 0 | 3 |
| total | 30 | 28 | 58 |

- Source of the status: `docs/handoffs/batch-2-bounded-carriers.md` at credential-evidence `005a7331` (PR #248, issue #235). The ready flag is evidence's, copied verbatim; the script parses the handoff table and infers nothing from claim text. Every contract sha256 prefix still matches the digest the handoff froze; claim IDs match.
- Evidence added no Case or fixture. Contracts remain proposed/draft; Group C format research (#236) may turn unresolved rows ready later.
- Product contract: redact-secret#1223 to #1226 had 0 of 8 gates ticked when observed; PR #1231 adopts the contract and is not merged yet. Until it is, expectations cannot be frozen from a product contract, and they are never taken from current product output.
- Independent baseline: none yet.

Files: `readiness.json` / `readiness.md` (per-row status, slot, public lookalikes, follow-up source, contract digest check) and `ledger.json` (the 58-row ledger, every row not-measured, `complete: false`).

## Reproduce

```bash
git clone https://github.com/redact-secret/credential-evidence.git ev && git -C ev checkout 005a7331cf90403bd4ce4abcb93bd8b085d315a9
node scripts/batch2-readiness.mjs --evidence-dir ev
```

When the evidence handoff changes, update `benchmarks/batch2/sources.json` (`evidence.commit`) and re-run.

## Measurement plan

Baseline: `@redact-secret/core` 0.1.0-beta.13 (npm latest, integrity in `benchmarks/batch2/sources.json`). Candidate: an exact unpublished core commit that contains the Batch 1 fixes and the later core fixes, as published by the core session or pinned from core main at execution, never a floating branch. Surfaces: Node, WASM, Python, Rust CLI, whole and streamed, unavailable ones recorded; peers only with TruffleHog 3.97.4 first on `PATH`. The Batch 1 harness is parameterized, not forked; no official run, repin, support promotion, release or authority change.
