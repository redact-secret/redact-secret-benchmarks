import test from 'node:test';
import assert from 'node:assert/strict';
import { supportPage, supportFilterOf, SUPPORT_STATUS_COPY } from '../src/pages/support.ts';
import { supportMatrixProblem, orderedFamilies, providerName, SUPPORT_STATUSES } from '../src/support-model.ts';
import { checkSupportUi } from '../scripts/check-support-ui.mjs';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';
import { statusCriteria } from '../benchmarks/support/status.ts';
import { parseRoute, isAppPath } from '../src/model.mjs';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const detected = taxonomy.families.filter(f => f.detectors.length);
const undetected = taxonomy.families.filter(f => !f.detectors.length);

/** A published matrix shaped exactly like `generate-support-matrix.ts` writes one, with statuses the caller chooses. */
function matrixOf(statusFor) {
  const families = taxonomy.families.map(family => {
    const status = statusFor(family);
    const hasDetector = family.detectors.length > 0;
    return {
      provider: family.provider, family: family.id, familyName: family.name, status,
      evidenceTier: hasDetector ? 'T1' : null,
      providerSource: hasDetector ? { url: 'https://docs.example.invalid/tokens', observedAt: '2026-09-17', formatVersion: '2026-09', covers: 'prefix and body' } : null,
      corroboratingScanners: hasDetector ? ['gitleaks 8.30.1'] : [],
      twinCoverage: hasDetector ? { pairs: 3, failures: 1, unprobeable: null } : null,
      unresolvedCriticalItems: hasDetector ? { metamorphic: 0, mutation: 2, differential: 0 } : null,
      detectors: hasDetector ? [family.detectors[0]] : [],
      reason: status === 'stable' ? null : `${status} because the evidence says so`,
    };
  });
  const distribution = Object.fromEntries(SUPPORT_STATUSES.map(status => [status, families.filter(f => f.status === status).length]));
  return {
    schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-09-20T09:00:00.000Z', runId: 'abcdef1234', revision: 'f'.repeat(40), dirty: false, criteriaSchemaVersion: 1 },
    providerCount: taxonomy.providers.length, familyCount: families.length, distribution, families,
  };
}
/** The default view: detector-bearing families provisional, detectorless families unsupported. */
const mixed = () => matrixOf(family => (family.detectors.length ? 'provisional' : 'unsupported'));
const rowsOf = html => [...html.matchAll(/<tr data-support-status="([^"]*)" data-family="([^"]*)"/g)].map(m => ({ status: m[1], family: m[2] }));

test('the CI gate that keeps the page\'s statuses the matrix\'s vocabulary passes on this tree', async () => {
  assert.deepEqual(await checkSupportUi(), []);
});

test('no status is authored in the UI: the page renders what the matrix says, and a change in the matrix changes the page', () => {
  const subject = detected[0];
  const before = mixed();
  assert.equal(supportMatrixProblem(before), null);
  const beforeRow = rowsOf(supportPage(before, null)).find(row => row.family === subject.id);
  assert.deepEqual(beforeRow, { status: 'provisional', family: subject.id });

  // Only the data moves: same page function, same arguments, one status changed upstream.
  const after = matrixOf(family => (family.id === subject.id ? 'stable' : family.detectors.length ? 'provisional' : 'unsupported'));
  assert.equal(supportMatrixProblem(after), null);
  const afterRow = rowsOf(supportPage(after, null)).find(row => row.family === subject.id);
  assert.deepEqual(afterRow, { status: 'stable', family: subject.id });
  const html = supportPage(after, null);
  assert.ok(text(html).includes(`${subject.name} ${subject.id} Stable`), 'the family reads Stable on the page');
  assert.equal(rowsOf(html).filter(row => row.status === 'stable').length, after.distribution.stable);
});

test('every status is legible without the qualification profile, and provisional is not read as almost stable', () => {
  const html = supportPage(mixed(), null), plain = text(html);
  for (const status of SUPPORT_STATUSES) {
    const copy = SUPPORT_STATUS_COPY[status];
    assert.ok(plain.includes(copy.meaning), `${status} states what it means to a reader`);
    assert.ok(plain.includes(copy.rationale), `${status} carries the profile's own rationale`);
    assert.ok(html.includes(`<div class="chg" data-support-status="${status}">`), `${status} has a legend entry`);
  }
  assert.ok(SUPPORT_STATUS_COPY.provisional.meaning.includes('incomplete') && SUPPORT_STATUS_COPY.provisional.meaning.includes('almost stable'),
    'provisional says evidence-incomplete, and says what it is not');
  assert.ok(plain.includes(statusCriteria.stable.minimumTwinPairs.rationale) && plain.includes(`at least ${statusCriteria.stable.minimumTwinPairs.value}`),
    'the stable floors are shown with the profile\'s own numbers and reasons');
  assert.ok(!/almost stable\b(?!”)/i.test(plain.replace(/not “almost stable”/gi, '')), 'nothing on the page calls provisional almost stable');
});

test('unsupported families are listed with their reason, never dropped', () => {
  const matrix = mixed(), html = supportPage(matrix, null), rows = rowsOf(html);
  assert.equal(rows.length, taxonomy.families.length, 'every taxonomy family has a row');
  assert.equal(rows.filter(r => r.status === 'unsupported').length, undetected.length);
  const family = undetected[0], entry = matrix.families.find(f => f.family === family.id);
  const plain = text(html);
  assert.ok(plain.includes(`${family.name} ${family.id} Unsupported`), 'the unsupported family is visible');
  assert.ok(plain.includes(entry.reason), 'with the reason recorded in the matrix');
  assert.ok(plain.includes('No detector is registered for this family'), 'and says why there is no evidence to open');

  const filtered = supportPage(matrix, null, 'unsupported');
  assert.deepEqual([...new Set(rowsOf(filtered).map(r => r.status))], ['unsupported']);
  assert.equal(rowsOf(filtered).length, undetected.length);
  assert.equal(supportFilterOf('?status=unsupported'), 'unsupported');
  assert.equal(supportFilterOf('?status=excellent'), 'all');
});

test('the evidence behind a status stays inspectable: tier, provider source and twin coverage', () => {
  const matrix = mixed(), family = detected[0];
  const html = supportPage(matrix, null), plain = text(html);
  const entry = matrix.families.find(f => f.family === family.id);
  assert.ok(html.includes(`<details data-key="support:${family.id}">`), 'each family opens its own evidence');
  assert.ok(html.includes(`href="/coverage/${entry.detectors[0]}"`), 'the deciding detector links to its coverage page');
  assert.ok(plain.includes('T1 · Provider-documented'), 'the tier is named, not just coded');
  assert.ok(html.includes(`href="${entry.providerSource.url}"`) && plain.includes(`observed ${entry.providerSource.observedAt}`), 'the provider source is reachable');
  assert.ok(plain.includes('3 pairs · 1 failure'), 'twin coverage is shown with its failures');
  assert.ok(plain.includes('metamorphic 0 · mutation 2 · differential 0'), 'unresolved critical items are shown');
  assert.ok(plain.includes(entry.reason), 'and the reason the status was decided');
});

test('an un-probeable family reads as un-probeable, not as zero twins', () => {
  const matrix = mixed(), family = detected[0];
  const entry = matrix.families.find(f => f.family === family.id);
  entry.twinCoverage = { pairs: 0, failures: 0, unprobeable: { reason: 'The provider documents nothing a twin could mutate.', observedAt: '2026-09-20' } };
  const plain = text(supportPage(matrix, null));
  assert.ok(plain.includes('un-probeable · The provider documents nothing a twin could mutate.'));
  assert.ok(plain.includes('checked 2026-09-20'));
});

test('a malformed, miscounted or stale matrix is refused before it can be rendered', () => {
  const invalid = value => assert.notEqual(supportMatrixProblem(value), null);
  invalid(null);
  invalid({ ...mixed(), schemaVersion: 2 });
  invalid({ ...mixed(), families: mixed().families.map(f => ({ ...f, status: 'excellent' })) });
  const miscounted = mixed();
  miscounted.distribution = { ...miscounted.distribution, stable: miscounted.distribution.stable + 1 };
  invalid(miscounted);
  const stale = mixed();
  stale.families = stale.families.map((f, i) => (i === 0 ? { ...f, family: 'nowhere:invented-family' } : f));
  invalid(stale);
  const unexplained = mixed();
  unexplained.families = unexplained.families.map((f, i) => (i === 0 ? { ...f, status: 'pending', reason: null } : f));
  invalid(unexplained);
  const renamed = mixed();
  renamed.families = renamed.families.map((f, i) => (i === 0 ? { ...f, familyName: 'Renamed in the UI' } : f));
  invalid(renamed);
  assert.equal(supportMatrixProblem(mixed()), null);
});

test('with nothing published the page says what to run, and the route is part of the app', () => {
  const html = supportPage(null, 'No support matrix published');
  assert.ok(text(html).includes('No support matrix published'));
  assert.ok(html.includes('npm run eval:classify\nnpm run eval:matrix\nnpm run eval:publish:matrix'));
  assert.ok(!/sorry|apolog|oops|unfortunately/i.test(text(html)));
  assert.equal(rowsOf(html).length, 0);
  assert.equal(parseRoute('/support').kind, 'support');
  assert.equal(parseRoute('/support/').kind, 'support');
  assert.equal(parseRoute('/support/github').kind, 'missing');
  assert.ok(isAppPath('/support'));
});

test('families read in provider order, with the non-provider-specific formats last', () => {
  const matrix = mixed(), ordered = orderedFamilies(matrix);
  assert.equal(ordered.length, matrix.families.length);
  const firstNull = ordered.findIndex(entry => entry.provider === null);
  if (firstNull !== -1) assert.ok(ordered.slice(firstNull).every(entry => entry.provider === null), 'nothing provider-specific sorts after them');
  const names = ordered.filter(entry => entry.provider !== null).map(entry => providerName(entry.provider));
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.equal(providerName(null), 'Not provider-specific');
  assert.equal(providerName('github'), taxonomy.providers.find(p => p.id === 'github').name);
});

test('the page says which redact-secret the statuses were measured against', () => {
  const published = mixed();
  assert.equal(supportMatrixProblem(published), null);
  assert.match(text(supportPage(published, null)), /Measured the published redact-secret package/);
  const candidate = mixed();
  candidate.sourceReport.product = { sourceCommit: 'a'.repeat(40), packageName: '@redact-secret/core', declaredVersion: '0.1.0-beta.7', artifacts: [{ role: 'package', sha256: 'b'.repeat(64) }] };
  assert.equal(supportMatrixProblem(candidate), null);
  const html = supportPage(candidate, null);
  assert.match(text(html), /Measured candidate redact-secret 0\.1\.0-beta\.7 at aaaaaaa/);
  assert.match(html, /href="https:\/\/github\.com\/redact-secret\/redact-secret\/commit\/a{40}"/);
  candidate.sourceReport.product.sourceCommit = 'main';
  assert.match(supportMatrixProblem(candidate), /Invalid support-matrix contract/);
});
