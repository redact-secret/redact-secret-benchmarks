# Groups C, D and E, round 4: the same frozen corpora on the PUBLISHED 0.1.0-beta.14

Same role and rules as rounds 1 to 3: no corpus case, frozen manifest, evidence extract or scorer was edited; no product code changed; peers not run; `round1/` to `round3/` untouched. Round 3 measured the unpublished candidate `c6dd685974b8df6a84514e07e41e35afa711a2ac` ("declared 0.1.0-beta.14"). `redact-secret` 0.1.0-beta.14 has since been published, so this round answers the acceptance wording "exact published pin and exact candidate identity": are the published packages the measured candidate?

## 1. Are the published packages the measured candidate?

Read from the registries on 2026-10-07 and compared with [`round3/identity.json`](../round3/identity.json):

| Artifact | Round 3 candidate | Published beta.14 | Same bytes |
| --- | --- | --- | --- |
| `@redact-secret/core` tarball SHA-256 | `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2` | `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2` | **yes** |
| `@redact-secret/node-darwin-arm64` tarball | `3f077018654be412cca449d49390c0dd1223a4e1bbe33c11446a2701a036f155` | `c68b4761d8b0173fbb69d4f33e2da6b908da6c8478533ec308f1662a307d15a9` | no (native build, host-bound) |
| `@redact-secret/wasm` tarball | `3354fd36a7f1c5f41535aa0a8bc6a1853c6b734c6a6fdc10089a52a07f091d24` | `d2acc0dd0dcf325799a0ec824f2c5353c56e35a9deaf7b968f0770c226777fc4` | no |
| addon | `71d13a68bbabda2afa6c00085617ebf47d557a81cb307574d290dd1169009ea5` | `55aa35f0184dbb330457c91d4cd5da0ee28929847d0a0aaeff7153944eb7d2ec` | no |
| wasm (full profile) | `bb10fdf9322922cbfaac431c94e1ce051692e14fd14f4edb84d7932d47bb18e1` | `981b9aa776ee810bf3a5f074b46b0a356af8b14044e384970198520bd91abf66` | no |
| CLI | `7864a2a68b3435aa48f999a6d79a37ae0212da78ad6e25d366de00aefdf6e17e` | `95edcc76cb278170a905f96cf94912556011c3cc03359b5560e305aa475f78e1` (crates.io build here) | no |

Source: the registry provenance (SLSA v1) of `@redact-secret/core@0.1.0-beta.14` names `git+https://github.com/redact-secret/redact-secret@refs/heads/main` at commit `0c62fd38bca75c5b28b042dc79789b708ebf1d17` (the registry `gitHead` field is empty), published 2026-10-07T01:29:54.949Z. `c6dd6859` is an ancestor of that commit. c6dd685974b8 is an ancestor of the published commit 0c62fd38bca7 (and of PR #1257 merge 01ce5284); between c6dd6859 and 0c62fd38 no non-comment line changed under crates/, bindings/ or src/ (checked with git diff -U0 and a filter for comment lines); 56 Rust files differ only in doc-comment permalinks and bindings/wasm/README.md in 2 lines.

**Conclusion: not provably the same artifacts** (the native and wasm bytes differ, as they do between any two builds on different hosts), but the JavaScript package is byte-identical and the Rust and binding sources differ only in comments. The behavioural question was therefore answered by replaying the corpora, below.

## 2. Replay on the published packages

Installed from the registries into a clean directory: `@redact-secret/core@0.1.0-beta.14`, `@redact-secret/node-darwin-arm64@0.1.0-beta.14`, `@redact-secret/wasm@0.1.0-beta.14` (npm integrity in [`identity.json`](identity.json)), PyPI `redact-secret==0.1.0b14` in a venv (cp310-abi3 wheel, Python 3.14.7), `cargo install --locked redact-secret-cli@0.1.0-beta.14`. Harness `scripts/measure-batch1.mjs` unchanged, four surfaces, each case whole and in 7-byte and 1-byte chunks, corpus digests verified (C `16036d043fc0dad0e45ec42e2513d2ffec2020da3458a95ed57f09f44fb0e02d`, D `aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e`, E `6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa`). Observations: `observations-candidate-<c|d|e>-c<7|1>.json.gz` (per-case findings, no matched text). `scripts/report-groups-cde-r4.mjs` compares the full finding signature (start, end, type, action, detector) per case, surface and mode against round 3 and re-scores with the unchanged `score-r2.mjs`.

| group | identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported | conflict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C | R3 candidate c6dd6859 | 277 | 232 | 247 | 30 | 242 | 6 | 127 | 0 |
| C | R4 published beta.14 | 277 | 232 | 247 | 30 | 242 | 6 | 127 | 0 |
| D | R3 candidate c6dd6859 | 219 | 197 | 218 | 1 | 351 | 0 | 290 | 8 |
| D | R4 published beta.14 | 219 | 197 | 218 | 1 | 351 | 0 | 290 | 8 |
| E | R3 candidate c6dd6859 | 343 | 297 | 297 | 46 | 186 | 0 | 234 | 4 |
| E | R4 published beta.14 | 343 | 297 | 297 | 46 | 186 | 0 | 234 | 4 |
| all | R3 candidate c6dd6859 | 839 | 726 | 762 | 77 | 779 | 6 | 651 | 12 |
| all | R4 published beta.14 | 839 | 726 | 762 | 77 | 779 | 6 | 651 | 12 |

**Result: identical.** 2281 cases compared; 0 cases have any different finding (start, end, type, action or detector) on any of the 16 observations; 0 differing observations; **0 regressions and 0 improvements against round 3**, so there is nothing to classify. Parity on the published packages: C 646/646, D 868/868, E 767/767 identical on all 16 observations, detector name included, 0 divergent. Every disposition of [round 3 section 6](../round3/report.md#6-final-disposition-of-all-43-rows) therefore holds for the published beta.14 unchanged: covered with recorded policy deviation 5; fully covered 16; policy-limited 6; carrier unresolved (observed only) 16; open product gaps 0.

## 3. Regression controls (Batch 1 and Batch 2)

The same published packages on the unchanged Batch 1 and Batch 2 corpora (digests verified), four surfaces, whole, 7-byte and 1-byte; scored with the unchanged scorers (Batch 1 `benchmarks/batch1/score.mjs`, Batch 2 `score-r2.mjs`) and compared with the accepted Batch 2 round-3 observations of candidate `4e004108` ([`evidence/739/round3`](../../739/round3/report.md)). Data: [`controls/controls.json`](controls/controls.json) and `controls/observations-published-<b1|r1|r2>-c<7|1>.json.gz`; script `scripts/report-groups-cde-r4-controls.mjs`.

| corpus | cases | sha256 | positives failing | controls flagged | unsupported / conflict (observed) | surface or stream divergence | regressions vs accepted | cases with different findings |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| Batch 1 | 82 | `ddd709174816...` | 0 of 34 | 0 of 42 | 6 / 0 | 0 | 0 | 0 |
| Batch 2 round 1 | 486 | `74fed3824550...` | 0 of 200 | 0 of 203 | 81 / 2 | 0 | 0 | 2 |
| Batch 2 round 2 | 1935 | `a312308a141e...` | 0 of 1010 | 0 of 555 | 368 / 2 | 0 | 0 | 2 |

No scored case regressed. The 4 cases whose findings differ from the accepted observations are observed-only (`unsupported`, never scored): the percent-containing X Bearer value (`x:app-only-bearer-token` `bearer-percent-raw` and `bearer-percent-curl`, in round 1 and in round 2) is now covered whole instead of up to the first escape (e.g. [22,40] to [22,56]), the effect of the #1224 closeout fix. Nothing is scored for them.

## 4. Limits

- Equality is on these corpora, one host (darwin-arm64, Node v22.16.0); the published linux, windows and darwin-x64 binaries were not run. The wasm and native bytes differ from the round-3 build, so identity of those artifacts is behavioural, not byte-level.
- The Rust diff between `c6dd6859` and the published commit was read as comments only by filtering comment lines from `git diff -U0` over `crates/`, `bindings/` and `src/`; it is a source observation, not a build proof.
- `round3/report.md` section 7 keeps an unresolved commit placeholder in its permalinks because round 3 is frozen; the permalinks it describes are the files of this directory tree at the commit that merged this change (the issue comments carry them resolved). The relative links in `evidence/752|753|754/README.md` need no commit.
- Project-authored evidence; peers not run; no official run, workflow dispatch, pin, authority, ledger or support status was touched.

## Reproduce

```bash
# install (clean directory): npm i --ignore-scripts @redact-secret/core@0.1.0-beta.14 @redact-secret/node-darwin-arm64@0.1.0-beta.14 @redact-secret/wasm@0.1.0-beta.14
# venv: pip install redact-secret==0.1.0b14 ; cargo install --locked --root <dir> redact-secret-cli@0.1.0-beta.14
node scripts/measure-batch1.mjs --corpus ../benchmarks/group-<c|d|e>/<corpus module> --chunk 7|1 --label published-beta14 --out obs.json --node-root <install> --wasm-dir <install>/node_modules/@redact-secret/wasm --python <venv>/bin/python --cli <dir>/bin/redact-secret --source-commit npm:@redact-secret/core@0.1.0-beta.14
node scripts/report-groups-cde-r4.mjs --r3 evidence/groups-cde/round3 --obs-dir evidence/groups-cde/round4-published-beta14 --out evidence/groups-cde/round4-published-beta14
node scripts/render-groups-cde-final.mjs
```

