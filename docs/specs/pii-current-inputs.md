# Current PII input boundaries

`benchmarks/inputs/pii/current-inputs-index.json` binds four named roles to original
source commits and file digests, and separately binds each projected payload digest.
Self-hashing a changed payload does not change its reviewed index entry.

- `gap-policy.json` contains the active authored axes and exact release artifact identities
  used by fixture generators. Historical blocker states are not current support decisions.
- `fixture-corrections.json` contains the three reviewed corrections used by current generators.
  Original source locators and digests remain in frozen plan identities.
- `product-bindings.json` names the current baseline and candidate source/core identities.
  No historical activation trio matches either product, so its bindings are empty.
  Publication reports activation as not measured until a matching repository-sanctioned
  receipt is explicitly reviewed into this registry. Directory discovery is not a binding.
- `protected-route.json` contains the minimal aggregate custody, public gates, accepted cost
  cells and display metrics needed by the reviewed protected route. Its original report,
  freeze, seal, trust and accepted-ledger commitments remain distinct from its projection digest.
  Publication re-derives the protected disposition and validates the unchanged acceptance ledger.
  The protected route does not establish activation for a later product build.

The protected projection is 343243 bytes instead of 2416151 bytes across its 21 original
inputs. Aggregate custody fields are required for seal/trust validation; the accepted
regression cells are required to reproduce cost coverage; reviewed metrics are required
for the published page. Raw protected inputs are not read by this boundary.

## Prepare and explicitly promote an input

Restore the verified original archive and the original source tree first. Preparation
validates every required original byte against its preserved source commit, validates the
full original route, and verifies that the projected disposition and accepted cost are identical.
It writes a fresh ignored output only:

```sh
node --import tsx scripts/prepare-pii-protected-current-input.mjs \
  --source-root=/path/to/restored-original-tree \
  --source-commit=65ffe7dcb3e7124e7f66cff96cab814f0365f69a \
  --output=results-output/pii-input-preparation/reviewed/protected-route.json
```

An explicitly requested promotion can populate an absent canonical role from that prepared
receipt. It revalidates the independent index and full original inputs, publishes exclusively,
and refuses an existing accepted input. It writes neither owner acceptance nor the index:

```sh
node --import tsx scripts/prepare-pii-protected-current-input.mjs \
  --source-root=/path/to/restored-original-tree \
  --source-commit=65ffe7dcb3e7124e7f66cff96cab814f0365f69a \
  --prepared=results-output/pii-input-preparation/reviewed/protected-route.json \
  --promote=benchmarks/inputs/pii/protected-route.json
```

A replacement needs a separately reviewed index change and source proof; this command cannot
replace the existing accepted role. Fresh measurement and prepared freezes do not create owner approval.

## Historical replay

`pii:ledger:check` validates the current policy by default. To audit an archived full ledger,
pass both `--archived-ledger=<restored JSON>` and `--source-root=<original source checkout>`.
Release-record historical source-equivalence replay uses explicit
`--source-equivalence-root=<verified restored archive>` and checks the original full-suite
candidate commitments. It does not silently substitute a current scanner build for an old run.

Historical integration tests use `HYGIENE_EVIDENCE_ARCHIVE_ROOT` and, when source-byte drift
checks are needed, `HYGIENE_ORIGINAL_SOURCE_ROOT`. Current schema, semantic, tamper and
publication-boundary tests run without historical payloads at HEAD.
