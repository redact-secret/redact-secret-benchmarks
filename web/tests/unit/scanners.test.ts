// @vitest-environment node
/**
 * /evaluation/scanner (#612). The resolver is exercised with synthetic scanners, runs and snapshots, so no
 * ledger value is asserted: a repin or a refreshed snapshot changes the page, never these tests. The service
 * is read against the committed tree for its shape only, and against overlays for the states the tree is not in.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PeerProfile } from '../../services/peers';
import type { PeerRuntime } from '../../services/runtime';
import type { MeasuredRun, RunScanner } from '../../services/run';
import type { ScannerEnvironment, ScannerSource, SnapshotFacts } from '../../services/scanners';
import { resolveScanners, type ScannerInput } from '../../resolvers/scanners';
import { REAL_ROOT, edited, overlay } from './overlay';

const snapshots = (over: Partial<SnapshotFacts> = {}): SnapshotFacts => ({
  count: 3, invalid: 0, observedFrom: '2026-01-02T00:00:00Z', observedTo: '2026-01-02T00:00:00Z', platforms: ['linux-x64'], versions: ['1.0.0'],
  modes: ['Directory scan · default rules'], configurationHashes: ['a'.repeat(64)], artifactDigests: ['b'.repeat(64)], observed: [{ platform: 'linux-x64', digest: 'c'.repeat(64) }],
  replayCounts: [2], configuration: { adapterVersion: 2, familyMappingVersion: 2, binary: 'alpha', arguments: ['dir', '<input-root>', '--json'], processLimits: { timeout: 120000, maxBuffer: 67108864 }, rules: 'default', environmentRuleOverrides: false },
  ...over,
});

const source = (id: string, over: Partial<ScannerSource> = {}): ScannerSource => ({
  id, pin: { version: '1.0.0', file: 'qualification/suite-v1.json' }, npm: null, release: null, snapshots: null, adapter: null, ...over,
});

const binary = source('alpha', {
  release: { repo: 'example/alpha', archives: [{ platform: 'linux-x64', archive: 'alpha_1.0.0_linux_x64.tar.gz', sha256: 'c'.repeat(64) }] },
  snapshots: snapshots(),
});
const library = source('beta', {
  pin: { version: '2.0.0', file: 'package.json' }, npm: { name: 'beta-lib', lockedVersion: '2.0.0', integrity: 'sha512-ABCDEFGHIJKLMNOPQRSTUV' },
  snapshots: snapshots({ platforms: ['npm-lock'], observed: [{ platform: 'npm-lock', digest: 'd'.repeat(64) }], configuration: { adapterVersion: 1, familyMappingVersion: 2, package: 'beta-lib', options: {} } }),
});
const product = source('redact-secret', { pin: { version: '9.9.9', file: 'qualification/suite-v1.json' }, npm: { name: '@redact-secret/core', lockedVersion: '9.9.9', integrity: null }, adapter: { adapterVersion: 3, familyMappingVersion: 2, detectors: 'default', runtime: 'node' } });
const environment: ScannerEnvironment = { suiteId: 'x', source: 'snapshots', sources: [product, binary, library] };

const profile = (id: string, kind: 'repository-scanner' | 'runtime-library'): PeerProfile => ({
  id, kind, kindLabel: kind === 'repository-scanner' ? 'Repository scanner' : 'Runtime library', description: `${id} description.`, outOfScope: [`${id} is not run in one way.`],
  families: new Set(), rulesByFamily: new Map(), mappedRules: 7, ruleCount: 70, ruleFileVersion: '1.0.0', ruleFilePath: 'rules.toml', ruleFileRevision: null, reviewedAt: '2026-01-01',
});
const profiles = new Map([['alpha', profile('alpha', 'repository-scanner')], ['beta', profile('beta', 'runtime-library')]]);

const scanner = (id: string, version: string | null, observations: RunScanner['observations']): RunScanner => ({ id, name: id.toUpperCase(), version, mode: `${id} mode line`, status: 'complete', observations, rows: new Map() });
const run = (over: Partial<MeasuredRun> = {}): MeasuredRun => ({
  state: 'measured', runId: 'r1', generatedAt: '2026-01-03T00:00:00Z', accountingVersion: '1', mode: 'published', productVersion: '9.9.9', suiteCount: 4,
  scanners: [scanner('beta', '2.0.0', [{ source: 'snapshot', observedAt: 'x', sourceRunId: 'y' }]), scanner('redact-secret', '9.9.9', [{ source: 'fresh', observedAt: 'x', sourceRunId: 'y' }]), scanner('alpha', '1.0.1', [{ source: 'snapshot', observedAt: 'x', sourceRunId: 'y' }])],
  hosts: [{ node: 'v22.0.0', platform: 'linux', arch: 'x64', suites: 4 }], revision: null, dirty: null, productRows: new Map(), excludedSuites: [], staleSuites: [],
  ...over,
} as unknown as MeasuredRun);

const runtime = {
  tools: [{ id: 'redact-secret', package: '@redact-secret/core', call: 'scanAndRedact', async: false, piiSelectors: [] }, { id: 'beta', package: 'beta-lib', call: 'redact', async: true, piiSelectors: [] }],
  comparison: { settings: [{ id: 'default', run: { state: 'measured', generatedAt: '2026-01-04T00:00:00Z', runner: { platform: 'linux', arch: 'x64', node: 'v22.1.0', cpuModel: 'Example CPU', cpuLimit: 1 }, tools: [{ id: 'beta', version: '2.0.0', buildKind: 'published-npm-package' }] } }] },
} as unknown as PeerRuntime;

const input = (over: Partial<ScannerInput> = {}): ScannerInput => ({ environment, profiles, run: run(), runtime, productDetectors: 11, ...over });
const factsOf = (page: ReturnType<typeof resolveScanners>, id: string) => page.profiles.find(p => p.id === id)!.groups.flatMap(g => g.facts);
const fact = (page: ReturnType<typeof resolveScanners>, id: string, term: string) => factsOf(page, id).find(f => f.term === term);

describe('the scanner page resolver', () => {
  test('lists scanners in the run\'s own order and states each one\'s kind, version and pin', () => {
    const page = resolveScanners(input());
    expect(page.roster.rows.map(r => r.id)).toEqual(['beta', 'redact-secret', 'alpha']);
    expect(page.roster.rows[0]).toMatchObject({ kind: 'Runtime library', version: '2.0.0', pinnedIn: 'package.json', mode: 'beta mode line' });
    // The product is not in the registry; the runtime comparison plan names it a runtime library.
    expect(page.roster.rows[1].kind).toBe('Runtime library');
    expect(page.profiles.map(p => p.groups.map(g => g.title))).toEqual(Array(3).fill(['Install and pin', 'How it ran', 'Where it ran', 'Rules']));
  });

  test('records the pin and the version the run observed as two facts', () => {
    const page = resolveScanners(input());
    expect(fact(page, 'alpha', 'Pinned version')).toMatchObject({ value: '1.0.0', note: 'qualification/suite-v1.json' });
    expect(fact(page, 'alpha', 'Observed in this run')?.value).toBe('1.0.1');
  });

  test('a binary names its archive and whether the snapshots recorded the pinned digest', () => {
    const page = resolveScanners(input());
    expect(fact(page, 'alpha', 'Archive, linux-x64')?.note).toMatch(/the digest the snapshots recorded/);
    const changed = resolveScanners(input({ environment: { ...environment, sources: [{ ...binary, snapshots: snapshots({ observed: [{ platform: 'linux-x64', digest: 'e'.repeat(64) }] }) }] }, run: undefined }));
    expect(fact(changed, 'alpha', 'Archive, linux-x64')?.note).toMatch(/not the digest/);
  });

  test('the arguments go to the disclosure; limits, options and the hash are facts', () => {
    const page = resolveScanners(input());
    expect(page.profiles.find(p => p.id === 'alpha')!.command?.text).toBe('dir <input-root> --json');
    expect(fact(page, 'alpha', 'Limits')?.value).toMatch(/120 s timeout · 64 MiB output/);
    expect(fact(page, 'alpha', 'Configuration hash')?.note).toMatch(/the same in all 3 snapshots/);
    expect(fact(page, 'beta', 'Options')?.value).toBe('none (package defaults)');
    expect(fact(page, 'beta', 'Installed from')?.value).toBe('npm, beta-lib');
  });

  test('where it ran: a fresh observation names the run host, a snapshot names its date and says what is not recorded', () => {
    const page = resolveScanners(input());
    expect(fact(page, 'redact-secret', 'This run')?.value).toBe('Node v22.0.0 · linux x64');
    expect(fact(page, 'alpha', 'Observed')?.value).toBe('Snapshots, 2026-01-02');
    expect(fact(page, 'alpha', 'Host OS release, CPU and Node of the snapshots')?.value).toBeNull();
    expect(fact(page, 'beta', 'Runtime comparison')).toMatchObject({ value: 'linux x64 · Node v22.1.0' });
    expect(fact(page, 'beta', 'Runtime comparison call')?.value).toBe('redact(), asynchronous');
  });

  test('without a run the roster keeps the pins and every run fact is Not recorded, never invented', () => {
    const page = resolveScanners(input({ run: undefined }));
    expect(page.roster.rows.map(r => r.id)).toEqual(['redact-secret', 'alpha', 'beta']);
    expect(page.roster.rows.every(r => r.mode === null)).toBe(true);
    expect(fact(page, 'alpha', 'Observed in this run')?.value).toBeNull();
    expect(fact(page, 'redact-secret', 'Observed')?.value).toBeNull();
    expect(page.modeNote.mode).toBeNull();
    expect(page.meta).toEqual([]);
  });

  test('a scanner with no snapshots, no registry entry and no rule file says Not recorded in each place', () => {
    const bare = source('gamma', { pin: { version: null, file: 'package.json' } });
    const page = resolveScanners(input({ environment: { ...environment, sources: [bare] }, run: undefined, runtime: undefined }));
    const [p] = page.profiles;
    expect(p).toMatchObject({ version: 'unknown version', kind: null, description: null, outOfScope: null, command: null, compared: [] });
    expect(fact(page, 'gamma', 'Rules')?.value).toBeNull();
    expect(fact(page, 'gamma', 'Configuration')?.value).toBeNull();
  });

  test('the product shows its own out-of-scope statements and the revision its detector count was read at, and a peer never borrows them (#622)', () => {
    const productScope = { outOfScope: ['Encoded carriers: not decoded.'], readAt: 'a'.repeat(40), detectors: { count: 110, revision: '66b492bdff5e6751fc6b5409266916346ed7c723' } };
    const page = resolveScanners(input({ productScope }));
    expect(page.profiles.find(p => p.id === 'redact-secret')?.outOfScope).toEqual(['Encoded carriers: not decoded.']);
    expect(page.profiles.find(p => p.id === 'alpha')?.outOfScope).toEqual(['alpha is not run in one way.']);
    expect(fact(page, 'redact-secret', 'Registered detectors')).toMatchObject({ value: '11', note: 'benchmarks/detectors.json, read at redact-secret 66b492bdff5e' });
    // Without the statement the page keeps saying so, and says it did not record one.
    expect(resolveScanners(input()).profiles.find(p => p.id === 'redact-secret')?.outOfScope).toBeNull();
  });

  test('the mode note names published or candidate, and the build a candidate measured', () => {
    expect(resolveScanners(input()).modeNote).toMatchObject({ mode: 'published' });
    const candidate = resolveScanners(input({ run: run({ mode: 'candidate', candidate: { sourceCommit: '0123456789abcdef', declaredVersion: '9.9.10-rc.1' } }) }));
    expect(candidate.modeNote).toMatchObject({ mode: 'candidate' });
    expect(candidate.modeNote.modeLabel).toContain('0123456789ab');
    expect(candidate.meta[0].value).toMatch(/^candidate/);
  });

  test('links to the comparison pages that include a scanner, and none to a page it is not in', () => {
    const page = resolveScanners(input());
    const hrefs = (id: string) => page.profiles.find(p => p.id === id)!.compared.map(c => c.href);
    expect(hrefs('alpha')).toEqual([expect.stringContaining('/comparison/accuracy/')]);
    expect(hrefs('beta')).toEqual(expect.arrayContaining(['/comparison/runtime/', '/comparison/feature/']));
    expect(hrefs('redact-secret')).toEqual(expect.arrayContaining(['/report/', '/comparison/runtime/']));
  });

  test('copy never ranks a scanner', () => {
    const text = JSON.stringify(resolveScanners(input()));
    expect(text).not.toMatch(/\b(better|worse|best|worst|winner|fastest|slowest|rank(ed|ing)?|recommended)\b/i);
  });
});

describe('the scanner environment service', () => {
  beforeEach(() => { vi.unstubAllEnvs(); });
  async function load(root: string = REAL_ROOT) {
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', root);
    return (await import('../../services/scanners')).loadScannerEnvironment();
  }
  const snapshotFiles = (id: string): string[] => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(path.join(REAL_ROOT, dir), { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
        else if (entry.name === `${id}.json`) found.push(`${dir}/${entry.name}`);
      }
    };
    walk('peer-observations');
    return found.sort();
  };

  test('reads a pin, an install source and validated snapshots for every scanner the benchmark ran with', async () => {
    const env = await load();
    const registered = Object.keys(JSON.parse(readFileSync(path.join(REAL_ROOT, 'scanners/peer-registry.json'), 'utf8')).scanners);
    expect(env.sources.map(s => s.id)).toEqual(expect.arrayContaining(['redact-secret', ...registered]));
    for (const s of env.sources) expect(s.pin.version, `${s.id} has a pin`).toBeTruthy();
    expect(env.sources.find(s => s.id === 'redact-secret')!.adapter).toBeTruthy();
    for (const s of env.sources.filter(s => s.id !== 'redact-secret')) {
      expect(s.snapshots, `${s.id} has committed snapshots in peer-observations/`).toBeTruthy();
      expect(s.release || s.npm, `${s.id} is installed from a release archive or an npm package`).toBeTruthy();
    }
  });

  test('a snapshot that does not validate is counted and left out, never summarised', async () => {
    const [victim] = snapshotFiles('gitleaks');
    const whole = (await load()).sources.find(s => s.id === 'gitleaks')!.snapshots!;
    const env = await load(overlay({ [victim]: '{"reportType":"not-a-snapshot"}' }));
    const held = env.sources.find(s => s.id === 'gitleaks')!.snapshots!;
    expect(held.invalid).toBe(1);
    expect(held.count).toBe(whole.count - 1);
  });

  test('a scanner whose snapshots are all absent has none, and a missing lockfile leaves the integrity unrecorded', async () => {
    const overrides: Record<string, string | null> = { 'package-lock.json': null };
    for (const file of snapshotFiles('trufflehog')) overrides[file] = null;
    const env = await load(overlay(overrides));
    expect(env.sources.find(s => s.id === 'trufflehog')!.snapshots).toBeNull();
    expect(env.sources.find(s => s.id === 'flare-redact')!.npm?.integrity).toBeNull();
  });

  test('a package that the suite does not pin takes its pin from package.json', async () => {
    const env = await load(overlay({ 'qualification/suite-v1.json': edited('qualification/suite-v1.json', v => { delete v.scanners.gitleaks; }) }));
    expect(env.sources.find(s => s.id === 'gitleaks')!.pin.file).toBe('package.json');
    expect(env.sources.find(s => s.id === 'gitleaks')!.pin.version).toBeNull();
  });
});
