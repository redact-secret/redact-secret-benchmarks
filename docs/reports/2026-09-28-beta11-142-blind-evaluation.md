# Beta.11 custodian-held blind evaluation

> **Carried over, not re-measured.** This aggregate was measured at `1db8ff3`. By maintainer decision it is carried to
> the re-bound Beta.11 candidate `8b6a5fd` without a new epoch; the basis, and the #948 policy change the epoch did not
> measure, are in [`2026-09-29-beta11-142-blind-carry-over-8b6a5fd.md`](2026-09-29-beta11-142-blind-carry-over-8b6a5fd.md).
> The earlier carry-over to `8f97f14` is [`2026-09-29-beta11-142-blind-carry-over.md`](2026-09-29-beta11-142-blind-carry-over.md).

Issue: [#382](https://github.com/redact-secret/redact-secret-benchmarks/issues/382)
(parent [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376)),
run under the custodian model from
[#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142).
Aggregate: [`2026-09-28-beta11-142-blind-aggregate.json`](2026-09-28-beta11-142-blind-aggregate.json)
(`runId` `1604909b-bd5f-4c2d-b3ab-3eb1bc7d0d61`).
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

`beta11-e1` is a new epoch with a freshly authored corpus. The earlier
`beta9-e2` corpus was not contaminated. It was retired when this epoch replaced
it, and archived inside the private root.

## Identities

| | |
| --- | --- |
| Product commit | `1db8ff38b16e50c51229eb27025452952bf621e1` |
| Package | `@redact-secret/core@0.1.0-beta.10` |
| Façade SHA-256 | `4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1` |
| Artifact SHA-256 (package / node / wasm) | `4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1` / `878b6185b9827da953d502da906c1d806ab63fe283f5b47654c4d6038f0e9e60` / `af0633663d713456a82d297f23023280cff05ad5f56489e9e72854601af2b1a1` |
| Adapter configuration hash | `3b0dc27d40a3b27194676ebb4a3ce2d0ca7417700ba7b6d695106007c1d77d8e` |
| Benchmark commit | `ef34e5c3f557e1bfcc914da58ad9f7640fc67795` |
| Benchmark lockfile SHA-256 | `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Environment | `v22.16.0`, `darwin`/`arm64` |
| Freeze | `3a9021dd-280e-4efa-a1a9-13b51a0e6ae0` at `2026-09-28T21:28:24.478Z`, hash `22f69b176babdde15e9751a6848ba563a3d15eb8c05524627a05ae54f498ef3b` |
| Corpus | epoch `beta11-e1`, commitment `a3afabcc6fc2e7cea78c74fbba2e26f5fdbfdf009d6dc3554f21e4cbc73db3b0`, 84 fixtures |
| Replays | 2 |
| Status | `complete`; failures: none |

The candidate declares version `0.1.0-beta.10`: the product commit precedes
the Beta.11 version bump. Its identity is the commit and hashes above, not the
version string.

## Results

Intervals are Wilson 95%. The fixtures are authored cases, not a sample of
real traffic, so no figure here estimates a real-world rate. There is no
overall score.

| Measure | Count | Of | Share | 95% interval |
| --- | ---: | ---: | ---: | --- |
| Measurable fixtures | 84 | 84 | 1 | n/a |
| Leaked spans (PARTIAL + MISS) | 3 | 66 | 0.0455 | [0.0156, 0.1253] |
| False alarms (flagged must-not-flag) | 0 | 27 | 0 | [0, 0.1246] |
| Unstable across replays | 0 | 84 | 0 | [0, 0.0437] |

Withheld: 0 unstable across replays, 0 scan errors.

Span outcomes: EXACT 18, COVERED 45, OVERBROAD 0, PARTIAL 0, MISS 3.

Strata (`strata.status`: released; minimum 5 fixtures):

| Stratum | Fixtures | Spans | Leaked spans | Controls | Flagged controls |
| --- | ---: | ---: | ---: | ---: | ---: |
| benign-context | 13 | 0 | 0 | 13 | 0 |
| benign-lookalike | 14 | 0 | 0 | 14 | 0 |
| mixed-document | 9 | 18 | 0 | 0 | 0 |
| provider-beta11 | 17 | 17 | 2 | 0 | 0 |
| provider-established | 17 | 17 | 1 | 0 | 0 |
| structural-generic | 14 | 14 | 0 | 0 | 0 |

## Reading

Every fixture was measurable and gave the same findings on both replays. Three
of 66 expected spans leaked, all as complete misses: two in the
`provider-beta11` stratum and one in `provider-established`. None of the 27
controls was flagged. With these counts the intervals are wide: the leak share
could be anywhere from about 2% to 13%, and the false-alarm share could be as
high as about 12%. A product change made in response needs a new candidate
identity and a new blind run, and must not be described as fixing this
result. No public support status follows from this result alone.

## Disclosure

No fixtures disclosed.
