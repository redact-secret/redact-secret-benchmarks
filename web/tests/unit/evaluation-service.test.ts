// @vitest-environment node
/**
 * `services/evaluation.ts` decides what the evaluation pages may say: measured (from the bundle, or from the legacy whole file when no
 * bundle pointer exists), not published, unusable, stale. Every file under test is written by the test into a temporary results
 * directory, with the producer's own BundleWriter for bundles, so the committed tree and the run are never read for a figure. The corpus
 * hashes the synthetic report carries are the checkout's own (read through the catalog service), so a test says "stale" by changing one.
 */
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { REAL_ROOT, overlay, real } from './overlay';
import { syntheticReport, withExtraTwins } from './evaluation-data';
import { writeBundle as write } from './evaluation-bundle-data';
import { documentBytes } from '../../../benchmarks/evaluation/storage/parts.ts';

const dirs: string[] = [];
function results(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-results-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); writeFileSync(path.join(dir, name), text); }
  return dir;
}

async function service(options: { dir: string; root?: string }) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', options.root ?? REAL_ROOT);
  vi.stubEnv('WEB_RESULTS_DIR', options.dir);
  return import('../../services/evaluation');
}

/** The synthetic report with this checkout's own corpus hashes, so the contract's staleness check passes. */
async function report(over: Parameters<typeof syntheticReport>[0] = {}) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', REAL_ROOT);
  const { loadCatalogSources } = await import('../../services/catalog');
  const { hashes } = await loadCatalogSources();
  const base = syntheticReport({ corpusHashes: hashes, ...over });
  // The part limit must hold the summary (the checkout's corpus hashes are most of it) and a little more; the twins are padded until their method spans several parts.
  const { cases: _c, reviews: _r, ...summary } = base;
  partLimit = Math.max(4000, Buffer.byteLength(documentBytes({ schema: 'x', role: 'summary', report: summary })) + 400);
  return { hashes, report: withExtraTwins(base, Math.ceil((partLimit * 2.5) / 850)) };
}
let partLimit = 4000;
const writeBundle = (dir: string, r: Parameters<typeof write>[1], hashes?: Record<string, string>, limit = partLimit) => write(dir, r, hashes, limit);

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const bundleDirOf = (dir: string) => path.join(dir, 'evaluation-bundles', readdirSync(path.join(dir, 'evaluation-bundles'))[0]);

describe('loadEvaluation, legacy whole file (no bundle pointer)', () => {
  test('a results directory with nothing is not published, with both files named', async () => {
    const s = await service({ dir: results() });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'not-published', reason: expect.stringContaining('evaluation-bundle-v1.json is absent') });
    vi.resetModules();
    const again = await service({ dir: results() });
    await expect(again.loadEvaluation()).resolves.toMatchObject({ reason: expect.stringContaining('evaluation-v1.json') });
  });

  test('a file that is not JSON is unusable', async () => {
    const s = await service({ dir: results({ 'evaluation-v1.json': '{nope' }) });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'unusable', reason: expect.stringContaining('not valid JSON') });
  });

  test('a file that breaks the contract is unusable, with the contract failure named', async () => {
    const s = await service({ dir: results({ 'evaluation-v1.json': '{}' }) });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'unusable', reason: expect.stringContaining('Unsupported evaluation report version') });
  });

  test('a report of another corpus is stale, not unusable and never measured', async () => {
    const { report: r } = await report({ corpusHashes: { 'suite-a': 'not-this-checkout' } });
    const s = await service({ dir: results({ 'evaluation-v1.json': JSON.stringify(r) }) });
    await expect(s.loadEvaluation()).resolves.toMatchObject({ state: 'stale', reason: expect.stringContaining('Stale evaluation') });
  });

  test('a valid report is measured as legacy, split into summary and per-method reads, and read once', async () => {
    const { report: r } = await report();
    const s = await service({ dir: results({ 'evaluation-v1.json': JSON.stringify(r) }) });
    const first = await s.loadEvaluation();
    if (first.state !== 'measured') throw new Error(`not measured: ${JSON.stringify(first)}`);
    expect(first.source).toBe('legacy');
    expect(first.report.runId).toBe(r.runId);
    expect(first.report).not.toHaveProperty('cases');
    expect(first.report).not.toHaveProperty('reviews');
    expect(first.caseCounts.twin).toBe(r.cases.filter(c => c.method === 'twin').length);
    expect(first.peerReviews).toBe(r.reviews.filter(x => x.peer).length);
    expect((await first.casesOf('twin')).map(c => c.id)).toEqual(r.cases.filter(c => c.method === 'twin').map(c => c.id));
    expect(await s.loadEvaluation()).toBe(first);
  });

  test('a directory where the file should be is an error, not "absent"', async () => {
    const s = await service({ dir: results({ 'evaluation-v1.json/inside': 'x' }) });
    await expect(s.loadEvaluation()).rejects.toThrow(/unreadable/);
  });
});

describe('loadEvaluation, bundle', () => {
  test('a valid bundle is measured from the bundle, with counts reduced from the validated cases', async () => {
    const { report: r, hashes } = await report();
    const dir = results();
    await writeBundle(dir, r, hashes);
    const s = await service({ dir });
    const load = await s.loadEvaluation();
    if (load.state !== 'measured') throw new Error(`not measured: ${JSON.stringify(load)}`);
    expect(load.source).toBe('bundle');
    expect(load.report.runId).toBe(r.runId);
    expect(load.report).not.toHaveProperty('cases');
    const expected: Record<string, number> = {};
    for (const c of r.cases) expected[c.method] = (expected[c.method] ?? 0) + 1;
    expect(load.caseCounts).toEqual(expected);
    expect(load.peerReviews).toBe(r.reviews.filter(x => x.peer).length);
    expect(await s.loadEvaluation()).toBe(load);
  });

  test('cases are read one method at a time: the other methods parts are never opened', async () => {
    const { report: r, hashes } = await report();
    const dir = results();
    await writeBundle(dir, r, hashes);
    const s = await service({ dir });
    const load = await s.loadEvaluation();
    if (load.state !== 'measured') throw new Error('not measured');
    const cases = path.join(bundleDirOf(dir), 'cases');
    expect(readdirSync(cases).filter(f => f.startsWith('twin-')).length).toBeGreaterThan(1); // the method spans parts
    for (const f of readdirSync(cases)) if (!f.startsWith('twin-')) rmSync(path.join(cases, f));
    expect((await load.casesOf('twin')).map(c => c.id).sort()).toEqual(r.cases.filter(c => c.method === 'twin').map(c => c.id).sort());
    expect(await load.casesOf('holdout')).toEqual([]);
  });

  test('the bundle wins when the legacy file is also present', async () => {
    const { report: r, hashes } = await report();
    const legacy = { ...r, runId: 'ffffffff-0000-4000-8000-000000000000' };
    const dir = results({ 'evaluation-v1.json': JSON.stringify(legacy) });
    await writeBundle(dir, r, hashes);
    const load = await (await service({ dir })).loadEvaluation();
    expect(load).toMatchObject({ state: 'measured', source: 'bundle', report: { runId: r.runId } });
  });

  test('a pointer whose bundle is gone is unusable and does not fall back to the legacy file', async () => {
    const { report: r, hashes } = await report();
    const dir = results({ 'evaluation-v1.json': JSON.stringify(r) });
    await writeBundle(dir, r, hashes);
    rmSync(path.join(dir, 'evaluation-bundles'), { recursive: true });
    const load = await (await service({ dir })).loadEvaluation();
    expect(load).toMatchObject({ state: 'unusable', reason: expect.stringContaining('evaluation-bundle-v1.json') });
    expect(JSON.stringify(load)).not.toContain(dir); // a page never prints a machine path
  });

  test('a missing detail part is unusable', async () => {
    const { report: r, hashes } = await report();
    const dir = results();
    await writeBundle(dir, r, hashes);
    const cases = path.join(bundleDirOf(dir), 'cases');
    rmSync(path.join(cases, readdirSync(cases)[0]));
    await expect((await service({ dir })).loadEvaluation()).resolves.toMatchObject({ state: 'unusable' });
  });

  test('a changed byte in a part is unusable, and so is a part from another run (a mixed bundle)', async () => {
    const { report: r, hashes } = await report();
    const dir = results();
    await writeBundle(dir, r, hashes);
    const file = path.join(bundleDirOf(dir), 'cases', 'twin-0000.json');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('example-token', 'example-tokeN'));
    await expect((await service({ dir })).loadEvaluation()).resolves.toMatchObject({ state: 'unusable' });

    const other = results();
    const { report: r2 } = await report({ runId: '99999999-0000-4000-8000-000000000000' });
    await writeBundle(other, r2, hashes);
    writeFileSync(file, readFileSync(path.join(bundleDirOf(other), 'cases', 'twin-0000.json')));
    await expect((await service({ dir })).loadEvaluation()).resolves.toMatchObject({ state: 'unusable' });
  });

  test('a pointer that does not commit to its manifest is unusable', async () => {
    const { report: r, hashes } = await report();
    const dir = results();
    await writeBundle(dir, r, hashes);
    const manifest = path.join(bundleDirOf(dir), 'manifest.json');
    writeFileSync(manifest, `${readFileSync(manifest, 'utf8')} `);
    await expect((await service({ dir })).loadEvaluation()).resolves.toMatchObject({ state: 'unusable', reason: expect.stringContaining('pointer') });
  });

  test('a bundle of another corpus is stale', async () => {
    const { report: r } = await report({ corpusHashes: { 'suite-a': 'not-this-checkout' } });
    const dir = results();
    await writeBundle(dir, r); // written without the staleness check, as an old bundle would be
    await expect((await service({ dir })).loadEvaluation()).resolves.toMatchObject({ state: 'stale', reason: expect.stringContaining('Stale evaluation') });
  });

  test('a summary the evidence does not reconcile with is never published', async () => {
    const { report: r, hashes } = await report();
    // The producer refuses to commit a summary whose review state does not account for every review, so nothing reaches the pointer.
    const bad = results();
    await expect(writeBundle(bad, { ...r, review: { ...r.review, open: r.review.open + 1 } }, hashes)).rejects.toThrow(/Review state/);
    await expect((await service({ dir: bad })).loadEvaluation()).resolves.toMatchObject({ state: 'not-published' });
  });
});

describe('loadQualification', () => {
  test('the aggregate published with the evaluation wins, from the legacy file and from a bundle', async () => {
    const frozen = JSON.parse(real('docs/specs/qualification/engine-v1.json'));
    const q = { ...frozen, runId: '12345678-0000-4000-8000-000000000000' }; // a run of its own, so "run" cannot be mistaken for "frozen"
    const { report: r, hashes } = await report({ qualification: q });
    const legacy = await service({ dir: results({ 'evaluation-v1.json': JSON.stringify(r) }) });
    await expect(legacy.loadQualification()).resolves.toMatchObject({ state: 'recorded', source: 'run', report: { runId: q.runId } });
    const dir = results();
    await writeBundle(dir, r, hashes, 1 << 20);
    await expect((await service({ dir })).loadQualification()).resolves.toMatchObject({ state: 'recorded', source: 'run', report: { runId: q.runId } });
  });

  test('without one, the frozen report in the repository is used and labelled frozen', async () => {
    const q = JSON.parse(real('docs/specs/qualification/engine-v1.json'));
    const root = overlay({ [`${'docs/specs/qualification/engine-v1.json'}`]: JSON.stringify(q) });
    const s = await service({ dir: results(), root });
    await expect(s.loadQualification()).resolves.toMatchObject({ state: 'recorded', source: 'frozen', report: { runId: q.runId } });
  });

  test('a frozen report this site cannot read, or none at all, is not recorded', async () => {
    const unreadable = await service({ dir: results(), root: overlay({ 'docs/specs/qualification/engine-v1.json': '{"reportType":"other"}' }) });
    await expect(unreadable.loadQualification()).resolves.toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('not a qualification report') });
    const absent = await service({ dir: results(), root: overlay({ 'docs/specs/qualification/engine-v1.json': null }) });
    await expect(absent.loadQualification()).resolves.toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('is absent') });
  });

  test('a bundle that is unusable does not borrow the legacy qualification: the frozen report answers', async () => {
    const q = JSON.parse(real('docs/specs/qualification/engine-v1.json'));
    const dir = results({ 'evaluation-bundle-v1.json': '{}' });
    const root = overlay({ 'docs/specs/qualification/engine-v1.json': JSON.stringify(q) });
    await expect((await service({ dir, root })).loadQualification()).resolves.toMatchObject({ state: 'recorded', source: 'frozen' });
  });
});
