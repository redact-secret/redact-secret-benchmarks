---
decision_id: decision-publish-the-next-export-under-next-with-the-qualification-view-built-from-archived-official-runs
status: accepted
scope: benchmarks
title: Publish the Next export under /next/ beside the existing site, with the qualification view built from archived official runs
decided_at: 2026-10-02
---

# Publish the Next export under /next/ beside the existing site, with the qualification view built from archived official runs

## Context

#602. The Next app (`web/`, a static export with `basePath` `/next`) has so far only been built by `validate.yml`; its decision
([build the new site as a Next static export](2026-09-30-build-the-new-site-as-a-next-static-export-with-mui.md), point 7) left publishing a
preview at `/next` as a later, separate change to `publish-site.yml`. The user has now decided the app may be deployed alongside the existing
site. Deployment is not the authority switch: the existing pages and pipeline stay untouched and stay the oracle, and
`benchmarks/qualification-authority.json` is not introduced ([cutover record](../specs/qualification-cutover.md)).

The Next qualification pages read `public/results/qualification-v1.json` (gitignored), which `npm run qualification:view` derives from the
canonical official RunArtifacts. Without it they build in the "view not built" state, which is the right state for CI and the wrong one to
publish. A publish needs the view, so it needs the artifacts.

## Facts checked

- The registry's four canonical linux-x64 entries (the three plain runs and the methods run) are the artifacts of one CI run of
  `official-runs.yml`, 36964984990 (#641/#642): the SHA-256 of each downloaded `artifact.json` equals the `artifact.byteDigest` the registry records. The earlier runs 36933982377 and
  36948851341 have other byte digests (timestamps) and, for the regression population, another corpus; they are not the recorded bytes.
- Those build artifacts have `expires_at` 2026-12-30 (90-day retention): 89 days from today. After that date a publish that downloads them would fail on every push to `develop`.
- The artifacts are 9.5 MB as a gzip tarball (the methods artifact is 242 MB of JSON, the public one 30 MB). The view is 8 MB and builds in
  8 seconds with a 5 GB heap.
- The view rebuilt locally from those four files, with the product populations' case metadata exported from the checkout, is **byte-identical** to
  the view CI built (run 36964984990), and the exported case metadata is byte-identical to the one the CI run used as input. So case metadata
  need not be archived: it is a deterministic function of the checkout, whose corpora `official-runs:check --bindings` pins.

## Decision

1. **The publish build builds the view; it does not commit it and does not re-run the engine.** The view is derived and large, and a committed copy
   would be a second source of truth that goes stale with every product-input change (the web service already marks a view built from other pins `stale`).
   Re-running the engine needs the engine token and 40 minutes; the artifacts already exist and are pinned.
2. **The durable store is a release asset of this repository** (`benchmarks/official-run-archive.json`: tag `official-runs-<ci run id>`, asset
   `official-run-artifacts.tar.gz`), not the 90-day build artifacts. `node scripts/official-run-archive.mjs pack --run <id> --out <dir>` downloads the CI
   build artifacts, checks them against the registry and writes the tarball, and prints the one `gh release create` command that keeps it; a maintainer runs it once per recorded run.
   A release asset does not expire, needs only `contents: read` to download in a public repository, and adds no secret.
3. **The registry, not the archive, is the authority.** `fetch` (run first in `publish-site.yml`, before anything slow) accepts the tarball only if its members are exactly
   the canonical linux-x64 runs' files (no extra, no missing, no link) and every file's SHA-256 equals the `byteDigest` in `benchmarks/official-runs.json`,
   which a reviewed commit changes. Anything else exits 1 and extracts nothing the build could read. A replaced release asset cannot pass.
4. **A publish fails rather than ships a not-ready qualification page.** `WEB_REQUIRE_QUALIFICATION=1` (set only in `publish-site.yml`) makes
   `check-export-qualification.mjs` fail when the overview is not `ready`; without the flag the "view not built" state still builds, and still checks that it says so,
   on every other CI run. A failure happens before AWS credentials are configured, so nothing is synced.
5. **Only `/next/` is added.** The export is moved wholesale to `dist/next` (the step refuses if `dist/next` exists), so the existing sync, which deletes what the
   build no longer has, keeps `/next/` because it is part of `dist`, and no existing key is overwritten. Next's fingerprinted `_next/static` chunks get the same
   three-pass treatment as `assets/` (immutable, kept until the new HTML is live, pruned last); everything else under `/next/` is `no-cache`. The same workflow
   publishes staging and production; production is reached only by `npm run go-production`.
6. **Least privilege is unchanged.** Job permissions stay `contents: read` and `id-token: write`; no new secret, variable or action. The release download uses `github.token`.
   `web/` installs with `--ignore-scripts`. Both environments run `check:routes` on the export built from the files that run measured.

## Not verifiable from this repository, and the one blocker

`redact-secret-sites` (private) owns the S3 bucket and CloudFront distribution. Read from `infra/static-site/template.yaml` and `samconfig.toml`:

- **Blocker: both benchmarks stacks use `RoutingMode=spa`.** The viewer-request function rewrites every extensionless URI to `/index.html`. Run on the template's code,
  `/next/`, `/next` and `/next/evaluation/qualification/` all become `/index.html`, the existing site's entry, while `/next/_next/static/x.js` and `/next/__next._tree.txt`
  pass through. Until that stack changes, the objects are published and the pages are unreachable (the browser gets the legacy site's HTML). The needed change is in
  that repository: for `uri === '/next'` or a prefix of `/next/`, apply directory routing (`<path>/index.html`) before the SPA fallback. This record names it and does not apply it.
- Fine as read: the distribution has no CSP for benchmarks and no path-based cache behavior; the bucket is versioned (30-day noncurrent expiry), so a `--delete` of an old key is recoverable;
  the publisher role has `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the bucket and `cloudfront:CreateInvalidation` on the one distribution, which `/next/*` objects use; the existing
  `/*` invalidation covers `/next/`. Staging already sends `X-Robots-Tag: noindex`; the app's own metadata is `noindex` too, so production's `/next/` is also not indexed.
- Size: the export is about 295 MB in 3,577 files (qualification pages 190 MB, the largest file 1.2 MB, below CloudFront's compression and S3's object limits), on a runner with
  tens of GB free. `aws s3 sync` compares modification times, so a fresh build re-uploads every file on each publish (about 3,600 more objects, one `/*` invalidation); that is time, not a limit. The
  size is printed in the run summary. Not measured: the real upload time, and whether the staging bucket's costs budget (none is set for benchmarks) matters.
- Not verified: a real publish, the AWS commands (no credentials here), the release asset's creation (a maintainer step), a staging run in candidate mode (`check:routes` was run in published mode).

## Consequences

- A `develop` push builds and publishes `/next/` on staging; `main` (by `go-production`) on production. The first staging publish needs the release asset to exist and the sites stack change
  for the pages to be reachable; without the asset the publish fails closed with the command that makes it, without the stack change it publishes unreachable objects.
- A new official run or a repin that changes `runs[]` needs a new archive (`pack`, new tag, `release.tag` and `source.ciRun` updated in the same PR); until then publish fails closed because the bytes no longer match.
- The publish job is longer (a 30 MB view input, a Next build, ~295 MB more upload).
- The authority is unchanged: nothing reads `qualification-authority.json`, no legacy page is re-pointed or deleted.

## Rejected

- **Download the CI build artifacts at publish time.** Needs `actions: read`, and stops working on 2026-12-30 for every push. Kept only as the source `pack` reads.
- **Commit the derived view.** An 8 MB generated file in git, a second source of truth that goes stale on every policy or product-input change; the digests that bind it are already the artifacts'.
- **Commit the RunArtifacts.** 30 MB and 242 MB files; `docs/specs/official-runs.md` already decided against it.
- **Re-run the engine in `publish-site.yml`.** Needs the engine token and a Rust build in the publish job, for a result already recorded and reproducible.
- **Skip `/next/` when the view is unavailable.** It would hide a broken measurement behind a successful publish; the user asked for a failure.
