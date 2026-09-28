import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { parseSingleInput } from './adapter-protocol.mjs';

const argument = process.argv[2];
if (!argument?.startsWith('--binary=')) throw new Error('Required: --binary=<qualified CLI>');
const binary = argument.slice('--binary='.length);
let stdin = '';
for await (const chunk of process.stdin) stdin += chunk;
const input = parseSingleInput(stdin);
if (input.credentialProfile !== 'full') throw new Error('CLI has no common profile option');
let workload = Buffer.from(input.workloadBase64, 'base64url');
const selectors = input.selectors.flatMap(selector => ['--pii', selector]);

async function run(args, payload, allowedExitCodes = [0], captureStdout = false) {
  const started = performance.now();
  const child = spawn(binary, args, { stdio: ['pipe', captureStdout ? 'pipe' : 'ignore', 'pipe'], env: { PATH: process.env.PATH ?? '', NO_COLOR: '1' } });
  let stdout = '', stderr = '', peakRss = 0;
  if (captureStdout) { child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { stdout += chunk; }); }
  child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk.slice(0, 16 * 1024 - stderr.length); });
  const timer = setInterval(async () => {
    try {
      const status = await readFile(`/proc/${child.pid}/status`, 'utf8');
      const match = /^VmHWM:\s+(\d+)\s+kB$/m.exec(status); if (match) peakRss = Math.max(peakRss, Number(match[1]) * 1024);
    } catch { /* The process may exit between samples. */ }
  }, 1);
  child.stdin.end(payload);
  const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearInterval(timer);
  if (!allowedExitCodes.includes(exit.code) || exit.signal !== null || stderr !== '')
    throw new Error(`CLI sample failed: code=${exit.code} signal=${exit.signal}`);
  return { milliseconds: performance.now() - started, stdout,
    peakRss: peakRss || { status: 'not-applicable', reasonCode: 'linux-proc-status-unavailable' } };
}

const initialize = await run(['--print-pii-activation', ...selectors], Buffer.alloc(0), [0], true);
if (initialize.stdout.trim() !== input.expectedActivation || input.expectedArtifact !== 'compiled')
  throw new Error('CLI profile-cost activation or artifact identity mismatch');
// redact-secret exits 1 when findings are present; that is the expected result
// for these synthetic detector workloads. Exit 2 and signals remain failures.
const whole = await run(['--json', ...selectors], workload, [0, 1]);
const workloadBytes = workload.length;
workload = Buffer.alloc(0);
const unavailableIncremental = { status: 'not-applicable', reasonCode: 'surface-has-no-incremental-api' };
const unavailableRetained = { status: 'not-applicable', reasonCode: 'one-shot-process-has-no-post-operation-retained-state' };
process.stdout.write(`${JSON.stringify({
  import: { status: 'not-applicable', reasonCode: 'compiled-surface-has-no-runtime-import' },
  initialize: initialize.milliseconds,
  wholeInput: whole.milliseconds,
  incremental: unavailableIncremental,
  bytesPerSecond: { wholeInput: whole.milliseconds === 0 ? Number.MAX_VALUE : workloadBytes * 1000 / whole.milliseconds,
    incremental: unavailableIncremental },
  memory: { processPeakRss: typeof whole.peakRss === 'number' && typeof initialize.peakRss === 'number' ?
    Math.max(whole.peakRss, initialize.peakRss) : whole.peakRss, processRetainedRss: unavailableRetained },
})}\n`);
