---
name: scan-secrets-in-history
description: Scan this repository's full git history for accidentally committed real credentials with gitleaks, independent of any scanner this repository benchmarks. Use when asked to check for leaked secrets in history, before publishing, or for "scan-secrets-in-history", "/scan-secrets-in-history". Report-only; never prints matched plaintext.
---

# scan-secrets-in-history

Check whether this repository's own commit history ever holds a real
credential, despite this repository's entire purpose being to measure how
well *other* tools catch exactly that. Use an independent scanner — not
`@redact-secret/core` or any other package this repository installs to
benchmark, since reviewing your own blind spots with the thing you're
measuring proves nothing.

## Run

- `gitleaks version` (record it; findings can shift between versions).
- `gitleaks detect --source . --redact --report-format json --report-path <scratchpad>/gitleaks-report.json -v`

`gitleaks detect` walks the full commit history reachable from `HEAD` by
default — do not narrow it with `--log-opts` unless asked to scope to a
range. `--redact` is mandatory: it masks the matched secret in gitleaks' own
output, so the report itself never carries plaintext.

## Triage every hit

This repository's entire purpose produces the opposite of a false alarm here:
`corpora/`, `adversarial/packs/`, `fixtures/`, `qualification/`, `tuning/`,
`baselines/`, and `holdout/manifest.json` intentionally contain thousands of
credential-shaped strings, and gitleaks will flag most of them. That volume
is expected, not a finding. Per `fixtures/README.md`, "every fixture must be
synthetic or explicitly revoked, never an active provider-issued credential."
`holdout/generated/` and the sibling `redact-secret-blind-fixture/` directory
never enter Git at all (`holdout/README.md`) — if gitleaks somehow surfaces a
hit there, that is itself the finding (a holdout-isolation failure), not a
credential to triage normally.

For each gitleaks hit:

1. **Path check.** Under `corpora/`, `adversarial/packs/`, `fixtures/`,
   `qualification/`, `tuning/`, `baselines/`, or a test directory → almost
   certainly an intentional fixture. Confirm the matched value reads as
   synthetic construction (a documented test seed, an obviously patterned or
   never-issued value, a value already described as synthetic in the
   fixture's own metadata or `expectationReview` evidence). If so, disposition
   as `fixture, synthetic` and move on without further scrutiny.
2. **`benchmarks/known-gaps.json`, an issue body, a report under
   `docs/reports/`, or anywhere outside a fixture path.** Escalate. Read the
   surrounding commit (`git show <sha>`, redacting the value in your own
   output) to judge whether the value is plausibly a real, still-usable
   credential — this is exactly the leak class `promote-finding`'s Safety
   rules and the residual-risk table in `docs/specs/threat-model.md` warn
   about ("a live credential can reach `observed` before a human reviews it").
3. **Plausibly real.** Stop. Do not print it anywhere, including this report.
   This repository has no `SECURITY.md` private reporting path — tell the
   user directly, by commit, file, and gitleaks rule ID, that it needs
   private rotation and history remediation (`git filter-repo` / GitHub
   secret-scanning push protection review). This is not something to fix with
   a normal PR: the value stays in history either way until rewritten.

## Output

| Verdict | Commit(s) | Path | gitleaks rule | Disposition |
| --- | --- | --- | --- | --- |

Disposition is one of: `fixture, synthetic` (expected, no action), `needs
private rotation` (escalated per step 3), or `unclear — needs maintainer
judgment`. Then the gitleaks version, total raw hit count, and the count
after triage. Verdict: `no real credentials found in history` or the count
needing rotation.

## Rules

- Never print a matched secret value, in this report or anywhere else — not
  even a partial or "just the prefix" excerpt. Name the commit and rule ID
  instead.
- Do not rewrite history, force-push, or open an issue. This skill reports; a
  human decides on rotation and remediation.
- If gitleaks is not installed, say so and stop — do not substitute a weaker
  regex grep as a silent fallback, and do not substitute `trufflehog` without
  saying so (it is already used elsewhere here as a benchmarked peer scanner,
  which is a fine independent tool for this purpose, but changes what "rule
  ID" means in the output above).
