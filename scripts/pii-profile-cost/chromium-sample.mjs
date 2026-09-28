import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSingleInput } from './adapter-protocol.mjs';

const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(playwright|full-root|full-entry|common-root|common-entry)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('Invalid Chromium profile-cost adapter arguments');
  args[match[1]] = match[2];
}
if (['playwright', 'full-root', 'full-entry', 'common-root', 'common-entry'].some(key => !args[key]))
  throw new Error('Chromium profile-cost adapter paths are incomplete');
let stdin = '';
for await (const chunk of process.stdin) stdin += chunk;
const input = parseSingleInput(stdin);
const root = path.resolve(input.credentialProfile === 'common' ? args['common-root'] : args['full-root']);
const entry = input.credentialProfile === 'common' ? args['common-entry'] : args['full-entry'];
const entryPath = path.resolve(root, entry);
if (entryPath !== root && !entryPath.startsWith(`${root}${path.sep}`)) throw new Error('Invalid Chromium entry path');
await stat(entryPath);
const mime = file => file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.js') || file.endsWith('.mjs') ?
  'text/javascript; charset=utf-8' : 'application/octet-stream';
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end('<!doctype html><title>PII cost</title>'); return; }
    const file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('path traversal');
    const info = await stat(file); if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime(file), 'content-length': info.size, 'cache-control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const address = server.address();
const { chromium } = await import(pathToFileURL(path.resolve(args.playwright)).href);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  let peakHeap = 0;
  const heap = async () => {
    const metrics = await cdp.send('Performance.getMetrics');
    const used = metrics.metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value;
    if (!Number.isFinite(used)) return null;
    peakHeap = Math.max(peakHeap, used); return used;
  };
  const result = await page.evaluate(async ({ entry, input }) => {
    const measured = async operation => { const started = performance.now(); const value = await operation();
      return { milliseconds: performance.now() - started, value }; };
    const imported = await measured(() => import(`/${entry}?sample=1`));
    const core = imported.value;
    const initialized = await measured(async () => { await core.default(); return core.initialize(input.selectors); });
    if (core.piiActivation() !== input.expectedActivation || core.profile() !== input.credentialProfile || input.expectedArtifact !== 'wasm')
      throw new Error('Chromium profile-cost activation or artifact identity mismatch');
    const decode = value => { const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
      const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
      return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0))); };
    const workload = decode(input.workloadBase64);
    const chunks = input.chunksBase64.map(decode);
    const bytes = new TextEncoder().encode(workload).length;
    const whole = await measured(() => core.scan(workload));
    const incremental = await measured(() => {
      const session = core.createIncrementalSanitizer(Math.max(bytes + 1024, 65536), 32768, 8192, 16384);
      for (const chunk of chunks) session.append(chunk);
      return session.finalize();
    });
    return { import: imported.milliseconds, initialize: initialized.milliseconds, wholeInput: whole.milliseconds,
      incremental: incremental.milliseconds, bytes };
  }, { entry: entry.replaceAll(path.sep, '/'), input });
  await heap(); await cdp.send('HeapProfiler.collectGarbage'); const retainedHeap = await heap();
  const throughput = milliseconds => milliseconds === 0 ? Number.MAX_VALUE : result.bytes * 1000 / milliseconds;
  process.stdout.write(`${JSON.stringify({ import: result.import, initialize: result.initialize, wholeInput: result.wholeInput,
    incremental: result.incremental, bytesPerSecond: { wholeInput: throughput(result.wholeInput), incremental: throughput(result.incremental) },
    memory: { browserPeakJsHeap: { status: 'not-applicable', reasonCode: 'cdp-checkpoints-do-not-prove-js-heap-peak' },
      browserRetainedJsHeap: retainedHeap ?? { status: 'not-applicable', reasonCode: 'chromium-performance-metric-unavailable' },
      wasmLinearMemory: { status: 'not-applicable', reasonCode: 'public-binding-does-not-expose-memory-handle' } } })}\n`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
