# Data retention for the repository hygiene audit

All benchmark data stays in HEAD in this cleanup. A file being old, generated,
large, or superseded does not clear its reproduction or rollback readers.
This spec records the bounded results of #849 and #850, and the remaining work.

## Retained source and access

`benchmarks/retention-archive.json` records source commit
`51d59f1bb27d0c2a129899fadd686e248412be82`, annotated tag
`hygiene-before-cleanup-845-20261008`, and independent retrieval receipts.
Maintainers retain this tag indefinitely, never move or delete it, and keep its
peeled commit pinned. A GitHub permalink or an expiring Actions artifact alone
is insufficient preservation. This tag keeps already tracked repository bytes;
it does not authorise copying protected holdout, secret, or custodian material.
No new benchmark data payload is uploaded by the audit tools.

Regenerate the exhaustive source inventory and the per-file data disposition
view, including checksums, inferred owners, access classes, known callers,
remaining prerequisites, archive locators, and before/after identities:

```sh
node scripts/retention-inventory.mjs --ref 51d59f1bb27d0c2a129899fadd686e248412be82
node scripts/retained-data-dispositions.mjs
```

Outputs live in ignored `results-output/hygiene/`. The disposition command
checks the current bytes of every retained data file against the source
inventory. It fails on missing files, byte-length changes, or SHA256 drift.
A disposition never approves removal. Inferred ownership is provisional;
scoped review must confirm it before a migration.

## Current disposition

At the retained source, `evidence/` holds 685 files and 193,174,661 bytes,
not the original issue estimate of 678 files. Every one remains present.

- All 11 `baselines/*.json` files (17,444,323 bytes) remain release anchors.
  `scripts/baseline.mjs` reads the entire history for release comparison;
  `benchmarks/candidate.ts` and `web/services/candidate-legacy.ts` select the
  newest saved baseline. Accounting also directly reads the beta.4 baseline.
- All 302 `peer-observations/**` files (9,176,413 bytes) remain replay and
  rollback inputs. `snapshotPath` constructs readers dynamically, and the
  legacy scanner UI enumerates snapshots. The current official scanner page
  uses official provenance, but rollback still needs these files.
- `benchmarks/review-ledger.json` (25,252,354 bytes) remains unchanged.
  Qualification policy identity hashes it; re-key, settlement, queue coverage,
  candidate/acceptance and rollback consumers still read it. Compaction would
  change policy identity even if the human decisions appeared equivalent.
- Benchmark-owned qualification JSON, public report inputs and generated
  indexes remain unchanged while their active or reproduction readers remain.
  Regenerability alone is not proof that a stored identity can be removed.

No denominator, scanner identity, pin, authority, ledger decision, score or
measurement byte changes in this work. The per-file output covers 1,164 data
files and verifies 279,025,738 unchanged bytes at the retained source.

## Provisional cold candidates

These are review leads, not approved deletions:

- `evidence/860/ec9224d/candidate-evidence-v1-labels-af180a5.json` is a
  superseded pre-relabel diagnostic (1,663,484 bytes). The local README still
  links it; indexed code has no matching reader. The product #860 issue is
  closed and its inspected body/comments contain no matching candidate path
  or revisions. That narrow check does not clear other external repository
  references or computed readers, so the payload remains.
- `evidence/286/pii-profile-cost-candidate-v1.json` (1,771,336 bytes) has no
  direct active code reader in the inventory, but the PII gap ledger and
  README still bind its reproduction evidence. Those references block removal.
- `evidence/449/credential-candidate-8b6a5fd-v1.json` (1,687,100 bytes) remains
  a release anchor because `release-source-equivalences-v1.json` and the
  release record bind its historical identity.

External repository pins, complete issue/PR lineage, indirect callers and
access/public-safety review remain prerequisites for migrating these payloads.
No absence from a ranked graph search is treated as exhaustive clearance.

## Verified retrieval

The current canonical official archive was independently downloaded from
release `official-runs-registry-37630100920`. Its 7,894,468-byte asset matched
SHA256 `134034335039cb8a191137ec54a1f8c16e1b1090b2d25bfdf8e3a7f8d9f6f2a9`.
`official-run-archive.mjs fetch` restored four canonical artifact files;
`verify` checked every registry byte digest. Temporary downloads and restored
artifacts were removed. This proves restoration and registry-byte agreement;
it does not claim a new official scanner run or a full engine replay.

The historical document archive `hygiene-records-845.tar.gz` was separately
retrieved from the retained-tag release. Its 17,308 bytes matched SHA256
`54355d69449e623c5c37037d9cabb27037b4a857d1d8bef602ae8190c1192d17`.
The exact five regular payload members and manifest were checked; every
payload matched manifest length/SHA256 and its original pinned Git blob.
The compact archive receipt is committed in `retention-archive.json`.

The deployment bundle retention planner is not a historical archive. It keeps
only current, previous and live bundles, so it cannot replace either retained
Git refs or the canonical official archive.

## Restore a retained file

```sh
node scripts/restore-retained-file.mjs --fetch --file evidence/860/ec9224d/candidate-evidence-v1-labels-af180a5.json
```

The command fetches only the recorded tag from `origin`, checks its tag object
and peeled commit, refuses Git symlinks, verifies the inventory length and
SHA256, and writes exclusively to `results-output/retained/<original-path>`.
It supports retained `docs/` records too. It prints a receipt, never payload
text. Existing destinations, linked output directories and traversal paths
are refused. Remove restored outputs when finished to release disk space.
The candidate file above was retrieved from the pushed tag and verified.

Before any future data removal, independently restore its exact archived
bytes, clear all active/indirect/external readers, preserve issue/PR ownership
and immutable lineage, check public-safety and access conditions, and verify
same-run report, scanner comparison, candidate diff, UI fallback and rollback
with unchanged source data. Unresolved prerequisites leave the payload here.
