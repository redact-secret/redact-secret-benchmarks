// @vitest-environment jsdom
/**
 * `/evaluation/rc` (#613). The candidate evidence is generated at publish time and never committed, so no
 * test reads one from the ledger: every state is produced from synthetic evidence written into an overlay of the
 * repository (tests/unit/overlay.ts, tests/unit/rc-fixtures.ts). Assertions are about states, structure and the
 * counts of the synthetic rows a test wrote, never about a number from the committed ledger or a real run.
 */
import './next-mocks';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { classify, outcomeText, resolveRcPage, MOVED_LIMIT, type RcPage } from '../../resolvers/rc';
import { overlay } from './overlay';
import { CANDIDATE_COMMIT, RELEASE_COMMIT, RELEASE_VERSION, ROWS, candidateEvidence, syntheticRelease, type Row } from './rc-fixtures';

const RESULT = 'public/results/candidate-evidence-v1.json';

async function load(files: Record<string, string | null>) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', overlay({ ...syntheticRelease, ...files }));
  const services = await import('../../services/candidate');
  const resolvers = await import('../../resolvers/rc');
  return { sources: await services.loadRcSources(), resolvers };
}

afterEach(() => vi.unstubAllEnvs());

describe('candidate service', () => {
  test('no evidence file: not recorded, and the reason names the file', async () => {
    const { sources } = await load({ [RESULT]: null });
    expect(sources.candidate).toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('candidate-evidence-v1.json is absent') });
  });

  test('evidence that is not JSON is invalid', async () => {
    const { sources } = await load({ [RESULT]: '{broken' });
    expect(sources.candidate).toMatchObject({ state: 'invalid', reason: expect.stringContaining('not JSON') });
  });

  test('evidence that breaks the contract is invalid and says so', async () => {
    const { sources } = await load({ [RESULT]: JSON.stringify({ ...candidateEvidence(), supportClaims: true }) });
    expect(sources.candidate.state).toBe('invalid');
  });

  test('valid evidence is recorded with the baseline file it compared against', async () => {
    const { sources } = await load({ [RESULT]: JSON.stringify(candidateEvidence()) });
    expect(sources.candidate).toMatchObject({ state: 'recorded', against: { version: RELEASE_VERSION, runId: expect.any(String) } });
    expect(sources.release).toMatchObject({ version: RELEASE_VERSION, commit: RELEASE_COMMIT, baseline: { version: RELEASE_VERSION } });
  });

  test('evidence measured against a baseline that is not saved is still recorded', async () => {
    const { sources } = await load({ [RESULT]: JSON.stringify(candidateEvidence({ baselineVersion: '0.0.0-unsaved' })) });
    expect(sources.candidate).toMatchObject({ state: 'recorded', against: null });
  });

  test('with no baseline saved for the pin, the newest saved baseline is the last release', async () => {
    const { sources } = await load({
      [RESULT]: null,
      'benchmarks/pin-manifest.json': JSON.stringify({ pins: { redactSecretVersion: '0.0.0-no-baseline', releaseSourceRevision: RELEASE_COMMIT } }),
    });
    expect(sources.release.baseline).not.toBeNull();
    expect(sources.release.version).toBe(sources.release.baseline!.version);
    expect(sources.release.commit).toBeNull();
  });

  test('an unreadable evidence file fails the build with the file named', async () => {
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', overlay({ ...syntheticRelease, 'public/results/candidate-evidence-v1.json/x': '' }));
    const { loadRcSources } = await import('../../services/candidate');
    await expect(loadRcSources()).rejects.toThrow('candidate-evidence-v1.json is unreadable');
  });
});

describe('outcomeText and classify', () => {
  test('outcome codes read as words', () => {
    expect(outcomeText(null)).toBe('Not recorded');
    expect(outcomeText('clean')).toBe('Not flagged');
    expect(outcomeText('flagged:1')).toBe('Flagged, 1 finding');
    expect(outcomeText('flagged:3')).toBe('Flagged, 3 findings');
    expect(outcomeText('observed:2')).toBe('Observed, 2 ranges');
    expect(outcomeText('EXACT')).toBe('Exact');
    expect(outcomeText('EXACT,EXACT,PARTIAL')).toBe('Exact ×2, Partial');
    expect(outcomeText('ODD')).toBe('ODD');
  });

  test('each synthetic move is classified by the Workbench rules', () => {
    const pair = (r: Row) => ({ slug: r.fixtureId, kind: r.kind, tier: r.tier, section: 'fixed-corpus' as const, before: r.before, after: r.after });
    const by = Object.fromEntries(ROWS.filter(r => r.section !== 'expanded-corpus').map(r => [r.fixtureId.split('--')[1], classify(pair(r))]));
    expect(by).toEqual({ 'regress-miss': 'regressed', 'regress-alarm': 'regressed', improve: 'improved', 'shape-only': 'other', 'policy-moved': 'other', pending: 'other', 'same-1': 'unchanged', 'same-2': 'unchanged' });
  });
});

async function recorded(options: Parameters<typeof candidateEvidence>[0] = {}): Promise<RcPage> {
  const { sources, resolvers } = await load({ [RESULT]: JSON.stringify(candidateEvidence(options)) });
  return resolvers.resolveRcPage(sources);
}

describe('resolveRcPage, candidate recorded', () => {
  test('names both builds with their mode, commit link and run', async () => {
    const page = await recorded();
    expect(page.state).toBe('recorded');
    expect(page.builds.release).toMatchObject({ mode: 'published', heading: RELEASE_VERSION });
    expect(page.builds.release.facts.find(f => f.term === 'Commit')).toMatchObject({ value: RELEASE_COMMIT.slice(0, 7), href: expect.stringContaining(RELEASE_COMMIT) });
    expect(page.builds.candidate).toMatchObject({ mode: 'candidate', heading: CANDIDATE_COMMIT.slice(0, 7), subheading: 'declares 9.9.10-synthetic' });
    expect(page.builds.candidate!.facts.find(f => f.term === 'Commit')).toMatchObject({ value: CANDIDATE_COMMIT, href: expect.stringContaining(CANDIDATE_COMMIT) });
    expect(page.builds.candidate!.facts.find(f => f.term === 'Date')!.value).toBe('Measured 2030-01-02');
    expect(page.differences!.stamp.from).toContain(`published ${RELEASE_VERSION}`);
    expect(page.differences!.stamp.to).toContain('candidate ccccccc');
    expect(page.notes).toEqual([]);
  });

  test('counts the synthetic fixed-corpus rows by direction and never adds the expanded row', async () => {
    const page = await recorded();
    const tile = (label: string) => page.differences!.tiles.find(t => t.label === label)!.value;
    expect([tile('Regressed'), tile('Improved'), tile('Other change'), tile('Unchanged')]).toEqual(['2', '1', '3', '2']);
    const levels = Object.fromEntries(page.levels!.rows.map(r => [r.id, [r.compared, r.regressed, r.improved, r.other, r.unchanged]]));
    expect(levels).toEqual({ T1: ['3', '1', '1', '0', '1'], T2: ['3', '1', '0', '1', '1'], T3: ['1', '0', '0', '1', '0'], T0: ['1', '0', '0', '1', '0'] });
    expect(page.levels!.expanded).toContain('1 row added');
    expect(page.differences!.figures.map(f => f.label)).toEqual(['Required secrets left readable', 'False alarms on controls']);
  });

  test('lists the moved fixtures with links to the fixture page and recorded outcome words', async () => {
    const page = await recorded();
    const [regressed, improved] = page.moved!.groups;
    expect(regressed.label).toBe('Regressed · 2');
    expect(improved.label).toBe('Improved · 1');
    expect(regressed.rows[0]).toMatchObject({ title: 'regress-miss', href: '/report/corpus/suite-a/?fixture=regress-miss', before: 'Exact', after: 'Miss' });
    expect(page.moved!.truncated).toBeUndefined();
  });

  test('a group longer than the list is cut and the heading keeps the whole count', async () => {
    const many: Row[] = Array.from({ length: MOVED_LIMIT + 5 }, (_, i) => ({ fixtureId: `suite-a--r${i}`, kind: 'must-redact', tier: 'T1', before: 'EXACT', after: 'MISS' }));
    const page = await recorded({ rows: many });
    expect(page.moved!.groups[0].label).toBe(`Regressed · ${MOVED_LIMIT + 5}`);
    expect(page.moved!.groups[0].rows).toHaveLength(MOVED_LIMIT);
    expect(page.moved!.truncated).toContain(String(MOVED_LIMIT));
  });

  test('incomplete, filtered, dirty and failed evidence each say so', async () => {
    const page = await recorded({ status: 'incomplete', filter: 'some-detector', sourceState: 'dirty', failures: [{ phase: 'scan', code: 'timeout' }] });
    expect(page.notes.map(n => n.title)).toEqual(['Evidence is incomplete', 'Filtered run', 'Product tree was not clean', '1 failure recorded']);
    expect(page.notes.every(n => n.tone === 'warning')).toBe(true);
  });

  test('a fixture with no candidate outcome is left out of every count and named in a note', async () => {
    const page = await recorded({ rows: [...ROWS, { fixtureId: 'suite-c--unscanned', kind: 'must-redact', tier: 'T1', before: 'EXACT', after: null }] });
    expect(page.notes.map(n => n.title)).toContain('1 fixture not compared');
    expect(page.differences!.tiles.find(t => t.label === 'Unchanged')!.value).toBe('2');
  });

  test('evidence measured against another baseline than the pinned release says which', async () => {
    const page = await recorded({ baselineVersion: '0.0.0-older' });
    expect(page.notes.map(n => n.title)).toEqual(['Compared with 0.0.0-older']);
    expect(page.builds.release.heading).toBe('0.0.0-older');
    expect(page.builds.release.facts.find(f => f.term === 'Commit')!.value).toBe('Not recorded for this version');
  });

  test('performance: a candidate with no run of its own says nothing is estimated', async () => {
    const page = await recorded();
    expect(page.performance.text).toMatch(/nothing is estimated/);
  });
});

describe('resolveRcPage, no candidate', () => {
  test('not recorded: no difference, no level table, the release alone and the way to record a candidate', async () => {
    const { sources, resolvers } = await load({ [RESULT]: null });
    const page = resolvers.resolveRcPage(sources);
    expect(page.state).toBe('not-recorded');
    expect(page.differences).toBeNull();
    expect(page.levels).toBeNull();
    expect(page.moved).toBeNull();
    expect(page.builds.candidate).toBeUndefined();
    expect(page.builds.release.mode).toBe('published');
    expect(page.notRecorded!.title).toBe('No release candidate is recorded');
    expect(page.notRecorded!.command).toContain('eval:candidate');
    expect(page.performance.heading).toBe('No candidate to compare');
  });

  test('invalid evidence names the reason and still compares nothing', async () => {
    const { sources, resolvers } = await load({ [RESULT]: '{broken' });
    const page = resolvers.resolveRcPage(sources);
    expect(page.state).toBe('invalid');
    expect(page.notRecorded!.title).toBe('The candidate evidence did not validate');
    expect(page.notRecorded!.paragraphs[0]).toContain('not JSON');
    expect(page.differences).toBeNull();
  });

  test('performance: states for an unpublished accepted run and for a run of the candidate commit itself', () => {
    const base = { authority: 'legacy' as const, candidate: { state: 'not-recorded' as const, reason: 'x' }, release: { version: 'v', commit: null, baseline: null } };
    const unpublished = resolveRcPage({ ...base, performance: { state: 'not-published', reason: 'evidence/x is absent.' } });
    expect(unpublished.performance).toMatchObject({ heading: 'No performance run is recorded', text: expect.stringContaining('evidence/x is absent.') });
    const measured = { state: 'measured' as const, sourceCommit: CANDIDATE_COMMIT, repetitions: 5, summaryPath: 'p', runner: null, rows: [] };
    const recordedCandidate = { state: 'recorded' as const, source: 'legacy' as const, report: candidateEvidence() as never, against: null };
    const same = resolveRcPage({ authority: 'legacy', candidate: recordedCandidate, release: base.release, performance: measured });
    expect(same.performance.heading).toBe('Not recorded as a before and after');
    const other = resolveRcPage({ authority: 'legacy', candidate: recordedCandidate, release: base.release, performance: { ...measured, sourceCommit: RELEASE_COMMIT } });
    expect(other.performance.heading).toBe('No performance run names this candidate');
  });
});

describe('the page', () => {
  async function renderPage(files: Record<string, string | null>) {
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', overlay({ ...syntheticRelease, ...files }));
    const page = await import('../../app/evaluation/rc/page');
    return render(await page.default());
  }

  test('candidate recorded: one h1, the two builds, the differences, the levels and the moved fixtures', async () => {
    const { container } = await renderPage({ [RESULT]: JSON.stringify(candidateEvidence()) });
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    for (const name of ['Two builds, one corpus', 'What differs', 'By evidence level', 'Fixtures that moved', 'Performance cost']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    const commit = screen.getByRole('link', { name: CANDIDATE_COMMIT });
    expect(commit).toHaveAttribute('href', expect.stringContaining(CANDIDATE_COMMIT));
    expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    expect(screen.getAllByText('candidate').length).toBeGreaterThan(0);
    const moved = screen.getByRole('region', { name: /Fixtures whose recorded outcome moved/ });
    expect(within(moved).getByRole('link', { name: 'regress-miss' })).toHaveAttribute('href', expect.stringMatching(/\/report\/corpus\/suite-a\/?\?fixture=regress-miss$/));
    expect(screen.queryByRole('heading', { name: 'No release candidate is recorded' })).toBeNull();
  });

  test('no candidate: the not-recorded story, the last release and no comparison blocks', async () => {
    await renderPage({ [RESULT]: null });
    expect(screen.getByRole('heading', { name: 'No release candidate is recorded' })).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded', { selector: '[data-status]' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'The last release, for reference' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Command: Nothing is compared/)).toHaveTextContent('eval:candidate');
    for (const name of ['What differs', 'By evidence level', 'Fixtures that moved']) expect(screen.queryByRole('heading', { name })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Performance cost' })).toBeInTheDocument();
  });

  test('invalid evidence: says it did not validate', async () => {
    await renderPage({ [RESULT]: '{broken' });
    expect(screen.getByRole('heading', { name: 'The candidate evidence did not validate' })).toBeInTheDocument();
  });

  test('warnings from the evidence render as notes', async () => {
    await renderPage({ [RESULT]: JSON.stringify(candidateEvidence({ status: 'incomplete' })) });
    expect(screen.getAllByRole('note').some(n => /Evidence is incomplete/.test(n.textContent ?? ''))).toBe(true);
  });
});
