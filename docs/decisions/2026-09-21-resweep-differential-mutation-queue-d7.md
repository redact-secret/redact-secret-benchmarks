# Re-sweep the differential/mutation review queue against post-D1/D6 content

Date: 2026-09-21 · Status: accepted · Extends: `2026-09-21-settle-mechanical-mutation-review-classes.md` (D2), `2026-09-21-produce-first-four-stable-families.md` (D1)

## Context

[redact-secret#569](https://github.com/redact-secret/redact-secret/issues/569)
("D7") re-measured Epic D at `stable: 1` of 46, far below the `≥17` target,
with `differential.unresolvedContractDisagreements` blocking 15 of 17 T1
families and `mutation.unresolvedCritical` blocking 5 of them. The issue's own
table put the gap at 493 differential + ~126 mutation entries genuinely absent
from `benchmarks/review-ledger.json` (D1 #549 and D6 #554's fixture additions,
never triaged after D2 #63 closed).

## Root cause found during triage: two T1 families' own positive fixtures were malformed

Before triaging the queue, `slack-token`'s and `cloudflare-token`'s
`mutation.unresolvedCritical` counts (18 and 3) turned out not to be
review-queue entries at all, but hard assertion failures: their `shape-1`
`detector-coverage.mjs` fixtures generate a flat, unstructured run after the
prefix, which stopped matching either family's own frozen structural contract
once it was adopted —

- `slack-token`'s `xoxb-`/`xoxp-`/`xapp-`/`xwfp-`/`xoxe-`/`xoxe.xoxb-`/`xoxe.xoxp-`
  shapes needed `-`-separated digit sections (bot/user/rotation grammars,
  `docs/decisions/2026-09-{17,20}-freeze-slack-{bot-token-segment,user-and-rotation-token}-grammar.md`
  in the product repo) or an exact 20-byte tail (#551's boundary fix);
- `cloudflare-token`'s `cfut_` shape was missing its trailing 8-hex checksum
  entirely (`^cfut_[A-Za-z0-9]{40}[a-f0-9]{8}$`, `benchmarks/lib/assessment.ts`).

The same class of defect `docs/audits/evidence/566/README.md` (product repo)
already found for `docker-token`/`cloudflare-token` shape-1: fixtures authored
against an earlier, more permissive contract, never updated when the contract
froze. Corrected in `fixtures/generated/detector-coverage.mjs` (structural
per-prefix generation for `slack-token`, an appended checksum for
`cloudflare-token`); `xapp-`/`xwfp-` and the rest of the corpus are untouched.
This also cleared `slack-token`'s `metamorphic.criticalFailures` (162 → 0) and
`cloudflare-token`'s (27 → 0) as a side effect — the same fixtures were the
metamorphic baseline too.

Editing `detector-coverage.mjs` reshapes that category's `sourceHash`, and
therefore every differential id sourced from it — but only entries that
already have an actual disagreement re-key; empirically, only `slack-token`'s
and `cloudflare-token`'s did (verified by diffing the full pre-/post-fix
queues by content, not just id — zero other families' resolved entries were
affected).

## Scope grew beyond the issue's own T1 table

The fresh queue's 716 entries absent from the ledger split into:

- **390 in the issue's 17 named T1 families** (up from ~493+126 pre-fix, since
  the fixture fix legitimately unlocked new mutation operators and
  differential comparisons for `slack-token`/`cloudflare-token` that a
  malformed fixture never reached).
- **326 across ~26 other families** (`openai-token`, `generic-token`,
  `connection-string`, `vercel-token`, etc.) that were already unresolved
  before this issue's work began — the issue's own table only reported the T1
  subset. Triaged in the same pass to leave the ledger internally consistent,
  per D1's own precedent of retriaging every reshuffled/backlog entry it hit
  rather than only its target families'.

## Mutation side: fully mechanical

All 192 new mutation review-queue entries map onto one of D2's seven
already-decided operator classes (`lexical.invalid-alphabet`,
`lexical.length-minus-one`, `lexical.length-plus-one`, `lexical.prefix-change`,
`lexical.replace-last`, `boundary.remove-delimiter`,
`structural.remove-segment`) — no new operator, no new ADR. Marked
`not-assertable` with D2's verbatim per-class note.

## Differential side: empirical triage, matching D1's method

Every one of the 524 new differential entries was checked against its
fixture's authored `expected` span and the peer's actual observed range
(`benchmarks/engine/runner.ts`'s own scanner output from this run — gitleaks
8.30.1, trufflehog 3.97.4, pinned to `qualification/suite-v1.json`), not
assumed:

- **491** matched an already-established class exactly and mechanically
  (`redact-secret-only|peer-only/<peer>/range-matches-corpus`,
  `range-disagreement/trufflehog/{peer-narrower-boundary,peer-measures-broader-span,peer-deduplicates-repeated-value}`,
  `range-disagreement/gitleaks/peer-measures-narrower-span`,
  `classification-disagreement/trufflehog/documented-composite-mapping`) —
  redact-secret's own finding is byte-exact against the corpus, and the
  disagreement is fully attributable to a peer's own coverage gap, boundary
  choice, deduplication, or composite-secret family split.
- **33** needed individual verification and split into the six template
  classes above (26) plus one new class, introduced here:
  **`twin-boundary-family-reassignment`** (7: `openai-token`'s
  `legacy-{plain,unicode-crlf}-twin` × 2 peers, `sendgrid-token`'s
  `base62-{generic-key,bearer}-twin`). Each is a twin whose authored mutation
  (an internal-marker or one-byte-short-secret change) correctly removes it
  from its own target family's grammar, while redact-secret still redacts the
  value under a different, legitimately-applicable family
  (`generic-token`/`bearer-token`) that this corpus's `expected` field never
  excludes — the same "value owned by a broader independent detector"
  situation `docs/decisions/2026-09-17-freeze-slack-bot-token-segment-grammar.md`
  (product repo) already accepted for Slack's own overlap fixtures, just not
  previously named as its own ledger class.

No corpus ground truth was changed by this pass — only two things moved:
`review-ledger.json` (2,716 entries now: 891 unchanged `resolved`,
524 + 192 = 716 newly `resolved`/`not-assertable`) and
`fixtures/generated/detector-coverage.mjs`'s two malformed shapes.

## Result

`npm run eval:classify` (candidate: product `main`
`34dddb16705a58b449d18c046e0efe479df7dd63`) now reads
`{"stable":15,"provisional":29,"pending":2,"unsupported":0}` of 46, up from
`{"stable":1,"provisional":43,"pending":2,"unsupported":0}`. All 17 T1 families
in #569's table now measure `differential.unresolvedContractDisagreements: 0`
and `mutation.unresolvedCritical: 0`. Pending stayed at exactly
`supabase-token`/`vercel-token` (unaffected, unrelated to this family list) —
no family regressed from provisional to pending.

Two T1 families remain `provisional` for reasons this issue's own text already
flagged as out of scope: `pypi-token` (`twinPairs: 3/5`,
`benign.minimumAxes`/`minimumCases` short — the macaroon-fixture prerequisite
#549 split out) and `digitalocean-token` (`benign.minimumAxes: 1 < 2` — tracked
by `2026-09-21-measure-benign-axis-diversity.md`, unrelated to the
differential/mutation ledger). `slack-token`'s previously-flagged
`metamorphic.criticalFailures` anomaly (162, ~6× the epic's original 27)
resolved to 0 as a side effect of the fixture fix, rather than needing its own
investigation.
