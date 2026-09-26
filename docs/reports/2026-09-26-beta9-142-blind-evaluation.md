# Beta.9 custodian-held blind evaluation

Issue: [#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142).
Aggregate: [`2026-09-26-beta9-142-blind-aggregate.json`](2026-09-26-beta9-142-blind-aggregate.json)
(`runId` `5ebdef2d-9330-4b07-996f-889856c9fb2c`).
Evidence class: **custodian-held blind** (`custodian-blind`). This is a
separate class from public qualification, maintainer regression and
externally authored adversarial evidence, and it is never combined with them.

## Independence

Custodian-held blind fixtures, authored and held by an isolated custodian agent session that product-implementing agents and the orchestrator never saw. The same human operates the custodian and the maintainer roles, so this run achieves procedural separation, not organisational independence.

Achieved: fixtures and expected results that no product-implementing agent
or orchestrator saw before the run; one frozen candidate evaluated once on
this epoch.

Not achieved: organisational independence (one human operates both roles),
protection against blind spots the custodian and product agents share,
external reproducibility of the fixtures, and OS-level isolation.

## Identities

| | |
| --- | --- |
| Product commit | `93ddf510a31563d58c7d4c202363ef65c4d92d55` |
| Package | `@redact-secret/core@0.1.0-beta.9` |
| Façade SHA-256 | `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` |
| Artifact SHA-256 (package / node / wasm) | `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` / `be03070faa6b02f69966f95667bcb44cb3f90ead627cfb8a8a2421068bfcf19a` / `9784a4bddbb0cd5bffb290b57a5d6fe9df4642b7148abe0713c978ffcb7c2375` |
| Adapter configuration hash | `3b0dc27d40a3b27194676ebb4a3ce2d0ca7417700ba7b6d695106007c1d77d8e` |
| Benchmark commit | `853149ffbb2c8efef89e5c74178bf61ee783da7d` |
| Benchmark lockfile SHA-256 | `2fd997ca616a659b7801cf630bfde2441b2df106499df3cfc86b6aee016d568b` |
| Environment | `v22.16.0`, `darwin`/`arm64` |
| Freeze | `e9734a50-466a-4706-af0f-26b63755fef1` at `2026-09-26T10:25:38.485Z`, hash `c9ee4ebfd355e5a1297bada5b61e18a487ce2c17a33ec4af596a1f0dd1e2dc26` |
| Corpus | epoch `beta9-e1`, commitment `3d1fa85091a6476817aeb8fb4e6e70440611369bb295a5a92ba03a15ad27a821`, 251 fixtures |
| Replays | 2 |
| Status | `complete`; failures: none |

## Results

Intervals are Wilson 95%. The fixtures are authored cases, not a sample of
real traffic, so no figure here estimates a real-world rate. There is no
overall score.

| Measure | Count | Of | Share | 95% interval |
| --- | ---: | ---: | ---: | --- |
| Measurable fixtures | 251 | 251 | 1 | n/a |
| Leaked spans (PARTIAL + MISS) | 17 | 177 | 0.096 | [0.0608, 0.1484] |
| False alarms (flagged must-not-flag) | 2 | 96 | 0.0208 | [0.0057, 0.0728] |
| Unstable across replays | 0 | 251 | 0 | [0, 0.0151] |

Withheld: 0 unstable across replays, 0 scan errors.

Span outcomes: EXACT 149, COVERED 11, OVERBROAD 0, PARTIAL 0, MISS 17.

Strata (`strata.status`: released; minimum 5 fixtures):

| Stratum | Fixtures | Spans | Leaked spans | Controls | Flagged controls |
| --- | ---: | ---: | ---: | ---: | ---: |
| ai-provider-keys | 17 | 17 | 1 | 0 | 0 |
| cloud-keys | 15 | 19 | 3 | 0 | 0 |
| commerce-keys | 9 | 9 | 1 | 0 | 0 |
| connection-strings | 11 | 11 | 1 | 0 | 0 |
| devops-tokens | 29 | 29 | 4 | 0 | 0 |
| doc-examples | 13 | 0 | 0 | 13 | 0 |
| generic-assignments | 14 | 14 | 3 | 0 | 0 |
| hashes-checksums | 15 | 0 | 0 | 15 | 0 |
| identifiers | 15 | 0 | 0 | 15 | 0 |
| messaging-keys | 14 | 14 | 0 | 0 | 0 |
| mixed-documents | 9 | 27 | 4 | 0 | 0 |
| near-misses | 15 | 0 | 0 | 15 | 0 |
| placeholders | 15 | 0 | 0 | 15 | 2 |
| private-keys | 11 | 11 | 0 | 0 | 0 |
| public-material | 11 | 0 | 0 | 11 | 0 |
| sequences | 12 | 0 | 0 | 12 | 0 |
| structured-tokens | 12 | 12 | 0 | 0 | 0 |
| vcs-tokens | 14 | 14 | 0 | 0 | 0 |

## Reading

Every fixture was measurable and the two replays were stable. The aggregate
also records 17 leaked spans and 2 flagged controls, with the Wilson intervals
above describing uncertainty over this authored corpus rather than real-world
rates. No product change was made after seeing the result; any such change
would require a new candidate identity and a new blind run.

## Disclosure

No fixtures disclosed.
