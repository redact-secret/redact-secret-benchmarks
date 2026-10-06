// @vitest-environment node
/**
 * Old versus new (#789): the Evaluation pages resolved from a validated bundle equal the pages resolved from the legacy whole file,
 * which is the former behaviour kept as the supported fallback. The same synthetic report is published both ways into temporary results
 * directories and every page (the hub and the six method pages) is resolved through the real page resolvers, so the equality covers the
 * service, the per-method reads and the accounting. States with no evidence are compared as well: a missing, corrupt or stale bundle
 * resolves to the same explicit "Not measured" pages as the legacy file in that state, never to zero.
 */
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { documentBytes } from '../../../benchmarks/evaluation/storage/parts.ts';
import { METHOD_IDS } from '../../lib/methods';
import { REAL_ROOT, real } from './overlay';
import { syntheticReport, withExtraTwins } from './evaluation-data';
import { writeBundle } from './evaluation-bundle-data';

const dirs: string[] = [];
const results = (files: Record<string, string> = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-equivalence-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); writeFileSync(path.join(dir, name), text); }
  return dir;
};
beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

async function pagesOf(dir: string) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', REAL_ROOT);
  vi.stubEnv('WEB_RESULTS_DIR', dir);
  const pages = await import('../../resolvers/evaluation-pages');
  const service = await import('../../services/evaluation');
  return { hub: await pages.resolveEvaluationHubPage(), methods: await Promise.all(METHOD_IDS.map(id => pages.resolveMethodPageFor(id))), load: await service.loadEvaluation() };
}

async function fixture() {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', REAL_ROOT);
  const { hashes } = await (await import('../../services/catalog')).loadCatalogSources();
  const base = syntheticReport({ corpusHashes: hashes });
  const { cases: _c, reviews: _r, ...summary } = base;
  const limit = Math.max(4000, Buffer.byteLength(documentBytes({ schema: 'x', role: 'summary', report: summary })) + 400);
  return { hashes, limit, report: withExtraTwins(base, Math.ceil((limit * 2.5) / 850)) };
}

describe('the pages from a bundle equal the pages from the legacy file', () => {
  test('hub and all six method pages are deeply equal', async () => {
    const { hashes, limit, report } = await fixture();
    const legacyDir = results({ 'evaluation-v1.json': JSON.stringify(report) });
    const bundleDir = results();
    await writeBundle(bundleDir, report, hashes, limit);
    const legacy = await pagesOf(legacyDir);
    const bundle = await pagesOf(bundleDir);
    expect(legacy.load).toMatchObject({ state: 'measured', source: 'legacy' });
    expect(bundle.load).toMatchObject({ state: 'measured', source: 'bundle' });
    expect(bundle.hub).toEqual(legacy.hub);
    METHOD_IDS.forEach((id, i) => expect(bundle.methods[i], id).toEqual(legacy.methods[i]));
    // Not the empty page in both: the equality is over real recorded sections.
    for (const id of METHOD_IDS.filter(m => m !== 'holdout')) expect(bundle.methods[METHOD_IDS.indexOf(id)].recorded.state, id).toBe('recorded');
  });

  test('the same holds when the part limit puts every case in a part of its own', async () => {
    const { hashes } = await fixture();
    const small = withExtraTwins(syntheticReport({ corpusHashes: hashes }), 0);
    const bundleDir = results();
    // The summary alone sets the lower bound of the limit; stay just above it so each method still spans parts where its cases are large.
    const { cases: _c, reviews: _r, ...summary } = small;
    await writeBundle(bundleDir, small, hashes, Buffer.byteLength(documentBytes({ schema: 'x', role: 'summary', report: summary })) + 300);
    const legacy = await pagesOf(results({ 'evaluation-v1.json': JSON.stringify(small) }));
    const bundle = await pagesOf(bundleDir);
    expect(bundle.hub).toEqual(legacy.hub);
    METHOD_IDS.forEach((id, i) => expect(bundle.methods[i], id).toEqual(legacy.methods[i]));
  });
});

describe('no usable evidence resolves to the same explicit state', () => {
  const notMeasured = (p: Awaited<ReturnType<typeof pagesOf>>) => {
    expect(p.hub.run).toMatchObject({ state: 'not-measured' });
    expect(p.hub.meta).toEqual([{ value: 'Not measured' }]);
    for (const m of p.hub.methods.filter(x => x.id !== 'holdout')) expect(m.fact).toBeUndefined();
    for (const id of METHOD_IDS.filter(m => m !== 'holdout')) expect(p.methods[METHOD_IDS.indexOf(id)].recorded, id).toMatchObject({ state: 'not-measured' });
  };

  test('nothing published', async () => {
    notMeasured(await pagesOf(results()));
  });

  test('a corrupt bundle is unusable and its pages say so; the legacy file beside it is not used', async () => {
    const { hashes, limit, report } = await fixture();
    const dir = results({ 'evaluation-v1.json': JSON.stringify(report) });
    await writeBundle(dir, report, hashes, limit);
    const cases = path.join(dir, 'evaluation-bundles', readdirSync(path.join(dir, 'evaluation-bundles'))[0], 'cases');
    writeFileSync(path.join(cases, readdirSync(cases)[0]), '{}');
    const p = await pagesOf(dir);
    expect(p.load.state).toBe('unusable');
    notMeasured(p);
  });

  test('a stale bundle is stale and its pages show no run', async () => {
    const { limit, report } = await fixture();
    const dir = results();
    await writeBundle(dir, { ...report, corpusHashes: { 'suite-a': 'another-corpus' } }, undefined, limit);
    const p = await pagesOf(dir);
    expect(p.load.state).toBe('stale');
    notMeasured(p);
  });

  test('holdout reads the frozen qualification the same way whatever the evaluation state', async () => {
    const frozen = JSON.parse(real('docs/specs/qualification/engine-v1.json'));
    const p = await pagesOf(results());
    const holdout = p.methods[METHOD_IDS.indexOf('holdout')];
    expect(holdout.recorded).toMatchObject({ state: 'recorded' });
    expect(holdout.meta).toContainEqual({ label: 'Source', value: 'Frozen report in the repository' });
    expect(holdout.meta).toContainEqual({ label: 'Qualification run', value: expect.stringContaining(frozen.runId.slice(0, 8)) });
  });
});
