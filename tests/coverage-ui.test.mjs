import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const coverage = await server.ssrLoadModule('/src/pages/coverage.ts');
const { fixtures } = await server.ssrLoadModule('/src/catalog.ts');
const { taxonomy } = await server.ssrLoadModule('/benchmarks/support/taxonomy.ts');
test.after(() => server.close());

const profileCoverage = {
  profilesVersion: 1, claimed: 'stable-documented', explicit: false, target: 'stable-documented', cellsMet: ['arrival-provisional'],
  cells: { totalFixtures: 1, positiveCases: 1, benignControls: 0, twinPairs: 0, positiveContextAxes: 1, controlAxes: 0, confusionAxes: 0, positiveContextAxisIds: ['env'], controlAxisIds: [], confusionAxisIds: [] },
  requiredCells: { totalFixtures: 24, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4 },
  requiredButEmptyAxisIds: ['controlAxes'], debt: [{ cell: 'totalFixtures', actual: 1, required: 24, shortfall: 23 }],
};
const matrix = {
  families: taxonomy.families.map(family => ({
    provider: family.provider, family: family.id, familyName: family.name,
    status: family.detectors.length ? 'provisional' : 'unsupported', detectors: family.detectors,
    reason: family.detectors.length ? 'evidence remains incomplete' : (family.note ?? 'No dedicated detector is recorded.'),
    profileCoverage: family.detectors.length ? structuredClone(profileCoverage) : null,
  })),
};

test('Coverage defaults to the complete provider tree and taxonomy-only state is Not measured', () => {
  assert.equal(coverage.coverageViewOf(''), 'providers');
  assert.equal(coverage.coverageViewOf('?show=detectors'), 'detectors');
  const html = coverage.coveragePage(fixtures, 'providers', undefined, null, 'No support matrix published', '');
  const plain = text(html);
  assert.match(plain, /credential families/);
  assert.match(plain, /aws:iam-user-access-key/);
  assert.match(plain, /Not measured/);
  assert.match(plain, /Global and unscoped controls/);
  assert.ok(html.includes('accuracy--documentation'));
  assert.doesNotMatch(plain, /0 findings across/);
});

test('representative AWS, GitHub, SendGrid and multi-family fixtures come only from semantic membership', () => {
  assert.ok(coverage.familyPage(undefined, fixtures, 'aws:iam-user-access-key', matrix, null).includes('accuracy--aws-id'));
  assert.ok(coverage.familyPage(undefined, fixtures, 'sendgrid:api-key', matrix, null).includes('common-formats--sendgrid-token-segmented-length-plain-twin'));
  const github = coverage.familyPage(undefined, fixtures, 'github:classic-personal-access-token', matrix, null);
  assert.ok(github.includes('accuracy--github-token'));
  assert.ok(github.includes('beta8-213a--github-token-github-app-identifiers-public-id'));
  assert.match(text(github), /multi-family/);
});

test('measured numeric zero, Unsupported, and Not measured retain different semantics', () => {
  const fixture = fixtures.find(item => item.slug === 'accuracy--github-token');
  const data = {
    run: { runId: 'run-1' }, hashes: {}, summary: undefined,
    loaded: [{ category: { id: fixture.category }, report: { runId: 'run-1', category: fixture.category, scanners: [
      { id: 'redact-secret', name: 'redact-secret', status: 'complete', observation: { source: 'fresh', sourceRunId: 'run-1', observedAt: '2026-09-26T00:00:00Z' }, rows: [{ id: fixture.id, findings: 0, actual: [] }] },
      { id: 'gitleaks', name: 'Gitleaks', status: 'complete', observation: { source: 'snapshot', sourceRunId: 'peer-run', observedAt: '2026-09-25T00:00:00Z', snapshotDigest: 'a'.repeat(64), inputDigest: 'b'.repeat(64) }, rows: [{ id: fixture.id, findings: 0, actual: [] }] },
    ] } }],
  };
  const measured = text(coverage.familyPage(data, [fixture], 'github:classic-personal-access-token', matrix, null));
  assert.match(measured, /0 findings across 1 fixtures/);
  assert.match(measured, /Fresh observation/);
  assert.match(measured, /Reused peer snapshot/);
  data.loaded[0].report.scanners[1].observation.snapshotDigest = 'a'.repeat(63);
  assert.match(text(coverage.familyPage(data, [fixture], 'github:classic-personal-access-token', matrix, null)), /Observation provenance is missing or invalid/);
  const unsupported = text(coverage.familyPage(undefined, fixtures, 'aws:sts-temporary-access-key', matrix, null));
  assert.match(unsupported, /Unsupported/);
  assert.match(unsupported, /Not measured/);
  assert.doesNotMatch(unsupported, /0 findings across/);
});

test('different valid snapshot identities across categories remain measured independently', () => {
  const selected = ['accuracy--github-token', 'beta8-213a--github-token-github-app-identifiers-public-id'].map(slug => fixtures.find(item => item.slug === slug));
  const loaded = selected.map((fixture, index) => ({ category: { id: fixture.category }, report: {
    runId: 'run-2', category: fixture.category, scanners: [
      { id: 'gitleaks', name: 'Gitleaks', status: 'complete', observation: { source: 'snapshot', sourceRunId: `peer-run-${index}`, observedAt: '2026-09-25T00:00:00Z', snapshotDigest: String(index + 1).repeat(64), inputDigest: String(index + 3).repeat(64) }, rows: [{ id: fixture.id, findings: 0, actual: [] }] },
    ],
  } }));
  const rendered = text(coverage.familyPage({ run: { runId: 'run-2' }, hashes: {}, summary: undefined, loaded }, selected, 'github:classic-personal-access-token', matrix, null));
  assert.match(rendered, /0 findings across 2 fixtures/);
  assert.equal((rendered.match(/Reused peer snapshot/g) ?? []).length, 2);
  assert.doesNotMatch(rendered, /Not measured/);
});

test('search, status, attention and sort remain represented in the provider tree response', () => {
  const html = coverage.coveragePage(fixtures, 'providers', undefined, matrix, null, '?q=sendgrid&status=provisional&attention=debt&sort=provider');
  assert.match(text(html), /SendGrid/);
  assert.doesNotMatch(text(html), /GitHub GitHub/);
  assert.match(html, /value="sendgrid"/);
  assert.match(html, /value="provisional" selected/);
  assert.match(html, /value="debt" selected/);
  assert.match(html, /value="provider" selected/);
});

test('tree and responsive CSS preserve keyboard-native details, nesting rail and bounded horizontal scroll', async () => {
  const html = coverage.coveragePage(fixtures, 'providers', undefined, matrix, null, '?q=github');
  assert.match(html, /<details class="provider-row"[^>]* open/);
  assert.match(html, /<summary>/);
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 1079px\)/);
  assert.match(css, /@media \(max-width: 759px\)/);
  assert.match(css, /border-left: var\(--rule-strong\) solid var\(--ink\)/);
  assert.match(css, /\.tbl \{ overflow-x: auto/);
  assert.match(css, /word-break: keep-all/);
  assert.match(css, /overflow-wrap: break-word/);
});
