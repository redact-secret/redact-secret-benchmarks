/**
 * A real MCP server for the black-box qualification (#281), run as its own
 * process: `node server.mjs <v1|v2> <stdio|http> <low-level|mcp-server> <record-dir> [on|off]`.
 *
 * Raw tools (`result:<case>`, `throw`, `crash`, `slow`, `half`, `echo-args`)
 * return what a misbehaving or compromised tool would: the host is the
 * authoritative boundary. `wrapped-*` tools use the adapter's server-side
 * wrappers, the contract's preventive placement. Over HTTP the process prints
 * `LISTENING <port>` on stdout; over stdio stdout carries only protocol
 * messages.
 *
 * What the server itself observes is appended to files under <record-dir>:
 * `wire.jsonl` (every JSON-RPC message it sent) and `received.jsonl` (the
 * arguments each handler received). The parent scans them for plaintext.
 */

import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { createMcpBoundary } from '@redact-secret/adapter-mcp';

import { LIMITS, OVERHEAD_PROFILES, RESULT_CASES, halfOfSecret, throwMessage, wrappedStreamChunks } from './workloads.mjs';

const [line, transportKind, kind, recordDir, recording = 'on'] = process.argv.slice(2);
// The overhead run turns recording off: it would otherwise time the server's own file writes.
const record = recording === 'off' ? () => {} : (file, value) => appendFileSync(join(recordDir, file), `${JSON.stringify(value)}\n`, { mode: 0o600 });

async function loadLine() {
  if (line === 'v1') {
    const [{ Server }, { McpServer }, types] = await Promise.all([
      import('@modelcontextprotocol/sdk/server/index.js'),
      import('@modelcontextprotocol/sdk/server/mcp.js'),
      import('@modelcontextprotocol/sdk/types.js'),
    ]);
    return {
      Server, McpServer,
      onListTools: (s, h) => s.setRequestHandler(types.ListToolsRequestSchema, h),
      onCallTool: (s, h) => s.setRequestHandler(types.CallToolRequestSchema, h),
      signalOf: extra => extra?.signal,
    };
  }
  const { Server, McpServer } = await import('@modelcontextprotocol/server');
  return {
    Server, McpServer,
    onListTools: (s, h) => s.setRequestHandler('tools/list', h),
    onCallTool: (s, h) => s.setRequestHandler('tools/call', h),
    signalOf: ctx => ctx?.mcpReq?.signal ?? ctx?.signal,
  };
}

const INFO = { name: 'redact-secret-benchmarks-mcp-qualification', version: '0.0.0' };
let lastTool = null;
const stats = { echoCalls: 0, wrappedArgsCalls: 0, streamPulled: 0, streamClosed: 0, slowCancelled: 0 };

function waitForAbort(signal) {
  return new Promise(resolve => {
    if (signal === undefined) return;
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

function countedStream(chunks) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next() {
          stats.streamPulled += 1;
          return Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined });
        },
        return() {
          stats.streamClosed += 1;
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

async function buildLowLevel(sdk) {
  const mcp = await createMcpBoundary(LIMITS);
  const handlers = new Map();
  for (const c of RESULT_CASES) handlers.set(`result:${c.id}`, () => c.result());
  for (const p of OVERHEAD_PROFILES) {
    const cached = p.result();
    handlers.set(`overhead:${p.id}`, () => cached);
  }
  handlers.set('throw', () => { throw new Error(throwMessage()); });
  handlers.set('crash', () => { setTimeout(() => process.exit(3), 5); return new Promise(() => {}); });
  handlers.set('slow', async (_args, extra) => {
    await Promise.race([waitForAbort(sdk.signalOf(extra)), new Promise(r => setTimeout(r, 5000))]);
    if (sdk.signalOf(extra)?.aborted) stats.slowCancelled += 1;
    return { content: [{ type: 'text', text: `late AWS result ${throwMessage()}` }] };
  });
  handlers.set('half', args => ({ content: [{ type: 'text', text: halfOfSecret(args?.index ?? 0) }] }));
  handlers.set('echo-args', args => {
    stats.echoCalls += 1;
    record('received.jsonl', { tool: 'echo-args', args: args ?? null });
    return { content: [{ type: 'text', text: `received ${JSON.stringify(args ?? null)}` }] };
  });
  handlers.set('wrapped-result', mcp.wrapToolHandler(() => ({ content: [{ type: 'text', text: `deploy log\n${throwMessage()}` }], structuredContent: { log: throwMessage() } })));
  handlers.set('wrapped-throw', mcp.wrapToolHandler(() => { throw new Error(throwMessage()); }));
  handlers.set('wrapped-args', mcp.wrapToolHandler(args => {
    stats.wrappedArgsCalls += 1;
    record('received.jsonl', { tool: 'wrapped-args', args: args ?? null });
    return { content: [{ type: 'text', text: 'arguments accepted' }] };
  }, { sanitizeArguments: true }));
  handlers.set('wrapped-stream-split', mcp.wrapStreamedToolHandler(() => countedStream(wrappedStreamChunks('split'))));
  handlers.set('wrapped-stream-block', mcp.wrapStreamedToolHandler(() => countedStream(wrappedStreamChunks('block'))));
  handlers.set('wrapped-slow-stream', mcp.wrapStreamedToolHandler(() => ({
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        next() {
          stats.streamPulled += 1;
          if (!sent) { sent = true; return Promise.resolve({ done: false, value: `first chunk ${throwMessage()}\n` }); }
          return new Promise(() => {});
        },
        return() { stats.streamClosed += 1; return Promise.resolve({ done: true, value: undefined }); },
      };
    },
  })));
  handlers.set('stats', () => ({ content: [{ type: 'text', text: JSON.stringify(stats) }] }));

  const server = new sdk.Server(INFO, { capabilities: { tools: {} } });
  sdk.onListTools(server, () => ({ tools: [...handlers.keys()].map(name => ({ name, inputSchema: { type: 'object' } })) }));
  sdk.onCallTool(server, (request, extra) => {
    lastTool = request.params.name;
    const handler = handlers.get(request.params.name);
    if (handler === undefined) return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
    return handler(request.params.arguments, extra);
  });
  return server;
}

async function buildHighLevel(sdk) {
  const server = new sdk.McpServer(INFO);
  server.registerTool('throw', { description: 'an unwrapped handler that throws' }, () => { lastTool = 'throw'; throw new Error(throwMessage()); });
  server.registerTool('stats', { description: 'server observations' }, () => ({ content: [{ type: 'text', text: JSON.stringify(stats) }] }));
  return server;
}

function tapWire(transport) {
  if (recording === 'off') return;
  const send = transport.send.bind(transport);
  transport.send = (message, options) => {
    // Calls are sequential, so the tool most recently called owns this message.
    record('wire.jsonl', { tool: lastTool, message });
    return send(message, options);
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function serveHttp(server) {
  let transport;
  let handle;
  if (line === 'v1') {
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    handle = async (req, res) => {
      const body = await readBody(req);
      await transport.handleRequest(req, res, body.length > 0 ? JSON.parse(body.toString('utf-8')) : undefined);
    };
  } else {
    const { WebStandardStreamableHTTPServerTransport } = await import('@modelcontextprotocol/server');
    transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    handle = async (req, res) => {
      const body = await readBody(req);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
        else if (Array.isArray(value)) for (const item of value) headers.append(key, item);
      }
      const controller = new AbortController();
      res.on('close', () => controller.abort());
      const response = await transport.handleRequest(new Request(`http://127.0.0.1${req.url ?? '/'}`, {
        method: req.method, headers, body: body.length > 0 ? body : undefined, signal: controller.signal,
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (response.body === null) { res.end(); return; }
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch {
        // the client went away mid-stream
      }
      res.end();
    };
  }
  tapWire(transport);
  await server.connect(transport);
  const http = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  process.stdout.write(`LISTENING ${http.address().port}\n`);
}

const sdk = await loadLine();
const server = kind === 'mcp-server' ? await buildHighLevel(sdk) : await buildLowLevel(sdk);
if (transportKind === 'stdio') {
  const { StdioServerTransport } = line === 'v1'
    ? await import('@modelcontextprotocol/sdk/server/stdio.js')
    : await import('@modelcontextprotocol/server/stdio');
  const transport = new StdioServerTransport();
  tapWire(transport);
  await server.connect(transport);
} else {
  await serveHttp(server);
}
