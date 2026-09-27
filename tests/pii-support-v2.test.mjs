import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildPiiSupportMatrixV2, piiSupportMatrixV2Commitment, piiSupportRegistryCommitment,
  validatePiiSupportMatrixV2, validatePiiSupportRegistry,
} from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { buildEvaluationDomainsV2, domainDescriptorV2, evaluationDomainsV2Problem } from '../src/evaluation-domains-v2.ts';
import { piiSupportMatrixProblem } from '../src/pii-support-model.ts';
import { credentialSupportPage, piiSupportPage, piiSupportQueryOf } from '../src/pages/pii-support.ts';
import { publishArtifactAndIndex } from '../scripts/atomic-publication.ts';
import { piiSupportRegistryProjection } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';
import { piiSupportQueryProblem, supportQueryOf } from '../src/pages/pii-support.ts';

const execute = promisify(execFile);

const authority = [{ sourceKind: 'standard', sourceId: 'ietf-rfc-5322', locator: 'https://www.rfc-editor.org/rfc/rfc5322', revision: 'RFC5322', supports: ['lexical', 'validation'] }];
const registry = () => {
  const value = { schemaVersion: 1, id: 'pii-support-registry-v1', version: 1, contentCommitment: '',
    source: { repository: 'redact-secret/redact-secret', decision: 'decision-define-pii-v1-qualification-and-national-id-arrival-gates', mergeCommit: 'eb22bdf587e0079e101fc3ab5aeefada58ba438d' },
    families: [
      { family: 'pii:ca:sin', displayName: 'Canadian SIN', identityDomain: 'national-id', familyContractVersion: 1, scope: 'jurisdiction:CA', jurisdiction: 'CA', qualificationProfile: { id: 'pii-v1', version: 1 }, authority, contextObligation: 'required-for-sensitive-classification', validatorApplicable: true },
      { family: 'pii:global:email', displayName: 'Email address', identityDomain: 'email', familyContractVersion: 1, scope: 'global', jurisdiction: null, qualificationProfile: { id: 'pii-v1', version: 1 }, authority, contextObligation: 'reinforcing', validatorApplicable: false },
    ] };
  value.contentCommitment = piiSupportRegistryCommitment(value);
  return value;
};

test('absent product artifact publishes only explicit pending/not-measured family rows', () => {
  const matrix = buildPiiSupportMatrixV2({ registry: registry() });
  assert.deepEqual(matrix.families.map(row => [row.family, row.scope, row.status.state]), [
    ['pii:ca:sin', 'jurisdiction:CA', 'pending'], ['pii:global:email', 'global', 'pending'],
  ]);
  assert.equal(matrix.activationContract.productArtifact, 'not-measured');
  assert.deepEqual(matrix.distribution, { pending: 2, provisional: 0, stable: 0, unsupported: 0 });
  assert.ok(matrix.families.every(row => row.status.reasonCodes.includes('product-activation-not-measured') && row.activation.productArtifactCommitment === null));
  assert.equal(validatePiiSupportMatrixV2(matrix).artifactCommitment, matrix.artifactCommitment);
});

test('support matrix rejects forged status, unknown identity, extras and raw channels', () => {
  const original = buildPiiSupportMatrixV2({ registry: registry() });
  const mutations = [
    value => { value.families[0].status.state = 'stable'; value.distribution.pending--; value.distribution.stable++; },
    value => { value.families[0].identityDomain = 'passport'; },
    value => { value.families[0].raw = 'RAW-CANARY'; },
    value => { value.families[0].family = 'pii:global:sin'; },
    value => { value.populationReports[0].status = 'measured'; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value); value.artifactCommitment = piiSupportMatrixV2Commitment(value);
    assert.throws(() => validatePiiSupportMatrixV2(value));
  }
  const forged = structuredClone(original); forged.families[0].status.state = 'stable'; forged.distribution.pending--; forged.distribution.stable++;
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.throws(() => validatePiiSupportMatrixV2(forged));
});

test('coordinated population claims fail closed without bound #285 reports and rows', async () => {
  const original = buildPiiSupportMatrixV2({ registry: registry() });
  const forged = structuredClone(original);
  for (const report of forged.populationReports) {
    report.status = 'measured';
    for (const summary of report.familyEvidence) { summary.status = 'measured'; summary.strata = 1; }
  }
  for (const family of forged.families) {
    for (const evidence of family.populationEvidence) {
      evidence.reportStatus = 'measured'; evidence.status = 'measured'; evidence.strata = 1;
    }
    family.status.reasonCodes = ['product-activation-not-measured'];
  }
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.throws(() => validatePiiSupportMatrixV2(forged), /bound source reports/);
  assert.ok(await piiSupportMatrixProblem(forged, forged.artifactCommitment));

  const provenanceForgery = structuredClone(original);
  provenanceForgery.populationReports.forEach((report, index) => {
    report.contractCommitment = 'a'.repeat(64); report.corpusCommitment = 'b'.repeat(64);
    report.reportCommitment = (index ? 'd' : 'c').repeat(64);
    for (const family of provenanceForgery.families)
      family.populationEvidence.find(evidence => evidence.id === report.id).reportCommitment = report.reportCommitment;
  });
  provenanceForgery.artifactCommitment = piiSupportMatrixV2Commitment(provenanceForgery);
  assert.throws(() => validatePiiSupportMatrixV2(provenanceForgery), /canonical empty projection|semantics/);
  assert.ok(await piiSupportMatrixProblem(provenanceForgery, provenanceForgery.artifactCommitment));
});

test('registry is commitment-bound and keeps global and jurisdiction identities distinct', () => {
  const value = registry();
  assert.equal(validatePiiSupportRegistry(value).families.length, 2);
  const crossed = structuredClone(value); crossed.families[0].jurisdiction = 'US'; crossed.contentCommitment = piiSupportRegistryCommitment(crossed);
  assert.throws(() => validatePiiSupportRegistry(crossed));
  const unknown = structuredClone(value); unknown.families[0].scope = 'jurisdiction:ZZ'; unknown.families[0].jurisdiction = 'ZZ'; unknown.families[0].family = 'pii:zz:sin'; unknown.contentCommitment = piiSupportRegistryCommitment(unknown);
  assert.throws(() => validatePiiSupportRegistry(unknown));
});

test('evaluation-domain v2 index preserves credential v1 hrefs and binds PII support', async () => {
  const matrix = buildPiiSupportMatrixV2();
  const index = buildEvaluationDomainsV2(matrix.artifactCommitment);
  assert.equal(evaluationDomainsV2Problem(index), null);
  assert.deepEqual(domainDescriptorV2(index, 'credential').support, { state: 'published', href: '/results/support-matrix-v1.json', artifactCommitment: null });
  assert.deepEqual(domainDescriptorV2(index, 'credential').evaluation, { state: 'published', href: '/results/evaluation-v1.json', artifactCommitment: null });
  assert.equal(domainDescriptorV2(index, 'pii').support.artifactCommitment, matrix.artifactCommitment);
  assert.equal(domainDescriptorV2(index, 'pii').support.href, `/results/pii-support-matrix-v2-${matrix.artifactCommitment}.json`);
  assert.equal(await piiSupportMatrixProblem(matrix, matrix.artifactCommitment), null);
  assert.ok(await piiSupportMatrixProblem(matrix, 'f'.repeat(64)));
  const mutated = structuredClone(matrix); mutated.activationContract.productArtifact = 'trusted';
  assert.ok(await piiSupportMatrixProblem(mutated, matrix.artifactCommitment));
  mutated.artifactCommitment = piiSupportMatrixV2Commitment(mutated);
  assert.ok(await piiSupportMatrixProblem(mutated, mutated.artifactCommitment));
});

test('PII page shows exact profile/reasons and supports encoded two-colon family identities', () => {
  const matrix = buildPiiSupportMatrixV2({ registry: registry() }), index = buildEvaluationDomainsV2(matrix.artifactCommitment);
  const query = piiSupportQueryOf('?domain=pii&family=pii%3Aca%3Asin');
  assert.deepEqual(query, { domain: 'pii', family: 'pii:ca:sin', jurisdiction: null });
  const html = piiSupportPage(domainDescriptorV2(index, 'pii'), matrix, query);
  assert.match(html, /pii:ca:sin/); assert.doesNotMatch(html, /pii:global:email/);
  assert.match(html, /pii-v1@1/); assert.match(html, /product-activation-not-measured/);
  assert.match(html, /supportClaims=false/);
});

test('failed v2 publication preserves credential-v1 and existing index bytes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-support-publish-'));
  const evaluation = path.join(directory, 'evaluation-v1.json'), support = path.join(directory, 'support-matrix-v1.json');
  const index = path.join(directory, 'evaluation-domains-v2.json');
  const evaluationBytes = Buffer.from('{"credential":"golden-evaluation"}\n'), supportBytes = Buffer.from('{"credential":"golden-support"}\n');
  const indexBytes = Buffer.from('{"existing":"index"}\n');
  await Promise.all([writeFile(evaluation, evaluationBytes), writeFile(support, supportBytes), writeFile(index, indexBytes)]);
  await assert.rejects(execute(process.execPath, ['--import', 'tsx', 'scripts/publish-pii-support.ts', `--evaluation=${evaluation}`,
    `--credential-support=${support}`, `--pii-directory=${directory}`, `--output=${index}`], { cwd: path.resolve('.') }), /Credential evaluation artifact is incompatible/);
  assert.deepEqual(await readFile(evaluation), evaluationBytes); assert.deepEqual(await readFile(support), supportBytes);
  assert.deepEqual(await readFile(index), indexBytes);
});

test('index rename failure leaves the old immutable set valid without rollback', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-support-rollback-'));
  const oldPii = path.join(directory, 'pii-old.json'), newPii = path.join(directory, 'pii-new.json'), index = path.join(directory, 'index.json');
  await writeFile(oldPii, 'old-pii\n'); await writeFile(index, 'old-index-points-to-pii-old\n');
  let calls = 0;
  const realRename = (await import('node:fs/promises')).rename;
  const validations = { artifact: () => {}, index: () => {}, beforeCommit: () => {} };
  await assert.rejects(publishArtifactAndIndex(newPii, 'new-pii\n', index, 'new-index\n', validations, { rename: async (...args) => {
    calls++; if (calls === 2) throw new Error('forced index rename failure'); return realRename(...args);
  }}), /forced index rename failure/);
  assert.equal(await readFile(oldPii, 'utf8'), 'old-pii\n'); assert.equal(await readFile(index, 'utf8'), 'old-index-points-to-pii-old\n');
  assert.equal(await readFile(newPii, 'utf8'), 'new-pii\n');
});

test('late verification failure cannot replace the index or invalidate its old artifact', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-support-late-failure-'));
  const oldPii = path.join(directory, 'pii-old.json'), newPii = path.join(directory, 'pii-new.json'), index = path.join(directory, 'index.json');
  await writeFile(oldPii, 'old-pii\n'); await writeFile(index, 'old-index-points-to-pii-old\n');
  await assert.rejects(publishArtifactAndIndex(newPii, 'new-pii\n', index, 'new-index\n', {
    artifact: () => {}, index: () => {}, beforeCommit: () => { throw new Error('credential bytes changed'); },
  }), /credential bytes changed/);
  assert.equal(await readFile(oldPii, 'utf8'), 'old-pii\n'); assert.equal(await readFile(index, 'utf8'), 'old-index-points-to-pii-old\n');
  assert.equal(await readFile(newPii, 'utf8'), 'new-pii\n');
});

test('deployment uploads immutable PII evidence before the index and excludes history from deletion', async () => {
  const workflow = await readFile('.github/workflows/publish-site.yml', 'utf8');
  const artifact = workflow.indexOf('aws s3 cp "dist/$pii_artifact"'), general = workflow.indexOf('aws s3 sync dist "s3://$bucket"'),
    index = workflow.indexOf('aws s3 cp dist/results/evaluation-domains-v2.json');
  assert.ok(artifact >= 0 && artifact < general && general < index);
  assert.match(workflow, /--exclude 'results\/pii-support-matrix-v2-\*\.json'/);
  assert.match(workflow, /--exclude 'results\/evaluation-domains-v2\.json'/);
  const measure = workflow.slice(workflow.indexOf('- name: Measure the corpus'), workflow.indexOf('- name: Produce the evaluation'));
  const classify = workflow.slice(workflow.indexOf('- name: Classify support'), workflow.indexOf('- name: Build the site'));
  assert.match(measure, /rm -f results-output\/pii\/population-release-v1\.json/);
  assert.match(classify, /--population-bundle="\$population_bundle"/);
  assert.match(classify, /--population-mode=not-measured/);
});

test('browser and Node reject rehashed semantic forgeries alike', async () => {
  const original = buildPiiSupportMatrixV2({ registry: registry() });
  const mutations = [
    value => { value.families[0].jurisdiction = 'US'; },
    value => { value.families[0].activation.selector = 'pii:family:ca:other'; },
    value => { value.families.reverse(); },
    value => { value.populationReports[1] = structuredClone(value.populationReports[0]); },
    value => { value.populationComparisons[0].verdict = 'no-regression'; },
    value => { value.families[0].populationEvidence[0].reportCommitment = 'f'.repeat(64); },
    value => { value.families[0].populationEvidence[0].status = 'measured'; value.families[0].populationEvidence[0].strata = 999; },
    value => { value.families[0].status.reasonCodes = ['all-pii-v1-gates-met']; },
    value => { value.families[0].authority[0].locator = 'x'; },
  ];
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value);
    value.registryCommitment = createHash('sha256').update(JSON.stringify(canonical(piiSupportRegistryProjection(value)))).digest('hex');
    value.artifactCommitment = piiSupportMatrixV2Commitment(value);
    const index = buildEvaluationDomainsV2(value.artifactCommitment), expected = domainDescriptorV2(index, 'pii').support.artifactCommitment;
    assert.throws(() => validatePiiSupportMatrixV2(value));
    assert.ok(await piiSupportMatrixProblem(value, expected));
  }
});

test('one support query parser is strict across credential and PII domains', () => {
  const accepted = ['', '?status=stable', '?domain=credential', '?domain=credential&status=pending', '?domain=pii',
    '?domain=pii&family=pii%3Aca%3Asin', '?domain=pii&jurisdiction=CA'];
  for (const query of accepted) assert.ok(supportQueryOf(query), query);
  const rejected = ['?unknown=x', '?status=unknown', '?domain=credential&family=pii:ca:sin', '?domain=pii&status=stable', '?domain=', '?status=',
    '?domain=pii&family=', '?domain=pii&jurisdiction=', '?domain=PII', '?domain=pii&jurisdiction=ZZ',
    '?domain=pii&family=pii:zz:ssn', '?domain=pii&family=pii:ca:sin&jurisdiction=CA', '?domain=pii&family=pii:ca:sin&jurisdiction=US', '?domain=pii&family=pii%3Aglobal%3Aemail&jurisdiction=CA',
    '?domain=pii&domain=pii', '?domain=credential&status=stable&status=pending', '?domain=pii&family=%E0%A4%A'];
  for (const query of rejected) assert.equal(supportQueryOf(query), null, query);
  const matrix = buildPiiSupportMatrixV2({ registry: registry() });
  assert.equal(piiSupportQueryProblem(supportQueryOf('?domain=pii&family=pii:ca:sin'), matrix), null);
  assert.match(piiSupportQueryProblem(supportQueryOf('?domain=pii&family=pii:us:ssn'), matrix), /Unknown PII family/);
  assert.match(piiSupportQueryProblem(supportQueryOf('?domain=pii&jurisdiction=US'), matrix), /Unknown PII jurisdiction/);
});

test('credential support renderer keeps its golden bytes', () => {
  const domain = { domain: 'credential', reportProfile: { id: 'credential-evaluation', version: 1 }, evaluationProfile: 'evaluation-v1', domainAccountingVersion: 'credential-v4',
    qualificationProfiles: [{ id: 'documented', version: 1 }, { id: 'empirical', version: 1 }], evaluation: { state: 'published', href: '/results/evaluation-v1.json' }, support: { state: 'published', href: '/results/support-matrix-v1.json' } };
  const digest = createHash('sha256').update(credentialSupportPage('<golden/>', domain)).digest('hex');
  assert.equal(digest, '14010b6c0b5d07b03a60c4dd1af1f72bbb87ae8d37b764804cee3a0289fd961c');
});
