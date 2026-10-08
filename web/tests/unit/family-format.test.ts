import { expect, test } from 'vitest';
import { resolveFamilyFormat } from '../../resolvers/family-format';
import type { ProjectedFamily, Research } from '../../services/research';

const family: ProjectedFamily = {
  name: 'Synthetic token', lifecycle: 'draft', record: 'records/families/acme/token.json',
  research: { state: 'researched', researchedAt: null, blockers: [], issues: [] },
  review: { history: null, events: 0, byType: {}, latest: null, decided: [] }, currentContract: 'acme:token@1',
  revisions: [{ id: 'acme:token@1', revision: 1, period: 'current', lifecycle: 'draft', supersedes: null, validity: { from: null, until: null }, current: true }],
  contract: { id: 'acme:token@1', structure: { descriptivePattern: '^acme_[A-Z]+$' }, claims: [{ id: 'prefix', statement: 'A prefix claim is unresolved.', evidenceClass: 'unresolved', temporality: 'historical', observedAt: '2099-01-02', sources: [{ sourceId: 'docs', supports: 'prefix', locator: '#tokens' }] }], openQuestions: [{ id: 'alphabet', question: 'Which alphabet?', raisedAt: '2099-01-03' }] },
};
const recorded: Research = { state: 'recorded', release: { repository: 'example/evidence', release: 'snapshot-2099', manifestDigest: '', recordsBundleDigest: '', commit: 'abcdef0', recordsTree: '', schemaRevision: '1.8.0' }, families: new Map([['acme:token', family]]), sources: new Map([['docs', { title: 'Synthetic docs', sourceType: 'provider-documentation', url: 'https://example.invalid/tokens', pin: 'live-unpinned', lastReadAt: '2099-01-01', lastOutcome: 'unreachable' }]]) };

test('a descriptive pattern never becomes inferred segments; claim class, temporal state and source dates remain distinct', () => {
  const result = resolveFamilyFormat(recorded, 'acme:token');
  expect(result.shape).toEqual([{ label: 'Descriptive pattern', value: '^acme_[A-Z]+$' }]);
  expect(result.claims[0]).toMatchObject({ evidenceLabel: 'Unresolved', temporality: 'historical', date: '2099-01-02' });
  expect(result.claims[0].sources[0]).toMatchObject({ href: 'https://example.invalid/tokens' });
  expect(result.claims[0].sources[0].detail).toContain('last read 2099-01-01 · latest outcome unreachable');
  expect(result.questions).toEqual([{ ref: 'acme:token@1#alphabet', at: '2099-01-03', text: 'Which alphabet?' }]);
});

test('missing family, absent projection and stale projection never render recorded facts', () => {
  for (const result of [resolveFamilyFormat(recorded, 'acme:absent'), resolveFamilyFormat({ state: 'absent' }, 'acme:token'), resolveFamilyFormat({ state: 'stale', release: recorded.release, pinned: 'snapshot-next', problems: [] }, 'acme:token')]) {
    expect(result.absent).toBeTruthy(); expect(result.shape).toEqual([]); expect(result.claims).toEqual([]);
  }
});

test('explicit structure fields are presented without inventing missing lengths or source classes', () => {
  const f = structuredClone(family); f.contract!.structure = { prefixes: ['acme_'], components: [{ name: 'body', role: 'body' }], separators: ['_'], length: { min: 10, max: 20 }, alphabet: { name: 'ASCII' }, checksum: 'Not specified' };
  const r: Research = { ...recorded, families: new Map([['acme:token', f]]) };
  const result = resolveFamilyFormat(r, 'acme:token');
  expect(result.shape.map(p => p.value)).toEqual(['acme_', 'Description not recorded', '_', 'min 10 · max 20', 'ASCII', 'Not specified']);
});
