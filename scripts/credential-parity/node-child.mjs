/**
 * One #381 JavaScript surface in its own process. Runs the shared #427 job runner (whole-input scan, redact,
 * scanAndRedact, incremental partitions, whole-input and incremental limits) and then drives the byte-input stream
 * adapters, Node `Transform` and Web `TransformStream`, over the same documents cut at byte positions.
 * Usage: node node-child.mjs <installation-root> <addon|wasm> <job.json> <result.json>
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { runJob } from '../pii-parity/js-runner.mjs';

const [root, expected, jobFile, outFile] = process.argv.slice(2);
const job = JSON.parse(await readFile(jobFile, 'utf8'));
const load = relative => import(pathToFileURL(path.join(root, 'node_modules/@redact-secret/core/dist', relative)).href);
const api = await load('index.js');
await api.initialize(job.selectors.length ? { pii: job.selectors } : {});
if (api.artifact() !== expected) throw new Error(`surface loaded ${api.artifact()}, expected ${expected}`);
const { createNodeStreamSanitizer } = await import(pathToFileURL(path.join(root, 'node_modules/@redact-secret/core/dist/adapters/node-stream.js')).href);
const { createWebStreamSanitizer } = await import(pathToFileURL(path.join(root, 'node_modules/@redact-secret/core/dist/adapters/web-stream.js')).href);
const codeOf = error => (error && typeof error.code === 'string' ? error.code : 'UNCODED_ERROR');
const findingRow = f => ({ type: f.type, detector: f.detector, action: f.action, confidence: f.confidence ?? null, start: f.start, end: f.end });
const byteChunks = (input, cuts) => {
  const bytes = Buffer.from(input, 'utf8'), chunks = []; let previous = 0;
  for (const cut of [...cuts, bytes.length]) { chunks.push(new Uint8Array(bytes.subarray(previous, cut))); previous = cut; }
  return chunks;
};
const limitsOf = limits => ({ limits: { maxInputCodeUnits: limits.maxInput, maxBufferedCodeUnits: limits.maxBuffered,
  maxTokenCodeUnits: limits.maxToken, maxMultilineCodeUnits: limits.maxMultiline } });

async function nodeStream(input, cuts, limits) {
  let sanitizer, text = '';
  try {
    sanitizer = createNodeStreamSanitizer(limitsOf(limits));
    await pipeline(Readable.from(byteChunks(input, cuts), { objectMode: true }), sanitizer, async source => { for await (const chunk of source) text += chunk.toString('utf8'); });
    return { status: 'ok', text, findings: sanitizer.findings.map(findingRow) };
  } catch (error) { return { status: 'error', errorCode: codeOf(error), text, findings: sanitizer ? sanitizer.findings.map(findingRow) : [] }; }
}
async function webStream(input, cuts, limits) {
  let sanitizer, text = '';
  try {
    sanitizer = createWebStreamSanitizer(limitsOf(limits));
    const chunks = byteChunks(input, cuts);
    const source = new ReadableStream({ pull(controller) { const next = chunks.shift(); if (next) controller.enqueue(next); else controller.close(); } });
    const reader = source.pipeThrough(sanitizer).getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; text += value; }
    return { status: 'ok', text, findings: sanitizer.findings.map(findingRow) };
  } catch (error) { return { status: 'error', errorCode: codeOf(error), text, findings: sanitizer ? sanitizer.findings.map(findingRow) : [] }; }
}

const result = runJob(api, job);
for (const row of result.cases) {
  const spec = job.cases.find(c => c.key === row.key);
  row.streams = [];
  for (const partition of spec.bytePartitions) {
    row.streams.push({ id: `node-stream:${partition.id}`, ...(await nodeStream(spec.input, partition.cuts, job.incrementalLimits)) });
    row.streams.push({ id: `web-stream:${partition.id}`, ...(await webStream(spec.input, partition.cuts, job.incrementalLimits)) });
  }
}
await writeFile(outFile, JSON.stringify(result));
