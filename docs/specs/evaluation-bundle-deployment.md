# Evaluation bundle deployment

Status: current (#791, epic #785). Storage contract: `docs/specs/evaluation-report-storage.md`. This page covers how the sharded public evaluation bundle reaches the bucket: ordering, retention, rollback, the guards, and what stays non-atomic.

## What is deployed

- `results/evaluation-bundles/<bundleId>/` (`manifest.json`, `summary.json`, `cases/*.json`, `reviews/*.json`): immutable, content-addressed (the id is derived from the part digests). Cache-control `public, max-age=31536000, immutable`.
- `results/evaluation-bundle-v1.json`: the mutable pointer (bundle id, run id, manifest path, manifest sha256 and size). `no-cache`.
- `results/evaluation-domains-v2.json`: the mutable domain index. Its credential evaluation descriptor carries `href` = `/results/evaluation-bundles/<bundleId>/manifest.json` and `artifactCommitment` = the manifest sha256. `no-cache`.
- `results/rollback/evaluation-bundle-v1.json`, `results/rollback/evaluation-domains-v2.json`: copies of the pointer and index that were live before this deployment. `no-cache`.

The pointer and the index are two separate objects. S3 sync and `s3 cp` are not a multi-file transaction, and nothing here claims otherwise. Coherence comes from three rules: immutable content first, mutable markers last, and readers and guards that refuse a pointer, manifest or index that do not name the same bytes (they never combine old and new details).

## Order of operations (publish-site.yml, `Publish` step)

1. Local, before signing in: `eval:publish` writes and validates the bundle in `public/results`; `node --import tsx scripts/assemble-site.mjs` copies only the bundle the pointer names (staging directories, `*.tmp` renames, `results-output/`, raw discovery files and every other bundle are filtered out), validates the whole bundle by streaming, and asserts nothing staged is in `dist`; `features:check-public`, `blind:check-public` and `evaluation-bundle:check-publication` then run over `dist`.
2. `_next/static` (immutable), then the PII immutable artifact (existing order, unchanged).
3. Read the live pointer (`previous_id`), then upload `results/evaluation-bundles/<id>/` with `aws s3 sync` (no `--delete`, immutable cache-control).
4. Read back the uploaded directory from S3 and run `check-evaluation-bundle-publication.mjs --readback` (digest, schema, totals, exclusion rules over every referenced file, no unreferenced object, manifest digest equal to the one the pointer will commit to). Failure stops the publish with the old pointer and index untouched.
5. `aws s3 sync dist ... --delete` for everything else (HTML, the ledger and support artifacts), excluding `assets/*`, `_next/static/*`, the PII artifacts, `results/evaluation-bundles/*`, `results/evaluation-bundle-v1.json`, `results/rollback/*` and the domain index. Old bundle directories therefore survive `--delete`.
6. Copy the live pointer and index to `results/rollback/` (skipped when the bundle being published is already live, so a re-run never overwrites the rollback target).
7. Upload `evaluation-bundle-v1.json`, then `evaluation-domains-v2.json`, last.
8. CloudFront invalidation, then a separate step prunes old bundles (below).

## Windows of inconsistency, and what each reader sees

| Interrupted after | Live state | Readers |
| --- | --- | --- |
| 3 or 4 | Old pointer and index; new bundle directory present, unreferenced | Old bundle in full; harmless leftover pruned by retention |
| 5 | Old pointer and index; new HTML/ledger/support live | Old bundle; the ledger and HTML are one run ahead (see limitations) |
| 7 before the index | New pointer, old index | A reader or the guard sees pointer and index naming different manifests and refuses; recover by finishing the publish (re-dispatch) or rolling back |
| 7 complete | New pointer and index | New bundle; the old directory is still reachable for anything that cached the old pointer |

## Retention

Supported: the current bundle and the one that was live when the deployment started are kept; every other `results/evaluation-bundles/<32 hex>/` may be pruned. Pruning is its own workflow step, after the commit and the invalidation: it re-reads the live pointer, asks `scripts/evaluation-bundle-retention.mjs` for a plan, and runs `aws s3 rm` only for the ids marked `prune`. The planner refuses to plan when the current bundle is not stored, never lists the live pointer's bundle for pruning, and ignores anything that is not a bundle id. Disk and request cost: a bundle of the retained run is about 73 MB, so two retained bundles cost about 150 MB of S3.

Not supported: rollback further back than one deployment; the earlier bundle is gone after the next successful prune.

## Rollback

Both markers must move back together, pointer first and index last, from the saved copies (a pointer alone would disagree with the new index and be refused):

```bash
aws s3 cp "s3://$BUCKET/results/rollback/evaluation-bundle-v1.json" "s3://$BUCKET/results/evaluation-bundle-v1.json" --cache-control no-cache
aws s3 cp "s3://$BUCKET/results/rollback/evaluation-domains-v2.json" "s3://$BUCKET/results/evaluation-domains-v2.json" --cache-control no-cache
```

Then invalidate `/results/*`. The previous bundle's directory is retained by the rule above, so every part is present; verify with `check-evaluation-bundle-publication.mjs --readback=<synced results dir>`. Rolling the whole site back (HTML included) is still redeploying an earlier workflow commit.

## Guards

- `scripts/check-evaluation-bundle-publication.mjs` (`npm run evaluation-bundle:check-publication`): no staging or internal raw file under `dist` (`.evaluation-bundle-*`, `*.staging`, `*.tmp`, `results-output`, `evaluation.json`, discovery store parts, any `.jsonl` under `results/`); the pointer resolves to its own manifest; `dist` holds only the current bundle and only files its manifest references; `validateBundle` over every part; the feature-dataset and blind-public content rules (`textProblems`, `blindTextProblems`, extracted from the two existing guards so they are one implementation) over every referenced file; the domain index commitment equals the manifest sha256 equals the pointer. `--no-index` skips the last check where no index exists (validate.yml's web build).
- The two existing guards still walk all of `public/` and `dist/`, so every shard is also scanned by them directly.
- Rehearsals: `tests/evaluation-bundle-deployment.test.mjs` (interrupted publication, old reader during deployment, rollback, retention, mismatches, `dist` rejection, assembly, workflow ordering). Synthetic bundles only; runs in the existing unit-test job; no scanner run, no new workflow.

## CI planning

`scripts/ci-plan.mjs` treats site assembly, the two exclusion guards, the publication check and the retention planner as publication-side scripts: changing one reruns the site build and `validate-sources`, not the legacy measurement. The `legacy-results` cache holds `public/results` including the bundle; the publish job removes the previous store and pointer before measuring, and the job summary reads the bundle's `summary.json` instead of `evaluation-v1.json`.

## Evidence: assembling and validating a real bundle

Retained local bundle (20,009 cases, 17,027 reviews, 11 case parts and 1 review part, 8 MiB part limit, largest part 8,387,362 bytes, 73 MB of details, 14 files), macOS, Node with tsx, `/usr/bin/time -l`:

| Command | Wall | Max RSS |
| --- | --- | --- |
| `assemble-site.mjs` (copy, stream-validate every part, exclusion rules over each) | 3.2 s | 325 MB |
| `check-evaluation-bundle-publication.mjs --dist` (validate and inspect every part) | 3.0 s | 323 MB |

The comparison, whole-report `evaluation-v1.json` of the same run, is 76.5 MB and needs a single 76.5 MB string. Memory here is dominated by one part plus the id index, not by the document; it is not a bound on the evaluation run itself (`#787` records that limit).

## Remaining limitations

- Not atomic: the HTML export, the ledger and support artifacts, the pointer and the index are separate objects and `--delete` removes stale ones one at a time. During a deployment a page can be served beside a newer or older ledger or support artifact.
- A reader of the old HTML that fetches a legacy `evaluation-v1.json` fails once the sync removes it; the first publish after migration is such a window.
- CloudFront caches `no-cache` objects only with revalidation, but the invalidation `/*` is issued after the index moves, so an edge can serve the previous pointer for a short time; that pointer's bundle is retained by design.
- Two concurrent publishes are prevented by the workflow's concurrency group, not by the bucket.
- The prune step needs `s3:DeleteObject` and `s3:ListBucket` on the bucket, which the publisher role already holds for `--delete`.
