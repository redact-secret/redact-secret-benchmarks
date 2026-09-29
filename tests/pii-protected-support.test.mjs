/**
 * Reviewed v2 binding path from the Beta.11 protected disposition to pii-support-matrix-v2 (benchmarks #428).
 * The committed evidence under evidence/901/428/core-8b6a5fde52ec is the positive case; every rejection mutates a
 * copy of it and re-commits what it changed, so each check fails on its own rule rather than on a stale hash.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { b11Commitment } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { buildB11ProtectedDisposition } from '../benchmarks/evaluation/domains/pii/beta11-protected.ts';
import { b11ProfileCostAcceptance, piiProfileCostAcceptances } from '../benchmarks/evaluation/domains/pii/profile-cost-acceptance.ts';
import { bindPiiProtectedSupport, loadPiiProtectedSupportEvidence, validatePiiProtectedSupportBinding } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
import { piiCurrentProtectedRoute, piiProtectedRouteProblem } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';
import { buildPiiSupportMatrixV2, piiSupportMatrixV2Commitment, piiSupportRegistry, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { buildEvaluationDomainsV2, domainDescriptorV2 } from '../src/evaluation-domains-v2.ts';
import { piiSupportMatrixProblem } from '../src/pii-support-model.ts';
import { piiSupportPage, piiSupportQueryOf } from '../src/pages/pii-support.ts';

const execute = promisify(execFile);
const repo = fileURLToPath(new URL('../', import.meta.url));
const binding = piiCurrentProtectedRoute();
const evidence = await loadPiiProtectedSupportEvidence(repo, binding);
const commit = (value, key = 'artifactCommitment') => { value[key] = b11Commitment({ ...value, [key]: undefined }); return value; };
const reject = (mutate, code) => {
  const copy = structuredClone(evidence); mutate(copy);
  assert.throws(() => validatePiiProtectedSupportBinding(binding, copy), new RegExp(`rejected: ${code}`));
};
const family = (record, id) => record.families.find(row => row.family === id);
/** Rebuild the protected disposition from mutated runs, as the protected route itself would. */
const rederived = copy => buildB11ProtectedDisposition({ report: copy.report, disposition: copy.disposition, seal: copy.seal, runs: copy.runs,
  costAcceptance: b11ProfileCostAcceptance({ report: copy.report, profileCost: copy.profileCost }) });

test('the reviewed binding re-derives from committed evidence and projects five provisional and us-ssn pending, never stable', async () => {
  const route = await bindPiiProtectedSupport(repo);
  assert.equal(route.coreCommit, '8b6a5fde52ecb4dfce13f09c7a947062d21483c7');
  assert.equal(route.record, 'evidence/901/428/final-core-8b6a5fde.md');
  const matrix = buildPiiSupportMatrixV2({ protectedRoute: route });
  assert.deepEqual(matrix.distribution, { pending: 1, provisional: 5, stable: 0, unsupported: 0 });
  assert.deepEqual(matrix.families.map(row => [row.family, row.status.state, row.status.reasonCodes]), [
    ['pii:global:email', 'provisional', []], ['pii:global:iban', 'provisional', []], ['pii:global:network-address', 'provisional', []],
    ['pii:global:payment-card', 'provisional', []], ['pii:global:phone', 'provisional', []],
    ['pii:us:ssn', 'pending', ['identity-only-classification', 'protected-gates-not-met']],
  ]);
  const coverage = id => matrix.protectedRoute.families.find(row => row.family === id).coverage;
  assert.deepEqual([coverage('pii:global:phone').scope, coverage('pii:global:phone').jurisdiction, coverage('pii:global:phone').restriction],
    ['global', null, 'nanp-country-code-1']);
  assert.match(coverage('pii:global:phone').note, /\+1 \(NANP\)/);
  assert.deepEqual([coverage('pii:us:ssn').scope, coverage('pii:us:ssn').jurisdiction], ['jurisdiction:US', 'US']);
  assert.equal(matrix.protectedRoute.families.find(row => row.family === 'pii:us:ssn').reason, 'protected-gates-not-met:identity-only-classification');
  // Activation stays a separate axis: the route carries no v1 product record.
  assert.equal(matrix.activationContract.productArtifact, 'not-measured');
  // Readback without bindings (publisher and browser) accepts exactly this projection.
  const published = JSON.parse(JSON.stringify(matrix));
  assert.equal(validatePiiSupportMatrixV2(published).artifactCommitment, matrix.artifactCommitment);
  assert.equal(await piiSupportMatrixProblem(published, published.artifactCommitment), null);
  const html = piiSupportPage(domainDescriptorV2(buildEvaluationDomainsV2(matrix.artifactCommitment), 'pii'), published, piiSupportQueryOf('?domain=pii'));
  assert.match(html, /data-protected-route="beta11-8b6a5fd-pii-protected"/);
  assert.match(html, /Country code \+1 \(NANP\) only/);
  assert.match(html, /United States only/);
  assert.match(html, /data-protected-reason="protected-gates-not-met:identity-only-classification"/);
});

test('pii:support:record projects the committed Beta.11 evidence through the reviewed binding', async () => {
  const output = path.join(await mkdtemp(path.join(tmpdir(), 'pii-protected-support-')), 'matrix.json');
  const { stdout } = await execute(process.execPath, ['--import', 'tsx', 'scripts/record-pii-support-evidence.ts',
    `--protected-binding=${binding.id}`, `--output=${output}`], { cwd: repo });
  const matrix = validatePiiSupportMatrixV2(JSON.parse(await readFile(output, 'utf8')));
  assert.deepEqual(matrix.distribution, { pending: 1, provisional: 5, stable: 0, unsupported: 0 });
  assert.match(stdout, /pii:us:ssn=pending\(identity-only-classification,protected-gates-not-met\)/);
  await assert.rejects(execute(process.execPath, ['--import', 'tsx', 'scripts/record-pii-support-evidence.ts',
    '--protected-binding=not-a-reviewed-binding', `--output=${output}`], { cwd: repo }), /not a reviewed binding/);
});

test('a v1 product record and the v2 protected route never bind one matrix, and v1 records keep working', async () => {
  const product = { candidateEvidence: JSON.parse(await readFile('evidence/875/candidate-evidence-v1.json', 'utf8')),
    activationArtifact: JSON.parse(await readFile('evidence/875/pii-activation-evidence-v1.json', 'utf8')),
    qualificationArtifacts: [JSON.parse(await readFile('evidence/875/pii-family-qualification-v1.json', 'utf8'))] };
  assert.equal(buildPiiSupportMatrixV2({ product }).activationContract.productArtifact, 'trusted');
  assert.throws(() => buildPiiSupportMatrixV2({ product, protectedRoute: binding }), /cannot bind one matrix/);
});

test('a disposition whose core commit, freeze, report or seal differs from the reviewed binding is rejected', () => {
  reject(copy => { copy.protectedDisposition.candidate.sourceCommit = '0'.repeat(40); commit(copy.protectedDisposition); }, 'core-commit-mismatch');
  reject(copy => { copy.freeze.candidate.sourceCommit = '0'.repeat(40); commit(copy.freeze, 'freezeCommitment'); }, 'core-commit-mismatch');
  reject(copy => { copy.protectedDisposition.freezeCommitment = 'a'.repeat(64); commit(copy.protectedDisposition); }, 'freeze-mismatch');
  reject(copy => { copy.protectedDisposition.reportCommitment = 'b'.repeat(64); commit(copy.protectedDisposition); }, 'report-mismatch');
  reject(copy => { copy.protectedDisposition.sealCommitment = 'c'.repeat(64); commit(copy.protectedDisposition); }, 'seal-mismatch');
  reject(copy => { copy.seal.sealId = '000000000000'; copy.seal.families.forEach(row => { row.manifest = row.manifest.replace(/pii-b11-[a-f0-9]{12}-/, 'pii-b11-000000000000-'); });
    commit(copy.seal); }, 'seal-mismatch');
  // An edited disposition that is not re-committed fails its own integrity check first.
  reject(copy => { copy.protectedDisposition.candidate.sourceCommit = '0'.repeat(40); }, 'protected-disposition-invalid');
});

test('a disposition whose profile-cost acceptance does not match its ledger entry is rejected', () => {
  reject(copy => { copy.protectedDisposition.costAcceptance.entryCommitment = 'd'.repeat(64); commit(copy.protectedDisposition); }, 'cost-acceptance-ledger-mismatch');
  reject(copy => { copy.ledger = piiProfileCostAcceptances.map(row => row.id === binding.costAcceptance.id ? { ...structuredClone(row), rationale: `${row.rationale} ` } : row); },
    'cost-acceptance-ledger-mismatch');
  reject(copy => { copy.ledger = piiProfileCostAcceptances.filter(row => row.id !== binding.costAcceptance.id); }, 'cost-acceptance-ledger-mismatch');
  // A ledger entry that no longer covers the bound runs is not accepted, even with a matching id.
  reject(copy => { copy.ledger = piiProfileCostAcceptances.map(row => row.id === binding.costAcceptance.id ? { ...structuredClone(row), cells: row.cells.slice(1) } : row);
    const entry = copy.ledger.find(row => row.id === binding.costAcceptance.id); assert.notEqual(hash(JSON.stringify(entry)), binding.costAcceptance.entryCommitment); },
  'cost-acceptance-ledger-mismatch');
});

test('a rejected or unresolved custody is rejected', () => {
  reject(copy => {
    const run = copy.runs.find(row => row.aggregate.family === 'pii:global:email');
    run.trust.decision = 'rejected'; commit(run.trust);
    copy.protectedDisposition = rederived(copy);
    assert.equal(family(copy.protectedDisposition, 'pii:global:email').protected.state, 'unresolved');
  }, 'custody-rejected:pii:global:email');
  reject(copy => {
    copy.runs = copy.runs.filter(row => row.aggregate.family !== 'pii:us:ssn');
    copy.protectedDisposition = rederived(copy);
    assert.equal(family(copy.protectedDisposition, 'pii:us:ssn').protected.state, 'unspent');
  }, 'custody-unresolved:pii:us:ssn');
  // A trust record re-pointed at another corpus no longer validates against its aggregate.
  reject(copy => { const run = copy.runs.find(row => row.aggregate.family === 'pii:global:phone'); run.trust.corpusHash = 'e'.repeat(64); commit(run.trust); },
    'custody-invalid:pii:global:phone');
});

test('a family whose protected gate is not met is never projected above pending', () => {
  reject(copy => {
    const ssn = family(copy.protectedDisposition, 'pii:us:ssn');
    ssn.status = 'provisional'; copy.protectedDisposition.distribution = { pending: 0, provisional: 6, stable: 0 }; commit(copy.protectedDisposition);
  }, 'protected-gate-not-met:pii:us:ssn');
  // The browser-safe route check refuses the same promotion in a reviewed-binding shape.
  const forged = structuredClone(binding), ssn = forged.families.find(row => row.family === 'pii:us:ssn');
  ssn.status = 'provisional';
  assert.match(piiProtectedRouteProblem(forged, piiSupportRegistry.families), /above pending/);
  assert.throws(() => buildPiiSupportMatrixV2({ protectedRoute: forged }), /not a reviewed binding/);
});

test('any attempt to project stable is rejected, in the evidence, the binding and the published matrix', async () => {
  reject(copy => { family(copy.protectedDisposition, 'pii:global:email').status = 'stable'; commit(copy.protectedDisposition); }, 'stable-not-projectable');
  reject(copy => { copy.protectedDisposition.maximumStatus = 'stable'; commit(copy.protectedDisposition); }, 'stable-not-projectable');
  const forged = structuredClone(binding); forged.families[0].status = 'stable';
  assert.match(piiProtectedRouteProblem(forged, piiSupportRegistry.families), /never projects stable/);
  const matrix = JSON.parse(JSON.stringify(buildPiiSupportMatrixV2({ protectedRoute: binding })));
  const mutations = [
    value => { value.families[0].status.state = 'stable'; value.distribution.provisional--; value.distribution.stable++; },
    value => { value.protectedRoute.families[0].status = 'stable'; value.families[0].status.state = 'stable'; value.distribution.provisional--; value.distribution.stable++; },
    value => { value.protectedRoute.families[5].status = 'provisional'; value.families[5].status = { ...value.families[5].status, state: 'provisional', reasonCodes: [] };
      value.distribution.pending--; value.distribution.provisional++; },
    value => { value.protectedRoute.id = 'unreviewed-route'; },
    value => { value.protectedRoute.families[4].coverage.restriction = null; },
    value => { value.protectedRoute.families[5].coverage.jurisdiction = null; },
    value => { delete value.protectedRoute; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(matrix); mutate(value); value.artifactCommitment = piiSupportMatrixV2Commitment(value);
    assert.throws(() => validatePiiSupportMatrixV2(value));
    assert.ok(await piiSupportMatrixProblem(value, value.artifactCommitment));
  }
});

test('a disposition that does not re-derive from its runs, or an unreviewed binding, is rejected', () => {
  reject(copy => { family(copy.protectedDisposition, 'pii:global:phone').protected.reason = 'protected-gates-met-by-hand'; commit(copy.protectedDisposition); },
    'protected-disposition-not-rederived');
  const other = { ...structuredClone(binding), id: 'unreviewed-route' };
  assert.throws(() => validatePiiProtectedSupportBinding(other, evidence), /not-a-reviewed-binding/);
});
