# Fixture titles and descriptions

Issue: [#593](https://github.com/redact-secret/redact-secret-benchmarks/issues/593), part of [#543](https://github.com/redact-secret/redact-secret-benchmarks/issues/543).
Decision: [Take a public case's title from its credential-evidence record and author only product-owned fixtures here](../decisions/2026-10-08-take-public-case-titles-from-credential-evidence-and-author-only-product-fixtures-here.md).

This repository measures and records. A title and a description are display text: this page and the files it names assert no product result.

## Who owns the text

| Fixture | Owner | Where the text lives | How it reaches the page |
| --- | --- | --- | --- |
| a case of the public evidence snapshot (`public-evidence-snapshot`) | credential-evidence | the case record of the pinned release (`records/cases/<case>.json`: `title`, `summary`, `lifecycle`) | `benchmarks/evidence-case-metadata.json`, a projection derived by `npm run evidence:case-metadata`, never edited by hand |
| a fixture of a product-owned category (`regression-corpus`, `policy-corpus`; `benchmarks/generated-populations.json`) | this repository | `benchmarks/fixture-descriptions.json` | read by the legacy catalog; refused for any slug outside a product-owned category |
| anything else (a public remainder fixture of the legacy corpora, a public fixture the release attaches to a scenario rather than a case) | nobody records one | — | the page says "What it tests: Not recorded" and titles the page with the id |

A public case's text is never authored here: a correction is a credential-evidence change, picked up by the next pinned release. A product fixture's text
is never sent upstream: the product populations are not public evidence ([generated populations](generated-populations.md)).

## The projection of the pinned release

`npm run evidence:case-metadata` downloads three assets of the release that `benchmarks/official-runs.json` pins for `public-evidence-snapshot`
(`release-manifest.json`, `records-bundle.json`, `fixtures-materialized-manifest.json`) into `results-output/evidence-case-metadata/` and refuses unless:

- the release manifest's sha256 is the pinned `manifestDigest` and it names the pinned tag;
- each asset's bytes and size are the ones the manifest's `files[]` lists;
- the materialized manifest is the one the release manifest's `fixtures.digest` names, and the records bundle is from the manifest's source commit;
- each case record's text hashes to the sha256 the bundle lists, and holds the case id it is filed under.

It writes, sorted and byte-stable: `source` (tag, manifest digest, corpus digest, source commit, both asset digests), `cases` (one entry per case record a
fixture targets: `title`, `summary`, `lifecycle`, the record path and sha256) and `fixtures` (fixture id to case id, for every fixture the materialized
manifest attaches to a case). The text is copied byte for byte; the upstream records, the snapshot, its corpus digest and the materialization are not
touched. `npm run evidence:case-metadata -- --verify` re-derives and fails unless the committed file is identical.

`npm run fixture-metadata:check` (CI `validate-sources`) is offline: the projection names the registry's tag, manifest digest and corpus digest, every
fixture names a case that has an entry, every case is targeted, and every text passes the text rules below; the overlay names fixtures of product-owned
categories only. A repin moves the pin, so the check is red until the projection is re-derived in the same commit ([evidence adoption](evidence-adoption.md)).

## What the page shows

The fixture page is built from the suite's records file (`data/fixtures/<suite>/records.json`). A record carries `title`, `about` and `aboutBy` as
indexes into the suite's shared texts (a case title shared by twelve fixtures is shipped once).

- **Under `new`** (the committed authority) the fixtures are the view's report population. `services/credential-source.ts` reads the projection and
  `withCaseText` (`services/credential-bridge.ts`) attaches a case's text only when the projection's tag, manifest digest **and** corpus digest are the
  ones the run measured (`artifact.manifest.evidence`). A projection of another snapshot, or one that fails its own check, gives no fixture a title; the
  page's "What it tests" says why, and the build does not fail (the CI check does).
- **Under `legacy`** (the rollback) the catalog applies `benchmarks/fixture-descriptions.json` to the product-owned fixtures of the legacy corpora.
- A title is shown only with its description and its author (`aboutBy`: "credential-evidence case record `<case>` (`<lifecycle>`), release `<tag>`", or
  "Authored in this repository …"). A half-recorded pair is not recorded. The page heading is the title, the slug stays beside it, and the crumb names the id.
  Otherwise the heading is the id and "What it tests" is "Not recorded", with the group label when the corpus has one.

Both export checks recount the text independently: `check-export-credential.mjs` from the projection (and only when it is bound to the view's run),
`check-export-rows.mjs` from the overlay; any other fixture must carry none.

## Text rules

A title is at most 160 characters, a description at most 600; both are one line, trimmed, with no control character, line separator or bidirectional
override, and no run of 32 or more letters and digits (the shape of a credential value, never of a description). A description says what the bytes
exercise, never a value from them.

## Identity

The text is outside every identity a run or a peer snapshot is bound to. The fixture index (`fixture-index.json`, whose digest a metadata change would
otherwise re-key), the generated corpora and `generated-corpora.json`, the corpus hashes and the pin manifest do not read either file, and a test
(`tests/fixture-metadata.test.mjs`) keeps their producers from starting to. Verified on this change: `fixture-index:check` reports the unchanged semantic
digest `e486ab4d…f254` over 6,423 fixtures, and `fixtures:check` and `pins:manifest:check` pass with no regenerated file. The records files do change
(they now hold the text), which is what the export checks recount.

## The pilot

The arrival cases that credential-evidence already authored carry the pilot: every fixture the pinned release attaches to a case record gets that
record's title and summary (snapshot-2026.10.06.4: 1,169 fixtures of 292 case records; fixtures generated against a scenario keep the absent state).
Their stable ids and source commitments are unchanged: the projection keys by the release's own fixture ids and binds the case record's sha256.
Six product-owned policy fixtures carry authored text in the overlay, to exercise the second owner on the rollback path.
