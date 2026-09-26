# Peer observation snapshot local timing

Recorded 2026-09-26 on macOS arm64 as implementation evidence for #336. This
is a local before/after check, not a substitute for the required GitHub Actions
timing before beta.9 publication.

Both commands used the same checkout, 2,990-fixture generated corpus, scanner
pins, adapter configuration, accounting replay count (2), and product package.
The refresh used checksum-pinned binaries provisioned into a read-only
directory: Gitleaks 8.30.1 archive SHA-256
`b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5` and
TruffleHog 3.97.4 archive SHA-256
`57e2a41c1e196cf96cae49ca2151f5e9207be2f5c41349b5ea49cb5dcfc606b7`.

| Path | Command | Wall time | Peer scanner executions | Product executions |
| --- | --- | ---: | ---: | ---: |
| explicit refresh/full reproduction | `npm run bench -- --strict --refresh-peer-snapshots` | 67.6 s | 150 | 50 |
| ordinary validated snapshot consumption | `npm run bench -- --strict` | 2.21 s | 0 | 50 |

There are 25 suite corpora and three peers, with two stability replays per
scanner: `25 × 3 × 2 = 150` refresh executions. Ordinary consumption loaded 75
validated snapshots and freshly ran only redact-secret twice over each corpus.
The composed reports retained a new run ID while each peer row retained its
older observation time, refresh source run, and snapshot digest.

Before release, repeat the comparison in GitHub Actions on the same commit and
record workflow run IDs and job/step timings here or in a successor evidence
record.

## Linux/amd64 refresh and reuse verification

After the #340 semantic index landed, the complete refresh and ordinary reuse
paths were repeated on 2026-09-26 in an isolated Linux/amd64 Node 22 container.
The refresh provisioned checksum-pinned, read-only Gitleaks 8.30.1 and
TruffleHog 3.97.4 binaries. The ordinary path verified those pins first, then
removed the binary directory from `PATH` before running either evaluation.

| Path | Commands | Wall time | Peer scanner executions | Product executions |
| --- | --- | ---: | ---: | ---: |
| explicit refresh | `npm run peers:snapshots:refresh` | 383 s | 154 | 52 |
| ordinary snapshot reuse | `npm run bench -- --strict` + `npm run eval:classify` | 105 s | 0 | 52 |

The refresh count is 25 comparison corpora × three peers × two replays, plus
two suite-development peers × two replays. The ordinary run loaded all 75
comparison snapshots and both suite-development snapshots, while measuring
redact-secret afresh for the new report/run IDs. Linux/amd64 emulation adds
substantial wall time, so the manual refresh workflow records its native
GitHub Actions step duration and the same execution-count formula in its step
summary for release review.
