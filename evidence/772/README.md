# Evidence: redact-secret#772, the beta.9 regression-budget verdict

**Result:** the first beta.9 candidate, `d4bab4e`, breached the size budget
on 8 of 28 triggers (full WebAssembly +8.2% gzip). The cause was the shadow
evidence scorer, linked into every shipped artifact without a public caller.
That is a **regression requiring a fix**, and it was fixed in
[redact-secret#830](https://github.com/redact-secret/redact-secret/pull/830):
the fixed candidate `ecf4db1` is within budget on all 28 size triggers and on
latency, initialization and memory. The merged `main` commit, `6b124ac`, also
carries the unrelated detector changes redact-secret#831–#839. There the
`aarch64-unknown-linux-gnu` CLI breaches once, at +7.7%. That breach is a
64 KiB segment-alignment step, with 1.7% real growth, and it is **open for a
maintainer decision**. Adapter overhead is an **invalid measurement**: the
workstation was loaded, and the deterministic adapter counts are unchanged.

This applies the reviewed budgets of
[#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143)
([`docs/specs/regression-budgets.md`](../../docs/specs/regression-budgets.md),
with timing judged on same-job paired ratios since #303/#306). The baseline
is `0.1.0-beta.8`, source `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`. No
baseline was replaced and no tradeoff was recorded in
`benchmarks/accepted-regressions.json`. Each measurement is kept below
next to its decision. The product-side judgement (cross-runtime determinism,
parity and worst cases) is redact-secret `docs/audits/evidence/772/`.

## Source revisions

| Item | Identity |
| --- | --- |
| Benchmark | redact-secret-benchmarks `develop`. Budgets `regression-budgets-v1`, as merged in #306; runs at `ff0b076`, `43655c9` and `54dc7ba`. The `evaluate` calls ran at `54dc7ba`. All clean |
| Baseline | `0.1.0-beta.8`, redact-secret `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`, built in the same job for every paired run |
| Candidate A (original) | redact-secret `d4bab4ede21cae2b25f03a40f466b52dceadfda2` (`main`, #771 merged) |
| Candidate B (fixed) | redact-secret `ecf4db12f4daede7538b128f3504b8c9301eb7a6`. This is #830's head before rebasing, with the product source of the #830 squash apart from #831–#839 |
| Candidate C (merged) | redact-secret `6b124ac50803fe35aad99abbb2dbe89c32f5f284`, the #830 squash on `main` |

## Scanner versions

No peer scanner ran, so the TruffleHog pin does not apply. Each candidate is
the product itself:

- timing and memory come from core's own `npm run assessment:all`, release
  builds, in `performance-evaluation.yml`;
- sizes come from core's `Artifact qualification` workflow artifacts at the
  same commit, plus npm tarballs packed from those binaries with core's
  `scripts/pack-npm-candidate.mjs`, plus a vite 7.3.6 build of the
  quickstart;
- adapter overhead comes from the redact-secret-adapters harness at
  `099c07a0c306cfb35949a76348136869ddd6b411`, over the fixed core.

## Verdicts

| Dimension | A `d4bab4e` | B `ecf4db1` (fixed) | C `6b124ac` (`main`) | Decision |
| --- | --- | --- | --- | --- |
| latency | 10/10 within | 10/10 within | 10/10 within | within-budget |
| initialization | 10/10 within | 10/10 within | 10/10 within | within-budget |
| memory | 16/16 within | 16/16 within | 16/16 within | within-budget |
| size | **8 regressions**, 20 within | 28/28 within | 27 within, **1 regression** | A: regression requiring a fix, fixed in redact-secret#830. C: open, see below |
| adapter overhead | not measured | tool: 28 within, 2 traversal regressions | not measured | invalid measurement, see below |

### Latency and initialization

Each run evaluates every surface in the same job against a baseline rebuilt
there: 6 counterbalanced rounds, 12 fresh-process samples per side. The
paired median ratios, candidate over beta.8, were:

| Candidate | Run | Runner | Processing median ratio | Initialization median ratio |
| --- | --- | --- | --- | --- |
| A | [36186305008](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36186305008) | AMD EPYC 7763 | 0.984–1.016 | 0.765–1.119 |
| B | [36199843397](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36199843397) | AMD EPYC 9V74 | 0.965–1.084 | 0.851–1.560 |
| C | [36201286835](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36201286835) | Intel Xeon Platinum 8370C | 1.000–1.067 | 0.903–1.009 |

Every row is within its derived threshold. B's 1.56 initialization ratio is
on a sub-millisecond row, which is under the 2 ms absolute floor. Run
[36186317097](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36186317097),
at the product-identical `6e44832`, is also within budget. Four earlier
absolute runs used the pre-#306 method: 36182200397 and 36182205865 at
`d4bab4e`, and 36182203237 and 36182208746 at the baseline. All four were
within budget, and they are informational only.

### Size (A: regression requiring a fix → fixed in redact-secret#830)

| Trigger (bytes) | beta.8 | A `d4bab4e` | B `ecf4db1` | C `6b124ac` |
| --- | ---: | ---: | ---: | ---: |
| WebAssembly `full` gzip (default) | 137,639 | 148,928 (+8.2%) **regression** | 137,446 (−0.1%) | 141,731 (+3.0%) |
| WebAssembly `common` gzip (optional) | 100,058 | 111,677 (+11.6%) **regression** | 99,880 (−0.2%) | 104,117 (+4.1%) |
| quickstart browser bundle, gzip | 144,501 | 155,763 (+7.8%) **regression** | 144,279 (−0.2%) | 148,566 (+2.8%) |
| npm `wasm`, packed | 254,413 | 277,389 (+9.0%) **regression** | 254,041 (−0.1%) | 262,234 (+3.1%) |
| node addon `aarch64-unknown-linux-gnu` | 1,149,600 | 1,220,048 (+6.1%) **regression** | 1,149,504 | 1,150,824 |
| CLI `aarch64-pc-windows-msvc` | 496,640 | 522,240 (+5.2%) **regression** | 496,640 | 507,904 (+2.3%) |
| CLI `x86_64-pc-windows-msvc` | 547,328 | 578,560 (+5.7%) **regression** | 547,328 | 561,152 (+2.5%) |
| CLI `aarch64-unknown-linux-gnu` | 863,848 | 934,232 (+8.1%) **regression** | 863,728 | 930,576 (+7.7%) **regression** |

Supporting WebAssembly figures, raw / gzip -9 / brotli 11 of the `.wasm`:

| Profile | beta.8 | A | B | C |
| --- | --- | --- | --- | --- |
| `full` | 408,447 / 137,639 / 108,880 | 434,272 / 148,928 / 118,242 | 405,690 / 137,446 / 108,644 | 418,746 / 141,731 / 111,681 |
| `common` | 278,100 / 100,058 / 81,031 | 304,156 / 111,677 / 90,466 | 275,564 / 99,880 / 80,957 | 288,619 / 104,117 / 84,029 |

**Decision for A: a regression requiring a fix, not an accepted tradeoff.**
The growth was code no public caller can reach. The scorer is shadow-only,
and the incremental session held an `Option` the compiler could not prove
empty. There was no detection or safety benefit to cite. redact-secret#830
compiles the scorer out of every non-test build, and B returns every size
trigger to within 0.2% of beta.8.

**Open item at C: `size/cli/aarch64-unknown-linux-gnu`, +7.7%.** Candidate
B, the #772 change alone, is at beta.8's size, so #772 does not cause this
row. The growth comes from redact-secret#831–#839 (generic-token, bearer and
connection-string detector changes).

The binary's loadable segments grew by 11,368 bytes (+1.7%), about what
every other target grew. But the target aligns segments to 64 KiB, and the
second segment's file offset moved from `0x995e8` to `0xa9490`, so the file
grew by one alignment step. The x86_64 Linux CLI, aligned to 4 KiB, grew
1.5%.

The budget's rules make this a `regression` until a maintainer either
records an accepted tradeoff linked to those detector changes' benefit, or
decides the trigger should measure loadable bytes instead of file bytes. It
is left open here, not accepted.

Under
[`scorer-promotion-contract.json`](../../benchmarks/scorer-promotion-contract.json)
gate `q5-size-budget`, the merged commit's `size` outcome is therefore
`regression` until that decision is made.

### Adapter overhead (invalid measurement)

The harness ran 5 processes per language, alternating, over B's core: an
addon and a wheel built from redact-secret `6d61c27`, product-identical to
B. The host was the budgets' Apple M4 with Node 22.16.0 and CPython 3.14.7.
`evaluate` returned 2 traversal regressions:

| Trigger | beta.8 | Candidate |
| --- | ---: | ---: |
| `pino-streamwrite/log-flat` | 3.700 µs | 4.702 µs (+27%) |
| `python-logging/log-nested` | 11.718 µs | 14.247 µs (+22%) |

The other 28 triggers were within budget.

**Decision: invalid measurement, not a regression.**

- Traversal is the adapter over a stub scanner that finds nothing, minus the
  host alone. It never calls the core, so a core change cannot move it.
- The workstation was shared. Its 1-minute load was 4.4–27.1 during the run
  ([`adapter/host-load.txt`](adapter/host-load.txt)), against about 3.4–4.1
  when the baseline was measured. The two breaching processes ran at load 27
  and 18.
- Per-process values followed the load down to the baseline: 26.6, 20.2,
  14.2, 12.2 and 11.9 µs for python-logging.
- A confirmatory series at load 7–12 was worse, with 8 traversal rows high
  and all counts unchanged. Load explains the result better than the
  candidate does.
- The two deterministic quantities are unchanged for every host and
  workload: scanner calls per event and scanned code units per event. These
  are what would reveal double scanning.

A clean adapter verdict needs a rerun on an idle Apple M4.

## Reproduce

```sh
# Timing and memory, same-job paired against the budgets' baseline:
gh workflow run performance-evaluation.yml --ref develop -f candidate_revision=<core sha>

# Size, from core's Artifact qualification run <R> at the same commit:
gh run download <R> -R redact-secret/redact-secret -n artifact-inventory -n wasm-web -n wasm-web-common -n node-addon-aarch64-apple-darwin
node scripts/pack-npm-candidate.mjs --addon-dir <addon> --wasm-dir <wasm-web> --wasm-common-dir <wasm-web-common> --out-dir <npm>   # in core
# quickstart bundle: vite 7.3.6 build of docs/quickstart.md's browser index.html and main.js over the three tarballs
node scripts/collect-operational-evidence.mjs --summary <summary.json> --acceptance <acceptance.json> \
  --performance-run <run> --inventory <artifact-inventory.json> --qualification-run <R> --wasm-dir <dir> \
  --npm core=<tgz> --npm wasm=<tgz> --npm node-darwin-arm64=<tgz> --bundle-dir <dist> --bundle-tool "vite 7.3.6" \
  --measured-at 2026-09-25 --out <operational-evidence.json>
node --import tsx scripts/regression-budgets.mjs evaluate --summary <summary.json> --paired <paired.json> \
  --operational <operational-evidence.json> --source-commit <core sha> --json-out r.json --markdown-out r.md
```

| Candidate | Artifact qualification | Performance run |
| --- | --- | --- |
| A `d4bab4e` | [36181706528](https://github.com/redact-secret/redact-secret/actions/runs/36181706528) | 36186305008 |
| B `ecf4db1` | [36199829711](https://github.com/redact-secret/redact-secret/actions/runs/36199829711) | 36199843397 |
| C `6b124ac` | [36201281792](https://github.com/redact-secret/redact-secret/actions/runs/36201281792) | 36201286835 |

The quickstart bundle's wasm is byte-identical to each run's CI-built
`wasm-web` artifact.

## Files

Each of `d4bab4e/`, `ecf4db1/` and `6b124ac/` holds:

- `regression-budgets.json` and `.md`: the full budget report, which keeps
  the measured value and the verdict on every trigger;
- `operational-evidence.json`: the #141-shaped size and timing inputs.

`adapter/` holds the candidate adapter series, its budget report, and the
host-load log.
