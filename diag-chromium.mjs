// DIAGNOSTIC ONLY (benchmarks #428 / redact-secret #902, #996). Not the official pii-profile-cost-v2 protocol.
// Paired 8f97f14d (old) vs 8b6a5fde (new) CI-qualified wasm-web builds in headless Chromium, one fresh browser
// per sample (as the official adapter), ABBA-interleaved on the same host. The in-page sequence mirrors
// scripts/pii-profile-cost/chromium-sample-v2.mjs (import, default()+initialize(selectors), scan, incremental),
// with variants: official | settle10 (10 ms pause after the whole-input scan) | warm (second incremental session,
// timed) | cold (no whole-input scan before the incremental session). Initialize is also split into
// instantiate (default()) and initialize(selectors).
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http'; import os from 'node:os'; import path from 'node:path';
import { pathToFileURL } from 'node:url';
const here = path.dirname(new URL(import.meta.url).pathname);
const [playwrightPath, roundsArg] = process.argv.slice(2);
const rounds = Number(roundsArg ?? 20);
const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
const wl = JSON.parse(readFileSync(path.join(here, 'pii-profile-cost-workloads-v1.json'), 'utf8'));
const def = wl.workloads.find(w => w.id === 'validator-heavy');
const lines = Array.from({ length: wl.generator.lineCount }, (_, i) => def.lines[i % def.lines.length]);
const text = lines.join('\n') + '\n', chunks = [];
for (let i = 0; i < text.length; i += wl.generator.chunkCodeUnits) chunks.push(text.slice(i, i + wl.generator.chunkCodeUnits));
const mime = f => f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain';
const serve = root => new Promise(resolve => { const s = http.createServer(async (req, res) => {
  try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>diag</title>'); return; }
    const f = path.resolve(root, '.' + p); if (!f.startsWith(root + path.sep)) throw 0; const info = await stat(f);
    res.writeHead(200, { 'content-type': mime(f), 'content-length': info.size, 'cache-control': 'no-store' }); createReadStream(f).pipe(res);
  } catch { res.writeHead(404).end(); } }); s.listen(0, '127.0.0.1', () => resolve(s)); });
const servers = { old: await serve(path.join(here, 'web/old')), new: await serve(path.join(here, 'web/new')) };
const PHASE = process.env.PHASE ?? '1';
const jsFlags = variant => variant.endsWith('-turbofan') ? ['--js-flags=--no-liftoff --no-wasm-lazy-compilation'] : variant.endsWith('-liftoff') ? ['--js-flags=--liftoff-only --no-wasm-lazy-compilation'] : [];
async function sample(version, selectors, variant) {
  const browser = await chromium.launch({ headless: true, args: jsFlags(variant) });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${servers[version].address().port}/`);
    return await page.evaluate(async ({ entry, selectors, variant, text, chunks }) => {
      const t = () => performance.now();
      let a = t(); const core = await import(`/${entry}?s=1`); const importMs = t() - a;
      a = t(); await core.default(); const instantiateMs = t() - a;
      const b = t(); core.initialize(selectors); const initCallMs = t() - b;
      const initializeMs = t() - a;
      const bytes = new TextEncoder().encode(text).length;
      const session = () => { const s = t(); const x = core.createIncrementalSanitizer(Math.max(bytes + 1024, 65536), 32768, 8192, 16384);
        for (const c of chunks) x.append(c); x.finalize(); return t() - s; };
      let wholeMs = null;
      if (variant !== 'cold') { const s = t(); core.scan(text); wholeMs = t() - s; }
      if (variant === 'settle10') await new Promise(r => setTimeout(r, 10));
      let incrementalMs = session();
      if (variant === 'warm') incrementalMs = session();
      // steady: five more sessions, each after a 100 ms pause, report the last (tier-up given time to finish).
      if (variant === 'steady') for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 100)); incrementalMs = session(); }
      return { importMs, instantiateMs, initCallMs, initializeMs, wholeMs, incrementalMs, activation: core.piiActivation() };
    }, { entry: selectors.length ? 'redact_secret_wasm_pii.js' : 'redact_secret_wasm.js', selectors, variant, text, chunks });
  } finally { await browser.close(); }
}
const configs1 = [
  ['global', ['pii:global'], 'official'], ['global', ['pii:global'], 'settle10'], ['global', ['pii:global'], 'warm'], ['global', ['pii:global'], 'cold'],
  ['us-ssn-exact', ['pii:family:us:ssn'], 'official'], ['us-ssn-exact', ['pii:family:us:ssn'], 'settle10'], ['us-ssn-exact', ['pii:family:us:ssn'], 'warm'], ['us-ssn-exact', ['pii:family:us:ssn'], 'cold'],
  ['us-jurisdiction', ['pii:us'], 'official'], ['off', [], 'official'], ['off', [], 'cold'],
];
// Phase 2 (second diagnostic run): steady state and tier-pinned code, which separate code speed from tier-up timing.
const configs2 = [];
for (const [profile, selectors] of [['global', ['pii:global']], ['us-ssn-exact', ['pii:family:us:ssn']], ['off', []]])
  for (const variant of ['official', 'steady', 'official-turbofan', 'official-liftoff']) configs2.push([profile, selectors, variant]);
const configs = PHASE === '2' ? configs2 : configs1;
const out = { cpu: os.cpus()[0].model, chromium: chromium.executablePath(), rounds, samples: [] };
for (let i = 0; i < rounds; i++) for (const [profile, selectors, variant] of configs)
  for (const v of i % 2 ? ['old', 'new', 'new', 'old'] : ['new', 'old', 'old', 'new']) out.samples.push({ round: i, version: v, profile, variant, ...(await sample(v, selectors, variant)) });
writeFileSync(process.env.OUT ?? 'samples.json', JSON.stringify(out));
for (const s of Object.values(servers)) s.close();
console.log(`done ${out.samples.length} samples on ${out.cpu}`);
