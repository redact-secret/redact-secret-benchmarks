import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { credentialDomain } from '../benchmarks/evaluation/domains/credential/contract.ts';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { contracts, validateAssessment } from '../benchmarks/lib/assessment.ts';
import { classifyFamilySupport } from '../benchmarks/support/status.ts';
import { familyEvidence } from '../benchmarks/support/evidence.ts';
import { buildSupportMatrix } from '../benchmarks/support/matrix.ts';
import { generateCase, hash } from '../benchmarks/engine/model.ts';
import { reviewEntryId } from '../benchmarks/engine/execution.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = file => readFile(path.join(root, file), 'utf8');

test('credential evaluator has one explicit internal identity and composition root', () => {
  assert.deepEqual({ domain: credentialDomain.domain, reportProfile: credentialDomain.reportProfile },
    { domain: 'credential', reportProfile: { id: 'credential-evaluation', version: 1 } });
  assert.equal(credentialDomain.createMethods, createMethods);
  assert.equal(credentialDomain.createOperators, createOperators);
  assert.equal(credentialDomain.loadCases, loadCases);
  assert.equal(credentialDomain.assessment.contracts, contracts);
  assert.equal(credentialDomain.assessment.validateAssessment, validateAssessment);
  assert.equal(credentialDomain.qualification.classifyFamilySupport, classifyFamilySupport);
  assert.equal(credentialDomain.qualification.familyEvidence, familyEvidence);
  assert.equal(credentialDomain.qualification.buildSupportMatrix, buildSupportMatrix);
  assert.equal(credentialDomain.review.reviewEntryId, reviewEntryId);
});

test('compatibility imports and the explicit contract generate identical credential cases', async () => {
  const legacyOperators = createOperators(), domainOperators = credentialDomain.createOperators();
  const legacyCases = await loadCases(legacyOperators), domainCases = await credentialDomain.loadCases(domainOperators);
  assert.equal(hash(legacyCases), hash(domainCases));
  const selected = domainCases.find(c => c.method === 'twin' && c.id.includes('github-token-ghp-plain'));
  assert.ok(selected);
  assert.equal(hash(generateCase(selected, createMethods(), legacyOperators)),
    hash(generateCase(selected, credentialDomain.createMethods(), domainOperators)));
});

test('credential observation normalization preserves the existing family allowlist behavior', () => {
  const finding = { path: 'case.txt', start: 1, end: 2, family: 'github-token', action: 'redact' };
  assert.deepEqual(credentialDomain.normalizeFinding(finding, { capabilities: { ranges: true, classification: true } }), finding);
  assert.deepEqual(credentialDomain.normalizeFinding({ ...finding, family: 'unknown-native-label' }, { capabilities: { ranges: true, classification: true } }),
    { path: 'case.txt', start: 1, end: 2, action: 'redact' });
  assert.deepEqual(credentialDomain.normalizeFinding(finding, { capabilities: { ranges: true, classification: false } }),
    { path: 'case.txt', start: 1, end: 2, action: 'redact' });
});

test('legacy module paths are re-export shims and production entrypoints select the domain contract', async () => {
  const shims = [
    'benchmarks/lib/assessment.ts', 'benchmarks/engine/cases.ts', 'benchmarks/engine/assertions.ts', 'benchmarks/engine/reporting.ts',
    ...['benign','common','differential','holdout','index','metamorphic','mutation','twin'].map(name => `benchmarks/methods/${name}.ts`),
    ...['authored-twin','context','index','lexical','structural'].map(name => `benchmarks/operators/${name}.ts`),
  ];
  for (const file of shims) {
    const source = await text(file);
    assert.match(source, /export \* from ['"][^'"]*evaluation\/domains\/credential\//, file);
    assert.doesNotMatch(source, /\bfunction\b|\bconst\s+[a-zA-Z_$]/, file);
  }
  for (const file of [
    'benchmarks/evaluate.ts', 'benchmarks/classify-support.ts', 'benchmarks/qualify.ts', 'benchmarks/generate-support-matrix.ts',
    'scripts/publish-evaluation.ts', 'scripts/check-review-queue-coverage.mjs', 'scripts/rekey-review-ledger.ts',
    'scripts/generate-fixture-profile-coverage.mjs', 'scripts/check-evidence-arrival.mjs',
  ]) {
    const source = await text(file);
    assert.match(source, /credentialDomain/, file);
    assert.doesNotMatch(source, /from ['"][^'"]*(?:benchmarks\/)?(?:methods|operators|engine\/cases)(?:\/|\.ts)/, file);
  }
});

test('the #276 move leaves accounting and serialized report versions untouched', async () => {
  const accounting = await text('benchmarks/evaluation/domains/credential/accounting.ts');
  const execution = await text('benchmarks/evaluation/domains/credential/execution.ts');
  const publicReport = await text('benchmarks/evaluation/domains/credential/public-report.ts');
  assert.match(accounting, /ACCOUNTING_VERSION = '1\.1'/);
  assert.match(execution, /schemaVersion: 3/);
  assert.match(publicReport, /schemaVersion: 2, accountingVersion: '1\.1'/);
});
