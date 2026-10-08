// @vitest-environment node
/**
 * The family research record (#591, #590, #582): the service's states over overlays of the committed tree, and the pure resolver over
 * synthetic projected records. No value of the committed projection or the ledger is asserted.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { edited, overlay } from './overlay';
import { researchLine, resolveResearchRecord, revisionText } from '../../resolvers/family-research';
import type { ProjectedFamily, Research } from '../../services/research';

const FILE = 'benchmarks/support/research-projection.json';

async function research(root: string) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  return (await import('../../services/research')).loadResearch();
}

beforeEach(() => { vi.unstubAllEnvs(); });

describe('services/research', () => {
  test('the committed projection is recorded and bound to the pin', async () => {
    const r = await research(overlay({}));
    expect(r.state).toBe('recorded');
  });

  test('a projection from another release than the pin is stale and names both releases', async () => {
    const r = await research(overlay({
      'benchmarks/official-runs.json': edited('benchmarks/official-runs.json', v => {
        v.populations.find((p: { id: string }) => p.id === 'public-evidence-snapshot').evidence.release.tag = 'snapshot-2099.01.01';
      }),
    }));
    expect(r.state).toBe('stale');
    if (r.state === 'stale') expect(r.pinned).toBe('snapshot-2099.01.01');
  });

  test('no projection file is absent; a projection with a support status fails the build', async () => {
    expect((await research(overlay({ [FILE]: null }))).state).toBe('absent');
    const bad = overlay({ [FILE]: edited(FILE, v => { const first = Object.keys(v.families)[0]; v.families[first].supportStatus = 'stable'; }) });
    await expect(research(bad)).rejects.toThrow('research-projection.json is invalid');
  });
});

const release = { repository: 'example/evidence', release: 'snapshot-2099.01.01', manifestDigest: `sha256:${'a'.repeat(64)}`, recordsBundleDigest: `sha256:${'b'.repeat(64)}`, commit: '0123456789abcdef0123456789abcdef01234567', recordsTree: `records-tree-sha256:${'c'.repeat(64)}`, schemaRevision: '1.8.0' };

const family = (over: Partial<ProjectedFamily> = {}): ProjectedFamily => ({
  name: 'Personal token', lifecycle: 'draft', record: 'records/families/acme/personal-token.json',
  research: { state: 'researched', researchedAt: '2099-01-02', blockers: [{ kind: 'issuance-gated', summary: 'one issued token would settle it' }, { kind: 'documentation-gated', summary: 'no page states the body' }], issues: [] },
  review: { history: 'review-acme-personal-token', events: 3, byType: { authored: 1, observed: 1, decided: 1 }, latest: { seq: 3, type: 'decided', at: '2099-01-03', role: 'maintainer', affiliation: 'project-maintainer' }, decided: [{ ref: 'review-acme-personal-token#3', at: '2099-01-03', note: 'ruled' }] },
  currentContract: 'acme:personal-token@2',
  revisions: [
    { id: 'acme:personal-token@1', revision: 1, period: 'historical', lifecycle: 'draft', supersedes: null, validity: { from: null, until: '2098-12-31' }, current: false },
    { id: 'acme:personal-token@2', revision: 2, period: 'current', lifecycle: 'draft', supersedes: 'acme:personal-token@1', validity: { from: '2099-01-01', until: null }, current: true },
  ],
  contract: { id: 'acme:personal-token@2', structure: {}, claims: [], openQuestions: [] },
  ...over,
});
const recorded = (f?: ProjectedFamily): Research => ({ state: 'recorded', release, families: new Map(f ? [['acme:personal-token', f]] : []), sources: new Map() });

describe('resolveResearchRecord', () => {
  test('review state, format revision, research state and date are four cells; blockers, rulings and revisions are separate lines', () => {
    const r = resolveResearchRecord(recorded(family()), 'acme:personal-token');
    expect(r.absent).toBeUndefined();
    expect(r.facts.map(f => `${f.label}: ${f.value}`)).toEqual(['Review state: Draft, not reviewed', 'Format revision: 2 · current', 'Research: Researched', 'Researched: 2099-01-02']);
    expect(r.blockers.map(b => b.ref)).toEqual(['Issuance-gated', 'Documentation-gated']);
    expect(r.rulings).toEqual([{ ref: 'review-acme-personal-token#3', at: '2099-01-03', text: 'ruled' }]);
    expect(r.revisions.map(v => v.detail)).toEqual([
      'historical · draft, not reviewed · superseded by @2 · issued until 2098-12-31',
      'current · draft, not reviewed · supersedes @1 · issued from 2099-01-01 · the family\'s current revision',
    ]);
    expect(r.review).toMatch(/Project-maintained review is not independent validation/);
    expect(r.recordHref).toBe(`https://github.com/example/evidence/blob/${release.commit}/records/families/acme/personal-token.json`);
    expect(JSON.stringify(r)).not.toMatch(/stable|provisional|supported/i);
  });

  test('maintainer-only uses the owner\'s fixed words; one revision lists none; no current revision says so', () => {
    const r = resolveResearchRecord(recorded(family({ lifecycle: 'maintainer-only', revisions: [family().revisions[0]], currentContract: null, contract: { id: 'acme:personal-token@1', structure: {}, claims: [], openQuestions: [] } })), 'acme:personal-token');
    expect(r.facts[0].value).toBe('Maintainer-reviewed (independent review pending)');
    expect(r.facts[1].value).toBe('1 · historical, none current');
    expect(r.revisions).toEqual([]);
  });

  test('absent family, absent projection and stale projection are "Not recorded" with the reason, never a value', () => {
    const missing = resolveResearchRecord(recorded(), 'acme:personal-token');
    const none = resolveResearchRecord({ state: 'absent' }, 'acme:personal-token');
    const stale = resolveResearchRecord({ state: 'stale', release, pinned: 'snapshot-2099.02.01', problems: [] }, 'acme:personal-token');
    for (const r of [missing, none, stale]) {
      expect(r.absent?.text).toBeTruthy();
      expect(r.facts.every(f => f.value === 'Not recorded' && f.tone === 'not-measured')).toBe(true);
    }
    expect(stale.absent?.text).toContain('snapshot-2099.02.01');
  });

  test('the provider list line', () => {
    expect(researchLine(family())).toBe('Draft, not reviewed · format revision 2 · current');
    expect(researchLine(family({ contract: null, revisions: [], currentContract: null }))).toBe('Draft, not reviewed · no format revision recorded');
    expect(researchLine(undefined)).toBe('Research record not recorded');
    expect(revisionText(family({ contract: null }))).toBeNull();
  });
});
