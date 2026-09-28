#!/usr/bin/env node
/**
 * Measures what the documented browser quickstart fetches, for the
 * `size/browser-bundle/quickstart/gzip` budget row (redact-secret#937).
 *
 *   node scripts/measure-quickstart-bundle.mjs --core <core checkout> --source-commit <40-hex>
 *        --out <quickstart-bundle.json> [--markdown-out <file>] [--work-dir <dir>]
 *
 * In the candidate checkout the performance job already built (addon, both
 * WebAssembly profiles with their pii variants, `js:build`), it:
 *
 *  1. packs the npm candidate with core's own `scripts/pack-npm-candidate.mjs`,
 *     from those build outputs (nothing is rebuilt);
 *  2. reads the quickstart's browser lane from core's `docs/quickstart.md` at
 *     that commit (`qualify=browser:file:*`, the `vite@<version>` in its setup
 *     block, and the expected page text), installs the packed tarballs and
 *     that bundler version into an empty project, and runs `vite build`;
 *  3. serves the build output, loads it in Chromium (core's own Playwright,
 *     already installed for the assessment), waits for the page, checks its
 *     text against the documented expectation, and records every file the
 *     server was asked for.
 *
 * `fetched` is what a default quickstart downloads. Assets the bundler emits
 * for a lazily loaded module that a default `initialize()` never imports
 * (the #937 pii builds) are still listed, with `fetched: false`, and counted
 * in the `emitted` total, which is reported as a diagnostic and never
 * budgeted. gzip is level 9, the method of the #141 operational evidence.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json' };

/** The quickstart's browser lane: its files, bundler version, and expected page text. */
export function browserLane(markdown) {
  const files = [];
  let setup, expect;
  for (const match of markdown.matchAll(/```[A-Za-z]* qualify=browser:([^\s`]+)\n([\s\S]*?)\n```/g)) {
    const [, role, body] = match;
    if (role.startsWith('file:')) files.push({ name: role.slice(5), content: `${body}\n` });
    else if (role === 'setup') setup = body;
    else if (role === 'expect') expect = body;
  }
  const vite = setup?.match(/\bvite@([0-9][^\s]*)/)?.[1];
  if (files.length === 0 || expect === undefined || vite === undefined) {
    throw new Error('measure-quickstart-bundle: docs/quickstart.md has no complete browser lane (file blocks, setup with vite@<version>, expect)');
  }
  for (const { name } of files) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error(`measure-quickstart-bundle: unsafe quickstart file name ${name}`);
  }
  return { files, vite, expect: expect.trim() };
}

/** A bundler asset name with its content hash replaced, so rows compare across builds. */
export function normalizeAsset(file) {
  return file.replace(/-[A-Za-z0-9_-]{8}(?=\.[A-Za-z0-9]+$)/, '-<hash>');
}

/** Every emitted file, with whether the page requested it, and both totals. */
export function bundleFiles(entries, requested) {
  const files = entries.map(({ file, bytes }) => ({
    file: normalizeAsset(file), kind: path.extname(file).slice(1), bytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length, fetched: requested.has(file),
  })).sort((a, b) => a.file.localeCompare(b.file));
  const total = rows => ({ bytes: rows.reduce((s, f) => s + f.bytes, 0), gzipBytes: rows.reduce((s, f) => s + f.gzipBytes, 0) });
  return { files, totals: { fetched: total(files.filter(f => f.fetched)), emitted: total(files) } };
}

export function renderMarkdown(evidence) {
  return [
    '## Quickstart browser bundle (candidate build)',
    '',
    `Core \`${evidence.sourceCommit}\`, ${evidence.tool}. \`size/browser-bundle/quickstart/gzip\` is the fetched total; the emitted total is a diagnostic, not budgeted.`,
    '',
    '| File | Fetched | bytes | gzip |',
    '| --- | --- | ---: | ---: |',
    ...evidence.files.map(f => `| \`${f.file}\` | ${f.fetched ? 'yes' : 'no (lazy)'} | ${f.bytes} | ${f.gzipBytes} |`),
    `| **fetched** | | ${evidence.totals.fetched.bytes} | ${evidence.totals.fetched.gzipBytes} |`,
    `| emitted (diagnostic) | | ${evidence.totals.emitted.bytes} | ${evidence.totals.emitted.gzipBytes} |`,
    '',
  ].join('\n');
}

function walk(root, dir = '') {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(root, rel) : entry.isFile() ? [{ file: rel, bytes: readFileSync(path.join(root, rel)) }] : [];
  });
}

/** Serves `root`, recording each file it was asked for. */
async function serve(root, requested) {
  const files = new Map(walk(root).map(f => [f.file, f.bytes]));
  const server = createServer((request, response) => {
    let file = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '');
    if (file === '') file = 'index.html';
    const bytes = files.get(file);
    if (bytes === undefined) { response.writeHead(404).end(); return; }
    requested.add(file);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`measure-quickstart-bundle: bad argument ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of ['core', 'source-commit', 'out']) if (!args[key]) throw new Error(`measure-quickstart-bundle: --${key} is required`);
  if (!/^[0-9a-f]{40}$/.test(args['source-commit'])) throw new Error('measure-quickstart-bundle: --source-commit must be 40 hex');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const core = path.resolve(args.core);
  const head = execFileSync('git', ['-C', core, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== args['source-commit']) throw new Error(`measure-quickstart-bundle: ${core} is at ${head}, not the candidate ${args['source-commit']}`);
  const lane = browserLane(readFileSync(path.join(core, 'docs/quickstart.md'), 'utf8'));

  const work = path.resolve(args['work-dir'] ?? mkdtempSync(path.join(tmpdir(), 'quickstart-bundle-')));
  const candidate = path.join(work, 'candidate');
  const project = path.join(work, 'project');
  mkdirSync(project, { recursive: true });
  const run = (command, argv, cwd) => execFileSync(command, argv, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
  run(process.execPath, ['scripts/pack-npm-candidate.mjs', '--addon-dir', 'bindings/node', '--wasm-dir', 'bindings/wasm/pkg',
    '--wasm-common-dir', 'bindings/wasm/pkg-common', '--out-dir', candidate], core);
  const tarballs = readdirSync(candidate).filter(name => name.endsWith('.tgz')).map(name => path.join(candidate, name));
  writeFileSync(path.join(project, 'package.json'), `${JSON.stringify({ name: 'quickstart-bundle-size', private: true, type: 'module' }, null, 2)}\n`);
  run('npm', ['install', '--no-audit', '--no-fund', ...tarballs, `vite@${lane.vite}`], project);
  for (const { name, content } of lane.files) writeFileSync(path.join(project, name), content);
  run(path.join(project, 'node_modules/.bin/vite'), ['build', '--logLevel', 'warn'], project);

  const dist = path.join(project, 'dist');
  const requested = new Set();
  const server = await serve(dist, requested);
  let pageText;
  const { chromium } = createRequire(path.join(core, 'package.json'))('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#output')?.textContent !== 'loading', null, { timeout: 60_000 });
    await page.waitForLoadState('networkidle');
    pageText = (await page.textContent('#output')).trim();
  } finally {
    await browser.close();
    server.close();
  }
  if (pageText !== lane.expect) {
    throw new Error(`measure-quickstart-bundle: the quickstart page did not render its documented output (got ${JSON.stringify(pageText.split('\n')[0])})`);
  }

  const { files, totals } = bundleFiles(walk(dist), requested);
  const evidence = { schemaVersion: '1', kind: 'quickstart-bundle-sizes', sourceCommit: head, tool: `vite ${lane.vite}`,
    entry: 'docs/quickstart.md browser lane (initialize() + scanAndRedact)', pageText, files, totals };
  mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(evidence, null, 2)}\n`);
  if (args['markdown-out']) writeFileSync(args['markdown-out'], renderMarkdown(evidence));
  console.log(`quickstart: fetched ${totals.fetched.gzipBytes} gzip bytes of ${totals.emitted.gzipBytes} emitted (${files.filter(f => !f.fetched).length} lazy files)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
