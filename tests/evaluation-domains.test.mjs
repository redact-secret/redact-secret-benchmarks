import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { access, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluationDomains, evaluationDomainsProblem, domainDescriptor } from '../benchmarks/shared/evaluation-domains.ts';

const clone = value => structuredClone(value);
const execute = promisify(execFile);

test('public domain index is schema-valid, exact, and keeps credential v1 paths', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/evaluation-domains-v1.json', import.meta.url), 'utf8'));
  assert.equal(new Ajv({ strict: true }).compile(schema)(evaluationDomains), true);
  assert.equal(evaluationDomainsProblem(evaluationDomains), null);
  const credential = domainDescriptor(evaluationDomains, 'credential');
  assert.deepEqual(credential.evaluation, { state: 'published', href: '/results/evaluation-v1.json' });
  assert.deepEqual(credential.support, { state: 'published', href: '/results/support-matrix-v1.json' });
  assert.equal(credential.evaluationProfile, 'evaluation-v1');
  assert.equal(credential.domainAccountingVersion, 'credential-v4');
});

test('PII is an explicit schema-only profile, never an empty measurement', () => {
  const pii = domainDescriptor(evaluationDomains, 'pii');
  assert.deepEqual(pii.evaluation, { state: 'schema-only', href: null });
  assert.deepEqual(pii.support, { state: 'schema-only', href: null });
  assert.deepEqual(pii.qualificationProfiles, [{ id: 'pii-v1', version: 1 }]);
  assert.equal(pii.evaluationProfile, 'pii-v1');
  assert.equal(pii.domainAccountingVersion, 'pii-v1');
  assert.doesNotMatch(JSON.stringify(pii), /accuracy|precision|recall|f1|rate|stable|provisional|unsupported/i);
});

test('domain index rejects missing, duplicate, unknown, mismatched and hostile records', () => {
  const edits = [
    value => value.domains.pop(),
    value => value.domains[1] = clone(value.domains[0]),
    value => value.domains[1].domain = 'customer',
    value => value.domains[1].domainAccountingVersion = 'credential-v4',
    value => value.domains[1].qualificationProfiles[0].id = 'documented',
    value => value.domains[1].evaluation.href = '/results/pii.json',
    value => value.domains[1].support.raw = { content: 'unsafe', score: 1 },
  ];
  for (const edit of edits) {
    const value = clone(evaluationDomains); edit(value);
    assert.ok(evaluationDomainsProblem(value));
    assert.equal(domainDescriptor(value, 'pii'), null);
  }
});

test('legacy publisher (--legacy-v1) validates referenced credential artifacts before its atomic write', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'evaluation-domains-'));
  const evaluation = path.join(directory, 'evaluation.json'), support = path.join(directory, 'support.json'), output = path.join(directory, 'domains.json');
  await writeFile(evaluation, '{}'); await writeFile(support, '{}');
  await assert.rejects(execute(process.execPath, ['--import', 'tsx', 'scripts/publish-evaluation-domains.ts', '--legacy-v1',
    `--evaluation=${evaluation}`, `--support=${support}`, `--output=${output}`], { cwd: path.resolve('.') }), /Credential evaluation artifact is incompatible/);
  await assert.rejects(access(output));
});

// ---- #790: credential descriptors point at the evaluation bundle; the full-report contract is explicit legacy ----
import { buildEvaluationDomainsV2, domainDescriptorV2, evaluationDomainsV2Problem, credentialBundleHref } from '../benchmarks/shared/evaluation-domains-v2.ts';
import { credentialEvidenceChangeProblem, credentialEvaluationReference, readCredentialEvidence } from '../benchmarks/shared/credential-evidence.ts';
import { publishSyntheticBundle, syntheticSupportMatrix, tempDirectory } from './support/evaluation-bundle-fixture.mjs';

const reference = { bundleId: 'a'.repeat(32), manifestSha256: 'b'.repeat(64) };
const publish = (name, args) => execute(process.execPath, ['--import', 'tsx', name, ...args], { cwd: path.resolve('.') });

test('v2 credential evaluation references the bundle manifest and commits to its digest', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/evaluation-domains-v2.json', import.meta.url), 'utf8'));
  const index = buildEvaluationDomainsV2('c'.repeat(64), reference);
  assert.equal(new Ajv({ strict: true }).compile(schema)(index), true);
  assert.equal(evaluationDomainsV2Problem(index), null);
  assert.deepEqual(domainDescriptorV2(index, 'credential').evaluation, { state: 'published', href: credentialBundleHref(reference.bundleId), artifactCommitment: reference.manifestSha256 });
  assert.equal(domainDescriptorV2(index, 'credential').evaluation.href, `/results/evaluation-bundles/${reference.bundleId}/manifest.json`);
  assert.throws(() => buildEvaluationDomainsV2('c'.repeat(64)), /Invalid credential evaluation bundle reference/);
  assert.throws(() => buildEvaluationDomainsV2('c'.repeat(64), { bundleId: 'z', manifestSha256: reference.manifestSha256 }), /Invalid credential evaluation bundle reference/);
});

test('v2 index refuses the legacy full report, a manifest elsewhere, a missing digest and mixed identities', () => {
  const fresh = () => buildEvaluationDomainsV2('c'.repeat(64), reference);
  const edits = {
    'legacy evaluation-v1.json': [value => { value.domains[0].evaluation = { state: 'published', href: '/results/evaluation-v1.json', artifactCommitment: null }; }, /legacy full report/],
    'legacy href with a digest': [value => { value.domains[0].evaluation = { state: 'published', href: '/results/evaluation-v1.json', artifactCommitment: 'd'.repeat(64) }; }, /legacy full report/],
    'no digest': [value => { value.domains[0].evaluation.artifactCommitment = null; }, /Invalid evaluation-domain v2 index contract|bundle manifest/],
    'manifest of a short id': [value => { value.domains[0].evaluation.href = '/results/evaluation-bundles/abc/manifest.json'; }, /Invalid evaluation-domain v2 index contract/],
    'manifest path traversal': [value => { value.domains[0].evaluation.href = `/results/evaluation-bundles/${'a'.repeat(32)}/../manifest.json`; }, /Invalid evaluation-domain v2 index contract/],
    'manifest masquerading as PII evaluation': [value => { value.domains[1].evaluation = { state: 'published', href: credentialBundleHref(reference.bundleId), artifactCommitment: reference.manifestSha256 }; }, /Unknown or incompatible/],
    'schema-only credential': [value => { value.domains[0].evaluation = { state: 'schema-only', href: null, artifactCommitment: null }; }, /bundle manifest/],
    'bundle manifest as support': [value => { value.domains[0].support = { state: 'published', href: credentialBundleHref(reference.bundleId), artifactCommitment: reference.manifestSha256 }; }, /Invalid evaluation-domain v2 index contract/],
  };
  for (const [name, [edit, expected]] of Object.entries(edits)) {
    const value = fresh(); edit(value);
    assert.match(evaluationDomainsV2Problem(value) ?? 'accepted', expected, name);
    assert.equal(domainDescriptorV2(value, 'credential'), null, name);
  }
});

test('the v1 domain index and evaluation-v1.json stay valid as the explicit legacy contract, not as the v2 contract', () => {
  assert.equal(evaluationDomainsProblem(evaluationDomains), null);
  assert.equal(domainDescriptor(evaluationDomains, 'credential').evaluation.href, '/results/evaluation-v1.json');
  // A v1 document is never accepted as a v2 index, and a v2 index is never accepted as v1.
  assert.ok(evaluationDomainsV2Problem(evaluationDomains));
  assert.ok(evaluationDomainsProblem(buildEvaluationDomainsV2('c'.repeat(64), reference)));
});

test('credential evidence read set: valid bundle, tampered part, mixed pointer, replaced pointer', async () => {
  const directory = await tempDirectory('credential-evidence-'), supportFile = path.join(directory, 'support-matrix-v1.json');
  await writeFile(supportFile, JSON.stringify(syntheticSupportMatrix()) + '\n');
  await assert.rejects(readCredentialEvidence(directory, supportFile), /bundle is absent/);
  const first = await publishSyntheticBundle(directory);
  const evidence = await readCredentialEvidence(directory, supportFile);
  assert.equal(evidence.bundleId, first.pointer.bundleId);
  assert.equal(evidence.manifestSha256, first.pointer.manifest.sha256);
  assert.deepEqual(credentialEvaluationReference(evidence), { href: credentialBundleHref(first.pointer.bundleId), artifactCommitment: first.pointer.manifest.sha256 });
  assert.equal(await credentialEvidenceChangeProblem(evidence), null);
  // A concurrent credential publication moves the pointer to another bundle.
  const second = await publishSyntheticBundle(directory, { runId: 'concurrent-run' });
  assert.notEqual(second.pointer.bundleId, first.pointer.bundleId);
  assert.match(await credentialEvidenceChangeProblem(evidence), /pointer changed/);
  // Mixed identities: the pointer names the second bundle but commits to the first one's manifest.
  const pointerFile = path.join(directory, 'evaluation-bundle-v1.json'), pointer = JSON.parse(await readFile(pointerFile, 'utf8'));
  await writeFile(pointerFile, JSON.stringify({ ...pointer, manifest: first.pointer.manifest }) + '\n');
  await assert.rejects(readCredentialEvidence(directory, supportFile), /pointer does not name its own manifest|not the one the pointer commits to/);
  await writeFile(pointerFile, JSON.stringify({ ...pointer, bundleId: first.pointer.bundleId, runId: first.pointer.runId, finishedAt: first.pointer.finishedAt }) + '\n');
  await assert.rejects(readCredentialEvidence(directory, supportFile), /pointer does not name its own manifest|not the one the pointer commits to/);
  // A tampered detail part is refused by the streaming validation.
  await writeFile(pointerFile, JSON.stringify(second.pointer) + '\n');
  const part = path.join(second.directory, 'cases', (await readdir(path.join(second.directory, 'cases')))[0]);
  await writeFile(part, (await readFile(part, 'utf8')).replace(/"id"/, '"idx"'));
  await assert.rejects(readCredentialEvidence(directory, supportFile), /Credential evaluation bundle is incompatible/);
});

test('domain gate validates the bundle and writes no index; the v1 index is produced only with --legacy-v1', async () => {
  const directory = await tempDirectory('evaluation-domains-bundle-'), supportFile = path.join(directory, 'support-matrix-v1.json');
  await writeFile(supportFile, JSON.stringify(syntheticSupportMatrix()) + '\n');
  await assert.rejects(publish('scripts/publish-evaluation-domains.ts', [`--results=${directory}`, `--support=${supportFile}`]), /bundle is absent/);
  await publishSyntheticBundle(directory);
  const { stdout } = await publish('scripts/publish-evaluation-domains.ts', [`--results=${directory}`, `--support=${supportFile}`]);
  assert.match(stdout, /Validated credential evidence: bundle [a-f0-9]{32}/);
  await assert.rejects(access(path.join(directory, 'evaluation-domains-v1.json')));
  await assert.rejects(publish('scripts/publish-evaluation-domains.ts', [`--results=${directory}`, `--support=${supportFile}`, `--output=${directory}/x.json`]), /legacy evaluation-v1 contract/);
  await assert.rejects(publish('scripts/publish-evaluation-domains.ts', ['--legacy-v1', `--results=${directory}`]), /cannot be combined/);
  // The legacy path validates the full report as before, and a manifest is not one.
  const manifest = path.join(directory, 'manifest-as-report.json'), output = path.join(directory, 'evaluation-domains-v1.json');
  await writeFile(manifest, await readFile(path.join(directory, (JSON.parse(await readFile(path.join(directory, 'evaluation-bundle-v1.json'), 'utf8'))).manifest.path), 'utf8'));
  await assert.rejects(publish('scripts/publish-evaluation-domains.ts', ['--legacy-v1', `--evaluation=${manifest}`, `--support=${supportFile}`, `--output=${output}`]), /Credential evaluation artifact is incompatible/);
  await assert.rejects(access(output));
});
