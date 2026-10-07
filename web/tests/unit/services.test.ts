// @vitest-environment node
/**
 * The services read committed ledger files and the benchmark run, and decide what a page may say:
 * measured, not published, unusable, invalid. The happy path runs against the real corpora (what
 * `next build` reads). Every other state is produced by an overlay of that tree in which one file is
 * absent, unreadable or changed: symlinks to the real files, so nothing large is copied and nothing
 * real is touched. The data it writes is synthetic.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { REAL_ROOT as REAL, edited, overlay, real } from './overlay';

const FEATURE_CLAIMS_FILE = 'benchmarks/feature-claims.json';
const CRITERIA_FILE = 'benchmarks/performance-criteria.json';

async function services(root: string = REAL) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  return {
    repo: await import('../../services/repo'),
    run: await import('../../services/run'),
    features: await import('../../services/features'),
    performance: await import('../../services/performance'),
    runtime: await import('../../services/runtime'),
    floors: await import('../../services/floors'),
    findings: await import('../../services/findings'),
    peers: await import('../../services/peers'),
    catalog: await import('../../services/catalog'),
    dossiers: await import('../../services/dossiers'),
    contracts: await import('../../services/contracts'),
  };
}

beforeEach(() => { vi.unstubAllEnvs(); });

describe('repo plumbing', () => {
  test('readJson parses a file; readJsonIfPresent returns undefined only for a missing file', async () => {
    const s = await services(overlay({ 'x/ok.json': '{"a":1}', 'x/bad.json': '{nope' }));
    await expect(s.repo.readJson('x/ok.json')).resolves.toEqual({ a: 1 });
    await expect(s.repo.readJsonIfPresent('x/ok.json')).resolves.toEqual({ a: 1 });
    await expect(s.repo.readJsonIfPresent('x/missing.json')).resolves.toBeUndefined();
    await expect(s.repo.readJsonIfPresent('x/bad.json')).rejects.toThrow(SyntaxError);
    await expect(s.repo.readJson('x/missing.json')).rejects.toThrow(/ENOENT/);
  });

  test('once runs a load one time per key, shares it, forgets a failure and can be reset', async () => {
    const s = await services();
    const load = vi.fn(async () => ({ n: 1 }));
    const [a, b] = await Promise.all([s.repo.once('k', load), s.repo.once('k', load)]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    const failing = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('fine');
    await expect(s.repo.once('f', failing)).rejects.toThrow('boom');
    await expect(s.repo.once('f', failing)).resolves.toBe('fine');
    s.repo.resetServices();
    await s.repo.once('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('the benchmark run (services/run)', () => {
  const runDir = 'public/results';

  test('the real run is measured and names the mode it came from', async () => {
    const s = await services();
    const run = await s.run.loadRun();
    expect(run.state).toBe('measured');
    if (run.state !== 'measured') return;
    expect(['published', 'candidate']).toContain(run.mode);
    expect(run.scanners.map(x => x.id)).toContain(s.run.PRODUCT);
    expect(run.productRows.size).toBeGreaterThan(100);
    expect(run.suiteCount).toBeGreaterThan(3);
  });

  test('no run.json: not published, with the reason', async () => {
    const s = await services(overlay({ [`${runDir}/run.json`]: null }));
    await expect(s.run.loadRun()).resolves.toMatchObject({ state: 'not-published', reason: expect.stringContaining('run.json is absent') });
  });

  test('no summary.json: unusable, never a partly drawn report', async () => {
    const s = await services(overlay({ [`${runDir}/summary.json`]: null }));
    await expect(s.run.loadRun()).resolves.toMatchObject({ state: 'unusable', reason: expect.stringContaining('summary.json') });
  });

  test('a run file that is not JSON fails the load with the file named', async () => {
    const s = await services(overlay({ [`${runDir}/run.json`]: '{broken' }));
    await expect(s.run.loadRun()).rejects.toThrow('public/results/run.json is unreadable');
  });

  test('a suite whose report is missing is excluded and named; the rest stay measured', async () => {
    const victim = readdirSync(path.join(REAL, runDir)).find(f => f.startsWith('beta8-') && f.endsWith('.json'))!;
    const s = await services(overlay({ [`${runDir}/${victim}`]: null }));
    const run = await s.run.loadRun();
    if (run.state === 'measured') {
      expect(run.excludedSuites.map(x => `${x.id}.json`)).toContain(victim);
    } else {
      expect(run.state).toBe('unusable');
    }
  });

  test('a candidate run says so: mode candidate with the commit it was built from', async () => {
    const s = await services(overlay({ [`${runDir}/run.json`]: edited(`${runDir}/run.json`, v => { v.candidate = { sourceCommit: 'a'.repeat(40), declaredVersion: '0.0.0-synthetic' }; }) }));
    const run = await s.run.loadRun();
    if (run.state === 'measured') {
      expect(run.mode).toBe('candidate');
      expect(run.candidate).toEqual({ sourceCommit: 'a'.repeat(40), declaredVersion: '0.0.0-synthetic' });
    }
  });

  test('WEB_RESULTS_DIR points the service at another results directory', async () => {
    vi.stubEnv('WEB_RESULTS_DIR', path.join(overlay({}), 'nowhere'));
    const s = await services();
    await expect(s.run.loadRun()).resolves.toMatchObject({ state: 'not-published' });
  });
});

describe('feature claims', () => {
  test('recorded: the committed file validates', async () => {
    const s = await services();
    const claims = await s.features.loadFeatureClaims();
    expect(claims.state).toBe('recorded');
  });

  test('absent: not recorded, with the path in the reason', async () => {
    const s = await services(overlay({ [FEATURE_CLAIMS_FILE]: null }));
    await expect(s.features.loadFeatureClaims()).resolves.toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('benchmarks/feature-claims.json does not exist') });
  });

  test('invalid shape: invalid, never read', async () => {
    const s = await services(overlay({ [FEATURE_CLAIMS_FILE]: '{"libraries": 3}' }));
    await expect(s.features.loadFeatureClaims()).resolves.toMatchObject({ state: 'invalid', reason: expect.stringContaining('did not validate') });
  });
});

describe('own performance', () => {
  const criteria = JSON.parse(real('benchmarks/performance-criteria.json'));
  const dir = criteria.baseline.verificationPath.replace(/\/[^/]*$/, '');

  test('measured from the accepted run', async () => {
    const s = await services();
    const own = await s.performance.loadOwnPerformance();
    expect(own.state).toBe('measured');
    if (own.state === 'measured') {
      expect(own.rows.length).toBeGreaterThan(0);
      expect(own.sourceCommit).toBe(criteria.baseline.verifiedCommit);
    }
  });

  test('summary absent: not published', async () => {
    const s = await services(overlay({ [`${dir}/summary.json`]: null }));
    await expect(s.performance.loadOwnPerformance()).resolves.toMatchObject({ state: 'not-published' });
  });

  test('summary that does not validate: invalid, with what failed', async () => {
    const s = await services(overlay({ [`${dir}/summary.json`]: '{"status":"complete"}' }));
    await expect(s.performance.loadOwnPerformance()).resolves.toMatchObject({ state: 'invalid', reason: expect.stringContaining('did not validate') });
  });

  test('a summary of another commit than the accepted one is invalid', async () => {
    const s = await services(overlay({ [CRITERIA_FILE]: edited(CRITERIA_FILE, v => { v.baseline.verifiedCommit = 'f'.repeat(40); }) }));
    await expect(s.performance.loadOwnPerformance()).resolves.toMatchObject({ state: 'invalid', reason: expect.stringContaining('is not the complete run of') });
  });

  test('without runner.json the runner is null, not made up', async () => {
    const s = await services(overlay({ [`${dir}/runner.json`]: null }));
    const own = await s.performance.loadOwnPerformance();
    expect(own).toMatchObject({ state: 'measured', runner: null });
  });
});

describe('peer runtime', () => {
  test('the committed snapshot and every setting are measured', async () => {
    const s = await services();
    const runtime = await s.runtime.loadPeerRuntime();
    expect(runtime.measurement.state).toBe('measured');
    expect(runtime.tools.length).toBeGreaterThan(1);
    expect(runtime.comparison?.settings.some(x => x.run.state === 'measured')).toBe(true);
  });

  test('snapshots absent: each says not published, and tool facts still come from the plan', async () => {
    const files = Object.fromEntries([
      ['evidence/429/peer-pii-runtime-throughput.json', null],
      ...readdirSync(path.join(REAL, 'evidence/562')).filter(f => f.startsWith('runtime-comparison-')).map(f => [`evidence/562/${f}`, null] as const),
    ]);
    const s = await services(overlay(files));
    const runtime = await s.runtime.loadPeerRuntime();
    expect(runtime.measurement).toMatchObject({ state: 'not-published' });
    expect(runtime.comparison?.settings.every(x => x.run.state === 'not-published')).toBe(true);
    expect(runtime.tools.every(t => t.version === undefined)).toBe(true);
  });

  test('snapshots that do not validate are invalid and never read', async () => {
    const files = Object.fromEntries([
      ['evidence/429/peer-pii-runtime-throughput.json', '{"schema":"wrong"}'],
      ...readdirSync(path.join(REAL, 'evidence/562')).filter(f => f.startsWith('runtime-comparison-')).map(f => [`evidence/562/${f}`, '{}'] as const),
    ]);
    const s = await services(overlay(files));
    const runtime = await s.runtime.loadPeerRuntime();
    expect(runtime.measurement).toMatchObject({ state: 'invalid', reason: expect.stringContaining('did not validate') });
    expect(runtime.comparison?.settings.every(x => x.run.state === 'invalid')).toBe(true);
  });
});

describe('small ledger readers', () => {
  test('accounting floors: the committed minimum, and a refusal when the suite does not carry one', async () => {
    const ok = await services();
    await expect(ok.floors.loadAccountingFloors()).resolves.toEqual({ minDenominator: expect.any(Number) });
    for (const bad of [null, 0, 1.5, 'x']) {
      const s = await services(overlay({ 'qualification/suite-v1.json': edited('qualification/suite-v1.json', v => { v.accounting = { minDenominator: bad }; }) }));
      await expect(s.floors.loadAccountingFloors()).rejects.toThrow('carries no accounting.minDenominator');
    }
  });

  test('findings are validated by the promotion rules', async () => {
    const ok = await services();
    const gaps = await ok.findings.loadFindings();
    expect(Array.isArray(gaps.issues)).toBe(true);
    const bad = await services(overlay({ 'benchmarks/known-gaps.json': '{"records":"x"}' }));
    await expect(bad.findings.loadFindings()).rejects.toThrow();
  });

  test('peer profiles: one per registered peer, with the families its rules target', async () => {
    const s = await services();
    const profiles = await s.peers.loadPeerProfiles();
    expect(profiles.size).toBeGreaterThanOrEqual(3);
    for (const profile of profiles.values()) expect(profile.ruleCount).toBeGreaterThan(0);
  });

  test('peer profiles: a rule map that disagrees with the registry fails the build with the problems', async () => {
    const s = await services(overlay({ 'scanners/peer-rule-families.json': edited('scanners/peer-rule-families.json', v => { v.scanners = {}; }) }));
    await expect(s.peers.loadPeerProfiles()).rejects.toThrow('the peer rule map or registry is invalid');
  });

  test('detector contracts: tier and cited sources per detector', async () => {
    const s = await services();
    const contracts = await s.contracts.loadDetectorContracts();
    expect(contracts.size).toBeGreaterThan(10);
    const withSources = [...contracts.values()].find(c => c.sources.length > 0);
    expect(withSources?.sources[0].href).toMatch(/^https?:\/\//);
  });

  test('dossiers: every taxonomy family has an entry; an invalid dossier set fails the build', async () => {
    const s = await services();
    const dossiers = await s.dossiers.loadDossiers();
    const taxonomy = JSON.parse(real('benchmarks/support/taxonomy.json')) as { families: { id: string }[] };
    for (const family of taxonomy.families) expect(dossiers.has(family.id), family.id).toBe(true);
    const bad = await services(overlay({ 'benchmarks/support/dossiers/ai21.md': real('benchmarks/support/dossiers/ai21.md').replace('verdict: ready', 'verdict: bogus') }));
    await expect(bad.dossiers.loadDossiers()).rejects.toThrow('the provider dossiers are invalid');
  });
});

describe('catalog', () => {
  test('loads every fixture with its family relationships and its suite', async () => {
    const s = await services();
    const catalog = await s.catalog.loadCatalog();
    expect(catalog.fixtures.length).toBeGreaterThan(1000);
    expect(catalog.bySlug.size).toBe(catalog.fixtures.length);
    for (const f of catalog.fixtures.slice(0, 200)) expect(f.familyIds.length > 0 || f.unscopedReason, f.slug).toBeTruthy();
    expect([...catalog.fixturesBySuite.values()].reduce((n, l) => n + l.length, 0)).toBe(catalog.fixtures.length);
    expect(await s.catalog.loadSuites()).toHaveLength(catalog.suites.length);
    const hashes = await s.catalog.loadFixtureHashes();
    expect([...hashes.values()][0]).toMatch(/^[0-9a-f]{64}$/);
    expect((await s.catalog.loadFixtureBytes()).size).toBe(catalog.fixtures.length);
    expect((await s.catalog.loadCatalogSources()).categories.length).toBe(catalog.suites.length);
  });

  test('the corpus hashes the evaluation bundle is checked against need no fixture index, detector assignment or scenario file (#658)', async () => {
    // Both authorities read them (the bundle states the corpus hashes it was measured over); the legacy catalog files are the legacy authority's alone.
    const bare = await services(overlay({ 'benchmarks/fixture-index.json': null, 'benchmarks/fixture-detectors.json': null, 'benchmarks/scenarios.json': null }));
    const hashes = await bare.catalog.loadCorpusHashes();
    const full = await (await services()).catalog.loadCatalogSources();
    expect(Object.keys(hashes)).toEqual(full.categories);
    expect(hashes).toEqual(full.hashes);
    for (const hash of Object.values(hashes)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    await expect(bare.catalog.loadCatalog()).rejects.toThrow();
  });

  test('a fixture index that does not match the corpora fails the build, naming the file', async () => {
    const s = await services(overlay({ 'benchmarks/fixture-index.json': edited('benchmarks/fixture-index.json', v => { v.fixtures = []; }) }));
    await expect(s.catalog.loadCatalog()).rejects.toThrow(/fixture-index|semantic index/);
  });

  test('a taxonomy with a family the index does not know fails the build', async () => {
    const s = await services(overlay({ 'benchmarks/support/taxonomy.json': edited('benchmarks/support/taxonomy.json', v => { v.families = v.families.slice(1); }) }));
    await expect(s.catalog.loadCatalog()).rejects.toThrow();
  });

  test('a corpus file that is missing fails with the file in the message', async () => {
    const categories = JSON.parse(real('benchmarks/categories.json')) as { corpus: string; calibrationOnly?: boolean }[];
    const first = categories.find(c => !c.calibrationOnly)!;
    const s = await services(overlay({ [first.corpus]: null }));
    await expect(s.catalog.loadCatalog()).rejects.toThrow(/ENOENT/);
  });
});
