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
import { QUALIFICATION_CASE_PAGE_ROWS, qualificationCaseParams, qualificationCasePageCount, qualificationUnattributedParams, resolveQualificationCases } from '../../resolvers/qualification-cases';
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
    ['a population with no case rows (a view built before they existed)', (v: any) => { delete v.populations[0].cases; }],
    ['a case row without its scanner results', (v: any) => { delete v.populations[0].cases[0].results; }],
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

describe('resolveQualificationCases', () => {
  const view = syntheticView();
  const family = (name: string, page = 1, v = view) => resolveQualificationCases(v, { kind: 'family', family: name }, page)!;
  const cell = (props: ReturnType<typeof family>, id: string, scanner: string) => props.sections.flatMap(s => s.rows).find(r => r.id.endsWith(id))!.cells.find(c => c.scanner === scanner)!;

  test('an unscored family, a page below one and a page past the end resolve to null', () => {
    expect(resolveQualificationCases(view, { kind: 'family', family: 'no-such-family' }, 1)).toBeNull();
    expect(resolveQualificationCases(view, { kind: 'family', family: 'family-a' }, 0)).toBeNull();
    expect(resolveQualificationCases(view, { kind: 'family', family: 'family-a' }, 2)).toBeNull();
    expect(resolveQualificationCases(view, { kind: 'family', family: 'family-a' }, 1.5)).toBeNull();
  });

  test('every population is its own section, with its own run identity, and the same id in two populations is two rows', () => {
    const props = family('family-a');
    expect(props.sections.map(s => s.id)).toEqual(view.populations.map(p => p.population));
    expect(new Set(props.sections.flatMap(s => s.rows.map(r => r.key))).size).toBe(props.sections.reduce((n, s) => n + s.rows.length, 0));
    for (const section of props.sections) expect(section.identity.map(i => i.term)).toEqual(['Evidence', 'Corpus digest', 'Semantic digest', 'Run class']);
  });

  test('a scanner’s word is the artifact’s own: outcomes, flagged, pending and not measured stay distinct', () => {
    const props = family('family-a');
    expect(cell(props, '--a-positive', 'alpha-lib')).toMatchObject({ word: 'EXACT', state: 'measured' });
    expect(cell(props, '--a-positive', 'redact-secret')).toMatchObject({ word: 'MISS', state: 'measured' });
    expect(cell(props, '--a-two-spans', 'alpha-lib').word).toBe('EXACT 1 · MISS 1');
    expect(cell(props, '--a-control', 'alpha-lib').word).toBe('Not flagged');
    expect(cell(props, '--a-control', 'redact-secret').word).toBe('Flagged · co-detected');
    expect(cell(props, '--a-pending', 'alpha-lib')).toMatchObject({ word: 'Pending', state: 'pending' });
    expect(cell(props, '--a-unmeasured', 'alpha-lib')).toMatchObject({ word: 'Not measured', state: 'not-measured' });
  });

  test('a pending and a not-measured case say they are not a miss and not a pass; the evidence class is labelled as the artifact’s', () => {
    const props = family('family-a');
    const rows = props.sections.flatMap(s => s.rows);
    const detail = (id: string, term: string) => rows.find(r => r.id.endsWith(id))!.detail.find(d => d.term === term)!.value;
    expect(detail('--a-pending', 'alpha-lib')).toMatch(/not a miss and not a pass/);
    expect(detail('--a-unmeasured', 'alpha-lib')).toMatch(/status was timeout.*not a miss and not a pass/);
    expect(props.note.text).toMatch(/not a support status/);
    expect(rows[0].evidenceClass).toBe('synthetic-class');
  });

  test('the opened row names the case’s path, twin, attribution, expected spans and each scanner’s measurement', () => {
    const rows = family('family-a').sections.flatMap(s => s.rows);
    const control = Object.fromEntries(rows.find(r => r.id.endsWith('--a-control'))!.detail.map(d => [d.term, d.value]));
    expect(control['Twin of']).toMatch(/--a-positive$/);
    expect(control['Twin mutation']).toBe('synthetic-mutation');
    expect(control['Expected spans']).toMatch(/^None/);
    expect(control['redact-secret']).toMatch(/Flagged.*another detector also reported it/);
    const two = Object.fromEntries(rows.find(r => r.id.endsWith('--a-two-spans'))!.detail.map(d => [d.term, d.value]));
    expect(two['Expected spans']).toBe('secret 1 to 4 (envelope 0 to 8); companion 10 to 12');
    expect(two['Path']).toMatch(/^synthetic\//);
    expect(family('family-b').sections[0].rows[0].detail.find(d => d.term === 'Attribution')!.value).toMatch(/twin’s parent/);
  });

  test('a case no detector claims is on the unattributed pages and on no family page', () => {
    const orphan = resolveQualificationCases(view, { kind: 'unattributed' }, 1)!;
    expect(orphan.sections.flatMap(s => s.rows).every(r => r.id.endsWith('--orphan'))).toBe(true);
    expect(orphan.back.href).toBe('/evaluation/qualification/');
    for (const name of ['family-a', 'family-b', 'family-c']) expect(family(name).sections.flatMap(s => s.rows).some(r => r.id.endsWith('--orphan'))).toBe(false);
  });

  test('a family with no case says so and keeps one page; an all-attributed view has an empty unattributed page', () => {
    const none = family('family-c');
    expect(none.sections).toEqual([]);
    expect(none.empty).toMatch(/No population holds a case/);
    expect(none.pager).toMatchObject({ page: 1, pageCount: 1 });
    const attributed: any = syntheticView();
    for (const p of attributed.populations) p.cases = p.cases.filter((c: any) => c.detectors.length);
    expect(resolveQualificationCases(attributed, { kind: 'unattributed' }, 1)!.sections).toEqual([]);
  });

  test('rows past one page continue on the next, in order, with links both ways and no row lost or repeated', () => {
    const big = syntheticView({ extraCases: QUALIFICATION_CASE_PAGE_ROWS });
    const scope = { kind: 'family', family: 'family-a' } as const;
    const pages = qualificationCasePageCount(big, scope);
    expect(pages).toBeGreaterThan(1);
    const seen: string[] = [];
    for (let page = 1; page <= pages; page++) {
      const props = resolveQualificationCases(big, scope, page)!;
      const rows = props.sections.flatMap(s => s.rows);
      expect(rows.length).toBeLessThanOrEqual(QUALIFICATION_CASE_PAGE_ROWS);
      seen.push(...rows.map(r => r.key));
      expect(props.pager.previousHref).toBe(page > 1 ? `/evaluation/qualification/families/family-a/cases/${page - 1}/` : undefined);
      expect(props.pager.nextHref).toBe(page < pages ? `/evaluation/qualification/families/family-a/cases/${page + 1}/` : undefined);
    }
    const expected = big.populations.flatMap(p => p.cases.filter(c => c.detectors.includes('family-a')).map(c => `${p.population}/${c.id}`));
    expect(seen).toEqual(expected);
  });

  test('the export addresses are one per family page, plus the unattributed pages', () => {
    const params = qualificationCaseParams(view);
    expect(params.filter(p => p.family === 'family-a')).toEqual([{ family: 'family-a', page: '1' }]);
    expect(new Set(params.map(p => p.family))).toEqual(new Set(view.families.map(f => f.family)));
    expect(qualificationUnattributedParams(view)).toEqual([{ page: '1' }]);
  });

  test('the family and overview pages link to the case pages', () => {
    expect(resolveQualificationFamily(view, 'family-a')!.cases.href).toBe('/evaluation/qualification/families/family-a/cases/1/');
    expect(resolveQualificationOverview(view).unattributed.href).toBe('/evaluation/qualification/unattributed/1/');
  });
});
