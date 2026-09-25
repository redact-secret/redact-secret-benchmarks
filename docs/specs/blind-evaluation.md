# Custodian-held blind evaluation

Issue: [#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142),
part of [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138).
Decision: [`2026-09-25-run-blind-evaluation-through-an-isolated-custodian-agent.md`](../decisions/2026-09-25-run-blind-evaluation-through-an-isolated-custodian-agent.md).
Code: `benchmarks/blind/` (library), `benchmarks/blind.ts` (CLI, `npm run blind:run`),
`scripts/check-blind-public.mjs` (`npm run blind:check-public`),
`schemas/blind-aggregate-v1.json`. Tests: `tests/blind-evaluation.test.mjs`.
Report template: [`blind-evaluation-report-template.md`](blind-evaluation-report-template.md).

A blind evaluation measures one exact, frozen product candidate against
fixtures that nobody who implements or tunes a detector has seen. The
fixtures and their expected results never enter a Git repository. Only a
whitelisted aggregate leaves the custodian.

## 1. Where it sits

| Evidence | Who authors it | Where the fixtures live | What is published |
| --- | --- | --- | --- |
| Maintainer regression | maintainers | this repository | everything |
| Externally authored public adversarial ([`adversarial/`](../../adversarial/README.md)) | an outside author | this repository | everything, plus the frozen first run |
| Protected holdout ([`holdout/`](../../holdout/README.md)) | a custodian | ignored `holdout/generated/` in a checkout | aggregate counts |
| **Custodian-held blind (this spec)** | an isolated custodian agent | a private directory outside every repository | the aggregate in §7 |

Blind results are reported on their own. They are never added to, averaged
with or ranked against public qualification, the support matrix or the
adversarial first runs. The `evidenceClass` of every blind aggregate is
`custodian-blind`.

The in-repo holdout lifecycle stays as it is. The blind runner differs in
three ways: its fixtures live outside every Git work tree, it evaluates the
exact `benchmark:candidate` tarballs rather than the installed dependency,
and it releases leak, false-alarm, instability and interval figures rather
than pass/fail counts.

## 2. Roles and responsibilities

| Role | Is | May | Must not |
| --- | --- | --- | --- |
| **Custodian** | a separate agent session started only for this job, with no product-implementation task in its context | author and hold the fixtures and expected results; run the safety review; freeze and run the candidate; decide what to release | see or join product-implementation work between authoring and the run; take instructions to change fixtures from anyone who has seen a result; release anything outside §7 |
| **Maintainer** | the human operator and the product-side agents acting for them | build and name the candidate; receive the released aggregate; decide what to do about it in the product | read, request or infer raw fixtures, expected ranges, fixture paths, per-fixture outcomes or the private ledger |
| **Product-implementing agents** | any session that edits detectors, rules, scoring or tests in the product | read the released aggregate after the run | see the private root, a fixture, or a custodian transcript |
| **Orchestrator** | the session that dispatches work, including this repository's issue work | start the custodian session with a brief that names no fixture content; relay the released aggregate | read or relay fixture content, custodian transcripts or the private root |

The custodian model from #142, as rules the runner enforces where it can:

1. **Freeze before the run.** `blind:run -- freeze` records the candidate
   artifact hashes, adapter configuration and replay count, the benchmark
   commit and lockfile, the Node.js version, OS and architecture, and the
   corpus commitment. `run` refuses if any of them differ, and checks the
   tarballs again after scanning.
2. **A new product change needs a new candidate identity and a new run.** A
   candidate identity (the façade tarball SHA-256) gets one run per epoch,
   and the attempt is spent at reservation, so a crash still counts. The
   same identity cannot be frozen again on that epoch.
3. **Optional later disclosure.** The custodian may move selected
   *synthetic* fixtures into public regression coverage (§5, step 9). They
   leave the blind set for good and are replaced under a new epoch.

## 3. What independence this achieves, and what it does not

The same human operates the custodian and the maintainer roles. The
separation is procedural: different agent sessions with different contexts,
a private directory the product sessions are never pointed at, and a runner
that only releases aggregates.

It **does** achieve:

- fixtures that no product-implementing agent or orchestrator saw before the
  run, so nothing was tuned against them;
- expected results written from how each value was constructed, before any
  scanner ran;
- one frozen candidate, evaluated once per epoch, with any later change
  arriving as a new, separately identified run.

It **does not** achieve:

- **organisational independence.** One person can read the private
  directory. The separation holds only as long as that person keeps it;
- protection against a custodian who shares its authors' blind spots. The
  custodian agent and the product agents may be the same model family, so
  both can miss the same class of input;
- external reproducibility. Nobody outside can rerun a blind epoch; the
  commitment only proves the corpus did not change after the run;
- a sandbox. Directory modes are local filesystem controls, not isolation
  from code or people running as the same OS user.

Every aggregate carries this in `independence` (`achieved:
procedural-separation`, `organisationalIndependence: false`, and a fixed
statement), and the schema rejects any other value. A report must repeat it
and must not call a blind result independent without that qualification.

## 4. Private root

The private root is `redact-secret-blind-fixture`, a sibling of the
benchmark checkout: `<checkout root>/../redact-secret-blind-fixture`. The
runner resolves that from `git rev-parse --show-toplevel` when `--fixtures`
is omitted. The canonical instance is

```text
/Users/minhokang/Work/ops/utilities/redact-secret-blind-fixture
```

beside the main checkout `/Users/minhokang/Work/ops/utilities/redact-secret-benchmarks`.
From a worktree elsewhere (for example under `~/orca/workspaces`), the default
resolves beside that worktree instead, so pass the canonical path with
`--fixtures`. The directory is mode 0700 and is never a Git repository, and
never pushed, synced or copied anywhere.

```text
<private-root>/                   0700, real directory, no .git anywhere above it
  fixtures.json                   0600  authored by the custodian
  freeze.json                     0600  written by `freeze`, consumed by `run`
  ledger.json                     0600  written by the runner: epochs and runs
  runs/<run-id>/freeze.json       0600  the consumed freeze
  runs/<run-id>/aggregate.json    0600  the private copy of the released aggregate
  scratch-*/                      0700  fixture bytes during a run; removed in finally
```

The runner refuses a relative path, a symlink, a mode other than 0700, a
private file readable by group or others, a path inside the benchmark
checkout, or a directory with a `.git` entry at or above it. Never commit, upload, paste into an issue, or attach any file
from this directory other than a released aggregate.

### `fixtures.json`

```json
{
  "schemaVersion": 1,
  "corpusType": "blind-custodian-fixtures",
  "epoch": "beta9-e1",
  "nonce": "<64 lowercase hex characters from a CSPRNG>",
  "custodian": { "role": "isolated-custodian-agent", "session": "<opaque session label>" },
  "safetyReview": {
    "status": "passed",
    "reviewedAt": "<ISO 8601>",
    "credentialStatuses": ["synthetic"],
    "statement": "<what was checked, in words>"
  },
  "fixtures": [
    { "id": "<[A-Za-z0-9._-]{1,80}>", "path": "<safe relative path>", "content": "<text>",
      "kind": "must-redact", "expected": [{ "start": 0, "end": 0, "envelope": { "start": 0, "end": 0 } }],
      "credentialStatus": "synthetic", "stratum": "<optional [a-z0-9-] label>" },
    { "id": "…", "path": "…", "content": "…", "kind": "must-not-flag", "expected": [], "credentialStatus": "synthetic" }
  ]
}
```

- `expected` ranges are UTF-8 **byte** offsets, `[start, end)`, the same
  convention as the rest of the benchmark. `envelope` is optional and marks
  a wider range whose redaction is still acceptable (measurement v4).
- `must-redact` needs at least one range; `must-not-flag` needs none.
- `stratum` is the one custodian-authored string that can be released. Use
  a coarse label such as a family id or threat category, never text that
  hints at a fixture's content.
- Unknown fields are rejected, so a `seed`, `source` or `notes` field cannot
  be added and later leak.
- The `nonce` keeps the published commitment unguessable for a small corpus.

## 5. Custodian procedure

1. **Start clean.** Open a new agent session whose brief names the job and
   this spec, and nothing about current detector weaknesses, failing issues
   or product code. Don't open the product repository's detector source.
2. **Create the private root**:
   `mkdir -m 700 /Users/minhokang/Work/ops/utilities/redact-secret-blind-fixture`,
   then confirm `git -C <root> rev-parse` fails. Never run `git init` there.
3. **Author fixtures** in `fixtures.json` (mode 0600). Build every
   credential-like value from randomness under a prefix or shape you
   document, and write each expected range from how you built the value.
   Never run any scanner, including redact-secret, Gitleaks or TruffleHog,
   while authoring.
4. **Safety review.** Check every value against these rules and record the
   result in `safetyReview`:
   - every value is `synthetic`, or `revoked` with the revocation confirmed
     by the issuer. `live`, real-derived (a real value with characters
     changed) and unknown-provenance material is removed, not relabelled;
   - no value was copied from a log, a paste site, a breach corpus or a real
     repository;
   - no fixture carries personal data about a real person;
   - `credentialStatuses` lists every status used. The runner rejects a
     fixture whose status the review does not cover.
   Prefer synthetic values. A revoked value can never be disclosed (step 9),
   because public intake rejects revoked credentials.
5. **Receive the candidate.** The maintainer builds the frozen beta.9
   candidate with the product skill `benchmark-candidate`
   (`npm run benchmark:candidate -- --benchmark-ref <40-hex>`) from a clean
   product commit, and hands over the output directory path. That directory
   holds `candidate-evidence-v1.json` and `artifacts/*.tgz`. Check
   `candidate.sourceState` is `clean`.
6. **Freeze.** In a clean checkout of this repository at the benchmark
   commit you mean to use:
   `npm run blind:run -- freeze --fixtures <private-root> --candidate <candidate-dir>`
   (`--fixtures` may be omitted in the main checkout).
   Nothing about the candidate, the checkout, Node.js or the fixtures may
   change between freeze and run.
7. **Run once.**
   `npm run blind:run -- run --fixtures <private-root> --candidate <candidate-dir>`.
   The released aggregate lands in the checkout's git-ignored
   `results-output/blind/blind-aggregate-<run-id>.json` (or `--output`).
   Exit 0 means `complete`; exit 1 means `incomplete` or rejected. An
   incomplete run is still the run for that candidate and epoch.
8. **Release.** Read the aggregate yourself before handing it over. It must
   contain only the fields in §7. Give the maintainer that file and nothing
   else: no transcript, no example, no hint about which fixture
   failed. The maintainer commits it next to a report written from the
   [template](blind-evaluation-report-template.md), and
   `npm run blind:check-public` validates it in CI.
9. **Disclose and rotate (optional, after release).** To make a finding
   reproducible, pick synthetic fixtures to disclose, submit them through
   public regression or the adversarial intake as maintainer-authored, and
   remove them from `fixtures.json`. Author replacements, write a fresh
   `nonce`, and set a new `epoch`. The runner refuses changed fixtures under
   the old epoch and refuses the old fixtures under a new epoch. The next
   blind run needs a new freeze.
10. **Contamination.** If fixture content reaches any product session, an
    issue, a log or a repository, the epoch is spent: say so in the next
    report, retire it, and rotate as in step 9. Never rerun an exposed epoch
    as blind evidence.

## 6. Runner

```sh
npm run blind:run -- freeze --candidate <abs candidate dir> [--fixtures <abs private root>]
npm run blind:run -- run    --candidate <abs candidate dir> [--fixtures <abs private root>] [--output <abs new file>]
```

`--fixtures` defaults to `<checkout root>/../redact-secret-blind-fixture`.
The release defaults to `results-output/blind/blind-aggregate-<run-id>.json`,
which is git-ignored; `--output` names a new file instead. Neither may point
inside the private root.

`freeze` validates the corpus and the candidate, then refuses a dirty
benchmark checkout, a pending freeze, a candidate identity already run on
this epoch, changed fixtures under an existing epoch label, and the same
fixtures under a new label.

`run`:

1. rechecks everything `freeze` recorded, then takes an exclusive lock;
2. reserves the attempt in the ledger and moves the freeze into
   `runs/<run-id>/`, so a crash still consumes it;
3. writes the fixtures into a 0700 scratch directory inside the private root
   and installs the tarballs into an isolated consumer
   (`scanners/candidate.mjs`, the same install as `eval:candidate`);
4. scans each fixture `replays` times (`qualification/suite-v1.json`
   accounting, 2 today). A fixture whose findings differ between replays is
   withheld as `unstable-across-replays` and never re-rolled; a fixture that
   throws is withheld as `scan-error`;
5. scores each measurable fixture with the measurement-v4 lattice
   (`benchmarks/lib/lattice.ts`): `PARTIAL` and `MISS` are leaked spans, and
   any finding on a `must-not-flag` fixture is a false alarm;
6. re-hashes the tarballs, builds the aggregate, validates it against the
   schema and the consistency rules, and rejects it if any string equals a
   fixture id or path or contains a credential-shaped content token;
7. writes the private copy, then the release (new file only), updates the
   ledger, and removes the scratch directory and the installed candidate.

stdout carries the aggregate; stderr carries only a rejection code. No error
message quotes a path, id, range or value.

## 7. What may be released

`schemas/blind-aggregate-v1.json` is a whitelist. Every object forbids extra
fields.

| Field | Content |
| --- | --- |
| `evidenceClass`, `independence` | fixed: `custodian-blind`, `procedural-separation`, `organisationalIndependence: false` and the §3 statement |
| `candidate` | product source commit, package name, declared version, façade SHA-256, all three artifact SHA-256s, configuration hash |
| `benchmark`, `environment`, `freeze` | benchmark commit and lockfile SHA-256; Node.js, OS, arch; freeze id, time and hash |
| `corpus` | epoch label, commitment (SHA-256 over the nonce and fixtures), fixture count |
| `measurability` | fixtures, measurable, measurable share, withheld, and withheld counts by reason |
| `instability` | fixtures withheld as unstable, with a Wilson 95% interval |
| `leakage` | positive fixtures, spans, leaked spans with a Wilson 95% interval, and the count of each lattice outcome |
| `falseAlarms` | controls, and flagged controls with a Wilson 95% interval |
| `strata` | per-label counts, only for labels with at least 5 measurable fixtures. If the suppressed remainder is between 1 and 4 fixtures, every stratum is withheld, so none can be recovered by subtraction |
| `uncertainty` | method and the fixed statement that intervals describe authored cases, not a real-world rate |
| `failures` | phase and code only |

Never released: fixture text, ids, paths, expected or observed ranges,
per-fixture outcomes, which fixture was unstable or withheld, the nonce, the
fixtures digest, the ledger, the custodian transcript, or any scanner
output. There is no overall score, rank, F1, precision or recall field, and
the schema rejects one.

## 8. Public-surface check

`npm run blind:check-public` runs in CI after the build. It fails when any
tracked file, or any file under `public/` or `dist/`, carries a blind corpus,
freeze or ledger (by its JSON type marker), or carries a blind aggregate that
is not a standalone JSON document passing the §7 whitelist. It also fails if
`results-output/blind/` stops being git-ignored. This spec is the one file
allowed to show the markers, because it documents the formats.

## 9. Limits and follow-ups

- The runner cannot tell whether a value is synthetic; the safety review is
  the custodian's attestation.
- The runner measures the redact-secret candidate only. Peer scanners are
  out of scope for blind runs, so there is nothing to rank against.
- Wilson intervals treat fixtures as independent draws. Authored fixtures
  are not, so read the intervals as a floor on uncertainty.
- `evidence:query` does not list released blind aggregates yet. Add that
  when phase B commits the first one.
