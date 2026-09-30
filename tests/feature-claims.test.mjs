// benchmarks/feature-claims.json (#564): what each peer library's own documentation says it can do.
// This file checks the record (shape, sources, freshness against the pinned peers, no ranking words)
// and runs one probe for every cell marked `tested: true`, so a "tested" chip always has a test behind
// it. It never asserts product output: the probes check the claims the libraries make about themselves.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { featureClaimsProblem } from '../web/services/features.ts';
import * as redactSecret from '@redact-secret/core';
import { redact as flareRedact, scan as flareScan } from 'flare-redact';
import { redactStream } from 'flare-redact/stream';
import { OpenRedaction } from '@openredaction/core';

const root = new URL('../', import.meta.url).pathname;
const claims = JSON.parse(await readFile(new URL('../benchmarks/feature-claims.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const cells = claims.groups.flatMap(g => g.rows.flatMap(r => Object.entries(r.cells).map(([lib, cell]) => ({ row: r, lib, cell }))));

// ---- The record ------------------------------------------------------------------------------

test('the claims file validates with the validator the web service uses', () => {
  assert.equal(featureClaimsProblem(claims), null);
});

test('every library column names the exact peer version this repository pins', () => {
  const [rs, flare, open] = ['redact-secret', 'flare-redact', 'openredaction'].map(id => claims.libraries.find(l => l.id === id));
  assert.deepEqual(claims.libraries.map(l => l.id), ['redact-secret', 'flare-redact', 'openredaction'], 'same order as the runtime page');
  for (const l of [rs, flare, open]) {
    assert.equal(pkg.dependencies?.[l.package] ?? pkg.devDependencies?.[l.package] ?? pkg.optionalDependencies?.[l.package] ?? pkg.peerDependencies?.[l.package] ?? pkg.overrides?.[l.package], l.version, `${l.package} in package.json must equal the column version: re-read the docs when a peer is bumped`);
  }
});

test('the docs were read on a real date, not in the future', () => {
  assert.ok(new Date(`${claims.readOn}T00:00:00Z`) <= new Date(), claims.readOn);
});

test('every mark cites a page of the project\'s own docs at the version read', () => {
  const versionOf = Object.fromEntries(claims.libraries.map(l => [l.id, l.version]));
  for (const { row, lib, cell } of cells) {
    assert.equal(cell.source.kind, 'doc', `${row.id}/${lib}`);
    assert.ok(cell.source.ref.includes(versionOf[lib]), `${row.id}/${lib}: ${cell.source.ref} must be pinned to ${versionOf[lib]}`);
  }
  for (const l of claims.libraries) for (const ref of l.facts.sources) assert.ok(ref.includes(l.version), `${l.id} facts: ${ref}`);
});

test('every library has a cell in every row, in the same order as the columns', () => {
  for (const g of claims.groups) for (const r of g.rows) assert.deepEqual(Object.keys(r.cells), claims.libraries.map(l => l.id), r.id);
});

test('no row, note or source ranks a library', () => {
  const words = /better|best|worse|worst|lacks|missing|winner|score|superior|inferior/i;
  const text = [];
  for (const g of claims.groups) { text.push(g.label); for (const r of g.rows) { text.push(r.label); for (const c of Object.values(r.cells)) text.push(c.note ?? ''); } }
  for (const s of claims.sources) text.push(s.name, s.detail);
  for (const t of text) assert.doesNotMatch(t, words, t);
});

test('install sizes are the sizes npm reports for the exact versions, checked against the files installed here', async () => {
  // `unpackedSize` from `npm pack --dry-run --json` is the sum of the published files' bytes. The peers are installed
  // at the pinned versions, so each single-package figure can be re-derived offline.
  const single = { 'flare-redact': 'flare-redact', openredaction: '@openredaction/core', 'redact-secret': '@redact-secret/core' };
  for (const l of claims.libraries) {
    const p = l.facts.install.packages.find(x => x.name === single[l.id]);
    assert.ok(p, l.id);
    assert.equal(p.version, l.version);
    assert.ok(p.packedBytes > 0 && p.packedBytes < p.unpackedBytes * 1.5, `${p.name} packed size is plausible`);
    let total = 0;
    const walk = async dir => { for (const e of await readdir(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) await walk(f); else total += (await stat(f)).size; } };
    const dir = path.join(root, 'node_modules', p.name);
    await walk(dir);
    assert.equal(total, p.unpackedBytes, `${p.name}: files on disk`);
  }
});

// ---- One probe per `tested` cell ---------------------------------------------------------------

const SECRET = 'API_KEY=SYNTHETIC_REVOKED_VALUE';
const TOKEN = `ghp_${'a'.repeat(36)}`;
const PII = 'Email john.smith@acme-corp.org today';
const LIMITS = { maxInputCodeUnits: 32768, maxBufferedCodeUnits: 16512, maxTokenCodeUnits: 8192, maxMultilineCodeUnits: 16384 };

await redactSecret.initialize();

async function flareStreamed(chunks) {
  let out = '';
  const sink = new (await import('node:stream')).Writable({ write(c, _e, done) { out += c; done(); } });
  await pipeline(Readable.from(chunks), redactStream(), sink);
  return out;
}

const PROBES = {
  'node.redact-secret': () => {
    assert.match(process.versions.node, /^(22|24)\./, 'this repository runs Node 22 or 24; the docs list 20, 22 and 24');
    assert.equal(redactSecret.scanAndRedact(SECRET).text, 'API_KEY=<SECRET_1>');
    assert.ok(['addon', 'wasm'].includes(redactSecret.artifact()), 'the loaded artifact is the add-on or the WebAssembly fallback');
  },
  'node.flare-redact': () => assert.equal(flareRedact('bob@corp.com'), 'b***@***'),
  'node.openredaction': async () => {
    const result = await new OpenRedaction().detect(PII);
    assert.match(result.redacted, /\[EMAIL_\d+\]/);
  },
  'sync.redact-secret': () => {
    const result = redactSecret.scanAndRedact(SECRET);
    assert.equal(typeof result.then, 'undefined');
    assert.equal(typeof result.text, 'string');
  },
  'sync.flare-redact': () => {
    const result = flareRedact(`x ${TOKEN}`);
    assert.equal(typeof result, 'string');
  },
  'sync.openredaction': () => {
    const call = new OpenRedaction().detect(PII);
    assert.ok(call instanceof Promise, 'detect() returns a Promise');
    return call;
  },
  'look.redact-secret': () => assert.match(redactSecret.scanAndRedact(SECRET).text, /=<SECRET_1>$/),
  'look.flare-redact': () => assert.equal(flareRedact('bob@corp.com'), 'b***@***'),
  'look.openredaction': async () => {
    const result = await new OpenRedaction().detect(PII);
    const placeholders = result.detections.map(d => d.placeholder);
    assert.ok(placeholders.length > 0 && placeholders.every(p => /^\[[A-Z_]+_\d+\]$/.test(p)), placeholders.join(','));
    assert.match('[EMAIL_9619]', /^\[[A-Z_]+_\d+\]$/, 'the documented example has the same shape');
  },
  'leak.redact-secret': () => {
    const { findings } = redactSecret.scanAndRedact(SECRET);
    assert.ok(findings.length > 0);
    assert.equal(JSON.stringify(findings).includes('SYNTHETIC_REVOKED_VALUE'), false);
    for (const f of findings) assert.deepEqual(Object.keys(f).sort(), ['action', 'confidence', 'detector', 'end', 'id', 'obfuscation', 'start', 'type']);
  },
  'leak.flare-redact': () => {
    const findings = flareScan(`mail bob@corp.com token ${TOKEN}`);
    assert.ok(findings.length >= 2);
    const json = JSON.stringify(findings);
    assert.equal(json.includes('bob@corp.com') || json.includes(TOKEN), false);
  },
  'leak.openredaction': async () => {
    const result = await new OpenRedaction().detect(PII);
    assert.equal(result.original, PII, 'the result carries the original text');
    assert.ok(Object.values(result.redactionMap).includes('john.smith@acme-corp.org'), 'and a map back to each value');
  },
  'browser.openredaction': async () => {
    const dir = path.join(root, 'node_modules/@openredaction/core/dist');
    const main = await readFile(path.join(dir, 'index.mjs'), 'utf8');
    const lite = await readFile(path.join(dir, 'lite.mjs'), 'utf8');
    const builtins = ['fs', 'path', 'stream', 'crypto', 'node:worker_threads'];
    for (const b of builtins) assert.ok(main.includes(`from "${b}"`), `main entry imports ${b}`);
    assert.equal(/from\s+["'](node:)?(fs|path|stream|crypto|os|worker_threads)["']/.test(lite), false, 'the lite entry imports no Node built-in');
  },
  'chunks.redact-secret': () => {
    const whole = redactSecret.scanAndRedact('api_key=SYNTHETIC_REVOKED_INCREMENTAL_VALUE\nordinary text').text;
    const session = redactSecret.createIncrementalSanitizer({ limits: LIMITS });
    const pieces = [session.append('api_key=SYNTHETIC_REVOKED_'), session.append('INCREMENTAL_VALUE\nordinary'), session.append(' text'), session.finalize()];
    assert.equal(pieces.map(p => p.text).join(''), whole);
  },
  'chunks.flare-redact': async () => {
    const out = await flareStreamed([`key ${TOKEN.slice(0, 20)}`, `${TOKEN.slice(20)}\n`]);
    assert.equal(out, 'key ghp_***\n');
  },
};

const testedCells = cells.filter(c => c.cell.tested);

test('every `tested` cell names a probe that exists, and every probe backs a `tested` cell', () => {
  assert.deepEqual(testedCells.map(c => c.cell.test).sort(), Object.keys(PROBES).sort());
  for (const { row, lib, cell } of testedCells) assert.equal(cell.test, `${row.id}.${lib}`);
});

for (const id of Object.keys(PROBES)) test(`tested claim: ${id}`, PROBES[id]);
