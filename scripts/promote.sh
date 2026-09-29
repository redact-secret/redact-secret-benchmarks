#!/usr/bin/env bash
# Promote develop to main by fast-forward: main takes develop's exact commits, so the
# two branches never diverge and no back-merge is needed. Pushing main publishes
# benchmarks.redactsecret.dev. Run only when the measurement is ready to be public.
set -euo pipefail
git fetch -q origin main develop
git merge-base --is-ancestor origin/main origin/develop ||
  { echo "main has commits develop lacks; merge main into develop first (git merge origin/main)" >&2; exit 1; }
sha=$(git rev-parse origin/develop)
state=$(gh run list --branch develop --workflow publish-site.yml --commit "$sha" --limit 1 --json conclusion --jq '.[0].conclusion // "none"')
[ "$state" = success ] || { echo "publish-site on develop ${sha:0:7} is '$state', not success; refusing to promote" >&2; exit 1; }
git push origin "$sha:refs/heads/main"
git fetch -q origin main
echo "promoted ${sha:0:7}; ahead/behind (develop...main): $(git rev-list --left-right --count origin/develop...origin/main)"
