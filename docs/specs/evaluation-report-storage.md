# Evaluation report storage

Status: contract for #786 (workstream 1 of epic #785). Implemented by #787 (discovery store) and #788 (public bundle); consumed by #789 to #791.
Decision record: [`docs/decisions/2026-10-06-store-evaluation-reports-as-bounded-parts-behind-a-manifest.md`](../decisions/2026-10-06-store-evaluation-reports-as-bounded-parts-behind-a-manifest.md).
Measurements: [`docs/generated/evaluation-report-baseline.json`](../generated/evaluation-report-baseline.json), written by `node --import tsx scripts/measure-report-growth.ts --out=docs/generated/evaluation-report-baseline.json`. The script reads retained files only and runs no scanner.

This is a storage and presentation contract. It does not change the credential-eval RunArtifact, `qualification-v1.json`, the adoption comparison, the scoring or accounting identity (evaluation-public schema 2, accounting 1.1), the public allowlist, the roster or any ledger decision. [Boundary rule](../../AGENTS.md#boundary-rule): this repository measures and records; a stored report asserts nothing.

## 1. What the large file is

Measured on the retained local discovery run (Node v22.16.0, V8 12.4.254.21-node.26, darwin arm64):

| Artifact | Contract | Bytes | MB / MiB | UTF-16 length | Share of V8 string limit (536,870,888) |
| --- | --- | ---: | ---: | ---: | ---: |
| `results-output/evaluation.json` | discovery source, pretty-printed (2 spaces) | 420,169,790 | 420.17 / 400.71 | 419,813,243 | 78.2% |
| same data, compact JSON | (a temporary option, not a fix) | n/a | n/a | 256,189,572 | 47.7% |
| `public/results/evaluation-v1.json` | public projection, compact | 76,513,429 | 76.51 / 72.97 | 76,513,424 | 14.3% |
| `public/results/review-ledger-v2.json` | observed review ledger, compact | 26,937,085 | 26.94 / 25.69 | 26,881,355 | 5.0% |
| `results-output/qualification/engine-v1.json` | qualification aggregate, pretty | 1,457,553 | 1.46 / 1.39 | 1,457,553 | 0.3% |

The reported ~420 MB file is the **discovery source** (`results-output/evaluation.json`), not the public projection, the ledger or the qualification artifact. The 311.9 MB Next export and the 461 MB assembled site of staging run 37513643096 are site totals; they are not report sizes and are not measured here.

Runtime limits (recorded in the baseline): V8 maximum string 536,870,888 characters; heap limit 4,345,298,944 bytes. `readFile(..., 'utf8')` of the discovery file plus `JSON.parse` peaks at 2.17 GB RSS, and parse, compact stringify, pretty stringify and the whole-report projection in one process peak at 3.07 GB RSS (a process high-water mark; see `memoryNote` in the baseline). Parse 0.84 s, compact stringify 0.47 s, pretty stringify 1.32 s, whole-report projection 10.4 s on this machine (one observation, not a gate).

### Contributions (compact UTF-16 characters, 20,009 cases, 52,075 variants)

Discovery: `results` 209,340,985 (81.7% of the compact total), `failures` 30,779,658 (58,037 records, 12.0%), `reviewQueue` 14,684,409 (17,027 records, 5.7%), header fields 1,384,482 (0.5%; `byDetector` 1,212,880 of it). Inside `results`: `scanners` 103.7M (49.5%), `variants` 43.9M, `provenance` 20.2M, `generation` 17.5M, `queue` 10.1M, `observations` 3.8M, `comparisons` 2.4M. By method: metamorphic 86.2M, mutation 70.9M, differential 30.8M, twin 12.1M, benign 9.3M.

Public: `cases` 71,842,170 (assertions 34.7M, findings 14.6M, variants 10.2M, generation 4.4M, comparisons 2.4M; 272,684 assertions, 182,608 findings, 19,269 comparisons), `reviews` 3,668,927, everything else (the summary: provenance, scanners, operator totals, review state, qualification) 1,002,306, of which the qualification aggregate is 919,937.

Largest single records (these decide the oversized-record policy): discovery result 33,825, failure 650, review-queue entry 1,873; public case 12,999, public review 270 characters.

### Growth model

The discovery file costs 20,981 characters per case (8,062 per variant) pretty, 12,804 compact. Linear extrapolation from this one run (a measurement of today's ratio, not a forecast): the pretty single string reaches the V8 limit at about 25,588 cases (1.28 times the present 20,009), the compact one at about 41,930 (2.10 times), the public single file (3,824 per case) at about 140,396. Whole-document serialization of the discovery report is therefore the bottleneck. The public file has headroom, but its parse (0.46 s, 185 MB heap) and its delivery to every page are the next cost, and a single file cannot be fetched per method.

**Compact JSON is a measured temporary option.** It removes 39% of the discovery bytes and buys 1.64 times in cases, which delays the limit and does not remove it: the reader and writer still hold one string whose size is proportional to the corpus. It is not the structural fix and is not adopted.

## 2. Contracts

Three storage contracts, versioned independently of the scoring and accounting identity:

| Contract | Schema id | Location | Writer | Readers |
| --- | --- | --- | --- | --- |
| Discovery store | `redact-secret/evaluation-discovery-store/v1` | `results-output/evaluation/` (gitignored) | #787 `writeDiscoveryStore` | #787 `openDiscovery` |
| Public bundle manifest | `redact-secret/evaluation-bundle/v1` | `public/results/evaluation-bundles/<bundleId>/manifest.json` | #788 `BundleWriter` + `commitBundle` | #788 `validateBundle`, #789, #790 |
| Bundle pointer | `redact-secret/evaluation-bundle-pointer/v1` | `public/results/evaluation-bundle-v1.json` (mutable) | #788 `commitBundle` | `resolveBundle` |

Code: `benchmarks/evaluation/storage/{parts,discovery-store}.ts`, `benchmarks/evaluation/bundle/bundle.ts`.

### 2.1 Parts

Every stored unit is a part: a file of at most `maxPartBytes` bytes (default 8 MiB = 8,388,608, recorded in the manifest) with a manifest entry `{ path, sha256, bytes, records, oversized? }`. The SHA-256 is over the exact bytes of the file. A reader checks size and digest before it trusts a byte, and the record count after parsing. A part is read once into memory (documents) or streamed (JSON Lines) and dropped; no reader holds two parts. A part path is a manifest-relative plain path: `[A-Za-z0-9][A-Za-z0-9._-]*` segments joined by `/`, no `.`/`..` segment, no leading `/`, no empty segment, no backslash.

### 2.2 Discovery store (#787)

```
results-output/evaluation/
  header.json                 every field of the discovery report except the three lists (one JSON document)
  results-0000.jsonl ...      results[], one compact JSON record per line, in run order
  failures-0000.jsonl ...     failures[]
  review-queue-0000.jsonl ... reviewQueue[]
  manifest.json               written last: the completion marker
```

`manifest.json`: `{ schema, storageVersion: 1, maxPartBytes, header: PartRef, parts: { results[], failures[], reviewQueue[] }, totals: { results, failures, reviewQueue }, maxChunkBytes }`. Order is the order of the lists in the discovery report; nothing is sorted, sampled, truncated or deduplicated. `totals` equal the sum of `records` per list; a part listed twice, a part over the limit that is not a single `oversized` record, or totals that disagree are refused (`discoveryManifestProblem`). `maxChunkBytes` is the largest single write, recorded as evidence that no unit except an oversized record exceeded the limit.

Writing: records are appended to a part until the next record would pass the limit, then the part is sealed (hashing as it writes, honouring backpressure: `write()` returning false awaits `drain`; a stream error surfaces at the next append or at close). Everything is written into a sibling staging directory `<store>.<runId>.staging`; only after `manifest.json` exists is the staging directory renamed into place (an existing store is moved aside first and removed after). An interrupted write leaves no `manifest.json`, so a reader refuses it, and the staging directory is removed on failure. Readers: `openDiscovery(location)` returns `{ kind, header(), results(), failures(), reviewQueue(), totals }`; a directory is the store, a regular file is the **legacy single-file report** read whole by the documented legacy path (§6). `materializeDiscovery` rebuilds the whole report for tests and small selections; it is not for the large path.

### 2.3 Public bundle (#788)

```
public/results/evaluation-bundles/<bundleId>/
  manifest.json
  summary.json                the public report without cases and reviews (one document)
  cases/<method>-0000.json    public cases of one method, in discovery order, contiguous parts
  reviews/reviews-0000.json   public reviews, in discovery order
public/results/evaluation-bundle-v1.json   the pointer
```

Part documents are compact JSON plus a newline with an envelope: `{ schema: 'redact-secret/evaluation-bundle-part/v1', role: 'cases'|'reviews'|'summary', runId, casesHash, [method], [index], cases[] | reviews[] | report }`. The record schemas are the **existing public allowlist** (`schemas/evaluation-public-v1.json`, `additionalProperties: false`); nothing outside it is written, and the bundle never carries a raw discovery record.

Manifest: `{ schema, storageVersion: 1, report: { schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false }, bundleId, runId, startedAt, finishedAt, casesHash, maxPartBytes, summary: PartRef, totals: { cases, variants, assertions: Counts, reviews, byMethod }, cases: CasePartRef[], reviews: ReviewPartRef[] }`. A case part ref adds `method`, `index`, `firstId`, `lastId`; a review part ref adds `index`, `firstId`, `lastId`. `report` is the scoring and accounting identity of what is stored and is **not** the storage version.

Pointer: `{ schema, bundleId, runId, finishedAt, manifest: { path: 'evaluation-bundles/<bundleId>/manifest.json', sha256, bytes } }`. The pointer is the only mutable file; it names the manifest by path and by the SHA-256 of the manifest file. `bundleId` is the first 32 hex characters of SHA-256 over the canonical JSON of the summary digest and the ordered `[path, sha256]` pairs of the case and review parts, so the id is a function of content: the same parts give the same id, and a different run gives a different one.

Public paths (decided for the later workstreams): the credential domain descriptor's `evaluation.href` is `/results/evaluation-bundles/<bundleId>/manifest.json` (already `credentialBundleHref` in `benchmarks/shared/evaluation-domains-v2.ts`, pattern `^/results/evaluation-bundles/[a-f0-9]{32}/manifest\.json$` in `schemas/evaluation-domains-v2.json`) and its `artifactCommitment` is the SHA-256 of that manifest file (the same value as `pointer.manifest.sha256`). The mutable pointer `/results/evaluation-bundle-v1.json` is how a consumer that has no descriptor finds the current bundle. The old URL `/results/evaluation-v1.json` is never reused for a manifest and never claims a schema it does not have.

### 2.4 Deterministic grouping and order

- Case parts group by method in the canonical order `twin, benign, metamorphic, mutation, differential` (`CASE_METHODS`; `holdout` is never a public method). Within a method, cases keep discovery order and are cut into parts greedily: the next case closes the part when it would pass the budget. Part index per method is contiguous from 0; the manifest lists parts in canonical method order then index.
- Reviews keep discovery order and are cut the same way into `reviews-NNNN.json`.
- The old `evaluation-v1.json` lists cases in discovery order. Grouping by method keeps each method's cases in that order; a reader that needs the old whole-file order must not assume methods were contiguous in it, so the equivalence check (§8) compares per method, in canonical method order, not by whole-file position.
- The bundle writer reserves the envelope: the budget for records in a part is `maxPartBytes` minus the byte size of the widest envelope, so a part never exceeds the limit unless it is one oversized record.

### 2.5 Byte limits and their justification

| Unit | Limit | Basis |
| --- | --- | --- |
| Detail part (discovery JSONL, public cases, public reviews) | `maxPartBytes`, default 8 MiB, recorded in the manifest | see below |
| `summary.json` | at most 4 MiB, regardless of `maxPartBytes`; larger than `maxPartBytes` only as an `oversized` single record | measured 1,002,306 characters, 919,937 of them the qualification aggregate |
| Manifest | 4 MiB read cap (discovery store 1 MiB) | measured 12 parts: a few KB; grows with part count, not case count per part |

8 MiB is a chosen operating point; it is not an expansion factor over any measured size. The baseline bounds it from both sides. It must be large enough that oversized parts are a guard and not a regular path: the largest record observed is 33,825 characters (0.4% of 8 MiB), so a part holds at least 248 of the largest records and the oversized path was not exercised by the real run. It must be small enough that one part is a negligible fraction of what V8 can hold, and that a reader's memory does not scale with the corpus: 8 MiB is 1.56% of the string limit, against 78.2% for today's discovery file. At this limit the present corpus is 11 public case parts and 1 review part (each 8 MiB or less; whole-bundle validation took about 0.45 s), and the compact discovery lists come to about 25 + 4 + 2 parts (209.3M, 30.8M, 14.7M characters divided by 8 MiB; an estimate from the baseline, not a measurement of a store). `maxPartBytes` is data in the manifest, so a change re-keys the bundle id and needs no code change; the value is revisited by measurement, not by a multiplier.

### 2.6 Oversized single records

A record larger than the budget is never cut, split, summarised or dropped. It is written alone in its own part, marked `oversized: true` with `records: 1`. The manifest check refuses a part over the limit that is not exactly one oversized record, and an `oversized` flag with more than one record. A reader accepts an oversized part only because the manifest says so, and still checks its size and digest first; its memory is that one record. This keeps every case, variant, assertion and review occurrence while keeping every unit independently readable.

### 2.7 IDs, duplicates and references

- Case ids are unique across the whole bundle (not per part, not per method); review ids are unique across the whole bundle. A case id must match `^[a-z0-9-]+$`; `sourceSlug` must match `^[a-z0-9-]+--[a-z0-9-]+$`. A case lives in the part of its own method.
- Variant ids are unique within a case; every assertion, finding and comparison names a variant of its case; `baseline` names a variant of its case when set.
- A review names an existing case and one of its variants; a mutation review names a `review-required` variant and carries no peer or disagreement; a differential review names a peer and a disagreement that a `complete` comparison of that case states.
- A part's first and last id equal the manifest's `firstId`/`lastId`; its record count equals `records`; its `runId` and `casesHash` equal the manifest's.
- The validator keeps one small entry per case (method, source slug) and per review (case, variant) while streaming; this id index is the only state proportional to the corpus, and it is not the report.

### 2.8 Digest scope

Per part, SHA-256 of the exact file bytes. The manifest commits to every part; `bundleId` commits to the summary and every detail part (path and digest). The pointer commits to the manifest file bytes (digest and size). `artifactCommitment` of the domain descriptor is the manifest file digest. Nothing else is digested: the storage digests do not replace the report's own identity fields (`runId`, `provenance.casesHash`, `corpusHashes`, scanner `configurationHash`, observation digests), which are stored unchanged.

### 2.9 Completeness checks (what "complete" means)

A bundle is complete only when `validateBundle` passes; the publisher runs it on the bundle it just wrote before the pointer moves, and every consumer that reads the pointer re-checks what it reads.

1. Manifest: supported schema and storage version, the stored report identity equals `{2, '1.1', 'evaluation-public', false}`, valid bundle id, safe unique part paths, contiguous method and review indexes, no empty part, part sizes within the limit (or a single oversized record), bundle id recomputed from the parts.
2. Summary part: public summary schema, run and provenance equal the manifest's, at least one scanner, unique scanner ids, every scanner has an observation (a `snapshot` observation has both digests, a `fresh` one none), non-empty corpus hashes, `finishedAt` not before `startedAt`, corpus hashes equal the checkout's when the caller supplies them (`Stale evaluation: fixture corpus changed`), a qualification aggregate carries `supportClaims: false`.
3. Each case part: digest, size, record count, public case schema (closed allowlist), run binding, method and index, first/last id; each case passes `checkPublicCase` (scanner ids exist, a scanner that did not complete measured nothing and says `not-measured` on every variant, a T0 or `review-required` variant is never scored, differential cases carry no assertions, generation and finding rows are well formed).
4. Each review part: the same envelope checks, public review schema, `checkPublicReview` against the case it names.
5. Reconciliation: the review counts in the summary add up to the reviews present; `byOperator` equals the operator evidence re-derived from the cases; the manifest totals (cases, variants, assertion counts, reviews, per method) equal the totals re-derived from the details.
6. Publication additionally binds the observed ledger (`public/results/review-ledger-v2.json`) to the same run before the pointer moves; a mismatch publishes nothing as complete and leaves the previous pointer. A partial bundle (no `manifest.json`) is never resolved. No `lastSeen` or resolution evidence is fabricated.

T0 pending, zero-finding and unavailable-scanner cases keep their own statuses end to end: pending is `review-required`, unavailable is `not-measured` with `flagged: null`, zero findings is `count: 0, flagged: false`.

## 3. Storage version versus scoring identity

`storageVersion` and the schema ids in §2 version the layout (parts, manifest, pointer, paths, digests). The scoring and accounting identity is `manifest.report` and the stored summary (`schemaVersion: 2`, `accountingVersion: '1.1'`, `reportType: 'evaluation-public'`, plus the domain identity `credential` / `evaluation-v1` / `credential-v4` in discovery). A storage change may re-key part digests and the bundle id; it must not change a case, a variant, an assertion, a review occurrence, a denominator or a scanner identity, and the equivalence checks (§8) prove it. A scoring or accounting change is a different version of the stored report and needs its own bundle schema revision and ADR; the validator refuses a bundle whose `report` identity it does not know.

## 4. Caller inventory and ownership

Inventory method: `git grep` over all tracked files for `evaluation-v1.json`, `results-output/evaluation`, `EvaluationReport`, `publicEvaluation`, `loadEvaluation`, `evaluationProblem`, `runEvaluation`, `evaluation-types`, `evaluation-model` and `review-ledger-v2` (also `evaluation-bundle`, `eval:publish`, `eval:discover`), then reading each hit. The GitHub search findings of the epic were only the starting point. Documentation-only mentions (ADRs, reports, evidence READMEs) are listed once at the end and need no owner. "Reads the file" means it reads an artifact from disk or the network; "imports" means it uses the types or functions in memory and needs no change for storage.

| Caller | Kind | What it does | Owner |
| --- | --- | --- | --- |
| `benchmarks/evaluate.ts` (`eval:discover`, `npm run eval`) | writer | runs the evaluation and writes the discovery report; now writes the sharded store, `--output=*.json` writes the legacy single file | #787 |
| `benchmarks/evaluation/storage/{parts,discovery-store}.ts` | library | the store writer and reader | #787 |
| `benchmarks/evaluation/domains/credential/{runner,execution}.ts`, `substrate/{orchestration,result-assembly,runtime}.ts` | producer | `runEvaluation`/`executeEvaluation` return the whole assembled report in memory | #787 (retention, §7) |
| `benchmarks/classify-support.ts`, `benchmarks/qualify.ts`, `scripts/rekey-review-ledger.ts`, `scripts/check-review-queue-coverage.mjs` | imports `runEvaluation` | consume the in-memory report and never read `evaluation.json` | none (must keep the return shape; #787 tests this) |
| `benchmarks/support/evidence.ts`, `benchmarks/qualification/ledger-rekey.ts`, `benchmarks/lib/review-queue-handoff.ts` | types/handoff | the `reviewQueue`/`axesByDetector` shape of `runEvaluation`; the handoff is its own file | none |
| `scripts/accounting-dry-run.ts` (`eval:dry-run`) | reads the file | header `byMethod` and the review-queue total only; now through `openDiscovery` | #787 (done) |
| `scripts/publish-evaluation.ts` (`eval:publish`) | reader and writer | discovery to bundle; `--legacy-v1` writes the old whole file | #788 |
| `benchmarks/evaluation/domains/credential/public-report.ts` (`publicEvaluation`, projections), `contract.ts` (`reporting.publicEvaluation`) | library | the one discovery-to-public boundary, now split into per-record projections | #788 |
| `benchmarks/shared/evaluation-model.ts` (`evaluationProblem`, `checkPublicCase`, `checkPublicReview`, `ledgerViewOf*`, `reviewLedgerPublicationProblem`), `evaluation-types.ts`, `schemas/evaluation-public-v1.json`, `schemas/review-ledger-v2.json` | library/schema | whole-report validator (kept) and the shared per-record rules | #788 |
| `benchmarks/evaluation/bundle/bundle.ts`, `scripts/verify-evaluation-bundle.ts` | library, CLI | the bundle writer, validator and the legacy-equivalence verifier | #788 |
| `scripts/check-review-ledger.mjs` (`ledger:provenance:check`) | reads the source ledger | reads `benchmarks/review-ledger.json` and `reviewClasses`; not the published ledger | none |
| `web/services/evaluation.ts`, `web/resolvers/{evaluation-pages,evaluation-methods,evaluation-hub,evaluation-copy}.ts`, `web/components/evaluation/{hub,methods}/storyData.ts`, `web/CONVENTIONS.md`, `web/tests/unit/evaluation*.ts(x)`, `web/tests/unit/legacy-imports.test.ts` | reads the public report | the Next pages load `evaluation-v1.json` today; they must read the pointer, the summary and one method's parts | #789 |
| `web/resolvers/rc.ts`, `web/services/candidate.ts` | imports `evaluation-model` | candidate/change rows only, not the evaluation report | none (`legacy-imports` keeps them as `replace`) |
| `src/main.ts` (`needsEvaluation`, `text('/results/evaluation-v1.json')`, `reviewLedgerPublicationProblem`), `src/pages/workbench/*.ts`, `src/evaluation-{model,types}.ts` | legacy Vite oracle | reads the whole `evaluation-v1.json` and `review-ledger-v2.json` in the browser | #791 keeps it fed (legacy file or an explicit retirement, §6); no change to the oracle |
| `scripts/publish-evaluation-domains.ts` (`eval:publish:domains`) | reads the public report | validates `public/results/evaluation-v1.json` with `evaluationProblem` and writes the domain index | #790 |
| `scripts/publish-pii-support.ts` (`eval:publish:pii-support`) | reads the public report | validates the credential evaluation (`--evaluation=` is already refused as legacy; `--credential-results=`) | #790 |
| `benchmarks/shared/evaluation-domains.ts`, `evaluation-domains-v2.ts`, `schemas/evaluation-domains-v2.json`, `src/evaluation-domains.ts` | descriptors | credential `evaluation.href`; v1 keeps `/results/evaluation-v1.json`, v2 takes the bundle href and `artifactCommitment` | #790 |
| `tests/evaluation-domains.test.mjs`, `tests/pii-support-v2.test.mjs`, `tests/support-ui.test.mjs`, `tests/accounting-domains.test.mjs` | tests of the above | assert the descriptor href and the profile id `evaluation-v1` | #790 |
| `tests/evaluation-ui.test.mjs`, `tests/workbench-model.test.mjs`, `tests/evaluation-engine.test.mjs`, `tests/evaluation-methods.test.mjs`, `tests/accounting.test.mjs`, `tests/holdout.test.mjs`, `tests/provenance.test.mjs`, `tests/review-queue-handoff.test.mjs`, `tests/legacy-callers.test.mjs`, `tests/peer-observations.test.mjs` | tests | in-memory `runEvaluation`/`publicEvaluation`/`evaluationProblem` and the profile id | #788 (keep green; `publicEvaluation` stays) |
| `scripts/produce-release-record.mjs`, `scripts/produce-beta10-release-record.mjs`, `tests/release-record.test.mjs`, `tests/produce-beta10-release-record.test.mjs`, `tests/pii-accounting.test.mjs` | profile id | `evaluation-v1` is a credential **profile identity**, not a file path | none (the profile id is not renamed) |
| `.github/workflows/publish-site.yml` (staging and production publish, `eval:publish`, `eval:qualify`, the ledger-history `curl` of `review-ledger-v2.json`, the qualification summary `jq` of `evaluation-v1.json` fields at line 495) | workflow | writes and deploys `public/results`, reads the previous ledger from the live origin | #791 |
| `.github/workflows/legacy-oracle.yml`, `.github/workflows/validate.yml` | workflow | run `eval:discover` then `eval:publish` for the oracle build and the legacy Vite check; they need the old file, so `eval:publish -- --legacy-v1` | #791 |
| `scripts/assemble-site.mjs`, `scripts/check-blind-public.mjs`, `scripts/check-feature-dataset-exclusion.mjs` | assembly and public guards | copy `public/results` into `dist/results` and apply public-text content rules; they must cover bundle parts | #791 |
| `.gitignore` | ignore | ignores `evaluation-bundles/`, the pointer and bundle staging (added) | #791 |
| `redact-secret/redact-secret-sites`, `docs/upstream/redact-secret-benchmarks--publish-site.yml` | sites mirror | byte copy of `publish-site.yml` (`eval:publish`, `review-ledger-v2.json` history `curl` at lines 274 to 278, `eval:publish:domains`, `eval:publish:pii-support`) | #791 (synchronise any workflow change; do not edit it separately) |
| `ARCHITECTURE.md` (lines 57, 215, 244 to 256), `README.md` (line 247), `docs/specs/{evaluation-engine,qualification-cutover,support-status}.md`, `docs/specs/qualification/README.md` | docs | describe `results-output/evaluation.json` and `evaluation-v1.json` | #787 (discovery paths), #788 (public paths), #791 (deployment text) |

Documentation only, no owner: `docs/decisions/*` (add-untargeted-benign-corpus, settle-mechanical-mutation-review-classes, settle-differential-disagreements-on-pending-fixtures, show-each-evaluation-method-in-one-fixed-order, show-the-release-candidate-beside-the-last-release), `docs/reports/2026-09-18/evaluation-ui-plan.md`, `docs/reports/2026-09-22/settle-differential-disagreements-on-pending-fixtures.md`, `evidence/774/README.md`, `benchmarks/support/legacy-review-queue.json` (frozen evidence; never regenerated).

## 5. Ownership map

| Issue | Integration points | Test boundary |
| --- | --- | --- |
| #786 | this spec, the ADR, `scripts/measure-report-growth.ts`, `docs/generated/evaluation-report-baseline.json` | `node scripts/validate-decisions.mjs`; the baseline is a record, not a gate |
| #787 | `benchmarks/evaluation/storage/*`, `benchmarks/evaluate.ts`, `scripts/accounting-dry-run.ts`, retention in `execution.ts`/`result-assembly.ts` only where measured | `tests/evaluation-discovery-store.test.mjs` (chunk boundary, oversized, Unicode, failed scanner, interrupted write, tamper, backpressure, large synthetic, exit codes); `evaluation-engine` and the PII assembly path if touched |
| #788 | `benchmarks/evaluation/bundle/bundle.ts`, `scripts/publish-evaluation.ts`, `public-report.ts`, `evaluation-model.ts`, `scripts/verify-evaluation-bundle.ts`, ledger binding | `tests/evaluation-bundle.test.mjs` (refusals, equivalence, distinguishable states, pointer, partial bundle); `evaluation-ui`, `workbench-model` kept green; `verify-evaluation-bundle --legacy` on retained evidence |
| #789 | `web/services/evaluation.ts` and the resolvers: read the pointer, the summary and one method's parts; legacy fallback | `web/tests/unit/evaluation-service.test.ts` on synthetic bundles; no test asserts ledger values |
| #790 | `scripts/publish-evaluation-domains.ts`, `scripts/publish-pii-support.ts`, descriptors v2: href and `artifactCommitment` | `tests/evaluation-domains.test.mjs`, `tests/pii-support-v2.test.mjs`; v1 descriptor and path unchanged |
| #791 | `publish-site.yml` and the sites mirror, `legacy-oracle.yml`, `validate.yml`, `assemble-site.mjs`, public guards over bundle parts, retention and rollback (§6) | `tests/ci-plan.test.mjs`, `tests/assemble-site.test.mjs`; one dispatch verifies a staging publish |

## 6. Legacy compatibility, retirement, retention and rollback

**Legacy discovery file.** `results-output/evaluation.json` is read by the explicit legacy path of `openDiscovery` (whole file, JSON.parse); it never triggers a scanner run, prints a warning, and is bounded by the V8 string limit. A missing store with no legacy file is an error that says to run `npm run eval:discover`; a store with no `manifest.json` is an error that says the store is incomplete; neither falls back to scanner execution. The legacy reader is retained until every retained pinned run has been replayed into a store and the oracle needs no discovery file; its retirement is a removal PR with its callers listed (`node scripts/legacy-callers.mjs`), like other legacy removals in this repository.

**Legacy public file.** `public/results/evaluation-v1.json` stays a supported contract for the Vite oracle (`src/main.ts`) and for consumers that have not migrated, produced by `eval:publish -- --legacy-v1` from the same discovery source (whole-report, bounded by the V8 string limit; never the default). The Next readers (#789) read the bundle when a pointer exists and the legacy file when it does not; an unsupported or incompatible pointer, manifest or part is an unusable evaluation, shown as such, never silently replaced by the legacy file. Retirement of the legacy public file requires: no web, domain or PII consumer reads it, the oracle is retired or fed from the bundle, and an owner decision recorded in an ADR. Until then rollback is real.

**Retention and rollback (#791).** Bundle directories are immutable and content-addressed; publishing writes a new directory and moves the pointer last, so the previous bundle remains complete behind its own directory. Retention keeps at least the bundle the live pointer names and the one it replaced, and removal of an older directory happens only after the new pointer is verified live. Rollback is writing the pointer for the retained previous bundle (the manifest it names must still match its digest) or serving `evaluation-v1.json`; no data is regenerated and no scanner is run. Deployment order (#791): upload the immutable bundle directory, verify it by fetching the manifest and every part digest, then upload the pointer and the domain index; never the reverse. The authority files (`qualification-authority.json`, `pii-authority.json`) are not read or written by any of this.

## 7. Execution memory: what is and is not bounded

This work bounds **serialization and reading**: the discovery writer and reader, the public bundle writer and validator, and the Next readers handle one part (or one record) at a time. It does not make evaluation execution bounded. `executeEvaluation` still prepares every generated case and fixture up front (`evaluationInputs`), holds all scanner observations (`runtime.observations`, with findings) until assembly, and `assembleEvaluationArtifact` builds `results[]`, `failures[]` and `reviewQueue[]` for the whole run before `writeDiscoveryStore` serializes them. So a run that produces a 420 MB discovery report still holds the in-memory object graph of that report (the measured parse of the same data peaks at 2.17 GB RSS), and the heap limit (4.35 GB here) still bounds the run. The publisher reads the discovery store streaming, but `eval:publish --legacy-v1` and `materializeDiscovery` rebuild the whole report and remain bounded by memory and the V8 string limit; `verify-evaluation-bundle --legacy` parses the whole old file by design. Reducing run-time retention (writing each assembled case through the store as it is produced, which needs the summary reductions to be incremental) is a separate change that #787 does only where measurement shows it is needed and the scope allows. Shared assembly is also used by PII; any change to it must be tested on that path.

## 8. Synthetic growth fixtures and equivalence checks

Routine validation uses synthetic evidence and retained pinned artifacts, never a scanner replay. The tests build records through the real writers:

- Discovery store: round trip equals the logical report; chunk boundaries (a record exactly on the limit); an oversized record stored whole; Unicode (astral, U+2028/2029, combining marks, CR/LF inside strings); failed, unavailable and generation-error reports with identical `exitCode` before and after; interrupted write (no manifest, staging removed, previous store kept); digest, size, record-count, deletion, duplicate and traversal tampering; a report whose whole JSON is more than four times a lowered string limit with every file within the part limit; backpressure.
- Public bundle: write and commit synthetic public cases of every kind; equivalence with `evaluationProblem`/`publicEvaluation` on the same data, including a real four-case engine run with an unavailable scanner through store, projection and bundle; refusal of corrupt, missing, swapped, duplicate and mixed-run parts, stale corpus hashes, protected or extra fields, invalid review references, inconsistent aggregates and totals, a tampered manifest, unsafe part paths, a pointer that does not match its manifest, and a partial bundle; zero-finding, pending and unavailable-scanner cases distinguishable.
- Retained pinned evidence: `node --import tsx scripts/verify-evaluation-bundle.ts --legacy=public/results/evaluation-v1.json` proves the published bundle equals the old whole file (summary, cases, reviews) and prints bytes, parts, time and peak RSS.

## 9. What this contract does not change

Canonical Rust RunArtifacts and the official replay and receipt formats, `qualification-v1.json`, the adoption comparison and Markdown, `benchmarks/qualification-authority.json`, `benchmarks/pii-authority.json`, the pins, the roster, the public allowlist and protected/holdout aggregate-only boundaries, and ledger decisions and history are untouched. The ledger file `review-ledger-v2.json` keeps its format; only the way the publisher binds it to a run changed (it reads the bundle's reviews and index instead of a whole report).
