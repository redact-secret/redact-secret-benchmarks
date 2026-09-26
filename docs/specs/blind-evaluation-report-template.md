# Blind evaluation report template

Copy this file to `docs/reports/<YYYY-MM-DD>-<milestone>-142-blind-evaluation.md`
and copy the released aggregate (`results-output/blind/blind-aggregate-<run-id>.json`,
git-ignored) beside it as
`docs/reports/<YYYY-MM-DD>-<milestone>-142-blind-aggregate.json`, byte for byte.
`npm run blind:check-public` validates that JSON in CI. Fill every
`<…>` from the aggregate alone. Do not add anything the aggregate does not
contain. Rules: [blind-evaluation.md](blind-evaluation.md).

Keep this report apart from public qualification and adversarial evidence.
Don't put its numbers into a table, chart or sentence alongside them, and
don't compute anything that combines them.

---

# <Milestone> custodian-held blind evaluation

Issue: [#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142).
Aggregate: [`<file>.json`](<file>.json) (`runId` `<runId>`).
Evidence class: **custodian-held blind** (`custodian-blind`). This is a
separate class from public qualification, maintainer regression and
externally authored adversarial evidence, and it is never combined with them.

## Independence

<Copy `independence.statement` verbatim.>

Achieved: fixtures and expected results that no product-implementing agent
or orchestrator saw before the run; one frozen candidate evaluated once on
this epoch.

Not achieved: organisational independence (one human operates both roles),
protection against blind spots the custodian and product agents share,
external reproducibility of the fixtures, and OS-level isolation.

<If an earlier epoch was contaminated or retired, say which epoch and why.>

## Identities

| | |
| --- | --- |
| Product commit | `<candidate.sourceCommit>` |
| Package | `<candidate.packageName>@<candidate.declaredVersion>` |
| Façade SHA-256 | `<candidate.artifactSha256>` |
| Artifact SHA-256 (package / node / wasm) | `<…>` / `<…>` / `<…>` |
| Adapter configuration hash | `<candidate.configurationHash>` |
| Benchmark commit | `<benchmark.sourceCommit>` |
| Benchmark lockfile SHA-256 | `<benchmark.lockfileSha256>` |
| Environment | `<environment.node>`, `<environment.os>`/`<environment.arch>` |
| Freeze | `<freeze.freezeId>` at `<freeze.frozenAt>`, hash `<freeze.freezeHash>` |
| Corpus | epoch `<corpus.epoch>`, commitment `<corpus.commitment>`, `<corpus.fixtures>` fixtures |
| Replays | `<replays>` |
| Status | `<status>`; failures: `<failures or "none">` |

## Results

Intervals are Wilson 95%. The fixtures are authored cases, not a sample of
real traffic, so no figure here estimates a real-world rate. There is no
overall score.

| Measure | Count | Of | Share | 95% interval |
| --- | --- | --- | --- | --- |
| Measurable fixtures | <measurability.measurable> | <measurability.fixtures> | <measurability.share> | n/a |
| Leaked spans (PARTIAL + MISS) | <leakage.leakedSpans.count> | <leakage.spans> | <value> | <interval> |
| False alarms (flagged must-not-flag) | <falseAlarms.flaggedControls.count> | <falseAlarms.controls> | <value> | <interval> |
| Unstable across replays | <instability.count> | <instability.of> | <value> | <interval> |

Withheld: <n> unstable across replays, <n> scan errors.

Span outcomes: EXACT <n>, COVERED <n>, OVERBROAD <n>, PARTIAL <n>, MISS <n>.

Strata (`strata.status`: <released | suppressed | none>; minimum <n> fixtures):

| Stratum | Fixtures | Spans | Leaked spans | Controls | Flagged controls |
| --- | --- | --- | --- | --- | --- |
| <label> | <n> | <n> | <n> | <n> | <n> |

## Reading

<Two or three sentences on what the counts say about this candidate, and
nothing about which fixture produced them. Name the uncertainty. A product
change made in response needs a new candidate identity and a new blind run;
don't describe it as fixing this result.>

## Disclosure

<"No fixtures disclosed." or: which count of synthetic fixtures moved to
public regression coverage, the new epoch that replaces them, and the link to
the reviewed change that added them.>
