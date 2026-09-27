---
name: scorecard-check
description: Run OpenSSF Scorecard against this repository and turn each below-target check into a specific, actionable finding tied to a real file or setting. Use when asked for a supply-chain health score, a Scorecard run, or for "scorecard-check", "/scorecard-check". Report-only.
---

# scorecard-check

Run OpenSSF Scorecard and translate its scores into concrete findings this
repository can act on — not just a number. Per the
[Boundary rule](../../../AGENTS.md), this measures this repository's own
supply-chain hygiene, never a benchmarked scanner's detection quality.

## Run

```sh
scorecard --repo=github.com/redact-secret/redact-secret-benchmarks --format json
```

Needs `GITHUB_AUTH_TOKEN`. If it's unavailable, say so and stop rather than
guessing at scores. Record the Scorecard version and run date — scores drift
as checks are added upstream, so an old cached score is not current evidence.

## Translate each check below its own target score

Don't just repeat Scorecard's own text. For every check scoring below its
target, name the exact file, workflow step, or setting in *this* repository
that's responsible, using what `ci-hardening` and `dependency-audit` already
established rather than re-deriving it:

| Scorecard check | What to cite here when it's low |
| --- | --- |
| `Pinned-Dependencies` | Which workflow(s) still pin by tag — `validate.yml` and `refresh-peer-snapshots.yml` currently use `actions/checkout@v4`-style refs where `publish-site.yml` and `performance-evaluation.yml` use full SHAs; hand this to `ci-hardening` for the patch |
| `Token-Permissions` | Any workflow missing a top-level `permissions:` default-deny |
| `Branch-Protection` | Whether `develop` and `main` both require status checks and block force-push; `gh api repos/redact-secret/redact-secret-benchmarks/branches/<branch>/protection` |
| `Vulnerabilities` | Defer to `dependency-audit`'s findings rather than re-scanning; cite its output |
| `SAST` | Whether a static-analysis check runs in CI at all; if not, that's the gap `sast-sweep` exists to fill manually — note that it isn't wired into CI yet if it isn't |
| `Dangerous-Workflow` | Any `pull_request_target` that checks out PR code, or untrusted `${{ github.event.* }}` interpolated directly into a `run:` shell string |
| `Code-Review` | Whether `main`/`develop` protection actually requires a review, not just a passing check |
| `Signed-Releases` | This repository doesn't ship a package of its own (`"private": true`); state that explicitly rather than treating a low score here as a gap |
| `Maintained` | Commit cadence — informational only, not actionable by this skill |

## Output

| Check | Score | Target repo evidence | Owning skill/fix |
| --- | --- | --- | --- |

Then the overall Scorecard score, the Scorecard version, and a one-line
verdict naming the lowest-scoring actionable check.

## Rules

- Do not change repo settings, branch protection, or workflows. This skill
  reports and routes each finding to `ci-hardening`, `dependency-audit`, or
  `sast-sweep`; it does not duplicate their detailed checklists.
- Never fabricate a score you couldn't run — report `not run: <reason>`
  instead of estimating.
