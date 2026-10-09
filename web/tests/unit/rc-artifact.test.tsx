// @vitest-environment jsdom
/**
 * `/evaluation/rc` under the `new` authority (#658): the candidate is the candidate diff of a recorded replay, read from the internal projection
 * `results-output/candidate-diff-from-artifacts.json`, never from the legacy `candidate-evidence-v1.json`. The diff is generated at publish time and never
 * committed, so no test reads one from the ledger: every state is produced from a synthetic diff and a synthetic registry written into an overlay of the
 * repository (tests/unit/overlay.ts, tests/unit/rc-diff-fixtures.ts). Assertions are about states, structure and the counts of the synthetic rows a test wrote.
 */
import './next-mocks';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { authorityFile, overlay } from './overlay';
import { candidateDiff, DIFF_CANDIDATE_VERSION, DIFF_FILE, DIFF_POPULATIONS, PINNED_RELEASE, syntheticRegistry } from './rc-diff-fixtures';
import { CANDIDATE_COMMIT, RELEASE_COMMIT, candidateEvidence } from './rc-fixtures';

const LEGACY_EVIDENCE = 'public/results/candidate-evidence-v1.json';
const AUTHORITY = 'benchmarks/qualification-authority.json';
const pins = { 'benchmarks/pin-manifest.json': JSON.stringify({ pins: { redactSecretVersion: PINNED_RELEASE, releaseSourceRevision: RELEASE_COMMIT } }) };

async function load(files: Record<string, string | null>, authority: 'new' | 'legacy' = 'new') {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', overlay({ ...pins, ...syntheticRegistry, [AUTHORITY]: authorityFile(authority), ...files }));
  const services = await import('../../services/candidate');
  const resolvers = await import('../../resolvers/rc');
  const sources = await services.loadRcSources();
  return { sources, page: resolvers.resolveRcPage(sources) };
}

const diff = (options?: Parameters<typeof candidateDiff>[0]) => JSON.stringify(candidateDiff(options));

afterEach(() => vi.unstubAllEnvs());

describe('candidate service under the new authority', () => {
  test('no diff file: no candidate is recorded, and the reason names the projection', async () => {
    const { sources } = await load({ [DIFF_FILE]: null });
    expect(sources.authority).toBe('new');
    expect(sources.candidate).toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('candidate-diff-from-artifacts.json is absent') });
  });

  test('a current diff is recorded; the last release is the pinned one and has no saved baseline', async () => {
    const { sources } = await load({ [DIFF_FILE]: diff() });
    expect(sources.candidate).toMatchObject({ state: 'recorded', source: 'artifact', diff: { candidate: { version: DIFF_CANDIDATE_VERSION } } });
    expect(sources.release).toEqual({ version: PINNED_RELEASE, commit: RELEASE_COMMIT, baseline: null });
  });

  test('the legacy candidate evidence is never read under new: a valid legacy file and no diff is still not recorded', async () => {
    const { sources } = await load({ [DIFF_FILE]: null, [LEGACY_EVIDENCE]: JSON.stringify(candidateEvidence()) });
    expect(sources.candidate.state).toBe('not-recorded');
  });

  test.each([
    ['not JSON', '{broken', 'not JSON'],
    ['another schema', JSON.stringify({ ...candidateDiff(), schema: 'something/else/v1' }), 'not a redact-secret/candidate-diff-from-artifacts/v1 artifact'],
    ['a public projection', diff({ publication: 'public' }), 'exploratory and internal'],
    ['counts that do not add up', diff({ populations: [{ ...DIFF_POPULATIONS[0], unchanged: 99 }] }), 'do not add up'],
    ['no population', diff({ populations: [] }), 'no population is compared'],
  ])('%s is invalid and compares nothing', async (_name, text, reason) => {
    const { sources, page } = await load({ [DIFF_FILE]: text });
    expect(sources.candidate).toMatchObject({ state: 'invalid', reason: expect.stringContaining(reason) });
    expect(page.state).toBe('invalid');
    expect(page.levels).toBeNull();
  });

  test('a diff measured against an earlier release is stale, never current', async () => {
    const { sources } = await load({ [DIFF_FILE]: diff({ controlVersion: '9.9.9-beta.2' }) });
    expect(sources.candidate).toMatchObject({ state: 'stale', reason: expect.stringContaining(`the registry pins ${PINNED_RELEASE}`) });
  });

  test('a control that is not the canonical run of the registry is stale', async () => {
    const { sources } = await load({ [DIFF_FILE]: diff({ controlDigests: { 'regression-corpus': `sha256:${'f'.repeat(64)}` } }) });
    expect(sources.candidate).toMatchObject({ state: 'stale', reason: expect.stringContaining('regression-corpus') });
  });

  test('a candidate that is an earlier build than the pinned release is stale', async () => {
    const { sources } = await load({ [DIFF_FILE]: diff({ candidateVersion: '9.9.9-beta.2' }) });
    expect(sources.candidate).toMatchObject({ state: 'stale', reason: expect.stringContaining('earlier build') });
  });

  test('an unreadable diff fails the build with the file named', async () => {
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', overlay({ ...pins, ...syntheticRegistry, [AUTHORITY]: authorityFile('new'), [`${DIFF_FILE}/x`]: '' }));
    const { loadRcSources } = await import('../../services/candidate');
    await expect(loadRcSources()).rejects.toThrow('candidate-diff-from-artifacts.json is unreadable');
  });
});

describe('candidate service under the legacy authority (the rollback)', () => {
  test('the diff projection is not read: only the legacy evidence is', async () => {
    const { sources } = await load({ [DIFF_FILE]: diff(), [LEGACY_EVIDENCE]: null, 'baselines/9.9.9-beta.3.json': JSON.stringify({ version: PINNED_RELEASE }) }, 'legacy');
    expect(sources.authority).toBe('legacy');
    expect(sources.candidate).toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('candidate-evidence-v1.json is absent') });
  });
});

describe('the page under the new authority', () => {
  test('recorded: both builds, one row per population as the diff counted it, no sum, no case', async () => {
    const { page } = await load({ [DIFF_FILE]: diff() });
    expect(page.state).toBe('recorded');
    expect(page.builds.release).toMatchObject({ mode: 'published', heading: PINNED_RELEASE });
    expect(page.builds.release.facts.find(f => f.term === 'Commit')).toMatchObject({ value: RELEASE_COMMIT.slice(0, 7) });
    expect(page.builds.candidate).toMatchObject({ mode: 'candidate', heading: CANDIDATE_COMMIT.slice(0, 7), subheading: `declares ${DIFF_CANDIDATE_VERSION}` });
    expect(page.levels!.heading).toBe('Population');
    const rows = Object.fromEntries(page.levels!.rows.map(r => [r.id, [r.compared, r.regressed, r.improved, r.other, r.unchanged]]));
    expect(rows).toEqual({ 'public-evidence-snapshot': ['10', '1', '2', '3', '4'], 'regression-corpus': ['6', '0', '0', '0', '6'], 'policy-corpus': ['4', '0', '1', '0', '3'] });
    expect(page.differences).toBeNull();
    expect(page.moved).toBeNull();
    expect(JSON.stringify(page)).not.toContain('case-regressed-0');
  });

  test('says it is exploratory, and says so when a population has a worse case', async () => {
    const { page } = await load({ [DIFF_FILE]: diff() });
    expect(page.notes.map(n => n.title)).toEqual(['Exploratory replay', 'Some cases are worse']);
    const clean = (await load({ [DIFF_FILE]: diff({ populations: DIFF_POPULATIONS.map(p => ({ ...p, regressed: 0, unchanged: p.unchanged + p.regressed })) }) })).page;
    expect(clean.notes.map(n => n.title)).toEqual(['Exploratory replay']);
  });

  test('not recorded: the release alone and the way a replay is recorded, not the legacy command', async () => {
    const { page } = await load({ [DIFF_FILE]: null });
    expect(page.state).toBe('not-recorded');
    expect(page.notRecorded!.title).toBe('No release candidate is recorded');
    expect(page.notRecorded!.command).toContain('qualification:candidate-diff');
    expect(page.notRecorded!.command).not.toContain('eval:candidate');
    expect(page.builds.candidate).toBeUndefined();
    expect(page.levels).toBeNull();
  });

  test('stale: says the replay is not for the current release and shows no difference', async () => {
    const { page } = await load({ [DIFF_FILE]: diff({ controlVersion: '9.9.9-beta.2' }) });
    expect(page.state).toBe('stale');
    expect(page.notRecorded!.title).toBe('The recorded candidate replay is not for the current release');
    expect(page.levels).toBeNull();
  });

  async function renderPage(files: Record<string, string | null>) {
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', overlay({ ...pins, ...syntheticRegistry, [AUTHORITY]: authorityFile('new'), ...files }));
    const page = await import('../../app/evaluation/rc/page');
    return render(await page.default());
  }

  test('rendered: one h1, the builds, the population table and the performance block, and no list of moved fixtures', async () => {
    const { container } = await renderPage({ [DIFF_FILE]: diff() });
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    for (const name of ['Two builds, one set of evidence', 'By population', 'Performance cost']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fixtures that moved' })).toBeNull();
    const table = screen.getByRole('table', { name: /Cases per population/ });
    expect(within(table).getByRole('columnheader', { name: 'Population' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(1 + DIFF_POPULATIONS.length);
    expect(container.querySelectorAll('a[href*="/report/corpus/"]')).toHaveLength(0);
  });

  test('rendered with no diff: the not-recorded state, the last release for reference', async () => {
    await renderPage({ [DIFF_FILE]: null });
    expect(screen.getByRole('heading', { name: 'No release candidate is recorded' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The last release, for reference' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'By population' })).toBeNull();
  });
});
