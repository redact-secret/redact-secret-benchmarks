import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareResult, normalizeFindings, outcomeTable } from '../benchmarks/lib/adversarial-first-run.ts';
import { derivedQualification, expectationsDigest, validateIntake } from '../benchmarks/lib/adversarial-intake.ts';
import { SOURCES, fixtures as authoredFixtures } from '../adversarial/packs/beta9-external-inputs/build-intake.mjs';

const pack = fileURLToPath(new URL('../adversarial/packs/beta9-external-inputs/', import.meta.url));
const intake = JSON.parse(readFileSync(`${pack}intake.json`, 'utf8'));
const firstRunBytes = readFileSync(`${pack}first-run.json`, 'utf8');
const sources = JSON.parse(readFileSync(`${pack}sources.json`, 'utf8'));

test('normalizeFindings sorts, de-duplicates and merges overlaps, keeping touching ranges apart', () => {
  assert.deepEqual(normalizeFindings([{ start: 10, end: 20 }, { start: 0, end: 5 }, { start: 10, end: 20 }, { start: 15, end: 30 }, { start: 30, end: 31 }, { start: 4, end: 4 }]),
    [{ start: 0, end: 5 }, { start: 10, end: 30 }, { start: 30, end: 31 }]);
  assert.deepEqual(normalizeFindings([]), []);
});

test('compareResult separates full, overbroad, partial and missed coverage from flagged benign input', () => {
  const redact = { action: 'must-redact', expected: [{ start: 5, end: 10 }, { start: 20, end: 25 }] };
  const result = findings => ({ fixtureId: 'x', scanner: 's', status: 'complete', findings });
  assert.equal(compareResult(redact, result([{ start: 5, end: 10 }, { start: 20, end: 25 }])), 'redacted');
  assert.equal(compareResult(redact, result([{ start: 0, end: 30 }])), 'overbroad');
  assert.equal(compareResult(redact, result([{ start: 5, end: 10 }])), 'partial');
  assert.equal(compareResult(redact, result([{ start: 11, end: 19 }])), 'missed');
  assert.equal(compareResult(redact, { ...result([]), status: 'failed' }), 'scanner-failed');
  const benign = { action: 'must-not-flag', expected: [] };
  assert.equal(compareResult(benign, result([])), 'clean');
  assert.equal(compareResult(benign, result([{ start: 0, end: 1 }])), 'flagged');
});

test('the beta9-external-inputs pack satisfies the intake contract and stays maintainer regression', () => {
  assert.deepEqual(validateIntake(intake, firstRunBytes), []);
  assert.equal(intake.author.affiliation, 'project-maintainer');
  assert.equal(derivedQualification(intake), 'maintainer-regression');
  assert.equal(intake.qualification, 'maintainer-regression');
  assert.ok(intake.fixtures.every(f => f.credentialStatus === 'synthetic'));
  assert.ok(intake.fixtures.length >= 50 && intake.fixtures.length <= 100);
});

test('the authoring tool reproduces the submitted fixtures, so every range comes from a marked credential part', () => {
  const rebuilt = authoredFixtures().map(b => b.fixture);
  assert.equal(expectationsDigest(rebuilt), intake.expectations.digest);
  assert.deepEqual(rebuilt, intake.fixtures);
});

test('every fixture names pinned, licensed external sources and a #140 category', () => {
  assert.deepEqual(sources.fixtures.map(f => f.id), intake.fixtures.map(f => f.id));
  assert.deepEqual(sources.sources, SOURCES);
  for (const fixture of sources.fixtures) {
    assert.ok(fixture.sources.length > 0 && fixture.sources.every(key => SOURCES[key]), fixture.id);
    assert.ok(['verbatim', 'composed'].includes(fixture.excerpt), fixture.id);
  }
  for (const source of Object.values(SOURCES)) {
    assert.ok(source.license && source.authors && /^https:\/\//.test(source.url));
    if (source.url.startsWith('https://github.com/')) assert.match(source.url, /\/[0-9a-f]{40}\//, `${source.title} is pinned to a commit`);
  }
  const categories = new Set(sources.fixtures.map(f => f.issueCategory));
  assert.ok(categories.size >= 8, 'category diversity');
});

test('the frozen first run covers every fixture × scanner with ranges only', () => {
  const run = JSON.parse(firstRunBytes);
  assert.deepEqual(run.scanners.map(s => s.name), ['redact-secret', 'gitleaks', 'trufflehog', 'flare-redact']);
  assert.equal(run.results.length, intake.fixtures.length * run.scanners.length);
  for (const result of run.results) assert.deepEqual(Object.keys(result).sort(), ['findings', 'fixtureId', 'scanner', 'status']);
  const table = outcomeTable(intake.fixtures, run);
  for (const counts of table.values()) {
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), intake.fixtures.length);
  }
});
