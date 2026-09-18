# Measurement protocol v4

Status: **accepted and implemented (2026-09-17).** Decision record:
[`decisions/2026-09-17-adopt-measurement-protocol-v4.md`](decisions/2026-09-17-adopt-measurement-protocol-v4.md),
which also answers the open questions in §8. Report `schemaVersion: 4`, corpus
schema 2, generated `release-comparison.md`, dashboard rework.

This document is the design rationale and acceptance criteria. It changes what
we measure and what a headline number means. It does not add fixtures, does not
change any existing fixture's bytes, and does not relax any current safety or
provenance rule (no live credentials, no vendored scanner source, no
scanner-derived ground truth).

---

## 1. Why v3 needs replacing

v3 is honest but unreadable, and its honesty is implemented as prose rather than
as measurement. Six concrete defects:

**D1 — Exact range equality is the only success.** `score()` defines a true
positive as `a.start === e.start && a.end === e.end`. Anything else is counted
as *both* a false positive and a false negative. A finding one byte wider than
the authored span — a trailing quote, a `\r`, the whole `postgres://` URI — is
scored identically to reporting nothing at all. For a redaction product this is
backwards: the wider finding redacts the secret, the missing one leaks it. The
README already knows this ("an entire-file finding may contain a secret") and
compensates with a separate `contained`/`broader` pair plus four paragraphs of
caveats. The caveats exist because the primary metric measures the wrong thing.

**D2 — One `cohort` field carries three unrelated questions.** Today a cohort
answers *what does this file assert?* (secret present / silence expected),
*how well is the assertion grounded?* (pinned source / project policy / no
evidence yet), and *may this row be aggregated?* — all at once. That is why
`malformed-example` holds 254 files of which only 86 have expected spans: 168
negative controls and 86 policy positives share a denominator because they share
a provenance story. False alarms — the number an adopter cares about most — have
no line of their own anywhere in the report.

**D3 — Positive-only samples, so precision is undefined but still exported.**
`precision`, `recall`, `f1` are computed per cohort in JSON and then disowned in
the UI ("positive-only format samples cannot establish balanced precision/F1").
A dead metric in an export is a metric someone will quote.

**D4 — Format evidence is the competitors' source code.** Every entry in
`contracts` is sourced to a TruffleHog detector file and `gitleaks.toml`. We then
measure TruffleHog and Gitleaks against those contracts. A format those two tools
have not implemented cannot become a reviewed positive, so the corpus can never
show a gap that both tools share — the exact case an independent benchmark exists
to find. The Hugging Face row proves the circularity: the two tools disagree on
the alphabet, so 36 fixtures sit unscored waiting for an authority neither tool
can supply.

**D5 — `contained` is a boolean, so overbreadth is invisible.** A finding that
matches the secret exactly and a finding that swallows the entire file both
increment `contained` by 1. There is no quantity anywhere in the report that
grows when a scanner over-reports.

**D6 — The overview is not a run.** Reports are per-category, each with its own
`generatedAt`, and the overview aggregates whatever is latest per case. The
README says so. Any cross-suite number is therefore a composite of different
moments — and beta-to-beta comparison is maintained by hand in
`docs/beta-4-results.md`.

---

## 2. What v4 measures

### 2.1 Three axes instead of one cohort

Every fixture declares three independent fields. Nothing is inferred from
scanner output — the existing rule stands and gets stricter (§6).


| Axis      | Field           | Values                                                                                 | Answers                         |
| --------- | --------------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| Assertion | `kind`          | `must-redact` · `must-not-flag` · `policy`                                             | What does this file claim?      |
| Evidence  | `tier`          | `T1` provider-documented · `T2` tool-corroborated · `T3` project-policy · `T0` pending | How well grounded is the claim? |
| Span role | per-span `role` | `secret` · `companion`                                                                 | Which bytes must be covered?    |


`kind` decides which metric the file feeds. `tier` decides which rows may share
a denominator. They no longer constrain each other: a T1 `must-not-flag` control
(a documented *public* identifier, e.g. `pk_live_…`, AWS account ID) is now
expressible and is the strongest kind of negative control we can author. In v3
it had nowhere to live.

Mechanical migration from v3 (no re-authoring, no byte changes):


| v3 cohort                             | files / spans | v4                                                                  |
| ------------------------------------- | -------------: | ------------------------------------------------------------------- |
| `common-format`                       | 190 / 195     | `must-redact`, T1 where a provider source exists, else T2           |
| `masking`                             | 69 / 69       | `policy`, T3                                                        |
| `malformed-example` **with** spans    | 86            | `policy`, T3                                                        |
| `malformed-example` **without** spans | 168           | `must-not-flag`, T2 (malformed/near-miss) or T3 (placeholder/prose) |
| `unreviewed`                          | 36 / 36       | T0, `kind` recorded, unscored exactly as today                      |


### 2.2 Two-range ground truth: inner span + cover envelope

Each `secret` span gains an optional **envelope**: a wider byte range the finding
may extend to at no cost, authored with a rationale.

```json
{ "start": 31, "end": 71, "role": "secret",
  "note": "AKIA id",
  "envelope": { "start": 22, "end": 72,
    "reason": "Quoted assignment: key name and enclosing quotes are not secret but redacting them is acceptable." } }
```

The envelope replaces the `contained` / `broader` / "range policy" prose with an
authored, hashed, reviewable statement. It is what finally makes the PostgreSQL
case expressible: `connection-string` fixtures declare the password as the inner
span and the whole URI as the envelope, so a whole-URI finding becomes a normal
pass with measured collateral instead of a footnote explaining why FP+FN does not
mean what it says. Default envelope is the span itself, so migration changes no
outcome until an envelope is deliberately authored.

**Envelope discipline** (non-negotiable, mirrors the ground-truth rule): an
envelope may never be widened in response to a scanner's output, requires a
`reason`, is covered by `corpusHash`, and is listed on the fixture page. A
widened envelope must be reviewable as a policy change, in a diff.

### 2.3 Per-span outcome lattice

For each `secret` span *e* with envelope *E*, against the set of findings *F* on
that file (deduplicated as today):


| Outcome     | Condition                                | Leaked bytes | Collateral bytes          |
| ----------- | ---------------------------------------- | ------------: | -------------------------: |
| `EXACT`     | some *f* = *e*                           | 0            | 0                         |
| `COVERED`   | some *f* ⊇ *e*, *f* ⊆ *E*                | 0            | 0                         |
| `OVERBROAD` | some *f* ⊇ *e*, *f* ⊄ *E*                | 0            | |*f* \ *E*|               |
| `PARTIAL`   | *F* overlaps *e* but no single *f* ⊇ *e* | |*e* \ ∪*F*| | bytes of ∪*F* outside *E* |
| `MISS`      | no *f* overlaps *e*                      | |*e*|        | 0                         |


Coverage is evaluated per finding, not against the union — two findings that
jointly straddle a secret leave it partially redacted in practice, so `PARTIAL`
is correct and the leaked-byte count reflects it.

The lattice is ordered and monotone: nothing can improve by reporting less, and
nothing can improve by reporting more. That property is what v3 lacks.

### 2.4 Headline metrics — three numbers, per (kind × tier)

1. **Leaked span rate** (`must-redact`) = spans with any leaked byte / secret spans.
 Macro over spans, so a 1 700-byte PEM key does not outweigh forty 40-byte tokens.
 *Secondary:* **leaked byte rate** = leaked bytes / secret bytes.
2. **False alarm rate** (`must-not-flag`) = control files with ≥1 finding / control files.
 *Secondary:* mean findings per flagged control.
3. **Collateral ratio** (`must-redact`) = collateral bytes / secret bytes.
 Scale-free; whole-file reporting becomes a large number instead of an asterisk.

`policy` rows report the same three numbers, always under a `policy` heading and
never merged with `must-redact`. T0 stays unscored, verbatim v3 behavior.

Exact-range agreement survives as **diagnostics only**: `diagnostics.exact.{tp,fp,fn}`
per (kind × tier), carrying `"comparable": false`. It is what keeps beta.3/beta.4
regression continuity readable, and it is no longer anything's headline.
`precision`, `recall`, `f1` are **removed from the export**; `reportProblem()`
rejects a v4 report that contains them, the way it now rejects scanner-wide totals.

### 2.5 Twin discrimination — the fix for positive-only precision

The corpus cannot become a representative sample of production credentials, so
precision over it will never mean anything. It *can* become paired. Every T1/T2
`must-redact` fixture should have a negative twin that mutates exactly one
structural property — prefix namespace, body length, alphabet, boundary
character, public-vs-secret prefix — and declares `twinOf: "<fixture-slug>"` plus
`mutation: "length: 35 vs documented 36"`.

**Twin discrimination rate** = pairs where the positive is covered *and* the twin
is clean / total pairs.

This is the one number a `.*`-shaped detector cannot inflate, it is bounded by
construction, and it needs no claim of representativeness — it measures exactly
what it says: can the tool tell these two apart? The beta.4 backlog (#316–#325,
24 families) is already the authoring plan for it; those ten issues become twin
sets rather than loose negatives. Un-twinned positives are reported as a coverage
gap (`twinned: 138/195`), not silently averaged.

### 2.6 Evidence tiers, provider-first

`contracts` entries are restructured:

```json
"github-token": {
  "pattern": "^(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}$",
  "tier": "T1",
  "providerSource": { "url": "https://docs.github.com/…", "observedAt": "2026-09-17", "formatVersion": "2021-04 prefix scheme" },
  "corroboration": [ "trufflehog v3.97.4 github/v2/github.go", "gitleaks v8.30.1 gitleaks.toml" ]
}
```

- `T1` requires `providerSource`. Tool sources move to `corroboration` and are
never sufficient for T1.
- `T2` = no usable provider documentation, but ≥1 tool registration or a
structural argument (malformed-by-construction negatives are naturally T2).
- `T3` = this project's masking policy. Honest and unchanged in meaning.
- `T0` = pending, unscored.

Consequence worth stating plainly: **a format all three tools miss can now be a
scored T1 positive.** That is the point. It also means tier assignment is a
research task with an owner — the 25-family provider pass (§5, phase 5) — and
that some families will legitimately land at T2 with the reason recorded
(Hugging Face alphabet, Vault payload structure, PyPI macaroon serialization).

`observedAt` and `formatVersion` exist because provider formats move. A contract
without a date is a contract that will quietly rot.

### 2.7 One run, one id; baselines instead of hand-written tables

- `npm run bench` writes `public/results/run.json`: `{ runId, startedAt, finishedAt, categories[], scannerVersions{}, lockHash, revision, dirty }`, and stamps `runId` into every category report.
- The overview aggregates **only reports sharing the newest `runId`**; anything else renders as `Partial run — 6 of 10 suites at this runId` with the stale suites named. The current "latest per case, possibly different times" caveat disappears because the condition it describes becomes visible instead of documented.
- `baselines/<version>.json` stores `(fixture, scanner) → outcome` for a released comparison point. The UI derives *changed rows only*; `docs/beta-4-results.md` becomes generated output rather than a maintained table, and D6's hand-maintained drift risk goes away.

---

## 3. Report schema v4 (sketch)

```jsonc
{
  "schemaVersion": 4,
  "runId": "2026-09-17T…Z-1a2b3c",
  "category": "detector-coverage",
  "corpusHash": "…", "lockHash": "…", "revision": "…", "dirty": false,
  "runtime": { "node": "v22.16.0", "platform": "darwin", "arch": "arm64" },
  "matching": "Per-span outcome lattice over UTF-8 [start,end). Envelope-relative coverage. No cross-tier aggregation.",
  "scanners": [{
    "id": "redact-secret", "name": "…", "mode": "npm", "version": "0.1.0-beta.4",
    "status": "complete", "durationMs": 1234,
    "groups": {                                  // key = "<kind>/<tier>"
      "must-redact/T1": {
        "files": 120, "spans": 130, "secretBytes": 6120,
        "outcomes": { "EXACT": 118, "COVERED": 9, "OVERBROAD": 2, "PARTIAL": 1, "MISS": 0 },
        "leakedSpans": 1, "leakedSpanRate": 0.0077,
        "leakedBytes": 12, "leakedByteRate": 0.0020,
        "collateralBytes": 640, "collateralRatio": 0.1046,
        "twins": { "pairs": 96, "discriminated": 94, "rate": 0.9792 },
        "diagnostics": { "exact": { "tp": 118, "fp": 14, "fn": 12 }, "comparable": false }
      },
      "must-not-flag/T2": { "files": 168, "flaggedFiles": 3, "falseAlarmRate": 0.0179, "findings": 4, … },
      "policy/T3": { … },
      "pending/T0": { "files": 36, "scored": false }
    },
    "rows": [{
      "id": "…", "path": "…", "kind": "must-redact", "tier": "T1",
      "expected": [{ "start": 31, "end": 71, "role": "secret", "envelope": { "start": 22, "end": 72 } }],
      "actual":   [{ "start": 22, "end": 72 }],
      "spanOutcomes": ["COVERED"],
      "leakedBytes": 0, "collateralBytes": 0
    }]
  }]
}
```

Invariants `reportProblem()` must re-verify client-side (v3 already does this for
every count — keep that property, it is the best thing about the current design):

- No scanner-wide or cross-group totals. No `precision` / `recall` / `f1` anywhere.
- Every row's `spanOutcomes`, `leakedBytes`, `collateralBytes` recomputable from `expected` + `actual` + fixture bytes; mismatch ⇒ report rejected.
- Group totals equal the sum of their rows; `corpusHash` matches the bundled corpus; `runId` present.
- T0 rows carry no outcome or byte fields.
- `schemaVersion < 4` ⇒ `"Legacy report: rerun npm run bench"` (same treatment v3 gives v1/v2).

---

## 4. What v4 still does not claim

Unchanged and to be restated on `/methodology` in one place instead of per panel:

- Not a representative sample of production credentials; not a product ranking.
- Leaked span rate is **corpus-relative**. It is not accuracy, and cross-tool
comparison is valid only within one (kind × tier) group on one `runId`.
- T1 means *documented lexical/structural shape*, not issuance, checksum
validity, or liveness. No live verification; TruffleHog verification stays off.
- Envelopes and `policy` expectations are this project's redaction policy. A
disagreement there is a policy difference, not a defect.
- Twin discrimination is bounded by which twins have been authored.
- `durationMs` remains diagnostic; not a speed benchmark.

---

## 5. Migration phases

Each phase lands independently and leaves `main` green.

1. **Merge this spec** + a decision record in `docs/decisions/`. No code.
2. **Ground truth migration.** Mechanical `cohort → (kind, tier)` per §2.1; add
 `role: "secret"` to every span; envelope defaults to the span. Assert by test
 that every v4 outcome equals its v3 equivalent — a no-op migration is the
 proof the mapping is faithful.
3. **Scoring.** Lattice + byte accounting in `benchmarks/lib/scoring.mjs`,
 groups in `reporting.mjs`, schema v4 in `run.mjs`, mirrored validation in
 `src/model.mjs`. Reject v3 reports. Unit tests per lattice cell, including
 two-findings-straddling-a-secret and whole-file-finding.
4. **Envelopes where they are already needed:** `connection-string`,
 `otpauth-uri`, `bearer-token`, quoted-assignment generics. These are exactly
 the fixtures whose v3 results need a paragraph to explain.
5. **Provider evidence pass**, 25 families. Assign `tier`, `providerSource`,
 `observedAt`, `formatVersion`; demote what has no provider doc to T2 with a
 reason. Deliverable: a table in `docs/corpus-audit.md` replacing the
 tool-source column.
6. **Twin authoring**, driven by #316–#325. Add `twinOf` / `mutation`; report
 twinned coverage as a gap number until complete.
7. `**runId` + baselines**, then regenerate the release comparison doc from data.
8. **UI rework** against v4 (§7) — it is phase 8 because the new shape is what
 makes compaction possible, not the other way around.

Phases 2–3 are the risky pair: land them together behind the no-op assertion in
phase 2, and keep `diagnostics.exact` so the beta.3 → beta.4 story stays
verifiable across the change.

---

## 6. Rules that get stricter, not looser

- Classification (`kind`, `tier`, spans, envelopes) is authored from input
construction and provider evidence, never from scanner output. Existing rule;
now covers envelopes and twins.
- `classifyFixture()` stays fail-closed: unknown input ⇒ T0.
- Adapters still never consult expected ranges; ambiguous normalization still
fails the scanner rather than guessing. Envelopes make repair *less* tempting,
since a wider-but-acceptable finding no longer needs rescuing.
- A tier upgrade, an envelope widening, and a twin retraction are all corpus
changes: hashed, diffed, and reviewable.

---

## 7. UI compaction — what the density problem actually is

The dashboard is hard to read because **every panel re-states the caveats
inline** (`comparison()` opens with a 50-word notice, then each of four cohort
sections carries a description paragraph and a footnote), and because **four
cohorts × six count columns** are rendered on the overview, every detector page,
and every case page. Smaller type will not fix that; moving the prose out of the
data path will.

v4 enables the following, in rough order of payoff:

1. **Caveats out of the data path.** One persistent one-line reading note
 linking `/methodology`, and a lead sentence per page that states the
 run's outcome before any table ("This run: X left 2 of 42 documented
 secrets readable…"). There is no glossary; each column is named by what it
 measures ("Secrets left readable", "Over-redaction", "Tells fakes apart")
 and its definition lives in the cell tooltip. Exact-range tp/fp/fn is folded
 into the row's provenance. Per-panel notices and footnotes are deleted,
 their content merged into §4 on `/methodology`.
2. **Three sections, not four.** Titled by the question they ask: "Real
 secrets — must be found" (`must-redact`), "Safe values — must stay quiet"
 (`must-not-flag`), "Our redaction policy — tools may differ" (`policy`).
 Tier is a badge spelled out in words ("Provider-documented"); rows are
 shown together by default and a "Split by evidence" toggle regroups them
 per tier. Denominators stay per tier in every case. T0 becomes a link
 ("36 files we haven't verified yet — shown, never scored →"), not a section.
3. **One compact row per scanner**: name+version · files · leaked spans · false
 alarms · collateral · twin rate, with a 5-segment stacked micro-bar for the
 outcome histogram. Counts in `tabular-nums`, monospace reserved for ranges and
 hashes. The bar makes a scanner comparison a glance instead of a read — which
 is only possible because the lattice has five ordered states.
4. **Fixture tables: one glyph per scanner** (`EXACT ■ / COVERED ◩ / OVERBROAD ◫ /  PARTIAL ◪ / MISS □`), with reason text moved into the row's expansion. Today
 each cell renders an outcome span plus two `<small>` lines, three times per
 row, over 549 rows.
5. **Default to signal.** Fixture lists default to *changed since baseline, or
 not clean*; "show all 549" is a toggle. Sticky table header; virtualize or
 paginate above ~200 rows.
6. **Sidebar as search.** 25 detectors + 10 cases in nested `<details>` is taller
 than the viewport; replace with one searchable combobox plus recently viewed.
7. **Density tokens.** 13px base, 8px spacing grid, panel padding 16px (from 36px
 sidebar / large panel padding), line-height 1.45 on prose and 1.25 in tables.
 Do this *last* — it is worth roughly a quarter of the space that steps 1–4 are.

The polling refresh already re-renders `shell()` every 5 s and restores
`

<details class="orca-details">
<summary>` state by index. With fewer disclosure widgets that hack can go; with filters and a baseline toggle it must instead be keyed by a stable id, or user state will keep getting reset.</summary>



</details>

---

## 8. Open questions for review

1. **Envelope granularity.** Per-span (proposed) or per-fixture? Per-span is more
 precise but is more authoring per fixture.
2. **Collateral denominator.** `collateralBytes / secretBytes` (proposed,
 scale-free) or `/ fileBytes` (bounded 0–1, but rewards large files)?
3. **Two findings straddling one secret** are scored `PARTIAL`, treating a secret
 split across two redactions as leaked. Correct for a redaction product;
 arguable for a detector. Confirm.
4. **T2 comparability.** T2 groups may be compared tool-to-tool, but T2 exists
 partly *because* tools disagree. Do we compare within T2 at all, or report it
 as coverage only?
5. `**policy` visibility.** Keep it on the overview at all, or move it behind a
 tab so the overview carries only `must-redact` + `must-not-flag`?

