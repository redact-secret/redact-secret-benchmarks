---
decision_id: decision-take-public-case-titles-from-credential-evidence-and-author-only-product-fixtures-here
status: accepted
scope: benchmarks
title: Take a public case's title from its credential-evidence record, author only product-owned fixtures here, and keep both out of every identity
decided_at: 2026-10-08
---

# Take a public case's title from its credential-evidence record, author only product-owned fixtures here, and keep both out of every identity

## Context

#593 (part of #543). The fixture page titled every fixture with its id and said "What it tests: Not recorded". The original brief proposed authoring a
title and a sentence in this repository's corpus generators for the `beta8-*` arrival suites. That predates the evidence split (#602, #607): under the
committed `new` authority the fixture pages are the public evidence snapshot's cases, owned by credential-evidence, and the `beta8-*` corpora are the legacy
oracle. Text authored here for them would be thrown away or re-keyed by the next repin, and would put this repository in the business of describing cases
it does not own.

Inventory of the pinned release (snapshot-2026.10.06.4): the eval snapshot (`credential-eval-corpus-snapshot.json`) carries no title or description per
case. The release's records bundle does: every one of its 315 case records has a `title` and a `summary`, and the materialized-fixture manifest attaches
1,169 of its 7,041 fixtures to a case (`case`, `target.type: case`); the rest are generated against a scenario. The legacy fixture index records a
milestone, an issue and a group label, never a description.

## Decision

1. **Two owners.** A public case's title and description are its credential-evidence case record's `title` and `summary`. A product-owned fixture's
   (the regression and policy corpora, `benchmarks/generated-populations.json`) are authored here in `benchmarks/fixture-descriptions.json`, reviewed in the
   pull request that adds them. The overlay refuses a slug outside a product-owned category, so a public case is never described here.
2. **Consume the pinned release through a derived projection.** `benchmarks/evidence-case-metadata.json` is derived by `npm run evidence:case-metadata`
   from the release the registry pins, verified against its manifest digest and each asset's listed sha256, and copies the text byte for byte. It is
   committed (the web build is offline) and never edited by hand; `--verify` re-derives it, and `fixture-metadata:check` binds it to the pin offline.
   Upstream records, the snapshot, its corpus digest and the materialization are not touched.
3. **Bind at render time to the measured snapshot.** The `new` source attaches the text only when the projection's tag, manifest digest and corpus digest
   equal the run artifact's evidence identity; otherwise no title is shown and the page says why. A title needs its description and its author, or it is
   not shown. The page names the author (the case record, its lifecycle and the release; or this repository and the date).
4. **Display text, outside every identity.** Neither file is an input of the fixture index identity, the generated corpora, the corpus hashes, the pin
   manifest or any scored value: authoring or repinning a title re-keys no peer snapshot or run. The records files carry the text and both export checks
   recount it from the source files.
5. **The pilot is the authored arrival cases upstream already has.** Every case-targeted public fixture shows its case record's text; scenario-generated
   fixtures keep the explicit absent state; six product policy fixtures carry overlay text to exercise the rollback path. A case-level title is shared by
   the fixtures of the case; the slug stays beside it so a fixture remains identifiable.

## Consequences

Under `new`, about one public fixture in six gets a human title and a description; the others still say "Not recorded", which is true. A per-fixture
title for scenario-generated fixtures is a credential-evidence change (an upstream gap, not worked around here). A repin must re-derive the projection in
the same commit (`docs/specs/evidence-adoption.md`, step 1). Case records in `draft` or `maintainer-only` lifecycle are shown with that word, not hidden.
No pin, authority, ledger, threshold or support status changes, and no measurement is run.
