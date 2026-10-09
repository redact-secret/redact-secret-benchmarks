import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/validate-decisions.mjs';
import { loadDecisionProvenance, provenanceProblems, decisionStatus, decisionRecord, ownerAuthorisationProblems, evidenceAdoptionTarget } from '../scripts/lib/decision-provenance.mjs';
import { adrPath, draftDecision } from '../scripts/prepare-acceptance-package.mjs';

test('reviewed provenance has exact archived identity/status and current spec targets', async () => {
  assert.deepEqual(await validate(), []);
});
test('duplicate identities, missing source digests, and invented statuses are refused', () => {
  const source = loadDecisionProvenance();
  const duplicate = structuredClone(source); duplicate.records.push(duplicate.records[0]);
  assert.ok(provenanceProblems(duplicate).some(p => p.includes('duplicate')));
  const forged = structuredClone(source); forged.records[0].status = 'approved';
  assert.ok(provenanceProblems(forged).length);
  delete forged.records[0].sourceSha256;
  assert.ok(provenanceProblems(forged).length);
});
test('historically accepted narrative cannot authorise a current target or another authority role', () => {
  const source = loadDecisionProvenance();
  const current = source.records.find(r => r.uses.some(u => u.role === 'credential-authority'));
  const binding = current.uses.find(u => u.role === 'credential-authority');
  assert.equal(decisionStatus(current.path, { role: binding.role, target: binding.target }), 'accepted');
  assert.equal(decisionStatus(current.path, { role: 'pii-public-authority', target: binding.target }), undefined);
  assert.equal(decisionStatus(current.path, { role: binding.role, target: { ...binding.target, acceptedBy: 'someone else' } }), undefined);
  const historical = source.records.find(r => r.status === 'accepted' && !r.uses.length);
  assert.equal(decisionStatus(historical.path, { role: binding.role, target: binding.target }), undefined);
  assert.equal(decisionStatus('docs/decisions/missing.md'), undefined);
});
test('owner package stays proposed with all owner fields unset; typed path replaces dated Markdown', () => {
  const tag = 'snapshot-2026.10.09'; const ec = { engine: { tag: 'v0.1.0-alpha.17' }, manifestDigest: 'sha256:' + 'a'.repeat(64), snapshotDigest: 'sha256:' + 'b'.repeat(64) };
  const decision = adrPath(tag, ec.engine.tag);
  assert.match(decision, /^benchmarks\/governance\/authorisations\/.*\.json$/);
  const draft = JSON.parse(draftDecision({ tag, ec, decision, summary: 'prepared evidence' }));
  assert.deepEqual(ownerAuthorisationProblems(draft), []);
  assert.equal(draft.status, 'proposed'); assert.equal(draft.owner.acceptedBy, 'OWNER-TO-SET');
  const accepted = { ...draft, status: 'accepted' };
  assert.ok(ownerAuthorisationProblems(accepted).length);
  assert.equal(decisionRecord(decision, { read: () => accepted }), undefined);
  assert.equal(decisionStatus(decision, { read: () => draft }), 'proposed');
});

test('accepted evidence decision binds the original snapshot/product identity, not just an owner name', () => {
  const source = loadDecisionProvenance();
  const row = source.records.find(r => r.uses.some(use => use.role === 'evidence-adoption'));
  const use = row.uses.find(use => use.role === 'evidence-adoption');
  assert.equal(decisionStatus(row.path, { role: use.role, target: use.target }), 'accepted');
  for (const field of ['evidenceRelease', 'manifestDigest', 'snapshotDigest', 'sourceRevision']) {
    assert.equal(decisionStatus(row.path, { role: use.role, target: { ...use.target, [field]: 'different' } }), undefined);
  }
  assert.deepEqual(evidenceAdoptionTarget({ ...use.target, deployment: { staging: 'new receipt' } }), use.target);
});
