---
name: ci-hardening
description: Audit this repository's GitHub Actions workflows for supply-chain weaknesses with zizmor and OpenSSF Scorecard, then propose exact patches. Use when asked to harden or review CI/CD, before touching publish-site.yml, or for "ci-hardening", "/ci-hardening". Report-only unless asked to apply.
---

# ci-hardening

Find ways this repository's CI or publish automation could be abused. Propose
patches; apply only when asked. Per the [Boundary rule](../../../AGENTS.md),
this reviews this repository's own workflows, not a scanned product's
detection quality.

## Scope

- `.github/workflows/publish-site.yml`, `performance-evaluation.yml`,
  `refresh-peer-snapshots.yml`, `validate.yml`.
- Read `docs/specs/threat-model.md`'s "CI publish pipeline" surface first —
  it names the assets (`BENCHMARKS_DISPATCH_APP_PRIVATE_KEY`, the AWS
  publisher OIDC role) and the accepted/rejected controls already reasoned
  through there. A documented residual risk in that section is not a finding
  here unless your check shows a control beyond what it already describes.

## Run

- `uvx zizmor --format plain .github/workflows/` (or `pipx run zizmor`).
  Record the zizmor version.
- `scorecard --repo=github.com/redact-secret/redact-secret-benchmarks --format json`
  if `GITHUB_AUTH_TOKEN` is available; skip it and say so otherwise — or hand
  this off to the `scorecard-check` skill, which owns the full Scorecard run.
- Read `publish-site.yml` yourself as well. It is the only workflow with real
  publish credentials, and its repo-specific intent (production must refuse
  candidate-provenance dispatch inputs; the GitHub App token is scoped
  read-only to `redact-secret/redact-secret` only; S3 publish order is
  fingerprinted-assets-first, mutable-index-last) is exactly what a generic
  tool misses.

## Checks

| Check | Pass when |
| --- | --- |
| Action pinning | Every `uses:` is pinned to a full commit SHA with a version comment. `publish-site.yml` and `performance-evaluation.yml` already do this; confirm `validate.yml` and `refresh-peer-snapshots.yml` (which currently pin by tag, e.g. `actions/checkout@v4`) either match or are flagged as a finding, not silently treated as fine because they don't touch credentials |
| Token permissions | Top-level `permissions: {}` with per-job grants (`publish-site.yml`, `performance-evaluation.yml` already do this); flag any workflow with a broad default instead |
| `workflow_dispatch` input validation | `product_sha`, `qualification_run_id`, `product_ref` are treated as untrusted (the workflow's own comments say so) and validated before use — `product_sha` must be checked as 40 lower-case hex before it reaches any command |
| Production isolation | The "Refuse a product commit for production" step still runs first and still fails the job (not just warns) when any candidate-provenance input is set for `TARGET == production` |
| GitHub App token scope | `actions/create-github-app-token` is scoped to `owner: redact-secret`, `repositories: redact-secret`, `permission-actions: read`, `permission-contents: read` only — no write permission, no broader repository list |
| AWS credentials | `aws-actions/configure-aws-credentials` uses `role-to-assume` (OIDC, `id-token: write`) with no static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` anywhere in the workflow or its repo/environment secrets |
| Credential persistence | `persist-credentials: false` on the `actions/checkout` of `redact-secret/redact-secret` at the measured commit (a step that only reads, never pushes) |
| Injection | No `${{ github.event.* }}` or other untrusted context interpolated inside a bare `run:` string; always routed through `env:` first |
| Artifact integrity ordering | The qualified-artifact digest check (`qualified-candidate.mjs verify`) runs, and fails the job, before the tarballs it verifies are ever passed to `eval:candidate`/`npm run bench` |
| Publish ordering | S3 sync still uploads fingerprinted `assets/` first with immutable cache-control, then the rest with `no-cache`, then prunes stale assets last — reversing this order can serve HTML referencing not-yet-uploaded assets |
| Concurrency | `cancel-in-progress: false` per environment group is intentional (a burst of pushes collapses to running + latest queued, never a torn mid-sync); flag only a change that would let two publishes to the same environment interleave |

## Output

| Severity | Workflow:line | Finding | Exploit path | Patch |
| --- | --- | --- | --- | --- |

Give each patch as a minimal diff. End with the Scorecard score if you ran
it, and a one-line verdict.

## Rules

- Never print, create, or move secrets. Do not change workflow files or repo
  settings unless asked.
- A finding about `redact-secret/core`'s own build/release process is out of
  scope — that repository has its own `ci-hardening` skill; this one covers
  only this repository's workflows.
