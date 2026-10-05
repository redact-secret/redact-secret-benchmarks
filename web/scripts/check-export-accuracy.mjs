/**
 * Post-build check of `/comparison/accuracy/` (#570), run by `npm run check:routes` after
 * `check-export.mjs`. Expected values are read here, independently of web/services and
 * web/resolvers, from the committed corpora, the run's suite reports and the recorded
 * runtime comparison, and compared with what the exported page states:
 *
 *  - the page exists, has one <h1>, and one panel is the default;
 *  - every pre-rendered credentials panel at scope "all" states, for each question, the
 *    same Hidden / Partly readable / Readable (or Left alone / Flagged) counts for redact-secret and
 *    for the other tool as a recount of the suite reports; the states add up to the files both
 *    tools recorded, and a control the tool flagged equals the run summary's `flaggedFiles`;
 *  - the project-policy level is a notice until `peers=1` and shows the grids with it;
 *  - the personal-data panels state the recorded per-line outcomes;
 *  - the route stays small (the lists of differing files are one compact dataset, not a page each).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAuthority } from './lib/authority.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
// The legacy recount, kept intact as the oracle (#658): it applies when the authority is `legacy`. Under `new` the page is built from the official run
// and check-export-comparison.mjs recounts it against the qualification view.
if ((await readAuthority(repoRoot)) === 'new') {
  console.log('accuracy page: the authority is new, so check-export-comparison.mjs recounts it against the qualification view');
  process.exit(0);
}
const out = path.join(webRoot, 'out', 'comparison', 'accuracy');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
const problems = [];
const fail = message => problems.push(message);
const int = n => n.toLocaleString('en-US');
const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

let html;
try { html = await readFile(path.join(out, 'index.html'), 'utf8'); } catch { fail('missing page /comparison/accuracy/'); }
if (html) {
  // Every pre-rendered panel carries the heading; only the shown panel is in the accessibility tree.
  if (!/<h1[\s>]/.test(html)) fail('/comparison/accuracy/ has no <h1>');
  const panels = new Map();
  for (const part of html.split('data-acc-panel=""').slice(1)) {
    const key = /data-key="([^"]+)"/.exec(part)?.[1];
    if (key) panels.set(key, part);
  }
  // Each split part runs to the next panel, so its text is that panel's.
  const defaults = [...html.matchAll(/data-key="([^"]+)" data-default=""/g)].map(m => m[1]);
  if (defaults.length !== 1) fail(`exactly one panel must be the default, found ${defaults.length}`);
  if (!/<style>:root\[data-acc-key\] \[data-acc-panel\]\[data-default\]\{display:none\}/.test(html)) fail('the panel selection rules are missing');
  if (!/data-acc-key/.test(html.slice(0, html.indexOf('data-acc-panel')))) fail('the inline script that picks a panel before first paint is missing');

  // ---- the ledger, read independently ---------------------------------------------------
  let summary;
  try { summary = await readJson('public/results/summary.json'); } catch { /* no run */ }
  if (!summary) {
    if (process.env.WEB_REQUIRE_RUN === '1') fail('WEB_REQUIRE_RUN=1 but public/results/summary.json is absent');
    else if (!text(panels.get(defaults[0]) ?? '').includes('No benchmark results for this checkout')) fail('the page has no run to read and must say so');
  } else {
    const run = await readJson('public/results/run.json');
    const categories = (await readJson('benchmarks/categories.json')).filter(c => !c.calibrationOnly);
    const fixtures = new Map();
    const rowsBy = new Map();
    for (const c of categories) {
      const corpus = await readJson(c.corpus);
      for (const f of corpus.fixtures) fixtures.set(`${c.id}--${f.id}`, f.assessment);
      let report;
      try { report = await readJson(`public/results/${c.id}.json`); } catch { continue; }
      if (report.runId !== run.runId) continue;
      for (const s of report.scanners) {
        if (s.status !== 'complete') continue;
        for (const row of s.rows ?? []) (rowsBy.get(s.id) ?? rowsBy.set(s.id, new Map()).get(s.id)).set(`${c.id}--${row.id}`, row);
      }
    }
    const stateOf = (q, row) => {
      if (!row) return null;
      if (q === 'r') return !row.spanOutcomes ? null : row.spanOutcomes.includes('MISS') ? 2 : row.spanOutcomes.includes('PARTIAL') ? 1 : 0;
      return row.flagged === undefined ? null : row.flagged ? 1 : 0;
    };
    const mine = rowsBy.get('redact-secret') ?? new Map();
    const peers = summary.scanners.filter(s => s.id !== 'redact-secret');
    let file;
    try { file = JSON.parse(await readFile(path.join(out, '..', '..', 'data', 'comparison', 'accuracy', 'differences.json'), 'utf8')); } catch { fail('the export has no data/comparison/accuracy/differences.json'); }
    if (!file || file.version !== 1 || file.runId !== run.runId) { fail('differences.json is missing or is not from this run'); file = { fixtures: [], peers: {}, providers: [] }; }
    if (!new RegExp(`fixtures\\\\*":${file.fixtures.length}[,}]`).test(html)) fail(`the page does not name the ${file.fixtures.length} files differences.json holds, so a file from another build could not be refused`);
    for (const peer of peers) {
      const theirs = rowsBy.get(peer.id) ?? new Map();
      for (const level of ['T1', 'T2', 'T3']) {
        const key = `credentials.${peer.id}.${level}.all.${level === 'T3' ? 1 : 0}`;
        const panel = panels.get(key);
        if (!panel) { fail(`missing panel ${key}`); continue; }
        const t = text(panel.split('data-acc-panel=""')[0]);
        const us = { r: [0, 0, 0], a: [0, 0] }, them = { r: [0, 0, 0], a: [0, 0] };
        const total = { r: 0, a: 0 }, dif = { r: 0, a: 0 };
        for (const [slug, a] of fixtures) {
          if (a.tier !== level) continue;
          const q = a.kind === 'must-not-flag' ? 'a' : 'r';
          const x = stateOf(q, mine.get(slug)), y = stateOf(q, theirs.get(slug));
          if (x === null || y === null) continue;
          total[q]++; us[q][x]++; them[q][y]++;
          if ((x === 0) !== (y === 0)) dif[q]++;
        }
        // The differing files: the page states the count, and the build-emitted file holds exactly those files.
        for (const q of ['r', 'a']) {
          const held = (file.peers[peer.id] ?? []).filter(([at]) => file.fixtures[at].l === level && file.fixtures[at].q === q).length;
          if (held !== dif[q]) fail(`${key}: differences.json holds ${held} ${q} files for ${peer.id} at ${level}, the suite reports give ${dif[q]}`);
          if (dif[q] && !t.includes(`Show the ${int(dif[q])} files with different results`)) fail(`${key}: does not state ${int(dif[q])} differing files`);
        }
        const stated = (re, count) => [...t.matchAll(re)].map(m => m.slice(1, 1 + count).map(v => Number(v.replace(/,/g, ''))));
        const r = stated(/Hidden ([\d,]+) Partly readable ([\d,]+) Readable ([\d,]+)/g, 3);
        const a = stated(/Left alone ([\d,]+) Flagged ([\d,]+)/g, 2);
        const expectR = total.r ? [us.r, them.r] : [];
        const expectA = total.a ? [us.a, them.a] : [];
        if (JSON.stringify(r) !== JSON.stringify(expectR)) fail(`${key}: secrets grid states ${JSON.stringify(r)}, the suite reports give ${JSON.stringify(expectR)}`);
        if (JSON.stringify(a) !== JSON.stringify(expectA)) fail(`${key}: safe-text grid states ${JSON.stringify(a)}, the suite reports give ${JSON.stringify(expectA)}`);
        if (total.r && !t.includes(`${int(total.r)} test files.`)) fail(`${key}: does not state ${int(total.r)} test files for secrets`);
        // The run summary is the ledger's own count: flagged controls and the file count agree when nothing is left out.
        const groupKey = level === 'T3' ? 'policy/T3' : `must-redact/${level}`;
        const control = summary.overall[peer.id]?.[`must-not-flag/${level}`];
        const redact = summary.overall[peer.id]?.[groupKey];
        if (control && total.a && control.files === total.a && control.flaggedFiles !== them.a[1]) fail(`${key}: ${them.a[1]} flagged controls, the run summary says ${control.flaggedFiles}`);
        if (redact && total.r && redact.files !== total.r) fail(`${key}: ${total.r} secret files, the run summary says ${redact.files}`);
        if (level === 'T3') {
          const gated = panels.get(`credentials.${peer.id}.T3.all.0`);
          if (!gated || !text(gated.split('data-acc-panel=""')[0]).includes('Hidden by default') || /Partly readable/.test(text(gated.split('data-acc-panel=""')[0]))) fail(`${peer.id}: project policy must be a notice until peers=1`);
        }
        if (!t.includes('Mode published') && !t.includes('Mode candidate')) fail(`${key}: does not state its mode (published or candidate)`);
      }
    }

    // ---- personal data: the recorded runtime comparison, read independently -------------
    try {
      const report = await readJson('evidence/562/runtime-comparison-pii-global-us.json');
      const plan = await readJson('qualification/runtime-comparison-v2.json');
      const ids = report.tools.map(t => t.id).filter(id => id !== 'redact-secret');
      for (const id of ids) {
        const panel = panels.get(`pii.${id}.-.-.-`);
        if (!panel) { fail(`missing personal-data panel for ${id}`); continue; }
        const t = text(panel.split('data-acc-panel=""')[0]);
        for (const w of plan.workloads.filter(w => w.domain === 'pii')) {
          const hid = tool => {
            const lines = report.outcomes.find(o => o.tool === tool && o.workload === w.id)?.lines ?? [];
            return lines.filter((l, i) => l.valuesHidden === w.lines[i].values.length).length;
          };
          for (const tool of ['redact-secret', id]) {
            const n = hid(tool);
            if (!t.includes(`${n} of ${w.lines.length} hidden Hidden ${n} Left some or all ${w.lines.length - n}`)) fail(`pii.${id}: ${tool} on ${w.id} is not stated as ${n} of ${w.lines.length}`);
          }
        }
        if (!t.includes('Preview, not yet a measurement')) fail(`pii.${id}: the preview is not labelled`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  // ---- size ----------------------------------------------------------------------------
  let bytes = 0;
  for (const name of await readdir(out)) bytes += (await stat(path.join(out, name))).size;
  if (bytes > 8 * 1024 * 1024) fail(`/comparison/accuracy/ ships ${(bytes / 1048576).toFixed(1)} MB; keep the pair data compact`);
}

if (problems.length) {
  console.error(`${problems.length} accuracy page problem(s):\n${problems.map(p => `  ${p}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('accuracy page ok: panels recount from the suite reports and the recorded runtime comparison, the policy level is gated, the route is small');
}
