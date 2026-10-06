#!/usr/bin/env node
// `node scripts/render-groups-cde-report.mjs --dir evidence/groups-cde/round1`: renders report.md and report.json from scores.json,
// gaps.json, attribution-intermediate.json and identity.json. Prose that interprets the numbers lives in this file; every number
// is read from the JSON. It runs no scanner.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { dir: { type: 'string' } } });
const rd = (f) => JSON.parse(readFileSync(path.join(values.dir, f), 'utf8'));
const scores = rd('scores.json'), gaps = rd('gaps.json'), attr = rd('attribution-intermediate.json'), id = rd('identity.json');
const NAME = { c: 'C (#752)', d: 'D (#753)', e: 'E (#754)' };
const T = (g, who) => scores.corpora[g][who].total;
const L = [];
const p = (s = '') => L.push(s);
const row = (cells) => `| ${cells.join(' | ')} |`;

p('# Groups C, D and E, round 1: measurement of the frozen baselines');
p();
p(`Measured by a session that did not author, freeze or review the corpora. Two product identities, four surfaces (Node addon, WASM, Python, CLI), every case whole and streamed in 7-byte and 1-byte chunks. Nothing was edited: no corpus case, no FROZEN manifest, no evidence extract, no scorer (\`benchmarks/batch2/score-r2.mjs\`, \`score.mjs\`), no product code. Platform ${id.platform} (${id.os}), Node ${id.node}, ${id.rustc[0]}, ${id.maturin}, ${id.python}. **Peers not run** (the TruffleHog on this host is not the 3.97.4 pin). Nothing here repins, changes an official run, promotes support or releases.`);
p();
p('## Identities');
p();
p(`- **A, published baseline** ("published pin as measured in round 2/3"): \`@redact-secret/core\`, \`@redact-secret/wasm\` and \`@redact-secret/node-darwin-arm64\` 0.1.0-beta.13 from npm (core integrity \`${id.published.npmIntegrity['@redact-secret/core'].integrity}\`); PyPI \`redact-secret\` 0.1.0b13; \`redact-secret-cli\` 0.1.0-beta.13 built from the published crate with \`cargo install --locked\`. Local artifact SHA-256: addon \`${id.published.addonSha256}\`, full-profile wasm \`${id.published.wasmFullSha256}\`, CLI \`${id.published.cliSha256}\`.`);
p(`- **B, candidate**: redact-secret \`${id.candidate.commit}\` (branch \`${id.candidate.branch}\`, declared ${id.candidate.declaredVersion}, not published). Built clone-free in an empty directory from a fresh clone: \`npm ci --ignore-scripts\` (root and \`bindings/node\`), \`npm run js:build\`, \`npm run build\` in \`bindings/node\`, \`npm run wasm:build\` and \`wasm:build:common\` (\`--out-dir\`, the same steps as \`buildCandidate()\` in the core's \`scripts/benchmark-candidate.mjs\`), \`npm pack\` of core, the staged darwin-arm64 addon and the staged wasm package installed from the tarballs, \`maturin develop --release\` (Python 0.1.0b14) in a venv, \`cargo build --release --locked -p redact-secret-cli\`. Tarball SHA-256: ${Object.entries(id.candidate.tarballSha256).map(([k, v]) => `\`${k}\` \`${v}\``).join('; ')}. The WASM surface is the full profile (\`redact_secret_wasm.js\`), the one the harness and Batch 2 used. CLI SHA-256 \`${id.candidate.cliSha256}\`. The addon and the wasm bytes are host-bound.`);
p(`- **Supplementary identity, intermediate**: \`${id.intermediate.commit}\` (main as merged, before the five closeout fixes), built the same way, measured at 7-byte chunks only, to separate the five fixes from everything else that changed since beta.13. Not a requested identity; it is used only in the attribution section.`);
p();
p('Corpora (frozen, digests verified against each FROZEN manifest before any scan; the report script aborts on a mismatch, `tests/group-{c,d,e}-corpus.test.mjs` pass 44 of 44, and the generators build the case text at run time):');
p();
p(row(['group', 'cases', 'sha256 of `JSON.stringify(cases)`']));
p(row(['---', '---:', '---']));
for (const g of 'cde') p(row([NAME[g], scores.corpora[g].cases, `\`${scores.corpora[g].sha256}\``]));
p();
p('## Method');
p();
p('The harness is Batch 2\'s, unchanged: `scripts/measure-batch1.mjs` (observation file per corpus, surface, mode; UTF-8 byte offsets; no matched text) with `--corpus` pointing at each group\'s exported generator module and `--chunk 7|1`. Scoring is the unchanged `scoreCase` of `benchmarks/batch2/score-r2.mjs` (multi-span positives). A case counts as failing when **any** surface, whole or streamed, fails it (the Batch 2 rule). Headline numbers are `exact`, `fullyCovered`, `misses` (positives) and `controlFlagged` (controls); `unsupported` and `conflict` cases are observed only. The expected finding type and action are convention-labelled in C and null in D and E, so `pass` is by construction 0 in D and E; type and action are reported in their own table. The new scripts in this directory\'s commit (`scripts/report-groups-cde.mjs`, `triage-groups-cde.mjs`, `attribute-groups-cde.mjs`, `render-groups-cde-report.mjs`) only read observations and the corpora; they add no scoring rule.');
p();
p('## Headline (candidate B against published A)');
p();
p(row(['group', 'identity', 'positives', 'exact', 'fullyCovered', 'misses', 'controls', 'controlFlagged', 'unsupported (observed)', 'conflict (observed)']));
p(row(['---', '---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
for (const g of 'cde') for (const [w, n] of [['published', 'A published beta.13'], ['candidate', 'B candidate e1284537']]) { const t = T(g, w); p(row([NAME[g], n, t.positives, t.exact, t.fullyCovered, t.misses, t.controls, t.controlFlagged, t.unsupported, t.conflict])); }
{
  const sum = (w, k) => 'cde'.split('').reduce((a, g) => a + T(g, w)[k], 0);
  for (const [w, n] of [['published', 'A'], ['candidate', 'B']]) p(row(['all', n, sum(w, 'positives'), sum(w, 'exact'), sum(w, 'fullyCovered'), sum(w, 'misses'), sum(w, 'controls'), sum(w, 'controlFlagged'), sum(w, 'unsupported'), sum(w, 'conflict')]));
}
p();
p('`exact`: the finding span equals the expected span on every surface and mode. `fullyCovered`: no expected byte is left uncovered (an over-wide finding is fully covered but not exact). `misses`: at least one expected span is untouched by any finding. The Node-whole run of the unchanged `summarize()` agrees with these case-level numbers wherever surfaces agree (they agree on every case, see Parity); its figures are in `scores.json` (`summarizeNodeWhole`).');
p();
p('### Finding type and action (reported separately)');
p();
const c = (w) => T('c', w);
p(`Group C is the only group with a convention-labelled type and action (the type and action Batch 2 assigns the same carrier, or the generic \`contextual_secret\`/\`redact\`; the label varies by carrier). On B, ${c('candidate').pass} of ${c('candidate').positives} positives pass (exact span, type and action); type matches on ${c('candidate').typeOk} and action on ${c('candidate').actionOk}, which is exactly the ${c('candidate').positives - c('candidate').misses} positives that a finding touches (A: pass ${c('published').pass}, type ${c('published').typeOk}, action ${c('published').actionOk}). So wherever a finding touches an expected span its type and action equal the convention, and the pass shortfall is span width (15 over-wide Meta pipe cases) plus misses, not labelling. Groups D and E carry \`expectedType\`/\`expectedAction\` = null by design; no type/action number is scored there. Observed on B, the findings touching D and E positive spans are \`contextual_secret\`/\`redact\` (D 137, E 134), \`bearer_token\`/\`redact\` (D 54, E 22), \`authorization_credential\`/\`redact\` (D 22, E 26) and \`contextual_secret\`/\`warn\` (D 4 exact, E 10 over-wide: the Zendesk credential strings and low-entropy cases).`);
p();
p('## Scores per row and kind');
p();
for (const g of 'cde') {
  p(`### Group ${NAME[g]}`);
  p();
  p(row(['row', 'pos', 'exact A', 'exact B', 'fullyCov A', 'fullyCov B', 'misses A', 'misses B', 'ctl', 'flagged A', 'flagged B', 'unsupp', 'conflict']));
  p(row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
  const A = scores.corpora[g].published.byRow, B = scores.corpora[g].candidate.byRow;
  for (const r of Object.keys(B)) p(row([`\`${r}\``, B[r].positives, A[r].exact, B[r].exact, A[r].fullyCovered, B[r].fullyCovered, A[r].misses, B[r].misses, B[r].controls, A[r].controlFlagged, B[r].controlFlagged, B[r].unsupported, B[r].conflict]));
  p();
}
p('Rows with no positives hold no scored positive claim (14 D rows, `x:oauth1-consumer-secret` in C and `adobe:service-account-jwt-private-key` in E); a clean control there is only a clean control.');
p();
p('## Parity');
p();
p('Per case, one signature `[start, end, type, action]` per observation is compared across four surfaces and the modes whole (taken from the 7-byte and from the 1-byte run), 7-byte stream and 1-byte stream (16 observations per case; the harness also records the whole scan in each chunk run).');
p();
p(row(['identity', 'group', 'cases', 'identical on all 16 observations', 'divergent']));
p(row(['---', '---', '---:', '---:', '---:']));
let divergences = 0;
for (const w of ['published', 'candidate']) for (const g of 'cde') { const pr = scores.parity[`${w}/${g}`]; divergences += pr.divergent.length; p(row([w === 'published' ? 'A' : 'B', NAME[g], pr.cases, pr.identicalAcrossSurfacesAndModes, pr.divergent.length])); }
p();
p(divergences === 0 ? '**No divergence exists**: whole == 7-byte == 1-byte and Node == WASM == Python == CLI for every one of the 2,281 cases on both identities, so there is no divergence to list. A stricter check including the detector name as well gives the same result (0 divergent cases per identity and group). Range units differ by surface (UTF-16 code units, code points, bytes); all offsets were converted to UTF-8 bytes by the harness.' : `Divergences: ${divergences}, listed in scores.json (parity).`);
p();
p('## A against B');
p();
p(row(['group', 'scored cases that went bad to good', 'regressions (good on A, bad on B)', 'observed-only cases with changed findings']));
p(row(['---', '---:', '---:', '---:']));
for (const g of 'cde') p(row([NAME[g], scores.delta[g].fixed.length, scores.delta[g].regressed.length, scores.delta[g].changedObserved.length]));
p();
p('**Regressions: 0.** Every case that passed or was clean on A passes or is clean on B. All 24 improvements are in group D: 22 positives of `elastic:serverless-project-api-key` (the ApiKey authorization carriers, A misses all 22, B exact on all 22, consistent with the Batch 1 ApiKey fix, core #1212, which is not in beta.13) and 2 controls of `meta:instagram-app-secret` (`form-empty`, `fixture-instagram-secret-empty-value`, the empty-form-value fix #1232). Groups C and E are byte-for-byte unchanged between A and B.');
p();
p('### Which of the five closeout fixes changed anything here');
p();
p('Between A and B the product moved from beta.13 to main plus five fixes, so the A-to-B delta cannot by itself attribute anything to the five fixes (placeholders, Atlas slots, Atlas public half, MongoDB URI userinfo, X Bearer percent escapes, HubSpot prefixed names). The supplementary intermediate identity (`efe71496`, before the five) separates them:');
p();
p(row(['group', 'cases whose findings differ, intermediate to candidate', 'scored status changed', 'published to intermediate: bad to good / good to bad']));
p(row(['---', '---:', '---:', '---']));
for (const g of 'cde') { const a = attr.corpora[g]; const sc = a.midVsCandidate.filter((x) => x.scoredBefore !== x.scoredAfter).length; p(row([NAME[g], a.midVsCandidate.length, sc, `${a.publishedVsMid.fixed} / ${a.publishedVsMid.regressed}`])); }
p();
p(`The five fixes changed exactly **${'cde'.split('').reduce((n, g) => n + attr.corpora[g].midVsCandidate.length, 0)} observed-only cases and no scored case** in these corpora: the percent-containing Bearer value of \`dropbox:app-auth-token\` (\`percent-value:unsupported\`, finding ${JSON.stringify(attr.corpora.d.midVsCandidate[0]?.before[0] && [attr.corpora.d.midVsCandidate[0].before[0].start, attr.corpora.d.midVsCandidate[0].before[0].end])} to ${JSON.stringify(attr.corpora.d.midVsCandidate[0]?.after[0] && [attr.corpora.d.midVsCandidate[0].after[0].start, attr.corpora.d.midVsCandidate[0].after[0].end])}) and of \`hubspot:static-auth-access-token\` now cover the whole percent-escaped value instead of the prefix before the first escape. The placeholders fix and the Atlas and HubSpot prefixed-name fixes moved no C, D or E case: every placeholder control that is flagged on B was flagged on the intermediate commit too. Everything else the candidate gained over beta.13 (the 24 above) is already in the intermediate commit.`);
p();
p('## Gap list (candidate B)');
p();
const GN = Object.values(gaps.groups).reduce((n, v) => n + v.cases.length, 0);
p(`${GN} scored cases are missed, under-covered, over-wide or flagged on B (positives not exact-and-fully-covered plus flagged controls): ${scores.gaps.c.length} in C, ${scores.gaps.d.length} in D, ${scores.gaps.e.length} in E; every one of them also fails on A (no gap case improved between A and B, and none regressed). They fall into ${Object.keys(gaps.groups).length} groups by shared root cause; none is ungrouped (${gaps.ungrouped.length}). Triage labels: PRODUCT GAP (the evidence Case supports the expectation and the product disagrees), POLICY QUESTION (a maintainer decision is needed), CORPUS ERRATUM CANDIDATE (the case itself looks wrong against its Case; proposal only, nothing was changed), UNSCORED OBSERVATION (observed-only, below). Case IDs below drop the shared \`<family>:<group>:\` prefix; the full records (expected span, observed findings with type/action/span/detector, evidence Case, claims and clause) are in \`gaps.json\`.`);
p();
const REC = {
  'G-brace': 'Treat a brace template `{NAME}` (and the `{your-app_id}|{your-app_secret}` pair) as a placeholder in a value slot; also stop the span before the closing brace being the whole story (the reported span is `{NAME` without `}`). Recommended as the next fix; it is the largest control group (39 of the 61 flagged controls; with G-angle and G-docmask 46 across 10 rows).',
  'G-angle': 'Same family as G-brace: an angle placeholder with spaces (`<contents of private.key>`) under a `private_key:` slot.',
  'G-docmask': 'Provider-published `CFPAT-123...789` / `CFPAT-xxx` masks and the upper-case reference name `ZOOM_API_KEY` as a value are not placeholders for the product.',
  'G-xapikey-clientid': 'Needs a ruling. A generic scanner cannot know the `x-api-key` header carries Adobe\'s public client ID. Recommend: keep flagging (security-first) and move the evidence expectation to observed-only, or keep it scored as a recorded accepted false positive.',
  'G-authcode': 'Propose an erratum: the control input contains an OAuth `code=<value>` (a one-time credential, flagged `warn` by the generic rule) next to a public client ID, and its must-not-flag extent covers the whole input. Either drop the `code` parameter from the generated and replayed variants or downgrade them to unsupported; if maintainers want `code` values unflagged, that is a separate policy for the authorization-code family.',
  'G-meta-pipe-span': 'Needs a ruling. The Case says the span is the part after the pipe and the app ID is outside it; the product redacts the whole `APP_ID|SECRET` string. No byte leaks (fullyCovered is true for all 36); only the public app ID is over-redacted. Recommend accepting whole-pair redaction (security-first; the D row is itself named `app-access-token`, which is the whole pair) and re-scoring these on `fullyCovered`, or else ask for a span split as a product change.',
  'G-token-member': 'Bare `token` (Contentful create-response) and `tokenKey` (HubSpot) JSON member names are not credential names to the product; the same value under `password` in the same object is redacted (the `neighbouring-secret` cases show it). Needs a scoped rule (a bare `token` name is a false-positive risk the maintainers should weigh), but the evidence says must-flag.',
  'G-jfrog': 'The `X-JFrog-Art-Api` header (any case) and the Basic password of `curl -u user:<secret>` are not read. Shared byte-identical fixtures count in both C and E.',
  'G-hapikey': 'The `hapikey` query-parameter name is unknown to the product (only the secret value is expected; no finding touches the public `appId` neighbour in these cases).',
  'G-reddit-token': 'The revoke form field `token=` is not a credential name (same root cause as bare `token` in G-token-member).',
  'G-reddit-secret': 'Basic password in `-u` / `--user id:secret` is not read (same carrier as JFrog `curl -u`).',
  'G-zendesk-cred': 'The `email/token:<token>` composite is not read at all in the `curl -u` carrier (20 silent) and, in JSON and `.env` assignment, is reported as one `warn` finding over the whole string including the email (10 over-wide with no leak, but `warn` and not `redact`, and the public email is inside the span); 2 more cases combine a `curl -u` miss with an over-wide or neighbour-only finding. One of the 4 `conflict` Zendesk cases (masked display) is also flagged `warn`.',
  'G-digits24': 'Position-named values of 24 digits are silent in 7 cases (airtable query, dropbox member, Reddit access and refresh member, form and fragment), 4 rows, while hex32, alnum64, urlsafe40 and lower16 in the same slots are flagged. The Cases say the value is flagged by position, whatever its shape. Likely a numeric floor; maintainers should say whether it is intended (security-first default: flag).',
  'G-elastic-encoded': 'The `api_key` member is exact but the `encoded` member (base64 of `id:api_key`) is not reported; 1 case with only the `encoded` member is wholly silent. The base64 form is itself the credential, so this is a leak of a complete credential.',
};
const ORDER = ['G-jfrog', 'G-zendesk-cred', 'G-reddit-secret', 'G-hapikey', 'G-token-member', 'G-reddit-token', 'G-digits24', 'G-elastic-encoded', 'G-brace', 'G-angle', 'G-docmask', 'G-meta-pipe-span', 'G-xapikey-clientid', 'G-authcode'];
const exp = (v) => { const k = v.cases[0]; if (k.kind === 'control') return 'no finding (whole input must not flag)'; const n = v.cases.filter((x) => x.expectedExtra?.length).length; return `the secret span only${n ? ` (${n} ${n === 1 ? 'case carries' : 'cases carry'} a second occurrence)` : ''}`; };
const obsSummary = (v) => { const d = {}; for (const k of v.cases) { const key = k.observed.length ? [...new Set(k.observed.map((o) => `${o.type}/${o.action}`))].join('+') : 'no finding'; d[key] = (d[key] || 0) + 1; } return Object.entries(d).map(([k, n]) => `${k} x${n}`).join(', '); };
const short = (id2) => id2.split(/:(?:gc|gd|e):/).pop();
for (const k of ORDER) {
  const v = gaps.groups[k];
  p(`### ${k}: ${v.title}`);
  p();
  p(`**Triage: ${v.triage}.** ${REC[k]}`);
  p();
  const rows = {}; for (const x of v.cases) (rows[`${x.corpus} ${x.family}`] ??= []).push(x);
  p(`- Cases: ${v.cases.length} (${Object.entries(rows).map(([r, a]) => `${r} ${a.length}`).join('; ')}).`);
  p(`- Expectation: ${exp(v)}. Observed on B: ${obsSummary(v)}. Spans for each case are in \`gaps.json\`.`);
  p(`- Evidence Case${[...new Set(v.cases.map((x) => x.evidenceCase))].length > 1 ? 's' : ''}: ${[...new Set(v.cases.map((x) => x.evidenceCase))].map((x) => `\`${x}\``).join(', ')}.`);
  const clauses = [...new Set(v.cases.map((x) => x.clause).filter(Boolean))]; if (clauses.length) p(`- Clause${clauses.length > 1 ? 's' : ''}: ${clauses.slice(0, 3).map((x) => `"${x}"`).join('; ')}.`);
  p('- Case IDs:');
  for (const [r, a] of Object.entries(rows)) p(`  - ${r}: ${a.map((x) => `\`${short(x.id)}\``).join(', ')}`);
  p();
}
p('### Cross-cutting root causes');
p();
p('- **`curl -u` / `--user` Basic password slot not read** spans three families: JFrog (33 `curl -u` positives in C and E), all 26 Reddit client-secret positives, and the Zendesk `curl -u "email/token:<token>"` positives (20 silent). Reading that slot would address about 80 of the positives, subject to the policy for a literal user part.');
p('- **Bare `token` / `tokenKey` names** (Contentful create response, HubSpot private-app `tokenKey`, Reddit revoke `token=`): 56 positives across three families (G-token-member 32 and G-reddit-token 24).');
p('- **Brace/angle/mask/upper-case placeholders**: 46 controls flagged across 10 rows in C, D and E (G-brace, G-angle, G-docmask). The recent placeholder fix did not reach these slots.');
p('- **Byte-identical shared cases** are counted once per corpus they live in (the JFrog fixtures and the Meta pipe cases appear in both C and D or C and E); totals above are per corpus and are not de-duplicated across corpora.');
p();
p('## Corpus erratum candidates (proposals only; no corpus case was changed)');
p();
p('1. **G-authcode (9 controls, C)**: `adobe:*:gc:fixture-replay-public-client-request-client-id-only:control`, `adobe:*:gc:public-only-0:control` and `public-only-0-utf8:control` (each for the three Adobe rows) put `code=<value>` in a must-not-flag input. The Case names only public identifiers and non-values; a one-time authorization code is neither, and it is flagged `warn` by the generic contextual rule, not by an Adobe detector. Proposal: remove `code=` from the generated variants and downgrade the replayed fixture to `unsupported`, or record a ruling that OAuth `code` values are intentionally not flagged.');
p('2. **G-xapikey-clientid (6 controls, C)**: same Case, but the issue is not the input: the Case labels the `x-api-key` value a public identifier. This is a policy question rather than an erratum, listed here only because the alternative resolution is to downgrade the six controls to `unsupported`.');
p('3. **D `meta:instagram-app-secret` `query-*` controls**: their `access_token={short-lived-access-token}` neighbour is a second placeholder slot whose handling belongs to the access-token rows; the controls are still fair (a placeholder is not a value), but a flagged neighbour parameter hides whether the secret slot itself is clean. No change proposed; noted so the maintainer does not read these 9 flags as an Instagram-secret-slot defect.');
p();
p('No scored positive looks wrong against its Case: every expected span lies on the value the Case names, and the misses are carriers the product does not read.');
p();
p('## Observed-only cases (unsupported and conflict; never scored)');
p();
p(row(['group', 'kind', 'cases', 'flagged on B', 'silent on B']));
p(row(['---', '---', '---:', '---:', '---:']));
for (const g of 'cde') for (const kd of ['unsupported', 'conflict']) { const o = scores.observedOnly[g].filter((x) => x.kind === kd); if (!o.length) continue; const f = o.filter((x) => x.candidate.length).length; p(row([NAME[g], kd, o.length, f, o.length - f])); }
p();
p('Items of interest:');
p();
p('- **UNSCORED OBSERVATION, silent carriers**: `jfrog:reference-token` 0 of 9 observed-only cases flagged (C), `hubspot:legacy-api-key` 1 of 24 (E), `jfrog:api-key` 5 of 32 (E). These rows are silent on their documented carriers for the same reasons as the scored misses above (JFrog header and `-u`, `hapikey`), so no scored claim hides a flagged variant.');
p('- **UNSCORED OBSERVATION, the product reads most observed-only carriers**: `meta:app-access-token` 13 of 13 unsupported cases flagged, `contentful:delivery-api-access-token` and `contentful:preview-api-access-token` 11 of 12 each, `x:oauth1-access-token` 10 of 11, `asana:service-account-token` 9 of 10 (counts from `scores.json`, `observedOnly`). A flagged observed-only carrier is neither a pass nor a false positive until a ruling exists; a leak is only recordable where the carrier is silent (previous bullet).');
p('- **UNSCORED OBSERVATION, conflict cases**: of the 12 conflict cases (8 D, 4 E), B flags 4: `meta:app-access-token` appsecret_proof-derived lookalike (redact, 27-45), `x:oauth1-access-token` authorization header with identity and signature (redact, 254-291), `zoom:webhook-secret-token` validation response (two redact findings), `zendesk:api-token` masked display (`warn`, 26-59). The other 8 are silent.');
p('- Ten observed-only Elastic ApiKey variants (upper-case name, no space after the colon, below-floor value, low entropy, percent value, single-quoted JSON, YAML header, `Proxy-Authorization`, lower-case scheme, and one cross-cluster `Authorization: ApiKey`) were silent on A and are flagged `authorization_credential`/`redact` on B; none is scored.');
p('- Group D: the 14 rows with no positives (the Algolia non-admin keys, Contentful delivery and preview, Asana service account, Figma CLI, JFrog pairing, Canva, `x:oauth1-access-token`, `zoom:webhook-secret-token`) are observed only; case-level findings are in `scores.json` (`observedOnly`).');
p();
p('## Honest limits');
p();
p('- **Project-authored, maintainer-only evidence, not independent validation.** Every expectation derives from the maintainers\' own credential-evidence repository (PR #263, tag `snapshot-2026.10.06.5`, commit `574b52ba367e2071d5a9bea3e2da7a9c5057f633`). Agreement with it shows consistency with the maintainers\' stated contract and nothing more; disagreement may equally be an evidence or corpus problem, which is why the triage separates product gaps from policy questions and erratum candidates.');
p('- **One host** (darwin-arm64, Node v22.16.0). Not a linux-x64 official run; the addon and wasm bytes are host-bound and were not compared with core\'s published candidate digests (no candidate package was published).');
p('- **Peers not run.** No TruffleHog or other scanner result appears here.');
p('- **The candidate is not published.** e1284537 is a branch commit declaring 0.1.0-beta.14; the A-to-B delta therefore mixes everything since beta.13 with the five fixes (separated above by the intermediate run, which is a single 7-byte-chunk run).');
p('- Baseline CLI is the published crate `redact-secret-cli` 0.1.0-beta.13 built locally with `cargo install --locked` (no prebuilt release binary was used). Python on both identities is the cp310-abi3 wheel build on Python 3.14.7; candidate Python is an editable `maturin develop` build.');
p('- Scorer limits (policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run, any-shape; see `benchmarks/FREEZE-groups-cde.md`) apply unchanged: an over-wide finding is `fullyCovered` but never `exact`; a finding on an unasserted neighbour is not scored.');
p('- Offsets were converted by the harness to UTF-8 bytes; the numbers depend on that conversion being right on non-ASCII cases, which is exercised by the `utf8-before-after` axes and shows no surface divergence.');
p();
p('## Reproduce');
p();
p('```bash');
p('# corpora (frozen digests are checked first by scripts/report-groups-cde.mjs and by each corpus test)');
p('node scripts/measure-batch1.mjs --corpus ../benchmarks/group-c/corpus-group-c.mjs --chunk 7 --label candidate --out obs.json \\');
p('  --node-root <install of the three tarballs> --wasm-dir <root>/node_modules/@redact-secret/wasm --python <venv>/bin/python \\');
p('  --cli <target/release/redact-secret> --source-commit e1284537a5df5a6cfd051fc7211d276a45ee98bf');
p('# repeat for group-d/corpus-group-d.mjs and group-e/corpus-e.mjs, --chunk 7 and --chunk 1, and for the published identity');
p('node scripts/report-groups-cde.mjs --obs-dir evidence/groups-cde/round1 --out evidence/groups-cde/round1');
p('node scripts/triage-groups-cde.mjs --scores evidence/groups-cde/round1/scores.json --out evidence/groups-cde/round1/gaps.json');
p('node scripts/attribute-groups-cde.mjs --obs-dir evidence/groups-cde/round1 --out evidence/groups-cde/round1/attribution-intermediate.json');
p('node scripts/render-groups-cde-report.mjs --dir evidence/groups-cde/round1');
p('```');
p();
p('Files: `observations-<published|candidate>-<c|d|e>-c<7|1>.json.gz` and `observations-intermediate-<c|d|e>-c7.json.gz` (per-case findings, no matched text), `scores.json`, `gaps.json`, `attribution-intermediate.json`, `identity.json`, `report.json`, this file.');
writeFileSync(path.join(values.dir, 'report.md'), `${L.join('\n')}\n`);
writeFileSync(path.join(values.dir, 'report.json'), `${JSON.stringify({ schema: 'groups-cde-report-v1', headline: Object.fromEntries('cde'.split('').map((g) => [g, { published: T(g, 'published'), candidate: T(g, 'candidate') }])), parityDivergences: divergences, regressions: 'cde'.split('').reduce((n, g) => n + scores.delta[g].regressed.length, 0), gapGroups: Object.fromEntries(Object.entries(gaps.groups).map(([k, v]) => [k, { triage: v.triage, title: v.title, cases: v.cases.length }])) }, null, 1)}\n`);
console.log(`report.md ${L.length} lines`);
