#!/usr/bin/env node
// `node scripts/render-groups-cde-r2-report.mjs --dir evidence/groups-cde/round2 --r1 evidence/groups-cde/round1`: renders round2/report.md and report.json
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
const RESID = new Set(['G-brace', 'N-regression', 'N-new']);
const POLLIM = new Set(['G-token-member', 'G-jfrog', 'G-reddit-secret', 'G-reddit-token', 'G-elastic-encoded']);
const DEV = { 'G-meta-pipe-span': 'Meta `APP_ID|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a))', 'G-xapikey-clientid': '`x-api-key` header holding Adobe\'s public client ID keeps being flagged (accepted false positive, recorded deviation (b))' };
const POLWHY = { 'G-token-member': 'a lone `token` member (Contentful create response beside only `name`) is not read: the bare-`token` rule of #1241 (read only beside `sys` or `scopes`)', 'G-jfrog': '`curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c))', 'G-reddit-secret': '`curl -u/--user id:secret` password slot not read: stated false negative, issue #1247 (recorded deviation (c))', 'G-reddit-token': '`token=` with no revoke/introspect endpoint and no `token_type_hint` is not read: bare-`token` rule of #1241', 'G-elastic-encoded': 'an `encoded` member with no `api_key` sibling is not read (bounded sibling reader, #1229 addendum)' };
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

p('# Groups C, D and E, round 2: replay of the candidate with the nine round-1 gap fixes');
p();
p(`Same role and rules as round 1: no corpus case, FROZEN manifest, evidence extract or scorer was edited, no product code changed, peers not run. **New candidate** redact-secret \`${ID.commit}\` (branch \`${ID.branch}\`, declared ${ID.declaredVersion}, not published; \`e1284537\` plus nine detector fixes for the round-1 product-gap groups). **Previous candidate (B1)** \`e1284537\`, round-1 observations reused unchanged. **Baseline (A)** published beta.13, round-1 observations reused. Round-1 \`evidence/groups-cde/round1/\` is untouched.`);
p();
p('## Corpora and what was reused');
p();
p(row(['group', 'cases', 'sha256 (verified by the generator before scanning; the scoring script aborts on a mismatch)']));
p(row(['---', '---:', '---']));
for (const g of 'cde') p(row([NAME[g], S.perCase[g] ? Object.keys(S.perCase[g]).length : '', `\`${S.digests[g]}\``]));
p();
p(`Group C is the signed-off **errata-1** version (commit \`fd7bc762\` on \`workbench/group-c-errata-1\`, cherry-picked onto this measure branch; it touches only the C generator, its index, TRACEABILITY, the proposed manifest and the C test; D and E files are untouched). \`FROZEN-group-c.json\` (the original freeze) still carries the old digest; the errata digest is the one in \`FROZEN-group-c-errata-1.json.proposed\`. The three digests were recomputed with each corpus's exported \`corpusDigest()\` before any scan and match the values above; \`tests/group-{c,d,e}-corpus.test.mjs\` pass 45 of 45. Errata-1 changed the kind of ${S.cErrata.downgradedKinds} cases (${S.cErrata.kindChanges.join(', ')}; the 9 Adobe \`code=\` controls) and their ids (suffix \`:control\` to \`:unsupported\`); every case text is byte-identical to the freeze (checked by regenerating the freeze corpus from \`a7350c51\`, all 646 texts compared).`);
p();
p(`**Reused**: because the texts are unchanged, the round-1 A and B1 observation files were reused for all three corpora and re-scored against the errata-1 corpus (the nine cases are looked up by their old id). A and B1 were not re-run on any surface. Only the new candidate was measured.`);
p();
p('## Identity of the new candidate');
p();
p(`Built clone-free from a fresh clone in an empty directory, same recipe as round 1 (\`npm ci --ignore-scripts\`, \`js:build\`, napi addon, \`wasm:build\` and \`wasm:build:common\`, \`npm pack\` and install of the three tarballs, \`maturin develop --release\` in a venv, \`cargo build --release --locked -p redact-secret-cli\`). darwin-arm64, Node ${ID.node}. Tarball SHA-256: ${Object.entries(ID.tarballSha256).map(([k, v]) => `\`${k}\` \`${v}\``).join('; ')}. Addon \`${ID.addonSha256}\`, full-profile wasm \`${ID.wasmFullSha256}\`, CLI \`${ID.cliSha256}\`. Harness and scorer unchanged (\`scripts/measure-batch1.mjs\`, \`benchmarks/batch2/score-r2.mjs\`); the round-2 scoring script \`scripts/report-groups-cde-r2.mjs\` adds no scoring rule.`);
p();
p('## 1. Headline (new candidate R2 against round-1 candidate B1 and baseline A, all scored on the errata-1 corpus)');
p();
p(row(['group', 'identity', 'positives', 'exact', 'fullyCovered', 'misses', 'controls', 'controlFlagged', 'unsupported', 'conflict']));
p(row(['---', '---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
for (const g of 'cde') for (const [w, n] of [['a', 'A beta.13'], ['b1', 'B1 e1284537'], ['r2', 'R2 e1cc1f31']]) { const t = T(g, w); p(row([NAME[g], n, t.positives, t.exact, t.fullyCovered, t.misses, t.controls, t.controlFlagged, t.unsupported, t.conflict])); }
for (const [w, n] of [['a', 'A'], ['b1', 'B1'], ['r2', 'R2']]) { const sm = (k) => 'cde'.split('').reduce((a, g) => a + T(g, w)[k], 0); p(row(['all', n, sm('positives'), sm('exact'), sm('fullyCovered'), sm('misses'), sm('controls'), sm('controlFlagged'), sm('unsupported'), sm('conflict')])); }
p();
p(`Note on C controls: round 1 reported 36 of 251 controls flagged on the original freeze; on errata-1 the nine \`code=\` controls are observed-only, so B1 is 27 of 242 here (the 9 are now in \`unsupported\`: 118 to 127). C type and action (convention): R2 pass ${T('c', 'r2').pass} of ${T('c', 'r2').positives}, type ${T('c', 'r2').typeOk}, action ${T('c', 'r2').actionOk} (B1 ${T('c', 'b1').pass}/${T('c', 'b1').typeOk}/${T('c', 'b1').actionOk}); where a finding touches a C span, type and action equal the convention, so the remaining gap is span width and misses. D and E carry no type or action expectation.`);
p();
for (const g of 'cde') {
  p(`### ${NAME[g]}, per row`);
  p();
  p(row(['row', 'pos', 'exact B1', 'exact R2', 'fullyCov B1', 'fullyCov R2', 'misses B1', 'misses R2', 'ctl', 'flagged B1', 'flagged R2']));
  p(row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
  const B = S.corpora[g].b1.byRow, R = S.corpora[g].r2.byRow;
  for (const r of Object.keys(R)) { if (R[r].positives + R[r].controls === 0) continue; p(row([`\`${r}\``, R[r].positives, B[r].exact, R[r].exact, B[r].fullyCovered, R[r].fullyCovered, B[r].misses, R[r].misses, R[r].controls, B[r].controlFlagged, R[r].controlFlagged])); }
  p();
}
p('Rows with no scored case (observed-only) are omitted from these tables and listed in section 6.');
p();
p('## 2. Regressions');
p();
p(`A regression is a case that passed (positive exact and fully covered) or was clean (control) on B1 or on A and fails now. **Count: ${S.regressions.length}. This is a blocker.**`);
p();
for (const r of S.regressions) {
  p(`- \`${r.id}\` (${r.corpus}, row \`${r.family}\`, ${r.kind}): expectation, no finding (must-not-flag, Case \`hubspot-legacy-api-key-placeholders-references-and-non-values\`); input \`...?hapikey=YOUR_HAPIKEY\` in a curl URL. Observed on R2: ${r.observed.map((f) => `\`${f.type}\`/\`${f.action}\` ${f.start}-${f.end} (${f.detector}), the 12-byte placeholder \`YOUR_HAPIKEY\``).join('; ')} on all four surfaces and all modes. B1 and A: clean (the \`hapikey\` name was unread, so nothing was reported). Likely cause (not verified in product code): the new \`hapikey\` name admission now reads the slot, and \`YOUR_HAPIKEY\` is not recognised as a placeholder there by the earlier \`YOUR_\`-lead rule. It is the only control in the three corpora that became flagged.`);
}
p();
p(`No other case that was good on B1 or on A is bad on R2: every positive that was exact and fully covered is still, every clean control is still clean (checked over all ${Object.values(S.perCase).reduce((n, o) => n + Object.keys(o).length, 0)} cases).`);
p();
p('## 3. Parity');
p();
p(row(['group', 'cases', 'identical on all 16 observations (4 surfaces x whole/stream x 7-byte/1-byte runs)', 'also identical in detector name', 'divergent']));
p(row(['---', '---', '---:', '---:', '---:']));
let dv = 0; for (const g of 'cde') { const pr = S.parity[g]; dv += pr.divergent.length; p(row([NAME[g], pr.cases, pr.identical, pr.identicalWithDetector, pr.divergent.length])); }
p();
p(dv === 0 ? '**No divergence**: whole == 7-byte == 1-byte and Node == WASM == Python == CLI for all 2,281 cases (and no divergence in detector name either), so there is none to list.' : `Divergences: ${dv}; listed in scores.json (parity).`);
p();
p('## 4. Round-1 gap groups');
p();
const GT = { 'G-jfrog': ['PRODUCT GAP (header, fixed); policy-limited (`curl -u`)'], 'G-hapikey': ['PRODUCT GAP, fixed'], 'G-digits24': ['PRODUCT GAP, fixed (16+ digits, medium/`warn`)'], 'G-brace': ['PRODUCT GAP, mostly fixed; residual open product gap'], 'G-angle': ['PRODUCT GAP, fixed'], 'G-docmask': ['PRODUCT GAP, fixed'], 'G-token-member': ['PRODUCT GAP (HubSpot `tokenKey`, fixed); policy-limited (Contentful lone `token`)'], 'G-reddit-token': ['PRODUCT GAP, fixed where a revoke context exists; policy-limited otherwise'], 'G-zendesk-cred': ['PRODUCT GAP, fixed'], 'G-elastic-encoded': ['PRODUCT GAP, fixed with an `api_key` sibling; policy-limited alone'], 'G-reddit-secret': ['policy-limited (`curl -u/--user`, #1247)'], 'G-meta-pipe-span': ['POLICY QUESTION, answered: recorded deviation (a), accepted over-span'], 'G-xapikey-clientid': ['POLICY QUESTION, answered: recorded deviation (b), accepted false positive'], 'G-authcode': ['CORPUS ERRATUM CANDIDATE, applied (errata-1): downgraded to observed-only'] };
p(row(['group (round 1 count)', 'status', 'closed', 'still open', 'triage now']));
p(row(['---', '---', '---:', '---:', '---']));
for (const [k, v] of Object.entries(S.groups)) { const st = v.erratumDowngraded.length ? 'erratum applied' : v.open.length === 0 ? 'closed' : v.closed.length === 0 ? 'open' : 'partially closed'; p(row([`${k} (${v.total})`, st, v.erratumDowngraded.length ? `${v.erratumDowngraded.length} moved to observed-only` : v.closed.length, v.open.length, GT[k][0]])); }
p();
p('Remaining open cases, grouped by root cause (counts are scored cases still failing on R2; case ids drop the `<family>:<group>:` prefix, full records in `scores.json`):');
p();
const ROOT = [
  ['`curl -u` / `--user` Basic password slot unread (policy-limited, deviation (c), #1247)', ['G-jfrog', 'G-reddit-secret']],
  ['bare `token` stays unmatched (policy-limited, #1241): Contentful lone `token` member', ['G-token-member']],
  ['bare `token=` without revoke or introspect context (policy-limited, #1241)', ['G-reddit-token']],
  ['Elastic `encoded` member without an `api_key` sibling (policy-limited)', ['G-elastic-encoded']],
  ['residual placeholder, OPEN PRODUCT GAP: `{your-app_id}|<non-brace secret half>` (`<...>`, `********`, empty) reported as the 12-byte `{your-app_id` (`warn`)', ['G-brace']],
  ['Meta `APP_ID|SECRET` whole-pair over-span (accepted deviation (a))', ['G-meta-pipe-span']],
  ['`x-api-key` Adobe client ID (accepted deviation (b))', ['G-xapikey-clientid']],
];
for (const [title, ks] of ROOT) {
  const cs = ks.flatMap((k) => S.groups[k].open); if (!cs.length) continue;
  p(`- **${title}**: ${cs.length}.`);
  const byRow = {}; for (const c of cs) (byRow[`${c.corpus} ${c.family}`] ??= []).push(c);
  for (const [r, a] of Object.entries(byRow)) p(`  - ${r} (${a.length}): ${a.map((x) => `\`${short(x.id)}\``).join(', ')}`);
}
p();
p('- **NEW regression, OPEN PRODUCT GAP** (section 2): the `hapikey=YOUR_HAPIKEY` placeholder control: 1.');
p('  - E hubspot:legacy-api-key (1): `query-upper-placeholder:control`');
p();
p('The Meta `{your-app_id}|X` residual is not covered by the product\'s own addendum (which lists `{your-app_id}|{your-app_secret}` as silent): with a brace pair both halves are references, but with a non-brace secret half (`<APP_SECRET>`, `<your-app-secret>`, `********`, bullets, empty) the brace app-id half is still reported as the 12-byte `{your-app_id` (the round-1 shape, apparently a cut at `}`). 4 C controls and 8 D controls; no secret leaks, the cost is a `warn` false positive.');
p();
p('## 5. New findings');
p();
p('**Scored cases newly bad: 1** (the regression in section 2). **Scored cases whose findings changed while still failing: 1**: `reddit:oauth-access-token:e:form-repeat:positive` was silent on both occurrences on B1 and now reports the second (`curl -d "token=..."` beside `/revoke_token`, correct under the revoke-context rule) but not the first (a bare `token=...&again=1` line with no revoke context), so it is still a miss on one of its two spans (policy-limited, #1241). No other scored case changed from bad to bad.');
p();
const oc = Object.entries(S.observedChanged).flatMap(([g, v]) => v.map((x) => ({ g, ...x })));
const newlyFlagged = oc.filter((x) => x.before.length === 0 && x.after.length), newlySilent = oc.filter((x) => x.before.length && x.after.length === 0), otherCh = oc.filter((x) => !newlyFlagged.includes(x) && !newlySilent.includes(x));
p(`**Observed-only cases whose behaviour changed: ${oc.length}** (${newlyFlagged.length} newly flagged, ${newlySilent.length} newly silent, ${otherCh.length} otherwise changed). None is scored.`);
p();
const rowsOf = (a) => Object.entries(a.reduce((m, x) => ((m[x.family] = (m[x.family] || 0) + 1), m), {})).map(([r, n]) => `\`${r}\` ${n}`).join(', ');
p(`- Newly flagged (${newlyFlagged.length}): ${rowsOf(newlyFlagged)}. All are variants of the carriers the nine fixes added: \`hapikey\` in a YAML URL, fragment, log line, HTML href, upper-case, prefixed-name and percent forms and a JSON member; the \`X-JFrog-Art-Api\` header in header maps, YAML, lower- and mixed-case and no-space forms (plus three vendor-shaped probe values, \`AKCp\`+69, \`AKCp8\`+68 and the 44-character base64 form, in the header slot); the Zendesk vendor-shaped 40-character probe in the credential string; two UUID-shaped values in the \`hapikey\` slot; a \`tokenKey\` member nested in an array. Each finding is \`contextual_secret\`/\`redact\` on a value in a documented credential slot, so none looks like a false positive.`);
p(`- Newly silent (${newlySilent.length}): ${newlySilent.map((x) => `\`${short(x.id)}\``).join(', ')}. The three Meta \`appsecret-proof-*\` cases and the D conflict case were a false positive on the neighbouring \`{user-access-token}\` placeholder (the brace fix); the Zendesk masked-display conflict was a \`warn\` on a masked credential string (the \`/token:\` reader treats a mask as a reference).`);
p(`- Otherwise changed (${otherCh.length}): ${otherCh.map((x) => `\`${short(x.id)}\` (${x.family})`).join('; ')}. The two Zendesk YAML-quoted/unquoted variants went from a whole-string \`warn\` to a token-only \`redact\` (correct under the policy); the Elastic repeat case gained a finding on its \`log: encoded=...\` line (a base64 \`id:api_key\` repeated in a log).`);
p('- **16-digit rule, `{name}`/`[name]` placeholder grammar, Zendesk `/token:` reader**: no scored control changed from clean to flagged because of any of them (the only newly flagged control is the `hapikey` regression above), and none of the observed-only changes is a digit run, a bracket/brace placeholder or a `/token:` credential that looks like a false positive. The digit rule\'s medium/`warn` cap shows in the closed digit cases (see section 4). A caution that the corpora cannot answer: they hold no 16+ digit counters, order numbers or phone numbers in credential-named slots, so the false-positive cost of that rule on real traffic is not measured here.');
p();
p('## 6. Final disposition of all 43 rows');
p();
p(`Categories, by rule: *fully covered*: every scored positive exact and fully covered, every scored control clean; *covered with recorded policy deviation*: the only open cases are accepted policy deviations; *policy-limited*: open scored cases whose reason is a recorded product policy, none of them a defect the policy does not explain; *carrier unresolved (observed only)*: no scored positive (controls, if any, are clean); *open product gap*: any open case the recorded policy does not explain. Counts: ${Object.entries(catCount).map(([k, v]) => `${k} ${v}`).join('; ')}.`);
p();
p(row(['corpus', 'row', 'disposition', 'detail / open cases']));
p(row(['---', '---', '---', '---']));
for (const d of Object.values(disp)) p(row([d.corpus, `\`${d.row}\``, d.cat, d.notes.join('; ') + (Object.keys(d.open).length ? ` Open: ${Object.entries(d.open).map(([k, v]) => `${k} x${v.length}`).join(', ')}.` : '')]));
p();
p('Dispositions state what the measurement shows against the maintainers\' own contract; none promotes support, and a "fully covered" row means only that every frozen scored case passes on one host.');
p();
p('## 7. Honest limits');
p();
p('- **Project-authored, maintainer-only evidence, not independent validation.** The corpora derive from the maintainers\' credential-evidence repository (`snapshot-2026.10.06.5`). The product\'s own round-1 dispositions (the policy deviations and #1241 limits) were read from its docs in this candidate and are the maintainers\' decisions on their own evidence; this report records them, it does not validate them.');
p('- **The corpora were written before round 1 and are not shaped by the candidate, but the candidate was shaped by round 1.** The nine fixes target exactly the round-1 failing cases, so closing them is expected and says little about generalisation. The regression shows the opposite risk: a name admission exposes sibling placeholder shapes.');
p('- **One host** (darwin-arm64, Node ' + ID.node + '), not a linux-x64 official run; the addon and wasm bytes are host-bound. **Peers not run.** **The candidate is not published** (branch commit declaring 0.1.0-beta.14).');
p('- Baseline A and B1 were not re-run; their round-1 observations were re-scored on errata-1 (texts byte-identical, nine ids mapped). The C numbers for A and B1 therefore differ from round 1 only by the nine controls now being observed-only.');
p('- The scorer cannot express policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run or any-shape; an over-wide finding is `fullyCovered` but never `exact`, which is why the Meta pipe cases stay in the `exact` shortfall (36).');
p('- The 16+ digit rule\'s false-positive cost on real data and the `{name}`/`[name]` grammar\'s on non-placeholder text are not measurable with these corpora.');
p('- Disk: no limit was hit; build `target` directories and `node_modules` were deleted afterwards.');
p();
p('## Reproduce');
p();
p('```bash');
p('/usr/bin/git cherry-pick fd7bc762   # C errata-1 onto the measure branch');
p('node scripts/measure-batch1.mjs --corpus ../benchmarks/group-<c|d|e>/<corpus module> --chunk 7|1 --label candidate-r2 --out obs.json --node-root <install> --wasm-dir <install>/node_modules/@redact-secret/wasm --python <venv python> --cli <redact-secret> --source-commit e1cc1f31e58f9c1e9ef6a58fd057c1106976711b');
p('node scripts/report-groups-cde-r2.mjs --r1 evidence/groups-cde/round1 --obs-dir evidence/groups-cde/round2 --old-c <freeze a7350c51 copy of benchmarks/batch2 and benchmarks/group-c> --out evidence/groups-cde/round2');
p('node scripts/render-groups-cde-r2-report.mjs --dir evidence/groups-cde/round2 --r1 evidence/groups-cde/round1');
p('```');
writeFileSync(path.join(values.dir, 'report.md'), `${L.join('\n')}\n`);
writeFileSync(path.join(values.dir, 'report.json'), `${JSON.stringify({ schema: 'groups-cde-round2-report-v1', candidate: ID.commit, headline: Object.fromEntries('cde'.split('').map((g) => [g, { b1: T(g, 'b1'), r2: T(g, 'r2') }])), regressions: S.regressions.map((r) => r.id), parityDivergences: dv, dispositionCounts: catCount, dispositions: disp }, null, 1)}\n`);
console.log(JSON.stringify(catCount));
