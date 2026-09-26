/**
 * The MCP host for the black-box qualification (#281). It runs inside a clean
 * consumer that installed the pinned tarballs, and uses only the public API
 * of `@redact-secret/adapter-mcp` and `@redact-secret/adapter-ai-context`.
 *
 *   node host.mjs containment <v1|v2> <stdio|http> <record-dir>
 *   node --expose-gc host.mjs overhead <v1|v2> <stdio|http> <record-dir> [--quick]
 *   node --expose-gc host.mjs resource-overhead <v1|v2> <stdio|http> <record-dir> [--quick]
 *   node host.mjs init <core|adapter>
 *
 * The host is the contract's authoritative placement: it receives a
 * `CallToolResult` from a real MCP client and, only through the boundary,
 * writes it to its log, its store, its audit trail and the model context.
 * For `resources/read` (#321) it does the same with a `ReadResourceResult`
 * through `sanitizeResourceRead` and `toReadResourceResponse`.
 * Each of those sinks is appended, per case, to <record-dir>, and the parent
 * process scans them for synthetic plaintext. `result.json` in the same
 * directory carries outcomes and counts only: nothing derived from a value.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const [mode, line, transportKind, recordDir, ...flags] = process.argv.slice(2);

if (mode === 'init') {
  // One measurement per process: import + initialize, with nothing warmed.
  const start = performance.now();
  if (line === 'core') {
    const core = await import('@redact-secret/core');
    await core.initialize();
  } else {
    const { LIMITS } = await import('./workloads.mjs');
    const { createMcpBoundary } = await import('@redact-secret/adapter-mcp');
    const mcp = await createMcpBoundary(LIMITS);
    const probe = await mcp.sanitizeToolResult({ content: [{ type: 'text', text: 'ready' }] });
    if (probe.outcome !== 'ok') throw new Error('init probe failed');
  }
  process.stdout.write(`${JSON.stringify({ milliseconds: performance.now() - start })}\n`);
  process.exit(0);
}

const W = await import('./workloads.mjs');
const adapterMcp = await import('@redact-secret/adapter-mcp');
const aiContext = await import('@redact-secret/adapter-ai-context');
const coreModule = await import('@redact-secret/core');
await coreModule.initialize();
const { createMcpBoundary, createMcpBoundaryWith, toCallToolResult, toReadResourceResponse } = adapterMcp;

const REQUEST_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

let current = 'setup';
// Every mode keeps the host's audit trail, as #281's overhead method does: the protected modes include its appends.
const sink = (name, value) => appendFileSync(join(recordDir, `${name}.jsonl`), `${JSON.stringify({ case: current, value })}\n`, { mode: 0o600 });
const hostLog = message => sink('host-log', message);
/** This case's audit records, kept in memory too, so the host can check their shape without reading a value. */
let caseAudit = { crossings: [], findings: [] };
const onAudit = record => { caseAudit.crossings.push(record); sink('audit', { kind: 'crossing', record }); };
const onFinding = (finding, context) => { caseAudit.findings.push({ finding, context }); sink('audit', { kind: 'finding', finding, context }); };

/** Everything a host does with a delivered result; the only door is `toCallToolResult`. */
function deliver(name, outcome) {
  hostLog(`tool ${name} outcome=${outcome.outcome}${outcome.reason ? ` reason=${outcome.reason}` : ''}${outcome.code ? ` code=${outcome.code}` : ''}`);
  const safe = toCallToolResult(outcome);
  if (safe === null) return null;
  hostLog(`tool ${name} result ${JSON.stringify(safe)}`);
  sink('store', { role: 'tool', name, content: safe });
  const text = (safe.content ?? []).map(block => (block?.type === 'text' ? block.text : JSON.stringify(block))).join('\n');
  sink('model-context', [{ role: 'user', content: 'run the tool' }, { role: 'tool', content: text, structured: safe.structuredContent ?? null }]);
  return safe;
}

function recordError(error) {
  const chain = [];
  for (let e = error, depth = 0; e !== undefined && e !== null && depth < 5; e = e.cause, depth += 1) {
    chain.push({ string: String(e), message: e?.message ?? null, stack: e?.stack ?? null, data: e?.data ?? null });
  }
  sink('error-text', chain);
}

function fixedKind(safe) {
  const text = safe?.content?.[0]?.text;
  if (safe?.isError === true && safe.content.length === 1 && text === W.FIXED.blocked) return 'blocked';
  if (safe?.isError === true && safe.content.length === 1 && text === W.FIXED.toolError) return 'toolError';
  return null;
}

function observed(outcome) {
  return { outcome: outcome.outcome, ...(outcome.reason ? { reason: outcome.reason } : {}), ...(outcome.code ? { code: outcome.code } : {}) };
}

// ---------------------------------------------------------------------------
// Real MCP clients and server processes
// ---------------------------------------------------------------------------

function installedVersion(name, entry) {
  let dir = dirname(require.resolve(entry));
  for (;;) {
    try {
      const manifest = require(join(dir, 'package.json'));
      if (manifest.name === name) return manifest.version;
    } catch { /* keep walking */ }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function clientModules() {
  if (line === 'v1') {
    const [{ Client }, { StdioClientTransport }, { StreamableHTTPClientTransport }] = await Promise.all([
      import('@modelcontextprotocol/sdk/client/index.js'),
      import('@modelcontextprotocol/sdk/client/stdio.js'),
      import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
    ]);
    return { Client, StdioClientTransport, StreamableHTTPClientTransport };
  }
  const [{ Client, StreamableHTTPClientTransport }, { StdioClientTransport }] = await Promise.all([
    import('@modelcontextprotocol/client'),
    import('@modelcontextprotocol/client/stdio'),
  ]);
  return { Client, StdioClientTransport, StreamableHTTPClientTransport };
}

const serverArgs = kind => [join(here, 'server.mjs'), line, transportKind, kind, recordDir, mode === 'overhead' || mode === 'resource-overhead' ? 'off' : 'on'];

async function startHttpServer(kind) {
  const child = spawn(process.execPath, serverArgs(kind), { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', data => appendFileSync(join(recordDir, 'server-stderr.txt'), data));
  const port = await new Promise((resolve, reject) => {
    let buffered = '';
    const timer = setTimeout(() => reject(new Error('server did not listen')), 15000);
    child.stdout.on('data', data => {
      buffered += data;
      const match = /LISTENING (\d+)/.exec(buffered);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.on('exit', () => reject(new Error('server exited before listening')));
  });
  return { url: new URL(`http://127.0.0.1:${port}/mcp`), child };
}

let negotiatedProtocol = null;

async function connect(kind = 'low-level', { responseCacheStore } = {}) {
  const { Client, StdioClientTransport, StreamableHTTPClientTransport } = await clientModules();
  const client = new Client({ name: 'redact-secret-benchmarks-host', version: '0.0.0' }, responseCacheStore ? { responseCacheStore } : undefined);
  let transport;
  let child = null;
  if (transportKind === 'stdio') {
    transport = new StdioClientTransport({ command: process.execPath, args: serverArgs(kind), stderr: 'pipe' });
  } else {
    const started = await startHttpServer(kind);
    child = started.child;
    transport = new StreamableHTTPClientTransport(started.url);
  }
  const setProtocolVersion = transport.setProtocolVersion?.bind(transport);
  transport.setProtocolVersion = version => { negotiatedProtocol = version; setProtocolVersion?.(version); };
  await client.connect(transport);
  transport.stderr?.on('data', data => appendFileSync(join(recordDir, 'server-stderr.txt'), data));
  negotiatedProtocol ??= client.getNegotiatedProtocolVersion?.() ?? null;
  return {
    callTool(params, signal) {
      const options = { signal, timeout: REQUEST_TIMEOUT_MS };
      return line === 'v1' ? client.callTool(params, undefined, options) : client.callTool(params, options);
    },
    /**
     * `client.readResource` of this line. The 2.x Client reads with
     * `cacheMode: "bypass"` unless a case asks otherwise, so every read
     * reaches the server and the boundary (#321).
     */
    readResource(uri, signal, { cacheMode = 'bypass' } = {}) {
      const options = { signal, timeout: REQUEST_TIMEOUT_MS };
      return line === 'v1' ? client.readResource({ uri }, options) : client.readResource({ uri }, { ...options, cacheMode });
    },
    async stats() {
      const result = await this.callTool({ name: 'stats' });
      return JSON.parse(result.content[0].text);
    },
    async close() {
      await client.close().catch(() => undefined);
      if (child !== null && child.exitCode === null) child.kill();
    },
  };
}

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

const hostBoundary = await createMcpBoundary({ ...W.LIMITS, onFinding, onAudit });
/** The same host, opted into `binaryContent: "pass"` (the resource blob case). */
const passBoundary = await createMcpBoundary({ ...W.LIMITS, binaryContent: 'pass', onFinding, onAudit });

function policyBoundary(kind) {
  if (kind === 'throwing-callbacks') {
    return createMcpBoundary({
      ...W.LIMITS,
      onFinding: () => { throw new Error('observer failed'); },
      onAudit: () => { throw new Error('audit sink failed'); },
    });
  }
  const evaluate = kind === 'throw' ? () => { throw new Error('policy failed'); } : () => kind;
  return createMcpBoundary({ ...W.LIMITS, policy: { evaluate }, onFinding, onAudit });
}

/** A core that finds nothing: the adapter's own traversal cost, over the public injection API. */
function identityCore() {
  return {
    scanAndRedact: input => ({ text: input, findings: [] }),
    createIncrementalSanitizer: () => {
      let state = 'accepting';
      return {
        get state() { return state; },
        append: chunk => ({ text: chunk, findings: [] }),
        finalize: () => { state = 'finalized'; return { text: '', findings: [] }; },
        abort: () => { state = 'aborted'; },
      };
    },
  };
}

/** The real core, counted: scanner calls and code units handed to it (deterministic). */
function countingCore(counter) {
  return {
    scanAndRedact: (input, options) => { counter.calls += 1; counter.codeUnits += input.length; return coreModule.scanAndRedact(input, options); },
    createIncrementalSanitizer: options => {
      const session = coreModule.createIncrementalSanitizer(options);
      return {
        get state() { return session.state; },
        append: chunk => { counter.calls += 1; counter.codeUnits += chunk.length; return session.append(chunk); },
        finalize: () => { counter.calls += 1; return session.finalize(); },
        abort: () => session.abort(),
      };
    },
  };
}

function injectedBoundary(core) {
  return createMcpBoundaryWith(aiContext.createAiContextBoundaryWith(core, W.LIMITS));
}

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

const results = [];

function push(row) {
  results.push(row);
}

async function hostCall(connection, name, { boundary = hostBoundary, signal, hostArguments, toolArguments } = {}) {
  const invoke = ({ signal: s, arguments: a }) => connection.callTool({ name, ...(a !== undefined ? { arguments: a } : toolArguments !== undefined ? { arguments: toolArguments } : {}) }, s);
  return boundary.sanitizeToolCall(invoke, { signal, ...(hostArguments !== undefined ? { arguments: hostArguments } : {}) });
}

async function runCase(testCase, body) {
  current = testCase.id;
  caseAudit = { crossings: [], findings: [] };
  try {
    const row = await body();
    push({ id: testCase.id, area: testCase.area, expect: testCase.expect, ...(testCase.exclusion ? { exclusion: testCase.exclusion } : {}), ...(testCase.policyDelivers ? { policyDelivers: true } : {}), ...row });
  } catch (error) {
    recordError(error);
    push({ id: testCase.id, area: testCase.area, expect: testCase.expect, ...(testCase.surface ? { surface: testCase.surface } : {}), observed: { outcome: 'threw' }, threw: true });
  }
}

function canonical(value) {
  return JSON.stringify(value);
}

async function containment() {
  const low = await connect('low-level');
  const high = await connect('mcp-server');

  for (const c of W.RESULT_CASES) {
    await runCase(c, async () => {
      const outcome = await hostCall(low, `result:${c.id}`);
      const safe = deliver(`result:${c.id}`, outcome);
      const row = { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
      if (c.benign && outcome.outcome === 'ok') row.benignUnchanged = canonical(outcome.value) === canonical(c.result());
      if (outcome.outcome === 'ok') row.findings = outcome.findings.length;
      return row;
    });
  }

  for (const c of W.TOOL_CASES.filter(t => !t.last)) {
    await runCase(c, async () => {
      const connection = c.server === 'mcp-server' ? high : low;
      if (c.calls) {
        let delivered = 0;
        const outcomes = [];
        for (const index of c.calls) {
          const outcome = await hostCall(connection, c.tool, { toolArguments: { index } });
          outcomes.push(outcome.outcome);
          if (deliver(c.tool, outcome) !== null) delivered += 1;
        }
        return { observed: { outcome: outcomes.every(o => o === 'ok') ? 'ok' : outcomes.join(',') }, delivered: delivered > 0, deliveredFixed: null };
      }
      const before = c.dispatch === false ? await low.stats() : null;
      const statsBefore = c.tool.startsWith('wrapped-stream') || c.tool === 'wrapped-slow-stream' ? await low.stats() : null;
      // The abort timer starts with the call, so settledAfterAbortMs excludes the stats round trip above.
      let signal;
      if (c.abortAfterMs !== undefined) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), c.abortAfterMs);
        signal = controller.signal;
      }
      const started = performance.now();
      const outcome = await hostCall(connection, c.tool, {
        signal,
        hostArguments: c.hostArguments?.(),
        toolArguments: c.arguments?.(),
      });
      const elapsedMs = performance.now() - started;
      const safe = deliver(c.tool, outcome);
      const row = { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
      if (c.abortAfterMs !== undefined) row.settledAfterAbortMs = Math.round(elapsedMs - c.abortAfterMs);
      if (before !== null) {
        const after = await low.stats();
        row.dispatched = after.echoCalls > before.echoCalls;
      }
      if (statsBefore !== null) {
        // Give a cancelled server a moment to close its producer.
        await new Promise(r => setTimeout(r, 150));
        const after = await low.stats();
        row.serverStream = { pulled: after.streamPulled - statsBefore.streamPulled, closed: after.streamClosed - statsBefore.streamClosed };
      }
      return row;
    });
  }

  await hostSideStreams();
  await policyCases(low);
  await resourceCases(low, high);

  // Control: an unprotected host writes the raw result to every sink. The leak
  // scan must flag all five, or its "no leak" elsewhere means nothing.
  const control = W.CONTROL_CASE;
  await runCase(control, async () => {
    const raw = await low.callTool({ name: 'result:text-provider-token' });
    sink('model-context', raw);
    hostLog(`raw ${JSON.stringify(raw)}`);
    sink('store', raw);
    sink('audit', raw);
    sink('error-text', [{ message: JSON.stringify(raw) }]);
    return { observed: { outcome: 'unprotected' }, control: true };
  });

  await low.close();
  await high.close();

  for (const c of W.TOOL_CASES.filter(t => t.last)) {
    const connection = await connect('low-level');
    await runCase(c, async () => {
      const outcome = await hostCall(connection, c.tool);
      const safe = deliver(c.tool, outcome);
      return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
    });
    await connection.close();
  }
  for (const c of W.RESOURCE_READ_CASES.filter(r => r.last)) {
    const connection = await connect('low-level');
    await runResourceCase(c, async () => {
      const outcome = await hostBoundary.sanitizeResourceRead(({ signal }) => connection.readResource(c.uri, signal));
      return resourceRow(outcome, deliverResource(c.id, outcome));
    });
    await connection.close();
  }
}

// ---------------------------------------------------------------------------
// resources/read containment (#321)
// ---------------------------------------------------------------------------

/** Everything a host does with a read; the only door is `toReadResourceResponse`. The host never logs its own URI. */
function deliverResource(label, outcome) {
  hostLog(`resource ${label} outcome=${outcome.outcome}${outcome.reason ? ` reason=${outcome.reason}` : ''}${outcome.code ? ` code=${outcome.code}` : ''}`);
  const response = toReadResourceResponse(outcome);
  if (response === null) return null;
  if ('error' in response) {
    hostLog(`resource ${label} error ${JSON.stringify(response.error)}`);
    sink('error-text', [{ string: String(response.error.message), message: response.error.message, code: response.error.code, data: response.error.data ?? null }]);
    return response;
  }
  hostLog(`resource ${label} result ${JSON.stringify(response.result)}`);
  sink('store', { role: 'resource', content: response.result });
  const text = (response.result.contents ?? []).map(e => (typeof e?.text === 'string' ? e.text : `[binary ${e?.mimeType ?? 'resource'}]`)).join('\n');
  sink('model-context', [{ role: 'user', content: 'read the resource' }, { role: 'resource', content: text, meta: response.result._meta ?? null }]);
  return response;
}

/** Deep equality that ignores object key order: the SDKs' result schemas re-emit keys in their own order. */
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  return value;
}
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function responseKind(response) {
  if (response === null) return null;
  if ('result' in response) return 'result';
  if (same(response.error, W.FIXED_RESOURCE.blocked)) return 'resourceBlocked';
  if (same(response.error, W.FIXED_RESOURCE.readError)) return 'resourceReadError';
  return 'otherError';
}

const EXPECTED_KIND = { ok: 'result', blocked: 'resourceBlocked', read_error: 'resourceReadError', aborted: null };

function resourceRow(outcome, response) {
  const kind = responseKind(response);
  return {
    observed: observed(outcome), delivered: response !== null, deliveredFixed: kind,
    responseMatchesOutcome: kind === EXPECTED_KIND[outcome.outcome] && (response === null || !('error' in response) || !('data' in response.error)),
    ...(outcome.outcome === 'ok' ? { findings: outcome.findings.length } : {}),
  };
}

/** The contract's audit shape (mcp-resources-read.md#audit-metadata), checked on this case's records. */
function auditShape() {
  const fields = new Set(W.RESOURCE_AUDIT_FIELDS);
  const safe = new Set(W.SAFE_FINDING_FIELDS);
  const crossingsOk = caseAudit.crossings.every(r => r.stage === 'resource'
    && Object.keys(r).every(k => fields.has(k))
    && (r.reason !== undefined) === (r.outcome === 'blocked'));
  const findingsOk = caseAudit.findings.every(({ finding, context }) => context?.boundary === W.RESOURCE_LABEL && Object.keys(finding).every(k => safe.has(k)));
  return { crossings: caseAudit.crossings.length, findings: caseAudit.findings.length, auditConforms: crossingsOk, labelConforms: findingsOk };
}

async function runResourceCase(testCase, body, { audit = true } = {}) {
  await runCase({ ...testCase, surface: 'resources/read' }, async () => {
    const row = await body();
    return { surface: 'resources/read', ...row, ...(audit ? { audit: auditShape() } : {}) };
  });
}

/** The value at `path` in a delivered result; a `text` segment followed by more segments parses that text as JSON. */
function at(value, path) {
  let node = value;
  for (let i = 0; i < path.length; i += 1) {
    if (node === null || node === undefined) return undefined;
    node = node[path[i]];
    if (path[i] === 'text' && i < path.length - 1 && typeof node === 'string') {
      try { node = JSON.parse(node); } catch { return undefined; }
    }
  }
  return node;
}

function put(value, path, replacement) {
  if (path.length === 1) { value[path[0]] = replacement; return value; }
  const [head, ...rest] = path;
  if (head === 'text' && typeof value[head] === 'string') {
    value[head] = JSON.stringify(put(JSON.parse(value[head]), rest, replacement));
    return value;
  }
  put(value[head], rest, replacement);
  return value;
}

const PLACEHOLDER = /^<[A-Z][A-Z0-9_]*>$/;

/** Key-identified leaves became placeholders at their own position, and nothing else changed. */
function inPlace(sent, delivered, paths) {
  const placeholders = paths.every(p => typeof at(delivered, p) === 'string' && PLACEHOLDER.test(at(delivered, p)));
  let expected = structuredClone(sent);
  for (const p of paths) expected = put(expected, p, at(delivered, p));
  return placeholders && same(expected, delivered);
}

function wireRecords(tool) {
  let text = '';
  try { text = readFileSync(join(recordDir, 'wire.jsonl'), 'utf8'); } catch { return []; }
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.tool === tool && r.message?.id !== undefined && (r.message.result !== undefined || r.message.error !== undefined));
}

async function resourceCases(low, high) {
  const readVia = (connection, uri, boundary = hostBoundary, options = {}) => boundary.sanitizeResourceRead(({ signal }) => connection.readResource(uri, signal), options);

  for (const c of W.RESOURCE_CASES) {
    await runResourceCase(c, async () => {
      const boundary = c.policy ? await policyBoundary(c.policy) : c.binaryContent === 'pass' ? passBoundary : hostBoundary;
      const outcome = await readVia(low, `test://resource/${c.id}`, boundary);
      const row = resourceRow(outcome, deliverResource(c.id, outcome));
      if (outcome.outcome === 'ok') {
        const sent = c.result();
        const value = outcome.value;
        if (c.benign) row.benignUnchanged = same(value, sent);
        if (c.inPlace) row.keyRedactedInPlace = inPlace(sent, value, c.inPlace);
        if (c.textStaysText) row.textStaysText = typeof value.contents?.[0]?.text === 'string';
        if (c.benignEntries) row.benignUnchanged = c.benignEntries.every(i => same(value.contents[i], sent.contents[i]));
        if (c.blobUnchanged) row.blobUnchanged = c.blobUnchanged.every(i => value.contents[i]?.blob === sent.contents[i].blob);
      }
      return row;
    }, { audit: c.policy !== 'throwing-callbacks' });
  }

  for (const c of W.RESOURCE_READ_CASES.filter(r => !r.last && (r.lines === undefined || r.lines.includes(line)))) {
    const connection = c.server === 'mcp-server' ? high : low;
    const uri = typeof c.uri === 'function' ? c.uri() : c.uri;
    await runResourceCase(c, async () => {
      if (c.cache) return cacheCase(c, uri);
      if (c.race) return raceSweep(connection, uri);
      if (c.local === 'abort-then-reject') {
        const controller = new AbortController();
        const outcome = await hostBoundary.sanitizeResourceRead(async () => { controller.abort(); throw new Error(W.throwMessage()); }, { signal: controller.signal });
        return resourceRow(outcome, deliverResource(c.id, outcome));
      }
      const controller = new AbortController();
      if (c.preAborted) controller.abort();
      let invoked = 0;
      const tool = `resource:${uri}`;
      const responsesBefore = wireRecords(tool).length;
      if (c.abortAfterMs !== undefined) setTimeout(() => controller.abort(), c.abortAfterMs);
      const started = performance.now();
      const outcome = await hostBoundary.sanitizeResourceRead(({ signal }) => { invoked += 1; return connection.readResource(uri, signal); }, { signal: controller.signal });
      const elapsedMs = performance.now() - started;
      const row = resourceRow(outcome, deliverResource(c.id, outcome));
      if (c.preAborted) row.invoked = invoked > 0;
      if (c.abortAfterMs !== undefined) {
        row.settledAfterAbortMs = Math.round(elapsedMs - c.abortAfterMs);
        // Give the server time to answer, if it (wrongly) would.
        await new Promise(r => setTimeout(r, 400));
        row.serverResponded = wireRecords(tool).length > responsesBefore;
      }
      if (c.wireError) {
        const errors = wireRecords(tool).slice(responsesBefore).map(r => r.message.error).filter(Boolean);
        const last = errors.at(-1);
        row.wireError = last === undefined ? null : same(last, W.FIXED_RESOURCE[c.wireError]) ? c.wireError : 'other';
      }
      if (c.auditExact) {
        row.auditExact = caseAudit.crossings.length === 1 && same(caseAudit.crossings[0], { stage: 'resource', outcome: 'ok' })
          && caseAudit.findings.length >= 1;
      }
      if (outcome.outcome === 'ok' && c.inPlace) {
        row.keyRedactedInPlace = inPlace(W.rawResource('config', uri), outcome.value, c.inPlace);
      }
      if (outcome.outcome === 'ok' && c.textStaysText) row.textStaysText = typeof outcome.value.contents?.[0]?.text === 'string';
      return row;
    });
  }

  // Control: an unprotected host writes the raw read to every sink; the scan must flag all five.
  await runCase(W.RESOURCE_CONTROL_CASE, async () => {
    const raw = await low.readResource('test://resource/resource-text-provider-tokens');
    sink('model-context', raw);
    hostLog(`raw ${JSON.stringify(raw)}`);
    sink('store', raw);
    sink('audit', raw);
    sink('error-text', [{ message: JSON.stringify(raw) }]);
    return { surface: 'resources/read', observed: { outcome: 'unprotected' }, control: true };
  });
}

async function raceSweep(connection, uri) {
  const timings = ['pre-aborted', 'microtask', 'immediate', 'timeout-0', 'timeout-1', 'timeout-2', 'timeout-4', 'timeout-8'];
  const outcomes = {};
  let unexpected = 0;
  let deliveredOnAbort = 0;
  let delivered = 0;
  for (let round = 0; round < 5; round += 1) {
    for (const timing of timings) {
      const controller = new AbortController();
      if (timing === 'pre-aborted') controller.abort();
      else if (timing === 'microtask') queueMicrotask(() => controller.abort());
      else if (timing === 'immediate') setImmediate(() => controller.abort());
      else setTimeout(() => controller.abort(), Number(timing.split('-')[1]));
      const outcome = await hostBoundary.sanitizeResourceRead(({ signal }) => connection.readResource(uri, signal), { signal: controller.signal });
      outcomes[outcome.outcome] = (outcomes[outcome.outcome] ?? 0) + 1;
      if (outcome.outcome !== 'ok' && outcome.outcome !== 'aborted') unexpected += 1;
      const response = deliverResource('race', outcome);
      if (response !== null) delivered += 1;
      if (outcome.outcome === 'aborted' && response !== null) deliveredOnAbort += 1;
    }
  }
  return {
    observed: { outcome: unexpected === 0 && deliveredOnAbort === 0 ? 'ok-or-aborted' : 'unexpected' },
    runs: 5 * timings.length, outcomes, delivered: delivered > 0, deliveredFixed: null, deliveredOnAbort,
  };
}

/**
 * The 2.x Client's responseCacheStore sits before the boundary: a
 * recording store stands in for a host's persistent one. Under
 * `cacheMode: "use"` a result the server marks cacheable (`ttlMs`) is
 * stored raw and a second read is served from the store; both reads still
 * pass through the boundary. Under `"bypass"` nothing is stored.
 */
async function cacheCase(c, uri) {
  let storeWrites = 0;
  let stamp = 0;
  const entries = new Map();
  const keyOf = key => JSON.stringify([key.method, key.params ?? '', key.partition ?? '']);
  const responseCacheStore = {
    get: key => entries.get(keyOf(key)),
    set: (key, entry) => {
      stamp += 1;
      // The Client also caches tools/list for its own use; only resources/read writes are counted.
      if (key.method === 'resources/read') storeWrites += 1;
      sink('response-cache', { method: key.method, value: entry.value });
      entries.set(keyOf(key), { ...entry, stamp });
      return stamp;
    },
    delete: key => { entries.delete(keyOf(key)); },
    evict: method => { for (const k of [...entries.keys()]) if (JSON.parse(k)[0] === method) entries.delete(k); },
    clear: () => entries.clear(),
  };
  const connection = await connect('low-level', { responseCacheStore });
  try {
    const before = await connection.stats();
    const writesBefore = storeWrites;
    const outcomes = [];
    let delivered = 0;
    for (let i = 0; i < 2; i += 1) {
      const outcome = await hostBoundary.sanitizeResourceRead(({ signal }) => connection.readResource(uri, signal, { cacheMode: c.cache }));
      outcomes.push(outcome.outcome);
      if (deliverResource(c.id, outcome) !== null) delivered += 1;
    }
    const after = await connection.stats();
    return {
      observed: { outcome: outcomes.every(o => o === 'ok') ? 'ok' : outcomes.join(',') }, delivered: delivered > 0, deliveredFixed: null,
      cache: { mode: c.cache, storeWrites: storeWrites - writesBefore, serverReads: after.cacheableReads - before.cacheableReads },
      ...(c.hostResponsibility ? { hostResponsibility: true } : {}),
    };
  } finally {
    await connection.close();
  }
}

function countedAsync(chunks, { pendingAfter = Infinity, throwAt = -1, asyncThrow = false } = {}) {
  const counter = { pulled: 0, closed: 0 };
  const iterable = {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          counter.pulled += 1;
          if (i >= pendingAfter) return new Promise(() => {});
          if (i === throwAt) {
            if (asyncThrow) await new Promise(r => setTimeout(r, 2));
            throw new Error(W.throwMessage());
          }
          return i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined };
        },
        async return() { counter.closed += 1; return { done: true, value: undefined }; },
      };
    },
  };
  return { iterable, counter };
}

async function hostSideStreams() {
  const text = W.STREAM_TEXT();
  const reference = await hostBoundary.sanitizeToolResult({ content: [{ type: 'text', text }] });
  const byId = Object.fromEntries(W.STREAM_CASES.map(c => [c.id, c]));

  await runCase(byId['stream-partition-sweep'], async () => {
    const parts = W.partitions(text);
    const outcomes = {};
    let differs = 0;
    let delivered = 0;
    for (const [n, chunks] of parts.entries()) {
      const source = n % 2 === 0 ? countedAsync(chunks).iterable : chunks;
      const outcome = await hostBoundary.sanitizeStreamedToolResult(source);
      outcomes[outcome.outcome] = (outcomes[outcome.outcome] ?? 0) + 1;
      if (outcome.outcome !== 'ok' || canonical(outcome.value) !== canonical(reference.value)) differs += 1;
      if (deliver('stream', outcome) !== null) delivered += 1;
    }
    return {
      observed: { outcome: Object.keys(outcomes).length === 1 ? Object.keys(outcomes)[0] : 'mixed' },
      runs: parts.length, outcomes, differsFromWholeResult: differs, delivered: delivered > 0, deliveredFixed: null,
    };
  });

  await runCase(byId['stream-multibyte-partition-sweep'], async () => {
    const mb = W.MULTIBYTE_TEXT();
    const whole = await hostBoundary.sanitizeToolResult({ content: [{ type: 'text', text: mb }] });
    const isHigh = c => c >= 0xd800 && c <= 0xdbff;
    const isLow = c => c >= 0xdc00 && c <= 0xdfff;
    const outcomes = {};
    let boundaryCutsNotEqual = 0;
    let surrogateCutsDelivered = 0;
    let surrogateCuts = 0;
    for (let i = 1; i < mb.length; i += 1) {
      const splitsPair = isHigh(mb.charCodeAt(i - 1)) && isLow(mb.charCodeAt(i));
      const outcome = await hostBoundary.sanitizeStreamedToolResult([mb.slice(0, i), mb.slice(i)]);
      const key = `${outcome.outcome}${outcome.code ? `/${outcome.code}` : ''}`;
      outcomes[key] = (outcomes[key] ?? 0) + 1;
      if (splitsPair) {
        surrogateCuts += 1;
        if (outcome.outcome === 'ok') surrogateCutsDelivered += 1;
      } else if (outcome.outcome !== 'ok' || canonical(outcome.value) !== canonical(whole.value)) boundaryCutsNotEqual += 1;
      deliver('stream', outcome);
    }
    const passes = whole.outcome === 'ok' && boundaryCutsNotEqual === 0 && surrogateCutsDelivered === 0;
    return {
      observed: { outcome: passes ? 'ok-or-blocked-at-surrogate-splits' : 'unexpected' },
      runs: mb.length - 1, surrogateCuts, outcomes, boundaryCutsNotEqual, surrogateCutsDelivered, delivered: true, deliveredFixed: null,
    };
  });

  await runCase(byId['stream-block-finding-stops-pulling'], async () => {
    const chunks = W.wrappedStreamChunks('block');
    const { iterable, counter } = countedAsync(chunks);
    const outcome = await hostBoundary.sanitizeStreamedToolResult(iterable);
    const safe = deliver('stream', outcome);
    return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe), producer: { chunks: chunks.length, ...counter } };
  });

  await runCase(byId['stream-input-limit-stops-pulling'], async () => {
    const block = W.benignLogText(65536, 11);
    const chunks = [...Array.from({ length: 20 }, () => block), `AWS_ACCESS_KEY_ID=${W.SECRETS.aws}\n`];
    const { iterable, counter } = countedAsync(chunks);
    const outcome = await hostBoundary.sanitizeStreamedToolResult(iterable);
    const safe = deliver('stream', outcome);
    return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe), producer: { chunks: chunks.length, ...counter } };
  });

  await runCase(byId['stream-token-limit'], async () => {
    const chunks = ['prefix ', 'x'.repeat(W.LIMITS.incrementalLimits.maxTokenCodeUnits + 64), W.SECRETS.aws, ' tail\n'];
    const outcome = await hostBoundary.sanitizeStreamedToolResult(chunks);
    const safe = deliver('stream', outcome);
    return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
  });

  await runCase(byId['stream-abort-sweep'], async () => {
    const chunks = W.partitions(text, { random: 0 }).at(-2); // one code unit per chunk
    const points = [0, 1, 2, 5, 17, 29, 30, 31, 50, chunks.length - 1, chunks.length];
    const outcomes = {};
    let delivered = 0;
    let unclosed = 0;
    for (const at of points) {
      const controller = new AbortController();
      const counter = { pulled: 0, closed: 0 };
      const iterable = {
        [Symbol.asyncIterator]() {
          let i = 0;
          return {
            async next() {
              counter.pulled += 1;
              if (i === at) controller.abort();
              return i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined };
            },
            async return() { counter.closed += 1; return { done: true, value: undefined }; },
          };
        },
      };
      const outcome = await hostBoundary.sanitizeStreamedToolResult(iterable, { signal: controller.signal });
      outcomes[outcome.outcome] = (outcomes[outcome.outcome] ?? 0) + 1;
      if (deliver('stream', outcome) !== null) delivered += 1;
      if (outcome.outcome === 'aborted' && at < chunks.length && counter.closed === 0) unclosed += 1;
    }
    return {
      observed: { outcome: Object.keys(outcomes).length === 1 ? Object.keys(outcomes)[0] : 'mixed' },
      runs: points.length, outcomes, delivered: delivered > 0, deliveredFixed: null, producersNotClosed: unclosed,
    };
  });

  await runCase(byId['stream-abort-while-producer-pending'], async () => {
    const controller = new AbortController();
    const { iterable, counter } = countedAsync(W.wrappedStreamChunks('split'), { pendingAfter: 1 });
    setTimeout(() => controller.abort(), 30);
    const outcome = await Promise.race([
      hostBoundary.sanitizeStreamedToolResult(iterable, { signal: controller.signal }),
      new Promise(r => setTimeout(() => r({ outcome: 'hung' }), 3000)),
    ]);
    const safe = outcome.outcome === 'hung' ? null : deliver('stream', outcome);
    return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe), producer: counter };
  });

  for (const [id, asyncThrow] of [['stream-producer-throws', false], ['stream-producer-rejects-async', true]]) {
    await runCase(byId[id], async () => {
      const { iterable } = countedAsync(W.wrappedStreamChunks('split'), { throwAt: 1, asyncThrow });
      const outcome = await hostBoundary.sanitizeStreamedToolResult(iterable);
      const safe = deliver('stream', outcome);
      return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
    });
  }

  await runCase(byId['stream-non-string-chunk'], async () => {
    const outcome = await hostBoundary.sanitizeStreamedToolResult(['ok ', Buffer.from(`AWS_ACCESS_KEY_ID=${W.SECRETS.aws}`), ' tail']);
    const safe = deliver('stream', outcome);
    return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
  });

  await runCase(byId['stream-node-readable-destroyed-on-failure'], async () => {
    const chunks = W.wrappedStreamChunks('block');
    let read = 0;
    const readable = new Readable({
      objectMode: true,
      read() {
        if (read < chunks.length) { this.push(chunks[read]); read += 1; } else this.push(null);
      },
    });
    const outcome = await hostBoundary.sanitizeStreamedToolResult(readable);
    const safe = deliver('stream', outcome);
    await new Promise(r => setImmediate(r));
    return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe), producer: { chunks: chunks.length, read, destroyed: readable.destroyed } };
  });
}

async function policyCases(low) {
  for (const c of W.POLICY_CASES) {
    if (c.policy) {
      await runCase(c, async () => {
        const boundary = await policyBoundary(c.policy);
        const outcome = await hostCall(low, 'result:text-provider-token', { boundary });
        const safe = deliver('result:text-provider-token', outcome);
        const row = { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
        if (outcome.outcome === 'ok') row.findingActions = [...new Set(outcome.findings.map(f => f.action))];
        return row;
      });
    } else if (c.race) {
      await runCase(c, async () => {
        const timings = ['pre-aborted', 'microtask', 'immediate', 'timeout-0', 'timeout-1', 'timeout-2', 'timeout-4', 'timeout-8'];
        const outcomes = {};
        let unexpected = 0;
        let delivered = 0;
        for (let round = 0; round < 5; round += 1) {
          for (const timing of timings) {
            const controller = new AbortController();
            if (timing === 'pre-aborted') controller.abort();
            else if (timing === 'microtask') queueMicrotask(() => controller.abort());
            else if (timing === 'immediate') setImmediate(() => controller.abort());
            else setTimeout(() => controller.abort(), Number(timing.split('-')[1]));
            const outcome = await hostCall(low, 'result:text-provider-token', { signal: controller.signal });
            outcomes[outcome.outcome] = (outcomes[outcome.outcome] ?? 0) + 1;
            if (outcome.outcome !== 'ok' && outcome.outcome !== 'aborted') unexpected += 1;
            if (deliver('result:text-provider-token', outcome) !== null) delivered += 1;
          }
        }
        return {
          observed: { outcome: unexpected === 0 ? 'ok-or-aborted' : 'unexpected' },
          runs: 5 * timings.length, outcomes, delivered: delivered > 0, deliveredFixed: null,
        };
      });
    } else if (c.downstream) {
      await runCase(c, async () => {
        const outcome = await hostCall(low, 'result:structured-nested-with-text-copy');
        const safe = deliver('result:structured-nested-with-text-copy', outcome);
        try {
          // The model provider rejects the request and echoes it back in its error.
          throw new Error(`model call failed for request ${JSON.stringify(safe)}`);
        } catch (error) {
          recordError(error);
          hostLog(`model call failed: ${error.message}`);
        }
        return { observed: observed(outcome), delivered: safe !== null, deliveredFixed: fixedKind(safe) };
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Overhead (#141/#143 conventions: interleaved modes, repetitions, nearest-rank)
// ---------------------------------------------------------------------------

function nearestRank(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
  const round = v => Math.round(v * 1000) / 1000;
  return {
    unit: 'microseconds-per-event', samples: samples.map(round), median: round(nearestRank(sorted, 0.5)), p95: round(nearestRank(sorted, 0.95)),
    minimum: round(sorted[0]), maximum: round(sorted.at(-1)), standardDeviation: round(sd),
  };
}

/** Serialization a host does with every delivered result, identical in every mode. */
function deliverInMemory(safe) {
  if (safe === null) return 0;
  const log = JSON.stringify(safe);
  const text = (safe.content ?? []).map(block => (block?.type === 'text' ? block.text : JSON.stringify(block))).join('\n');
  return log.length + text.length;
}

async function measureModes(modes, { repetitions, events, warmup }) {
  const samples = Object.fromEntries(Object.keys(modes).map(m => [m, []]));
  const names = Object.keys(modes);
  for (const name of names) for (let i = 0; i < warmup; i += 1) await modes[name]();
  for (let r = 0; r < repetitions; r += 1) {
    const order = names.map((_, i) => names[(i + r) % names.length]);
    for (const name of order) {
      const start = process.hrtime.bigint();
      for (let i = 0; i < events; i += 1) await modes[name]();
      samples[name].push(Number(process.hrtime.bigint() - start) / 1000 / events);
    }
  }
  return Object.fromEntries(Object.entries(samples).map(([m, s]) => [m, summarize(s)]));
}

function derived(modes) {
  const round = v => Math.round(v * 1000) / 1000;
  return {
    unit: 'microseconds-per-event', basis: 'difference of per-mode medians',
    traversal: round(modes['adapter-identity'].median - modes.host.median),
    coreScan: round(modes['adapter-core'].median - modes['adapter-identity'].median),
    adapterOverhead: round(modes['adapter-core'].median - modes.host.median),
  };
}

async function overhead() {
  const quick = flags.includes('--quick');
  const repetitions = quick ? 3 : 15;
  const sized = events => {
    const n = quick ? Math.max(2, Math.ceil(events / 10)) : events;
    return { repetitions, events: n, warmup: Math.ceil(n / 2) };
  };
  // In-process rows do not depend on the SDK or the transport: measure them once per process pair.
  const inProcess = transportKind === 'stdio';
  const identity = injectedBoundary(identityCore());
  const connection = await connect('low-level');
  const rows = [];
  const hostName = `mcp-sdk-${Object.values(identityOut.sdk)[0]}-${transportKind}`;
  for (const profile of W.OVERHEAD_PROFILES) {
    const counter = { calls: 0, codeUnits: 0 };
    const counting = injectedBoundary(countingCore(counter));
    const counted = await counting.sanitizeToolResult(profile.result());
    if (counted.outcome !== 'ok') throw new Error(`overhead profile ${profile.id} is not ok: ${counted.outcome}`);
    const call = () => connection.callTool({ name: `overhead:${profile.id}` });
    const transportModes = await measureModes({
      host: async () => deliverInMemory(await call()),
      'adapter-identity': async () => deliverInMemory(toCallToolResult(await identity.sanitizeToolCall(call))),
      'adapter-core': async () => deliverInMemory(toCallToolResult(await hostBoundary.sanitizeToolCall(call))),
    }, sized(profile.events));
    rows.push({ host: hostName, profileId: profile.id, scannerCallsPerEvent: counter.calls, scannedCodeUnitsPerEvent: counter.codeUnits, modes: transportModes, derived: derived(transportModes) });

    if (!inProcess) continue;
    const parsed = await call();
    const inProcessModes = await measureModes({
      host: async () => deliverInMemory(parsed),
      'adapter-identity': async () => deliverInMemory(toCallToolResult(await identity.sanitizeToolResult(parsed))),
      'adapter-core': async () => deliverInMemory(toCallToolResult(await hostBoundary.sanitizeToolResult(parsed))),
    }, sized(profile.inProcessEvents));
    rows.push({ host: 'mcp-in-process', profileId: profile.id, scannerCallsPerEvent: counter.calls, scannedCodeUnitsPerEvent: counter.codeUnits, modes: inProcessModes, derived: derived(inProcessModes) });
  }

  // Incremental / streamed output, in process.
  if (inProcess) {
  const chunks = W.OVERHEAD_STREAM_PROFILE.chunks();
  const streamCounter = { calls: 0, codeUnits: 0 };
  const countedStream = await injectedBoundary(countingCore(streamCounter)).sanitizeStreamedToolResult(chunks);
  if (countedStream.outcome !== 'ok') throw new Error('stream overhead profile is not ok');
  const streamModes = await measureModes({
    host: async () => deliverInMemory({ content: [{ type: 'text', text: chunks.join('') }] }),
    'adapter-identity': async () => deliverInMemory(toCallToolResult(await identity.sanitizeStreamedToolResult(chunks))),
    'adapter-core': async () => deliverInMemory(toCallToolResult(await hostBoundary.sanitizeStreamedToolResult(chunks))),
  }, sized(W.OVERHEAD_STREAM_PROFILE.inProcessEvents));
  rows.push({ host: 'mcp-in-process', profileId: W.OVERHEAD_STREAM_PROFILE.id, scannerCallsPerEvent: streamCounter.calls, scannedCodeUnitsPerEvent: streamCounter.codeUnits, modes: streamModes, derived: derived(streamModes) });
  }

  // Retained heap after many protected calls on the largest profile, after a full GC.
  let memory = null;
  if (typeof globalThis.gc === 'function' && inProcess) {
    const large = await connection.callTool({ name: 'overhead:mcp-large-benign' });
    const retained = async (fn, n) => {
      globalThis.gc(); globalThis.gc();
      const before = process.memoryUsage().heapUsed;
      for (let i = 0; i < n; i += 1) await fn();
      globalThis.gc(); globalThis.gc();
      return process.memoryUsage().heapUsed - before;
    };
    const n = quick ? 50 : 500;
    memory = {
      profileId: 'mcp-large-benign', calls: n, unit: 'bytes',
      retainedHeapHost: await retained(async () => deliverInMemory(large), n),
      retainedHeapAdapterCore: await retained(async () => deliverInMemory(toCallToolResult(await hostBoundary.sanitizeToolResult(large))), n),
      maxRssBytes: process.resourceUsage().maxRSS * 1024,
    };
  }
  await connection.close();
  const perProfile = Object.fromEntries(W.OVERHEAD_PROFILES.map(p => [p.id, { transport: sized(p.events), inProcess: sized(p.inProcessEvents) }]));
  perProfile[W.OVERHEAD_STREAM_PROFILE.id] = { inProcess: sized(W.OVERHEAD_STREAM_PROFILE.inProcessEvents) };
  return { method: { repetitions, perProfile, quick, order: 'modes interleaved within each repetition, rotated by one position per repetition', clock: 'process.hrtime.bigint', percentile: 'nearest-rank' }, results: rows, memory };
}

// ---------------------------------------------------------------------------
// resources/read operational profile (#321), apart from tools/call
// ---------------------------------------------------------------------------

function deliverResourceInMemory(response) {
  if (response === null) return 0;
  const log = JSON.stringify(response);
  const text = ('result' in response ? response.result.contents ?? [] : []).map(e => (typeof e?.text === 'string' ? e.text : '')).join('\n');
  return log.length + text.length;
}

async function resourceOverhead() {
  const quick = flags.includes('--quick');
  const repetitions = quick ? 3 : 15;
  const sized = events => {
    const n = quick ? Math.max(2, Math.ceil(events / 10)) : events;
    return { repetitions, events: n, warmup: Math.ceil(n / 2) };
  };
  const inProcess = transportKind === 'stdio';
  const identity = injectedBoundary(identityCore());
  // The AI-context leaf pass alone, on the real core: what the key-context backstop adds is the rest.
  const leafPass = await aiContext.createAiContextBoundary(W.LIMITS);
  const connection = await connect('low-level');
  const rows = [];
  const hostName = `mcp-sdk-${Object.values(identityOut.sdk)[0]}-${transportKind}`;
  for (const profile of W.RESOURCE_OVERHEAD_PROFILES) {
    const whole = { calls: 0, codeUnits: 0 };
    const counted = injectedBoundary(countingCore(whole)).sanitizeResourceResult(profile.result());
    if (counted.outcome !== 'ok') throw new Error(`resource overhead profile ${profile.id} is not ok: ${counted.outcome}`);
    const leaf = { calls: 0, codeUnits: 0 };
    const leafOnly = aiContext.createAiContextBoundaryWith(countingCore(leaf), W.LIMITS).sanitizeValue(profile.result(), { boundary: 'resource' });
    if (leafOnly.outcome !== 'ok') throw new Error(`resource overhead profile ${profile.id} leaf pass is not ok: ${leafOnly.outcome}`);
    const scans = {
      scannerCallsPerEvent: whole.calls, scannedCodeUnitsPerEvent: whole.codeUnits,
      backstopScannerCallsPerEvent: whole.calls - leaf.calls, backstopScannedCodeUnitsPerEvent: whole.codeUnits - leaf.codeUnits,
    };
    const uri = `test://overhead/${profile.id}`;
    const read = () => connection.readResource(uri);
    const bytes = JSON.stringify(await read()).length;
    const transportModes = await measureModes({
      host: async () => deliverResourceInMemory({ result: await read() }),
      'adapter-identity': async () => deliverResourceInMemory(toReadResourceResponse(await identity.sanitizeResourceRead(read))),
      'adapter-core': async () => deliverResourceInMemory(toReadResourceResponse(await hostBoundary.sanitizeResourceRead(read))),
    }, sized(profile.events));
    rows.push({ host: hostName, profileId: profile.id, resultBytes: bytes, ...scans, modes: transportModes, derived: derived(transportModes) });

    if (!inProcess) continue;
    const parsed = await read();
    const inProcessModes = await measureModes({
      host: async () => deliverResourceInMemory({ result: parsed }),
      'adapter-identity': async () => deliverResourceInMemory(toReadResourceResponse(identity.sanitizeResourceResult(parsed))),
      'leaf-pass': async () => { const o = leafPass.sanitizeValue(parsed, { boundary: 'resource' }); return deliverResourceInMemory(o.outcome === 'ok' ? { result: o.value } : null); },
      'adapter-core': async () => deliverResourceInMemory(toReadResourceResponse(hostBoundary.sanitizeResourceResult(parsed))),
    }, sized(profile.inProcessEvents));
    const d = derived(inProcessModes);
    const round = v => Math.round(v * 1000) / 1000;
    rows.push({
      host: 'mcp-in-process', profileId: profile.id, resultBytes: bytes, ...scans, modes: inProcessModes,
      derived: {
        ...d,
        backstop: round(inProcessModes['adapter-core'].median - inProcessModes['leaf-pass'].median),
        throughputMiBPerSecond: inProcessModes['adapter-core'].median > 0 ? round(bytes / 1048576 / (inProcessModes['adapter-core'].median / 1e6)) : null,
      },
    });
  }

  let memory = null;
  if (typeof globalThis.gc === 'function' && inProcess) {
    const large = await connection.readResource('test://overhead/resource-text-60k');
    const retained = async (fn, n) => {
      globalThis.gc(); globalThis.gc();
      const before = process.memoryUsage().heapUsed;
      for (let i = 0; i < n; i += 1) await fn();
      globalThis.gc(); globalThis.gc();
      return process.memoryUsage().heapUsed - before;
    };
    const n = quick ? 50 : 500;
    memory = {
      profileId: 'resource-text-60k', reads: n, unit: 'bytes',
      retainedHeapHost: await retained(async () => deliverResourceInMemory({ result: large }), n),
      retainedHeapAdapterCore: await retained(async () => deliverResourceInMemory(toReadResourceResponse(hostBoundary.sanitizeResourceResult(large))), n),
      maxRssBytes: process.resourceUsage().maxRSS * 1024,
    };
  }
  await connection.close();
  const perProfile = Object.fromEntries(W.RESOURCE_OVERHEAD_PROFILES.map(p => [p.id, { transport: sized(p.events), inProcess: sized(p.inProcessEvents) }]));
  return { method: { repetitions, perProfile, quick, order: 'modes interleaved within each repetition, rotated by one position per repetition', clock: 'process.hrtime.bigint', percentile: 'nearest-rank', cacheMode: line === 'v2' ? 'bypass' : null }, results: rows, memory };
}

// ---------------------------------------------------------------------------

const identityOut = {
  runtime: `node-${process.versions.node}`,
  platform: process.platform,
  arch: process.arch,
  sdk: line === 'v1'
    ? { '@modelcontextprotocol/sdk': installedVersion('@modelcontextprotocol/sdk', '@modelcontextprotocol/sdk/client/index.js') }
    : { '@modelcontextprotocol/client': installedVersion('@modelcontextprotocol/client', '@modelcontextprotocol/client'), '@modelcontextprotocol/server': installedVersion('@modelcontextprotocol/server', '@modelcontextprotocol/server') },
  transport: transportKind,
};

// The result goes to a file, not stdout: a pipe may still be draining at process.exit().
if (mode === 'containment') {
  await containment();
  writeFileSync(join(recordDir, 'result.json'), JSON.stringify({ ...identityOut, protocolVersion: negotiatedProtocol, cases: results }), { mode: 0o600 });
} else if (mode === 'overhead') {
  const measured = await overhead();
  writeFileSync(join(recordDir, 'result.json'), JSON.stringify({ ...identityOut, protocolVersion: negotiatedProtocol, ...measured }), { mode: 0o600 });
} else if (mode === 'resource-overhead') {
  const measured = await resourceOverhead();
  writeFileSync(join(recordDir, 'result.json'), JSON.stringify({ ...identityOut, protocolVersion: negotiatedProtocol, ...measured }), { mode: 0o600 });
} else {
  throw new Error(`unknown mode ${mode}`);
}
process.exit(0);
