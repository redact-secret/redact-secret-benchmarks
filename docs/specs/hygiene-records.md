# Decision and report retention

This is the scoped #847/#848 review of the #846 inventory at
`51d59f1bb27d0c2a129899fadd686e248412be82`. It changes navigation and retention
practice, not methodology, scanner selection, authority, owner acceptance or
recorded measurements.

## Current contracts and retained rulings

`docs/decisions/DECISIONS.md` is a small entry index for methodology, governance,
execution and publication. Current detailed rules remain discoverable through
`docs/specs/`, `web/CONVENTIONS.md`, agent guidance and their cited ADRs. An ADR
missing from the entry index is not thereby superseded or removable.

`decisions:validate` still validates every retained ADR's identity, scope, status
and accepted Decision heading. It checks that selected local entry links exist,
refer to decision records and have no duplicates. It no longer requires every
one-off investigation or immutable acceptance receipt in the entry index.

The audit classifies records as current contract entries, retained records
requiring review, retained canonical/historical evidence or explicit historical
migration candidates. No category inferred from age or absent literal callers
authorizes deletion. Dynamic paths and external consumers require review.
The compact per-file review is `results-output/hygiene/records.json`, derived
from the inventory, including hashes and concrete literal readers.

## Reports and generated records

The following are active inputs or provenance, even though their directory says
“generated”: fixture-profile coverage, qualification parity, PII protected
readiness, authority rehearsal, legacy caller inventory and scorer basis.
The report-growth baseline is a retained measurement record, not a disposable
cache. The mixed-parity family ledger and published/candidate diagnostics report
JSON also have consumers in authoring or tests.

Evidence-adoption records name report, comparison, queue, replay and acceptance
files dynamically. Accepted reports feed review disclosure and report freshness
gates. Previous acceptance and deployment identities remain historical evidence.
Keep every named input until its consumer is explicitly migrated; never select
the newest file or regenerate an old report using current pins.

New scratch diagnostics belong under ignored `results-output/` and may be
uploaded as run artifacts. Acceptance packages, official provenance and committed
machine inputs continue to use their existing paths and checks.

## Historical migration checklist

Before each removal, record the owning issue/PR, original status, complete ruling,
full-SHA source permalink, supersession or completed scope, and current contract.
Preserve bytes in the repository's reviewed retention archive with a per-file
SHA-256 manifest, retrieve it and verify the hashes. A permalink alone is not the
preservation receipt. Record the archive location and access verification in the
issue and removal manifest before deleting HEAD files.

The first scoped candidates are the replaced Vite redesign ADR, the completed
five-twin correction ADR (#78), Vite UI verification, and the local exploratory
darwin scope-accounting JSON/Markdown pair. The correction's family-scoped twin
rationale remains in the current negative-twin contract. The local diagnostic
was never an official linux measurement and cannot replace official provenance.
All other records remain retained pending file-level review.

Validate the surviving decision records, adoption/report bindings, public source
checks and the site from a clean checkout. Verify sampled historic archive URLs
and retrieval before declaring #847/#848 complete. No owner decision, frozen
review queue or official run is rewritten by this work.

## Scoped removal manifest

The five records below were verified byte for byte against the pushed preservation
tag `hygiene-before-cleanup-845-20261008` before removal. Their source commit is
`51d59f1bb27d0c2a129899fadd686e248412be82`. The tag keeps the original git objects
reachable; issue records and the separately retrieved archive are also required
before merge. No record with an active input, authority or code reader was removed.
The diagnostic README's brace-path reference was migrated explicitly.

- `docs/decisions/2026-09-19-redesign-benchmark-site.md`: 5559 bytes; SHA-256 `6a60d0cd312780c99cd995ab65e4030ab63aa92b712b54b640d351823e71d469`; owning issue #847; current contract `docs/decisions/2026-09-30-build-the-new-site-as-a-next-static-export-with-mui.md`.
- `docs/decisions/2026-09-21-correct-the-five-twins-553-ruled-untenable.md`: 6789 bytes; SHA-256 `b3b4cd2cc4852d4701e043a6c8fcab1c33e71c84ee862d7727ddc9510593c51a`; owning issue #78; current contract `docs/specs/evaluation-methods/02-negative-twin.md`.
- `docs/generated/evidence-adoption/engine-alpha.11/local-diagnostic.scope-accounting.json`: 73751 bytes; SHA-256 `78b00e2188e9243f16858c47fefca5677c608c072b2e7b8e740233d0002077ba`; owning issue #848; current contract `docs/specs/official-runs.md`.
- `docs/generated/evidence-adoption/engine-alpha.11/local-diagnostic.scope-accounting.md`: 5462 bytes; SHA-256 `772e60ddc43bb059a7cf120dbad91b38ec2963c1d0bcdbb112da1884110af286`; owning issue #848; current contract `docs/specs/official-runs.md`.
- `docs/reports/2026-09-18/evaluation-ui-verification.md`: 2467 bytes; SHA-256 `fe06f48ada883646c8a02fa5c90a8dbe232328c887fe3ed3d1c3910fd160f8c2`; owning issue #848; current contract `web/CONVENTIONS.md`.

Total removed: 5 files, 94,028 bytes. [Archive receipt](https://github.com/redact-secret/redact-secret-benchmarks/releases/tag/hygiene-before-cleanup-845-20261008) was independently retrieved and every file matched both its SHA-256 and its retained Git blob. Complete rulings: [site redesign](https://github.com/redact-secret/redact-secret-benchmarks/issues/847#issuecomment-6068276143), [five-twin correction](https://github.com/redact-secret/redact-secret-benchmarks/issues/78#issuecomment-6068276434). The machine removal manifest is `benchmarks/retention-removals.json`. All other records remain retained pending review.

Historical evidence-adoption acceptance patches retain their original bytes and
context. Replay a historical patch only on its original candidate/base commit,
restoring that tree's exact records and pins first. Applying it to current HEAD
is not a reproduction: the active decision index and other inputs have changed.
Do not regenerate or rewrite an old patch to fit the current tree.
