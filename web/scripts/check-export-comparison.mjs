/**
 * Post-build check of the comparison and scanner pages when the committed authority is `new` (#658), run by `npm run check:routes` beside
 * `check-export-accuracy.mjs` and `check-export-scanners.mjs`, which recount the same pages against the legacy files (the oracle) when the authority
 * is `legacy`. Exactly one of the two recounts applies to a build.
 *
 * Every expected value is read here, from the qualification view (`public/results/qualification-v1.json`: the official credential-eval runs, with each
 * scanner's identity as the artifact stamped it), `qualification/suite-v1.json`, `package.json`, `scanners/peer-checksums.json` and
 * `scanners/peer-registry.json`, independently of web/services and web/resolvers, and compared with what the built pages say:
 *
 *  - `/comparison/accuracy/`: stamped new/authority and names the population and the official run; states its denominator (the cases of the one
 *    population, never the sum of two); every pre-rendered credentials panel at scope "all" states, for each question, the Hidden / Partly readable /
 *    Readable (or Left alone / Flagged) counts of redact-secret and of the other tool, recounted from each case's own row; the build-emitted
 *    differences file holds exactly the differing files and is the one for this run;
 *  - `/comparison/scanner/`: every scanner the official run lists is on the page in the run's order with the version, mode line, build and
 *    configuration hash the artifact stamped, the pin from the file that pins it and the pinned archive of each binary; the official run and its
 *    denominator are named; no peer snapshot is described; the copy ranks nothing;
 *  - `/comparison/`: the accuracy line names the population behind the figures.
 *
 * Nothing here is a ledger value written down: each number is recounted at run time from the view this checkout builds from.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAuthority, stampOf } from './lib/authority.mjs';
import { linkResolves } from './lib/links.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const out = path.join(webRoot, 'out');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));

const authority = await readAuthority(repoRoot);
if (authority !== 'new') {
  console.log('comparison and scanner pages: the authority is legacy, so check-export-accuracy.mjs and check-export-scanners.mjs recount them against the legacy files');
  process.exit(0);
}

const problems = [];
const fail = message => problems.push(message);
const int = n => n.toLocaleString('en-US');
const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const readHtml = async route => { try { return await readFile(path.join(out, route, 'index.html'), 'utf8'); } catch { fail(`missing page /${route}/`); return ''; } };

let view;
try { view = await readJson('public/results/qualification-v1.json'); } catch { /* no view */ }

if (!view) {
  // Without a view the pages say so and show no scanner figure; the report pages' own check (check-export-credential.mjs) owns that wording.
  if (process.env.WEB_REQUIRE_QUALIFICATION === '1') fail('WEB_REQUIRE_QUALIFICATION=1 but public/results/qualification-v1.json is absent: build the view before the web build');
  const html = await readHtml('comparison/accuracy');
  if (html) {
    const stamp = stampOf(html);
    if (!stamp || stamp.pipeline !== 'new' || stamp.role !== 'authority') fail('/comparison/accuracy/ must carry the new/authority stamp even without a view');
    if (/Hidden \d|Left alone \d/.test(text(html))) fail('/comparison/accuracy/ shows a figure but there is no view');
  }
} else {
  const report = view.populations.find(p => p.role === 'floors-and-gates');
  if (!report) { console.error('the view has no floors-and-gates population'); process.exit(1); }
  const digest = report.artifact.semanticDigest;
  const cases = report.cases;
  const scanners = report.artifact.scanners;
  const peers = scanners.filter(s => s.id !== 'redact-secret');
  const product = scanners.find(s => s.id === 'redact-secret');

  // The row a scanner recorded for a case, as the artifact stated it: spans for a positive, flagged for a control, nothing for the rest.
  const rowOf = (c, id) => c.results.find(r => r.scanner === id);
  const stateOf = (q, c, id) => {
    const r = rowOf(c, id);
    if (!r) return null;
    if (q === 'r') return r.measurement !== 'positive' ? null : (r.outcomes ?? []).includes('MISS') ? 2 : (r.outcomes ?? []).includes('PARTIAL') ? 1 : 0;
    return r.measurement !== 'control' ? null : r.flagged ? 1 : 0;
  };

  // ---- /comparison/accuracy/ --------------------------------------------------------------------------------------------------
  const accuracy = await readHtml('comparison/accuracy');
  if (accuracy) {
    if (!/<h1[\s>]/.test(accuracy)) fail('/comparison/accuracy/ has no <h1>');
    const stamp = stampOf(accuracy);
    if (!stamp || stamp.pipeline !== 'new' || stamp.role !== 'authority') fail(`/comparison/accuracy/ is stamped ${stamp ? `${stamp.pipeline}/${stamp.role}` : 'nothing'}, expected new/authority`);
    const whole = text(accuracy);
    if (!whole.includes(report.population)) fail(`/comparison/accuracy/ does not name the population ${report.population}`);
    if (!whole.includes(digest.slice(0, 19))) fail('/comparison/accuracy/ does not name the official run it was built from');

    const panels = new Map();
    for (const part of accuracy.split('data-acc-panel=""').slice(1)) {
      const key = /data-key="([^"]+)"/.exec(part)?.[1];
      if (key) panels.set(key, part);
    }
    const defaults = [...accuracy.matchAll(/data-key="([^"]+)" data-default=""/g)].map(m => m[1]);
    if (defaults.length !== 1) fail(`exactly one panel must be the default, found ${defaults.length}`);

    let file;
    try { file = JSON.parse(await readFile(path.join(out, 'data', 'comparison', 'accuracy', 'differences.json'), 'utf8')); } catch { fail('the export has no data/comparison/accuracy/differences.json'); }
    if (!file || file.version !== 1 || file.runId !== digest) { fail('differences.json is missing or is not from the official run of the report population'); file = { fixtures: [], peers: {}, providers: [] }; }
    if (!new RegExp(`fixtures\\\\*":${file.fixtures.length}[,}]`).test(accuracy)) fail(`the page does not name the ${file.fixtures.length} files differences.json holds, so a file from another build could not be refused`);

    for (const peer of peers) {
      for (const level of ['T1', 'T2', 'T3']) {
        const key = `credentials.${peer.id}.${level}.all.${level === 'T3' ? 1 : 0}`;
        const panel = panels.get(key);
        if (!panel) { fail(`missing panel ${key}`); continue; }
        const t = text(panel.split('data-acc-panel=""')[0]);
        const us = { r: [0, 0, 0], a: [0, 0] }, them = { r: [0, 0, 0], a: [0, 0] };
        const total = { r: 0, a: 0 }, dif = { r: 0, a: 0 };
        for (const c of cases) {
          if (c.tier !== level) continue;
          const q = c.kind === 'must-not-flag' ? 'a' : 'r';
          const x = stateOf(q, c, 'redact-secret'), y = peer.status === 'complete' ? stateOf(q, c, peer.id) : null;
          if (x === null || y === null) continue;
          total[q]++; us[q][x]++; them[q][y]++;
          if ((x === 0) !== (y === 0)) dif[q]++;
        }
        for (const q of ['r', 'a']) {
          const held = (file.peers[peer.id] ?? []).filter(([at]) => file.fixtures[at].l === level && file.fixtures[at].q === q).length;
          if (held !== dif[q]) fail(`${key}: differences.json holds ${held} ${q} files for ${peer.id} at ${level}, the official run's rows give ${dif[q]}`);
          if (dif[q] && !t.includes(`Show the ${int(dif[q])} files with different results`)) fail(`${key}: does not state ${int(dif[q])} differing files`);
        }
        const stated = (re, count) => [...t.matchAll(re)].map(m => m.slice(1, 1 + count).map(v => Number(v.replace(/,/g, ''))));
        const r = stated(/Hidden ([\d,]+) Partly readable ([\d,]+) Readable ([\d,]+)/g, 3);
        const a = stated(/Left alone ([\d,]+) Flagged ([\d,]+)/g, 2);
        const expectR = total.r ? [us.r, them.r] : [];
        const expectA = total.a ? [us.a, them.a] : [];
        if (JSON.stringify(r) !== JSON.stringify(expectR)) fail(`${key}: secrets grid states ${JSON.stringify(r)}, the official run's rows give ${JSON.stringify(expectR)}`);
        if (JSON.stringify(a) !== JSON.stringify(expectA)) fail(`${key}: safe-text grid states ${JSON.stringify(a)}, the official run's rows give ${JSON.stringify(expectA)}`);
        if (total.r && !t.includes(`${int(total.r)} test files.`)) fail(`${key}: does not state ${int(total.r)} test files for secrets`);
        if (total.a && !t.includes(`${int(total.a)} test files.`)) fail(`${key}: does not state ${int(total.a)} test files for safe text`);
        // The denominator is the one population's, stated beside the figures, and the peer is named with the identity the artifact stamped.
        if (!t.includes(`${int(cases.length)} cases of the ${report.denominator} population`)) fail(`${key}: does not state its denominator (${int(cases.length)} cases of the ${report.denominator} population)`);
        if (!t.includes('are not added in')) fail(`${key}: does not say the other populations are not added in`);
        if (!t.includes(`${peer.id} ${peer.version}`) && !t.includes(`${peer.version}`)) fail(`${key}: does not state the version ${peer.version} the artifact recorded for ${peer.id}`);
        if (!t.includes(`Observed in the official run ${digest.slice(0, 19)}`)) fail(`${key}: does not say ${peer.id} was observed in the official run`);
        if (/Output recorded|replayed while the inputs are unchanged|No observation date recorded/.test(t)) fail(`${key}: describes a peer snapshot or a missing observation, but the pipeline is the official run`);
        if (!t.includes('Mode published') && !t.includes('Mode candidate')) fail(`${key}: does not state its mode (published or candidate)`);
        if (product && !t.includes(product.version)) fail(`${key}: does not state the product version ${product.version} the artifact recorded`);
        if (level === 'T3') {
          const gated = panels.get(`credentials.${peer.id}.T3.all.0`);
          const g = gated ? text(gated.split('data-acc-panel=""')[0]) : '';
          if (!gated || !g.includes('Hidden by default') || /Partly readable/.test(g)) fail(`${peer.id}: project policy must be a notice until peers=1`);
        }
      }
    }

    let bytes = 0;
    for (const name of await readdir(path.join(out, 'comparison', 'accuracy'))) bytes += (await stat(path.join(out, 'comparison', 'accuracy', name))).size;
    if (bytes > 8 * 1024 * 1024) fail(`/comparison/accuracy/ ships ${(bytes / 1048576).toFixed(1)} MB; keep the pair data compact`);
  }

  // ---- /comparison/ -------------------------------------------------------------------------------------------------------------
  const hub = text(await readHtml('comparison'));
  if (hub && !hub.includes(`official run of ${report.population} (${int(cases.length)} cases)`)) fail(`/comparison/ does not name the population behind the accuracy run (${report.population}, ${int(cases.length)} cases)`);

  // ---- /comparison/scanner/ -----------------------------------------------------------------------------------------------------
  const scannerHtml = await readHtml('comparison/scanner');
  if (scannerHtml) {
    const main = /<main[\s\S]*?<\/main>/.exec(scannerHtml)?.[0] ?? scannerHtml;
    const t = text(main);
    if ((scannerHtml.match(/<h1[\s>]/g) ?? []).length !== 1) fail('/comparison/scanner/ must have exactly one <h1>');
    const suite = await readJson('qualification/suite-v1.json');
    const pkg = await readJson('package.json');
    const registry = (await readJson('scanners/peer-registry.json')).scanners;
    const checksums = await readJson('scanners/peer-checksums.json');
    const NPM = { 'redact-secret': '@redact-secret/core', 'flare-redact': 'flare-redact', openredaction: '@openredaction/core' };
    const pinOf = id => suite.scanners[id] ?? pkg.dependencies?.[NPM[id]];

    if (!t.includes(`Official run, ${report.population}`)) fail(`/comparison/scanner/ does not name the official run of ${report.population}`);
    if (!t.includes(digest.slice(0, 12))) fail('/comparison/scanner/ does not name the official run by its digest');
    if (!t.includes(`${int(cases.length)} cases of the ${report.denominator} population`)) fail('/comparison/scanner/ does not state the denominator of the official run');
    if (/committed snapshot|Snapshots, |snapshots recorded/.test(t)) fail('/comparison/scanner/ describes a committed peer snapshot, but the pipeline is the official run');
    if (!/Published|Candidate/.test(t) || !t.includes('Mode')) fail('/comparison/scanner/ does not state published or candidate');
    // Measurement host (#620, #621): the engine's stamp from the view and the host facts the canonical run recorded, or "Unavailable" for a record without
    // them; and the publication host apart, under its own label.
    const recorded = (await readJson('benchmarks/official-runs.json')).runs.find(r => r.canonical && r.id.startsWith(`${report.population}@`));
    if (report.measurement?.host && !t.includes(report.measurement.host)) fail(`/comparison/scanner/ does not state the engine host ${report.measurement.host} of the official run`);
    if (report.measurement?.startedAt && !t.includes(report.measurement.startedAt.slice(0, 10))) fail('/comparison/scanner/ does not state when the official run was measured');
    if (recorded?.measurementHost) {
      const h = recorded.measurementHost;
      for (const v of [h.node, h.os.release, ...(h.ci?.imageVersion ? [h.ci.imageVersion] : [])]) if (!t.includes(v)) fail(`/comparison/scanner/ does not state the recorded host fact ${v}`);
    } else if (!t.includes('Unavailable')) fail('/comparison/scanner/ must say the host facts are unavailable for a run recorded without them');
    if (!t.includes('Page built')) fail('/comparison/scanner/ does not state the publication host apart from the measurement host');
    // The product's own scope (#622): every reviewed statement, the release it is bound to, and the binding state recomputed here from the official
    // run's observation of the product (Current when its version and mode line are the bound ones, History otherwise).
    const scope = await readJson('scanners/product-scope.json');
    for (const s of scope.outOfScope) if (!t.includes(s.text)) fail(`/comparison/scanner/ does not state the product scope statement: ${s.text}`);
    const product = report.artifact.scanners.find(s => s.id === 'redact-secret');
    if (!t.includes(`${scope.boundTo.release} · ${scope.boundTo.mode}`)) fail('/comparison/scanner/ does not state the release and mode the product scope is bound to');
    if (product) {
      const state = product.version === scope.boundTo.release && product.mode === scope.boundTo.mode ? 'Current' : 'History';
      if (!t.includes(`Binding ${state}`)) fail(`/comparison/scanner/ does not state the product scope binding as ${state}`);
    }

    let at = -1;
    for (const scanner of scanners) {
      const id = scanner.id;
      const position = scannerHtml.indexOf(`id="${id}"`);
      if (position < 0) { fail(`/comparison/scanner/ has no section #${id}`); continue; }
      if (position < at) fail(`/comparison/scanner/ lists ${id} out of the official run's order`);
      at = position;
      if (!scannerHtml.includes(`href="#${id}"`)) fail(`/comparison/scanner/ roster does not link #${id}`);
      if (!t.includes(scanner.version)) fail(`/comparison/scanner/ does not state the version ${scanner.version} of ${id}`);
      const pin = pinOf(id);
      if (!pin || !t.includes(pin)) fail(`/comparison/scanner/ does not state the pin ${pin} of ${id}`);
      if (!t.includes(scanner.mode)) fail(`/comparison/scanner/ does not state the mode line of ${id}: ${scanner.mode}`);
      if (scanner.build && !t.includes(scanner.build)) fail(`/comparison/scanner/ does not state the build ${scanner.build} of ${id}`);
      if (!t.includes(scanner.configurationHash.slice(0, 12))) fail(`/comparison/scanner/ does not state the configuration hash of ${id}`);
      const table = checksums[id];
      if (table?.assets) {
        const shown = Object.values(table.assets).some(a => t.includes(a.archive) && t.includes(a.sha256.slice(0, 12)));
        if (!shown) fail(`/comparison/scanner/ does not name a pinned release archive and its SHA-256 for ${id}`);
      }
      for (const statement of registry[id]?.outOfScope ?? []) if (!t.includes(statement)) fail(`/comparison/scanner/ does not show the out-of-scope statement for ${id}: ${statement}`);
    }
    const FORBIDDEN = /fastest|slowest|faster|slower|\bbest\b|worst|winner|better|\brank(ed|ing)?\b|recommended|\bmissed\b|\bcaught\b/i;
    if (FORBIDDEN.test(t)) fail(`/comparison/scanner/ contains a ranking or verdict word: ${FORBIDDEN.exec(t)[0]}`);
    for (const [, href] of scannerHtml.matchAll(/<a [^>]*href="(\/[^"#]*)/g)) {
      if (!(await linkResolves(out, '', href))) fail(`/comparison/scanner/ links outside the export: ${href}`);
    }
  }
}

if (problems.length) {
  console.error(`${problems.length} comparison and scanner page problem(s) (authority new):\n${problems.map(p => `  ${p}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(view
    ? `comparison and scanner pages (authority new): the accuracy panels, the denominator, the scanner identities and the run named on each recount from the official run of ${view.populations.find(p => p.role === 'floors-and-gates').population}`
    : 'comparison and scanner pages (authority new, no view): the accuracy page names the new pipeline and shows no figure');
}
