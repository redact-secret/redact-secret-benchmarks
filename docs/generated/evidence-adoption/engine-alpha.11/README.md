# credential-eval v0.1.0-alpha.11 on snapshot-2026.10.05: planner, local diagnostics, refused replay (#725)

Mode: **published** engine (tag `v0.1.0-alpha.11`, revision `eec5d0d3548ddb232a996c11c4e2b1a65a436489`, contract v1.8) with `@openredaction/core` 1.1.5 (integrity unchanged) and `@redact-secret/core` 0.1.0-beta.13 (unchanged). Evidence: the accepted `snapshot-2026.10.05` (manifest `sha256:510836b0…`). Nothing here is accepted, repinned or promoted; `benchmarks/evidence-adoption.json` records the engine as an `engineCandidate` with `ownerAcceptance: null`.

## Dry run (before any execution)

`dry-run.reuse-plan.md` and `dry-run.execution-plan.md`: no verified observation archive exists for the accepted official run (an official run never reuses, and the baseline wrote none), and the baseline observations carry no native labels (adapter version 1), so every scanner is **fresh** on all three populations: 15 scanner x population executions, 3 jobs, 8 engine runs, about 53 runner-minutes known from earlier telemetry. Old label-less observations stay legacy historical evidence: nothing is classified retrospectively.

## Local bounded diagnostics (exploratory, darwin-arm64, never compared with a linux-x64 official run)

Plain run of `openredaction` (default), `openredaction-credentials` and `openredaction-credential-bearing` on the whole public snapshot, `--jobs 2`, limits as in the official config (30 min, raised output cap): wall 217 s, scanner process time 419 s, peak RSS 1.69 GB, 105.6 MB of default-profile output. Findings: **360,782** for the default, the same number as the official alpha.5 baseline; 1,393 and 1,383 for the profiles.

| Default profile, plain, retained findings | Count |
| --- | ---: |
| mapped credential (carry a family) | 1,260 |
| credential-related, unmapped (unresolved types) | 102 |
| out of scope (personal data, resource identifiers) | 359,420 |
| ambiguous | 0 |
| native label unavailable / unrecognized | 0 / 0 |

1,260 + 102 + 359,420 = 360,782; the 359,522 findings without a family in the baseline are the last two rows. Native type NAME alone is 333,419 findings (92.4% of all findings and 92.7% of the unmapped ones), INSTAGRAM_USERNAME 23,904. These come from the engine's labels, unlike the string histogram of the investigation. `baseline-alpha.5.scope-accounting.*` shows the alpha.5 artifact: every disposition Unknown (legacy), 360,782 retained findings.

Profile against default (same engine, same corpus, separate configuration identities, denominators equal): `openredaction-credential-bearing` EXACT -7, PARTIAL -91, MISS +98, benign controls flagged -629, retained findings -359,389; `openredaction-credentials` EXACT -5, COVERED -5, OVERBROAD -4, PARTIAL -91, MISS +105, flagged -629. A profile is a different configuration, not a speed-up and not better accuracy: it loses detected spans and removes personal-data flags. Both results are kept.

Historical full files are preserved for #725 under tag `hygiene-before-cleanup-845-20261008`: [JSON](https://github.com/redact-secret/redact-secret-benchmarks/blob/51d59f1bb27d0c2a129899fadd686e248412be82/docs/generated/evidence-adoption/engine-alpha.11/local-diagnostic.scope-accounting.json) and [Markdown](https://github.com/redact-secret/redact-secret-benchmarks/blob/51d59f1bb27d0c2a129899fadd686e248412be82/docs/generated/evidence-adoption/engine-alpha.11/local-diagnostic.scope-accounting.md). Restore those exact bytes with `git show <tag>:<path>`; a new local diagnostic belongs under ignored `results-output/` and does not replace this historical measurement. See `docs/specs/hygiene-records.md` for the preservation manifest and archive receipt.

## The official replay was refused (run 37379546479)

`replay-pins.patch` (engine pins on a transient branch, never merged) was dispatched once with `official-runs.yml` mode `full`. All three population jobs stopped at their first engine step, no artifact:

```
error: invalid run configuration: scanner openredaction expects adapter openredaction version 1, but version 2 is built in
official run refused: credential-eval run 1 exited 2; no artifact is accepted
```

`v0.1.0-alpha.11` therefore cannot be used for official runs: its `configs/official/*.json` were not moved with the OpenRedaction adapter bump (ADR 0011). Tags are immutable. The fix is credential-eval#59 (merged; configs and a test that every official config binds). A published official replay needs a new tag that contains it; none has been cut, and the dispatch has not been repeated. No runner minutes beyond about 2 per job were spent.
