// @vitest-environment node
/**
 * Which pipeline the credential pages are built from (#608): the one committed value, read by one service and applied by one seam
 * (`services/credential-source.ts`). The committed value itself is never asserted: a test chooses the pipeline in an overlay root, so the
 * suite means the same before and after the switch, and so the legacy data path stays under test while the new path is the authority.
 * Every view here is synthetic.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AUTHORITY_FILE, REAL_ROOT, authorityFile, edited, overlay } from './overlay';
import { syntheticView } from './qualification-data';
import type { QualificationView } from '../../services/qualification';

const dirs: string[] = [];
beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function results(view: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-authority-'));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  if (view !== undefined) writeFileSync(path.join(dir, 'qualification-v1.json'), typeof view === 'string' ? view : JSON.stringify(view));
  return dir;
}

/** The committed authority file, set to `new` and authorising exactly the view's policy revision and run digests. */
const authorising = (view: QualificationView): string => edited(AUTHORITY_FILE, file => {
  file.authority = 'new';
  file.new.policyRevision = view.policy.revision;
  file.new.semanticDigests = Object.fromEntries(view.populations.flatMap(p => [[p.population, p.artifact.semanticDigest], ...(p.methodsArtifact ? [[`${p.population}+methods`, p.methodsArtifact.semanticDigest]] : [])]));
});

async function modules(root: string, dir?: string) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  if (dir) vi.stubEnv('WEB_RESULTS_DIR', dir);
  return { authority: await import('../../services/authority'), source: await import('../../services/credential-source') };
}

describe('loadAuthority', () => {
  test('the committed file is valid and names one of the two pipelines', async () => {
    const { authority } = await modules(REAL_ROOT);
    const state = await authority.loadAuthority();
    expect(['legacy', 'new']).toContain(state.authority);
    expect(state.from).toBe('committed');
  });

  test.each(['legacy', 'new'] as const)('a root pinned to %s reads %s', async value => {
    const { authority } = await modules(overlay({ [AUTHORITY_FILE]: authorityFile(value) }));
    await expect(authority.loadAuthority()).resolves.toMatchObject({ authority: value, from: 'committed' });
  });

  test('an absent file means legacy, the state before the switch', async () => {
    const { authority } = await modules(overlay({ [AUTHORITY_FILE]: null }));
    await expect(authority.loadAuthority()).resolves.toMatchObject({ authority: 'legacy', from: 'default', file: undefined });
  });

  test.each([
    ['an unknown value', (v: any) => { v.authority = 'both'; }],
    ['another schema tag', (v: any) => { v.schema = 'redact-secret/qualification-authority/v2'; }],
    ['no authorisation block', (v: any) => { delete v.new; }],
    ['an extra field', (v: any) => { v.extra = true; }],
  ])('a file with %s fails the build instead of selecting a pipeline', async (_name, change) => {
    const { authority } = await modules(overlay({ [AUTHORITY_FILE]: edited(AUTHORITY_FILE, change) }));
    await expect(authority.loadAuthority()).rejects.toThrow(/qualification-authority\.json is invalid/);
  });

  test('the value is read once per build', async () => {
    const { authority } = await modules(overlay({ [AUTHORITY_FILE]: authorityFile('legacy') }));
    expect(await authority.loadAuthority()).toBe(await authority.loadAuthority());
  });
});

describe('viewAuthorisationProblems', () => {
  const view = syntheticView();
  const file = JSON.parse(authorising(view));

  test('the view the authorisation names has no problem', async () => {
    const { source } = await modules(overlay({}));
    expect(source.viewAuthorisationProblems(file, view)).toEqual([]);
  });

  test('another policy revision, another run, a missing run and an extra named run are each a problem', async () => {
    const { source } = await modules(overlay({}));
    const policy = structuredClone(view); policy.policy.revision = `rs-policy-1:sha256:${'1'.repeat(64)}`;
    expect(source.viewAuthorisationProblems(file, policy).join(' ')).toContain('policy');
    const run = structuredClone(view); run.populations[0].artifact.semanticDigest = `sha256:${'2'.repeat(64)}`;
    expect(source.viewAuthorisationProblems(file, run).join(' ')).toContain('other than the authorised one');
    const missing = structuredClone(view); missing.populations.pop();
    expect(source.viewAuthorisationProblems(file, missing).join(' ')).toContain('does not carry');
    const methods = structuredClone(view); methods.populations[0].methodsArtifact = { semanticDigest: `sha256:${'3'.repeat(64)}` };
    expect(source.viewAuthorisationProblems(file, methods).join(' ')).toContain('methods run');
  });
});

describe('loadCredentialSource', () => {
  test('authority legacy: the legacy corpora and run, with bytes, and no view', async () => {
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorityFile('legacy') }));
    const loaded = await source.loadCredentialSource();
    expect(loaded.pipeline).toMatchObject({ authority: 'legacy', from: 'committed' });
    expect(loaded.pipeline.view).toBeUndefined();
    expect(loaded.fixtureBytes.size).toBe(loaded.catalog.fixtures.length);
    expect([...loaded.fixtureBytes.values()].every(f => f.contentRecorded !== false)).toBe(true);
    expect(loaded.support).toBeUndefined();
  });

  test('authority new with an authorised view: the catalog and the run are the view, with no bytes', async () => {
    const view = syntheticView();
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorising(view) }), results(view));
    const loaded = await source.loadCredentialSource();
    const population = view.populations.find(p => p.role === 'floors-and-gates')!;
    expect(loaded.pipeline).toMatchObject({ authority: 'new', view: { state: 'ready', population: population.population, semanticDigest: population.artifact.semanticDigest } });
    expect(loaded.catalog.fixtures.map(f => f.slug).sort()).toEqual(population.cases.map(c => c.id).sort());
    expect([...loaded.fixtureBytes.values()].every(f => f.contentRecorded === false && f.content === '')).toBe(true);
    expect(loaded.run.state).toBe('measured');
    if (loaded.run.state !== 'measured') return;
    expect(loaded.run.scanners.map(s => s.id)).toEqual(population.artifact.scanners.map(s => s.id));
    expect(loaded.run.productVersion).toBe(population.artifact.scanners.find(s => s.id === 'redact-secret')!.version);
    expect(loaded.support?.familyCount).toBe(view.families.length);
    expect(loaded.fixtureHashes.size).toBe(0);
  });

  test('the report population is the one the population policy gives the floors and gates, and no other is pooled into it', async () => {
    const view = syntheticView();
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorising(view) }), results(view));
    const loaded = await source.loadCredentialSource();
    const roles = view.populations.map(p => p.role);
    expect(roles.filter(r => r === 'floors-and-gates')).toHaveLength(1);
    const own = view.populations.find(p => p.role === 'floors-and-gates')!;
    expect(loaded.catalog.fixtures).toHaveLength(own.cases.length);
    expect(loaded.catalog.fixtures.every(f => f.slug.startsWith(`${own.population}--`))).toBe(true);
  });

  test.each([
    ['not built', undefined, 'not-built', 'absent'],
    ['not JSON', '{nope', 'incompatible', 'not valid JSON'],
  ])('authority new with a view that is %s: no numbers, the reason and the commands, never the legacy files', async (_name, content, state, reason) => {
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorityFile('new') }), results(content));
    const loaded = await source.loadCredentialSource();
    expect(loaded.pipeline).toMatchObject({ authority: 'new', view: { state, reason: expect.stringContaining(reason), commands: expect.arrayContaining([expect.stringContaining('qualification:view')]) } });
    expect(loaded.run).toMatchObject({ state: 'not-published' });
    expect(loaded.catalog.fixtures).toHaveLength(0);
    expect(loaded.catalog.suites.map(s => s.id)).toEqual([source.NO_VIEW_SUITE]);
    expect(loaded.catalog.taxonomy.families.length).toBeGreaterThan(0);
    expect(loaded.fixtureBytes.size).toBe(0);
  });

  test('WEB_REQUIRE_QUALIFICATION=1 fails a build whose view cannot be used, instead of publishing "no view"; a usable view is unaffected', async () => {
    vi.stubEnv('WEB_REQUIRE_QUALIFICATION', '1');
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorityFile('new') }), results(undefined));
    await expect(source.loadCredentialSource()).rejects.toThrow(/WEB_REQUIRE_QUALIFICATION=1 .*not-built/);
    const view = syntheticView();
    const ok = await modules(overlay({ [AUTHORITY_FILE]: authorising(view) }), results(view));
    await expect(ok.source.loadCredentialSource()).resolves.toMatchObject({ pipeline: { view: { state: 'ready' } } });
    const legacy = await modules(overlay({ [AUTHORITY_FILE]: authorityFile('legacy') }));
    await expect(legacy.source.loadCredentialSource()).resolves.toMatchObject({ pipeline: { authority: 'legacy' } });
  });

  test('authority new with a view built from other pins is stale, with its reason', async () => {
    const view = syntheticView();
    view.populations[0].artifact.engine.version = '0.0.0-other';
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorising(view) }), results(view));
    await expect(source.loadCredentialSource()).resolves.toMatchObject({ pipeline: { view: { state: 'stale', reason: expect.stringContaining('0.0.0-other') } }, run: { state: 'not-published' } });
  });

  test('authority new with a view the authorisation does not name is unauthorised, and shows nothing', async () => {
    const view = syntheticView();
    const other = structuredClone(view);
    other.policy.revision = `rs-policy-1:sha256:${'7'.repeat(64)}`;
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorising(other) }), results(view));
    const loaded = await source.loadCredentialSource();
    expect(loaded.pipeline.view).toMatchObject({ state: 'unauthorised', reason: expect.stringContaining('authorisation') });
    expect(loaded.run.state).toBe('not-published');
    expect(loaded.catalog.fixtures).toHaveLength(0);
  });

  test('the legacy source is the legacy files whatever the authority is: what the oracle pages read', async () => {
    const view = syntheticView();
    const { source } = await modules(overlay({ [AUTHORITY_FILE]: authorising(view) }), results(view));
    const legacy = await source.loadLegacySource();
    const current = await source.loadCredentialSource();
    expect(legacy.pipeline.authority).toBe('legacy');
    expect(legacy.catalog.fixtures.length).not.toBe(current.catalog.fixtures.length);
    expect(legacy.fixtureBytes.size).toBe(legacy.catalog.fixtures.length);
  });
});
