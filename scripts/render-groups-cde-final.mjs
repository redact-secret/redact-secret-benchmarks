#!/usr/bin/env node
// `node scripts/render-groups-cde-final.mjs [--check]`: renders the per-issue final artifacts of #752, #753 and #754
// (evidence/<issue>/README.md and lineage.json) and evidence/groups-cde/round4-published-beta14/report.md from the committed
// round-1..4 data. Numbers are read from scores.json / report.json / identity.json; this file holds only the interpretive prose.
// It runs no scanner and records no matched text. `--check` fails when a committed file differs from what would be written.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as C from '../benchmarks/group-c/corpus-group-c.mjs';
import * as D from '../benchmarks/group-d/corpus-group-d.mjs';
import * as E from '../benchmarks/group-e/corpus-e.mjs';

const { values } = parseArgs({ options: { check: { type: 'boolean' } } });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const R1 = 'evidence/groups-cde/round1', R2 = 'evidence/groups-cde/round2', R3 = 'evidence/groups-cde/round3', R4 = 'evidence/groups-cde/round4-published-beta14';
const S1 = rd(`${R1}/scores.json`), S2 = rd(`${R2}/scores.json`), S3 = rd(`${R3}/scores.json`), S4 = rd(`${R4}/scores.json`);
const REP3 = rd(`${R3}/report.json`), ID1 = rd(`${R1}/identity.json`), ID3 = rd(`${R3}/identity.json`), ID4 = rd(`${R4}/identity.json`);
const POLICY = rd('evidence/groups-cde/final/row-policy.json');
const GAPS1 = rd(`${R1}/gaps.json`);
const CTL = rd(`${R4}/controls/controls.json`);

const PRODUCT = 'https://github.com/redact-secret/redact-secret';
const CE = 'https://github.com/redact-secret/credential-evidence';
const REC = `${PRODUCT}/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence`;
const GROUPS = {
  c: { issue: 752, name: 'Group C: format-conflict resolution', mod: C, product: 1228, epic: 236, children: [239, 240, 241], rows: 11, dir: 'group-c', manifest: 'FROZEN-group-c.json' },
  d: { issue: 753, name: 'Group D: role, confidentiality and family modelling', mod: D, product: 1229, epic: 237, children: [242, 243, 244], rows: 23, dir: 'group-d', manifest: 'FROZEN-group-d.json' },
  e: { issue: 754, name: 'Group E: historical and current-source reconciliation', mod: E, product: 1230, epic: 238, children: [245, 246, 247], rows: 9, dir: 'group-e', manifest: 'FROZEN-group-e.json' },
};
// Era of a Group E row, from the titles of the research children credential-evidence #245 (retired eras), #246 (deprecation with continuing legacy use), #247 (current Reddit carriers).
const ERA = {
  'adobe:service-account-jwt-private-key': 'historical-only (E1 retired era)', 'airtable:legacy-api-key': 'historical-only (E1 retired era)', 'dropbox:legacy-long-lived-access-token': 'historical-only (E1 retired era)', 'hubspot:legacy-api-key': 'historical-only (E1 retired era; the developer key is current)',
  'jfrog:api-key': 'deprecated with continuing legacy use (E2)', 'zendesk:api-token': 'deprecated with continuing legacy use (E2)',
  'reddit:app-client-secret': 'current carriers beyond archived documentation (E3)', 'reddit:oauth-access-token': 'current carriers beyond archived documentation (E3)', 'reddit:oauth-refresh-token': 'current carriers beyond archived documentation (E3)',
};
const CHILD_OF = {
  'adobe:oauth-server-to-server-client-secret': 239, 'adobe:oauth-web-app-client-secret': 239, 'adobe:enterprise-web-app-client-secret': 239,
  'airtable:personal-access-token': 240, 'dropbox:access-token': 240, 'hubspot:private-app-access-token': 240,
  'contentful:cma-personal-access-token': 241, 'jfrog:reference-token': 241, 'meta:app-secret': 241, 'salesforce:oauth-refresh-token': 241, 'x:oauth1-consumer-secret': 241,
  'adobe:service-account-jwt-private-key': 245, 'airtable:legacy-api-key': 245, 'dropbox:legacy-long-lived-access-token': 245, 'hubspot:legacy-api-key': 245,
  'jfrog:api-key': 246, 'zendesk:api-token': 246, 'reddit:app-client-secret': 247, 'reddit:oauth-access-token': 247, 'reddit:oauth-refresh-token': 247,
};
// Round-1 gap group -> where the product side recorded it (final product records, pinned at core main 2816897f).
const HANDOFF = {
  'G-brace': ['#1234', `${REC}/1234/addendum-brace-angle-mask-placeholders.md`, 'closed'],
  'G-angle': ['#1234', `${REC}/1234/addendum-brace-angle-mask-placeholders.md`, 'closed'],
  'G-docmask': ['#1234', `${REC}/1234/addendum-brace-angle-mask-placeholders.md`, 'closed'],
  'G-xapikey-clientid': ['policy deviation (b), recorded in the detector-families spec row of #1228/#1229/#1230', `${PRODUCT}/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/specs/detector-families.md`, 'recorded; no defect issue'],
  'G-authcode': ['corpus erratum (errata-1 applied on this side); no product issue', '../groups-cde/round1/report.md', 'n/a'],
  'G-meta-pipe-span': ['policy deviation (a), recorded in the same spec row', `${PRODUCT}/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/specs/detector-families.md`, 'recorded; no defect issue'],
  'G-token-member': ['#1256 (open) under #1241 (closed); tokenKey: #1228 addendum', `${REC}/1228/addendum-contentful-create-response-token.md`, 'open decision'],
  'G-jfrog': ['header: #1228 addendum (fixed); curl -u password: #1247 (open)', `${REC}/1228/addendum-jfrog-art-api-header.md`, 'header fixed; password open decision'],
  'G-hapikey': ['#1230 addendum (fixed)', `${REC}/1230/addendum-hapikey.md`, 'closed'],
  'G-reddit-token': ['#1230 addendum (revoke/introspect fixed); bare token=: #1256/#1241', `${REC}/1230/addendum-revoke-token-parameter.md`, 'fixed in context; bare form open decision'],
  'G-reddit-secret': ['curl -u password: #1247 (open)', `${PRODUCT}/issues/1247`, 'open decision'],
  'G-zendesk-cred': ['#1230 addendum (fixed except curl -u); curl -u: #1247 (open)', `${REC}/1230/addendum-zendesk-email-token-credential.md`, 'fixed except curl -u'],
  'G-digits24': ['#1230 addendum (fixed)', `${REC}/1230/addendum-digits-only-values.md`, 'closed'],
  'G-elastic-encoded': ['#1229 addendum (encoded member with an api_key sibling fixed; encoded-only stays a disclosed limit)', `${REC}/1229/addendum-elastic-encoded-member.md`, 'fixed with sibling; encoded-only recorded'],
};

const T = (S, g, id) => S.corpora[g][id].total;
const ROWT = (S, g, id, row) => S.corpora[g][id].byRow[row];
const goodN = (t) => t.exact + (t.controls - t.controlFlagged); // exact implies fully covered; a clean control is good
const scored = (t) => t.positives + t.controls;
const tick = (s) => `\`${s}\``;
const fmt = (t) => `${t.exact}/${t.positives} exact, ${t.controlFlagged}/${t.controls} flagged`;
const cell = (c) => c.replace(/\\/g, '\\\\').replace(/\|/g, '\\|'); // escape backslashes first, then the table pipe

const files = new Map();
function lineageFor(g) {
  const gi = GROUPS[g];
  const cases = gi.mod.cases;
  const byRow = {};
  const add = (row, evCase, id, kind) => { const r = (byRow[row] ??= { evidenceCases: {}, cases: 0, kinds: { positive: 0, control: 0, unsupported: 0, conflict: 0 } }); (r.evidenceCases[evCase] ??= 0); r.evidenceCases[evCase] += 1; r.cases += 1; r.kinds[kind] += 1; };
  if (g === 'c') for (const c of rd('benchmarks/group-c/corpus-index.json').cases) add(c.family, c.evidenceCase, c.id, c.kind);
  if (g === 'd') for (const c of rd('benchmarks/group-d/traceability.json').rows) add(c.family, c.evidenceCase, c.case, c.kind);
  if (g === 'e') for (const c of rd('benchmarks/group-e/traceability-group-e.json')) add(c.family, c.case, c.id, c.kind);
  if (Object.values(byRow).reduce((n, r) => n + r.cases, 0) !== cases.length) throw new Error(`group ${g}: traceability does not cover every case`);
  return byRow;
}

function renderGroup(g) {
  const gi = GROUPS[g], G = g.toUpperCase();
  const lin = lineageFor(g);
  const rows = Object.values(REP3.dispositions).filter((d) => d.corpus === G);
  if (rows.length !== gi.rows) throw new Error(`group ${g}: ${rows.length} rows`);
  const manifest = rd(`benchmarks/${gi.dir}/${gi.manifest}`);
  const cat = (d) => d.cat;
  const kinds = { positive: 0, control: 0, unsupported: 0, conflict: 0 };
  const Lg = []; const p = (s = '') => Lg.push(s);
  const t3 = T(S3, g, 'r3'), ta = T(S3, g, 'a'), tb = T(S3, g, 'b1'), t2 = T(S3, g, 'r2');
  const counts = rows.reduce((m, d) => ((m[d.cat] = (m[d.cat] ?? 0) + 1), m), {});
  const scoredFullyA = (row) => { const a = ROWT(S3, g, 'a', row); return a.positives > 0 && a.exact === a.positives && a.controlFlagged === 0; };
  const improved = (row) => goodN(ROWT(S3, g, 'r3', row)) - goodN(ROWT(S3, g, 'a', row));
  const noCode = rows.filter((d) => d.cat === 'fully covered' && scoredFullyA(d.row));
  const qualified = rows.filter((d) => improved(d.row) > 0);
  const policyRows = rows.filter((d) => d.cat === 'policy-limited' || d.cat === 'covered with recorded policy deviation');
  const unresolved = rows.filter((d) => d.cat === 'carrier unresolved (observed only)');
  const obsOnly = t3.unsupported + t3.conflict;
  const openCases = rows.reduce((n, d) => n + Object.values(d.open).reduce((m, v) => m + v.length, 0), 0);
  const histRows = g === 'e' ? rows.filter((d) => ERA[d.row].startsWith('historical-only')) : [];

  p(`# Evidence: #${gi.issue}, ${gi.name} (${gi.rows} rows)`);
  p();
  p(`**Final artifact of [#${gi.issue}](https://github.com/redact-secret/redact-secret-benchmarks/issues/${gi.issue}).** Rendered by \`scripts/render-groups-cde-final.mjs\` from the committed round 1 to 4 data; it replaces the earlier status page, which was written before the contract was adopted and the corpus measured. This repository records observations and accounting; it does not decide product output, and nothing here changes an official pin, the authority, the ledger or a support status.`);
  p();
  p(`**Result.** The ${gi.rows} rows of ${gi.name.split(': ')[0]} were measured on a frozen, synthetic corpus of ${t3.positives + t3.controls + t3.unsupported + t3.conflict} cases (${t3.positives} positives, ${t3.controls} controls, ${t3.unsupported} unsupported and ${t3.conflict} conflict cases, observed only) on the published beta.13 baseline and on the exact candidate \`c6dd6859\`, and the candidate's behaviour was then reproduced on the **published** \`0.1.0-beta.14\` packages. Final dispositions (round 3, unchanged on the published beta.14): ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join('; ')}. **Open product gaps: 0. Regressions: 0. Parity divergences: 0.** The failing scored cases that remain (${openCases}) are exactly the recorded policy cases named below; they are listed, not hidden, and the policy-limited rows are not called covered.`);
  p();
  p('## 1. Lineage (contract and case)');
  p();
  p('| Layer | Immutable reference |');
  p('| --- | --- |');
  p(`| Product contract (accepted, class level, conditional per row) | [redact-secret#${gi.product}](${PRODUCT}/issues/${gi.product}), merged in [#1243](${PRODUCT}/pull/1243) \`db0e5c8ddf706988967e971593f509daf460c222\`; final record pinned at core \`2816897f\`: [\`evidence/${gi.product}/README.md\`](${REC}/${gi.product}/README.md) |`);
  p(`| Evidence epic and research children | [credential-evidence#${gi.epic}](${CE}/issues/${gi.epic}) (closed); ${gi.children.map((c) => `[#${c}](${CE}/issues/${c})`).join(', ')} (closed); inventory [#231](${CE}/issues/231) |`);
  p(`| Evidence snapshot the cases are authored from | \`${manifest.evidenceSnapshot.tag}\`, commit \`${manifest.evidenceSnapshot.commit}\` (credential-evidence PR #${manifest.evidenceSnapshot.pullRequest}); maintainer-only evidence, **not** independent validation |`);
  p(`| Frozen manifest and freeze commit | [\`benchmarks/${gi.dir}/${gi.manifest}\`](../../benchmarks/${gi.dir}/${gi.manifest}), freeze commit \`a7350c51\` (committed before any scanner, CLI, detector or product build ran on the corpus); record [\`benchmarks/FREEZE-groups-cde.md\`](../../benchmarks/FREEZE-groups-cde.md); sha256 \`${manifest.sha256}\`, ${manifest.cases} cases |`);
  if (g === 'c') p(`| Errata | errata-1 (nine OAuth \`code=\` controls downgraded to observed-only, texts byte-identical): corpus sha256 \`${S3.digests.c}\` ([\`FROZEN-group-c-errata-1.json.proposed\`](../../benchmarks/group-c/FROZEN-group-c-errata-1.json.proposed)); the original manifest is untouched and every measurement after round 1 uses errata-1 |`);
  p(`| Corpus generator and tests | [\`benchmarks/${gi.dir}/\`](../../benchmarks/${gi.dir}/) (traceability: \`TRACEABILITY.md\`), \`tests/group-${g}-corpus.test.mjs\`; scorer \`benchmarks/batch2/score-r2.mjs\` (unchanged) |`);
  p(`| Per-row case lineage | [\`lineage.json\`](lineage.json): per row, the credential-evidence Cases its corpus cases mirror or extend and how many corpus cases each carries |`);
  p();
  p('Authorship was blind to product output and reviewed by one blind reviewer in two rounds (see the freeze record); expectations come from the evidence Cases, never from product or peer output. Where a Case does not support an expectation the case was downgraded to observed-only (`unsupported`, or `conflict`) and kept in the digest. Values are built at runtime from filler; none is a real credential.');
  p();
  p('## 2. Identities and digests');
  p();
  p('| Identity | What | Digest / reference |');
  p('| --- | --- | --- |');
  p(`| **A, baseline** | published 0.1.0-beta.13: \`@redact-secret/core\`, \`wasm\`, \`node-darwin-arm64\` (npm), PyPI \`redact-secret\` 0.1.0b13, \`redact-secret-cli\` 0.1.0-beta.13 (crates.io, \`cargo install --locked\`) | core integrity \`${ID1.published.npmIntegrity['@redact-secret/core'].integrity}\`; addon \`${ID1.published.addonSha256}\`; wasm \`${ID1.published.wasmFullSha256}\`; CLI \`${ID1.published.cliSha256}\` ([round 1 identity](../groups-cde/round1/identity.json)) |`);
  p(`| **B1 / R2, intermediate candidates** | \`e1284537\` and \`e1cc1f31\` (unpublished branch commits), kept for the regression history | [round 1](../groups-cde/round1/identity.json), [round 2](../groups-cde/round2/identity.json) |`);
  p(`| **R3, exact final candidate** | redact-secret \`${ID3.commit}\` (branch \`${ID3.branch}\`, declared ${ID3.declaredVersion}), built clone-free | tarballs: core \`${ID3.tarballSha256['redact-secret-core-0.1.0-beta.14.tgz']}\`; node \`${ID3.tarballSha256['redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz']}\`; wasm \`${ID3.tarballSha256['redact-secret-wasm-0.1.0-beta.14.tgz']}\`; addon \`${ID3.addonSha256}\`; wasm \`${ID3.wasmFullSha256}\`; CLI \`${ID3.cliSha256}\` ([round 3 identity](../groups-cde/round3/identity.json)) |`);
  p(`| **R4, published pin** | published 0.1.0-beta.14 (npm, PyPI 0.1.0b14, crates.io CLI 0.1.0-beta.14), built from core \`0c62fd38\` per the registry provenance | core integrity \`${ID4.published.npm['@redact-secret/core'].integrity}\`; core tarball \`${ID4.published.npm['@redact-secret/core'].tarballSha256}\` (**equal to R3's**); addon \`${ID4.published.installedArtifactSha256['addon (redact-secret.darwin-arm64.node)']}\`; wasm \`${ID4.published.installedArtifactSha256['wasm full profile (redact_secret_wasm_bg.wasm)']}\`; CLI \`${ID4.published.installedArtifactSha256['cli (redact-secret)']}\` ([round 4](../groups-cde/round4-published-beta14/report.md)) |`);
  p();
  p(`Scanner, config, input and environment digests: the harness \`scripts/measure-batch1.mjs\` scans with the product defaults (no configuration file); the input digest is the corpus sha256 above, verified by the generator before scanning and by every scoring script (they abort on a mismatch); environment darwin-arm64, Node ${ID3.node}, one host. Surfaces: Node, WASM (full profile), Python and CLI, each whole and streamed in 7-byte and 1-byte chunks (16 observations per case). Peers were not run (TruffleHog on the host is not the pinned 3.97.4; peers are optional for this correctness track).`);
  p();
  p('## 3. What was measured, per group');
  p();
  p('Exact span, complete sanitized output coverage (`fullyCovered`: no byte of the expected secret uncovered), finding type and action, overlap (over-wide, partial, miss), and whole-versus-stream and four-surface parity, all with the unchanged `score-r2.mjs`. Credential masking, provider attribution and policy behaviour are kept apart: no case expects a provider attribution (a shared generic finding is never counted as a provider detector), type and action are convention-derived and reported separately (Group C only; D and E carry no type or action expectation, so their `pass` is false by construction and the columns below read `exact` and `fullyCovered`).');
  p();
  p('| identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported | conflict |');
  p('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [lab, t] of [['A beta.13', ta], ['B1 e1284537', tb], ['R2 e1cc1f31', t2], ['R3 c6dd6859', t3], ['R4 published beta.14', S4.corpora[g].r4]]) p(`| ${lab} | ${t.positives} | ${t.exact} | ${t.fullyCovered} | ${t.misses} | ${t.controls} | ${t.controlFlagged} | ${t.unsupported} | ${t.conflict} |`);
  p();
  if (g === 'c') p(`Type and action (convention): R3 pass ${t3.pass} of ${t3.positives}, type ${t3.typeOk}, action ${t3.actionOk}; where a finding touches a C span its type and action equal the convention, so the remaining gap is span width and misses.`);
  p();
  p('## 4. Accepted product policy and unresolved properties, per row');
  p();
  p(`From the accepted contract (the core's own per-row tables at \`db0e5c8d\`, condensed in [\`row-policy.json\`](../groups-cde/final/row-policy.json)). "Unresolved" properties are asserted nowhere: they contribute no pass or fail.`);
  p();
  p('| Row | Research child | Accepted policy | Unresolved or unsupported properties |');
  p('| --- | --- | --- | --- |');
  for (const d of rows) p(`| ${tick(d.row)} | ${CHILD_OF[d.row] ? `[#${CHILD_OF[d.row]}](${CE}/issues/${CHILD_OF[d.row]})` : 'D1 to D3 (by Case, see lineage)'} | ${cell(POLICY.rows[d.row].policy)} | ${cell(POLICY.rows[d.row].unresolved)} |`);
  p();
  if (g === 'e') {
    p('Eras (kept separate from detection by the accepted contract: a historical credential is still redacted without any claim that it authenticates):');
    p();
    for (const d of rows) p(`- ${tick(d.row)}: ${ERA[d.row]}`);
    p();
  }
  p('## 5. Per-row final report');
  p();
  p('`positives exact` and `controls flagged` are on the final candidate R3 and on published beta.13 (A); R4 equals R3 on every case. Observed-only counts are unassertable variants (no pass or fail).');
  p();
  p('| Row | cases (pos / ctl / unsup / conflict) | evidence Cases | A beta.13 | R3 = R4 | Final disposition |');
  p('| --- | --- | ---: | --- | --- | --- |');
  for (const d of rows) {
    const a = ROWT(S3, g, 'a', d.row), r = ROWT(S3, g, 'r3', d.row), l = lin[d.row];
    p(`| ${tick(d.row)} | ${r.positives} / ${r.controls} / ${r.unsupported} / ${r.conflict} | ${Object.keys(l.evidenceCases).length} | ${fmt(a)} | ${fmt(r)} | **${d.cat}**: ${cell(d.notes.join(' '))} |`);
    for (const k of Object.keys(kinds)) kinds[k] += r[k === 'positive' ? 'positives' : k === 'control' ? 'controls' : k];
  }
  p();
  p('### Counts, kept separate');
  p();
  p('| Category | Rows | Cases or detail |');
  p('| --- | ---: | --- |');
  p(`| **No-code coverage**: every scored case already passes on published beta.13, no product change needed | ${noCode.length} | ${noCode.map((d) => tick(d.row)).join(', ') || 'none'} |`);
  p(`| **Qualified improvement**: more scored cases good on R3 than on beta.13 (the candidate fixes, now published in beta.14); no row lost a case | ${qualified.length} | ${qualified.map((d) => `${tick(d.row)} (+${improved(d.row)})`).join(', ') || 'none'} |`);
  p(`| **Historical-only** (retired era, redacted without an authentication claim) | ${histRows.length} | ${g === 'e' ? histRows.map((d) => tick(d.row)).join(', ') : 'not applicable to this group (no retired-era row)'} |`);
  p(`| **Policy limits** (recorded product policy leaves scored cases open or deviating) | ${policyRows.length} | ${policyRows.map((d) => `${tick(d.row)} (${d.cat === 'policy-limited' ? 'policy-limited' : 'deviation'}, ${Object.values(d.open).reduce((m, v) => m + v.length, 0)} cases)`).join(', ') || 'none'} |`);
  p(`| **Source-unresolved** (carrier unresolved, observed only; no scored positive, controls clean) | ${unresolved.length} | ${unresolved.map((d) => tick(d.row)).join(', ') || 'none'} |`);
  p(`| **Unassertable variants** (unsupported plus conflict cases; contribute no pass or fail) | n/a | ${obsOnly} cases (${t3.unsupported} unsupported, ${t3.conflict} conflict) across all rows |`);
  p();
  p(`The primary dispositions partition the rows (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}; sum ${gi.rows}); the other counts are separate lenses and overlap with it by design, so they are never added together. Open product gaps: 0. A "fully covered" row means every frozen scored case passes on one host; it does not promote support.`);
  p();
  p('## 6. Gap handoffs');
  p();
  p(`Every confirmed adopted-contract gap of round 1 (a scored case the Case supports and the product failed) is a recorded redact-secret product item with its reproduction (case ids, expected and observed spans in [\`round1/gaps.json\`](../groups-cde/round1/gaps.json) and [\`round1/report.md\`](../groups-cde/round1/report.md)). The handoff target for this group is [redact-secret#${gi.product}](${PRODUCT}/issues/${gi.product}) and, for shared causes, the Batch 2 issues; state as read with \`gh\` on 2026-10-07:`);
  p();
  p('| Round-1 gap group | cases in this group | handed to | final record | status of the item | R3 = R4 (open = recorded policy cases) |');
  p('| --- | ---: | --- | --- | --- | --- |');
  const gaps = S3.groups;
  for (const [k, v] of Object.entries(gaps)) {
    const inG = GAPS1.groups[k].cases.filter((c) => c.corpus === G).length;
    if (!inG) continue;
    const closed = v.closed.filter((id) => id in S3.perCase[g]).length, open = v.open.filter((o) => o.corpus === G).length;
    const h = HANDOFF[k];
    p(`| ${tick(k)} ${cell(GAPS1.groups[k].title)} (${GAPS1.groups[k].triage.toLowerCase()}) | ${inG} | ${h[0]} | [record](${h[1]}) | ${h[2]} | ${closed} closed, ${open} open |`);
  }
  p();
  p(`Item states from \`gh\` on 2026-10-07: redact-secret#${gi.product} closed (2026-10-06); #1234 and #1241 closed; **#1247 (curl -u / --user password carrier) and #1256 (bare \`token\` member) are open maintainer decisions** with their own acceptance criteria. The two deviations (a) Meta \`APP_ID|SECRET\` redacted whole and (b) the Adobe public client ID under \`x-api-key\` are policy decisions recorded in the core's detector-families spec, not defects, so no defect item exists for them. No confirmed gap is left without a recorded item; nothing needed filing from this repository.`);
  p();
  p('## 7. Replay of the fixes and regression controls');
  p();
  p(`The candidate fixes were replayed on the **unchanged inputs** (corpus digests verified before every scan) in three rounds, and the Batch 1 and Batch 2 regression controls were replayed on the published beta.14 in round 4 ([\`controls\`](../groups-cde/round4-published-beta14/report.md#3-regression-controls-batch-1-and-batch-2)): Batch 1 ${CTL.corpora.b1.positives - CTL.corpora.b1.positivesFailing}/${CTL.corpora.b1.positives} positives and ${CTL.corpora.b1.controls - CTL.corpora.b1.controlsFlagged}/${CTL.corpora.b1.controls} controls, Batch 2 round 1 ${CTL.corpora.r1.positives - CTL.corpora.r1.positivesFailing}/${CTL.corpora.r1.positives} and ${CTL.corpora.r1.controls - CTL.corpora.r1.controlsFlagged}/${CTL.corpora.r1.controls}, round 2 ${CTL.corpora.r2.positives - CTL.corpora.r2.positivesFailing}/${CTL.corpora.r2.positives} and ${CTL.corpora.r2.controls - CTL.corpora.r2.controlsFlagged}/${CTL.corpora.r2.controls}, 0 regressions against the accepted Batch 2 round-3 observations ([\`evidence/739/round3/report.md\`](../739/round3/report.md)). Regression rule: a scored case that was good on A, B1 or R2 and is bad later.`);
  p();
  p('| step | regressions | detail |');
  p('| --- | ---: | --- |');
  p('| A to B1 (`e1284537`) | 0 | all changes were improvements, none in C or E ([round 1 report](../groups-cde/round1/report.md#a-against-b)) |');
  p(`| B1 to R2 (\`e1cc1f31\`) | ${g === 'e' ? S2.regressions.filter((r) => r.corpus === 'E').length : 0} | ${g === 'e' ? 'one: `hubspot:legacy-api-key:e:query-upper-placeholder:control` (`?hapikey=YOUR_HAPIKEY`) turned from clean to `warn`; a blocker, fixed in R3 and recorded in the round-2 report' : 'none in this group'} |`);
  p(`| R2 to R3 (\`c6dd6859\`) | 0 | the round-2 regression is gone; every difference from R2 is a control that became clean |`);
  p(`| R3 vs A, B1 and R2, all cases | ${S3.regressions.filter((r) => r.corpus === G).length} | newly introduced leak: none; newly introduced false positive: none; newly introduced parity regression: none |`);
  p(`| R4 (published beta.14) vs R3 | ${S4.regressions.filter((r) => r.corpus === G).length} | ${S4.differentFindings.filter((r) => r.corpus === G).length} cases with any different finding on any surface or mode |`);
  p();
  p(`Controls flagged by identity: A ${ta.controlFlagged}, B1 ${tb.controlFlagged}, R2 ${t2.controlFlagged}, R3 ${t3.controlFlagged}, R4 ${S4.corpora[g].r4.controlFlagged} (of ${t3.controls}); positives exact: ${ta.exact}, ${tb.exact}, ${t2.exact}, ${t3.exact}, ${S4.corpora[g].r4.exact} (of ${t3.positives}). Leaks (positives not fully covered) fell from ${ta.positives - ta.fullyCovered} on A to ${t3.positives - t3.fullyCovered} on R3 and R4.`);
  p();
  p('## 8. Parity');
  p();
  const par = S4.parity[g];
  p(`On the published beta.14 (R4), ${par.identical} of ${par.cases} cases are identical on all 16 observations (Node, WASM, Python, CLI; whole, 7-byte and 1-byte stream), ${par.identicalWithDetector} also in the detector name, ${par.divergent.length} divergent. R3 and A and B1 and R2: 0 divergent as well ([round 3](../groups-cde/round3/report.md#3-parity), [round 1](../groups-cde/round1/report.md#parity)). Range units differ by surface and are converted to UTF-8 byte offsets by the harness.`);
  p();
  p('## 9. Acceptance criteria, as met by this artifact');
  p();
  p('| Criterion | Status | Where |');
  p('| --- | --- | --- |');
  p(`| Each row identifies immutable contract/case lineage and accepted product policy, including unsupported/unresolved properties | met | sections 1 and 4, [\`lineage.json\`](lineage.json) |`);
  p(`| Expected cases authored independently and frozen before execution; synthetic data only | met (maintainer-only evidence, stated, not independent validation) | section 1, freeze record |`);
  p(`| Baseline uses exact published pin and exact candidate/source/artifact identity with scanner/config/input/environment digests | met | section 2, round 3 and round 4 identities |`);
  p(`| Exact span, sanitized output, type/action, overlap and runtime/whole-stream parity; masking, attribution and policy kept apart | met | sections 3 and 8 |`);
  p(`| Every confirmed adopted-contract gap handed to the product issue with reproduction | met | section 6 |`);
  p(`| Replay of exact candidate fixes on unchanged inputs and controls; no new leak, false positive or parity regression | met | section 7 |`);
  p(`| Per-family final report with no-code coverage, qualified improvements, historical-only, policy limits and source-unresolved counts separately | met | section 5 |`);
  p(`| Final artifacts in evidence/${gi.issue}/ and linked back to core/evidence | met | this directory; links in section 1 and 6 |`);
  p(`| Diagnostic outcomes change no official pin, authority, ledger or support status | met | no official-run pin, no credential-qualification authority value, no ledger row and no support status is touched; no workflow was dispatched |`);
  p(`| Performance and slow peer runs remain separate | met | none was run; observations reused by exact identity |`);
  p();
  p('## 10. Honest limits');
  p();
  p('- Project-authored, maintainer-only evidence: agreement shows consistency with the maintainers\' own contract and nothing more. The policy dispositions (#1241, #1247, #1256, deviations (a) and (b)) are the maintainers\' decisions; this page records them.');
  p('- The candidate was changed to close exactly the cases rounds 1 and 2 reported, on these same corpora; generalisation to unseen carriers is not claimed, and the placeholder grammar has false-positive costs on real traffic that these corpora do not measure.');
  p('- One host (darwin-arm64), not a linux-x64 official run; native bytes are host-bound; peers not run.');
  p('- The scorer cannot express policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run or any-shape: an over-wide finding is `fullyCovered` but not `exact`.');
  p('- Official qualification later uses credential-eval RunArtifacts and the normal adoption path; nothing here is that.');
  p();
  p('## Links');
  p();
  p(`[round 1](../groups-cde/round1/report.md) (baseline and gap list), [round 2](../groups-cde/round2/report.md) (regression), [round 3](../groups-cde/round3/report.md) (final candidate, all 43 rows), [round 4](../groups-cde/round4-published-beta14/report.md) (published beta.14), data \`../groups-cde/round{1,2,3}/scores.json\`, \`../groups-cde/round4-published-beta14/scores.json\`; sibling artifacts [#752](../752/README.md), [#753](../753/README.md), [#754](../754/README.md); earlier focused lanes [#717](../717/README.md), [#739](../739/README.md).`);
  p();
  files.set(`evidence/${gi.issue}/README.md`, `${Lg.join('\n')}\n`);
  files.set(`evidence/${gi.issue}/lineage.json`, `${JSON.stringify({ schema: 'groups-cde-lineage-v1', issue: gi.issue, group: G, corpusSha256: S3.digests[g], evidence: { repo: 'redact-secret/credential-evidence', tag: manifest.evidenceSnapshot.tag, commit: manifest.evidenceSnapshot.commit }, contract: { issue: `redact-secret#${gi.product}`, mergedIn: 'redact-secret#1243', commit: 'db0e5c8ddf706988967e971593f509daf460c222' }, rows: Object.fromEntries(rows.map((d) => [d.row, { researchChild: CHILD_OF[d.row] ?? null, evidenceCases: lin[d.row].evidenceCases, corpusCases: lin[d.row].cases, kinds: lin[d.row].kinds, disposition: d.cat }])) }, null, 1)}\n`);
}
for (const g of 'cde') renderGroup(g);

// ---- round 4 report
{
  const Lg = []; const p = (s = '') => Lg.push(s);
  const tot = (id) => { const t = { positives: 0, exact: 0, fullyCovered: 0, misses: 0, controls: 0, controlFlagged: 0, unsupported: 0, conflict: 0 }; for (const g of 'cde') for (const k of Object.keys(t)) t[k] += S4.corpora[g][id][k]; return t; };
  p('# Groups C, D and E, round 4: the same frozen corpora on the PUBLISHED 0.1.0-beta.14');
  p();
  p('Same role and rules as rounds 1 to 3: no corpus case, frozen manifest, evidence extract or scorer was edited; no product code changed; peers not run; `round1/` to `round3/` untouched. Round 3 measured the unpublished candidate `c6dd685974b8df6a84514e07e41e35afa711a2ac` ("declared 0.1.0-beta.14"). `redact-secret` 0.1.0-beta.14 has since been published, so this round answers the acceptance wording "exact published pin and exact candidate identity": are the published packages the measured candidate?');
  p();
  p('## 1. Are the published packages the measured candidate?');
  p();
  p('Read from the registries on 2026-10-07 and compared with [`round3/identity.json`](../round3/identity.json):');
  p();
  p('| Artifact | Round 3 candidate | Published beta.14 | Same bytes |');
  p('| --- | --- | --- | --- |');
  const pub = ID4.published, c3 = ID4.roundThreeCandidate;
  p(`| \`@redact-secret/core\` tarball SHA-256 | \`${c3.tarballSha256['redact-secret-core-0.1.0-beta.14.tgz']}\` | \`${pub.npm['@redact-secret/core'].tarballSha256}\` | **yes** |`);
  p(`| \`@redact-secret/node-darwin-arm64\` tarball | \`${c3.tarballSha256['redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz']}\` | \`${pub.npm['@redact-secret/node-darwin-arm64'].tarballSha256}\` | no (native build, host-bound) |`);
  p(`| \`@redact-secret/wasm\` tarball | \`${c3.tarballSha256['redact-secret-wasm-0.1.0-beta.14.tgz']}\` | \`${pub.npm['@redact-secret/wasm'].tarballSha256}\` | no |`);
  p(`| addon | \`${c3.addonSha256}\` | \`${pub.installedArtifactSha256['addon (redact-secret.darwin-arm64.node)']}\` | no |`);
  p(`| wasm (full profile) | \`${c3.wasmFullSha256}\` | \`${pub.installedArtifactSha256['wasm full profile (redact_secret_wasm_bg.wasm)']}\` | no |`);
  p(`| CLI | \`${c3.cliSha256}\` | \`${pub.installedArtifactSha256['cli (redact-secret)']}\` (crates.io build here) | no |`);
  p();
  p(`Source: the registry provenance (SLSA v1) of \`@redact-secret/core@0.1.0-beta.14\` names \`${pub.npmProvenance.sourceRepository}\` at commit \`${pub.npmProvenance.gitCommit}\` (the registry \`gitHead\` field is empty), published ${pub.npmPublishedAt}. \`c6dd6859\` is an ancestor of that commit. ${ID4.comparison.sourceRelation}.`);
  p();
  p('**Conclusion: not provably the same artifacts** (the native and wasm bytes differ, as they do between any two builds on different hosts), but the JavaScript package is byte-identical and the Rust and binding sources differ only in comments. The behavioural question was therefore answered by replaying the corpora, below.');
  p();
  p('## 2. Replay on the published packages');
  p();
  p(`Installed from the registries into a clean directory: \`@redact-secret/core@0.1.0-beta.14\`, \`@redact-secret/node-darwin-arm64@0.1.0-beta.14\`, \`@redact-secret/wasm@0.1.0-beta.14\` (npm integrity in [\`identity.json\`](identity.json)), PyPI \`redact-secret==0.1.0b14\` in a venv (cp310-abi3 wheel, Python 3.14.7), \`cargo install --locked redact-secret-cli@0.1.0-beta.14\`. Harness \`scripts/measure-batch1.mjs\` unchanged, four surfaces, each case whole and in 7-byte and 1-byte chunks, corpus digests verified (C \`${S4.digests.c}\`, D \`${S4.digests.d}\`, E \`${S4.digests.e}\`). Observations: \`observations-candidate-<c|d|e>-c<7|1>.json.gz\` (per-case findings, no matched text). \`scripts/report-groups-cde-r4.mjs\` compares the full finding signature (start, end, type, action, detector) per case, surface and mode against round 3 and re-scores with the unchanged \`score-r2.mjs\`.`);
  p();
  p('| group | identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported | conflict |');
  p('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const g of 'cde') for (const [lab, id] of [['R3 candidate c6dd6859', 'r3'], ['R4 published beta.14', 'r4']]) { const t = S4.corpora[g][id]; p(`| ${g.toUpperCase()} | ${lab} | ${t.positives} | ${t.exact} | ${t.fullyCovered} | ${t.misses} | ${t.controls} | ${t.controlFlagged} | ${t.unsupported} | ${t.conflict} |`); }
  for (const [lab, id] of [['R3 candidate c6dd6859', 'r3'], ['R4 published beta.14', 'r4']]) { const t = tot(id); p(`| all | ${lab} | ${t.positives} | ${t.exact} | ${t.fullyCovered} | ${t.misses} | ${t.controls} | ${t.controlFlagged} | ${t.unsupported} | ${t.conflict} |`); }
  p();
  p(`**Result: identical.** ${S4.casesCompared} cases compared; ${S4.differentFindings.length} cases have any different finding (start, end, type, action or detector) on any of the 16 observations; ${S4.observationsDifferingByRun} differing observations; **${S4.regressions.length} regressions and ${S4.improvements.length} improvements against round 3**, so there is nothing to classify. Parity on the published packages: ${['c', 'd', 'e'].map((g) => `${g.toUpperCase()} ${S4.parity[g].identical}/${S4.parity[g].cases}`).join(', ')} identical on all 16 observations, detector name included, 0 divergent. Every disposition of [round 3 section 6](../round3/report.md#6-final-disposition-of-all-43-rows) therefore holds for the published beta.14 unchanged: ${Object.entries(REP3.dispositionCounts).map(([k, v]) => `${k} ${v}`).join('; ')}; open product gaps 0.`);
  p();
  p('## 3. Regression controls (Batch 1 and Batch 2)');
  p();
  p('The same published packages on the unchanged Batch 1 and Batch 2 corpora (digests verified), four surfaces, whole, 7-byte and 1-byte; scored with the unchanged scorers (Batch 1 `benchmarks/batch1/score.mjs`, Batch 2 `score-r2.mjs`) and compared with the accepted Batch 2 round-3 observations of candidate `4e004108` ([`evidence/739/round3`](../../739/round3/report.md)). Data: [`controls/controls.json`](controls/controls.json) and `controls/observations-published-<b1|r1|r2>-c<7|1>.json.gz`; script `scripts/report-groups-cde-r4-controls.mjs`.');
  p();
  p('| corpus | cases | sha256 | positives failing | controls flagged | unsupported / conflict (observed) | surface or stream divergence | regressions vs accepted | cases with different findings |');
  p('| --- | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |');
  for (const [k, lab] of [['b1', 'Batch 1'], ['r1', 'Batch 2 round 1'], ['r2', 'Batch 2 round 2']]) { const c = CTL.corpora[k]; p(`| ${lab} | ${c.cases} | \`${c.sha256.slice(0, 12)}...\` | ${c.positivesFailing} of ${c.positives} | ${c.controlsFlagged} of ${c.controls} | ${c.unsupported} / ${c.conflict} | ${c.parityDivergent + c.streamNotEqualWhole} | ${c.regressionsVsAccepted.length} | ${c.casesWithDifferentFindings} |`); }
  p();
  p(`No scored case regressed. The ${CTL.corpora.r1.casesWithDifferentFindings + CTL.corpora.r2.casesWithDifferentFindings} cases whose findings differ from the accepted observations are observed-only (\`unsupported\`, never scored): the percent-containing X Bearer value (\`x:app-only-bearer-token\` \`bearer-percent-raw\` and \`bearer-percent-curl\`, in round 1 and in round 2) is now covered whole instead of up to the first escape (e.g. [22,40] to [22,56]), the effect of the #1224 closeout fix. Nothing is scored for them.`);
  p();
  p('## 4. Limits');
  p();
  p('- Equality is on these corpora, one host (darwin-arm64, Node v22.16.0); the published linux, windows and darwin-x64 binaries were not run. The wasm and native bytes differ from the round-3 build, so identity of those artifacts is behavioural, not byte-level.');
  p('- The Rust diff between `c6dd6859` and the published commit was read as comments only by filtering comment lines from `git diff -U0` over `crates/`, `bindings/` and `src/`; it is a source observation, not a build proof.');
  p('- `round3/report.md` section 7 keeps an unresolved commit placeholder in its permalinks because round 3 is frozen; the permalinks it describes are the files of this directory tree at the commit that merged this change (the issue comments carry them resolved). The relative links in `evidence/752|753|754/README.md` need no commit.');
  p('- Project-authored evidence; peers not run; no official run, workflow dispatch, pin, authority, ledger or support status was touched.');
  p();
  p('## Reproduce');
  p();
  p('```bash');
  p('# install (clean directory): npm i --ignore-scripts @redact-secret/core@0.1.0-beta.14 @redact-secret/node-darwin-arm64@0.1.0-beta.14 @redact-secret/wasm@0.1.0-beta.14');
  p('# venv: pip install redact-secret==0.1.0b14 ; cargo install --locked --root <dir> redact-secret-cli@0.1.0-beta.14');
  p('node scripts/measure-batch1.mjs --corpus ../benchmarks/group-<c|d|e>/<corpus module> --chunk 7|1 --label published-beta14 --out obs.json --node-root <install> --wasm-dir <install>/node_modules/@redact-secret/wasm --python <venv>/bin/python --cli <dir>/bin/redact-secret --source-commit npm:@redact-secret/core@0.1.0-beta.14');
  p('node scripts/report-groups-cde-r4.mjs --r3 evidence/groups-cde/round3 --obs-dir evidence/groups-cde/round4-published-beta14 --out evidence/groups-cde/round4-published-beta14');
  p('node scripts/render-groups-cde-final.mjs');
  p('```');
  p();
  files.set(`${R4}/report.md`, `${Lg.join('\n')}\n`);
}

let bad = 0;
for (const [f, content] of files) {
  const full = path.join(root, f);
  if (values.check) { if (!existsSync(full) || readFileSync(full, 'utf8') !== content) { console.error(`stale: ${f}`); bad++; } } else writeFileSync(full, content);
}
if (bad) process.exit(1);
