import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSUMER_PIN } from '../scripts/lib/pii-evidence-contract.mjs';
import { verifyEvidenceEngineMetadata, verifyEvidenceBuildInfo } from '../scripts/fetch-pii-evidence-inputs.mjs';
import { checkDispatch } from '../scripts/check-pii-evidence-dispatch.mjs';
const pin = CONSUMER_PIN;
function metadata() {
  return { run: { id: pin.executionEngine.workflow.runId, run_attempt: 1, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main',
    head_sha: pin.source.commit, status: 'completed', conclusion: 'success', repository: { full_name: pin.source.repository }, head_repository: { full_name: pin.source.repository } },
  artifact: { id: pin.executionEngine.archive.id, name: pin.executionEngine.archive.name, digest: `sha256:${pin.executionEngine.archive.sha256}`,
    size_in_bytes: 1488951, expired: false, expires_at: '2026-11-06T14:33:13Z', workflow_run: { id: pin.executionEngine.workflow.runId, head_sha: pin.source.commit } } };
}
test('e991 measurement engine transport is separate from source-built importer', () => {
  const { run, artifact } = metadata(); verifyEvidenceEngineMetadata(run, artifact, Date.parse('2026-10-08T00:00:00Z'));
  assert.notEqual(pin.executionEngine.binarySha256, pin.evidenceConsumer.localVerification.binarySha256);
  assert.equal(pin.evidenceConsumer.canonicalLinux.binarySha256, null);
});
for (const [name, mutate] of [
  ['other source', x => x.run.head_sha = 'f'.repeat(40)], ['rerun', x => x.run.run_attempt = 2],
  ['other repository', x => x.run.head_repository.full_name = 'untrusted/fork'],
  ['failed workflow', x => x.run.conclusion = 'failure'], ['expired archive', x => x.artifact.expired = true],
  ['other member archive', x => x.artifact.digest = 'sha256:' + 'f'.repeat(64)], ['other artifact run', x => x.artifact.workflow_run.id++],
]) test(`transport refuses ${name}`, () => { const x = metadata(); mutate(x); assert.throws(() => verifyEvidenceEngineMetadata(x.run, x.artifact, Date.parse('2026-10-08T00:00:00Z'))); });
test('archive expiry refuses before any engine execution', () => {
  const { run, artifact } = metadata(); assert.throws(() => verifyEvidenceEngineMetadata(run, artifact, Date.parse('2026-11-07T00:00:00Z')));
});
test('build-info cannot exchange importer and engine identities', () => assert.throws(() => verifyEvidenceBuildInfo({ 'build-info.json': Buffer.from('{}'), 'pii-eval': Buffer.alloc(0), SHA256SUMS: Buffer.alloc(0) })));
test('one fresh decision permits exactly one dispatch attempt', () => {
  const digest = 'a'.repeat(64), decisions = new Map([['1'.repeat(40), digest]]), run = { id: 7, head_sha: '1'.repeat(40) };
  checkDispatch({ runId: 7, attempt: 1, decisionDigest: digest, runs: [run], decisions });
  assert.throws(() => checkDispatch({ runId: 7, attempt: 2, decisionDigest: digest, runs: [run], decisions }));
  assert.throws(() => checkDispatch({ runId: 7, attempt: 1, decisionDigest: digest, runs: [run, { ...run, id: 8 }], decisions }));
});
