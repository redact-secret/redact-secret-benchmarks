import { validateCurrentPerformanceInputs } from '../../benchmarks/lib/current-performance-inputs.mjs';
/**
 * Post-build check of `/comparison/performance/` (#569), run by `npm run check:routes` after `next build`.
 *
 * Every time, spread, speed, hidden count, mark position and noise figure each pre-rendered panel shows is
 * recomputed here from the committed reports (`evidence/562`) and the accepted run (`evidence/1046`), read
 * independently of web/services and web/resolvers. It also checks: one panel per pair and setting, the two sides in
 * the same order and form, the five unmeasured groups stated as "Not measured", and no ratio or verdict word.
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
const problems = [];
const fail = m => problems.push(m);

const html = await readFile(path.join(webRoot, 'out/comparison/performance/index.html'), 'utf8');
const text = h => h.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
if (!/<h1[\s>]/.test(html)) fail('/comparison/performance/ has no <h1>');

const fixed = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const ms = n => (n < 100 ? fixed(n, 1) : fixed(n, 0));
const mbs = n => fixed(n / 1e6, 1);
const kib = n => `${fixed(n / 1024, 1)} KiB`;
const SETTINGS = ['default', 'pii-global', 'pii-global-us'];
const PEERS = ['flare-redact', 'openredaction'];
const NAME = { 'redact-secret': 'redact-secret', 'flare-redact': 'flare-redact', openredaction: 'OpenRedaction' };

const plan = await readJson('qualification/runtime-comparison-v2.json');
const reports = {};
for (const id of SETTINGS) { try { reports[id] = await readJson(`benchmarks/inputs/runtime/runtime-comparison-${id}.json`); } catch { /* not committed */ } }

const chunks = html.split('data-peer="').slice(1).map(c => ({ peer: c.slice(0, c.indexOf('"')), setting: /data-setting="([^"]+)"/.exec(c)?.[1], html: c }));
if (chunks.length !== PEERS.length * SETTINGS.length) fail(`/comparison/performance/ has ${chunks.length} panels, expected ${PEERS.length * SETTINGS.length}`);
for (const k of ['data-peer', 'data-setting']) if (!html.includes(k) || !html.includes(`dataset.${k.slice(5)}`)) fail(`/comparison/performance/ does not carry the ${k} query state`);

const obs = (report, tool, workload) => report?.observations.find(o => o.tool === tool && o.workload === workload);
const lo = (r, k) => Math.min(...r.samples.map(s => s.redactMs));
const times = Object.values(reports).flatMap(r => r.observations.flatMap(o => [o.summary.medianMs, Math.min(...o.samples.map(s => s.redactMs)), Math.max(...o.samples.map(s => s.redactMs))]));
const axis = times.length ? { lo: Math.floor(Math.log10(Math.min(...times))), hi: Math.max(Math.floor(Math.log10(Math.min(...times))) + 1, Math.ceil(Math.log10(Math.max(...times)))) } : { lo: 0, hi: 4 };
const pos = v => Math.min(1, Math.max(0, (Math.log10(v) - axis.lo) / (axis.hi - axis.lo))) * 100;

const FORBIDDEN = /fastest|slowest|faster|slower|\bbest\b|worst|winner|better|\bcaught\b|\bmissed\b|\bshould\b|\bcorrect\b|\d\s?×/i;
const ALLOWED = /Not a ranking|no ranking assertion|Nothing here is a ranking/g;

for (const { peer, setting, html: chunk } of chunks) {
  const key = `${peer}/${setting}`;
  const panel = text(chunk.split('data-peer="')[0]);
  const report = reports[setting];
  const document = new JSDOM(chunk).window.document;
  const ownSection = [...document.querySelectorAll('h2')].find(h => h.textContent === 'redact-secret on its own')?.closest('section');
  if (!ownSection) fail(`/comparison/performance/ ${key} has no separate own section`);
  else {
    if (/flare-redact|OpenRedaction/.test(ownSection.textContent)) fail(`/comparison/performance/ ${key} own section includes a peer`);
    if ([...ownSection.querySelectorAll('thead th')].length && ownSection.querySelectorAll('thead th').length !== 4) fail(`/comparison/performance/ ${key} own table does not have four product-only columns`);
  }
  if (!document.querySelector('a[href="https://github.com/redact-secret/credential-eval/issues/68"]')) fail(`/comparison/performance/ ${key} has no neutral workload handoff`);
  if (report && !document.querySelector(`a[href="https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/benchmarks/inputs/runtime/runtime-comparison-${setting}.json"]`)) fail(`/comparison/performance/ ${key} has no exact selected pair evidence link`);
  if (FORBIDDEN.test(panel.replace(ALLOWED, ''))) fail(`/comparison/performance/ ${key} contains a ranking or verdict word: ${FORBIDDEN.exec(panel.replace(ALLOWED, ''))[0]}`);
  for (const group of ['How big is the text?', 'What does the text look like?', 'Text built to slow scanners down', 'How many secrets does it hold?', 'Does it arrive whole or in pieces?'])
    if (!panel.includes(group)) fail(`/comparison/performance/ ${key} does not list the unmeasured group "${group}"`);
  if ((panel.match(/Not measured/g) ?? []).length < 5) fail(`/comparison/performance/ ${key} states fewer than five "Not measured" gaps`);
  if (!panel.includes('#571')) fail(`/comparison/performance/ ${key} does not point at its follow-up issue`);
  if (!panel.includes('Only times from one run are set side by side')) fail(`/comparison/performance/ ${key} does not state the same-run rule`);
  if (!report) { if (!panel.includes('Not measured yet')) fail(`/comparison/performance/ ${key} has no report and must say "Not measured yet"`); continue; }
  if (!panel.includes(report.generatedAt.slice(0, 10))) fail(`/comparison/performance/ ${key} does not state the run date`);
  for (const t of report.tools.filter(t => t.id === 'redact-secret' || t.id === peer)) if (!panel.includes(t.version)) fail(`/comparison/performance/ ${key} does not state ${t.id} ${t.version}`);
  // The build chip follows the report: a published package reads "npm", a local build of the pinned commit reads "local build · unreleased".
  const kind = report.tools.find(t => t.id === 'redact-secret').provenance.kind;
  const chip = kind === 'local-source-build' ? 'local build · unreleased' : 'npm';
  if (!panel.includes(chip)) fail(`/comparison/performance/ ${key} does not state the redact-secret build as "${chip}" (${kind})`);
  if (kind !== 'local-source-build' && panel.includes('local build · unreleased')) fail(`/comparison/performance/ ${key} calls a published redact-secret a local unreleased build`);

  // The noise figure: the largest movement of this peer's median between the committed runs.
  const runs = Object.values(reports);
  let worst = 0;
  for (const w of plan.workloads) {
    const t = runs.map(r => obs(r, peer, w.id)?.summary.medianMs).filter(Boolean);
    if (t.length > 1) worst = Math.max(worst, (Math.max(...t) - Math.min(...t)) / Math.min(...t));
  }
  if (runs.length > 1 && !panel.includes(`moved by up to ${Math.round(worst * 100)}%`)) fail(`/comparison/performance/ ${key} does not state the ${Math.round(worst * 100)}% run-to-run movement`);

  let checked = 0;
  const questions = plan.workloads.map(w => w.question);
  for (const w of plan.workloads) {
    const a = obs(report, 'redact-secret', w.id), b = obs(report, peer, w.id);
    const start = panel.indexOf(w.description);
    if (start < 0) { fail(`/comparison/performance/ ${key} has no row for ${w.id}`); continue; }
    const next = plan.workloads.map(x => panel.indexOf(x.description, start + 1)).filter(i => i > start).sort((x, y) => x - y)[0];
    const row = panel.slice(start, next ?? start + 1500);
    const total = w.lines.reduce((n, l) => n + l.values.length, 0);
    const cellText = (o, tool) => {
      const hidden = report.outcomes.find(x => x.tool === tool && x.workload === w.id).lines.reduce((n, l) => n + l.valuesHidden, 0);
      const s = o.samples.map(x => x.redactMs);
      return [`${ms(o.summary.medianMs)} ms`, `${mbs(o.summary.medianBytesPerSecond)} MB/s · ${o.samples.length} runs`, `${ms(Math.min(...s))} to ${ms(Math.max(...s))} ms`, `Hid ${fixed(hidden, 0)} of ${fixed(total, 0)} values`];
    };
    if (!a || !b) { fail(`/comparison/performance/ ${key}: the report lacks ${w.id}`); continue; }
    const wantA = cellText(a, 'redact-secret'), wantB = cellText(b, peer);
    let cursor = row.indexOf(w.id);
    if (cursor < 0) fail(`/comparison/performance/ ${key} ${w.id} does not show its id`);
    for (const [side, want] of [['redact-secret', wantA], [NAME[peer], wantB]]) {
      for (const piece of want) {
        const at = row.indexOf(piece, cursor);
        if (at < 0) { fail(`/comparison/performance/ ${key} ${w.id}: ${side} does not show "${piece}" (in order, redact-secret first)`); break; }
        cursor = at;
      }
    }
    if (!row.includes(kib(a.workloadBytes))) fail(`/comparison/performance/ ${key} ${w.id} does not state its size ${kib(a.workloadBytes)}`);
    // Mark positions on the shared axis, read from the markup.
    const check = (tool, o) => {
      const re = new RegExp(`style="--at:([\\d.e-]+)%"[^>]*title="${NAME[tool]} ${ms(o.summary.medianMs).replace(/[.,]/g, m => `\\${m}`)} ms"`, 'g');
      const found = [...chunk.matchAll(re)].map(m => Number(m[1]));
      if (!found.some(p => Math.abs(p - pos(o.summary.medianMs)) < 0.02)) fail(`/comparison/performance/ ${key} ${w.id}: ${tool} mark is not at ${pos(o.summary.medianMs).toFixed(2)}% of the axis`);
    };
    check('redact-secret', a); check(peer, b);
    // Overlapping ranges must be marked, and only those (or those inside the run-to-run movement).
    const aMin = lo(a), aMax = Math.max(...a.samples.map(s => s.redactMs)), bMin = lo(b), bMax = Math.max(...b.samples.map(s => s.redactMs));
    const overlap = aMin <= bMax && bMin <= aMax;
    const t = Object.values(reports).map(r => obs(r, peer, w.id)?.summary.medianMs).filter(Boolean);
    const spread = t.length > 1 ? (Math.max(...t) - Math.min(...t)) / Math.min(...t) : undefined;
    const apart = Math.abs(a.summary.medianMs - b.summary.medianMs) / Math.min(a.summary.medianMs, b.summary.medianMs);
    const near = overlap || (spread !== undefined && apart <= spread);
    const marked = /not read as different/.test(row);
    if (near !== marked) fail(`/comparison/performance/ ${key} ${w.id}: ${near ? 'times inside the noise are not marked' : 'times apart by more than the noise are marked as not different'}`);
    checked++;
  }
  if (checked !== plan.workloads.length) fail(`/comparison/performance/ ${key}: checked ${checked} of ${plan.workloads.length} texts`);
  void questions;
}

// redact-secret on its own: the Node rows of the accepted run, in a table that carries no peer time.
const criteria = await readJson('benchmarks/performance-criteria.json');
const dir = criteria.baseline.verificationPath.replace(/\/[^/]*$/, '');
let summary;
try { summary = validateCurrentPerformanceInputs(await readJson('benchmarks/inputs/performance/current.json')).records.accepted.data; } catch { /* not committed */ }
const any = text(chunks[0]?.html ?? '');
if (summary) {
  for (const run of summary.runs.filter(r => r.kind === 'performance' && r.surface === 'node' && r.status === 'complete')) {
    const d = run.result.performance;
    for (const want of [run.profileId, `${ms(d.processing.median)} ms`, `${ms(d.processing.p95)} ms`, `${mbs(d.throughput.median)} MB/s`, `${ms(d.processing.minimum)} to ${ms(d.processing.maximum)} ms`])
      if (!any.includes(want)) fail(`/comparison/performance/ does not show "${want}" for redact-secret's own ${run.profileId} run`);
  }
  if (!html.includes('href="https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/benchmarks/inputs/performance/current.json"')) fail('/comparison/performance/ has no separate accepted profile evidence link');
  if (!any.includes(summary.sourceCommit.slice(0, 12))) fail('/comparison/performance/ does not name the accepted run\'s product commit');
  if (!any.includes('not set beside those times')) fail('/comparison/performance/ does not say the own-run times are apart from the pair');
} else if (!any.includes('Not measured yet')) fail('/comparison/performance/ has no accepted run to read and must say so');

// The navigation and the runtime page link to it.
const runtimeHtml = await readFile(path.join(webRoot, 'out/comparison/runtime/index.html'), 'utf8');
if (!/href="[^"]*\/comparison\/performance\/"/.test(runtimeHtml)) fail('/comparison/runtime/ does not link to /comparison/performance/');

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`performance pair ok: ${chunks.length} panels, every time, spread, hidden count, mark position and noise figure matches the committed reports`);
