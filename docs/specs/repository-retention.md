# Repository retention and hygiene

Current contract for #845 and #846–#854. Repository hygiene measures ownership,
readers and retained bytes. It does not change qualification authority or scores.

## Inventory before removal

`node scripts/retention-inventory.mjs` writes the full JSON dependency inventory
and Markdown view to ignored `results-output/hygiene/`. It inventories every
tracked file, with separate summaries for docs, evidence, scripts, benchmarks,
baselines, peer-observations, src, web and other paths. All tracked text is scanned, including workflows, npm commands,
tests, relative imports, directory/glob prefixes and literal pins. Pass
`--references <json>` with records `{path, text}` to include inspected GitHub
issue/PR bodies or other repositories' pin records. Those records are local
audit input, never a substitute for an external consumer review.

Every row carries byte size, SHA256, class, inferred owner, callers, authority
role, proposed disposition, access class and blocking prerequisites. An inferred
owner is not an owner acceptance. Static edges may overestimate reachability;
computed readers and external references remain explicitly unresolved.

`node scripts/retention-inventory.mjs --dry-run --manifest <json>` reports exact
removal paths, total bytes and transitive callers without mutating files. A
manifest has `entries` with `path`, `sha256`, `owner`, `issue`, scoped `review`
records for `dynamicReaders`, `externalReferences`, `authorityGates`, and
`preservation` containing `ref`, `sha256`, `verifiedAt`. Active callers outside
the removal set, stale hashes or missing review/preservation block the plan.
Only conservative directory/basename matches may be excluded by an exact
`review.excludedCallers` record with `path`, `via` and a scoped reason. Real
imports and literal readers cannot be overridden. Retained transitive active
callers also block removal. This is a planning validator; retrieval proofs must be independently checked.
Without a manifest the dry-run proposes zero removals.

## What stays authoritative

Keep current policy/configuration, owner decisions, official run registry and
pins, accepted provenance receipts, active release baselines, peer snapshots and
the qualification ledger. Generated does not mean disposable. Historical
reports must be restored byte-for-byte, never regenerated with current pins.
Credential and PII evaluator exit, rollback and owner-authorisation gates are
independent. Retiring the old published UI does not retire shared models,
tokens or oracle tests. See the records, data-retention and legacy-CI companion
documents for file-level dispositions and preconditions.

## Durable history and private boundaries

The annotated retained tag `hygiene-before-cleanup-845-20261008` anchors full
commit `51d59f1bb27d0c2a129899fadd686e248412be82`. Keep it advertised on origin;
never move, force-update or delete it as routine branch cleanup. Each migrated
path also needs a digest, owning issue record and tested restore operation.
Official run release archives and their registry digests remain canonical,
independent of this retained Git ref. Short-lived Actions artifacts and dangling
commit links alone are insufficient. Public metadata is not public-safety
approval for payload bytes. Protected holdout, private custodian files and raw
secret material never migrate into public archives or issue bodies.

## Prevention

`node scripts/check-repository-hygiene.mjs` runs in the existing source-validation
job, with no extra CI job. `benchmarks/retention-policy.json` records the existing
retained-path baseline and explicit large-file limits. New evidence/reports/
generated files require an exact-path exception or belong in ignored
`results-output/`. New scripts need a caller or a documented manual entrypoint;
workflow script invocations must exist. Tracked build/scratch outputs fail.
Workflow parsing respects package working directories and explicit checkouts;
dynamic shell paths and computed npm calls still need scoped review.

Exceptions require an exact path, owner, rationale, linked issue, ISO expiry and
positive maximum bytes. Expired, duplicate or missing-path exceptions fail.
Existing inputs are grandfathered for retention, not declared disposable;
large payload limits allow 5% growth from the inspected baseline. Review any
growth beyond that limit explicitly. Do not add broad ignores over canonical
tracked inputs. Retention removal does not rewrite published Git history or
reduce historical clone size.

## Foundation evidence

At `51d59f1b`, the complete tree contains 3,589 files / 335,200,899 bytes;
the eight scoped surfaces contain 3,084 files / 329,066,322 bytes.
The foundation adds read-only tools and synthetic indirect/computed-reader
tests; no data or authority changes. Later audit JSON and Markdown are generated
locally so the cleanup does not add another large committed snapshot.
