#!/usr/bin/env bash
# Take develop to production: open the develop -> main PR, watch CI, then land it by
# fast-forwarding main to develop's tip. GitHub marks the PR merged when its commits
# reach main, and no merge commit is created, so main never gets ahead of develop.
# Pushing main publishes benchmarks.redactsecret.dev. Run only when the measurement is ready to be public.
set -euo pipefail
git fetch -q origin main develop
git merge-base --is-ancestor origin/main origin/develop ||
  { echo "main has commits develop lacks; merge main into develop first (git merge origin/main)" >&2; exit 1; }
sha=$(git rev-parse origin/develop)
[ "$sha" != "$(git rev-parse origin/main)" ] || { echo "main already equals develop; nothing to release"; exit 0; }

pr=$(gh pr list --base main --head develop --state open --json number --jq '.[0].number // empty')
[ -n "$pr" ] || pr=$(gh pr create --base main --head develop --title "Go to production: develop ${sha:0:7}" \
  --body "Landed by scripts/go-production.sh as a fast-forward of main to develop, so no merge commit is created." | grep -oE '[0-9]+$')
echo "PR #$pr"

# CI on develop's tip: wait for every run on this commit, then require all to succeed.
sleep 10
for id in $(gh run list --commit "$sha" --json databaseId --jq '.[].databaseId'); do gh run watch "$id" --exit-status >/dev/null || true; done
bad=$(gh run list --commit "$sha" --json workflowName,conclusion --jq '[.[]|select(.conclusion!="success" and .conclusion!="skipped")|"\(.workflowName):\(.conclusion)"]|join(", ")')
[ -z "$bad" ] || { echo "CI on ${sha:0:7} not green ($bad); refusing to go to production" >&2; exit 1; }

git push origin "$sha:refs/heads/main"
git fetch -q origin main
echo "main = develop ${sha:0:7}; ahead/behind (develop...main): $(git rev-list --left-right --count origin/develop...origin/main)"
gh pr view "$pr" --json state --jq '"PR #'"$pr"' " + .state'
run=$(gh run list --branch main --commit "$sha" --workflow publish-site.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty')
[ -z "$run" ] || gh run watch "$run" --exit-status
