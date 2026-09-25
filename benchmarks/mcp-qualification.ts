/**
 * Black-box MCP adapter boundary and operational qualification (#281).
 *
 *   npm run mcp:qualify -- \
 *     --core-package <core.tgz> --core-node-package <node-<platform>.tgz> --core-wasm-package <wasm.tgz> \
 *     --core-source-commit <40-hex> --adapter-dir <dir with the pinned adapter tarballs> \
 *     --adapter-pin <redact-secret adapters/pin-source.json> --compatibility <adapters compatibility.json> \
 *     [--node <path>]... [--transports stdio,http] [--overhead-processes 3] [--init-processes 15] [--quick] \
 *     --out <report.json> [--markdown-out <report.md>] [--overhead-out <series.json>]
 *
 * For every declared SDK endpoint it installs the exact tarballs into a clean
 * consumer, as an ordinary npm consumer would, and for every Node.js runtime
 * and transport it drives a real MCP client and a real MCP server process
 * through the adversarial workload corpus. It then scans every sink the host
 * wrote for synthetic plaintext, measures the per-call overhead against an
 * unprotected host, initialization and package size, and writes one report.
 * It never imports an adapter's source or a private API. Spec:
 * docs/specs/mcp-qualification.md.
 */

import { execFile, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

import {
  adapterPinProblems, assertNoPlaintext, installedDigest, median, OVERHEAD_SCHEMA, packageSize, REPORT_SCHEMA, scanRecordDir,
  scanText, needles, SERIES_SCHEMA, sha256File, summarizeCell, tarballName, verdict, type AdapterPin, type CaseDeclaration,
  type CaseVerdict, type HostCaseRow,
} from './lib/mcp-qualification.ts';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const consumerSource = path.join(here, 'mcp-qualification', 'consumer');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// The workload corpus is shared with the host: import it from the source tree.
const W = await import(pathToFileURL(path.join(consumerSource, 'workloads.mjs')).href) as typeof import('./mcp-qualification/consumer/workloads.mjs');

type Flags = Record<string, string[]>;

function parse(argv: readonly string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]!;
    if (!key.startsWith('--')) throw new Error(`mcp-qualification: unexpected argument ${key}`);
    const name = key.slice(2);
    if (name === 'quick' || name === 'keep') { (flags[name] ??= []).push('true'); continue; }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`mcp-qualification: --${name} needs a value`);
    (flags[name] ??= []).push(value);
    i += 1;
  }
  return flags;
}

function one(flags: Flags, name: string, fallback?: string): string {
  const value = flags[name]?.at(-1) ?? fallback;
  if (value === undefined) throw new Error(`mcp-qualification: --${name} is required`);
  return value;
}

const flags = parse(process.argv.slice(2));
const quick = flags.quick !== undefined;
const keep = flags.keep !== undefined;
const corePackage = path.resolve(one(flags, 'core-package'));
const coreNodePackage = path.resolve(one(flags, 'core-node-package'));
const coreWasmPackage = path.resolve(one(flags, 'core-wasm-package'));
const coreSourceCommit = one(flags, 'core-source-commit');
if (!/^[0-9a-f]{40}$/.test(coreSourceCommit)) throw new Error('mcp-qualification: --core-source-commit must be a 40-hex commit');
const adapterDir = path.resolve(one(flags, 'adapter-dir'));
const adapterPinPath = path.resolve(one(flags, 'adapter-pin'));
const compatibilityPath = path.resolve(one(flags, 'compatibility'));
const nodes = (flags.node ?? [process.execPath]).map(p => path.resolve(p));
const transports = one(flags, 'transports', 'stdio,http').split(',');
const overheadProcesses = Number(one(flags, 'overhead-processes', quick ? '1' : '3'));
const initProcesses = Number(one(flags, 'init-processes', quick ? '3' : '15'));
const outPath = path.resolve(one(flags, 'out'));
const markdownOut = flags['markdown-out'] ? path.resolve(one(flags, 'markdown-out')) : null;
const overheadOut = flags['overhead-out'] ? path.resolve(one(flags, 'overhead-out')) : null;

// ---------------------------------------------------------------------------
// Inputs and identity
// ---------------------------------------------------------------------------

const pin = JSON.parse(readFileSync(adapterPinPath, 'utf8')) as AdapterPin;
const pinProblems = adapterPinProblems(pin, adapterDir);
if (pinProblems.length > 0) {
  for (const problem of pinProblems) console.error(`mcp-qualification: ${problem}`);
  process.exit(1);
}
const compatibility = JSON.parse(readFileSync(compatibilityPath, 'utf8')) as { packages: { name: string; runtime: { range: string }; requires: { name: string; range: string; endpoints: { lowest: string; highest: string } }[] }[] };
const mcpEntry = compatibility.packages.find(p => p.name === '@redact-secret/adapter-mcp');
if (!mcpEntry) throw new Error('mcp-qualification: the compatibility record has no @redact-secret/adapter-mcp entry');
const requirement = (name: string) => {
  const found = mcpEntry.requires.find(r => r.name === name);
  if (!found) throw new Error(`mcp-qualification: the compatibility record declares no ${name} range`);
  return found;
};
const v1 = requirement('@modelcontextprotocol/sdk');
const v2client = requirement('@modelcontextprotocol/client');
const v2server = requirement('@modelcontextprotocol/server');
if (v2client.endpoints.lowest !== v2server.endpoints.lowest || v2client.endpoints.highest !== v2server.endpoints.highest) {
  throw new Error('mcp-qualification: the 2.x client and server endpoints differ; the harness installs them as one line');
}
const ENDPOINTS = [
  { line: 'v1', endpoint: 'lowest', packages: { '@modelcontextprotocol/sdk': v1.endpoints.lowest } },
  { line: 'v1', endpoint: 'highest', packages: { '@modelcontextprotocol/sdk': v1.endpoints.highest } },
  { line: 'v2', endpoint: 'lowest', packages: { '@modelcontextprotocol/client': v2client.endpoints.lowest, '@modelcontextprotocol/server': v2server.endpoints.lowest } },
  { line: 'v2', endpoint: 'highest', packages: { '@modelcontextprotocol/client': v2client.endpoints.highest, '@modelcontextprotocol/server': v2server.endpoints.highest } },
] as const;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

async function nodeVersion(node: string): Promise<string> {
  return (await exec(node, ['--version'])).stdout.trim();
}

function tarPackageName(file: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), '281-mcp-identity-'));
  try {
    execFileSync('tar', ['-xzf', file, '-C', dir, 'package/package.json']);
    return (JSON.parse(readFileSync(path.join(dir, 'package/package.json'), 'utf8')) as { name: string }).name;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const coreNodeName = tarPackageName(coreNodePackage);
const adapterTarballs = Object.fromEntries(pin.packages.map(p => [p.name, path.join(adapterDir, tarballName(p.name, p.version))]));

// ---------------------------------------------------------------------------
// Clean consumers, one per SDK endpoint
// ---------------------------------------------------------------------------

interface Consumer { readonly root: string; readonly endpoint: typeof ENDPOINTS[number]; readonly installed: Record<string, string> }

async function installConsumer(endpoint: typeof ENDPOINTS[number]): Promise<Consumer> {
  const root = mkdtempSync(path.join(os.tmpdir(), '281-mcp-consumer-'));
  const manifest = {
    name: 'redact-secret-mcp-qualification-consumer', private: true, type: 'module',
    dependencies: {
      '@redact-secret/core': `file:${corePackage}`,
      ...Object.fromEntries(Object.entries(adapterTarballs).map(([name, file]) => [name, `file:${file}`])),
      ...endpoint.packages,
    },
    overrides: { '@redact-secret/wasm': `file:${coreWasmPackage}`, [coreNodeName]: `file:${coreNodePackage}` },
  };
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await exec(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], {
    cwd: root, timeout: 300_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  cpSync(consumerSource, root, { recursive: true });
  const installed: Record<string, string> = {};
  for (const name of ['@redact-secret/core', coreNodeName, '@redact-secret/wasm', ...Object.keys(adapterTarballs), ...Object.keys(endpoint.packages)]) {
    installed[name] = (JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version;
  }
  for (const pkg of pin.packages) {
    const digest = installedDigest(path.join(root, 'node_modules', pkg.name));
    if (digest !== pkg.contentDigest) throw new Error(`mcp-qualification: installed ${pkg.name} is not the pinned build`);
  }
  for (const [name, version] of Object.entries(endpoint.packages)) {
    if (installed[name] !== version) throw new Error(`mcp-qualification: ${name} resolved to ${installed[name]}, not the declared endpoint ${version}`);
  }
  return { root, endpoint, installed };
}

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

const declarations: Record<string, CaseDeclaration> = Object.fromEntries(
  [...W.RESULT_CASES, ...W.TOOL_CASES, ...W.STREAM_CASES, ...W.POLICY_CASES, W.CONTROL_CASE].map(c => [c.id, c as CaseDeclaration]),
);
const secrets = W.allSecrets();

interface HostRun { readonly code: number | null; readonly stdout: string; readonly stderr: string }

function runHost(node: string, cwd: string, args: string[], timeoutMs: number): Promise<HostRun> {
  return new Promise(resolve => {
    execFile(node, args, { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : null) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function readResult(dir: string): unknown {
  try { return JSON.parse(readFileSync(path.join(dir, 'result.json'), 'utf8')); } catch { return null; }
}

interface Cell {
  readonly node: string;
  readonly line: string;
  readonly endpoint: string;
  readonly sdk: Record<string, string>;
  readonly transport: string;
  readonly protocolVersion: string | null;
  readonly status: 'complete' | 'failed';
  readonly failure?: string;
  readonly summary?: ReturnType<typeof summarizeCell>;
  readonly processOutput?: { readonly hostStdout: boolean; readonly hostStderr: boolean; readonly serverStderr: boolean };
  readonly cases?: readonly CaseVerdict[];
}

async function containmentCell(consumer: Consumer, node: string, transport: string): Promise<Cell> {
  const runtime = `node-${(await nodeVersion(node)).replace(/^v/, '')}`;
  const base = { node: runtime, line: consumer.endpoint.line, endpoint: consumer.endpoint.endpoint, sdk: { ...consumer.endpoint.packages }, transport };
  const recordDir = mkdtempSync(path.join(os.tmpdir(), '281-mcp-records-'));
  try {
    const run = await runHost(node, consumer.root, ['host.mjs', 'containment', consumer.endpoint.line, transport, recordDir], 300_000);
    const list = needles(secrets);
    const processOutput = { hostStdout: scanText(run.stdout, list).fragment, hostStderr: scanText(run.stderr, list).fragment, serverStderr: false };
    const result = readResult(recordDir);
    if (run.code !== 0 || result === null) {
      return { ...base, protocolVersion: null, status: 'failed', failure: `host exited ${run.code}`, processOutput };
    }
    const output = result as { protocolVersion: string | null; runtime: string; sdk: Record<string, string>; cases: HostCaseRow[] };
    const scan = scanRecordDir(recordDir, secrets);
    processOutput.serverStderr = scan.serverStderr.fragment;
    const verdicts = output.cases.map(row => verdict(row, declarations[row.id], scan));
    const missing = W.ALL_CASE_IDS.filter(id => !output.cases.some(row => row.id === id));
    if (missing.length > 0) return { ...base, protocolVersion: output.protocolVersion, status: 'failed', failure: `cases not run: ${missing.join(', ')}`, processOutput };
    return { ...base, sdk: output.sdk, protocolVersion: output.protocolVersion, status: 'complete', summary: summarizeCell(verdicts), processOutput, cases: verdicts };
  } finally {
    if (!keep) rmSync(recordDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Operational cost
// ---------------------------------------------------------------------------

async function overheadRun(consumer: Consumer, node: string, transport: string) {
  const recordDir = mkdtempSync(path.join(os.tmpdir(), '281-mcp-overhead-'));
  try {
    const run = await runHost(node, consumer.root, ['--expose-gc', 'host.mjs', 'overhead', consumer.endpoint.line, transport, recordDir, ...(quick ? ['--quick'] : [])], 1_800_000);
    const result = readResult(recordDir);
    if (run.code !== 0 || result === null) throw new Error(`mcp-qualification: overhead host exited ${run.code}`);
    return result as { runtime: string; platform: string; arch: string; method: Record<string, unknown> & { repetitions: number }; results: Record<string, unknown>[]; memory: unknown };
  } finally {
    rmSync(recordDir, { recursive: true, force: true });
  }
}

async function initTimes(consumer: Consumer, node: string) {
  const samples: Record<'core' | 'adapter', number[]> = { core: [], adapter: [] };
  for (let i = 0; i < initProcesses; i += 1) {
    for (const which of (i % 2 === 0 ? ['core', 'adapter'] : ['adapter', 'core']) as ('core' | 'adapter')[]) {
      const run = await runHost(node, consumer.root, ['host.mjs', 'init', which], 60_000);
      if (run.code !== 0) throw new Error(`mcp-qualification: init probe ${which} exited ${run.code}`);
      samples[which].push((JSON.parse(run.stdout.trim()) as { milliseconds: number }).milliseconds);
    }
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const describe = (values: number[]) => ({ unit: 'milliseconds', samples: values.map(round), median: round(median(values)), p95: round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(0.95 * values.length) - 1)]!) });
  return {
    processes: initProcesses,
    definition: 'one fresh process per sample, alternating order: `core` imports @redact-secret/core and awaits initialize(); `adapter` imports @redact-secret/adapter-mcp, awaits createMcpBoundary(limits) (which loads and initializes the core) and sanitizes one benign result',
    core: describe(samples.core), adapter: describe(samples.adapter),
    adapterOverMedian: round(median(samples.adapter) - median(samples.core)),
  };
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const startedAt = new Date().toISOString();
const consumers: Consumer[] = [];
const cells: Cell[] = [];
const overheadOutputs: Record<string, unknown>[] = [];
let init: Awaited<ReturnType<typeof initTimes>> | null = null;
const overheadNode = nodes.find(n => execFileSync(n, ['--version'], { encoding: 'utf8' }).startsWith('v22.')) ?? nodes[0]!;
const workloadDigest = hash(JSON.stringify(W.OVERHEAD_PROFILES.map(p => ({ id: p.id, result: p.result() }))) + JSON.stringify(W.OVERHEAD_STREAM_PROFILE.chunks()));

try {
  for (const endpoint of ENDPOINTS) {
    console.error(`mcp-qualification: installing a clean consumer for ${Object.entries(endpoint.packages).map(([n, v]) => `${n}@${v}`).join(' + ')}`);
    const consumer = await installConsumer(endpoint);
    consumers.push(consumer);
    for (const node of nodes) {
      for (const transport of transports) {
        const cell = await containmentCell(consumer, node, transport);
        cells.push(cell);
        console.error(`mcp-qualification: ${cell.node} ${endpoint.line}@${Object.values(endpoint.packages)[0]} ${transport}: ${cell.status}${cell.summary ? ` leaks=${cell.summary.leaks} deviations=${cell.summary.deviations} known-fn=${cell.summary.knownFalseNegatives}` : ` ${cell.failure}`}`);
      }
    }
    for (const transport of transports) {
      for (let p = 0; p < overheadProcesses; p += 1) {
        const measured = await overheadRun(consumer, overheadNode, transport);
        overheadOutputs.push({
          schema: OVERHEAD_SCHEMA, language: 'mcp-javascript', measuredAt: new Date().toISOString(),
          source: { repository: 'redact-secret/redact-secret-benchmarks', commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '' },
          workloads: { file: 'benchmarks/mcp-qualification/consumer/workloads.mjs', digest: workloadDigest },
          environment: {
            os: `${os.platform()}-${os.release()}`, platform: measured.platform, arch: measured.arch, cpuModel: os.cpus()[0]?.model ?? null,
            logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), runtime: measured.runtime, packages: consumer.installed, transport, process: p + 1,
          },
          method: { ...measured.method, processes: 1 },
          results: measured.results, memory: measured.memory,
        });
        console.error(`mcp-qualification: overhead ${endpoint.line}@${Object.values(endpoint.packages)[0]} ${transport} process ${p + 1}/${overheadProcesses} done`);
      }
    }
    if (endpoint.line === 'v1' && endpoint.endpoint === 'highest') init = await initTimes(consumer, overheadNode);
  }
} finally {
  if (!keep) for (const consumer of consumers) rmSync(consumer.root, { recursive: true, force: true });
}

// Aggregate the per-call overhead rows over processes (median of per-process medians), per host x workload.
type Row = { host: string; profileId: string; scannerCallsPerEvent: number; scannedCodeUnitsPerEvent: number; modes: Record<string, { median: number; p95: number }>; derived: { traversal: number; coreScan: number; adapterOverhead: number } };
const aggregate = new Map<string, Row[]>();
for (const output of overheadOutputs) for (const row of output.results as Row[]) {
  const key = `${row.host}\0${row.profileId}`;
  aggregate.set(key, [...(aggregate.get(key) ?? []), row]);
}
const round = (v: number) => Math.round(v * 1000) / 1000;
const overheadSummary = [...aggregate.values()].map(rows => {
  const first = rows[0]!;
  const med = (pick: (r: Row) => number) => round(median(rows.map(pick)));
  const host = med(r => r.modes.host!.median);
  const core = med(r => r.modes['adapter-core']!.median);
  return {
    host: first.host, profileId: first.profileId, processes: rows.length,
    scannerCallsPerEvent: first.scannerCallsPerEvent, scannedCodeUnitsPerEvent: first.scannedCodeUnitsPerEvent,
    unprotectedMedian: host, protectedMedian: core, protectedP95: med(r => r.modes['adapter-core']!.p95),
    adapterOverhead: med(r => r.derived.adapterOverhead), traversal: med(r => r.derived.traversal), coreScan: med(r => r.derived.coreScan),
    relativeOverhead: host > 0 ? round((core - host) / host) : null,
    unit: 'microseconds-per-event',
  };
});

const complete = cells.length === ENDPOINTS.length * nodes.length * transports.length && cells.every(c => c.status === 'complete');
const totals = cells.reduce((acc, cell) => {
  if (cell.summary) {
    acc.leaks += cell.summary.leaks; acc.deviations += cell.summary.deviations;
    acc.knownFalseNegatives += cell.summary.knownFalseNegatives; acc.deliveredByPolicy += cell.summary.deliveredByPolicy; acc.caseRuns += cell.summary.cases;
  }
  if (cell.processOutput?.hostStdout || cell.processOutput?.hostStderr) acc.processOutputLeaks += 1;
  return acc;
}, { caseRuns: 0, leaks: 0, deviations: 0, knownFalseNegatives: 0, deliveredByPolicy: 0, processOutputLeaks: 0 });

const report = {
  schema: REPORT_SCHEMA,
  issue: 281,
  status: complete ? 'complete' : 'incomplete',
  quick,
  startedAt,
  finishedAt: new Date().toISOString(),
  benchmark: { repository: 'redact-secret/redact-secret-benchmarks', commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '' },
  contract: {
    reference: `https://github.com/redact-secret/redact-secret/blob/${coreSourceCommit}/docs/reference/mcp-boundary.md`,
    decision: `https://github.com/redact-secret/redact-secret/blob/${coreSourceCommit}/docs/decisions/2026-09-25-define-the-supported-mcp-redaction-boundary.md`,
  },
  artifacts: {
    core: {
      sourceCommit: coreSourceCommit,
      packages: [['core', corePackage], ['node', coreNodePackage], ['wasm', coreWasmPackage]].map(([role, file]) => ({
        role, file: path.basename(file!), sha256: sha256File(file!), ...packageSize(file!),
      })),
    },
    adapters: {
      repository: pin.repository, commit: pin.commit,
      pinSource: { file: path.basename(adapterPinPath), sha256: sha256File(adapterPinPath) },
      packages: pin.packages.map(p => ({ name: p.name, version: p.version, contentDigest: p.contentDigest, verified: true, tarballSha256: sha256File(adapterTarballs[p.name]!), ...packageSize(adapterTarballs[p.name]!) })),
    },
    compatibility: { file: path.basename(compatibilityPath), sha256: sha256File(compatibilityPath), runtimeRange: mcpEntry.runtime.range, endpoints: ENDPOINTS },
  },
  host: { os: `${os.platform()}-${os.release()}`, arch: os.arch(), cpuModel: os.cpus()[0]?.model ?? null, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), driverRuntime: `node-${process.versions.node}` },
  configuration: {
    limits: W.LIMITS, binaryContent: 'block (the default)', policy: 'the core default, except in the policy-* cases', placement: 'host (authoritative); server-wrapped cases also exercise the preventive server placement',
    corpus: { file: 'benchmarks/mcp-qualification/consumer/workloads.mjs', sha256: sha256File(path.join(consumerSource, 'workloads.mjs')), cases: W.ALL_CASE_IDS.length },
  },
  summary: { cells: cells.length, completeCells: cells.filter(c => c.status === 'complete').length, ...totals },
  matrix: cells,
  operational: {
    note: 'Measurements only. No MCP budget exists in benchmarks/regression-budgets.json yet, so no regression verdict is given; see docs/specs/mcp-qualification.md.',
    overhead: { runtime: overheadNode === process.execPath ? `node-${process.versions.node}` : execFileSync(overheadNode, ['--version'], { encoding: 'utf8' }).trim(), summary: overheadSummary, series: { schema: SERIES_SCHEMA, issue: 281, outputs: overheadOutputs } },
    initialization: init,
    packages: 'see artifacts: packedBytes, unpackedBytes and files per tarball, #141 definitions',
  },
  notMeasured: [
    'bundle contribution: adapter-mcp is a Node.js server-side package that loads the native core; no browser bundle applies',
    'a core that fails to initialize: requires breaking the installed core, which is adapter-internal lifecycle already qualified by redact-secret-adapters#13',
    'the Python mcp SDK, other language SDKs, HTTP+SSE, experimental.tasks: outside the supported range',
    'MCP messages other than tools/call: outside the contract',
  ],
};

const text = `${JSON.stringify(report, null, 2)}\n`;
assertNoPlaintext(text, secrets);
const { default: Ajv } = await import('ajv');
const validate = new Ajv({ strict: false, allErrors: true }).compile(JSON.parse(readFileSync(path.join(repoRoot, 'schemas/mcp-qualification-v1.json'), 'utf8')));
if (!validate(report)) throw new Error(`mcp-qualification: the report does not match schemas/mcp-qualification-v1.json: ${JSON.stringify(validate.errors?.slice(0, 5))}`);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, text);
if (overheadOut) writeFileSync(overheadOut, `${JSON.stringify(report.operational.overhead.series, null, 2)}\n`);
if (markdownOut) {
  const { renderMarkdown } = await import('./lib/mcp-qualification-report.ts');
  const markdown = renderMarkdown(report);
  assertNoPlaintext(markdown, secrets);
  writeFileSync(markdownOut, markdown);
}
console.error(`mcp-qualification: ${report.status}; ${totals.caseRuns} case runs over ${cells.length} cells; leaks ${totals.leaks}, deviations ${totals.deviations}, known false negatives ${totals.knownFalseNegatives}, process-output leaks ${totals.processOutputLeaks}`);
process.exit(complete && totals.leaks === 0 && totals.processOutputLeaks === 0 && totals.deviations === 0 ? 0 : 1);
