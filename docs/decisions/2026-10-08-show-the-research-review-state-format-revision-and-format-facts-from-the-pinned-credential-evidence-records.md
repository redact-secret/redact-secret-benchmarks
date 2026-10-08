---
decision_id: decision-show-the-research-review-state-format-revision-and-format-facts-from-the-pinned-credential-evidence-records
status: accepted
scope: benchmarks
title: Show the research review state, format revision and format facts from a validated projection of the pinned credential-evidence records
decided_at: 2026-10-08
---

# Show the research review state, format revision and format facts from a validated projection of the pinned credential-evidence records

## Context

#591 asks what "reviewed" and "format revision" mean here, who decides them, how a revision is cut and how a superseded one stays
visible, and to show both on the family and provider pages or say "not recorded". #590 asks for the family page's shape strip,
per-fact evidence class with source and read date, and per-family open questions, from validated records; the original brief proposed a
local `dossier-v2.json`. Both must stay apart from qualification status, the engine version and the evidence snapshot version, and
neither may build a research source competing with credential-evidence
([ownership, #582](2026-10-08-own-canonical-research-in-credential-evidence-and-keep-benchmark-dossiers-as-legacy-presentation.md)).

The pinned release (`snapshot-2026.10.06.4`, schema 1.8.0) already holds every field both issues need:

| Need | Upstream field |
| --- | --- |
| Review state | `lifecycle` on the family and on each contract revision: `draft`, `maintainer-only`, `reviewed`, `deprecated`, `withdrawn`; the append-only review history behind it |
| Format revision | `format-contract` records `<family>@<n>`, immutable, with `period` (`current`, `historical`, `proposed`), `validity`, `supersedes`; the family's `currentContract` |
| Shape | `structure`: `prefixes`, `components` (name, role, description), `separators`, `length`, `alphabet`, `checksum`, `descriptivePattern` |
| Fact and its evidence | `claims[]`: statement, `evidenceClass`, `observedAt`, sources with what each supports and where |
| Source and read date | `evidence-source`: type, locator and pin kind, `observations[]` (when it was actually read, and the outcome) |
| Open questions per family | `openQuestions[]` on the contract revision, each with an id and `raisedAt` |

At this snapshot every family and contract record is `draft` (0 `reviewed`); 16 families have a second revision (15 `proposed`, one
`current` superseding `@1`); of 306 contracts, 156 have an empty structure and 118 only a `descriptivePattern`; 173 of the 182 taxonomy families have a
record (the nine #583 promotions do not).

## Options

1. **A local `dossier-v2`** with format facts, evidence marks and a review field. Rejected: a second canonical research corpus, with an
   evidence-class vocabulary to keep in step by hand.
2. **Read `records-bundle.json` at build time from the release.** Rejected: a network fetch in every build and every PR, for 17 MB.
3. **Commit a validated projection of the pinned release** and render it. Chosen.

## Decision

**Authority.** Review state and format revision are credential-evidence's. "Reviewed" means the record's `lifecycle` is `reviewed`, set
by credential-evidence's review process; `maintainer-only` is the solo-maintainer state of ADR 0020 and is shown in the owner's fixed words
("Maintainer-reviewed (independent review pending)", #680). This repository never sets, infers or upgrades a review state.

**Revision rules.** A format revision is a credential-evidence contract record `<family>@<n>`: immutable at the pinned release. A reviewed contract cannot change meaning; a changed
understanding is a new revision that names the one it supersedes (credential-evidence ADR 0002). The revision shown is the family's
`currentContract`, or, when none is current, the latest revision with its own period ("2 · proposed, none current"). Every revision stays
listed on the family page with its period, review state, `supersedes` and "superseded by" (the inverse of the same field) and validity, so a
superseded or proposed revision is visible, never replaced.

**The projection.** `npm run research:project` downloads `release-manifest.json` and `records-bundle.json` of the release
`benchmarks/official-runs.json` pins for `public-evidence-snapshot`, refuses anything but the pinned release (manifest digest, tag,
records-tree digest, the bundle bytes the manifest lists, each record's own digest, schema revision), and writes
`benchmarks/support/research-projection.json` (`schemas/research-projection-v1.json`) for the taxonomy's families: the record's own
values, nothing derived from a pattern or claim text, no scanner, product or support-status field. `npm run research:check` (validate
workflow) validates it, holds every family to the taxonomy and every cited source to the list, and fails when it was not taken from the
release the registry pins: a repin regenerates it in the same change. The Next service refuses an invalid projection (the build fails) and
shows a stale one as "not recorded" with both release names, never an old record as current.

**Pages.** The family page opens with a "Research record" block (review state, format revision, research state and date; every revision;
every blocker part; rulings by reference; the review history in one line, saying project-maintained review is not independent
validation; a link to the record at the release's commit) and a "Format" block (#590: the shape strip drawn from `structure` as written,
one row per claim with its evidence class as a word and a line style, its read date and its sources with their last read date, and the
open questions with their ids). The provider list names each family's review state and format revision. A family the release does not
hold, an absent projection and a stale one read "Not recorded" with the reason. The block names the release it came from; that release
is the evidence snapshot, a different thing from the engine version and from the qualification status, which stay in their own sections
and are never read from these records. The benchmark dossier's verdict and tier stay, labelled as the dossier's.

**What is not filled in.** A structure component carries no evidence class upstream, so the strip draws each part as the record states
it and says that the evidence class of each fact is in the facts list; nothing is matched between claim text and a segment. The pilot
family `github:fine-grained-personal-access-token@1` has claims but only a `descriptivePattern` as structure. Both are upstream gaps,
requested as [credential-evidence#269](https://github.com/redact-secret/credential-evidence/issues/269) (an additive claim link on
components, and the pilot's structure); no local field stands in for them.

## Consequences

- No ledger, pin, authority, support status or measurement changes. The dossier readers are unchanged.
- The projection (about 1.6 MB) is committed and changes only on a repin or a taxonomy change; `scripts/ci-plan.mjs` counts it as a
  new-path input, so changing it never reruns the legacy measurement.
- Upstream additions (#269, the Slack name #268) arrive with the next pinned release through `research:project`, with no change here.
- Spec: [`docs/specs/research-records.md`](../specs/research-records.md).
