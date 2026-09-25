/**
 * The MCP host for the black-box qualification (#281). It runs inside a clean
 * consumer that installed the pinned tarballs, and uses only the public API
 * of `@redact-secret/adapter-mcp` and `@redact-secret/adapter-ai-context`.
 *
 *   node host.mjs containment <v1|v2> <stdio|http> <record-dir>
 *   node --expose-gc host.mjs overhead <v1|v2> <stdio|http> <record-dir> [--quick]
 *   node host.mjs init <core|adapter>
 *
 * The host is the contract's authoritative placement: it receives a
 * `CallToolResult` from a real MCP client and, only through the boundary,
 * writes it to its log, its store, its audit trail and the model context.
 * Each of those sinks is appended, per case, to <record-dir>, and the parent
 * process scans them for synthetic plaintext. `result.json` in the same
 * directory carries outcomes and counts only: nothing derived from a value.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
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
const { createMcpBoundary, createMcpBoundaryWith, toCallToolResult } = adapterMcp;

const REQUEST_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

let current = 'setup';
const sink = (name, value) => appendFileSync(join(recordDir, `${name}.jsonl`), `${JSON.stringify({ case: current, value })}\n`, { mode: 0o600 });
const hostLog = message => sink('host-log', message);
const onAudit = record => sink('audit', { kind: 'crossing', record });
const onFinding = (finding, context) => sink('audit', { kind: 'finding', finding, context });

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

const serverArgs = kind => [join(here, 'server.mjs'), line, transportKind, kind, recordDir, mode === 'overhead' ? 'off' : 'on'];

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

async function connect(kind = 'low-level') {
  const { Client, StdioClientTransport, StreamableHTTPClientTransport } = await clientModules();
  const client = new Client({ name: 'redact-secret-benchmarks-host', version: '0.0.0' });
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
  try {
    const row = await body();
    push({ id: testCase.id, area: testCase.area, expect: testCase.expect, ...(testCase.exclusion ? { exclusion: testCase.exclusion } : {}), ...(testCase.policyDelivers ? { policyDelivers: true } : {}), ...row });
  } catch (error) {
    recordError(error);
    push({ id: testCase.id, area: testCase.area, expect: testCase.expect, observed: { outcome: 'threw' }, threw: true });
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
      let signal;
      if (c.abortAfterMs !== undefined) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), c.abortAfterMs);
        signal = controller.signal;
      }
      const statsBefore = c.tool.startsWith('wrapped-stream') || c.tool === 'wrapped-slow-stream' ? await low.stats() : null;
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
} else {
  throw new Error(`unknown mode ${mode}`);
}
process.exit(0);
