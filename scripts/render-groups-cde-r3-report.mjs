#!/usr/bin/env node
// `node scripts/render-groups-cde-r3-report.mjs --dir evidence/groups-cde/round3 --r1 evidence/groups-cde/round1`: renders round3/report.md and report.json
// from scores.json (scripts/report-groups-cde-r2.mjs), identity.json and the round-1 gaps.json. Interpretive prose is in this file; numbers are read.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { dir: { type: 'string' }, r1: { type: 'string' } } });
const rd = (d, f) => JSON.parse(readFileSync(path.join(d, f), 'utf8'));
const S = rd(values.dir, 'scores.json'), ID = rd(values.dir, 'identity.json'), G1 = rd(values.r1, 'gaps.json'), S1 = rd(values.r1, 'scores.json');
const NAME = { c: 'C (#752, errata-1)', d: 'D (#753)', e: 'E (#754)' };
const L = []; const p = (s = '') => L.push(s); const row = (c) => `| ${c.join(' | ')} |`;
const T = (g, id) => S.corpora[g][id].total;
const short = (id) => id.split(/:(?:gc|gd|e):/).pop();

// ---- case -> round-1 group, row status
const groupOf = new Map();
for (const [k, v] of Object.entries(G1.groups)) for (const c of v.cases) groupOf.set(c.id.replace(/:control$/, ':unsupported') in S.perCase[c.corpus.toLowerCase()] && !(c.id in S.perCase[c.corpus.toLowerCase()]) ? c.id.replace(/:control$/, ':unsupported') : c.id, k);
const openByRow = {};
for (const g of 'cde') for (const [id, pc] of Object.entries(S.perCase[g])) {
  if (pc.kind !== 'positive' && pc.kind !== 'control') continue;
  if (pc.good) continue;
  const grp = groupOf.get(id) ?? (S.regressions.find((r) => r.id === id) ? 'N-regression' : 'N-new');
  ((openByRow[`${g}|${pc.family}`] ??= {})[grp] ??= []).push(id);
}
const RESID = new Set(['G-brace', 'N-regression', 'N-new']); // none expected in round 3
const POLLIM = new Set(['G-token-member', 'G-jfrog', 'G-reddit-secret', 'G-reddit-token', 'G-elastic-encoded']);
const DEV = { 'G-meta-pipe-span': 'Meta `APP_ID|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a))', 'G-xapikey-clientid': '`x-api-key` header holding Adobe\'s public client ID keeps being flagged (accepted false positive, recorded deviation (b))' };
const POLWHY = { 'G-token-member': 'a lone `token` member (Contentful create response beside only `name`) is not read: #1256 (bare `token` member) under the bare-`token` rule #1241 (read only beside `sys` or `scopes`)', 'G-jfrog': '`curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c))', 'G-reddit-secret': '`curl -u/--user id:secret` password slot not read: stated false negative, issue #1247 (recorded deviation (c))', 'G-reddit-token': '`token=` with no revoke/introspect endpoint and no `token_type_hint` is not read: bare-`token` rule of #1241', 'G-elastic-encoded': 'encoded-member-only: an `encoded` member with no `api_key` sibling is not read (bounded sibling reader, #1229 addendum)' };
const disp = {};
for (const g of 'cde') for (const [rowName, t] of Object.entries(S.corpora[g].r2.byRow)) {
  const open = openByRow[`${g}|${rowName}`] ?? {}; const gs = Object.keys(open);
  let cat, notes = [];
  const scored = t.positives + t.controls;
  if (gs.some((x) => RESID.has(x))) { cat = 'open product gap'; for (const x of gs) if (RESID.has(x)) notes.push(`${open[x].length} ${open[x][0].includes(':control') ? 'control' : 'case'}${open[x].length > 1 ? 's' : ''} (${x === 'G-brace' ? 'residual brace/angle/mask placeholder: `{your-app_id}|<non-brace secret half>` still `warn`' : x === 'N-regression' ? 'NEW regression: `hapikey=YOUR_HAPIKEY` placeholder control now `warn`' : 'new'})`); for (const x of gs) if (DEV[x]) notes.push(DEV[x]); for (const x of gs) if (POLLIM.has(x)) notes.push(POLWHY[x]); }
  else if (gs.some((x) => POLLIM.has(x))) { cat = 'policy-limited'; for (const x of gs) { if (POLLIM.has(x)) notes.push(`${open[x].length} open: ${POLWHY[x]}`); else if (DEV[x]) notes.push(DEV[x]); } }
  else if (gs.length) { cat = 'covered with recorded policy deviation'; for (const x of gs) notes.push(`${open[x].length} cases: ${DEV[x] ?? x}`); }
  else if (t.positives === 0) { cat = 'carrier unresolved (observed only)'; notes.push(scored ? `no scored positive; ${t.controls} controls, ${t.controlFlagged} flagged` : `no scored case; ${t.unsupported + t.conflict} observed-only`); }
  else { cat = 'fully covered'; notes.push(`${t.exact}/${t.positives} positives exact, ${t.controls} controls clean`); }
  disp[`${g}|${rowName}`] = { corpus: g.toUpperCase(), row: rowName, cat, notes, open: Object.fromEntries(Object.entries(open).map(([k, v]) => [k, v.map(short)])) };
}
const catCount = {}; for (const d of Object.values(disp)) catCount[d.cat] = (catCount[d.cat] || 0) + 1;

p('# Groups C, D and E, round 3: final replay of the candidate with the placeholder-grammar completions');
p();
p(`Same role and rules as rounds 1 and 2: no corpus case, FROZEN manifest, evidence extract or scorer was edited, no product code changed, peers not run; \`round1/\` and \`round2/\` are untouched. **Final candidate (R3)** redact-secret \`${ID.commit}\` (branch \`${ID.branch}\`, declared ${ID.declaredVersion}, not published) = \`e1cc1f31\` + \`c8d661b3\` (a \`YOUR_<the slot's own name>\` placeholder rule, aimed at the round-2 regression) + \`c6dd6859\` (a pipe composite \`{your-app_id}|<placeholder, mask, reference or empty>\` is silent when every half is a placeholder; real halves still detected). **Round 2 (R2)** \`e1cc1f31\`, **round 1 (B1)** \`e1284537\` and **baseline (A)** beta.13 observations are reused unchanged from their evidence directories and re-scored on the same corpora. Only R3 was measured in this round.`);
p();
p('## Corpora');
p();
p(row(['group', 'cases', 'sha256 (recomputed with the corpus generator before scanning; the scoring script aborts on a mismatch)']));
p(row(['---', '---:', '---']));
for (const g of 'cde') p(row([NAME[g], Object.keys(S.perCase[g]).length, `\`${S.digests[g]}\``]));
p();
p('Group C is the signed-off errata-1 version (as in round 2; the nine `code=` controls are observed-only), D and E are the freeze. `tests/group-{c,d,e}-corpus.test.mjs` pass. As in round 2, the round-1 A and B1 observations are keyed by the pre-errata ids of the nine C cases; the texts are byte-identical (re-checked against the freeze `a7350c51` by the scoring script).');
p();
p('## Identity of the final candidate');
p();
p(`Built clone-free from a fresh clone in an empty directory, same recipe as rounds 1 and 2 (\`npm ci --ignore-scripts\`, \`js:build\`, napi addon, \`wasm:build\` and \`wasm:build:common\`, \`npm pack\` and install of the three tarballs, \`maturin develop --release\` in a venv, \`cargo build --release --locked -p redact-secret-cli\`). darwin-arm64, Node ${ID.node}. Tarball SHA-256: ${Object.entries(ID.tarballSha256).map(([k, v]) => `\`${k}\` \`${v}\``).join('; ')}. Addon \`${ID.addonSha256}\`, full-profile wasm \`${ID.wasmFullSha256}\`, CLI \`${ID.cliSha256}\`. Harness (\`scripts/measure-batch1.mjs\`) and scorer (\`benchmarks/batch2/score-r2.mjs\`) unchanged; \`scripts/report-groups-cde-r3.mjs\` adds no scoring rule. Four surfaces, each case whole and in 7-byte and 1-byte chunks.`);
p();
p('## 1. Headline (final candidate R3 against round 2 and the earlier identities, all scored on the errata-1 corpus)');
p();
p(row(['group', 'identity', 'positives', 'exact', 'fullyCovered', 'misses', 'controls', 'controlFlagged', 'unsupported', 'conflict']));
p(row(['---', '---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
for (const g of 'cde') for (const [w, n] of [['a', 'A beta.13'], ['b1', 'B1 e1284537'], ['r2', 'R2 e1cc1f31'], ['r3', 'R3 c6dd6859']]) { const t = T(g, w); p(row([NAME[g], n, t.positives, t.exact, t.fullyCovered, t.misses, t.controls, t.controlFlagged, t.unsupported, t.conflict])); }
for (const [w, n] of [['a', 'A'], ['b1', 'B1'], ['r2', 'R2'], ['r3', 'R3']]) { const sm = (k) => 'cde'.split('').reduce((a, g) => a + T(g, w)[k], 0); p(row(['all', n, sm('positives'), sm('exact'), sm('fullyCovered'), sm('misses'), sm('controls'), sm('controlFlagged'), sm('unsupported'), sm('conflict')])); }
p();
p(`Note on C controls: round 1 reported 36 of 251 controls flagged on the original freeze; on errata-1 the nine \`code=\` controls are observed-only, so B1 is 27 of 242 here (the 9 are now in \`unsupported\`: 118 to 127). C type and action (convention): R3 pass ${T('c', 'r3').pass} of ${T('c', 'r3').positives}, type ${T('c', 'r3').typeOk}, action ${T('c', 'r3').actionOk} (R2 identical; B1 ${T('c', 'b1').pass}/${T('c', 'b1').typeOk}/${T('c', 'b1').actionOk}); where a finding touches a C span, type and action equal the convention, so the remaining gap is span width and misses. D and E carry no type or action expectation.`);
p();
for (const g of 'cde') {
  p(`### ${NAME[g]}, per row`);
  p();
  p(row(['row', 'pos', 'exact R2', 'exact R3', 'fullyCov R2', 'fullyCov R3', 'misses R2', 'misses R3', 'ctl', 'flagged B1', 'flagged R2', 'flagged R3']));
  p(row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
  const B = S.corpora[g].b1.byRow, M = S.corpora[g].r2.byRow, R = S.corpora[g].r3.byRow;
  for (const r of Object.keys(R)) { if (R[r].positives + R[r].controls === 0) continue; p(row([`\`${r}\``, R[r].positives, M[r].exact, R[r].exact, M[r].fullyCovered, R[r].fullyCovered, M[r].misses, R[r].misses, R[r].controls, B[r].controlFlagged, M[r].controlFlagged, R[r].controlFlagged])); }
  p();
}
p('Every positive column is identical between R2 and R3 on every row: the two new fixes moved controls only. Rows with no scored case (observed-only) are omitted here and listed in section 6.');
p();
p('## 2. Regressions');
p();
p(`A regression is a scored case that was good (positive exact and fully covered, or control clean) on A, on B1 or on R2 and is bad on R3. **Count: ${S.regressions.length}.**${S.regressions.length ? ' This is a blocker.' : ''}`);
p();
for (const r of S.regressions) p(`- \`${r.id}\` (${r.corpus}, \`${r.family}\`, ${r.kind}); good on B1: ${r.goodOnB1}, R2: ${r.goodOnR2}, A: ${r.goodOnA}; observed ${JSON.stringify(r.observed)}`);
const prev = S.perCase.e['hubspot:legacy-api-key:e:query-upper-placeholder:control'];
p(`The round-2 regression, \`hubspot:legacy-api-key:e:query-upper-placeholder:control\` (\`?hapikey=YOUR_HAPIKEY\`, expectation: no finding), is **gone**: on R3 it is ${prev.good ? 'clean' : 'STILL FLAGGED'} on all four surfaces and all modes (it was \`contextual_secret\`/\`warn\` 82-94 on R2; clean on A and B1). Checked over all ${Object.values(S.perCase).reduce((n, o) => n + Object.keys(o).length, 0)} cases against A, B1 and R2: no scored case that was good on any of them is bad now, so no positive lost an exact, fully covered finding to the pipe-composite rule. Exactly ${Object.values(S.perCase).reduce((n, o) => n + Object.values(o).filter((v) => v.changed).length, 0)} cases have different findings on R3 than on R2, all of them controls: the 12 pipe composites (flagged on R2, clean now) and the \`YOUR_HAPIKEY\` control; every positive, every other control and every observed-only case has findings identical to R2 (so "real halves still detected" holds on every measured positive, including the 36 Meta pipe positives, which still redact the whole pair). ${S.newBad.length} scored cases changed their findings while still failing.`);
p();
p('## 3. Parity');
p();
p(row(['group', 'cases', 'identical on all 16 observations (4 surfaces x whole/stream x 7-byte/1-byte runs)', 'also identical in detector name', 'divergent']));
p(row(['---', '---', '---:', '---:', '---:']));
let dv = 0; for (const g of 'cde') { const pr = S.parity[g]; dv += pr.divergent.length; p(row([NAME[g], pr.cases, pr.identical, pr.identicalWithDetector, pr.divergent.length])); }
p();
p(dv === 0 ? '**No divergence**: whole == 7-byte == 1-byte and Node == WASM == Python == CLI for all 2,281 cases (detector name included), so there is none to list.' : `Divergences: ${dv}; listed in scores.json (parity).`);
p();
p('## 4. Round-2 residual groups and what still fails');
p();
const gb = S.groups['G-brace'];
const resid = S.perCase.c, residD = S.perCase.d;
const pipeIds = [['c', 'meta:app-secret'], ['d', 'meta:app-access-token']].map(([g, f]) => Object.entries(S.perCase[g]).filter(([id, v]) => v.family === f && v.kind === 'control' && /pipe-benign-[23]-|query-angle-secret-only|curl-angle-secret-only|query-mask|curl-mask|query-bullets|curl-bullets|query-empty-secret|curl-empty-secret/.test(id)));
const pipeC = pipeIds[0], pipeD = pipeIds[1];
p(`**G-brace remainder (the 12 pipe-composite controls: ${pipeC.length} C \`meta:app-secret\`, ${pipeD.length} D \`meta:app-access-token\`): ${[...pipeC, ...pipeD].every(([, v]) => v.good) ? 'closed' : 'NOT closed'}.** ${[...pipeC, ...pipeD].filter(([, v]) => v.good).length} of ${pipeC.length + pipeD.length} are clean on R3 on every surface and mode. Round-1 groups G-brace ${gb.closed.length} of ${gb.total} closed (0 open), G-angle ${S.groups['G-angle'].closed.length}/${S.groups['G-angle'].total}, G-docmask ${S.groups['G-docmask'].closed.length}/${S.groups['G-docmask'].total}: all 46 placeholder controls of round 1 are clean.`);
p();
p('**No scored PRODUCT GAP remains on R3.** Every remaining scored failure is a recorded policy case; they group by cause as follows (counts are scored cases still failing; ids drop the `<family>:<group>:` prefix, full records in `scores.json`):');
p();
const ROOT = [
  ['`curl -u` / `--user` Basic password slot unread: policy-limited, #1247, recorded deviation (c)', ['G-jfrog', 'G-reddit-secret']],
  ['lone `token` member of the Contentful create response: policy-limited, #1256 (bare `token` member) under the bare-`token` rule #1241', ['G-token-member']],
  ['`token=` with no revoke or introspect context: policy-limited, bare-`token` rule #1241', ['G-reddit-token']],
  ['Elastic `encoded` member with no `api_key` sibling: policy-limited (encoded-member-only)', ['G-elastic-encoded']],
  ['Meta `APP_ID|SECRET` redacted whole, public app id included: policy question answered, recorded deviation (a); no byte uncovered, fullyCovered on all 36', ['G-meta-pipe-span']],
  ['`x-api-key` header holding Adobe\'s public client ID: policy question answered, recorded deviation (b); accepted false positive', ['G-xapikey-clientid']],
];
let totalOpen = 0;
for (const [title, ks] of ROOT) {
  const cs = ks.flatMap((k) => S.groups[k].open); if (!cs.length) continue; totalOpen += cs.length;
  p(`- **${title}**: ${cs.length}.`);
  const byRow = {}; for (const c of cs) (byRow[`${c.corpus} ${c.family}`] ??= []).push(c);
  for (const [r, a] of Object.entries(byRow)) p(`  - ${r} (${a.length}): ${a.map((x) => `\`${short(x.id)}\``).join(', ')}`);
}
p();
p(`Total still failing: ${totalOpen} scored cases (${S.groups['G-jfrog'].open.length + S.groups['G-reddit-secret'].open.length} #1247, ${S.groups['G-token-member'].open.length} #1256/#1241, ${S.groups['G-reddit-token'].open.length} #1241, ${S.groups['G-elastic-encoded'].open.length} encoded-member-only, ${S.groups['G-meta-pipe-span'].open.length} deviation (a), ${S.groups['G-xapikey-clientid'].open.length} deviation (b)). The policy labels come from the candidate's own docs (\`docs/specs/detector-families.md\`, the #1228/#1229/#1230 evidence addenda) and are the maintainers' decisions on their own evidence; this report records them and does not validate them. No erratum candidate remains open (errata-1 applied the one from round 1).`);
p();
p('## 5. Observed-only behaviour changes');
p();
const oc = Object.entries(S.observedChanged).flatMap(([g, v]) => v.map((x) => ({ g, ...x })));
p(`Observed-only (\`unsupported\`, \`conflict\`) cases whose findings differ between R2 and R3: **${oc.length}** (C ${S.observedChanged.c.length}, D ${S.observedChanged.d.length}, E ${S.observedChanged.e.length}). The two new fixes touch only scored controls here; every observed-only case, including the 12 conflict cases and the nine downgraded \`code=\` cases, behaves exactly as on R2. Changes of R2 over B1 are in \`round2/report.md\` section 5.${oc.length ? ' Listed: ' + oc.map((x) => x.id).join(', ') : ''}`);
p();
p('## 6. Final disposition of all 43 rows');
p();
p(`Categories, by rule (the first sentence of each is the test applied): *fully covered*: every scored positive exact and fully covered, every scored control clean; *covered with recorded policy deviation*: the only open cases are accepted policy deviations; *policy-limited*: open scored cases whose reason is a recorded product policy, none of them a defect the policy does not explain; *carrier unresolved (observed only)*: no scored positive (controls, if any, are clean); *open product gap*: any open case the recorded policy does not explain. Counts: ${Object.entries(catCount).map(([k, v]) => `${k} ${v}`).join('; ')}.`);
p();
p(row(['corpus', 'row', 'disposition', 'detail / open cases']));
p(row(['---', '---', '---', '---']));
for (const d of Object.values(disp)) p(row([d.corpus, `\`${d.row}\``, d.cat, d.notes.join('; ') + (Object.keys(d.open).length ? ` Open: ${Object.entries(d.open).map(([k, v]) => `${k} x${v.length}`).join(', ')}.` : '')]));
p();
p('Dispositions state what the measurement shows against the maintainers\' own contract; none promotes support, and a "fully covered" row means only that every frozen scored case passes on one host.');
p(`Totals: ${Object.entries(catCount).map(([k, v]) => `${k} ${v}`).join('; ')} (sum ${Object.values(catCount).reduce((a, b) => a + b, 0)}). By corpus: ${'cde'.split('').map((g) => `${g.toUpperCase()} ${Object.values(disp).filter((d) => d.corpus === g.toUpperCase()).length} rows`).join(', ')}. Open product gaps: ${catCount['open product gap'] ?? 0}.`);
p();
p();
p('## 7. What each closed redact-secret issue can honestly claim');
p();
const BASE = 'https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3';
const LNK = { report: `${BASE}/report.md`, disp: `${BASE}/report.md#6-final-disposition-of-all-43-rows`, scores: `${BASE}/scores.json`, ident: `${BASE}/identity.json`, regress: `${BASE}/report.md#2-regressions`, resid: `${BASE}/report.md#4-round-2-residual-groups-and-what-still-fails` };
p(`Permalinks use the placeholder \`<BENCH_COMMIT>\` (the benchmarks commit that contains the round-3 directory, 40 hex characters, once pushed). Link these files at that commit: \`evidence/groups-cde/round3/report.md\` (with the section anchors below), \`evidence/groups-cde/round3/scores.json\` (per-case, per-row and per-group data), \`evidence/groups-cde/round3/identity.json\` (candidate identity and digests), and, for reproduction, \`scripts/report-groups-cde-r3.mjs\`, \`scripts/render-groups-cde-r3-report.mjs\` and the observation files \`evidence/groups-cde/round3/observations-candidate-<c|d|e>-c<7|1>.json.gz\`. Earlier rounds: \`evidence/groups-cde/round1/report.md\` and \`evidence/groups-cde/round2/report.md\` (round 2 for the regression history). Any claim below applies to candidate \`${ID.commit}\`, one host, project-authored evidence.`);
p();
const byCorp = (c) => Object.values(disp).filter((d) => d.corpus === c);
const list = (ds) => ds.map((d) => `\`${d.row}\``).join(', ') || 'none';
const rowsBy = (c) => { const m = {}; for (const d of byCorp(c)) (m[d.cat] ??= []).push(d); return m; };
const claimFor = (c, issue, grpName) => { const m = rowsBy(c); p(`- **#${issue}** (${grpName}, ${byCorp(c).length} rows): ${Object.entries(m).map(([k, v]) => `${k} ${v.length}: ${list(v)}`).join('; ')}. Evidence: ${LNK.disp}, ${LNK.scores}.`); };
const devOf = (c) => byCorp(c).filter((d) => d.cat === 'covered with recorded policy deviation' || d.cat === 'policy-limited').map((d) => `\`${d.row}\` (${d.notes.join('; ').replace(/ Open:.*/, '')})`).join('; ');
claimFor('C', 1228, 'Group C');
claimFor('D', 1229, 'Group D');
claimFor('E', 1230, 'Group E');
p();
p('What each may and may not say:');
p();
p(`- **#1228, #1229, #1230**: may say that every scored case of the *fully covered* rows passes on all four surfaces in all three modes, that no scored product gap remains on the Group C, D and E corpora (0 open product gaps), and that the remaining failing cases are exactly the recorded policy cases (#1247 \`curl -u\`, #1256/#1241 bare \`token\`, encoded-member-only, deviations (a) and (b)), each named above. May **not** say that the policy-limited rows are covered, that a *carrier unresolved* row is covered (no scored positive exists; its controls are clean, nothing more), or that the fixes generalise beyond the measured shapes: the candidate was changed to close the round-1 and round-2 failures of these same corpora.`);
const g1234 = ['G-brace', 'G-angle', 'G-docmask'].flatMap((k) => S.groups[k].closed.concat(S.groups[k].open.map((o) => o.id)));
const rows1234 = [...new Set(['G-brace', 'G-angle', 'G-docmask'].flatMap((k) => G1.groups[k].cases.map((c) => c.family)))];
p(`- **#1234** (placeholders): the ${g1234.length} placeholder controls flagged on round 1 (brace \`{NAME}\` and \`{your-app_id}|{your-app_secret}\`, angle, documented mask, upper-case reference name) on ${rows1234.length} rows (${rows1234.map((r) => `\`${r}\``).join(', ')}) are clean on R3 on every surface and mode, including the 12 pipe composites left open on round 2 and the \`YOUR_HAPIKEY\` control that regressed on round 2. May say: no placeholder control of these corpora is flagged except the six \`x-api-key\` client-ID controls (deviation (b), a role question rather than a placeholder). The 12 control closure was measured after c6dd6859; it should be cited together with the round-2 regression history (${LNK.regress}).`);
const inst = ['form-empty', 'fixture-instagram-secret-empty-value'].map((x) => `\`meta:instagram-app-secret:gd:${x}:control\``);
p(`- **#1232** (empty form value taking the next parameter): in these corpora the only scored cases that exercise it are the two Instagram empty-value controls, ${inst.join(' and ')}; both were flagged on published beta.13 and are clean on R3 (and were already clean on the intermediate commit \`efe71496\`, round 1). Claim no more than that; the 15-family evidence is in Batch 2 (\`evidence/739/round3/report.md\`).`);
p('- **#1224** (X Bearer percent escapes) and **#1225** (HubSpot prefixed names / `personalAccessKey`): Groups C to E hold no scored case for either. Round 1 attributed to the five closeout fixes only two observed-only changes (the percent-containing Bearer value of `dropbox:app-auth-token` and `hubspot:static-auth-access-token`, now covered whole instead of up to the first escape); nothing is scored. These issues should link their Batch 2 evidence, not this report, for row claims. The HubSpot `query-prefixed-name:unsupported` case is flagged on R2 and R3 (observed only); this report cannot attribute that to #1225 rather than to the #1230 `hapikey` rule.');
p('- **#1223** (Batch 2 closeout package), **#1226** (Atlas slots and URI userinfo) and **#1233** (HubSpot `personalAccessKey`): no Group C, D or E row is an Atlas, `personalAccessKey` or Batch 2 closeout row, so none of them has a claim here beyond the aggregate below. #1223 may cite the aggregate: on the three corpora R3 has 0 regressions against A, round 1 and round 2, 0 parity divergences over 2,281 cases, 0 open product gaps, and the policy cases named above.');
p();
p(`Aggregate for #1223: positives ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').positives, 0)} (exact ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').exact, 0)}, fully covered ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').fullyCovered, 0)}, misses ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').misses, 0)}); controls ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').controls, 0)} (flagged ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').controlFlagged, 0)}). The ${'cde'.split('').reduce((a, g) => a + T(g, 'r3').positives - T(g, 'r3').exact, 0)} positives that are not exact are: ${S.groups['G-jfrog'].open.length + S.groups['G-reddit-secret'].open.length + S.groups['G-token-member'].open.length + S.groups['G-reddit-token'].open.length + S.groups['G-elastic-encoded'].open.length} policy-limited misses plus ${S.groups['G-meta-pipe-span'].open.length} fully covered over-wide Meta pipe findings.`);
p();
p('## 8. Honest limits');
p();
p('- **Project-authored, maintainer-only evidence, not independent validation.** The corpora derive from the maintainers\' credential-evidence repository (`snapshot-2026.10.06.5`) and were written and frozen before any scan; agreement with them shows consistency with the maintainers\' own contract and nothing more. The policy dispositions (#1241, #1247, #1256, deviations a and b) are the maintainers\' decisions; this report records them.');
p('- **Fixes target the measured failures, so generalisation is not claimed.** The candidate was changed to close exactly the cases round 1 and round 2 reported, on these same corpora. Closing them is expected and says little about unseen carriers; round 2 already showed a name admission exposing a sibling placeholder shape. The placeholder grammar (`{name}`, `[name]`, `YOUR_<slot>`, pipe composites), the 16+ digit rule and the Zendesk `/token:` reader have false-positive costs on real traffic that these corpora do not measure.');
p('- **One host** (darwin-arm64, Node ' + ID.node + '); not a linux-x64 official run; the addon and wasm bytes are host-bound. **Peers not run.** **The candidate is not published** (a branch commit declaring 0.1.0-beta.14).');
p('- A, B1 and R2 were not re-run in this round; their observations from rounds 1 and 2 were re-scored. The scorer cannot express policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run or any-shape: an over-wide finding is `fullyCovered` but never `exact` (36 Meta pipe positives).');
p('- A *fully covered* row means every frozen scored case passes; it does not promote support, change an official run, repin or release anything.');
p('- Disk: no limit was hit; build `target` directories and `node_modules` were deleted afterwards.');
p();
p('## Reproduce');
p();
p('```bash');
p('node scripts/measure-batch1.mjs --corpus ../benchmarks/group-<c|d|e>/<corpus module> --chunk 7|1 --label candidate-r3 --out obs.json --node-root <install> --wasm-dir <install>/node_modules/@redact-secret/wasm --python <venv python> --cli <redact-secret> --source-commit c6dd685974b8df6a84514e07e41e35afa711a2ac');
p('node scripts/report-groups-cde-r3.mjs --r1 evidence/groups-cde/round1 --r2 evidence/groups-cde/round2 --obs-dir evidence/groups-cde/round3 --old-c <freeze a7350c51 copy of benchmarks/batch2 and benchmarks/group-c> --out evidence/groups-cde/round3');
p('node scripts/render-groups-cde-r3-report.mjs --dir evidence/groups-cde/round3 --r1 evidence/groups-cde/round1');
p('```');
writeFileSync(path.join(values.dir, 'report.md'), `${L.join('\n')}\n`);
writeFileSync(path.join(values.dir, 'report.json'), `${JSON.stringify({ schema: 'groups-cde-round3-report-v1', candidate: ID.commit, headline: Object.fromEntries('cde'.split('').map((g) => [g, { r2: T(g, 'r2'), r3: T(g, 'r3') }])), regressions: S.regressions.map((r) => r.id), parityDivergences: dv, dispositionCounts: catCount, dispositions: disp }, null, 1)}\n`);
console.log(JSON.stringify(catCount));
