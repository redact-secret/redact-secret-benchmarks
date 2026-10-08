# PII evidence adoption preparation (#841)

Status: proposal preparation and pure acceptance/history validation are implemented.
The CLI produces reversible local proposed updates; applying them to active
repository files remains a separate reviewed operation.

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
The separate future accept command must validate a canonical execution receipt,
the explicit maintainer decision, snapshot/measurement identity and retention of
historical records before changing the dedicated active evidence pin. It must
refuse missing measurement and never infer product support, authority repin or
cost authorisation from snapshot acceptance. Any authority change still needs
its own existing owner authorisation and rehearsal.

Preparation is local and scanner-free. Fresh Linux execution requires its own
concrete cost allowance; neither prior official runs nor a reused proposal grant
another dispatch. A future workflow may call this preparation command, but it
must prepare a candidate only, never accept or dispatch measurement automatically.

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
duplicated snapshot identities and altered historical records refuse.

The returned validated record retains all prior identity, acceptance and
measurement digests. It has `activeWritesApplied: false`, `authorityChanged:
false`, `supportClaims: false` and `qualified: false`. The external acceptance
record remains a maintainer-supplied trust boundary; the helper validates its
binding and does not authenticate a GitHub commenter or manufacture a decision.
The separate reviewed active update must retain this complete chain before an
active snapshot update. No preparation command applies it.

## Prepare a reversible accepted update

```sh
node scripts/prepare-pii-evidence-adoption.mjs \
  --validate-adoption path/to/externally-accepted-bundle.json \
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

The rollback describes the validated history, not the current working tree.
Before applying the local proposal, a maintainer must authenticate the external
acceptance, compare the actual active files to the expected prior records and
retain the complete history. Existing output refuses overwrite. The CLI does
not write active pins, generate an approval, launch measurement or alter any of
the existing four populations. Future release identity comes from CLI records,
without editing the initial archive constants; changing the reviewed importer,
engine or product pair still requires a separate compatibility/cost review.

Receipt reuse remains conservatively unavailable: proposal preparation always
requires fresh execution. A complete strict canonical receipt can satisfy the
accepted-update validator but never supplies a new dispatch allowance. The
remaining lifecycle operation is applying the reviewed proposed files and
retained history through the separately authorised repository change.
