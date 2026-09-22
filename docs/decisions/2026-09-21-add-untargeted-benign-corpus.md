---
decision_id: decision-add-untargeted-benign-corpus
status: accepted
scope: benchmarks
title: Add an untargeted benign corpus: authored-synthetic, T3, action-split, ungated
decided_at: 2026-09-21
---

# Add an untargeted benign corpus: authored-synthetic, T3, action-split, ungated

## Context

The existing `negative-controls` category
([`docs/specs/evaluation-methods/06-benign-lookalikes.md`](../specs/evaluation-methods/06-benign-lookalikes.md))
measures false alarms on values chosen to test one family's overmatching:
each control is close enough to a real credential of a specific type to be a
meaningful negative for that type. It says nothing about a global false-alarm
rate on ordinary content — config, lockfiles, logs, source, docs — where
credential-like noise sits beside real prose with no family in mind. Issue
[#94](https://github.com/redact-secret/redact-secret-benchmarks/issues/94)
(part of #90) asks for that second axis. This is a decision-only record; no
fixture is authored here. It depends on #91 (merged), which stopped every
file arriving unlabelled as `documentation`.

Five questions had to be settled before any fixture could be written,
because two of them change what the resulting number means.

## Decision 1 — author it; do not ingest and scrub

The obvious construction is to snapshot real OSS files and scrub the secrets
out. That is circular: scrubbing is the capability under test. Either the
product does the scrubbing, in which case the corpus restates what the
detector already finds, or a human scrubs at a scale nobody can actually
verify, and the exit criterion in `06-benign-lookalikes.md` —

> can be reproduced without external secrets or network access

— becomes trivially satisfiable by authoring and essentially unprovable by
scrubbing: there is no way to confirm after the fact that a human removed
every live credential from an ingested file, only that the file passes the
same scanner being measured.

**Decision:** the corpus is real-world-*shaped* synthetic, authored locally,
not ingested from any external source. It is named `real-world-shapes`, not
`real-world-corpus` — the second name implies provenance the corpus does not
have. Its value over `negative-controls` is scale, file shape, and
co-occurrence density: ordinary config and logs where credential-like noise
sits beside real prose, not authenticity of origin. The category
`description` (added when the first fixture lands) states this plainly
rather than overclaiming realism.

If ingestion is insisted on later, it carries its own conditions, recorded
here so they are not re-litigated: permissive upstream licence only, corpus
capped at what one named reviewer reads in full, and reviewer identity plus
upstream commit recorded per fixture.

## Decision 2 — tier T3, therefore which denominator

`T2` means no usable provider documentation exists, but a pinned-scanner
registration or a structural argument still supports the fixture's shape —
the value is malformed against a documented grammar
(`benchmarks/lib/assessment.ts`'s `classifyControl`, `contracts[family].tier`
gate). A `package-lock.json` or an nginx access log has no credential
grammar to be malformed against in the first place. "This file contains no
secret" rests entirely on how the fixture was constructed and on this
project's own definition of a secret — nothing external grounds it. That is
the `T3` definition, already in use for project-policy controls (`policy
rows`, `changeRows` in `src/evaluation-model.ts`: "Project policy (T3): a
difference of opinion, not a defect").

**Decision:** every `real-world-shapes` fixture is `T3` unless the narrow
exception below applies.

Consequence, already enforced by `benchmarks/lib/lattice.ts`'s `groupKey`
(`kind/tier`, e.g. `must-not-flag/T3`) and `aggregateGroups`: a `T3` group
never shares a denominator with construction-grounded `T2` near-misses, or
with any other tier. No code changes are needed to keep `real-world-shapes`
false alarms out of a family's `T2` support evidence — the tier alone does
that.

**Narrow exception:** an individual fixture whose benign content *is* a
documented public identifier (e.g. a real RFC example range, a documented
placeholder namespace) may carry `T2` with its provider/RFC source recorded
on that fixture. This is decided per fixture, at authoring time, never for
the category as a whole.

## Decision 3 — split by `action`; gate on `redact`/`block` only

This is the decision that would otherwise make the corpus actively
misleading. Product ADR
[`2026-09-20-warn-unconditionally-on-high-signal-contextual-names`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-20-warn-unconditionally-on-high-signal-contextual-names.md)
deliberately accepts false positives on ordinary prose at Medium confidence /
`warn`, stating there is no threshold on length, entropy, or confidence that
separates them from real matches. `real-world-shapes` is exactly that
ordinary prose and config.

`falseAlarmRate` (`benchmarks/lib/lattice.ts`, `rate(flaggedFiles, files)`)
counts `flaggedFiles` from `scoreRow`'s `flagged: actual.length > 0` — any
finding at any action. Pointed at this corpus unmodified, it would report a
large false-alarm rate that is overwhelmingly accepted-by-design `warn`
findings: loud, true, and reading as a contradiction of a decision the
product made on purpose.

**Decision:** report the untargeted group's false alarms split by `action`.
Only `redact` and `block` actions count as gating; `warn` findings stay
visible in the report and are explicitly documented as non-gating, citing
the product ADR above by name in the report itself, not just in this
record.

This is a reporting requirement to be implemented, not something already
wired end to end: the engine's `Finding` type
(`benchmarks/types.ts`) carries no `action` field today, and `scoreRow` /
`aggregateGroups` (`benchmarks/lib/lattice.ts`) do not thread one through
from scanner adapters (`scanners/candidate.mjs`, `scanners/index.mjs`). The
field exists today only on the separate known-gaps evidence `Finding`
(`benchmarks/lib/promotion.ts`, validated against
`['redact', 'warn', 'block', 'allow']`). Implementing this split means
threading `action` from the scanner adapter through to scored rows for this
group, or building the split at the reporting layer from raw scanner output
before it collapses into `flaggedFiles`; either is a fixture-authoring-time
implementation detail, not a further decision — the split's meaning is
already fully specified by this record.

This must not redefine `falseAlarmRate` for the existing family groups. The
action split is additive, reported alongside the existing metric for
`real-world-shapes` only; no family's `falseAlarmRate` computation changes.

## Decision 4 — untargeted, reported, not yet gated

`real-world-shapes` fixtures get no `detectors` and no `fixture-detectors.json`
entry, so they land in `byDetector['unassigned']` and contribute 0 to every
family's `benignCases` / `benignAxes`. They cannot move any family's support
status. This is deliberate: a global false-alarm rate is not evidence about
a family, and `classifyFamilySupport` (`benchmarks/support/status.ts`) is
built to evaluate one family's own evidence against `status-criteria.json`
thresholds — there is no global status object for a cross-family metric to
attach to.

**This corpus does not unblock the support matrix.** It is a separate axis
and must not be reported or sold as progress toward `stable` for any family.

It is not gated at introduction, for three reasons: (a) its denominator
moves as fixtures are added over time, so a zero-tolerance gate at this
stage would oscillate on every addition rather than reflect a real
regression; (b) `classifyFamilySupport` is per-family by construction, so
there is nowhere per-family criteria could hang a global check; (c) a flag
here is discovery evidence, and the promotion lifecycle (Decision 5) already
exists to turn discovery evidence into a claim — a gate would pre-empt that
review.

**Revisit condition:** once the corpus is large enough that its `redact`/
`block` false-alarm rate is stable release over release (not moving purely
from corpus growth), add a gate on `redact`/`block` actions only, scoped to
this axis. Its honest home is `benchmarks/validate-evidence.ts` or a new
floor in `qualification/suite-v1.json` (the existing pattern for a
threshold keyed by something other than family — see its per-purpose
`resolvedRateFloor` / `measurableShareFloor` / `twinCoverageFloor`), never
`status-criteria.json`, whose schema is per-family. This record defers that
work; it does not perform it.

## Decision 5 — what happens when it flags

Nothing automatic. A flagged `real-world-shapes` control is a `benign`
assertion failure in the run report, exactly like any other control. It
becomes a product finding only when a human opens a `benchmarks/known-gaps.json`
record — `kind: "false-positive"`, `status: "observed"`, the flagged
fixture ids, and `expectationReview` (`method:
"authored-independent-of-scanner-output"`) authored independently of the
scanner output that flagged it — and that record is carried through
`promote-finding` per
[`2026-09-18-govern-benchmark-promotion.md`](2026-09-18-govern-benchmark-promotion.md).

Never relabel the fixture, add a detector exception, or edit the file to
make it quiet. This is repeated here and belongs equally in the
`real-world-shapes` category `description` once fixtures exist, because this
corpus — ordinary, ambiguous, and full of accepted-by-design `warn` noise —
is the one most likely to tempt someone to make a flag go away instead of
reviewing it.

## Consequences

- A future fixture-authoring issue can add `real-world-shapes` fixtures with
  no `detectors` field, tier `T3` unless a fixture documents a `T2`
  exception, and no `fixture-detectors.json` entry — consistent with
  Decisions 2 and 4, no further design decision needed at that point.
- Reporting work to thread `action` onto scored rows for this group (Decision
  3) and to render the `warn` vs. `redact`/`block` split is unblocked and can
  proceed independently of fixture authoring.
- The support matrix, `status-criteria.json`, and every existing family's
  `falseAlarmRate` are unaffected by this record.
- No gate exists yet on this axis. Its absence is not an oversight; the
  revisit condition in Decision 4 is the trigger to add one.

## Explicitly out of scope

- Authoring any `real-world-shapes` fixture. This record decides shape,
  tier, reporting, and gating; a separate issue writes the corpus.
- Implementing the `action`-threading change described in Decision 3. This
  record specifies the split precisely enough to implement without
  reinterpretation; it does not implement it.
- Adding a gate to `benchmarks/validate-evidence.ts` or `qualification/`.
  Decision 4 names the honest home for that gate and its revisit condition;
  it defers the work.
