# Freeze of the Group C, D and E baselines (#752, #753, #754)

This commit freezes three corpora: `benchmarks/group-c/FROZEN-group-c.json`, `benchmarks/group-d/FROZEN-group-d.json` and `benchmarks/group-e/FROZEN-group-e.json`. Each manifest has `frozen: true`, `frozenBeforeAnyScan: true`, the evidence snapshot, the sha256 of the evidence extractor and evidence data, the corpus generator and the two scorer files, and the commit it was frozen at (`frozenAtCommit`, the corpus commits' tip; the freeze commit itself cannot name its own hash). The `FROZEN-group-*.json.proposed` files stay as the generators' own output (the generators and their `--check` write and compare them); the `FROZEN-group-*.json` files supersede them and add the freeze block.

| group | issue | cases | digest (sha256 of `JSON.stringify(cases)`) |
| --- | --- | --- | --- |
| C | #752 | 646 | `f216ca0a72c52d2b268924662d7f4ab66372c9820d0cfe386e3eefa0110dc37d` |
| D | #753 | 868 | `aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e` |
| E | #754 | 767 | `6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa` |

## What the freeze states

- **Frozen before any product scan.** No scanner, CLI, detector or product build had been run on these corpora when this manifest was committed. Any observation produced after this commit is measured against a baseline that could not have been shaped by it.
- **Authorship blind to product output.** The corpora were written without reading the product repository, any Batch 2 observation or any ledger.
- **Maintainer-only evidence, not independent validation.** Every expectation derives from the maintainer's credential-evidence repository (PR #263, tag `snapshot-2026.10.06.5`, commit `574b52ba367e2071d5a9bea3e2da7a9c5057f633`). That evidence is the project's own policy, not a third-party or vendor-independent check. A match with it shows consistency with the maintainers' stated contract and nothing more.
- **Review.** One blind reviewer (no sight of product output), two rounds, verdict APPROVE/FREEZE after the errata were applied. The rulings, in short:
  - C: C-B1/C-B2 (Adobe enterprise and Meta query layouts the Case does not name; 12 positives downgraded), C-B3 (Meta controls whose app-id/`appsecret_proof` disclosure the contract leaves open; 5 controls downgraded, generated controls use the documented `{your-app_id}` template), C-B4 (enterprise controls carry no `org_id`), A1 (20 positives in containers the Case does not name), A5 (6 controls on derived output), A6 (3 controls holding an `org_id` literal).
  - D: D-B1 (Algolia admin positives carry the create-key request context), D-B2 and A3 (cross-cluster response/log, YAML and Instagram/Meta URL-fragment and href layouts downgraded to unsupported), A13 (bullet-mask and template variants tagged class-extension), A14/D-F2 (`sharedWithGroupC` only on the 8 byte-identical cases), D-F1 (downgraded cases record `downgraded`, `downgradedFrom`, `ruling`).
  - E: E-B1..E-B3 and A2, A6..A8 (downgrades of cases the evidence Case does not support; four Zendesk fixture mirrors that carry a literal email become `conflict`).
  The per-case list is in each group's `TRACEABILITY.md`.
- **Downgrade principle.** A scored expectation must be supported by the evidence Case. Where it is not, the case becomes observed-only (`unsupported`, or `conflict`), keeps its text and records where it came from. It is never deleted, so the corpus digest shows what was reviewed.

## Expectations the scorer cannot express

The Batch 2 scorer (`benchmarks/batch2/score-r2.mjs`, unchanged) has no policy dimension. Not expressible, so not scored:

- Policy-class tolerance (a wider or narrower span or another family attribution that the policy would also allow). Every scored case rests on project policy; nothing here is a tolerance.
- Finding type and action (C: type/action are convention-derived and reported separately; D: `expectedType`/`expectedAction` are null, so `pass` is false by construction; read `exact`, `fullyCovered`, over/under/partial and `controlFlagged`).
- Group E also lists: any-shape, unasserted neighbours, shared-slot attribution, era neutrality, carrier currency, whole-encoded-run.
- Group D: policy-limited and carrier-unresolved rows are observed only.

## Secret scanning of this commit

The corpora hold synthetic values. `gitleaks` over `origin/develop..HEAD` reports 9 findings, all in group-e and all triaged as false positives (synthetic generator templates and evidence text, not credentials): `curl-auth-user` at `benchmarks/group-e/corpus-e.mjs` lines 562, 660, 699, 714, 719 and `evidence-group-e.json` line 1187; `curl-auth-header` at `corpus-e.mjs` line 587; `jwt` at `evidence-group-e.json` lines 810 and 819. This repository has no gitleaks configuration and does not use gitleaks as a CI gate (it appears only as a benchmark comparison scanner), so no allowlist was added.
