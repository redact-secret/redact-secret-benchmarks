---
name: owasp-review
description: Review this repository's own code (not scanner detection quality) against OWASP guidance (ASVS 5.0, Top 10, relevant Cheat Sheets) and report which requirements it meets, misses, or cannot be judged. Use when asked for an OWASP review or compliance check ("owasp-review", "/owasp-review scanners/candidate.mjs", "does the publish pipeline meet OWASP?"). Read-only; changes nothing.
---

# owasp-review

Review this repository's *own* code — the eval scripts, CI pipeline, ledger,
and intake surfaces — against OWASP guidance. Report findings only; do not
edit files. Per the [Boundary rule](../../../AGENTS.md), this skill never
asserts anything about a scanned product's detection quality; that is a
promotion signal, not a review finding.

## Scope

- Target: the path given as an argument, or else the current diff
  (`git diff develop...HEAD`), or else `scripts/`, `scanners/`, and
  `.github/workflows/`.
- Read `docs/specs/threat-model.md` first. Judge each control only within the
  trust boundary its surface describes; a documented residual risk there is
  not a finding here.

## Checklist

Map the code to the OWASP areas that apply. Skip areas that do not.

| Area | Source | Check |
| --- | --- | --- |
| Access control | ASVS V8, Authorization Cheat Sheet | CI job permissions default-deny (`permissions: {}` plus per-job grants); AWS/GitHub credentials scoped to the minimum needed step; production never accepts candidate-provenance dispatch inputs |
| Sensitive data | ASVS V14, Cryptographic Storage | No matched plaintext in errors, logs, `known-gaps.json`, issues, or published `public/results/*.json`; holdout/blind bytes never tracked by Git; bounded retention of temp install dirs |
| Cryptography and integrity | ASVS V11, V14 | Candidate tarball bytes verified against a qualified digest before execution; peer scanner binaries checksum/version pinned; third-party GitHub Actions pinned by SHA, not tag |
| Input validation | ASVS V1/V2 | `workflow_dispatch` inputs (`product_sha`, `qualification_run_id`, `product_ref`) validated before use (40-hex, allowed ref); fixture `path` values can't escape their root; JSON schema validation on ledger and intake records |
| Errors and logging | ASVS V16, Logging Cheat Sheet | Fixed error codes, not raw scanner output, in CI failure messages and `known-gaps.json`; no credential-shaped value ever logged even on failure paths |
| Business logic and concurrency | ASVS V2 | `known-gaps.json` lifecycle transitions are forward-only and schema-enforced; a spent blind-evaluation candidate identity cannot be reused within an epoch; frozen adversarial first-runs cannot silently change |
| Untrusted external input (candidate code, adversarial packs) | OWASP Top 10 A03, A08 (Software and Data Integrity Failures) | Candidate product code is treated as executing with full ambient access, not sandboxed trust; adversarial-pack liveness claims are attested, not validator-proven, and reviewed accordingly |
| Supply chain | NPM Security Cheat Sheet, ASVS V15 | `npm install --ignore-scripts` for candidate installs; pinned peer scanner versions; SHA-pinned CI actions; no step that both installs untrusted deps and holds publish credentials in the same context |

## Output

One table, most severe first:

| Status | Severity | OWASP ref | file:line | Evidence | Fix |
| --- | --- | --- | --- | --- | --- |

- Status: `pass`, `fail`, or `n/a` (with the reason).
- Every `fail` needs a concrete scenario: input → wrong outcome.
- End with a one-line verdict and the requirements that could not be judged
  without runtime testing. Hand those to `vulnerability-test`.

## Rules

- Use synthetic values only. Never paste real secrets, real detection
  findings, or holdout/blind fixture bytes into a finding.
- Cite the specific requirement (for example `ASVS 5.0 V8.2.1`) when you can.
  Otherwise name the Cheat Sheet.
- Do not claim compliance or certification, and never characterize a finding
  as a statement about scanner detection quality — that belongs in the
  `known-gaps.json` promotion lifecycle, not this review. Say "meets the
  reviewed requirements".
