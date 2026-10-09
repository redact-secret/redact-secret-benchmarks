# PII evidence adoption preparation (#841)

Status: proposal preparation and pure acceptance/history validation are implemented.
The CLI prepares a review package and applies an explicitly supplied external
acceptance with guarded fixed-file updates and rollback on replacement failure.

```sh
node scripts/prepare-pii-evidence-adoption.mjs \
  --preflight path/to/verified-preflight.json \
  --out-dir results-output/pii-evidence-adoption/review-name
```

The command consumes the #837 closed public preflight and #835 role policy. It
creates only a new scratch directory containing `candidate.json`, `summary.md`
and `acceptance-plan.json`. Existing output, unsafe paths, symlink inputs/parents,
duplicate JSON keys and invalid public identities refuse. Invalid inputs are
validated before any output is written. It never fetches, executes a scanner,
dispatches CI or writes a repository pin, run registry, authority or approval.

## Proposal identity and differences

The deterministic candidate digest binds snapshot/release/manifest identity,
verified import population/binding and output digests, consumer/engine contract,
role policy and optional exact scanner identity. There is no floating product
target or generated timestamp. `--scanner FILE` supplies the closed
`pii-evidence-scanner-identity/1` tarball/tree/adapter/configuration/activation
tuple; it proposes an identity and is not package or execution provenance.

`--previous FILE` supplies a previously verified preflight and optional
`--previous-scanner FILE` its scanner tuple. Mapping-loss deltas, independent
accounting counts and added/removed mapped and excluded kinds are reported without modifying
authored evidence. Historical snapshot/import identities are included in the
acceptance plan, which requires retention of prior immutable run records before
any active update. No historical record is deleted or overwritten by preparation.

Identical tuples are only identity-compatible. A proposal always records
`fresh-execution-required`, `reused: false` and zero scanner executions until a
strict #838 receipt validator can establish actual observation provenance.
Changing snapshot, consumer/engine or scanner/configuration/activation identity
does not inherit an earlier receipt. Replay is not fresh execution or extra samples.
All five import-loss classes remain explicit; PHI/context-dependent claims stay
pending until faithfully represented. Each evidence population keeps its own
metric denominator, and the existing four populations are unchanged.

## Maintainer acceptance remains separate

`--acceptance FILE` can carry an independently supplied
`pii-evidence-maintainer-acceptance/1` record. Its fields are `scope`
(`public-evidence-snapshot-adoption`), `candidateDigest`, `acceptedBy`,
`acceptedAt` (UTC ISO seconds) and `source` (a benchmark issue comment URL).
The helper validates its shape, scope and exact candidate binding, not the
authenticity of its claim. It never generates this record or turns it into
`ownerAcceptance`. A reviewer must verify the cited maintainer decision.

Even with that record, `canApply: false` and an unapplied acceptance plan remain.
The separate guarded apply command validates a canonical execution receipt,
the explicit maintainer decision, snapshot/measurement identity and retention of
historical records before changing the dedicated active evidence pin. It must
refuse missing measurement and never infer product support, authority repin or
cost authorisation from snapshot acceptance. Any authority change still needs
its own existing owner authorisation and rehearsal.

Preparation is local and scanner-free. Fresh Linux execution requires its own
concrete cost allowance; neither prior official runs nor a reused proposal grant
another dispatch. A future workflow may call this preparation command, but it
must prepare a candidate only, never accept or dispatch measurement automatically.

## Reviewed candidate consumer runtime

A wider evidence snapshot may need a new consumer mapping before adoption can
be proposed. `benchmarks/pii-evidence/candidate-runtimes.json` is a versioned,
reviewed registry of exact candidate consumer identities, local build receipts
and mapping tables. It does not replace the initial consumer pin or the active
evidence pin. A supplied candidate consumer must match a complete registered
identity, including source/archive/lock/toolchain/helper/shim hashes, mapping
revision, exact local binary hash and build command. Unregistered identities,
edited binaries and new families outside the reviewed table refuse.
Candidate source archive SHA-256 is over `git archive --format=tar HEAD`; the
preflight recomputes it from the clean pinned checkout without downloading or
storing an archive.

```sh
node scripts/preflight-pii-evidence.mjs \
  --source-dir path/to/clean-pii-eval-checkout \
  --consumer-bin path/to/pii-eval-evidence \
  --snapshot-dir path/to/candidate-snapshot \
  --candidate-snapshot-pin path/to/candidate-snapshot-pin.json \
  --candidate-consumer-pin path/to/reviewed-candidate-consumer-pin.json \
  --out path/to/new-preflight.json
```

The candidate receipt describes the actual Darwin source build; it does not
supply a canonical Linux receipt or assert that the historical execution engine
was rebuilt. The immutable initial Linux engine pin and pending Linux consumer
receipt remain explicit. The helper verifies/imports the entire snapshot and
records its exact population, losses and output hashes before preparation.
Changing the consumer runtime does not authorize measurement, active adoption,
product authority or an owner decision.

## Strict acceptance and historical chain validation

`validateActiveEvidenceAdoption` consumes an externally supplied acceptance,
prepared candidate, verified preflight, retained upload bytes and the full #838 comparison input:
`plan`, `receipt`, exact `receiptText`, GitHub `record`, both artifact texts and
`populationIndex`. It requires the default comparison loader to return
`recorded` in `official` mode; exploratory data and record bypass flags refuse.
It binds the verified population, counts, losses, output byte hashes, reviewed
consumer and observed scanner tarball/tree/configuration/activation tuple to the
candidate. Metadata identity compatibility alone cannot satisfy this guard.

`history` is an ordered array of prior `{preflight, candidate, acceptance,
comparison, retainedFiles}` entries. `retainedFiles` is the exact 11-member public
upload byte map: plan, receipt, build receipt, two artifacts and six replay
inputs. Build and replay hashes are rechecked; no replay bytes can be dropped. Every entry receives the same strict receipt and external
acceptance checks. The first entry, or the current candidate when history is
empty, must be the immutable initial release anchor. Each later candidate's
historical identity must exactly bind the preceding entry. Missing anchors,
altered historical records and reused canonical runs refuse. A consecutive core
repin may retain the same snapshot only when the entire preflight is identical,
the core source commit changes, the measurement tuple has never appeared in the
chain, and a fresh canonical run and separately supplied acceptance validate.
Returning to an earlier population after another snapshot still refuses. This
records another measurement of one denominator, never pooled observations or a
product support promotion.

The returned validated record retains all prior identity, acceptance and
measurement digests. It has `activeWritesApplied: false`, `authorityChanged:
false`, `supportClaims: false` and `qualified: false`. The external acceptance
record remains a maintainer-supplied trust boundary; the helper validates its
binding and does not authenticate a GitHub commenter or manufacture a decision.
The guarded apply command retains this complete chain before an active snapshot
update. Preparation itself applies no repository updates.

## Prepare a reversible accepted update

```sh
node scripts/prepare-pii-evidence-adoption.mjs \
  --validate-adoption path/to/externally-accepted-bundle.json \
  --cost-decision path/to/approved-exact-cost-decision.json \
  --out-dir results-output/pii-evidence-adoption/accepted-release
```

The bundle has exact fields `policy`, `snapshotPin`, `consumerPin`, `preflight`,
`candidate`, `acceptance`, `history`, `comparison` and `retainedFiles`, using the
strict input shapes above. Proposal metadata inputs are bounded regular files of
at most 2 MiB; an accepted evidence/history bundle is at most 32 MiB.
The command refuses missing measurement or acceptance before output creation.
It writes only a new scratch directory:

- `validated-adoption.json`: validated acceptance and measurement bindings.
- `proposed-active.json`: proposed snapshot, consumer and preflight records.
- `proposed-history.json`: complete prior and current records, including exact
  receipt text, both public artifacts, build receipt and all six replay inputs,
  not only their digests.
- `rollback.json`: the preceding accepted snapshot/consumer/preflight and history,
  or the unchanged initial records for a first adoption.
- `apply-plan.json`: unapplied target paths and review prerequisites.
- `review-package.json`: when `--cost-decision` is supplied, the validated bundle,
  unchanged external cost record and SHA-256 preimages of every fixed target.

The rollback describes the validated history, not the current working tree.
Before applying the local proposal, a maintainer must authenticate the external
acceptance, compare the actual active files to the expected prior records and
retain the complete history. Existing output refuses overwrite. The preparation command does
not write active pins, generate an approval, launch measurement or alter any of
the existing four populations. Future release identity comes from CLI records,
without editing the initial archive constants; changing the reviewed importer,
engine or product pair still requires a separate compatibility/cost review.

## Apply the reviewed package

```sh
node scripts/prepare-pii-evidence-adoption.mjs \
  --apply-adoption results-output/pii-evidence-adoption/accepted-release/review-package.json
node scripts/preflight-pii-evidence.mjs --check
```

The review package contains `schema: pii-evidence-adoption-review-package/1`,
`bundle`, `costDecision` and `expectedPriorSha256`. Preparation derives the
preimage map from the current repository, without hand-editing target files.
Every existing target requires its exact prior byte hash; a missing target uses
`null`. There are exactly 19 fixed targets: three evidence pins/preflight,
`adoption.json`, `history.json`, all eleven retained comparison upload members,
comparison record, population index and the supplied cost decision. The command
cannot target authority, qualification criteria or the four existing population
pins. It preserves the initial immutable anchor and complete accepted history.

Apply validates the strict canonical comparison, external acceptance, exact
approved cost scope/digest, current role policy, unchanged four-population pins,
actual active predecessor and existing historical prefix before writes. Stale
preimages, missing acceptance/measurement, malformed history or symlink targets
and parents refuse. An exclusive lock prevents two cooperating apply commands.
All replacement and original bytes are staged before the first replacement;
each individual rename is atomic. A replacement failure restores the original
bytes and modes and removes newly created files. This is not a globally atomic
multi-file update. An interrupted process leaves the lock and transaction
backups for reviewed recovery; the active source check rejects partial state.
If rollback itself fails, the backups remain rather than being silently deleted.

The future-active preflight gate reads `adoption.json`, reruns the complete
strict acceptance/history validation and checks every active target byte against
that record. A future pin without this validated chain refuses. Initial candidate
pins continue to use the exact immutable initial contract. Applying a new release
uses CLI records, not edits to those initial archive constants.

Approval authenticity remains an external review responsibility. These commands
never generate an approval or infer one from a matching name or URL. Supplying an
externally authenticated acceptance is the explicit apply authorization; a public
measurement cost approval alone does not authorize evidence adoption. The command
records the supplied decision unchanged and creates no authority owner decision.

Receipt reuse remains conservatively unavailable: proposal preparation always
requires fresh execution. A complete strict canonical receipt can satisfy the
accepted-update validator but never supplies a new dispatch allowance. The applied records still require ordinary source gates and a reviewed repository
commit before publication. Applying them launches no scanner or CI workflow.
