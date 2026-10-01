// @vitest-environment node
/**
 * The qualification pages (#606): the service decides what may be shown (ready, not built, incompatible, stale), the pure
 * resolvers turn the view into block props, and the blocks render them. Every view here is synthetic; nothing reads the
 * committed ledger or a built view for a figure, so a repin or a new run cannot break these.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { REAL_ROOT, edited, overlay } from './overlay';
import { syntheticView } from './qualification-data';
import { qualificationSlugs, resolveQualificationFamily, resolveQualificationOverview, resolveQualificationUnavailable } from '../../resolvers/qualification';

const dirs: string[] = [];
function results(view: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-qualification-'));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  if (view !== undefined) writeFileSync(path.join(dir, 'qualification-v1.json'), typeof view === 'string' ? view : JSON.stringify(view));
  return dir;
}
async function service(dir: string, root = REAL_ROOT) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  vi.stubEnv('WEB_RESULTS_DIR', dir);
  return import('../../services/qualification');
}
beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('loadQualificationView', () => {
  test('a build with no view is not built, with the file and the commands that produce it', async () => {
    const s = await service(results(undefined));
    const load = await s.loadQualificationView();
    expect(load).toMatchObject({ state: 'not-built', reason: expect.stringContaining('qualification-v1.json is absent') });
    expect(s.QUALIFICATION_COMMANDS.join(' ')).toContain('qualification:view');
  });

  test('a file that is not JSON is incompatible', async () => {
    const s = await service(results('{nope'));
    await expect(s.loadQualificationView()).resolves.toMatchObject({ state: 'incompatible', reason: expect.stringContaining('not valid JSON') });
  });

  test('another schema tag is incompatible, naming the tag this build reads', async () => {
    const s = await service(results({ ...syntheticView(), schema: 'redact-secret/qualification-view/v2' }));
    await expect(s.loadQualificationView()).resolves.toMatchObject({ state: 'incompatible', reason: expect.stringContaining('qualification-view/v1') });
  });

  test.each([
    ['no families', (v: any) => { delete v.families; }],
    ['a family with an unknown status', (v: any) => { v.families[0].status.value = 'excellent'; }],
    ['a family without counts', (v: any) => { v.families[0].populations[0].scanners[0] = { scanner: 'x' }; }],
    ['no population identity', (v: any) => { v.populations[0].artifact = {}; }],
  ])('a view with %s is incompatible, never shown in part', async (_name, change) => {
    const view: any = syntheticView();
    change(view);
    const s = await service(results(view));
    const load = await s.loadQualificationView();
    expect(load.state).toBe('incompatible');
  });

  test('a view built from other evidence than the one pinned is stale', async () => {
    const view = syntheticView();
    view.populations[0].artifact.evidence.corpus_digest = `sha256:${'9'.repeat(64)}`;
    const s = await service(results(view));
    await expect(s.loadQualificationView()).resolves.toMatchObject({ state: 'stale', reason: expect.stringContaining('other evidence') });
  });

  test('a view built with another engine version is stale', async () => {
    const view = syntheticView();
    view.populations[0].artifact.engine.version = '0.0.0-other';
    const s = await service(results(view));
    await expect(s.loadQualificationView()).resolves.toMatchObject({ state: 'stale', reason: expect.stringContaining('engine 0.0.0-other') });
  });

  test('a pinned population missing from the view is stale', async () => {
    const view = syntheticView();
    view.populations.pop();
    const s = await service(results(view));
    await expect(s.loadQualificationView()).resolves.toMatchObject({ state: 'stale', reason: expect.stringContaining('has no artifact in the view') });
  });

  test('a policy file that changed since the view was built makes it stale, naming the file', async () => {
    const root = overlay({ 'benchmarks/support/status-criteria.json': edited('benchmarks/support/status-criteria.json', v => { v.__changedByTest = true; }) });
    const s = await service(results(syntheticView()), root);
    await expect(s.loadQualificationView()).resolves.toMatchObject({ state: 'stale', reason: expect.stringContaining('benchmarks/support/status-criteria.json changed') });
  });

  test('a view built from this checkout is ready, and is read once', async () => {
    const s = await service(results(syntheticView()));
    const first = await s.loadQualificationView();
    expect(first.state).toBe('ready');
    expect(await s.loadQualificationView()).toBe(first);
  });

  test('a directory where the file should be is an error, not "not built"', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'web-qualification-'));
    dirs.push(dir);
    mkdirSync(path.join(dir, 'qualification-v1.json'));
    const s = await service(dir);
    await expect(s.loadQualificationView()).rejects.toThrow(/unreadable/);
  });
});

describe('resolveQualificationOverview', () => {
  const view = syntheticView();
  const page = resolveQualificationOverview(view);

  test('shows the adapter’s own distribution and states the mode of a stable count', () => {
    const counted = Object.fromEntries(page.summary.tiles.map(t => [t.label, t.value]));
    expect(counted.Stable).toBe(String(view.distribution.stable));
    expect(counted.Provisional).toBe(String(view.distribution.provisional));
    expect(page.summary.mode).toMatch(/^Published release · redact-secret 1\.0\.0/);
  });

  test('a candidate build says so', () => {
    expect(resolveQualificationOverview(syntheticView({ scannerBuild: 'candidate' })).summary.mode).toMatch(/^Candidate build/);
  });

  test('methods that did not run are stated, and absent when every family ran them', () => {
    expect(page.summary.methodsNote).toContain('mutation');
    const allStable = syntheticView({ statuses: { 'family-a': 'stable', 'family-b': 'stable', 'family-c': 'stable' } });
    expect(resolveQualificationOverview(allStable).summary.methodsNote).toBeNull();
  });

  test('every population keeps its own row, run identity and "None run" for methods', () => {
    expect(page.populations.rows).toHaveLength(view.populations.length);
    expect(page.populations.rows.every(r => r.methods === 'None run')).toBe(true);
    expect(new Set(page.populations.rows.map(r => r.id)).size).toBe(view.populations.length);
  });

  test('a family row lists its cases per population and never one total', () => {
    const row = page.families.rows.find(r => r.family === 'family-a')!;
    expect(row.cases).toHaveLength(view.populations.length);
    expect(row.cases.every(c => /^\S+ \d+$/.test(c))).toBe(true);
    expect(row.href).toBe('/evaluation/qualification/families/family-a/');
  });

  test('a family held by methods says "methods not run"; a stable family has no hold', () => {
    expect(page.families.rows.find(r => r.family === 'family-b')!.heldBy).toContain('methods not run');
    expect(page.families.rows.find(r => r.family === 'family-a')!.heldBy).toEqual([]);
  });

  test('known-gap rows count matched fixtures per population, and a record with none says nothing matched', () => {
    const gap = page.gaps.rows[0];
    expect(gap.matched).toHaveLength(1);
    expect(gap.matched[0]).toMatch(/1 of 2 fixtures$/);
    const none = resolveQualificationOverview({ ...view, knownGaps: [{ ...view.knownGaps[0], fixtures: [{ fixture: 'x', matches: [] }] }] });
    expect(none.gaps.rows[0].matched).toEqual([]);
  });

  test('the undetected taxonomy families are listed by id', () => {
    expect(page.families.undetected.items).toEqual(view.undetected.map(u => u.id));
  });
});

describe('resolveQualificationFamily', () => {
  const view = syntheticView();

  test('an unknown family resolves to null, and the slugs are the scored families', () => {
    expect(resolveQualificationFamily(view, 'no-such-family')).toBeNull();
    expect(qualificationSlugs(view)).toEqual(view.families.map(f => f.family));
  });

  test('a method that did not run is "Not measured" in the evidence, never zero', () => {
    const page = resolveQualificationFamily(view, 'family-b')!;
    const facts = Object.fromEntries(page.evidence.facts.map(f => [f.term, f.value]));
    expect(facts['Mutation unresolved critical']).toBe('Not measured');
    expect(facts['Metamorphic critical failures']).toBe('0');
    const stable = resolveQualificationFamily(view, 'family-a')!;
    expect(Object.fromEntries(stable.evidence.facts.map(f => [f.term, f.value]))['Mutation unresolved critical']).toBe('0');
  });

  test('a population with no case says so instead of showing zeros, and pending is its own word', () => {
    const page = resolveQualificationFamily(view, 'family-a')!;
    const empty = page.observations.rows.find(r => r.cases === '0')!;
    expect(empty.outcomes).toBe('No case in this population');
    expect(empty.benign).toBe('No control');
    const filled = page.observations.rows.find(r => r.cases !== '0')!;
    expect(filled.unmeasured).toBe('1 pending');
    expect(filled.outcomes).toMatch(/EXACT 5/);
  });

  test('the product status and the scanner observations are separate sections', () => {
    const page = resolveQualificationFamily(view, 'family-a')!;
    expect(page.status.title).toMatch(/Support status/);
    expect(page.observations.description).toMatch(/carry no support status/);
    expect(page.observations.rows.some(r => r.scanner === 'alpha-lib')).toBe(true);
  });

  test('a family with no population slice has no observation rows', () => {
    expect(resolveQualificationFamily(view, 'family-c')!.observations.rows).toEqual([]);
  });
});

describe('resolveQualificationUnavailable', () => {
  test.each(['not-built', 'incompatible', 'stale'] as const)('%s keeps its reason and the commands, and no number', state => {
    const props = resolveQualificationUnavailable({ state, reason: 'because' });
    expect(props.reason).toBe('because');
    expect(props.state).toBe(state);
    expect(props.commands.length).toBeGreaterThan(0);
    expect(JSON.stringify(props)).not.toMatch(/\d+ families/);
  });
});
