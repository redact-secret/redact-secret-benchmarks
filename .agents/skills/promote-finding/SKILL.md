---
name: promote-finding
description: Drive one benchmarks-to-product finding through the promotion lifecycle — observed, reviewed, promoted — per docs/specs/decisions/2026-09-18-govern-benchmark-promotion.md. Use when asked to promote, review, or advance a known-gap record ("promote product-404", "promote-finding product-404", "review the sendgrid gap"). Stops at the product issue handoff; never authors the product fixture or opens a product-repo PR.
---

# promote-finding

The benchmarks-to-product unit of work: from "the benchmarks observed
something" to "a reviewed promotion record and a product issue ready for that
repo's own `resolve-issue`." Nothing upstream of this skill produces
promotion records — `benchmarks/lib/promotion.ts` only validates them. This
is where they get produced.

## Input

`promote-finding <RECORD_ID>` — the argument is a `benchmarks/known-gaps.json`
`issues[].id` (`$1`), e.g. `product-404`. The record must already exist with
`status: "observed"`. This skill does not create a first-time discovery
record; a finding reaches `observed` before this skill runs (the evaluation
run that produced it already wrote `candidate`, `evidence`, and
`history.observed`).

## What this skill owns

Steps 1–5 below, ending at `status: "promoted"` on the local record and a
product issue carrying the proposed handoff content.

## What this skill does not own

- **Closing gates.** `gates`/`verification` evidence production is a
  separate unit of work; this skill never sets `status` past `promoted`.
- **Copying discovery matrices, generated variants, competitor output,
  holdout material, or raw result bundles** into the product repository.
  Prohibited, full stop — see [Boundary rule](../../../AGENTS.md).
- **Authoring the product fixture and opening the product-repo PR.** That is
  the product repository's own `resolve-issue`, working from the issue this
  skill opens or updates. This skill never writes to
  `redact-secret/redact-secret`'s `conformance/` files and never opens a PR
  there — it stops at the handoff, and the product-side
  `conformance/benchmark-regressions.json` record does not need to exist yet
  for this skill's own exit condition to be satisfied.

## Safety rules

- Never transform, encode, hash, truncate, or snapshot a submitted credential
  value. Discard it and construct a replacement from scratch.
- A credential that may still be live goes into no corpus, issue, or PR. The
  private reporting path in `SECURITY.md` comes first — stop and route there
  instead of promoting.
- Holdout material never enters the promotion path under any circumstances.

## 1. Pin the observation — exit: the triple is reproducible

Read the record:

```bash
python3 -c "
import json
d = json.load(open('benchmarks/known-gaps.json'))
r = next(i for i in d['issues'] if i['id'] == '$1')
print(json.dumps(r, indent=2))
"
```

Confirm the record is at `status: "observed"` — if it is already `reviewed`
or later, this skill has already run for it; report that and stop rather than
re-promoting.

The observation is the triple `(candidate.sourceCommit, benchmark revision,
corpusHash)`. Confirm each leg:

- `candidate.sourceCommit` is a 40-hex product commit (required for this
  triple even though the field is optional pre-`verified` in the schema).
- Every `evidence[].corpusHash` is a 64-hex SHA-256 that
  `scripts/generate-fixtures.mjs --check` / `npm run fixtures:check` still
  recognizes as current for the fixture's category — an observation against a
  corpus hash the checked-in corpus no longer produces is stale, not
  reproducible.
- The evaluation command that produced `evidence[].actual` is nameable:
  `npm run eval:candidate -- --candidate-source-commit <sourceCommit> ...`
  (see `docs/specs/candidate-evaluation.md`) or
  `npm run eval -- --scanner=redact-secret`. Re-run it (or cite the exact
  prior run, `runId` and all) if the actual finding is in doubt.

**Exit condition:** `candidate.sourceCommit` and every `evidence[].corpusHash`
resolve, and the actual/expected pair reproduces under the named command. An
observation that cannot be reproduced is not promoted — stop and leave
`status: "observed"`.

## 2. Confirm expectation independence — exit: the evidence predates or is independent of scanner output

`expectationReview.method` must already be
`"authored-independent-of-scanner-output"` (the schema requires this literal
value). The check that matters is not the field — it is the evidence array:
every URL in `expectationReview.evidence` must document the *expected*
result (a provider's own token-format documentation, an RFC, this repo's
`fixtures/README.md`/`benchmarks/lib/assessment.ts` policy, or an issue
comment written before the scanner ran) — never a link into the same
evaluation run that produced `evidence[].actual`.

This is the step most often skipped. If the only evidence is "the scanner
disagreed with a peer scanner" or "the scanner's own output looked wrong,"
that is review input, not an independently authored expectation — go author
one (or find where it already was) before continuing.

**Exit condition:** every `expectationReview.evidence[]` URL is reachable and
is not the evaluation run itself. Record a `history.reviewed` transition:

```json
{"at": "<YYYY-MM-DD>", "evidence": ["<https url documenting independent review>"]}
```

## 3. Author the minimal product-side case — exit: a from-scratch synthetic reproducer, not a copy

Per `conformance/README.md`'s Regression intake (product repo, read here for
reference — never fetched into a local copy of that corpus):

1. Discard the submitted/observed credential value; retain only a safe
   description of the grammar, boundary, and host context.
2. Construct an unmistakably synthetic or explicitly revoked replacement
   **from scratch**. Do not transform, encode, hash, truncate, or snapshot
   the benchmark fixture's `content` — author new bytes that exercise the
   same boundary.
3. Keep it minimal: the smallest whole-input value that reproduces the
   defect, plus the smallest relevant positive and negative controls, in
   canonical UTF-8 byte ranges (exclusive end, matching this repo's own
   `expected[].start`/`end` convention).
4. Add a matching incremental-corpus case only when chunk boundaries,
   retained state, or finalization can affect the result — most detector
   false-negatives do not need one.

This produces a **draft** canonical fixture object — `id`, `tier:
"regression"`, applicable host contexts, expected ranges, a note describing
the behavior (never the reported plaintext). It is a proposal carried in the
product issue (step 4), not a file written into any checkout of the product
repository — authoring the actual `conformance/fixtures/*.json` entry is the
product repository's own `resolve-issue`.

**Exit condition:** the draft fixture's `input` shares no bytes with the
benchmark fixture's `content`, and its expected range is independently
computed from the drafted `input`, not copied from `evidence[].expected`.

## 4. Open the product issue — exit: `record.url` carries the handoff content

If `record.url` already resolves to a real issue
(`gh issue view <record.number> --repo redact-secret/redact-secret`), reuse
it — do not open a duplicate, and do not reopen a closed one; a comment on a
closed issue is still a legitimate handoff. Only call
`gh issue create --repo redact-secret/redact-secret` when the record has no
tracking issue yet (a fresh, never-filed finding).

The issue body (new or added as a comment) must state, without raw matched
plaintext:

- safe reproduction (fixture id, corpus hash, candidate identity, offsets
  only — matching the observed-evidence shape already in `known-gaps.json`);
- blast radius (which detector/shape, single fixture vs. a family);
- false-positive vs. false-negative direction;
- the proposed canonical fixture id(s) from step 3 and the proposed
  `productManifestRecordId` (step 5) for `conformance/benchmark-regressions.json`.

**Exit condition:** `record.url` is a real, retrievable product issue whose
body or a comment on it names the proposed fixture id(s) and
`productManifestRecordId`.

## 5. Record in both ledgers — exit: `npm test` passes and both ids are cross-referenced

This repository's ledger is the one this skill actually writes. Update
`benchmarks/known-gaps.json`'s record in place:

- `history.reviewed` (from step 2) and `history.promoted` (today, evidence =
  the product issue URL);
- `status: "promoted"`;
- `promotion`:
  ```json
  {
    "productIssue": "<record.url, unchanged>",
    "productManifest": "https://github.com/redact-secret/redact-secret/blob/main/conformance/benchmark-regressions.json",
    "productManifestRecordId": "<proposed id, e.g. benchmark-gap-404>",
    "canonicalFixtureIds": []
  }
  ```
  `canonicalFixtureIds` stays empty here: the canonical fixture is only
  *proposed* (step 3) until the product's own `resolve-issue` authors it into
  `conformance/fixtures/*.json` and fills this array for real — see
  `product-292`'s record for exactly this state (`promoted`/`fixed` with
  `canonicalFixtureIds: []` because no canonical case exists yet).

The product repository's `conformance/benchmark-regressions.json` record —
`{id: productManifestRecordId, benchmarkRecordId: record.id, benchmarkIssue:
".../redact-secret-benchmarks/issues/10", productIssue: record.url,
benchmarkFixtureIds: record.fixtures, corpusHashes: [...], canonicalFixtures:
{synchronous: [], incremental: []}, gates: {both "pending"}}` — is **not**
written by this skill. It is the handoff artifact: the product issue (step 4)
already names both ids, so the product repository's `resolve-issue` can
create that exact record and cross-reference it back with
`benchmarkRecordId`. Writing it here, or opening a PR against
`redact-secret/redact-secret`, would be authoring the product fixture — out
of scope by this skill's own boundary above.

Run the checks that matter for this change:

```bash
rtk npm test                    # tests/promotion.test.mjs must still pass
rtk npm run fixtures:check      # corpus hashes still line up
git diff --exit-code benchmarks/known-gaps.json   # only the intended record changed
```

**Exit condition:** `npm test` passes with the updated record (schema-valid
per `validateKnownGaps`), `record.promotion.productIssue === record.url`, and
`record.promotion.productManifestRecordId` is the same id named in the
product issue from step 4 — the cross-reference exists in both places even
though only one side is committed here.

## Stop

Do not set `status` past `promoted`. Do not write to the product repository's
`conformance/` directory or open a PR there. Do not commit `wip:` here unless
asked — this skill can be invoked mid-`resolve-issue`, where the caller owns
commit timing.
