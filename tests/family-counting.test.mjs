// The family fixture-counting rule (docs/specs/taxonomy.md, "Counting fixtures per
// family"; decision 2026-09-30-count-a-fixture-in-every-family-it-is-related-to, #560).
// Reads the committed taxonomy and semantic index and pins the relation between the
// new rule (web/resolvers/families.ts) and the existing report tree
// (src/pages/report-hierarchy.ts), which stays as published.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportTree } from '../src/pages/report-hierarchy.ts';
import { resolveFamilyList } from '../web/resolvers/families.ts';

const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const taxonomy = read('benchmarks/support/taxonomy.json');
const index = read('benchmarks/fixture-index.json');

// The corpus tier of each fixture is not in the index; the rule under test is level-blind, so a stable
// synthetic tier (from the slug) exercises the per-level partition without reading the corpora.
const TIERS = ['T0', 'T1', 'T2', 'T3'];
const tierOf = slug => TIERS[[...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % 4];

const fixtures = index.fixtures.map(f => ({
  slug: f.slug, category: f.slug.split('--')[0], id: f.slug.split('--').slice(1).join('--'), group: 'g', kind: 'must-redact', tier: tierOf(f.slug),
  familyIds: f.familyIds, ...(f.unscopedReason ? { unscopedReason: f.unscopedReason } : {}),
  scenarioIds: f.scenarioIds, assessment: { kind: 'must-redact', tier: tierOf(f.slug) },
}));
const catalog = (() => {
  const fixturesByFamily = new Map();
  for (const f of fixtures) for (const id of f.familyIds) (fixturesByFamily.get(id) ?? fixturesByFamily.set(id, []).get(id)).push(f);
  return {
    fixtures, bySlug: new Map(fixtures.map(f => [f.slug, f])), taxonomy,
    providerById: new Map(taxonomy.providers.map(p => [p.id, p])), familyById: new Map(taxonomy.families.map(f => [f.id, f])),
    fixturesByFamily, detectorCount: 0,
  };
})();

test('the new rule counts a fixture in every family it is related to', () => {
  const list = resolveFamilyList(catalog, undefined);
  for (const f of list.families) {
    const expected = index.fixtures.filter(x => x.familyIds.includes(f.row.id)).length;
    assert.equal(f.row.fixtures, expected.toLocaleString('en-US'), f.row.id);
  }
});

test('a provider counts each fixture once however many of its families it is related to', () => {
  const list = resolveFamilyList(catalog, undefined);
  for (const p of list.providers.filter(p => p.group.id !== 'not-provider-specific')) {
    const ids = new Set(taxonomy.families.filter(f => f.provider === p.group.id).map(f => f.id));
    const distinct = index.fixtures.filter(x => x.familyIds.some(id => ids.has(id))).length;
    assert.equal(p.group.fixturesLabel, `${distinct.toLocaleString('en-US')} ${distinct === 1 ? 'fixture' : 'fixtures'}`, p.group.id);
  }
});

test('the existing tree and the rule agree on single-family fixtures and differ by the multi-family ones', () => {
  const tree = buildReportTree(fixtures, [], taxonomy);
  const inTree = new Map();
  let bucket = [];
  for (const provider of tree.providers) for (const family of provider.families) {
    if (provider.special) bucket = family.leaves.map(l => l.fixture.slug);
    else inTree.set(family.id, family.leaves.map(l => l.fixture.slug));
  }
  const multi = index.fixtures.filter(f => f.familyIds.length > 1);
  const global = index.fixtures.filter(f => f.familyIds.length === 0);
  // The tree's shared bucket is exactly the multi-family plus the global fixtures.
  assert.deepEqual([...bucket].sort(), [...multi, ...global].map(f => f.slug).sort());
  // No fixture is lost or counted twice in the tree.
  const seen = [...inTree.values()].flat().concat(bucket);
  assert.equal(new Set(seen).size, seen.length);
  assert.equal(seen.length, index.fixtures.length);
  // Per family: rule count = tree count + multi-family fixtures related to it. A family the tree omits has zero tree rows.
  const list = resolveFamilyList(catalog, undefined);
  let differing = 0;
  for (const f of list.families) {
    const single = (inTree.get(f.row.id) ?? []).length;
    const withMulti = multi.filter(x => x.familyIds.includes(f.row.id)).length;
    assert.equal(f.row.fixtures, (single + withMulti).toLocaleString('en-US'), f.row.id);
    if (withMulti) differing++;
  }
  assert.ok(differing > 0, 'the corpus has multi-family fixtures, so the two views differ for some families');
});

test('per-level counts partition a family and recount with the same rule', () => {
  const all = resolveFamilyList(catalog, undefined, 'all');
  const levels = TIERS.map(level => resolveFamilyList(catalog, undefined, level));
  all.families.forEach((family, i) => {
    const sum = levels.reduce((n, l) => n + Number(l.families[i].row.fixtures.replaceAll(',', '')), 0);
    assert.equal(sum, Number(family.row.fixtures.replaceAll(',', '')), family.row.id);
    for (const l of levels) assert.equal(l.families[i].row.counts === null, l.families[i].row.fixtures === '0', 'no fixtures reads as null, never zeros');
  });
  // A level's list links carry the level so a family opens on the same rows.
  const t2 = levels[2];
  assert.ok(t2.families.every(f => f.row.href.endsWith('?level=T2')));
  assert.ok(all.families.every(f => !f.row.href.includes('?')));
  // Global fixtures are in no row at any level.
  assert.equal(levels.reduce((n, l) => n + l.totals.global, 0), all.totals.global);
});
