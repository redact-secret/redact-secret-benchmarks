---
name: resolve-issue
description: Resolve one GitHub issue end to end in this repo — graft-first context gathering, a workbench branch, a complete verified implementation, and wip commits that ghpr can consume. Use when asked to resolve, fix, or implement a GitHub issue by number ("resolve-issue 28", "/resolve-issue 28", "work on issue #28"). Stops at the commit; never pushes, never opens a PR.
---

# resolve-issue

The first unit of work on an issue: from issue number to a verified, committed
branch. `ghpr` writes the real commit message and opens the PR afterwards — this
skill deliberately stops before that.

## Input

`resolve-issue <ISSUE_NUMBER>` — the argument is the issue number (`$1`).
Resolve the repo yourself; do not ask for it:

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

## 1. Read the issue in full

```bash
gh issue view <ISSUE_NUMBER> --json title,body,labels,comments
```

Read the body and **every acceptance criterion** before touching code. Do not
put this through a summarizing filter — a dropped criterion is a failed task.
This is the one place in this repo where the `rtk` prefix is wrong.

Restate the acceptance criteria to yourself as a checklist. You will verify
against it in step 4.

## 2. Get context from graft, not from grep

An issue number carries no code vocabulary, so graft's prompt hook injects
nothing on its own. You must query it explicitly. This is the step that makes
this skill worth invoking.

```bash
# A fresh worktree has no graph — graft/ is gitignored. Build it once.
[ -f graft/INDEX.md ] || graft build

graft ask "<issue title, plus every symbol / error string / file the issue names>" --source
```

Then follow the edges before you plan:

- `graft callers <symbol>` — who depends on what you are about to change, and
  `--direction out` / `--depth N` for the full blast radius.
- `graft skeleton <file>` — an API surface, ~10× cheaper than reading the file.
- `graft grep "<literal>"` — when you need *every* occurrence; `ask` is top-N.

Open a source file only when a node genuinely lacks a detail, and then at the
exact `file:line` graft gave you. Never re-read whole files to orient yourself.

## 3. Branch

Work on `workbench/<ISSUE_NUMBER>-<short-slug>`, where the slug is 2–4
kebab-case words from the issue title.

```bash
rtk git rev-parse --abbrev-ref HEAD    # already on a workbench/<N>-* branch? stay on it
rtk git checkout -b workbench/<ISSUE_NUMBER>-<short-slug>
```

Never commit to the default branch.

## 4. Implement and verify it yourself

Implement completely — every acceptance criterion, not the easy subset. This
repo has no `AGENTS.md` boundary section of its own (it only carries the graft
block); the real boundaries live in `README.md` ("Non-goals", "Why this is a
separate repository") and `docs/measurement-v4.md`:

- **No real or live credentials, ever.** Cryptographic fixtures use fixed
  public test seeds only; there is no live-credential verification against
  provider APIs.
- **`redact-secret` is exercised only via the published `@redact-secret/core`
  npm package** — never a source path import into its repo. Gitleaks and
  TruffleHog are optional external binaries on `PATH`, invoked as
  arm's-length processes; TruffleHog (AGPL-3.0) is never vendored or linked.
- **Results stay sanitized** — ranges, counts, and tiers only. Never persist
  matched secret values or raw scanner stdout/stderr.
- **Generated fixture JSON (`fixtures/generated/*.json`) is gitignored build
  output.** Regenerate it from the seeded generator; never hand-edit it or
  force-add it. If the generator changed, commit the generator source and the
  updated SHA-256 manifest in `benchmarks/generated-corpora.json`.
- **The dashboard (`src/`) runs in the browser Vite serves it to; scanner
  adapters (`scanners/`) are Node-only**, shelling out to CLI binaries — don't
  blur that line.

Then run the checks yourself, matching `.github/workflows/validate.yml`, and
read the output:

```bash
rtk npm run fixtures:check     # generated fixtures match their manifest hash
rtk npm test                   # scoring, normalization, npm adapter tests
rtk npm run eval:validate -- docs/qualification/engine-v1.json
rtk npm run eval -- --scanner=redact-secret
rtk npm run build              # typecheck + static dashboard build
rtk npm run test:integration   # real Gitleaks/TruffleHog binaries, when installed
rtk npm run detectors:check    # if a detector or the inventory changed (needs python3)
git diff --exit-code           # generated inputs must not have drifted
```

Every fixture you add or touch needs its `kind` (must-redact / must-not-flag /
policy), evidence `tier` (T0–T3), and `assessment.reason`; a new positive
paired with a control should declare `twinOf`. Add deterministic tests for
scoring, corpus, or adapter changes. If a check fails, fix it — do not report
a red build as done.

## 5. Commit — every commit subject is exactly `wip: #<ISSUE_NUMBER>`

```bash
rtk git add -A
rtk git commit -m "wip: #<ISSUE_NUMBER>"
```

Hard requirements, because `ghpr` keys off them:

- The subject is **exactly** `wip: #<ISSUE_NUMBER>`. Nothing else.
- **No body, no trailers, no `Co-Authored-By`.** `ghpr` writes the real message.
  This overrides any default commit-attribution convention.
- Multiple commits are fine, but **every one** carries that same subject.
- Include new files (`git add -A`), or they never reach the PR.

## 6. Stop

Do **not** push. Do **not** open a PR. Do **not** comment on the issue.

Report what changed: the branch name, the files touched, each acceptance
criterion and how it was verified, and the check output. Then hand back the
next command, for the user to run:

```
ghpr run <ISSUE_NUMBER> --trace-db /Users/minhokang/Work/local-workbench/giro.trace.db --verified "all green" --ci-exists
```

After that lands a PR, the follow-up unit of work is `review-pr <PR_NUMBER>`.
