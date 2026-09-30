---
decision_id: decision-feature-claims-record
status: accepted
scope: benchmarks
title: Record feature claims from each library's own documentation, with a source per cell and a test per "tested" mark
decided_at: 2026-09-30
---

# Record feature claims from each library's own documentation, with a source per cell and a test per "tested" mark

## Context

#564 (part of #543). `/comparison/feature` renders `benchmarks/feature-claims.json`,
which did not exist. The page lists what three runtime libraries say they can do.
The boundary rule holds: this repository records and measures, it does not assert
product output, so a cell is what a project's own documentation says, never our
judgement, and never ranked.

## Decision

1. **Libraries and versions** are the peers this repository already pins in
   `package.json`: `@redact-secret/core` 0.1.0-beta.11, `flare-redact` 1.6.1 and
   `@openredaction/core` 1.1.5, in the runtime page's order. A test fails when a
   pin moves without the file, so the page never describes a version we do not run.
2. **Primary sources only.** Each library's README as published in its npm package
   (or at the matching git tag), its `package.json`, its type declarations, and for
   redact-secret its guides at tag `v0.1.0-beta.11`. Every cell carries
   `source: { kind: "doc", ref: <https url pinned to the version> }`; the
   validator (`featureClaimsProblem`) rejects a cell without one, and a test
   requires the version to appear in the URL. `readOn` records the day they were read.
3. **No `unknown` mark.** The marks stay `yes`, `partly`, `no`. `no` means "not
   listed, or not stated, in the documentation read" (a dash on the page), never
   "the library cannot"; the cell's note says which ("Not stated", "Not listed in
   its README") and the sources block says it in words. A fourth mark would have
   drawn a second, muted dash a reader cannot tell apart from the first. Where the
   README describes a larger package than the one measured (OpenRedaction), the note
   says so and the mark follows the package we pin.
4. **`tested` is earned.** A cell carries `tested: true` and `test: "<row>.<library>"`
   only when `tests/feature-claims.test.mjs` has a probe of that name that runs the
   pinned library. The test fails if a `tested` cell has no probe or a probe backs
   no cell (15 cells today: runs on Node, sync or async, the default placeholder
   shape, what a result repeats, chunked input, and that OpenRedaction's main entry
   imports Node built-ins). Probes use synthetic values only.
5. **Rows.** The mockup's rows, kept where the docs answered them, with corrections
   where reading the docs disagreed with the draft (flare-redact lists a `block`
   action; redact-secret's placeholder formatter never sees the value, so it cannot
   keep a hint; OpenRedaction's README lists no IP address detector). The mockup's
   "No required dependencies" row moved to the runtime page's facts, because a
   dependency count is a fact, not a feature.
6. **Runtime facts, additively.** Each library may carry `facts`: where it runs,
   dependencies, and install size from `npm pack --dry-run --json` at the pinned
   versions (redact-secret is core plus WebAssembly plus one platform add-on).
   `resolveRuntimePanels` takes the load as an optional second argument and appends
   three rows to "About the libraries"; without the file the table is unchanged.
   A test re-derives each single-package size from the installed files. "Size in a
   web page" is not recorded: nothing in package metadata states it.
7. **Freshness** is version coupling (1), not a calendar: docs are re-read when a
   pin moves. `check:routes` compares the built pages with the file (every row,
   note, mark word, source link, "tested" chip, the read date, the hub counts and
   the runtime facts).

## Consequences

`web/services/features.ts` gains a required `source` per cell, optional `test`,
`facts` and source `links`; the "only differences" filter treats a row that shows a
literal value as different. The existing site is untouched.
