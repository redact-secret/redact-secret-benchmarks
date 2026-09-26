# Holdout lifecycle

Holdout belongs in this repository. Its isolation is an execution and
publication boundary, not a requirement to use a different repository or disk.

```text
corpora/development/manifest.json
corpora/regression/manifest.json
holdout/manifest.json
holdout/generated/                 # ignored by Git
```

The development/regression manifests partition the existing fixture catalog.
The existing fixture files and generators remain their source of truth; there
is no second copy of that data. Neither ordinary `npm run eval` nor its case
loader reads the holdout manifest or `holdout/generated/`. `--method=holdout`
is deliberately unavailable in the development command.

## Public controls and protected cases

The checked-in `manifest.json` describes **public conformance controls** generated
by `conformance.ts`. They exercise the sixth method and the isolated lifecycle
from a clean checkout. Their seed and construction are public, so their results
cannot establish independent detector performance. Reports say
`independence: public-control` and make no support claim.

A protected corpus uses the same repository layout. Its manifest contains an
opaque ID, revision, whole-corpus hash, seed commitment, review declaration,
relative generated directory and evaluation budget. Only that metadata is
eligible for Git. Actual fixture bytes, private seeds, lifecycle state and
frozen plans live in `generated/` and must not be staged, logged or uploaded.
The fixture-storage check rejects tracked/staged files there.

Directories holding inputs require mode 0700; input/state/plan files require
0600. Symlinked storage and input files are rejected. These are local filesystem
controls, not a sandbox against code or people already running as the same OS
user. For CI, a custodian must deliver the ignored payload through an
access-controlled workspace; development jobs must not receive it. No scanner
verification or update checks are enabled by this workflow.

## Seal and execute a protected corpus

Author a private JSON object with `schemaVersion: 2`, a private `seed`, and
`fixtures` using the existing fixture/assessment contract. Every expectation
must be reviewed and scored (T1/T2/T3); T0 cases, twins and mutation operators
are excluded. Never use live credentials. Review independence separately:
automated structural validation cannot prove that a developer has never seen a
case or that its expectation received independent human review.

```sh
chmod 600 holdout/generated/reviewed-input.json
npm run eval:holdout -- seal --source=holdout/generated/reviewed-input.json --manifest=holdout/candidate-manifest.json --review=reviewed
npm run eval:holdout -- run --manifest=holdout/candidate-manifest.json
```

Create the ignored `holdout/generated/` directory with mode 0700 before authoring
the input. Sealing never overwrites an existing manifest. It creates an opaque
epoch directory under `generated/`, seals the whole-corpus and seed hashes and
sets a one-attempt budget. The `reviewed` declaration is the custodian's
attestation, not a review performed by the engine. The generated manifest can
replace the public `manifest.json` through normal reviewed changes, or remain a
separately named manifest selected explicitly.

Before reading protected inputs, execution freezes the candidate's installed
`@redact-secret` artifact hash, lockfile hash, engine/source hash, scanner versions
and configurations, run identity and corpus identity. An exclusive lock and
persisted reservation prevent concurrent runs from exceeding the budget. A
failed or interrupted attempt still consumes its reservation. Candidate or
tool/configuration changes invalidate the run rather than being accepted as
the frozen candidate. The internal shared execution core supplies scanning,
assertions and cleanup; holdout lifecycle code supplies access and publication.

`run` emits only a schema-validated aggregate. `--output=<new-file>` writes that
aggregate instead of stdout and refuses to overwrite an existing file.
Incomplete execution or any failed holdout assertion produces a nonzero exit.
Public conformance runs use disposable per-run directories under `generated/`
and can be repeated; protected budgets are never reset automatically.

## Publication boundary

Publish the methodology, public manifest metadata, candidate hashes, plan hash,
run identity, scanner versions/configurations and counts by kind/evidence tier.
Do not publish fixture IDs, per-case hashes, text, labels, expected/observed
ranges, per-case verdicts, private seeds or private source references. Public
schemas reject extra case-level fields, and errors suppress protected details.
The full row report exists only in process memory; no private report is written
alongside the public aggregate. Scratch inputs are removed in `finally`.

Custodians retain private plans, input seeds and aggregates under the epoch
directory for audit. A whole-corpus hash and seed commitment identify the exact
private input without publishing the seed needed to reconstruct it. External
readers cannot independently reproduce a protected run without access; the
public controls provide reproducible engine qualification instead.

## Contamination, crashes and rotation

1. If cases are exposed, used for tuning, or changed without review, mark the
   epoch before another evaluation:
   `npm run eval:holdout -- contaminate --manifest=holdout/candidate-manifest.json --reason=used-for-tuning`.
   Other reason codes are `exposed` and `unreviewed-change`.
2. Treat **all earlier evidence with that corpus hash as invalid for independent
   qualification**. Preserve history; update any support-matrix decision that
   consumed it. `sealed-at-execution` is a historical fact, not proof of current
   uncontaminated status. Consumers must consult the custodian's current ledger.
3. After a crash, verify no process still owns `.lock` before a custodian removes
   the stale lock. Do not remove the reservation or edit an exhausted budget.
   Failed attempts are not free development queries.
4. Promote exposed cases to development/regression only through an explicit
   reviewed change. Never silently move them back into holdout.
5. Independently author/review replacement cases, use a new private seed and
   opaque epoch ID, and seal a **new manifest**. Keep the old manifest and ledger
   for audit. Freeze a new candidate and perform a new qualification run.

## Statistical scorer tuning

Holdout is never a tuning input for the beta.9 statistical scorer. A tuning
manifest names no holdout identity or path and attests `holdoutAccess:
"none"`. Each scoring identity is a new frozen candidate and uses this
budget. A retune prompted by a holdout result is `used-for-tuning`
contamination and must be recorded before the next run. See
[statistical tuning](../docs/specs/statistical-tuning.md).

Gitignore and access modes do not make a public generator an independent
holdout, and consensus between scanners never changes authored expectations.

A custodian-held blind evaluation of exact candidate tarballs, with fixtures
outside every repository, is a separate lifecycle: see
[blind evaluation](../docs/specs/blind-evaluation.md).
