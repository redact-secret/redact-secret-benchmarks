// DIAGNOSTIC ONLY (not the official #286/#428 protocol): node-sample.mjs plus a --mode switch.
// official: same sequence as scripts/pii-profile-cost/node-sample.mjs (import, initialize, scan, incremental).
// settle10: identical, plus a 10 ms pause between the whole-input scan and the incremental session.
// warm: identical, then a second incremental session in the same process; reports the second one.
// noWhole: skip the whole-input scan; the incremental session is the first scan in the process.
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
const [modulePath, mode, selectorsArg, workloadFile] = process.argv.slice(2);
const { readFileSync } = await import('node:fs');
const { text, chunks } = JSON.parse(readFileSync(workloadFile, 'utf8'));
const core = await import(pathToFileURL(modulePath).href);
await core.initialize(selectorsArg === 'off' ? undefined : { pii: selectorsArg.split(',') });
if (core.artifact() !== 'wasm') throw new Error('not wasm');
const bytes = Buffer.byteLength(text);
const session = () => { const t = performance.now(); const s = core.createIncrementalSanitizer({ limits: { maxInputCodeUnits: Math.max(bytes + 1024, 65536),
  maxBufferedCodeUnits: 32768, maxTokenCodeUnits: 4096, maxMultilineCodeUnits: 4096 } }); for (const c of chunks) s.append(c); s.finalize(); return performance.now() - t; };
let whole = null;
if (mode !== 'noWhole') { const t = performance.now(); core.scan(text); whole = performance.now() - t; }
if (mode === 'settle10') await new Promise(r => setTimeout(r, 10));
let incremental = session();
if (mode === 'warm') incremental = session();
const rss = process.resourceUsage().maxRSS * (process.platform === 'darwin' ? 1 : 1024);
process.stdout.write(JSON.stringify({ whole, incremental, peakRss: rss }) + '\n');
