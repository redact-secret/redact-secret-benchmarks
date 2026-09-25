# External adversarial fixture intake

How adversarial fixtures written outside this project enter the benchmark,
and how they stay apart from maintainer-authored regression coverage and
from protected holdout evidence. The decision record is
[`docs/decisions/2026-09-22-define-external-adversarial-intake.md`](../docs/decisions/2026-09-22-define-external-adversarial-intake.md);
the tracking issue is
[#139](https://github.com/redact-secret/redact-secret-benchmarks/issues/139)
(epic [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138)).

```text
adversarial/packs/<pack-id>/intake.json      the intake record (schemas/adversarial-intake-v1.json)
adversarial/packs/<pack-id>/first-run.json   the frozen first run (schemas/adversarial-first-run-v1.json)
adversarial/samples/synthetic-sample/        a documentation sample; never counted as evidence
```

`npm run adversarial:check` validates every pack, runs the sample's
rejection cases, checks that no frozen first run changed since `origin/main`,
and checks that the site never calls project-authored evidence independent.
`npm run evidence:query -- --class=<class>` lists one evidence class.

## Lifecycle

```text
submitted -> safety-review -> frozen-first-run -> accepted
    |              |                 |-> rejected (with reason)
    |              |                 '-> converted-to-maintainer-regression
    '-> rejected   '-> rejected          (also reachable from accepted)
```

Every transition is a `history` entry with a time and an actor. `rejected`
and `converted-to-maintainer-regression` are terminal. A pack is evidence only
once it is `accepted` (or `converted`, as maintainer regression).

## What a submitter provides

A pack is one `intake.json`. Copy
[`samples/synthetic-sample/intake.json`](samples/synthetic-sample/intake.json)
and replace every field. Every field is required unless marked otherwise.

| Field | What it records |
| --- | --- |
| `author.attribution`, `attributionKind` | Your name, organization, custodian role, or a **durable pseudonym** you will keep using. |
| `author.affiliation` | `external`, `project-maintainer` or `project-contributor`. Only `external` can qualify as externally authored. |
| `author.contact` | A durable handle such as `github:<login>` through which the attribution can be re-verified. No private email addresses. |
| `implementationExposure` | Whether you read the detector implementation (source, rules, tests) before authoring, and what you read. Reading it does not disqualify a pack; it is published beside every result. |
| `provenance.credentialStatus`, `construction` | Must be `synthetic`, plus how every credential-like value was made. |
| `fixtures[]` | `id`, `path`, `content`, `action` (`must-redact` / `must-not-flag`), `expected` UTF-8 byte ranges `[start, end)`, `threatCategories`, per-fixture `credentialStatus`, and a `rationale`. |
| `threatCategories` | Every category any fixture covers, and no other. |
| `expectations.authoring` | How you derived each range and action without running a scanner. |
| `expectations.scannerOutputConsulted` | Must be `false`. |
| `expectations.digest` | `expectationsDigest(fixtures)` from `benchmarks/lib/adversarial-intake.ts`, computed before any scanner runs. |
| `license` | SPDX identifier, `redistribution: true`, and the grant in words. |
| `submittedAt`, `history[0]` | The submission time; the first history entry is `submitted` at that time. |

Maintainers add `safetyReview`, `firstRun`, later `history` entries,
`maintainerEdits`, and `rejection` when rejecting.

### Credential material

Only synthetic values are accepted. Live, revoked, real-derived (a real
value with characters changed) and unknown-provenance material is a
rejection ground at pack or fixture level — revoked credentials are still
real credentials. Use prefixes and bodies no provider issues. Do not submit a
pack that ever contained a real credential, even if you replaced it; open an
issue describing the shape instead.

### Expected results

Expected ranges and actions are authored from how each value was constructed,
never from any evaluated scanner's output (redact-secret, Gitleaks,
TruffleHog, flare-redact or any other). The digest committed at
`submittedAt` is copied into the first run, so expectations provably existed
before any scanner ran on the pack. A pack whose author consulted scanner
output is rejected with `scanner-derived-expectations`.

## What maintainers do

1. **Safety review.** Move the pack to `safety-review`, confirm every value is
   synthetic and the license permits redistribution, and record
   `safetyReview` (`passed` or `failed`). A failed review, or any rejection
   ground the validator reports, ends in `rejected` with that reason.
2. **Freeze the first run.** Run every evaluated scanner once over the pack
   as submitted and write `first-run.json`: the benchmark commit, each
   scanner's name, version, configuration and `sha256:` artifact digest, the
   pack's `expectationsDigest`, and each fixture × scanner result as ranges
   only — no matched values, no raw scanner output. Pin its SHA-256 in
   `intake.firstRun` and move to `frozen-first-run`.
3. **Accept or reject.** `accepted` requires the passed safety review and the
   first run. `rejected` requires `rejection.reason` and `detail`.

The first run is immutable. Later scanner fixes, reruns and comparisons are
recorded elsewhere (a report under `docs/reports/` or evidence under
`evidence/`) and never rewrite `first-run.json`; `adversarial:check` fails if
a frozen first run changed or disappeared since `origin/main`.

### Maintainer edits

Every edit after intake is a `maintainerEdits` entry. An edit is **material**
when it changes fixture content, an expected range or an expected action.
A material edit removes the `externally-authored` qualification: the pack
becomes `converted-to-maintainer-regression` and is reported as maintainer
regression from then on. Correcting a typo in a rationale is not material.
When a submitted expectation looks wrong, prefer asking the author for a new
pack over editing theirs.

## Evidence classes and wording

| Class | Source | May be called independent |
| --- | --- | --- |
| `maintainer-regression` | `corpora/regression/manifest.json`, maintainer-affiliated packs, converted packs | never |
| `public-adversarial` | accepted, `externally-authored` packs | no — call it "externally authored" |
| `protected-holdout` | `holdout/*manifest.json` with `purpose: "protected"` (metadata only) | yes |
| `custodian-blind` | aggregates released by an isolated custodian agent ([blind evaluation](../docs/specs/blind-evaluation.md)) | no — say "procedural separation, not organisational independence" |

The public holdout conformance controls belong to no class; they qualify the
engine, not the detectors. Classes are never merged into one count.
Project-authored evidence is never described as independent anywhere in the
site or a report; `adversarial:check` scans the rendered site for unnegated
"independent" wording.

## The synthetic sample

[`samples/synthetic-sample/`](samples/synthetic-sample/) is written by the
maintainers to document the format. It is `sample: true`, maintainer
affiliated, and its first run names a placeholder scanner — no scanner was
run. [`rejections.json`](samples/synthetic-sample/rejections.json) mutates it
in memory to exercise each rejection path: live, revoked, real-derived and
unknown credential material; scanner-consulted expectations; an expectation
changed after the first run; a rewritten first run; a first run before
submission; a maintainer claiming external authorship; a material edit left
`accepted`; and a converted pack still claiming external authorship. Two
cases must validate: the pack re-attributed to an external author, and a
live-credential pack correctly rejected.
