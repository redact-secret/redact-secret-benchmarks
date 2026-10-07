# Legacy URL redirects

The Next export is the site root ([decision](../decisions/2026-10-02-serve-the-next-export-at-the-site-root.md)), so the URLs of the legacy site
and of the retired `/next/` preview need an answer. The answer is a table, `benchmarks/legacy-url-redirects.json`, derived from the legacy route
table (`parseRoute` and `legacyRoute` in `src/model.mjs`) and the routes of the export (`web/lib/routes.ts`, `web/app/**/page.tsx`). The redirects are
CloudFront viewer-request function code in `redact-secret-sites`; that repository mirrors the JSON, this one validates it.

## How to apply it

- Take the request path without its trailing slash (`/coverage/` is `/coverage`). A path with a file extension, `/_next/`, `/data/`, `/results/`, `/robots.txt` and `/favicon.svg` is not redirected.
- Try the rules of `rules` in order; the first whose `match` regular expression matches wins. Answer `301` (`status`) with `Location` set to `to`, each `{name}` replaced by that named group, and the request's query string appended (a `to` that already has a `?` takes the original query after an `&`).
- Run `retiredPrefix` first: a `/next` or `/next/...` path is stripped to `rest` (`/` when empty) and the result goes through the rules once more, so `/next/coverage` ends at `/report/families/` in one response (resolve both steps, answer once).
- `kept` paths are served as they are: `/` is the landing page and no longer redirects.
- A path no rule matches is the export's own: it is served, or it is a 404 (`/404.html`). An id outside the six method ids is such a path on purpose.
- Every `to` is a directory page of the export. The distribution must route `<path>/` to `<path>/index.html` (directory routing), not rewrite extensionless URIs to `/index.html` (SPA routing).

## The table

| Legacy URL | Goes to | Why |
| --- | --- | --- |
| `/` | kept (landing page) | the legacy `/` redirected to `/report`; it no longer does |
| `/report` | `/report/` | same page |
| `/benchmark`, `/benchmark/:id` | `/report/` | the id was a detector or a suite, which an edge function cannot tell apart |
| `/coverage`, `/coverage-gaps` | `/report/families/` | the family list carries the coverage counts |
| `/coverage/detectors/:id`, `/coverage/:id`, `/evaluation/detector/:id` | `/report/detectors/:id/` | same ids |
| `/coverage/:provider::family` | `/report/families/:provider--:family/` | the page slug writes the colon as `--` |
| `/support` | `/report/families/` | each family page carries its recorded status; no support page exists |
| `/support/providers` | `/report/providers/` | the provider list carries each dossier |
| `/evaluation`, `/evaluation/pii` | same path with a slash | same pages |
| `/evaluation/credentials` | `/evaluation/credential/` | singular route |
| `/evaluation/reviews`, `/evaluation/failures`, `/pending`, `/workbench`, `/workbench/review/:id` | `/evaluation/` | the Workbench and its review queue have no page; the hub is the nearest |
| `/evaluation/operators` | `/evaluation/method/mutation/` | the legacy redirect target |
| `/evaluation/method/:id`, `/workbench/method/:id` | `/evaluation/method/:id/` | six ids: twin, benign, metamorphic, mutation, differential, holdout |
| `/performance` | `/comparison/performance/` | a comparison page now |
| `/how-to-read`, `/methodology` | `/comparison/` | no such page; the overview says which page answers which question |
| `/scenarios/:id` | `/report/` | scenarios have no page |
| `/suites/:id` | `/report/fixtures/:id/` | same ids |
| `/fixture/:category--:rest` | `/report/fixtures/:category/?fixture=:rest` | a fixture opens on its suite page |
| `/workbench/changes` | `/evaluation/rc/` | the candidate against the release |
| `/workbench/qualification` | `/evaluation/qualification/` | same subject |
| `/next`, `/next/...` | the same path without `/next` | the retired preview prefix |

## Before the host rule: the not-found page (#594)

Until the CloudFront function carries the `fixture` row, and on any host without it, `/fixture/<suite>--<id>` reaches the export's `404.html`. The not-found page
then resolves it in the browser (`web/app/LegacyFixtureLookup.tsx`, `web/lib/legacy-fixture.ts`): split at the first `--`, validate both ids, check the suite's
records file, and replace a known fixture with `/report/fixtures/<suite>/?fixture=<id>` (original query minus `fixture`, hash kept). An unknown suite or fixture
stays a 404 that says which ([decision](../decisions/2026-10-07-resolve-legacy-fixture-links-on-the-not-found-page.md)). The host rule is still the answer of record.

## Decisions where the new site has no equal page

`/coverage` and `/support` go to the family list, `/how-to-read` to the comparison overview, `/scenarios/:id` to the report hub, `/workbench/review/:id` to the evaluation hub: each is
the page that answers the nearest question, chosen over a 404 because a bookmark should land somewhere that links onward. `/benchmark/:id` goes to the report hub rather than guessing
between a detector and a suite. If the new site gains a page for one of them, change its `to` and the test keeps the target honest.

## Validation

`tests/legacy-url-redirects.test.mjs` fails when: a `to` (query removed) is not a route of the export (the static routes of `web/lib/routes.ts`, `/`, and the dynamic routes found under `web/app`);
a path `parseRoute` still serves is not answered by the table or `kept`; a legacy redirect of `parseRoute` does not end at the same page as the table; a rule's `match` does not compile or its `to` uses a group it lacks.
It reads no ledger value.
