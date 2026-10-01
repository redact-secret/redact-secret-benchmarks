// Unit tests for the family page's resolver and dossier service (#589). Synthetic catalog, run and dossier
// data for the resolver; the committed dossiers for the parser (read as files, no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveFamily } from '../web/resolvers/families.ts';
import { inlineParts, kindsText, resolveBenchmark, resolveNotes, resolveRules, resolveSources, resolveStatus } from '../web/resolvers/family-detail.ts';
import { parseDossierNotes } from '../web/services/dossiers.ts';

const root = path.resolve(import.meta.dirname, '..');
process.env.WEB_REPO_ROOT = root;

const fx = (slug, kind, tier, familyIds) => ({ slug, category: 'c', id: slug, group: 'g', kind, tier, familyIds });
const fixtures = [
  fx('a1', 'must-redact', 'T1', ['x:one']),
  fx('a2', 'must-redact', 'T1', ['x:one', 'y:two']),
  fx('a3', 'must-not-flag', 'T2', ['x:one']),
  fx('a4', 'must-redact', 'T2', ['x:one']),
  fx('a5', 'policy', 'T3', ['x:one']),
];
const taxonomy = {
  providers: [{ id: 'x', name: 'Xco' }, { id: 'y', name: 'Yco' }],
  families: [
    { id: 'x:one', provider: 'x', name: 'One', description: 'd1', detectors: ['det-one'], sources: ['https://docs.example.com/a#b'] },
    { id: 'y:two', provider: 'y', name: 'Two', description: 'd2', detectors: [] },
  ],
};
const catalog = {
  fixtures, bySlug: new Map(fixtures.map(f => [f.slug, f])), taxonomy,
  providerById: new Map(taxonomy.providers.map(p => [p.id, p])), familyById: new Map(taxonomy.families.map(f => [f.id, f])),
  fixturesByFamily: new Map([['x:one', fixtures], ['y:two', [fixtures[1]]]]), detectorCount: 0,
};
const productRows = new Map([
  ['a1', { spanOutcomes: ['EXACT'] }],
  ['a2', { spanOutcomes: ['MISS'] }],
  ['a3', { flagged: true }],
  // a4: no row; a5 below
  ['a5', { spanOutcomes: ['OVERBROAD'] }],
]);
const peerRows = new Map([['a1', { spanOutcomes: ['MISS'] }], ['a2', { spanOutcomes: ['MISS'] }], ['a3', { flagged: false }], ['a4', { spanOutcomes: ['EXACT'] }], ['a5', { spanOutcomes: ['EXACT'] }]]);
const run = {
  state: 'measured', mode: 'published', productVersion: '9.9.9', generatedAt: '2026-10-01T00:00:00Z',
  scanners: [
    { id: 'redact-secret', name: 'redact-secret', version: '9.9.9', mode: 'Published package', status: 'complete', observations: [], rows: productRows },
    { id: 'peer-a', name: 'Peer A', version: '1.0', mode: 'Directory scan', status: 'complete', observations: [], rows: peerRows },
    { id: 'peer-b', name: 'Peer B', version: null, mode: 'Defaults', status: 'failed', observations: [], rows: new Map() },
  ],
  productRows,
};
const peers = new Map([
  ['peer-a', { id: 'peer-a', kind: 'repository-scanner', kindLabel: 'Repository scanner', rulesByFamily: new Map([['x:one', [{ rule: 'one-rule', basis: 'x_ + 40 characters' }]]]), ruleFileVersion: '2.0', reviewedAt: '2026-09-30' }],
  ['peer-b', { id: 'peer-b', kind: 'runtime-library', kindLabel: 'Runtime library', rulesByFamily: new Map(), ruleFileVersion: '3.1', reviewedAt: '2026-09-30' }],
]);

test('dossier prose becomes text, code and https links, with no markup left over', () => {
  assert.deepEqual(inlineParts('prefix `acme_` then **22** characters, see [`spec.md`](https://example.com/spec.md) or [local](docs/a.md).'), [
    'prefix ', { code: 'acme_' }, ' then ', '22', ' characters, see ', { href: 'https://example.com/spec.md', text: 'spec.md' }, ' or [local](docs/a.md).',
  ]);
  assert.deepEqual(inlineParts('plain'), ['plain']);
});

test('a dossier body yields each family\'s labelled notes, joins continuation lines and drops empty bullets', () => {
  const text = [
    '---', 'provider: x', 'families: []', '---', '', '# X', '', '## Families', '',
    '### `x:one` — One', '', '- **Shape:** prefix `a_`, then', '  22 characters.', '- **Sources:**', '- **Collisions:** none known.', '- **Open caveat:** one;', '', '  two.', '',
    '### `x:two` — Two', '', '- **Shape:**', '', '## Open questions', '', '- **Shape:** not a family note', '',
  ].join('\n');
  const parsed = parseDossierNotes(text);
  assert.deepEqual(parsed.get('x:one'), [
    { label: 'Shape', text: 'prefix `a_`, then 22 characters.' }, { label: 'Collisions', text: 'none known.' }, { label: 'Open caveat', text: 'one; two.' },
  ]);
  assert.deepEqual(parsed.get('x:two'), []);
  assert.equal(parsed.size, 2);
});

test('every committed dossier note parses to plain text, code and https links', () => {
  const dir = path.join(root, 'benchmarks/support/dossiers');
  const all = [];
  for (const file of readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_'))) {
    for (const [, notes] of parseDossierNotes(readFileSync(path.join(dir, file), 'utf8'))) all.push(...notes);
  }
  assert.ok(all.length > 500, `${all.length} notes`);
  for (const note of all) {
    for (const part of inlineParts(note.text)) {
      if (typeof part === 'string') assert.ok(!part.includes('**') && !part.includes('`'), `raw markup left in ${note.label}: ${part.slice(0, 60)}`);
      else if ('href' in part) assert.match(part.href, /^https:\/\//);
    }
  }
});

test('the GitHub fine-grained dossier records its prefix and the shape as written', () => {
  const notes = parseDossierNotes(readFileSync(path.join(root, 'benchmarks/support/dossiers/github.md'), 'utf8')).get('github:fine-grained-personal-access-token');
  const shape = notes.find(n => n.label === 'Shape').text;
  assert.match(shape, /`github_pat_`/);
  assert.ok(notes.some(n => n.label === 'Open caveat'));
});

test('notes land under the three headings; a blank dossier has none, and an unresearched family reads "Not recorded"', () => {
  const dossier = {
    id: 'x:one', verdict: 'ready', tier: 'T2', researchedAt: '2026-09-29', sources: [], issues: [], evidence: null, blockedBy: 'a ruling',
    notes: [{ label: 'Shape', text: 'prefix `a_`' }, { label: 'Sources', text: 's' }, { label: 'Collisions', text: 'c' }, { label: 'Open caveat', text: 'o' }, { label: 'Verdict', text: 'ignored' }],
  };
  const n = resolveNotes(dossier);
  assert.deepEqual(n.format.map(i => i.term), ['Shape', 'Basis']);
  assert.deepEqual(n.lookAlikes.map(i => i.term), ['Collisions']);
  assert.deepEqual(n.open.map(i => i.term), ['Blocked by', 'Open caveat']);
  assert.deepEqual(resolveNotes(undefined), { format: [], lookAlikes: [], open: [] });
  assert.deepEqual(resolveStatus(dossier).map(i => [i.label, i.value, i.tone]), [['Research', 'Ready', 'neutral'], ['Evidence level', 'T2 · Tool-corroborated', 'neutral'], ['Researched', '2026-09-29', 'neutral']]);
  const none = resolveStatus({ ...dossier, verdict: 'unresearched', tier: null, researchedAt: null });
  assert.deepEqual(none.map(i => [i.value, i.tone]), [['Not researched', 'not-measured'], ['Not recorded', 'not-measured'], ['Not recorded', 'not-measured']]);
});

test('benchmark counts are the family page\'s own counts, per level and per scanner, with "—" where nothing is recorded', () => {
  const detail = resolveFamily(catalog, 'x:one', productRows);
  const data = resolveBenchmark({ family: taxonomy.families[0], fixtures, run, peers, facts: detail.facts, rowsHref: '#family-rows' });
  assert.equal(data.mode, 'published · redact-secret 9.9.9');
  assert.deepEqual(data.facts, detail.facts, 'the headline counts are the existing resolver\'s');
  assert.equal(data.kinds, '5 fixtures: 3 expect a redaction, 1 must stay quiet, 1 record project policy.');
  // Levels partition the family: the per-level fixture counts add up to the headline count.
  assert.deepEqual(data.levels.map(l => [l.id, l.fixtures, l.leftReadable, l.tooMuch, l.falseAlarms, l.notMeasured]), [
    ['T1', '2', '1', '0', '0', undefined], ['T2', '2', '0', '0', '1', '1'], ['T3', '1', '0', '1', '0', undefined],
  ]);
  assert.equal(data.levels.reduce((n, l) => n + Number(l.fixtures), 0), fixtures.length);
  // Scanners in run order; counts use the same outcome rules; a scanner with no row anywhere is "—", never zero.
  assert.deepEqual(data.scanners.map(s => s.id), ['redact-secret', 'peer-a', 'peer-b']);
  const [own, a, b] = data.scanners;
  assert.deepEqual([own.leftReadable, own.tooMuch, own.falseAlarms, own.notMeasured], ['1', '1', '1', '1']);
  assert.deepEqual([a.leftReadable, a.tooMuch, a.falseAlarms, a.notMeasured], ['2', '0', '0', undefined]);
  assert.deepEqual([b.leftReadable, b.tooMuch, b.falseAlarms, b.notMeasured], ['—', '—', '—', '5']);
  assert.deepEqual([own.rules, a.rules, b.rules], ['1 detector mapped', '1 rule targets it', 'No rule maps to it']);
  assert.equal(a.kind, 'Repository scanner');
  assert.equal(own.kind, 'Product measured here');
});

test('a single level has no per-level table and says which level it is; a candidate run says candidate', () => {
  const only = [fixtures[0], fixtures[1]];
  const detail = resolveFamily({ ...catalog, fixturesByFamily: new Map([['x:one', only]]) }, 'x:one', productRows);
  const data = resolveBenchmark({ family: taxonomy.families[0], fixtures: only, run: { ...run, mode: 'candidate', candidate: { sourceCommit: '1a2b3c4d5e', declaredVersion: '1.0.0' } }, peers, facts: detail.facts, rowsHref: '#r' });
  assert.match(data.mode, /^candidate · redact-secret main 1a2b3c4 · unreleased$/);
  assert.match(data.kinds, /All at the T1 level, provider-documented\.$/);
});

test('no run: fixtures are counted and every outcome is "—" and not measured, never zero', () => {
  const detail = resolveFamily(catalog, 'x:one', undefined);
  const data = resolveBenchmark({ family: taxonomy.families[0], fixtures, run: undefined, peers, facts: detail.facts, rowsHref: '#r' });
  assert.equal(data.mode, null);
  assert.deepEqual(data.scanners, []);
  assert.ok(data.levels.every(l => l.leftReadable === '—' && l.falseAlarms === '—' && l.notMeasured === l.fixtures));
  assert.match(data.runNote, /not measured/);
});

test('a family with no fixtures has no facts, levels or scanners: the block draws "Not measured"', () => {
  const data = resolveBenchmark({ family: taxonomy.families[1], fixtures: [], run, peers, facts: undefined, rowsHref: '#r' });
  assert.deepEqual({ ...data }, { mode: 'published · redact-secret 9.9.9', facts: [], kinds: '', levels: [], scanners: [] });
  assert.equal(kindsText([]), '');
});

test('peer rules for the family are listed with their basis; scanners without one are named', () => {
  const names = new Map([['peer-a', 'Peer A'], ['peer-b', 'Peer B']]);
  const rules = resolveRules('x:one', peers, names);
  assert.deepEqual(rules.rules, [{ scanner: 'Peer A · rules 2.0', rule: 'one-rule', basis: 'x_ + 40 characters' }]);
  assert.deepEqual(rules.withoutRules, ['Peer B']);
  assert.match(rules.reviewed, /reviewed 2026-09-30/);
  assert.deepEqual(resolveRules('y:two', peers, names).rules, []);
});

test('sources merge the taxonomy and the dossier without repeating one, and link the research issues', () => {
  const dossier = { id: 'x:one', verdict: 'ready', tier: 'T1', researchedAt: '2026-09-29', sources: ['https://docs.example.com/a#b', 'https://other.example.com/c'], issues: ['o/r#5'], evidence: 'https://github.com/o/r/blob/0123456789abcdef0123456789abcdef01234567/e.md', blockedBy: null, notes: [] };
  const s = resolveSources(taxonomy.families[0], dossier);
  assert.deepEqual(s.sources.map(x => x.href), ['https://docs.example.com/a#b', 'https://other.example.com/c']);
  assert.deepEqual(s.sources[0], { href: 'https://docs.example.com/a#b', label: 'docs.example.com', detail: '/a#b' });
  assert.deepEqual(s.log.map(x => x.href), ['https://github.com/o/r/issues/5', 'https://github.com/o/r/blob/0123456789abcdef0123456789abcdef01234567/e.md']);
  assert.equal(s.researched, 'Researched 2026-09-29.');
  assert.deepEqual(resolveSources({ id: 'y:two', provider: 'y', name: 'Two', description: '', detectors: [] }, undefined), { sources: [], log: [] });
});
