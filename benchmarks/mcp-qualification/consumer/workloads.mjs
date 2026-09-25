/**
 * The black-box MCP workload corpus (#281): every synthetic value, every tool
 * result a server returns, and the outcome the core's MCP boundary contract
 * (redact-secret#612, docs/reference/mcp-boundary.md) says the host must
 * observe. Plain ESM with no dependencies, so the harness copies it into a
 * clean consumer next to the host and the server, and the unit tests import
 * it directly.
 *
 * Expectations come from the contract, never from adapter output. Every
 * value is synthetic and built by concatenation at run time, so no
 * credential-shaped literal exists in this file.
 */

/** Synthetic values the core's default detectors match. None is a credential. */
export const SECRETS = Object.freeze({
  aws: 'AKIA' + 'SYNTHETICEXAMPLE',
  github: 'ghp_' + 'SYNTHETICBENCHMARK' + '0'.repeat(18),
  // Detected only through the `password` key context.
  keyContext: 'synthetic-bench-' + 'passphrase',
  // The body of a synthetic PEM block; the core's private-key detector blocks it.
  privateKeyBody: Buffer.from('SYNTHETIC_BENCHMARK_ONLY_NOT_A_KEY').toString('base64'),
});

/** 300 distinct synthetic AWS-shaped values for the finding-count cases. */
export const MANY = Object.freeze(Array.from({ length: 300 }, (_, i) => 'AKIA' + 'SYNTHETICX' + String(i).padStart(6, '0')));

export function privateKeyPem() {
  return '-----BEGIN ' + 'PRIVATE KEY-----\n' + SECRETS.privateKeyBody + '\n-----END ' + 'PRIVATE KEY-----';
}

/** Every value the leak check looks for, in full and as fragments. */
export function allSecrets() {
  return [SECRETS.aws, SECRETS.github, SECRETS.keyContext, SECRETS.privateKeyBody, ...MANY];
}

/** The fixed texts the contract pins (docs/reference/mcp-boundary.md#outcomes-and-fixed-mcp-results). */
export const FIXED = Object.freeze({
  blocked: 'This MCP tool call was blocked by secret-redaction policy. No content, arguments, or error detail is included.',
  toolError: 'This MCP tool call failed. No content, arguments, or error detail is included.',
});

/**
 * The host boundary's limits: the adapter README's documented example, so the
 * limit cases exercise a production-shaped configuration.
 */
export const LIMITS = Object.freeze({
  wholeInputLimits: Object.freeze({ maxInputBytes: 65536, maxFindings: 256 }),
  incrementalLimits: Object.freeze({
    maxInputCodeUnits: 1048576, maxBufferedCodeUnits: 65536, maxTokenCodeUnits: 8192, maxMultilineCodeUnits: 32768,
  }),
  traversalLimits: Object.freeze({ maxDepth: 16, maxNodes: 4096 }),
});

// ---------------------------------------------------------------------------
// Deterministic benign material: look-alikes a scanner must leave alone.
// ---------------------------------------------------------------------------

/** Mulberry32: a tiny seeded PRNG, so every generated payload is reproducible. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['deploy', 'region', 'replica', 'healthy', 'queue', 'latency', 'build', 'artifact', 'cache', 'shard', 'window', 'retry'];

function hex(random, n) {
  let out = '';
  for (let i = 0; i < n; i += 1) out += Math.floor(random() * 16).toString(16);
  return out;
}

function benignLeaf(random, i) {
  switch (i % 6) {
    case 0: return `${WORDS[i % WORDS.length]} ${Math.floor(random() * 1e6)}`;
    case 1: return `${hex(random, 8)}-${hex(random, 4)}-4${hex(random, 3)}-a${hex(random, 3)}-${hex(random, 12)}`;
    case 2: return `sha256:${hex(random, 64)}`;
    case 3: return new Date(Date.UTC(2026, 0, 1) + Math.floor(random() * 3e10)).toISOString();
    case 4: return `https://example.invalid/${WORDS[(i * 7) % WORDS.length]}/${i}?page=${i % 9}`;
    default: return Buffer.from(`${WORDS[i % WORDS.length]} ordinary payload ${i}`).toString('base64');
  }
}

/** A wide, bounded benign structured value with `leaves` string leaves. */
export function benignStructured(leaves, seed = 281) {
  const random = prng(seed);
  const groups = [];
  const perGroup = 25;
  for (let g = 0; g * perGroup < leaves; g += 1) {
    const items = [];
    for (let i = g * perGroup; i < Math.min(leaves, (g + 1) * perGroup); i += 1) items.push(benignLeaf(random, i));
    groups.push({ group: g, ok: true, items });
  }
  return { report: { generated: 'synthetic', groups } };
}

export function benignLogText(bytes, seed = 282) {
  const random = prng(seed);
  const lines = [];
  let size = 0;
  for (let i = 0; size < bytes; i += 1) {
    const line = `2026-09-25T00:00:${String(i % 60).padStart(2, '0')}Z INFO ${WORDS[i % WORDS.length]} id=${benignLeaf(random, i * 6 + 1)} took=${i % 97}ms`;
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join('\n').slice(0, bytes);
}

function nested(depth, leaf) {
  let value = { leaf };
  for (let i = 0; i < depth; i += 1) value = { level: value };
  return value;
}

function textResult(text, extra = {}) {
  return { content: [{ type: 'text', text }], ...extra };
}

function withTextCopy(structuredContent) {
  return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
}

// ---------------------------------------------------------------------------
// Tool-result cases served raw by a real MCP server; the host applies the
// boundary (the contract's authoritative placement).
// ---------------------------------------------------------------------------

const { aws, github, keyContext } = SECRETS;
const half = Math.floor(github.length / 2);

/**
 * `expect` is the contract outcome at the host: `ok`, `blocked` (with an
 * optional `reason`), `tool_error`, or `aborted`. `exclusion` names a
 * documented non-goal: plaintext it delivers is a known false negative, not
 * a containment failure. `benign` asks the harness to check that the
 * delivered value is byte-identical to what the server sent (availability).
 */
export const RESULT_CASES = Object.freeze([
  { id: 'text-provider-token', area: 'text', expect: { outcome: 'ok' }, result: () => textResult(`deploy ok\nAWS_ACCESS_KEY_ID=${aws}\n`) },
  {
    id: 'text-mixed-sensitive-and-benign-siblings', area: 'text', expect: { outcome: 'ok' },
    result: () => ({ content: [
      { type: 'text', text: 'build 4411 finished in 38s' },
      { type: 'text', text: `export GITHUB_TOKEN=${github}\nexport AWS_ACCESS_KEY_ID=${aws}` },
      { type: 'text', text: benignLogText(600) },
    ] }),
  },
  {
    id: 'structured-nested-with-text-copy', area: 'structuredContent', expect: { outcome: 'ok' },
    result: () => withTextCopy({ deploy: { stages: [{ name: 'plan', env: { vars: ['REGION=eu-west-1', `AWS_ACCESS_KEY_ID=${aws}`] } }], replicas: 3, healthy: true, note: null } }),
  },
  {
    id: 'structured-key-context-only', area: 'structuredContent', expect: { outcome: 'blocked', reason: 'policy' },
    result: () => withTextCopy({ service: { credentials: { password: keyContext } } }),
  },
  {
    id: 'structured-private-key-block-finding', area: 'structuredContent', expect: { outcome: 'blocked', reason: 'policy' },
    result: () => ({ content: [{ type: 'text', text: 'wrote 1 file' }], structuredContent: { files: [{ path: 'id_synthetic', body: privateKeyPem() }] } }),
  },
  {
    id: 'structured-many-findings-across-leaves', area: 'limits', expect: { outcome: 'ok' },
    result: () => ({ content: [{ type: 'text', text: 'inventory exported' }], structuredContent: { keys: MANY.map((k, i) => ({ i, line: `AWS_ACCESS_KEY_ID=${k}` })) } }),
  },
  {
    id: 'structured-secret-as-object-key', area: 'structuredContent', expect: { outcome: 'blocked', reason: 'policy' },
    result: () => ({ content: [{ type: 'text', text: 'lookup table' }], structuredContent: { byKey: { [aws]: 'owner=ci' } } }),
  },
  {
    id: 'structured-nodes-near-limit', area: 'limits', expect: { outcome: 'ok' },
    result: () => ({ content: [], structuredContent: { items: Array.from({ length: LIMITS.traversalLimits.maxNodes - 200 }, (_, i) => (i === 3000 ? `k ${aws}` : i)) } }),
  },
  { id: 'text-secret-at-end-of-large-leaf', area: 'limits', expect: { outcome: 'ok' }, result: () => textResult(`${benignLogText(LIMITS.wholeInputLimits.maxInputBytes - 200)}\nAWS_ACCESS_KEY_ID=${aws}`) },
  {
    id: 'annotations-with-unknown-field', area: 'fields', expect: { outcome: 'ok' },
    result: () => ({ content: [{ type: 'text', text: 'ordinary text', annotations: { audience: ['user'], priority: 0.5, note: `AWS_ACCESS_KEY_ID=${aws}` } }] }),
  },
  { id: 'meta-on-result', area: '_meta', expect: { outcome: 'ok' }, result: () => textResult('ordinary text', { _meta: { trace: { upstream: `AWS_ACCESS_KEY_ID=${aws}` } } }) },
  { id: 'meta-on-block', area: '_meta', expect: { outcome: 'ok' }, result: () => ({ content: [{ type: 'text', text: 'ordinary text', _meta: { upstream: `token ${github}` } }] }) },
  {
    id: 'resource-link-query-and-description', area: 'resource_link', expect: { outcome: 'ok' },
    result: () => ({ content: [{ type: 'resource_link', uri: `https://example.invalid/run?token=${github}`, name: 'run', description: `started with AWS_ACCESS_KEY_ID=${aws}`, mimeType: 'text/html' }] }),
  },
  {
    id: 'embedded-text-resource', area: 'resource', expect: { outcome: 'ok' },
    result: () => ({ content: [{ type: 'resource', resource: { uri: 'file:///synthetic/.env', mimeType: 'text/plain', text: `AWS_ACCESS_KEY_ID=${aws}\n` } }] }),
  },
  {
    id: 'unknown-top-level-field', area: 'fields', expect: { outcome: 'ok' },
    result: () => textResult('ordinary text', { extension: { notes: [`AWS_ACCESS_KEY_ID=${aws}`] } }),
  },
  { id: 'is-error-result-is-scanned', area: 'text', expect: { outcome: 'ok' }, result: () => textResult(`upstream error: GITHUB_TOKEN=${github}`, { isError: true }) },
  { id: 'text-private-key-block-finding', area: 'text', expect: { outcome: 'blocked', reason: 'policy' }, result: () => textResult(`key follows\n${privateKeyPem()}\n`) },
  {
    id: 'image-blocked-by-default', area: 'binary', expect: { outcome: 'blocked', reason: 'unsupported_value' },
    result: () => ({ content: [{ type: 'image', data: Buffer.from('synthetic image bytes').toString('base64'), mimeType: 'image/png' }, { type: 'text', text: `AWS_ACCESS_KEY_ID=${aws}` }] }),
  },
  {
    id: 'blob-resource-blocked-by-default', area: 'binary', expect: { outcome: 'blocked', reason: 'unsupported_value' },
    result: () => ({ content: [{ type: 'resource', resource: { uri: 'file:///synthetic.bin', mimeType: 'application/octet-stream', blob: Buffer.from(`AWS_ACCESS_KEY_ID=${aws}`).toString('base64') } }] }),
  },
  { id: 'large-benign-structured', area: 'benign', benign: true, expect: { outcome: 'ok' }, result: () => withTextCopy(benignStructured(900)) },
  { id: 'large-benign-text', area: 'benign', benign: true, expect: { outcome: 'ok' }, result: () => textResult(benignLogText(60000)) },
  { id: 'depth-within-limit', area: 'limits', expect: { outcome: 'ok' }, result: () => ({ content: [], structuredContent: nested(LIMITS.traversalLimits.maxDepth - 6, `AWS_ACCESS_KEY_ID=${aws}`) }) },
  { id: 'depth-over-limit', area: 'limits', expect: { outcome: 'blocked', reason: 'limit_exceeded' }, result: () => ({ content: [], structuredContent: nested(LIMITS.traversalLimits.maxDepth + 2, `AWS_ACCESS_KEY_ID=${aws}`) }) },
  {
    id: 'nodes-over-limit', area: 'limits', expect: { outcome: 'blocked', reason: 'limit_exceeded' },
    result: () => ({ content: [{ type: 'text', text: `AWS_ACCESS_KEY_ID=${aws}` }], structuredContent: { items: Array.from({ length: LIMITS.traversalLimits.maxNodes + 10 }, (_, i) => i % 50 === 0 ? `k ${aws}` : i) } }),
  },
  { id: 'leaf-over-input-limit', area: 'limits', expect: { outcome: 'blocked', reason: 'limit_exceeded' }, result: () => textResult(`${benignLogText(LIMITS.wholeInputLimits.maxInputBytes)}\nAWS_ACCESS_KEY_ID=${aws}\n`) },
  { id: 'findings-over-limit-in-one-leaf', area: 'limits', expect: { outcome: 'blocked', reason: 'limit_exceeded' }, result: () => textResult(MANY.map(k => `AWS_ACCESS_KEY_ID=${k}`).join('\n')) },
  // Both SDK server lines reject these four before they reach the host; the
  // host maps the JSON-RPC error to tool_error without reading it.
  { id: 'malformed-unknown-block-type', area: 'malformed', expect: { outcome: 'tool_error' }, result: () => ({ content: [{ type: 'x-future', text: `AWS_ACCESS_KEY_ID=${aws}` }] }) },
  { id: 'malformed-non-object-block', area: 'malformed', expect: { outcome: 'tool_error' }, result: () => ({ content: [`AWS_ACCESS_KEY_ID=${aws}`] }) },
  { id: 'malformed-content-not-array', area: 'malformed', expect: { outcome: 'tool_error' }, result: () => ({ content: { type: 'text', text: `AWS_ACCESS_KEY_ID=${aws}` } }) },
  { id: 'malformed-result-not-object', area: 'malformed', expect: { outcome: 'tool_error' }, result: () => `AWS_ACCESS_KEY_ID=${aws}` },
  // Documented exclusions (docs/reference/mcp-boundary.md#what-it-does-not-do):
  // a split across blocks or fields is not joined.
  {
    id: 'split-across-blocks', area: 'exclusion', exclusion: 'split-across-blocks', expect: { outcome: 'ok' },
    result: () => ({ content: [{ type: 'text', text: github.slice(0, half) }, { type: 'text', text: github.slice(half) }] }),
  },
  {
    id: 'split-across-fields', area: 'exclusion', exclusion: 'split-across-fields', expect: { outcome: 'ok' },
    result: () => ({ content: [], structuredContent: { head: github.slice(0, half), tail: github.slice(half) } }),
  },
]);

/** Tools the server exposes besides `result:<id>`; each is a separate case. */
export const TOOL_CASES = Object.freeze([
  // A low-level handler that throws: the SDK answers with a JSON-RPC error whose message carries the value.
  { id: 'tool-throws-low-level', area: 'failure', tool: 'throw', expect: { outcome: 'tool_error' } },
  // A high-level McpServer handler that throws: the SDK turns the message into isError text; the host scans it.
  { id: 'tool-throws-mcp-server', area: 'failure', tool: 'throw', server: 'mcp-server', expect: { outcome: 'ok' } },
  // The server process dies mid-call.
  { id: 'server-crash-mid-call', area: 'failure', tool: 'crash', expect: { outcome: 'tool_error' }, last: true },
  // Opt-in argument sanitation at the host: the tool must never receive plaintext.
  { id: 'arguments-opt-in-redacted-before-dispatch', area: 'arguments', tool: 'echo-args', hostArguments: () => ({ query: `deploy with AWS_ACCESS_KEY_ID=${aws}`, dryRun: true }), expect: { outcome: 'ok' } },
  { id: 'arguments-opt-in-key-context-not-dispatched', area: 'arguments', tool: 'echo-args', hostArguments: () => ({ login: { password: keyContext } }), expect: { outcome: 'blocked', reason: 'policy' }, dispatch: false },
  { id: 'arguments-opt-in-private-key-not-dispatched', area: 'arguments', tool: 'echo-args', hostArguments: () => ({ files: [privateKeyPem()] }), expect: { outcome: 'blocked', reason: 'policy' }, dispatch: false },
  // Preventive, server-side placement: the wrapped server's wire output and handler input must be clean,
  // and the host still applies the boundary.
  { id: 'server-wrapped-result', area: 'server-wrapped', tool: 'wrapped-result', wire: true, expect: { outcome: 'ok' } },
  { id: 'server-wrapped-throw', area: 'server-wrapped', tool: 'wrapped-throw', wire: true, expect: { outcome: 'ok' }, fixedDelivered: 'toolError' },
  { id: 'server-wrapped-arguments', area: 'server-wrapped', tool: 'wrapped-args', arguments: () => ({ query: `use GITHUB_TOKEN=${github}` }), expect: { outcome: 'ok' } },
  { id: 'server-wrapped-stream-split', area: 'server-wrapped', tool: 'wrapped-stream-split', wire: true, expect: { outcome: 'ok' } },
  { id: 'server-wrapped-stream-block-stops-pulling', area: 'server-wrapped', tool: 'wrapped-stream-block', wire: true, expect: { outcome: 'ok' }, fixedDelivered: 'blocked' },
  // Cancellation over the transport.
  { id: 'cancel-slow-tool', area: 'cancellation', tool: 'slow', abortAfterMs: 60, expect: { outcome: 'aborted' } },
  { id: 'cancel-server-wrapped-slow-stream', area: 'cancellation', tool: 'wrapped-slow-stream', abortAfterMs: 60, expect: { outcome: 'aborted' } },
  // Exclusion: a split across two calls is not joined.
  { id: 'split-across-calls', area: 'exclusion', exclusion: 'split-across-calls', tool: 'half', calls: [0, 1], expect: { outcome: 'ok' } },
]);

/** Chunks the server-wrapped streamed tools produce. */
export function wrappedStreamChunks(kind) {
  if (kind === 'split') {
    const text = `subprocess stdout: GITHUB_TOKEN=${github} done\n`;
    const at = text.indexOf(github) + 7;
    return [text.slice(0, at), text.slice(at)];
  }
  const pem = privateKeyPem();
  return ['ordinary text\n', pem.slice(0, 40), `${pem.slice(40)}\n`, ...Array.from({ length: 12 }, (_, i) => `ordinary line ${i}\n`)];
}

/** The text a server-side tool throws with. It carries a synthetic value on purpose. */
export function throwMessage() {
  return `upstream failed while using AWS_ACCESS_KEY_ID=${aws}`;
}

export function halfOfSecret(index) {
  return index === 0 ? github.slice(0, half) : github.slice(half);
}

// ---------------------------------------------------------------------------
// Host-side streamed cases (sanitizeStreamedToolResult over a local producer).
// ---------------------------------------------------------------------------

export const STREAM_TEXT = () => `step 1 ok\nAWS_ACCESS_KEY_ID=${aws}\nstep 2 ok\nGITHUB_TOKEN=${github}\ndone\n`;

/**
 * Deterministic partitions of `text`: every two-chunk split, every
 * one-code-unit chunking, and seeded random partitions, including ones that
 * cut each secret more than once.
 */
export function partitions(text, { random = 64, seed = 2810 } = {}) {
  const out = [];
  for (let i = 1; i < text.length; i += 1) out.push([text.slice(0, i), text.slice(i)]);
  out.push([...text]);
  const r = prng(seed);
  for (let n = 0; n < random; n += 1) {
    const cuts = new Set();
    const k = 2 + Math.floor(r() * 12);
    while (cuts.size < k) cuts.add(1 + Math.floor(r() * (text.length - 1)));
    const sorted = [...cuts].sort((a, b) => a - b);
    const chunks = [];
    let prev = 0;
    for (const c of sorted) { chunks.push(text.slice(prev, c)); prev = c; }
    chunks.push(text.slice(prev));
    out.push(chunks);
  }
  // Empty chunks between real ones.
  out.push(['', text.slice(0, 20), '', text.slice(20), '']);
  return out;
}

export const STREAM_CASES = Object.freeze([
  { id: 'stream-partition-sweep', area: 'streaming', expect: { outcome: 'ok' } },
  { id: 'stream-block-finding-stops-pulling', area: 'streaming', expect: { outcome: 'blocked', reason: 'policy' } },
  { id: 'stream-input-limit-stops-pulling', area: 'streaming', expect: { outcome: 'blocked', reason: 'limit_exceeded' } },
  { id: 'stream-token-limit', area: 'streaming', expect: { outcome: 'blocked', reason: 'limit_exceeded' } },
  { id: 'stream-abort-sweep', area: 'cancellation', expect: { outcome: 'aborted' } },
  { id: 'stream-abort-while-producer-pending', area: 'cancellation', expect: { outcome: 'aborted' } },
  { id: 'stream-producer-throws', area: 'failure', expect: { outcome: 'tool_error' } },
  { id: 'stream-producer-rejects-async', area: 'failure', expect: { outcome: 'tool_error' } },
  { id: 'stream-non-string-chunk', area: 'streaming', expect: { outcome: 'blocked' } },
  { id: 'stream-node-readable-destroyed-on-failure', area: 'streaming', expect: { outcome: 'blocked', reason: 'policy' } },
]);

/** Host-side policy and callback cases over a real transport call. */
export const POLICY_CASES = Object.freeze([
  { id: 'policy-block-all', area: 'policy', policy: 'block', expect: { outcome: 'blocked', reason: 'policy' } },
  // `warn` and `allow` deliver the value unchanged by contract: that is a declared outcome, not a leak.
  { id: 'policy-warn-delivers-unchanged', area: 'policy', policy: 'warn', policyDelivers: true, expect: { outcome: 'ok' } },
  { id: 'policy-allow-delivers-unchanged', area: 'policy', policy: 'allow', policyDelivers: true, expect: { outcome: 'ok' } },
  { id: 'policy-throws-fails-closed', area: 'policy', policy: 'throw', expect: { outcome: 'blocked', reason: 'core_error' } },
  { id: 'audit-callbacks-throw', area: 'audit', policy: 'throwing-callbacks', expect: { outcome: 'ok' } },
  { id: 'cancel-race-sweep', area: 'cancellation', race: true, expect: { outcome: 'ok-or-aborted' } },
  { id: 'downstream-failure-after-sanitization', area: 'failure', downstream: true, expect: { outcome: 'ok' } },
]);

/** The negative control: the host bypasses the boundary, and every sink must be flagged. */
export const CONTROL_CASE = Object.freeze({ id: 'control-unprotected-host', area: 'control', control: true, expect: { outcome: 'unprotected' } });

export function resultCase(id) {
  const found = RESULT_CASES.find(c => c.id === id);
  if (!found) throw new Error(`unknown result case ${id}`);
  return found;
}

export const ALL_CASE_IDS = Object.freeze([
  ...RESULT_CASES.map(c => c.id), ...TOOL_CASES.map(c => c.id), ...STREAM_CASES.map(c => c.id), ...POLICY_CASES.map(c => c.id), CONTROL_CASE.id,
]);

// ---------------------------------------------------------------------------
// Overhead workloads (#141/#143): the same results measured with and without
// the boundary. `events` is per repetition, sized so each repetition of every
// profile takes a comparable wall time.
// ---------------------------------------------------------------------------

export const OVERHEAD_PROFILES = Object.freeze([
  { id: 'mcp-text-small', events: 200, inProcessEvents: 400, description: 'one text block, ~200 B, one synthetic finding', result: () => textResult(`deploy ok\nregion=eu-west-1\nAWS_ACCESS_KEY_ID=${aws}\n${benignLogText(120)}`) },
  { id: 'mcp-structured-nested', events: 100, inProcessEvents: 200, description: 'structuredContent six levels deep with a JSON text copy, ~2 KiB, one synthetic finding', result: () => withTextCopy({ deploy: { plan: { stages: [{ env: { vars: ['REGION=eu-west-1', `AWS_ACCESS_KEY_ID=${aws}`] } }] }, logs: benignStructured(40, 7) } }) },
  { id: 'mcp-large-benign', events: 20, inProcessEvents: 20, description: 'structuredContent with 900 benign leaves and a JSON text copy, ~60 KiB, no finding', result: () => withTextCopy(benignStructured(900)) },
]);

export const OVERHEAD_STREAM_PROFILE = Object.freeze({
  id: 'mcp-stream-16x1k', inProcessEvents: 100, description: '16 chunks of ~1 KiB of one text, one synthetic finding split across a chunk boundary',
  chunks: () => {
    const text = `${benignLogText(8000, 9)}\nAWS_ACCESS_KEY_ID=${aws}\n${benignLogText(8000, 10)}`;
    const size = Math.ceil(text.length / 16);
    return Array.from({ length: 16 }, (_, i) => text.slice(i * size, (i + 1) * size));
  },
});
