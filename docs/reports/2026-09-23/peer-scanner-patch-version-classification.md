# Peer scanner patch versions and support classification

Issue: [#180](https://github.com/redact-secret/redact-secret-benchmarks/issues/180)

## Result

On revision `1d13d96`, changing only the TruffleHog executable selected from
`PATH` changed the support distribution from 27 stable families with the suite
pin (3.97.4) to 5 with either 3.97.6 or 3.97.8. All three executables produced
identical differential observations. The entire classification change came
from the peer version being part of the review-ledger id: 394 TruffleHog queue
entries received new ids and therefore lost their existing decisions.

The smallest safe correction is to reject classification and review-queue
coverage runs whose resolved peer versions differ from `suite-v1.json`. Keep
TruffleHog's existing `--no-update` argument, and make automated comparison
runs provision the exact checksum-verified suite pins instead of trusting
runner `PATH`. Do not remove peer versions from ledger identity yet: the three
versions measured here happen to be behaviorally equivalent, but a later patch
can legitimately change a detector.

## Reproduction scope

- Repository revision: `1d13d96` (`main` at the start of the experiment)
- Runtime: Node.js 22.16.0, macOS arm64
- Fixed peers: Gitleaks 8.30.1; published `@redact-secret/core` 0.1.0-beta.6
- Corpus: 4,444 cases and 57 registered detector families, with the
  `engine-v1` development seed
- TruffleHog arguments: `filesystem <input-root> --json --no-verification
  --no-update --results=verified,unknown,unverified`
- TruffleHog 3.97.4 and 3.97.8: official Darwin arm64 release archives;
  archive SHA-256 values
  `57e2a41c1e196cf96cae49ca2151f5e9207be2f5c41349b5ea49cb5dcfc606b7`
  and `b8a3f496ec10f213bd2d2ad276625a773a2b284b5cc84993d24fc27db00d3493`
- TruffleHog 3.97.6: the existing `/opt/homebrew/bin/trufflehog` executable,
  SHA-256
  `318c011cfc68acf0eca3ebc614161e1a06ce95ac6e2f6fda3e318db2921a4948`

The latest release at measurement time was 3.97.8. Raw evaluation output was
kept under `/tmp` and is intentionally not committed; this report contains the
final aggregates needed to reproduce and review the decision.

Each baseline used `npm run eval:classify` with a directory containing exactly
the selected TruffleHog executable prepended to `PATH`. A second run selected
only the `differential` method and the three suite scanners to compare all
1,466 differential cases and their 753 review-queue entries.

## Measurements

### Baseline

| TruffleHog | Stable | Provisional | Pending | Unsupported |
| --- | ---: | ---: | ---: | ---: |
| 3.97.4 (suite pin) | 27 | 28 | 2 | 0 |
| 3.97.6 | 5 | 50 | 2 | 0 |
| 3.97.8 (latest) | 5 | 50 | 2 | 0 |

This differs from the 43-of-93 observation in the issue because the corpus and
classification inventory advanced before the controlled rerun. The failure
mode is unchanged and is larger proportionally on the current 57-family set.

### Ledger identity and behavior

| Measure | 3.97.4 | 3.97.6 | 3.97.8 |
| --- | ---: | ---: | ---: |
| Differential queue entries | 753 | 753 | 753 |
| Exact ids found in the checked-in ledger | 753 | 359 | 359 |
| Entries found after removing only peer `version` from identity | 753 | 753 | 753 |
| Ids changed from 3.97.4 | 0 | 394 | 394 |
| Differential cases with changed TruffleHog observations | 0 | 0 | 0 |

The 394 changed ids are exactly the TruffleHog-dependent entries; the 359
Gitleaks entries remain keyed. After excluding version metadata, no queue entry
was added, removed, or changed between versions. A SHA-256 fingerprint over the
ordered TruffleHog observations for all 1,466 differential cases was identical
for all three versions:

`8c2e144216df78f817f026a524e2dda2d0dd58f035f2e1e20670366b6f141346`

Therefore none of the existing decisions is invalidated by a real behavior
change among the measured releases.

### Candidate changes

The table reports the stable count after applying each candidate to the same
three ambient-version scenarios. `FAIL` means no classification is emitted.

| Candidate | 3.97.4 | 3.97.6 | 3.97.8 | Assessment |
| --- | ---: | ---: | ---: | --- |
| Current behavior | 27 | 5 | 5 | Silent, version-dependent result |
| 1. Remove peer version from ledger id | 27 | 27 | 27 | Fixes this incident, but can reuse a decision after real future detector drift |
| 2. Fail closed on suite-pin mismatch | 27 | FAIL | FAIL | Smallest safe classification rule; actionable instead of silently wrong |
| 3a. `--no-update` alone | 27 | 5 | 5 | Already present; prevents mutation during invocation but does not control `PATH` |
| 3b. Checksum-pinned isolated binary | 27 | 27 | 27 | Reproducible automation; always executes 3.97.4 regardless of ambient `PATH` |
| 4. Behavior fingerprint in ledger id | 27 | 27 | 27 | Correct for these releases, but adds fingerprint definition, migration, and collision/versioning complexity |

Option 4's result uses the measured differential-observation fingerprint in
place of the version string. It is stronger than unconditional version removal,
but unnecessary to stop the current failure: strict pin validation is simpler
and preserves the conservative rule that a changed peer must be reviewed.

## Recommendation and follow-up

Adopt options 2 and 3b together, retaining the already-landed `--no-update`
part of option 3:

1. [#182](https://github.com/redact-secret/redact-secret-benchmarks/issues/182)
   makes `eval:classify` and `queue:check` fail before evaluation when a resolved
   peer version differs from the suite pin.
2. [#183](https://github.com/redact-secret/redact-secret-benchmarks/issues/183)
   provisions checksum-pinned peer artifacts in scanner-comparison CI and
   records their resolved provenance.

Keep peer version in ledger identity. Reconsider a behavior fingerprint only
if frequent, behavior-preserving peer releases make exact pin migrations a
material maintenance cost; any such design must define the complete behavior
surface and a versioned fingerprint format before it can replace the pin.

The rule belongs in an ADR because it governs what constitutes valid benchmark
evidence. The implementation follow-up should also add the operational command
and remediation to the evaluation specification. `AGENTS.md` is reserved for
repository/agent boundaries, and the README is not the authority for evaluation
methodology.
