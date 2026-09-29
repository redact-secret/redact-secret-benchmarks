import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { parseSingleInput } from './adapter-protocol.mjs';

const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(full-module|common-module)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('Invalid Node profile-cost adapter arguments');
  args[match[1]] = match[2];
}
if (!args['full-module'] || !args['common-module'] || typeof global.gc !== 'function')
  throw new Error('Node profile-cost adapter requires both module paths and --expose-gc');
let stdin = '';
for await (const chunk of process.stdin) stdin += chunk;
const input = parseSingleInput(stdin);
let workload = Buffer.from(input.workloadBase64, 'base64url').toString('utf8');
let chunks = input.chunksBase64.map(value => Buffer.from(value, 'base64url').toString('utf8'));
const workloadBytes = Buffer.byteLength(workload);
const peak = { rss: 0, heapUsed: 0, external: 0 };
const observe = () => {
  const memory = process.memoryUsage();
  peak.rss = Math.max(peak.rss, memory.rss); peak.heapUsed = Math.max(peak.heapUsed, memory.heapUsed);
  peak.external = Math.max(peak.external, memory.external);
};
const timed = async operation => { const start = performance.now(); const result = await operation(); const elapsed = performance.now() - start;
  observe(); return { elapsed, result }; };

const modulePath = input.credentialProfile === 'common' ? args['common-module'] : args['full-module'];
const imported = await timed(() => import(pathToFileURL(modulePath).href));
const core = imported.result;
const initialized = await timed(() => core.initialize(input.selectors.length ? { pii: input.selectors } : undefined));
if (core.piiActivation() !== input.expectedActivation || core.artifact() !== input.expectedArtifact)
  throw new Error('Node profile-cost activation or artifact identity mismatch');
const whole = await timed(() => core.scan(workload));
let session;
const incremental = await timed(() => {
  session = core.createIncrementalSanitizer({ limits: {
    maxInputCodeUnits: Math.max(workloadBytes + 1024, 65536),
    maxBufferedCodeUnits: 32768,
    maxTokenCodeUnits: 4096,
    maxMultilineCodeUnits: 4096,
  } });
  for (const chunk of chunks) session.append(chunk);
  return session.finalize();
});
session = null; imported.result = null; chunks = []; workload = '';
global.gc(); global.gc();
const retained = process.memoryUsage();
const peakRss = process.resourceUsage().maxRSS * (process.platform === 'darwin' ? 1 : 1024);
const perSecond = milliseconds => milliseconds === 0 ? Number.MAX_VALUE : workloadBytes * 1000 / milliseconds;
process.stdout.write(`${JSON.stringify({
  import: imported.elapsed,
  initialize: initialized.elapsed,
  wholeInput: whole.elapsed,
  incremental: incremental.elapsed,
  bytesPerSecond: { wholeInput: perSecond(whole.elapsed), incremental: perSecond(incremental.elapsed) },
  memory: {
    nodePeakRss: peakRss,
    nodeRetainedRss: retained.rss,
    nodeRetainedHeap: retained.heapUsed,
    nodeRetainedExternal: retained.external,
    nodePeakHeap: { status: 'not-applicable', reasonCode: 'runtime-exposes-no-continuous-heap-high-water-mark' },
    nodePeakExternal: { status: 'not-applicable', reasonCode: 'runtime-exposes-no-continuous-external-high-water-mark' },
  },
})}\n`);
