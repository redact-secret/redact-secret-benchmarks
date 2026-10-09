# Legacy UI retirement (#852)

The Next static export in `web/` is the published site. The previous root Vite
UI is retired independently of credential and PII evaluator rollback. The
updated #852 and #543 scopes supersede UI-only oracle preservation and unrelated
UX milestones. No authority value, run, pin, fixture, baseline or owner ruling
changes as part of this UI removal.

## Caller classification and retained contracts

All 54 `src/` files were traced through Graft callers/grep and exact import,
SSR-loader and execution-source-list references. Renderer-only pages, components,
styles, shell, entrypoint and catalog have no current runtime consumers. Their
only external imports were old UI tests and the old support UI gate. Compatibility
reexports pointed at already neutral `benchmarks/shared` models; remaining data
contract tests now import those models directly. Upstream product source paths,
fixture contents, historical comments and synthetic classifier paths are inert
mentions and do not constitute imports of this repository's UI.

Two actual validators are retained in `benchmarks/shared/pii-support-model.ts`
and `benchmarks/shared/providers-model.ts`. Their schema, taxonomy, commitment,
semantic and distribution checks are unchanged; only relative imports move.
PII population/protected/publication tests, dossier generation tests, report
validation, navigation/old URL parsing, review ledger and neutral design-token
contrast tests remain. The publication-language gate now scans production Next
TS/TSX in `app`, `components`, `resolvers` and navigation `lib` rather than the
retired UI. Storybook fixtures are outside that publication scan. Existing
external PII population labels have exact path-and-literal exceptions, and a
new independence claim in the same renderer still fails. Only assertions of the retired HTML renderers and their
DOM handlers are removed from mixed test files. Nine dedicated old renderer
suites and `scripts/check-support-ui.mjs` are removed. Current Next service,
resolver, state and fixture lookup tests enforce the published contracts.

`benchmarks/legacy-url-redirects.json`, Next `LegacyFixtureLookup`, authored
fixtures and `shared/design-tokens` remain. Root UI `index.html` and
`vite.config.ts` contain no measurement configuration. Root typechecking no
longer includes `src/`; measurement tools remain separate. PII profile-cost
bundle builders require actual Vite 8.3.0 and retain the `vite-8.3.0` manifest
identity. The root `vite` dependency pins actual Vite 8.3.0 solely for the two frozen
measurement builders. Those builder files remain byte-identical to their reviewed
implementation freezes. No root UI command or configuration remains. The quickstart
lane still installs the Vite version authored in the pinned product documentation.

## Preservation and restoration

The source is commit `6d22c5915a433e07dcdb01c607b6b9dca0e5f35e`.
Before UI removal, the 86 original UI/config/test files were compared byte for
byte with that commit and archived together. Every archived member was then
independently checked against its recorded SHA-256. The independent archive is
[`legacy-ui-before-852-v1.tar.gz`](https://github.com/redact-secret/redact-secret-benchmarks/releases/download/hygiene-before-cleanup-845-20261008/legacy-ui-before-852-v1.tar.gz), SHA-256
`185e3af05f1c81c81dc5606067070c1c0a4e8b4451fc7e5faafd16ff596e521c`.
Release asset `623383332` was downloaded again and digest-verified. The preservation
tag `hygiene-ui-before-retirement-852-20261008` also names the original source commit. Ignored audit
artifacts under `results-output/hygiene/852/` carry the complete caller spans,
86-file preservation inventory and focused validation logs.

Restore an individual historical file into a scratch directory with
`git show 6d22c5915a433e07dcdb01c607b6b9dca0e5f35e:<path>`, or extract it from
the independently digest-verified archive. Restoring a UI source file is not an
authority rollback; reproducing the old UI requires its original source tree and
original package/configuration together. Never apply that old tree over a
current authority or accepted evidence record.

## Removal manifest

Each row is bound to the source commit above. UI rows had only old UI imports or
dedicated UI tests; validator rows preserve the current contract at the new path.

| Path | Bytes | SHA-256 | Disposition |
| --- | ---: | --- | --- |
| `index.html` | 1420 | `3ea801930af1c76d8b47385e55ee114099d735d7ff3089481b725d5f878b84eb` | old-ui-only |
| `scripts/check-support-ui.mjs` | 16419 | `89f8c5e88dad1eb5f8988595f10e1339ce7af6e9f66ec5392bec80df4ff956d2` | old-ui-only |
| `src/catalog.ts` | 3369 | `f9a95a211c507b885ada80e9b739563a40d2b982805db5531aac4198193860d2` | old-ui-only |
| `src/components/action-empty-state.ts` | 945 | `a7c21c01dbcaa901acd8b55efdb3587790298a912e8b3ef6a4cc0d8ac7b379c6` | old-ui-only |
| `src/components/byte-view.ts` | 3679 | `8771e86ccb8be39df90fb9231266ae44ef1ca3074eb0f2bd27f55c3a66b83ab0` | old-ui-only |
| `src/components/commitment-chip.ts` | 1162 | `89059c84c9b873972044e7db412e555f19024f7f6ed2db66877bdbda6a99d521` | old-ui-only |
| `src/components/domain-bar.ts` | 1476 | `29e650c3630ec1a41c647ad3fabaf8b0123fc5f283360193b9d202eb46fcf76b` | old-ui-only |
| `src/components/evidence-crumb.ts` | 752 | `860192b399724fcc92b32dc79b0eed926624631ad4966d2114c27251a969a64b` | old-ui-only |
| `src/components/figure.ts` | 3827 | `764f0b6713c2be5e2a56bffeabdfceee6320b5b07c8e5ec76a86f8341946060d` | old-ui-only |
| `src/components/html.ts` | 455 | `1dcc36ba30babd990e499ac585b073cc3e32f0b1a742d6a7deef59081458dac5` | old-ui-only |
| `src/components/index.ts` | 1101 | `293976cfb918d1b40fa77cf03e68b7b428e01899fed8957f539ea877b9882269` | old-ui-only |
| `src/components/interval.ts` | 1370 | `fc46a8188f1ea66c2b228a592d6dc66b60cee2a7eda6d50e3c89052db59d93e0` | old-ui-only |
| `src/components/pager.ts` | 1338 | `57a899bddaa31c2ce27fbca3c64c7d66bce36c1e5a6dacd56d5e1ab869ea663d` | old-ui-only |
| `src/components/redaction-lane.ts` | 2617 | `2b7fbe9cf66810c88e1b63730b0132bd0e3c776fab8a3f09a528714d9febc037` | old-ui-only |
| `src/components/status-mark.ts` | 1073 | `0a9d8b933bf345cf9647c485c5f37ea8ab08ea455f0a9157cd1364397d3821ea` | old-ui-only |
| `src/evaluation-domains-v2.ts` | 171 | `a61c287ca2290da704d1093a0956304074ea013b430de73c7791cfbe0b005f43` | old-ui-only |
| `src/evaluation-domains.ts` | 165 | `097f68bbcbe76b662a63041483c4f5183ad71245ed03d307801ff37cdfca41a4` | old-ui-only |
| `src/evaluation-model.ts` | 161 | `a40d6114793d18f7c99e1a3fbdf7265c165790def7d0fc34da7d9dbd243271ed` | old-ui-only |
| `src/evaluation-types.ts` | 161 | `4162cf827c795b59d0694b5db6b0de3a36d1d30ae93ec9e93ea7bbe3a4f7bdd8` | old-ui-only |
| `src/inventory.mjs` | 532 | `36d27745c9bb4d2f7da0341b6d81f5d4afbc143c0bb72ad62f05b27c4f06fabf` | old-ui-only |
| `src/logo.ts` | 8375 | `ea33461dd44cc80d732af052a354b35f70ab65fd5c06496cb0fd95b80e83246d` | old-ui-only |
| `src/main.ts` | 24547 | `a923331da2d4ef0332e18a963254d121c5d8c4d8f244d971ad8a9ea154ce6ad7` | old-ui-only |
| `src/model.mjs` | 234 | `5dd640ca4774479981b5113dfd229cd9de3ed8b90911af45b13b4454e9622a3e` | old-ui-only |
| `src/pages/coverage.ts` | 39512 | `ef5be225d0e04c0b9c310924b6855bb17e0cbe47251fdf2cb73d2f40764757ff` | old-ui-only |
| `src/pages/data.ts` | 148 | `7023dfb4ab58d030043522c1776d0a1e7c4d5990c0ea536dcb1a2d77df2ed512` | old-ui-only |
| `src/pages/domain-evaluation.ts` | 11453 | `80357d3e0237e3b3a355240a80abb19e2f768357a5ea21f23afc9742f76b136c` | old-ui-only |
| `src/pages/exploration.ts` | 4285 | `a766e49198d0e762ecfd10d74e4d7e0f775cece76651ca07de39d3af156e7e0b` | old-ui-only |
| `src/pages/figures.ts` | 5028 | `5fdd4d1447e837bc2733e4d6ee57d8bebf7dd1fa5f6c6837e743f0d612c23880` | old-ui-only |
| `src/pages/fixture.ts` | 10445 | `7d8c7f18c81116102e64f72591906e4daf7db3a592cea15c3756e6b139703776` | old-ui-only |
| `src/pages/how-to-read.ts` | 9655 | `2cf6aaa70ae87a794806d1205a31de405b1dba736c51dd43ecec8ea5f9d225e7` | old-ui-only |
| `src/pages/peer-runtime-throughput.ts` | 7026 | `675c0baaedfa5e7ec7ca40ccabd7ca9a630f3fbff179387d26cebd9f1115ba31` | old-ui-only |
| `src/pages/performance.ts` | 14872 | `9bb34182ab2660ef437309474e77f4b079f5dd8d66197f7bfd2c9d9ed9e442af` | old-ui-only |
| `src/pages/pii-support.ts` | 19220 | `03800490d740998ca6a0df6bbee8b776adaac51d969f0fb2cee40d18c766b79e` | old-ui-only |
| `src/pages/providers.ts` | 9627 | `baa292cb968c0195edb4143aa33b93984ec8d1f9910ece81cce7cba10c3e1ed2` | old-ui-only |
| `src/pages/report-hierarchy.ts` | 16504 | `cb39f1dff89e3664157e88ced4fb3426420fe8aa386142439cb54830c4690b47` | old-ui-only |
| `src/pages/report.ts` | 6113 | `8dd1b5bc9ddcd91cbe9ae5871e45b9c899ff58118222818e8a542155d6f74f09` | old-ui-only |
| `src/pages/rows.ts` | 7200 | `6ec430cb6b2ddaa175f15b6e406e98a993de4d108f7001125cee7e7f0c44dabc` | old-ui-only |
| `src/pages/scenario.ts` | 3257 | `d7318c70af7e3be0cca75c24febda7270651ee61f93c9b3f1c3fa9b4d6c013e3` | old-ui-only |
| `src/pages/states.ts` | 3867 | `f067b352de28a02c2abffe1e3174df65c0e718eaab24a6aef93b9ab56b377df6` | old-ui-only |
| `src/pages/suite.ts` | 7359 | `8eb7b8e3cd75171d4dd299cb0919ed1b64f1a243bf7259f46753956181b17b80` | old-ui-only |
| `src/pages/support.ts` | 19211 | `438db396e4637c2679a7ed1e94f613e4ca9022c0dc28549ba66a314d4e67519c` | old-ui-only |
| `src/pages/workbench/changes.ts` | 6376 | `b13cb35929e6e1b04f8b7a622963f2c589b0f282e5d71855d193fb12c79640ab` | old-ui-only |
| `src/pages/workbench/health.ts` | 2972 | `7d9823a4a1a9cd0dd3a07d011332709e4d49410d47fa867299ad54f8f1b65e03` | old-ui-only |
| `src/pages/workbench/index.ts` | 4256 | `243ccde5d04c34e7c1a4a04fd9f1e7cbe5165d663f00fd495b24d5549dbda8ff` | old-ui-only |
| `src/pages/workbench/method.ts` | 15219 | `10c8e9bdaaaae97e483d14d3ec1d07dc8cbf4eec095ae60d20c259a660602472` | old-ui-only |
| `src/pages/workbench/qualification.ts` | 3347 | `b7753aaad1d504cd9dac3a536348a875c4dc21e10899e57dca56d48069e42f3d` | old-ui-only |
| `src/pages/workbench/review.ts` | 10997 | `7c4fa76b191ae9d19b2fe0b6528fda92d1815e1ce811dc8b4d3e429980862ea1` | old-ui-only |
| `src/pages/workbench/shared.ts` | 2351 | `01536e52926f35a8bcfbcb3d4f97e309ddede14f950416e527175bca3bd2df02` | old-ui-only |
| `src/pii-support-model.ts` | 4760 | `daa5f089b492ab5a9b52f8ef9b32b64ac5a8e3708292fb50a3f4d7ec9c4e41d0` | shared-validator-moved |
| `src/provenance.ts` | 3738 | `751b939e8b0b8c0fe75d3a266030660d692e010e5cfe9afb496f95dfdd3b37a0` | old-ui-only |
| `src/providers-model.ts` | 5119 | `a202fb53011af6bcc91248ecd8cf4f9b935a5686f3d2de64813556a065f94ef4` | shared-validator-moved |
| `src/shell.ts` | 7337 | `a96e5f6be7bacd944c4d4ae285aaa5ca782323b9865abff14469cdbbd8ffdb5b` | old-ui-only |
| `src/style.css` | 44243 | `a09f7f69e4a16c177d607078b8ae392d177375a38cb59ce5a1a85865f76ad92c` | old-ui-only |
| `src/support-model.ts` | 155 | `353a15b57307b836069f2ce815f944105307e8f2c46b4979bfad48a306b31a25` | old-ui-only |
| `src/types.ts` | 147 | `d2e899498f7327fd0b5d4361f7f751e012a2c382d15ab0f7ea4d70506ccd0191` | old-ui-only |
| `src/vite-env.d.ts` | 541 | `795c2e074fac80013039987c0ea0832fe380c6573446068063fb64ce3f444d13` | old-ui-only |
| `tests/components.test.mjs` | 9994 | `32c9b3a505bda11d21304897041acf4c576e1fb7830c40ba255948f916d05c03` | old-ui-only |
| `tests/coverage-ui.test.mjs` | 7189 | `f7f089a4e6844af88c26ae23d85c3709a226510545e6298d4c7a1b1c41b87c27` | old-ui-only |
| `tests/family-counting.test.mjs` | 5509 | `b1d292c190dfd32071d3d609052594511b585eb1a5428fdca14ddf47d51f65bb` | old-ui-only |
| `tests/pages.test.mjs` | 29706 | `f12dca84c9eb3e31bce98762436b8df8d2c0b659e967af0d2b3abee648139453` | old-ui-only |
| `tests/peer-runtime-section.test.mjs` | 5312 | `aa6ea11facfe675e9940c04783dc921b3462daecd0496fcc52640bdc7776238b` | old-ui-only |
| `tests/pii-ui.test.mjs` | 8290 | `a0efc5589487a3f6ede042b63af16c5e5e8c3c2ec805e5bfe2efc2e2c2be7175` | old-ui-only |
| `tests/provenance.test.mjs` | 8377 | `6e8da3433d6bf2599801d51e7237d7f201aa4435f967850bc384eea56728e89d` | old-ui-only |
| `tests/report-hierarchy.test.mjs` | 6427 | `a4b9b4822d085b3acfe7c38e644366486b6a3d4e741346a4f22e27e90a4eca1f` | old-ui-only |
| `tests/web-browser-graph.test.mjs` | 3336 | `30b4bb92d7914a2bed28285a4e697b5b222e6faa6a85eeb6c490413a9c2bcfa8` | old-ui-only |
| `vite.config.ts` | 229 | `f42d62dd29a0d9ecfae564bbaa5fc6d25ee636b272f5ccce5170cc94a1c26a71` | old-ui-only |

## Focused validation

The retained root model/data suites pass 132 tests across 16 files. After adding
an explicit released/candidate provenance negative control and empirical
recount tampering, the shared support contract and full-report-reader suites
pass another seven tests. Logs are `focused-final.tap` and
`contract-final.tap` in the ignored audit directory. The pinned Vite 8.3.0 smoke build emits JS and WASM accepted by both unchanged
profile-cost manifest validators; Vite 8.3.2 is rejected. Both frozen builder
CLIs load successfully and keep their original implementation digests. The
profile-cost and publication-language suites pass 37 tests, and the final
production TSX/navigation language gate passes 15 tests, including false claims
in an external-population renderer, negative controls and missing source roots.
The Next integration checks are collected by the integration workstream before
merge. The durable archive receipt is recorded above.
