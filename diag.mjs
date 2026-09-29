// DIAGNOSTIC ONLY. ABBA-interleaved fresh processes, old (8f97f14d) vs new (8b6a5fde) forced-Wasm Node packages.
import { spawnSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import os from 'node:os'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const rounds = Number(process.argv[2] ?? 12);
for (const v of ['old', 'new']) { const d = path.join(here, 'inst', v); mkdirSync(d, { recursive: true }); execSync('npm init -y >/dev/null', { cwd: d });
  execSync(`npm install --no-package-lock --omit=optional ${readdirSync(path.join(here, 'pkgs', v)).map(f => path.join(here, 'pkgs', v, f)).join(' ')} >/dev/null 2>&1`, { cwd: d }); }
const wl = JSON.parse(readFileSync(path.join(here, 'pii-profile-cost-workloads-v1.json'), 'utf8'));
const files = {};
for (const d of wl.workloads) { const lines = Array.from({ length: wl.generator.lineCount }, (_, i) => d.lines[i % d.lines.length]); const text = lines.join('\n') + '\n', chunks = [];
  for (let i = 0; i < text.length; i += wl.generator.chunkCodeUnits) chunks.push(text.slice(i, i + wl.generator.chunkCodeUnits));
  files[d.id] = path.join(os.tmpdir(), `diag902-${d.id}.json`); writeFileSync(files[d.id], JSON.stringify({ text, chunks })); }
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const mod = (v, cp) => path.join(here, 'inst', v, 'node_modules/@redact-secret/core/dist', cp === 'common' ? 'common.js' : 'index.js');
const one = (v, cp, mode, sel, w) => { const r = spawnSync(process.execPath, [path.join(here, 'sample.mjs'), mod(v, cp), mode, sel, files[w]], { encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); return JSON.parse(r.stdout); };
console.log(`cpu ${os.cpus()[0].model} node ${process.version} rounds ${rounds}`);
const cells = [];
for (const cp of ['full', 'common']) for (const sel of ['pii:family:us:ssn', 'pii:global', 'off']) for (const w of ['validator-heavy', 'multilingual-context']) cells.push([cp, sel, w]);
for (const mode of ['official', 'settle10', 'warm', 'noWhole']) for (const [cp, sel, w] of cells) {
  const s = { old: [], new: [] };
  for (let i = 0; i < rounds; i++) for (const v of i % 2 ? ['old', 'new', 'new', 'old'] : ['new', 'old', 'old', 'new']) s[v].push(one(v, cp, mode, sel, w).incremental);
  const o = med(s.old), n = med(s.new);
  console.log([mode, cp, sel, w, o.toFixed(2), n.toFixed(2), (n / o).toFixed(3)].join('\t'));
}
