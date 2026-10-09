#!/usr/bin/env node
// `node scripts/measure-focused-corpus.mjs --label <published|candidate> --out <file> [--node-root D] [--wasm-dir D]
// [--python P] [--cli B] [--corpus <module>]` (#717, #739). Scans the focused Batch 1 corpus through every supported surface the given
// engine provides, whole and streamed, and records the per-case observations with UTF-8 byte offsets. It records
// no matched text and decides nothing; scoring is benchmarks/batch1/score.mjs.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { measurementOutput, writeMeasurement } from './lib/measurement-output.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// The corpus module is chosen by `--corpus` (default: the Batch 1 corpus, so Batch 1 runs are unchanged).
let cases;
let CHUNK = 7; // `--chunk N` overrides it (default 7, the size every earlier run used)
const LIMITS = { maxInputBytes: 1_000_000, maxBufferedBytes: 32_896, maxTokenBytes: 8_192, maxMultilineBytes: 32_768 };
const bytes = (text, index) => Buffer.byteLength(text.slice(0, index));
const norm = (text, findings) => findings.map(f => ({ start: bytes(text, f.start), end: bytes(text, f.end), type: f.type, detector: f.detector, action: f.action }));
// UTF-16 chunks of CHUNK code units; a chunk never ends between a surrogate pair (the JS APIs reject lone surrogates).
// Identical to fixed slicing whenever no pair would be split, so earlier runs are unchanged.
const chunks = text => {
  const out = [];
  for (let i = 0; i < text.length;) {
    let end = Math.min(text.length, i + CHUNK);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end += 1;
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
};

/** A UTF-16 surface (the Node core and the WASM package share the API shape). */
function jsSurface(api, factory) {
  return Object.fromEntries(cases.map(kase => {
    const whole = norm(kase.text, api.scan(kase.text));
    const session = factory();
    const found = [];
    for (const piece of chunks(kase.text)) found.push(...session.append(piece).findings);
    found.push(...session.finalize().findings);
    return [kase.id, { whole: { findings: whole }, stream: { findings: norm(kase.text, found) } }];
  }));
}

async function nodeSurface(root) {
  const core = await import(pathToFileURL(path.join(root, 'node_modules/@redact-secret/core/dist/index.js')).href);
  await core.initialize();
  const version = JSON.parse(readFileSync(path.join(root, 'node_modules/@redact-secret/core/package.json'), 'utf8')).version;
  return { version, artifact: core.artifact?.() ?? null, rangeUnit: core.RANGE_UNIT, cases: jsSurface(core, () => core.createIncrementalSanitizer({ limits: LIMITS })) };
}

async function wasmSurface(dir) {
  const mod = await import(pathToFileURL(path.join(dir, 'redact_secret_wasm.js')).href);
  mod.initSync({ module: readFileSync(path.join(dir, 'redact_secret_wasm_bg.wasm')) });
  mod.initialize([]);
  const api = { scan: text => mod.scan(text) };
  const factory = () => mod.createIncrementalSanitizer(LIMITS.maxInputBytes, LIMITS.maxBufferedBytes, LIMITS.maxTokenBytes, LIMITS.maxMultilineBytes);
  return { version: mod.version(), rangeUnit: 'utf16-code-units', cases: jsSurface(api, factory) };
}

function pythonSurface(python, scratch) {
  const file = path.join(scratch, 'corpus.json');
  writeFileSync(file, JSON.stringify(cases.map(({ id, text }) => ({ id, text }))));
  const raw = execFileSync(python, [path.join(here, '../benchmarks/corpora/provider-shapes/python-surface.py'), file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, BATCH_CHUNK: String(CHUNK) } });
  const parsed = JSON.parse(raw);
  const version = execFileSync(python, ['-c', 'import importlib.metadata as m; print(m.version("redact-secret"))'], { encoding: 'utf8' }).trim();
  return { version, rangeUnit: parsed.rangeUnit, cases: parsed.cases };
}

const cliFindings = report => report.sources.flatMap(s => s.findings).map(f => ({ start: f.start, end: f.end, type: f.type, detector: f.detector, action: f.action }));

async function cliStream(binary, text) {
  const child = spawn(binary, ['--json'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', d => { stdout += d; });
  const done = new Promise((resolve, reject) => {
    child.on('close', code => (code === 0 || code === 1 ? resolve(code) : reject(new Error(`cli-exit-${code}`))));
    child.on('error', reject);
  });
  const buf = Buffer.from(text, 'utf8');
  for (let i = 0; i < buf.length; i += CHUNK) {
    if (!child.stdin.write(buf.subarray(i, i + CHUNK))) await new Promise(r => child.stdin.once('drain', r));
    await new Promise(r => setImmediate(r));
  }
  child.stdin.end();
  await done;
  return cliFindings(JSON.parse(stdout));
}

async function cliSurface(binary, scratch) {
  const version = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim().replace(/^redact-secret\s+/, '');
  const out = {};
  for (const kase of cases) {
    const file = path.join(scratch, 'case.txt');
    writeFileSync(file, kase.text);
    let whole;
    try { whole = JSON.parse(execFileSync(binary, ['--json', file], { encoding: 'utf8' })); } catch (error) { if (error.status === 1 && error.stdout) whole = JSON.parse(error.stdout); else throw error; }
    out[kase.id] = { whole: { findings: cliFindings(whole) }, stream: { findings: await cliStream(binary, kase.text) } };
  }
  return { version, rangeUnit: 'utf8-bytes', cases: out };
}

const { values } = parseArgs({ options: { label: { type: 'string' }, out: { type: 'string', default: `results-output/focused-measurement-${Date.now()}.json` }, 'node-root': { type: 'string' }, 'wasm-dir': { type: 'string' }, python: { type: 'string' }, cli: { type: 'string' }, 'source-commit': { type: 'string' }, corpus: { type: 'string' }, chunk: { type: 'string' } } });
if (values.chunk) CHUNK = Number(values.chunk);
const corpusModule = await import(pathToFileURL(path.resolve(here, values.corpus ?? '../benchmarks/corpora/provider-shapes/corpus.mjs')).href);
cases = corpusModule.cases;
const { corpusDigest, CORPUS_VERSION } = corpusModule;
if (!values.label || !values.out) { console.error('usage: measure-focused-corpus.mjs --label <published|candidate> --out <file> [--node-root D] [--wasm-dir D] [--python P] [--cli B]'); process.exit(2); }
if (!/^[a-f0-9]{40}$/.test(values['source-commit'] ?? '')) throw new Error('--source-commit requires the exact 40-hex measured product commit');
if (!Number.isSafeInteger(CHUNK) || CHUNK < 1) throw new Error('--chunk must be a positive integer');
if (!['published', 'candidate'].includes(values.label)) throw new Error('--label must be published or candidate');
values.out = measurementOutput(values.out, path.resolve(here, '..'));
const scratch = mkdtempSync(path.join(tmpdir(), 'focused-corpus-'));
try {
  const surfaces = {};
  if (values['node-root']) surfaces.node = await nodeSurface(values['node-root']);
  if (values['wasm-dir']) surfaces.wasm = await wasmSurface(values['wasm-dir']);
  if (values.python) surfaces.python = pythonSurface(values.python, scratch);
  if (values.cli) surfaces.cli = await cliSurface(values.cli, scratch);
  const record = {
    schema: corpusModule.SCHEMA ?? 'batch1-observations-v1',
    issue: corpusModule.ISSUE ?? 717,
    producer: { command: 'measure-focused-corpus', corpusModule: path.relative(path.resolve(here, '..'), fileURLToPath(pathToFileURL(path.resolve(here, values.corpus ?? '../benchmarks/corpora/provider-shapes/corpus.mjs')))), corpusModuleSha256: createHash('sha256').update(readFileSync(path.resolve(here, values.corpus ?? '../benchmarks/corpora/provider-shapes/corpus.mjs'))).digest('hex') },
    corpus: { version: CORPUS_VERSION, sha256: corpusDigest(), cases: cases.length },
    label: values.label,
    sourceCommit: values['source-commit'] ?? null,
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    chunkBytes: CHUNK,
    surfaces,
  };
  if (!Object.keys(surfaces).length) throw new Error('At least one explicit product binding is required');
  writeMeasurement(values.out, `${JSON.stringify(record)}\n`);
  console.log(`${values.label}: ${Object.keys(surfaces).join(', ')} -> ${values.out} (${createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 12)})`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
