import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonlPartWriter, partRefProblem, readJsonlPart, sha256Of } from '../benchmarks/evaluation/storage/parts.ts';
import { discoveryManifestProblem, materializeDiscovery, openDiscovery, writeDiscoveryStore } from '../benchmarks/evaluation/storage/discovery-store.ts';
import { exitCode } from '../benchmarks/evaluation/domains/credential/runner.ts';

// Synthetic only: no real credential, no scanner run (#787; contract: docs/specs/evaluation-report-storage.md).
const temporary = async () => mkdtemp(path.join(tmpdir(), 'discovery-store-'));
const collect = async iterable => { const out = []; for await (const item of iterable) out.push(item); return out; };
const record = (i, pad = 0) => ({ id: `case-${String(i).padStart(6, '0')}`, method: ['twin', 'benign', 'mutation'][i % 3], variants: [{ id: `v${i}`, note: 'x'.repeat(pad) }], scanners: [{ scanner: 'redact-secret', status: 'complete' }] });
const report = (counts = {}, extra = {}) => ({ schemaVersion: 3, accountingVersion: '1.1', mode: 'discovery', runId: 'run-synthetic-1', startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z',
  scanners: [{ id: 'redact-secret', status: 'complete' }], caseCount: counts.results ?? 0, variantCount: counts.results ?? 0, generationErrors: [], review: { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null },
  results: Array.from({ length: counts.results ?? 0 }, (_, i) => record(i, counts.pad ?? 0)),
  failures: Array.from({ length: counts.failures ?? 0 }, (_, i) => ({ id: `fail-${i}`, scanner: 'redact-secret', type: 'recall' })),
  reviewQueue: Array.from({ length: counts.reviewQueue ?? 0 }, (_, i) => ({ id: `rq-${i}`, caseId: `case-${String(i).padStart(6, '0')}`, variant: `v${i}` })), ...extra });
const partFiles = async dir => (await readdir(dir)).filter(f => /\.jsonl$/.test(f));

test('round trip: the materialized store equals the logical report, field order and all', async () => {
  const dir = await temporary();
  const original = report({ results: 120, failures: 40, reviewQueue: 17, pad: 300 });
  const manifest = await writeDiscoveryStore(path.join(dir, 'evaluation'), original, { maxPartBytes: 4096 });
  const reader = await openDiscovery(path.join(dir, 'evaluation'));
  assert.equal(reader.kind, 'store');
  assert.deepEqual(reader.totals, { results: 120, failures: 40, reviewQueue: 17 });
  const restored = await materializeDiscovery(reader);
  assert.deepEqual(restored, original);
  assert.equal(JSON.stringify(restored.results.map(r => r.id)), JSON.stringify(original.results.map(r => r.id)), 'order is preserved');
  assert.equal(discoveryManifestProblem(manifest), null);
  assert.ok(manifest.parts.results.length > 1, 'the lists really are split');
});

test('chunk boundaries: no part exceeds the limit, no record is split, the counts add up', async () => {
  const dir = await temporary();
  const limit = 2048;
  const original = report({ results: 300, pad: 37 });
  const manifest = await writeDiscoveryStore(path.join(dir, 's'), original, { maxPartBytes: limit });
  for (const ref of manifest.parts.results) {
    assert.ok(ref.bytes <= limit, `${ref.path} is ${ref.bytes}`);
    assert.equal(ref.oversized, undefined);
    const text = await readFile(path.join(dir, 's', ref.path), 'utf8');
    assert.ok(text.endsWith('\n'));
    const lines = text.split('\n').slice(0, -1);
    assert.equal(lines.length, ref.records);
    for (const line of lines) JSON.parse(line); // every line is a whole record
    assert.equal(sha256Of(text), ref.sha256);
  }
  assert.equal(manifest.parts.results.reduce((n, p) => n + p.records, 0), 300);
  assert.ok(manifest.maxChunkBytes <= limit);
});

test('a record that lands exactly on the limit fits; one byte more starts a new part', async () => {
  const dir = await temporary();
  const writer = new JsonlPartWriter(dir, 'results', 1024);
  const sizeOf = pad => Buffer.byteLength(`${JSON.stringify({ pad })}\n`);
  const exact = 'a'.repeat(1024 - sizeOf(''));
  assert.equal(sizeOf(exact), 1024);
  await writer.append({ pad: exact });
  await writer.append({ pad: '' });
  const parts = await writer.close();
  assert.equal(parts.length, 2);
  assert.equal(parts[0].bytes, 1024);
  assert.equal(parts[0].oversized, undefined, 'a record equal to the limit is not oversized');
  assert.equal(parts[1].records, 1);
});

test('an oversized single record is stored whole in its own part, never cut or dropped', async () => {
  const dir = await temporary();
  const big = { id: 'case-big', blob: 'é𝒳'.repeat(3000) };
  const original = report({ results: 6, pad: 10 });
  original.results.splice(3, 0, big);
  original.caseCount = original.variantCount = 7;
  const manifest = await writeDiscoveryStore(path.join(dir, 's'), original, { maxPartBytes: 2048 });
  const alone = manifest.parts.results.filter(p => p.oversized);
  assert.equal(alone.length, 1);
  assert.equal(alone[0].records, 1);
  assert.ok(alone[0].bytes > 2048);
  assert.equal(discoveryManifestProblem(manifest), null);
  const restored = await materializeDiscovery(await openDiscovery(path.join(dir, 's')));
  assert.deepEqual(restored.results.map(r => r.id), original.results.map(r => r.id));
  assert.deepEqual(restored.results[3], big);
  // an oversized part that claims several records is refused
  const lying = structuredClone(manifest);
  lying.parts.results.find(p => p.oversized).records = 2; lying.totals.results += 1;
  assert.match(discoveryManifestProblem(lying), /oversized|holds/);
  const unmarked = structuredClone(manifest);
  delete unmarked.parts.results.find(p => p.oversized).oversized;
  assert.match(discoveryManifestProblem(unmarked), /exceeds the part limit/);
});

test('Unicode survives: astral characters, line separators, combining marks, lone newlines inside strings', async () => {
  const dir = await temporary();
  const text = ['🔑 key', 'line separator here', 'é combined', 'CRLF\r\nand\nLF\rinside', 'zero​width', '한국어 日本語', '\u0000nul'];
  const original = report({ results: 4 }, { scope: text.join('|') });
  original.results = text.map((t, i) => ({ ...record(i), text: t }));
  original.caseCount = original.variantCount = text.length;
  await writeDiscoveryStore(path.join(dir, 's'), original, { maxPartBytes: 1024 });
  const restored = await materializeDiscovery(await openDiscovery(path.join(dir, 's')));
  assert.deepEqual(restored, original);
  for (const [i, t] of text.entries()) assert.equal(restored.results[i].text, t);
});

test('failed-scanner reports round trip with identical exit behaviour', async () => {
  const dir = await temporary();
  const failed = report({ results: 9, failures: 5 }, { scanners: [{ id: 'redact-secret', status: 'complete' }, { id: 'peer', status: 'error' }, { id: 'other', status: 'unavailable' }] });
  const generation = report({ results: 3 }, { generationErrors: [{ id: 'case-000001', message: 'unsupported operator' }] });
  const clean = report({ results: 3 });
  for (const [name, original] of Object.entries({ failed, generation, clean })) {
    const location = path.join(dir, name);
    await writeDiscoveryStore(location, original, { maxPartBytes: 1024 });
    const restored = await materializeDiscovery(await openDiscovery(location));
    assert.deepEqual(restored, original, name);
    for (const flags of [{}, { strict: true }, { failOnAssertions: true }, { strict: true, failOnAssertions: true }]) assert.equal(exitCode(restored, flags), exitCode(original, flags), `${name} ${JSON.stringify(flags)}`);
  }
  assert.equal(exitCode(failed), 1, 'an errored scanner fails the run');
  assert.equal(exitCode(clean), 0);
  assert.equal(exitCode(clean, { failOnAssertions: true }), 0);
  const withFailures = report({ results: 3, failures: 2 });
  assert.equal(exitCode(withFailures), 0);
  assert.equal(exitCode(withFailures, { failOnAssertions: true }), 1);
  const unavailable = report({ results: 3 }, { scanners: [{ id: 'redact-secret', status: 'unavailable' }] });
  assert.equal(exitCode(unavailable), 0);
  assert.equal(exitCode(unavailable, { strict: true }), 1);
});

test('empty lists are valid and distinct from a missing store', async () => {
  const dir = await temporary();
  const original = report();
  const manifest = await writeDiscoveryStore(path.join(dir, 's'), original);
  assert.deepEqual(manifest.parts, { results: [], failures: [], reviewQueue: [] });
  assert.deepEqual(await materializeDiscovery(await openDiscovery(path.join(dir, 's'))), original);
  await assert.rejects(openDiscovery(path.join(dir, 'absent')));
});

test('an interrupted write leaves no manifest: the reader refuses and staging is cleaned', async () => {
  const dir = await temporary();
  const location = path.join(dir, 'evaluation');
  const original = report({ results: 20 });
  // a record that cannot be serialised aborts the write after earlier parts were already written
  original.failures = [{ id: 'ok' }, { id: 'circular' }];
  original.failures[1].self = original.failures[1];
  await assert.rejects(writeDiscoveryStore(location, original, { maxPartBytes: 1024 }));
  assert.deepEqual((await readdir(dir)).sort(), [], 'no store and no staging directory remain');
  await assert.rejects(openDiscovery(location));
  // a store that has parts but lost its manifest is refused with the incomplete message
  await writeDiscoveryStore(location, report({ results: 5 }), { maxPartBytes: 1024 });
  await rm(path.join(location, 'manifest.json'));
  await assert.rejects(openDiscovery(location), /no manifest\.json: the discovery store is incomplete/);
});

test('an interrupted rewrite keeps the previous complete store', async () => {
  const dir = await temporary();
  const location = path.join(dir, 'evaluation');
  const first = report({ results: 8 });
  await writeDiscoveryStore(location, first, { maxPartBytes: 1024 });
  const second = report({ results: 8 }, { runId: 'run-synthetic-2' });
  second.reviewQueue = [{ id: 'bad' }]; second.reviewQueue[0].self = second.reviewQueue[0];
  await assert.rejects(writeDiscoveryStore(location, second, { maxPartBytes: 1024 }));
  assert.deepEqual((await materializeDiscovery(await openDiscovery(location))).runId, 'run-synthetic-1');
  assert.deepEqual((await readdir(dir)).sort(), ['evaluation']);
  // a successful rewrite replaces it and leaves nothing behind
  await writeDiscoveryStore(location, report({ results: 2 }, { runId: 'run-synthetic-3' }), { maxPartBytes: 1024 });
  assert.equal((await materializeDiscovery(await openDiscovery(location))).runId, 'run-synthetic-3');
  assert.deepEqual((await readdir(dir)).sort(), ['evaluation']);
});

test('tampering with a part is detected: digest, size, record count, deletion, duplicate listing', async () => {
  const build = async () => {
    const dir = await temporary(), location = path.join(dir, 's');
    const manifest = await writeDiscoveryStore(location, report({ results: 40, failures: 12, reviewQueue: 6, pad: 50 }), { maxPartBytes: 2048 });
    return { location, manifest };
  };
  const readAll = async location => materializeDiscovery(await openDiscovery(location));
  const rewriteManifest = async (location, edit) => { const m = JSON.parse(await readFile(path.join(location, 'manifest.json'), 'utf8')); edit(m); await writeFile(path.join(location, 'manifest.json'), JSON.stringify(m)); };

  { // same size, different bytes: the digest catches it
    const { location, manifest } = await build();
    const file = path.join(location, manifest.parts.results[0].path);
    const text = await readFile(file, 'utf8');
    await writeFile(file, text.replace('case-', 'kase-'));
    assert.equal((await stat(file)).size, manifest.parts.results[0].bytes);
    await assert.rejects(readAll(location), /does not match its recorded digest/);
  }
  { // size changed
    const { location, manifest } = await build();
    await appendFile(path.join(location, manifest.parts.failures[0].path), '\n');
    await assert.rejects(readAll(location), /manifest records/);
  }
  { // a record removed with the manifest's size and digest made to agree still fails the record count
    const { location, manifest } = await build();
    const ref = manifest.parts.reviewQueue[0], file = path.join(location, ref.path);
    const lines = (await readFile(file, 'utf8')).split('\n').slice(0, -1);
    const shorter = `${lines.slice(1).join('\n')}\n`;
    await writeFile(file, shorter);
    await rewriteManifest(location, m => { m.parts.reviewQueue[0].bytes = Buffer.byteLength(shorter); m.parts.reviewQueue[0].sha256 = sha256Of(shorter); });
    await assert.rejects(readAll(location), /holds \d+ records, the manifest records/);
  }
  { // a deleted part
    const { location, manifest } = await build();
    await rm(path.join(location, manifest.parts.results[1].path));
    await assert.rejects(readAll(location));
  }
  { // totals that do not match the parts
    const { location } = await build();
    await rewriteManifest(location, m => { m.totals.results += 1; });
    await assert.rejects(openDiscovery(location), /parts hold/);
  }
  { // the same part listed twice
    const { location } = await build();
    await rewriteManifest(location, m => { m.parts.failures.push(m.parts.results[0]); m.totals.failures += m.parts.results[0].records; });
    await assert.rejects(openDiscovery(location), /listed twice/);
  }
  { // a part path that leaves the directory
    const { location } = await build();
    for (const bad of ['../x.jsonl', '/etc/passwd', 'a//b.jsonl', './x.jsonl', 'a/../b.jsonl', '']) {
      await rewriteManifest(location, m => { m.parts.results[0].path = bad; });
      await assert.rejects(readAll(location), /plain relative path/, bad);
    }
    assert.match(partRefProblem({ path: '..', sha256: 'a'.repeat(64), bytes: 1, records: 1 }), /plain relative path/);
  }
  { // a header that was altered
    const { location } = await build();
    const file = path.join(location, 'header.json');
    await writeFile(file, (await readFile(file, 'utf8')).replace('run-synthetic-1', 'run-synthetic-9'));
    await assert.rejects(readAll(location), /manifest records|digest/);
  }
  { // an unsupported manifest
    const { location } = await build();
    await rewriteManifest(location, m => { m.schema = 'something-else'; });
    await assert.rejects(openDiscovery(location), /Unsupported discovery store manifest/);
  }
});

test('a large synthetic report exceeds a lowered whole-string limit while every unit stays bounded', async () => {
  const dir = await temporary();
  const WHOLE_STRING_LIMIT = 256 * 1024; // stands in for V8's 536,870,888-character limit
  const PART = 16 * 1024;
  const original = report({ results: 2500, failures: 1500, reviewQueue: 800, pad: 120 });
  assert.ok(JSON.stringify(original, null, 2).length > 4 * WHOLE_STRING_LIMIT, 'the whole document would not fit the lowered limit');
  const location = path.join(dir, 's');
  const manifest = await writeDiscoveryStore(location, original, { maxPartBytes: PART });
  const files = await readdir(location);
  for (const file of files) assert.ok((await stat(path.join(location, file))).size <= PART, `${file} stays within the part limit`);
  assert.ok(manifest.maxChunkBytes <= PART);
  assert.ok(manifest.parts.results.length >= 20);
  // streaming read: one record at a time, never the whole list, and the digests check out at the end
  const reader = await openDiscovery(location);
  let n = 0, last = '';
  for await (const r of reader.results()) { assert.ok(r.id > last); last = r.id; n += 1; }
  assert.equal(n, 2500);
  assert.equal((await collect(reader.failures())).length, 1500);
  assert.equal((await collect(reader.reviewQueue())).length, 800);
  assert.equal(JSON.stringify(await reader.header()).length < WHOLE_STRING_LIMIT, true);
});

test('writing respects backpressure: no write is left buffered after an append returns', async () => {
  const dir = await temporary();
  const writer = new JsonlPartWriter(dir, 'results', 4 * 1024 * 1024);
  const heavy = { id: 'x', blob: 'z'.repeat(256 * 1024) }; // larger than the stream's 16 KiB high-water mark
  for (let i = 0; i < 12; i++) {
    await writer.append({ ...heavy, i });
    assert.equal(writer.stream.writableLength, 0, 'append awaited drain before returning');
  }
  const parts = await writer.close();
  assert.equal(parts.reduce((n, p) => n + p.records, 0), 12);
  assert.ok(writer.maxChunkBytes < 300 * 1024);
  const back = [];
  for (const ref of parts) for await (const r of readJsonlPart(dir, ref)) back.push(r.i);
  assert.deepEqual(back, Array.from({ length: 12 }, (_, i) => i));
});

test('the writer refuses unusable configuration and never overwrites an existing part', async () => {
  const dir = await temporary();
  assert.throws(() => new JsonlPartWriter(dir, 'Bad Role', 4096));
  assert.throws(() => new JsonlPartWriter(dir, 'ok', 10));
  assert.throws(() => new JsonlPartWriter(dir, 'ok', 4096.5));
  const first = new JsonlPartWriter(dir, 'results', 4096);
  await first.append({ a: 1 }); await first.close();
  const second = new JsonlPartWriter(dir, 'results', 4096);
  // the open failure surfaces by close() at the latest (and never hangs or crashes the process)
  await assert.rejects(async () => { await second.append({ a: 2 }); await second.close(); }, /EEXIST/);
});

test('a legacy single-file report reads through the same interface and never runs a scanner', async () => {
  const dir = await temporary();
  const original = report({ results: 7, failures: 2, reviewQueue: 1 });
  const file = path.join(dir, 'evaluation.json');
  await writeFile(file, `${JSON.stringify(original, null, 2)}\n`);
  const reader = await openDiscovery(file);
  assert.equal(reader.kind, 'legacy-file');
  assert.deepEqual(reader.totals, { results: 7, failures: 2, reviewQueue: 1 });
  assert.deepEqual(await materializeDiscovery(reader), original);
  // the store written from it is equal again
  await writeDiscoveryStore(path.join(dir, 'store'), await materializeDiscovery(reader), { maxPartBytes: 1024 });
  assert.deepEqual(await materializeDiscovery(await openDiscovery(path.join(dir, 'store'))), original);
});
