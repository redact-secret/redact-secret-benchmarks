---
decision_id: decision-choose-the-openredaction-credential-bearing-profile-as-the-comparison-scanner
status: accepted
scope: benchmarks
title: Choose the OpenRedaction credential profile (33 types) as the comparison scanner, name it separately, and measure it officially only after the owner approves one profile-only run
decided_at: 2026-10-06
---

# Choose the OpenRedaction credential profile (33 types) as the comparison scanner, name it separately, and measure it officially only after the owner approves one profile-only run

## Context

The OpenRedaction default profile (all 579 patterns of `@openredaction/core` 1.1.5, personal data included) is slow and noisy for credential evaluation, and the owner made it an optional, manual measurement (#763, [the roster decision](2026-10-06-make-the-openredaction-default-profile-an-optional-manual-measurement.md)). Its recorded official measurement (linux-x64, credential-eval alpha.5, snapshot-2026.10.05) holds 360,782 findings and took 422 s of scanner process time (two replays) in a 224 s run. The default is never re-measured in full again. #764 asks for a separately named, cheap profile to stand in comparisons, with its differences disclosed.

Three credential-eval diagnostic adapters exist, each with its own id, adapter version, options and configuration hash (credential-eval ADR 0013 and ADR 0015): `openredaction-credentials` (the `credentials` category, 32 types), `openredaction-mapped` (the 18 types that have a family) and `openredaction-credential-bearing` (the 33 credential-bearing types: the category plus `URL_WITH_AUTH`).

## Evidence

Local, exploratory, darwin-arm64 (Apple M4), released credential-eval v0.1.0-alpha.12 (d9d83b9d) built into a temporary directory, `@openredaction/core` 1.1.5 from the engine lockfile, plain run, `--jobs 2`, snapshot-2026.10.05 (6,519 cases, corpus digest `sha256:df0dcfc2...`). **This is not comparable with the linux-x64 official runs**: another platform and engine version, one trial, and no performance claim. The reference is the recorded default official measurement (artifact digest `sha256:31ebec73...`, the same evidence bytes; the engine-move report records 0 changed cases for alpha.5 to alpha.12 on this snapshot, see `docs/generated/evidence-adoption/snapshot-2026.10.05.engine-alpha.12.json`). The default was not run again.

| Positive spans, per case compared | default (recorded) | credential-bearing (33) | credentials (32) | mapped (18) |
|---|---|---|---|---|
| EXACT | 758 | 751 (-7) | 753 (-5) | 700 (-58) |
| COVERED | 28 | 28 | 23 (-5) | 28 |
| OVERBROAD | 63 | 63 | 59 (-4) | 63 |
| PARTIAL | 211 | 120 (-91) | 120 (-91) | 110 (-101) |
| MISS | 1,809 | 1,907 (+98) | 1,914 (+105) | 1,968 (+159) |
| Controls flagged (of 3,628) | 1,116 | 123 (-993) | 124 | 76 |
| Findings | 360,782 | 1,393 | 1,383 | 1,264 |
| Scanner process time (2 replays) | 422 s (linux, official) | 4.2 s (darwin, local) | 6.9 s | 5.8 s |

The span deltas of the first two columns reproduce the figures in #764 (EXACT -7, PARTIAL -91, MISS +98; EXACT -5, COVERED -5, OVERBROAD -4, PARTIAL -91, MISS +105). The "benign flagged -629" quoted there does not reproduce in the per-case count of this snapshot (-993 control cases flagged by the default and not by the profile); the figure here is the one counted, and no other is used.

An official-class run of the profile alone (`--run-class official`, the evidence release verified against its manifest digest, the profile scanner pinned) also completes locally on the released alpha.12 from a configuration file held in this repository: 1,393 findings, determinism check agreed, run class official, publication public, `config_hash` `sha256:7c2b208e...`. It is a local verification, never recorded as a run.

**Which cases move, and why.** Of 6,519 cases, 100 positive spans change outcome and 993 controls stop being flagged.

- 89 spans go PARTIAL to MISS. In the default these are accidental overlaps: an out-of-scope pattern matched a fragment of the secret (`INSTAGRAM_USERNAME` on 60 spans, `PHONE_UK` 15, `MINECRAFT_UUID` 3, `XBOX_GAMERTAG` 2, `NAME` 2, and one each of `APEX_PLAYER_ID`, `TRANSACTION_ID`, `EMERGENCY_CONTACT`, `EPIC_GAMES_ID`, `SOUTH_AFRICA_ID`, `TELEGRAM_USER_ID`, `AUSTRALIAN_MEDICARE`). None of these types is in the 33; the credential is not detected under either profile, but the default is credited for part of the span by coincidence. Counted per span this lowers the profile's PARTIAL and raises its MISS; no credential detection by a credential pattern is lost.
- 9 spans go EXACT to MISS: the secret has the shape of an identifier pattern the profile does not run (`INSTAGRAM_USERNAME` 5, `BITCOIN_ADDRESS` 2, `MINECRAFT_UUID` 1, `EPIC_GAMES_ID` 1), on Twilio (3), Travis CI (2), Trigger.dev (2), Exa (1) and a Kafka JAAS password (1). These are coincidental exact matches by non-credential patterns; they are the one real, small loss, and the page says so.
- 2 spans go PARTIAL to EXACT: the default's overlapping personal-data finding (`PHONE_UK`, `SOLANA_ADDRESS`) no longer wins arbitration against the credential pattern.
- 993 controls stop being flagged: the default flags credential-free text with personal-data and identifier patterns (`NAME`, `CARD_AUTH_CODE`, `INSTAGRAM_USERNAME`, `XBOX_GAMERTAG`, `USERNAME`, `PHONE_UK` among the most frequent in a sample of 200 of them). Fewer false flags here is a property of not running those patterns, not of a better detector.
- The profile's findings: 1,261 map to a credential family, 104 are credential-related without a family, 28 are out of scope (scope accounting, credential-eval ADR 0016).

`openredaction-credentials` omits `URL_WITH_AUTH` and so also loses 5 COVERED and 4 OVERBROAD spans. `openredaction-mapped` drops real credential ranges whose types carry no family (EXACT -58).

## Decision

1. **The comparison profile is `openredaction-credential-bearing`** (label "OpenRedaction credential profile (33 types)"). It is the one of the three that loses no credential-pattern detection of the default on this snapshot (the two narrower sets lose real credential spans), it runs in seconds, and its allowlist follows a reviewed rule (the audited credential category plus `URL_WITH_AUTH`, credential-eval ADR 0012 and ADR 0015) rather than anything tuned to this corpus. No narrower or custom allowlist is built: a set shaped by the measurement it is scored on would be the tuning this repository refuses.
2. **Alternatives rejected.** The default alone: 7 minutes of scanner time, 360,782 findings of which most are out of scope, and it stays an optional manual measurement. `openredaction-credentials`: omits a credential-bearing type and loses COVERED and OVERBROAD spans. `openredaction-mapped`: drops credential ranges whose types have no family. A custom allowlist: tuning risk, above. Making the profile required in the roster: it would refuse every official view until a profile measurement exists.
3. **Identity.** The profile has its own scanner id `openredaction-credential-bearing`, adapter `openredaction-credential-bearing` version 1, scanner configuration hash `sha256:cf4b7c9a...` (the engine's hash of the pinned package and the 33-type options), and its own run configuration `benchmarks/support/openredaction-credential-profile.run-config.json` (hash `sha256:7c2b208e...` when the engine ran it on this snapshot). Its result history starts with its own measurement. The default's results are never overwritten, never reused for the profile and never spliced with it: a view carries the default's history labelled with its run, engine, configuration and date, and the profile's separately.
4. **Roster.** `benchmarks/support/scanner-roster.json` gets a separately named optional entry for the profile (`profileOf: openredaction`, its own label, statement, detection text and identity). Optional, not required: the owner's intent is that comparisons use the profile and the default stays manual, but no pinned configuration measures the profile yet, and a required scanner that is absent refuses the view (#763). It becomes required for the official class by a roster change in the same change that records its first official run. The roster is not a policy-revision component, so `policy.revision` and `npm run authority:check` do not move, and no pin, authority, registry or ledger value is touched.
5. **Presentation.** The view's `scannerRoster.profiles` lists every optional scanner, measured or not, with its label, what it detects and its identity; the qualification overview shows the two profiles in a table of their own, says that both are OpenRedaction 1.1.5 under different configurations, and that results differ by configuration. Until an official-class measurement exists, the profile shows "OpenRedaction credential profile (33 types): not measured in an official run (local exploratory diagnostics only: see ADR)" with no number. The default shows "OpenRedaction default (all patterns): not measured in this run (optional)" and its last recorded measurement.
6. **Configuration effect, not better accuracy.** The profile detects less, on purpose. Its fewer controls flagged, fewer findings and shorter run are the effect of not running 546 personal-data and identifier patterns. Its MISS count is higher and its EXACT count lower than the default's on this snapshot. Neither is a claim about OpenRedaction's accuracy, a ranking of the profiles, or a product statement; this repository measures and records.
7. **The official-class measurement is pending the owner** (see below). The local numbers above are exploratory diagnostics, are not written into the official-runs registry, the ledger, the pages or any view, and are not compared with a linux run.

## The pending official measurement

Needs, and nothing else:

- **Owner approval** to run it once. It is not dispatched by this change.
- **No new credential-eval tag.** The released `v0.1.0-alpha.12` runs the profile from the configuration file committed here; the without-OpenRedaction configurations of ADR 0017 are not involved. A tag is needed only if the owner prefers the configuration to ship inside the engine; that is not recommended.
- **A pin that moves**: a new `profileRuns` block in `benchmarks/official-runs.json` naming engine alpha.12 (d9d83b9d), the configuration file and its hash, and the population `public-evidence-snapshot` at snapshot-2026.10.05. The existing `engine` pin (alpha.5), the five-scanner configurations, the recorded runs, the authority, the policy revision and the ledger do not move.
- **Code to land with the run**: a driver mode (`--only-scanner openredaction-credential-bearing --config <file>`), one workflow input for it, and an adapter read of the profile artifact beside the population's plain artifact. The roster check "measured in some populations only" must compare against the populations whose roster entry lists the scanner (the roster already supports a per-population entry). Not written here because it cannot be exercised without the run.
- **Cost**: one `official-runs` dispatch of one population (the public one), plain only, no methods, no peers: about 4 s of scanner time per replay and about 3 runner-minutes in total (checkout, cached engine build, evidence download, two replays, upload), against about 224 s of wall time for the recorded five-scanner run. Linux-x64, canonical.
- **Result**: its own entry in the registry, per-case and per-span deltas against the recorded default measurement published with the comparison conditions, and the roster entry moved to required in that change.

## Consequences

- Comparisons can use a profile that runs in seconds and is labelled for what it is; the default remains available as an explicit manual measurement with its history intact.
- Until the pending run, the profile has no official number anywhere. The honest state is shown: not measured in an official run, with this decision as the pointer.
- The policy revision, the authority, the pins, the registry and the ledger are unchanged by this change.
