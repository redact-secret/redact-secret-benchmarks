import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { cohorts, contracts, classifyFixture, validateAssessment } from '../benchmarks/lib/cohorts.mjs';
import { scoreCohorts } from '../benchmarks/lib/reporting.mjs';
import { validateStructures } from '../benchmarks/lib/validate-structures.mjs';
import { reportProblem, summarize } from '../src/model.mjs';
import { normalizeTrufflehogFindings } from '../scanners/index.mjs';

const generated = buildCorpora();
const common = generated['common-formats'].fixtures;
const legacy = generated['detector-coverage'].fixtures;
const get = id => legacy.find(f => f.id === id);

test('every family has an audit entry and every fixture has input-derived classification', async () => {
  const registry = JSON.parse(await readFile(new URL('../benchmarks/detectors.json', import.meta.url)));
  assert.deepEqual(Object.keys(contracts).sort(), registry.detectors.map(d => d.id).sort());
  for (const [category, corpus] of Object.entries(generated)) for (const f of corpus.fixtures) {
    validateAssessment(f);
    assert.deepEqual(f.assessment, classifyFixture(category, f), f.id);
  }
  assert.equal(classifyFixture('unknown', { id: 'future', content: 'secret', expected: [{ start: 0, end: 6 }] }).cohort, 'unreviewed');
  assert.throws(() => validateAssessment({ id: 'missing' }), /assessment/);
  assert.throws(() => validateAssessment({ ...common[0], assessment: { cohort: 'common-format', reason: 'Unsupported promotion', contract: 'pypi-token', sources: contracts['pypi-token'].sources } }), /validator/);
});

test('malformed fixtures and missing context cannot pass as common provider formats', () => {
  for (const id of ['anthropic-token-shape-1-bare', 'openai-token-shape-1-bare', 'slack-token-shape-1-bare', 'pypi-token-shape-1-bare', 'docker-token-shape-1-bare', 'cloudflare-token-shape-1-bare', 'vault-token-shape-1-bare', 'private-key-private-key-bare', 'jwt-expired-fabricated-bare']) assert.equal(get(id).assessment.cohort, 'malformed-example', id);
  for (const id of ['aws-access-key-shape-1-bare', 'shopify-token-shape-1-bare', 'connection-string-postgres-bare', 'generic-token-api-key-bare']) assert.equal(get(id).assessment.cohort, 'masking', id);
  for (const id of ['supabase-token-shape-1-bare', 'vercel-token-shape-1-bare', 'linear-token-shape-2-bare']) assert.equal(get(id).assessment.cohort, 'unreviewed', id);
  const anthropic = structuredClone(common.find(f => f.id === 'anthropic-token-api03-plain'));
  anthropic.content = anthropic.content.replace(/AA\n/, 'AB\n');
  assert.throws(() => validateAssessment(anthropic), /contract/);
  const shopify = structuredClone(common.find(f => f.id === 'shopify-token-shpat-plain'));
  shopify.content = shopify.content.replace('.myshopify.com', '.example.invalid');
  assert.throws(() => validateAssessment(shopify), /domain/);
  const aws = structuredClone(common.find(f => f.id === 'aws-access-key-pair-plain'));
  aws.expected.pop();
  assert.throws(() => validateAssessment(aws), /pair/);
});

test('cryptographic controls parse and signatures verify; corrupted signatures are rejected', () => {
  validateStructures(common);
  const corrupt = structuredClone(common);
  const jwt = corrupt.find(f => f.id === 'jwt-eddsa-plain');
  const at = jwt.content.lastIndexOf('.') + 1;
  jwt.content = jwt.content.slice(0, at) + (jwt.content[at] === 'A' ? 'B' : 'A') + jwt.content.slice(at + 1);
  assert.throws(() => validateStructures(corrupt), /signature/);
  const invalid = structuredClone(common);
  const key = invalid.find(f => f.id === 'private-key-ed25519-plain');
  key.content = key.content.replace('MC4C', 'AAAA');
  assert.throws(() => validateStructures(invalid));
});

test('mixed suites export separate denominators and no score for pending-review inputs', () => {
  const selected = [common[0], get('aws-access-key-shape-1-bare'), get('anthropic-token-shape-1-bare'), get('vercel-token-shape-1-bare')];
  const findings = selected.flatMap(f => f.expected.map(r => ({ path: f.path, start: r.start, end: r.end })));
  const result = scoreCohorts(selected, findings);
  for (const key of ['tp', 'fp', 'fn', 'tn', 'precision', 'recall', 'f1', 'contained']) assert.equal(result[key], undefined);
  for (const id of Object.keys(cohorts)) assert.equal(result.cohorts[id].fixtureCount, 1);
  assert.equal(result.cohorts['common-format'].tp, 1);
  assert.equal(result.cohorts.unreviewed.scored, false);
  const pending = result.rows.find(r => r.assessment.cohort === 'unreviewed');
  assert.equal(pending.actual.length, 1);
  assert.equal(pending.tp, undefined);
  const fixtures = selected.map(f => ({ ...f, category: 'mixed', slug: `mixed--${f.id}` }));
  const report = { schemaVersion: 3, category: 'mixed', corpusHash: 'hash', scanners: [{ id: 'test', status: 'complete', ...result }] };
  const summary = summarize(fixtures, [report]);
  assert.equal(summary.length, 4);
  assert.ok(summary.every(s => s.rows.length === 1 && s.selectedCount === 1));
  assert.equal(summary.find(s => s.cohort === 'unreviewed').recall, null);
  assert.equal(reportProblem(report, 'mixed', 'hash', fixtures), null);
  for (const mutate of [
    r => r.schemaVersion = 2,
    r => r.scanners[0].tp = 4,
    r => r.scanners[0].rows[0].assessment.cohort = 'masking',
    r => r.scanners[0].cohorts['common-format'].tp = 2,
    r => r.scanners[0].cohorts['common-format'].recall = 0,
    r => r.scanners[0].cohorts.unreviewed.tp = 1,
    r => r.scanners[0].rows.at(-1).fn = 0,
  ]) {
    const bad = structuredClone(report); mutate(bad);
    assert.ok(reportProblem(bad, 'mixed', 'hash', fixtures));
  }
});

test('format-correct unsupported controls stay included regardless of scanner output', () => {
  const selected = common.filter(f => /docker-token|cloudflare-token|stripe-token-test/.test(f.id));
  const result = scoreCohorts(selected, []);
  assert.equal(result.cohorts['common-format'].fn, selected.length);
  assert.equal(result.cohorts.unreviewed.fixtureCount, 0);
});

test('AWS and Shopify composites map reported components without borrowing expectations', () => {
  const aws = common.find(f => f.id === 'aws-access-key-pair-unicode-crlf');
  const values = aws.expected.map(r => Buffer.from(aws.content).subarray(r.start, r.end).toString());
  const metadata = (f, line) => ({ Data: { Filesystem: { file: f.path, line } } });
  const row = { DetectorName: 'AWS', Raw: values[0], RawV2: values.join(':'), SourceMetadata: metadata(aws, 2) };
  const expected = aws.expected.map(({ start, end }) => ({ path: aws.path, start, end }));
  assert.deepEqual(normalizeTrufflehogFindings([{ ...aws, expected: [] }], '/tmp', row), expected);
  assert.throws(() => normalizeTrufflehogFindings([aws], '/tmp', { ...row, RawV2: values[0] }), /composite/);
  assert.throws(() => normalizeTrufflehogFindings([{ ...aws, content: aws.content + '\n' + values[1] }], '/tmp', row), /Ambiguous/);
  const shop = common.find(f => f.id === 'shopify-token-shpat-unicode-crlf');
  const token = Buffer.from(shop.content).subarray(shop.expected[0].start, shop.expected[0].end).toString();
  const shopRow = { DetectorName: 'Shopify', Raw: token + 'benchmark-never-issued.myshopify.com', SourceMetadata: metadata(shop, 2) };
  assert.deepEqual(normalizeTrufflehogFindings([{ ...shop, expected: [] }], '/tmp', shopRow), shop.expected.map(({ start, end }) => ({ path: shop.path, start, end })));
  assert.throws(() => normalizeTrufflehogFindings([shop], '/tmp', { ...shopRow, Raw: token + 'absent.myshopify.com' }));
});
