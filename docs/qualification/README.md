# Engine v1 qualification evidence

[engine-v1.json](engine-v1.json) is schema-validated aggregate evidence from all six methods and all three pinned scanners. It contains no holdout case rows.

- Run ID: da80141f-d2e9-42b7-b8ed-baf707edda04
- Completed: 2026-09-18T03:17:07.653Z
- Source fingerprint: 1e50fd94d185d2656ce58cf22575679db2f1efd57fd09202371de8fcb0c38982
- Cases / variants: 1,939 / 5,107
- Unit tests: 147 passed; real-adapter integration tests: 6 passed
- TypeScript, production build, fixture-storage and evidence validation: passed
- Public holdout lifecycle controls: 12/12 assertions passed for each scanner
- Development findings: 2907 failed assertions; 1381 review entries

A fresh source snapshot with no node_modules or generated inputs ran npm ci and eval:qualify. Replay run 1db2c60a-1e83-4547-a616-ee87cf6f35c7 matched the source, lockfile and installed candidate artifact hashes, every method aggregate, development evidence and holdout scanner aggregates. IDs and timestamps intentionally differ. The snapshot was not a committed release checkout; the main evidence explicitly records the current working tree as dirty.

The checked-in holdout is a public conformance corpus, not independently maintained protected detector evidence. No stable-support claim follows. GitHub prerequisite issues #1–#8 remain open in the recorded milestone snapshot; the formal milestone-closure gate was tested and correctly failed before consuming a holdout attempt. No prerequisite was silently removed from scope.

See [reproduction and internal architecture](../evaluation-engine-v1.md) and [protected holdout operations](../../holdout/README.md).
