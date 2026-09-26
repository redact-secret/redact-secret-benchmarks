# Beta.9 custodian-held blind evaluation — epoch 2

Issue: [#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142).
Aggregate: [`2026-09-26-beta9-142-blind-aggregate-e2.json`](2026-09-26-beta9-142-blind-aggregate-e2.json)
(`runId` `95310b97-5b2e-4838-a297-5f95009388f1`).
Evidence class: **custodian-held blind** (`custodian-blind`). It remains
separate from public qualification, maintainer regression and external
adversarial evidence, and is never combined with them.

## Independence

The fixtures were authored and held by an isolated custodian session. Product
agents and the orchestrator did not see them before or after the run. The same
human operates the custodian and maintainer roles, so this is procedural
separation, not organisational independence. The epoch was rotated because the
same façade artifact had already spent its one attempt on `beta9-e1`; the new
fixture digest was verified distinct without disclosing it.

## Identities

| | |
| --- | --- |
| Product commit | `09e1d7f85cd2ada9f387cc5c9beef3b29023d17d` |
| Package | `@redact-secret/core@0.1.0-beta.9` |
| Artifact SHA-256 (package / node / wasm) | `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` / `26815f44fcc4ecb859c991f63ec17167bebbadc0b28842dd4ab2fa1a1b9ac77d` / `9784a4bddbb0cd5bffb290b57a5d6fe9df4642b7148abe0713c978ffcb7c2375` |
| Adapter configuration hash | `3b0dc27d40a3b27194676ebb4a3ce2d0ca7417700ba7b6d695106007c1d77d8e` |
| Benchmark commit | `90332d55e0a1f4f8002ed55a30eb7951bdf25bbb` |
| Benchmark lockfile SHA-256 | `2fd997ca616a659b7801cf630bfde2441b2df106499df3cfc86b6aee016d568b` |
| Freeze | `9b9e439f-83f8-46e7-aa7e-48461b82b68d` at `2026-09-26T13:35:10.476Z`, hash `40760602018263460f86c200d9d3cb9af614768be2d87a2d2d81cb1710982791` |
| Corpus | epoch `beta9-e2`, commitment `1559d720585eca1ad58e9d7fe8a2b9c9bb57b371cf5a8cdc05fc6fbd06286dda`, 32 fixtures |
| Replays | 2 |
| Status | `complete`; failures: none |

## Results

Intervals are Wilson 95%. These are authored cases, not a sample of real
traffic, so no figure estimates a real-world rate. There is no overall score.

| Measure | Count | Of | Share | 95% interval |
| --- | ---: | ---: | ---: | --- |
| Measurable fixtures | 32 | 32 | 1 | n/a |
| Leaked spans (PARTIAL + MISS) | 3 | 20 | 0.15 | [0.0524, 0.3604] |
| False alarms | 1 | 12 | 0.0833 | [0.0149, 0.3539] |
| Unstable across replays | 0 | 32 | 0 | [0, 0.1072] |

Withheld: 0 unstable across replays and 0 scan errors. Span outcomes were
EXACT 17, COVERED 0, OVERBROAD 0, PARTIAL 1 and MISS 2. The corpus was too
small to release strata (`strata.status: none`, minimum 5), so none are
inferred here.

## Reading

Every fixture was measurable and stable across the two replays. The run also
found three leaked spans and one flagged control. No product change was made
after observing the aggregate; any such change requires a new candidate and a
new blind run.

## Disclosure

No fixtures disclosed.
