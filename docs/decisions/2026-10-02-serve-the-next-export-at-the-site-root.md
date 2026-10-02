---
decision_id: decision-serve-the-next-export-at-the-site-root
status: accepted
scope: benchmarks
title: Serve the Next export at the site root and stop building the legacy site UI
decided_at: 2026-10-02
supersedes: decision-publish-the-next-export-under-next-with-the-qualification-view-built-from-archived-official-runs
---

# Serve the Next export at the site root and stop building the legacy site UI

## Context

#602, #606, #608. [The previous decision](2026-10-02-publish-the-next-export-under-next-with-the-qualification-view-built-from-archived-official-runs.md)
published the Next app under `/next/` beside the legacy Vite site, "so the existing pages stay the oracle". The owner has now decided that was a mistake:

- **Two sites at one host is not a preview, it is two products.** A reader who lands on `/` got the legacy site and had to be told to look at `/next/`.
  Every link, bookmark and search result pointed at the surface the project no longer wants to maintain.
- **The oracle is the data and the code, not the UI.** The legacy *source* (`src/`, the legacy corpora and run readers, `benchmarks/`) is what the parity
  report and the `legacy` authority compare against ([cutover record](../specs/qualification-cutover.md)). Building and publishing the legacy page layer adds nothing to that comparison.
- **The prefix cost real complexity**: a `basePath` that every check, test and server had to carry, a CloudFront function that had to route `/next/` as directory
  pages (the sites stack uses `RoutingMode=spa`), a `noindex` meta in the app so a preview was not indexed, and a "Preview index" page.

The points of the previous decision that are not about the prefix stand and are carried forward below: the qualification view is built from the archived canonical
RunArtifacts, checked byte for byte against `benchmarks/official-runs.json`, a publish fails without it, least privilege is unchanged, and production is reached only by `npm run go-production`.

## Decision

1. **The Next export is the site root.** `web/` builds with an empty `BASE_PATH` (now the default of `next.config.mjs`, of the check scripts, of the static server and of
   the Playwright suite; nothing in the repository sets a prefix). `scripts/assemble-site.mjs` assembles `dist/`: the export at `/` and `public/results/` at `/results/`
   (the measured JSON the pages and artifact consumers read), with `robots.txt` and `favicon.svg` from the export (`web/public/`). It refuses an export that lacks `index.html`,
   `robots.txt`, `favicon.svg`, `404.html` or the qualification page, one that owns `results/`, a root with a legacy `assets/` or a `next/` directory, and any file of the export that
   names `/next/`. `publish-site.yml` and the `web` job of `validate.yml` both call it, so what is scanned is what ships.
2. **The legacy site UI is no longer built or published.** `publish-site.yml` drops the "Build the site" step (and its `VITE_*` environment) and the `dist/index.html` assertion;
   `validate.yml` replaces `npm run build` (typecheck plus `vite build`) with `npm run typecheck` in `validate-sources`. The legacy source and data code stay, with their tests (the
   `unit-tests` shards, `support:check:ui`, `arrival:check` and the other validators): only the UI build, its publication and the CI step that built it go. `support:check:ui` stays:
   it is a source-level vocabulary gate over the generated support matrix and the providers roadmap that does not need the build, and no gate of the Next app checks that status
   copy against the matrix vocabulary, so dropping it would remove a check without a replacement. It goes with the legacy source when the oracle period ends.
3. **Publication guards scan the assembled root.** `features:check-public` and `blind:check-public` run in `publish-site.yml` after assembly and before AWS credentials are configured, and
   in the `web` job. They scan `dist/` and `public/` of the checkout, so the site root is assembled there (`dist/` is ignored by git); `--root` on a directory outside a checkout
   cannot be used because both guards also check that the output directories are git-ignored.
4. **Sync layout.** The Next fingerprinted chunks sync from `dist/_next/static` to `_next/static` (immutable, before and after the HTML, as `assets/` was). The final `--delete` sync
   removes the legacy `index.html` and the old `next/` preview, because neither is in `dist`. The legacy `assets/` are excluded from that sync so the HTML swap never
   leaves a page pointing at a deleted file, and removed (`aws s3 rm .../assets/`) after it. The v2 domain index stays the last mutable object written.
5. **Root `/` is the landing page**, not a redirect. `/robots.txt` allows crawling and no page of the export carries a robots meta (Next marks only its own `404` pages `noindex`).
   **Staging is kept out of indexes by CloudFront's `X-Robots-Tag: noindex`, not by the build**, so the same export is indexable on production; the previous build's `noindex`
   meta would have shipped to production at the root and de-indexed the site. `check:routes` and the Playwright suite fail on a robots meta and on a `/next/` string.
6. **Legacy URLs map to the new routes in one reviewed table**, `benchmarks/legacy-url-redirects.json`, explained in [`docs/specs/legacy-url-redirects.md`](../specs/legacy-url-redirects.md). The
   redirects themselves are CloudFront function code in `redact-secret-sites`, which mirrors the table; a test here fails when a target is not a route of the export. `/next/*`
   is redirected there as well, with the same table's `retired-prefix` rule.
7. **Rollback is redeploying the previous workflow commit.** `workflow_dispatch` on the previous `develop` (staging) or `main` (production) commit rebuilds and republishes the
   `/next/` layout and the legacy site; the bucket is versioned. `qualification-authority.json` is independent of this decision and has its own one-value rollback.
8. **Production is untouched until `npm run go-production`.** This lands on `develop` and publishes staging only; `main` carries the previous layout until the same code is promoted.

## Not verifiable from this repository

- **Blocker, in `redact-secret-sites`:** both benchmarks stacks use `RoutingMode=spa`, whose viewer-request function rewrites every extensionless URI to `/index.html`. At the root, `/report/`
  would be answered with the landing page. The stacks need directory routing (`<path>/index.html`, `/404.html` on a miss) before, or in the same deployment as, the first root publish,
  plus the legacy-URL and `/next/*` redirects of point 6. This record names it and does not apply it.
- A real publish, the AWS commands, and the redirects' behaviour on CloudFront (no credentials here).

## Consequences

- One site, one set of URLs. The `basePath` support stays in `next.config.mjs` for a future prefixed copy, but nothing uses it.
- Legacy bookmarks (`/coverage`, `/suites/<id>`, `/fixture/<id>`, `/workbench/...`) work only after the sites change lands; until then they are answered by the SPA fallback with the landing page or a 404.
- The first root publish on an environment deletes the legacy page layer there; the last legacy build is recoverable from the bucket's versions and from the previous workflow commit.
- The legacy UI source remains in the tree and typechecks; `npm run build` and `npm run dev` still build and serve it locally for comparison.

## Rejected

- **Keep `/next/` and add a root redirect to it.** Keeps the prefix, the routing blocker and a second canonical URL for every page.
- **Delete the legacy source now.** The parity report and the `legacy` authority still read it; the oracle period ends by its own exit condition, not by this change.
- **Run the guards with `--root` on a temporary directory.** Both guards require the checkout's git-ignore state; assembling into the ignored `dist/` is the supported shape.
