---
decision_id: decision-accept-the-linux-engine-replay-of-the-four-pii-populations-as-verification
status: accepted
scope: benchmarks
title: Accept the pinned linux engine's replay of the four PII populations as verification of the committed darwin-built artifacts
decided_at: 2026-10-05
---

# Accept the pinned linux engine's replay of the four PII populations as verification of the committed darwin-built artifacts

## Context

#665 (remainder), #664, #652. The four benchmark populations (`oracle-plan`, `qualification-plan`, `diagnostic-balanced`, `benign-heavy-stress`) were run through the pinned oracle and `pii-eval` `212d500` on a local darwin build, and their schema 1.2 artifacts are committed under
`benchmarks/pii-eval-population-dual-run/`. This repository's rule is that a linux CI run is canonical and a darwin run is a verification only, never compared with it. The consumer pins name the canonical linux engine artifact (`11358475612`, binary `b2902d58…`, run `37340150108`)
of the same commit, but no linux replay had been compared.

## Decision

1. **Replay with the canonical engine, in CI, without the token.** `.github/workflows/pii-population-replay.yml` is dispatch-only. It mints the same read-only App token as the staging transport (contents and actions read, one repository), downloads and verifies only the pinned engine artifact
   (`fetch-pii-eval-public-synthetic.mjs fetch-engine`: run, artifact, archive, member and build-info digests, and the binary against the pin), and runs `scripts/replay-pii-populations.mjs` in a later step that holds no token. The script regenerates the four conversions from the committed plans and the frozen observation,
   replays each twice with the engine (no scanner is launched) and compares the replayed semantic digest, recomputed digest and bytes with the committed artifact, the consumer pin and the migration record. A difference exits 1, names the population and both digests, and is never normalised.
2. **The result is recorded, not re-derived.** Run `37350920750` on develop `91ac467f` (linux-x64, the pinned binary, `canonical: true`) reproduced all four populations: semantic digests equal to the committed artifacts, the pins and the record, the two replays byte-identical, and the replayed bytes equal to the committed files.
   The receipt is committed as `benchmarks/pii-eval-population-dual-run/linux-replay.json`, bound in `benchmarks/pii-eval-migration.json` (`benchmarkPopulationDualRun.linuxReplay`) and checked by `pii:migration:check`.
3. **Classification: equal, no difference to explain.** The darwin-built artifacts are verified by the canonical engine; there is nothing to classify as an intentional contract change, compatibility behaviour or old/new bug. This closes the open item "a linux replay has not been compared here" and nothing else: the runs stay `exploratory`, the 156 not-representable memberships remain, and
   the artifacts are not official and not a support claim.
4. **A darwin or other-platform replay stays a verification.** The script records `canonical: false` unless the binary equals the pin and the platform is linux-x64, and the criterion `linux-engine-replay-equal` of the PII authority file requires `canonical: true`.
5. **The live protected path is re-checked and its blocker recorded precisely.** At 2026-10-05, `private-custodian` `main` is `61f2a43e` (15 commits past the reviewed pin `23f75304`), none touching `custodian-contracts`, `custodian-bridge`, their schemas or golden vectors; its issue C11 (#12) is closed. It still has no real `ApprovedCatalog` over release records and no transport that serves the bridge
   (its `docs/benchmarks-integration.md` section 4, depending on its C10 and C12), no production caller of `prepare_bound` and no signing key authorised for the v2 public-projection domain, and `pii-eval` does not emit `worker-result/1`. `benchmarks/pii-eval-migration.json` records this as `protectedPath` (`state: absent`). Nothing was faked and no protected run, private-ledger read, key or access setting was touched.

## Consequences

- The linux engine is the verified reproducer of the committed artifacts; a repin of the engine commit makes the receipt stale (the migration check compares it with the pins) and the workflow is rerun against the new pins.
- The replay needs the engine artifact (expires `2026-11-04`); after that the pin needs a reviewed repin as for the measurement artifact.
- Protected consumption is unchanged and blocked on the custodian; this decision authorises none.
