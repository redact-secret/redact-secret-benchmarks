---
decision_id: decision-web-legacy-fixture-links
status: accepted
scope: benchmarks
title: Resolve old /fixture/<suite>--<id> links on the not-found page, beside the host rule
decided_at: 2026-10-07
---

# Resolve old /fixture/<suite>--<id> links on the not-found page, beside the host rule

## Context

#594 (part of #543). The legacy site served one page per fixture at `/fixture/<suite>--<id>`; the Next export serves a fixture on its
suite page as `/report/fixtures/<suite>/?fixture=<id>` (`2026-10-01-keep-the-fixture-page-on-its-suite-page.md`). The host rule that maps one to
the other is row `fixture` of `benchmarks/legacy-url-redirects.json`, applied by the CloudFront function in `redact-secret-sites`. Until that
function is deployed, and on any host that does not run it (a local `serve`, a preview), an old link reaches the export's `404.html`.

Stored links: this repository holds `/fixture/` addresses only in the legacy UI source (`src/pages/**`, the oracle), its tests and two docs
(`ARCHITECTURE.md`, the fixture-page ADR); no ledger or results file stores one. A search of the benchmarks and product repositories' issues and
code (2026-10-07) found no published `benchmarks.redactsecret.dev/fixture/...` link outside `tests/navigation.test.mjs`. Bookmarks and links in
text elsewhere cannot be inventoried, so the fallback must answer any well-formed address.

## Decision

`web/app/not-found.tsx` wraps its body in a client island, `LegacyFixtureLookup`, bounded to one job:

- It acts only on a path of the form `/fixture/<suite>--<id>` (`web/lib/legacy-fixture.ts`): the slug splits at the **first** `--` (a suite
  id never contains `--`, a fixture id may); the suite is `[a-z0-9]+(-[a-z0-9]+)*`, the id is letters, digits, `.`, `_`, `-` (at most 200,
  starting with a letter or digit), the same characters `BUILD_DATA_PATH` accepts. Anything else renders the ordinary 404, unchanged.
- It checks the suite's build-emitted records file (`data/fixtures/<suite>/records.json`, the file the suite page itself fetches, one
  same-origin `GET`). A known fixture is replaced (`location.replace`) by `/report/fixtures/<suite>/?fixture=<id>`; the original query is
  carried over except `fixture` (the target owns it) and the hash is kept when it is at most 256 characters. The target is always
  root-relative under `/report/fixtures/`, so no address can send a reader off the site.
- A suite with no records file, a fixture the suite does not hold, and a request that failed each stay a 404 that says which, and link to the
  suite or the suite list. A failed request is "could not check", never "does not exist". The host-redirected form of an unknown suite
  (`/report/fixtures/<unknown>/?fixture=<id>`) gets the same "no such suite" answer.

No per-fixture page is generated.

## Consequences

- Old links work on any static host now; the host rule, when deployed, answers them with a 301 before the export is reached, and the fallback
  then never runs. The host rule and its parity with the deployed route belong to `redact-secret-sites`.
- The 404 page makes at most one request, only for a well-formed legacy address.
- Tests: `web/tests/unit/legacy-fixture.test.tsx` (parsing, encoding, query/hash, the island's states, synthetic ids) and four cases in
  `web/tests/e2e/navigation.spec.ts` that read a real suite and fixture from the export, so no ledger value is asserted.
