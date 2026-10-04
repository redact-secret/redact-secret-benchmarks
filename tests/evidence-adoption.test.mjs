import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { adoptionBranch, adoptionKey, candidateRecord, diffRunArtifacts, diffSnapshots, incompatibilityMessage, releaseIdentityProblems, repinPopulation, sha256Digest, snapshotCompatibility } from '../scripts/evidence-adoption.mjs';
import { evidenceAdoptionProblems } from '../scripts/check-evidence-adoption.mjs';
import { historicalRunProblems, officialRunProblems } from '../scripts/check-official-runs.mjs';

// Synthetic data only. No count, digest or case read from a committed ledger, run or corpus is asserted: a repin re-keys them.
const text = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const read = async path => JSON.parse(await text(path));
const registry = await read('benchmarks/official-runs.json');
const inputs = await read('benchmarks/qualification-inputs.json');
const engineSchema = await read('schemas/credential-eval-corpus-snapshot-v1.json');

const makeCase = (id, over = {}) => ({ id, path: `p/${id}.txt`, content: `content of ${id}`, expected: [], grouping: { kind: 'must-not-flag', tier: 'T1', group: 'g', family: 'acme:token', evidence_class: 'project-policy' }, ...over });
const snapshot = (...cases) => ({ schema: 'credential-eval/corpus-snapshot/v1', identity: { source: 'credential-evidence', revision: 'records-tree-sha256:aa', evidence_schema: 'credential-evidence/schema/9.9.9', corpus_digest: `sha256:${'a'.repeat(64)}` }, cases });

test('an engine-unreadable snapshot (cases without content) is reported by rule and semantic id, never by content', () => {
  const unreadable = snapshot(makeCase('good-one'), (({ content, ...rest }) => rest)(makeCase('large-must-flag')), (({ content, ...rest }) => rest)(makeCase('bad-utf8')));
  const compat = snapshotCompatibility(unreadable, engineSchema);
  assert.equal(compat.compatible, false);
  assert.equal(compat.incompatibleCases, 2);
  assert.equal(compat.groups.length, 1);
  assert.match(compat.groups[0].rule, /missing required field 'content'/);
  assert.deepEqual([...compat.groups[0].caseIds].sort(), ['bad-utf8', 'large-must-flag']);
  const message = incompatibilityMessage(compat, registry.engine);
  assert.ok(message.includes(registry.engine.tag));
  assert.match(message, /No pin was changed and no pull request was opened/);
  assert.doesNotMatch(message, /content of/);
  assert.equal(snapshotCompatibility(snapshot(makeCase('a'), makeCase('b')), engineSchema).compatible, true);
});

test('release identity failures are distinct from incompatibility and name the failing fact', () => {
  const snapshotBytes = Buffer.from(JSON.stringify(snapshot(makeCase('a'))));
  const parsed = JSON.parse(snapshotBytes);
  const manifest = { format: 'credential-evidence/release-manifest', tag: 'snapshot-2000.01.01', schemaRevision: '9.9.9', sourceRevision: { commit: 'c'.repeat(40), recordsTree: { digest: 'aa' } }, fixtures: { count: 1 },
    files: [{ asset: 'credential-eval-corpus-snapshot.json', bytes: snapshotBytes.length, sha256: createHash('sha256').update(snapshotBytes).digest('hex') }] };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const base = { tag: 'snapshot-2000.01.01', expectedManifestDigest: sha256Digest(manifestBytes), manifestBytes, manifest, snapshotBytes, snapshot: parsed };
  assert.deepEqual(releaseIdentityProblems(base), []);
  assert.match(releaseIdentityProblems({ ...base, expectedManifestDigest: `sha256:${'0'.repeat(64)}` }).join(), /manifest digest is/);
  assert.match(releaseIdentityProblems({ ...base, tag: 'snapshot-2000.01.02' }).join(), /names tag/);
  assert.match(releaseIdentityProblems({ ...base, snapshotBytes: Buffer.from('{}') }).join(), /differ from the manifest sha256/);
  assert.match(releaseIdentityProblems({ ...base, snapshot: { ...parsed, cases: [] } }).join(), /manifest counts/);
});

test('the adoption key is stable for the same digests and pins, and changes with any of them', () => {
  const args = { tag: 'snapshot-2000.01.01', manifestDigest: `sha256:${'1'.repeat(64)}`, snapshotDigest: `sha256:${'2'.repeat(64)}`, registry };
  assert.equal(adoptionKey(args), adoptionKey({ ...args }));
  assert.notEqual(adoptionKey(args), adoptionKey({ ...args, manifestDigest: `sha256:${'3'.repeat(64)}` }));
  const bumped = JSON.parse(JSON.stringify(registry));
  bumped.scanners[0].version = `${bumped.scanners[0].version}-x`;
  assert.notEqual(adoptionKey(args), adoptionKey({ ...args, registry: bumped }));
  const engine = JSON.parse(JSON.stringify(registry));
  engine.engine.revision = '9'.repeat(40);
  assert.notEqual(adoptionKey(args), adoptionKey({ ...args, registry: engine }));
  assert.match(adoptionBranch(args.tag, adoptionKey(args)), /^adopt-evidence\/snapshot-2000\.01\.01-[0-9a-f]{12}$/);
});

test('the change report is keyed by semantic ids: added, removed, changed, evidence class transitions and diversity', () => {
  const older = snapshot(makeCase('same'), makeCase('moved'), makeCase('gone'));
  const newer = snapshot(makeCase('same'), makeCase('moved', { grouping: { kind: 'must-not-flag', tier: 'T2', group: 'g', family: 'acme:token', evidence_class: 'provider-documented' } }),
    makeCase('fresh', { grouping: { kind: 'policy', tier: 'T3', group: 'h', family: 'newco:key', evidence_class: 'project-policy' } }));
  const d = diffSnapshots(older, newer);
  assert.deepEqual([d.added, d.removed, d.changed.map(c => c.id)], [['fresh'], ['gone'], ['moved']]);
  assert.deepEqual(d.cases, { old: 3, new: 3, added: 1, removed: 1, changed: 1, unchanged: 1 });
  assert.deepEqual(d.evidenceClassTransitions, { 'project-policy -> provider-documented': 1 });
  assert.deepEqual(d.addedByKind, { policy: 1 });
  assert.deepEqual(d.diversity.providers.added, ['newco']);
  assert.deepEqual(d.diversity.families.addedFamilies, ['newco:key']);
});

test('replay drift separates common cases from added cases and keeps unmeasured apart from zero detections', () => {
  const artifact = results => ({ scanners: [{ scanner: 's', status: 'complete', cases: results }] });
  const positive = (id, ...outcomes) => ({ case_id: id, measurement: { type: 'positive', span_outcomes: outcomes } });
  const drift = diffRunArtifacts(artifact([positive('x', 'covered'), positive('y', 'covered')]), artifact([positive('x', 'covered'), positive('y', 'missed'), positive('n', 'covered'), { case_id: 'u', measurement: { type: 'not-measured' } }]), { addedIds: ['n', 'u'] }).s;
  assert.equal(drift.commonCases, 2);
  assert.equal(drift.commonUnchanged, 1);
  assert.deepEqual(drift.commonDrift, { 'positive:covered -> positive:missed': 1 });
  assert.deepEqual(drift.addedCaseOutcomes, { 'positive:covered': 1, 'not-measured': 1 });
  assert.equal(drift.unmeasured, 1);
});

const registryWith = (repinned) => repinned.registry;
const candidate = { evidenceRelease: 'snapshot-2000.01.01', sourceRevision: 'c'.repeat(40), manifestDigest: `sha256:${'1'.repeat(64)}`, snapshotDigest: `sha256:${'2'.repeat(64)}`, evidenceSchema: 'credential-evidence/schema/9.9.9', evidenceRevision: 'records-tree-sha256:aa' };

test('a repin keeps previous accepted runs as historical receipts and the registry stays consistent', async () => {
  const repinned = repinPopulation({ registry, inputs, candidate, supersededOn: '2000-01-02' });
  const floors = registry.runs.filter(r => r.population === 'public-evidence-snapshot');
  assert.ok(floors.length > 0);
  assert.deepEqual(repinned.movedRunIds.sort(), floors.map(r => r.id).sort());
  assert.equal(repinned.registry.runs.some(r => r.population === 'public-evidence-snapshot'), false);
  assert.equal(repinned.registry.runs.length, registry.runs.length - floors.length);
  assert.ok(repinned.registry.historicalRuns.every(r => r.status === 'historical' && r.supersededBy.manifestDigest === candidate.manifestDigest));
  assert.deepEqual(historicalRunProblems(repinned.registry), []);
  const schemaDigest = `sha256:${createHash('sha256').update(await readFile(new URL('../schemas/credential-eval-run-artifact-v1.json', import.meta.url))).digest('hex')}`;
  assert.deepEqual(officialRunProblems(repinned.registry, { schemaDigest, inputs: repinned.inputs }), []);
  // The old run is no longer evidence of the pin: left in runs[] under the new pin, the registry gate refuses it.
  const stale = JSON.parse(JSON.stringify(repinned.registry));
  stale.runs.push(registry.runs.find(r => r.id === 'public-evidence-snapshot@linux-x64'));
  assert.match(officialRunProblems(stale, { schemaDigest, inputs: repinned.inputs }).join('\n'), /evidence differs from the population pin/);
  // And a receipt that is really a run of the current pin is refused as a receipt.
  const wrong = JSON.parse(JSON.stringify(registry));
  wrong.historicalRuns = [{ ...floors[0], status: 'historical', supersededBy: { evidenceRelease: 'x', manifestDigest: candidate.manifestDigest }, supersededOn: '2000-01-02' }];
  assert.match(historicalRunProblems(wrong).join('\n'), /belongs in runs\[\]/);
});

test('the adoption record never carries a fabricated acceptance and a candidate never replaces the active pin', () => {
  const pin = inputs.populations.find(p => p.id === 'public-evidence-snapshot').pin;
  const exists = () => true;
  assert.deepEqual(evidenceAdoptionProblems({ schema: 'redact-secret/evidence-adoption/v1', state: 'none' }, { pin, exists }), []);
  const record = candidateRecord({ tag: candidate.evidenceRelease, manifest: { sourceRevision: { commit: candidate.sourceRevision } }, manifestDigest: candidate.manifestDigest, snapshotIdentity: { corpus_digest: candidate.snapshotDigest, evidence_schema: candidate.evidenceSchema, revision: candidate.evidenceRevision }, key: 'f'.repeat(64), compat: { compatible: true, cases: 1 }, diff: { cases: {} }, registry, previous: { evidenceRelease: pin.evidenceRelease, manifestDigest: pin.manifestDigest } });
  assert.equal(record.candidate.ownerAcceptance, null);
  assert.deepEqual(evidenceAdoptionProblems(record, { pin, exists }), []);
  const forged = JSON.parse(JSON.stringify(record));
  forged.candidate.ownerAcceptance = { acceptedBy: 'someone', acceptedOn: '2000-01-02', decision: 'docs/decisions/x.md' };
  assert.match(evidenceAdoptionProblems(forged, { pin, exists }).join(), /no owner acceptance/);
  assert.match(evidenceAdoptionProblems(record, { pin, exists: () => false }).join(), /changeReport/);
  const active = JSON.parse(JSON.stringify(record));
  active.candidate.evidenceRelease = pin.evidenceRelease;
  assert.match(evidenceAdoptionProblems(active, { pin, exists }).join(), /not the active pin/);
  const accepted = { ...record, state: 'accepted' };
  assert.match(evidenceAdoptionProblems(accepted, { pin, exists }).join(), /active pin/);
});

test('the adoption workflow is dispatch-only, least-privilege, and opens a pull request only after a passing preflight', async () => {
  const raw = await text('.github/workflows/adopt-evidence-snapshot.yml');
  const wf = YAML.parse(raw);
  assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
  assert.deepEqual(wf.permissions, {});
  assert.deepEqual(wf.jobs.preflight.permissions, { contents: 'read' });
  assert.deepEqual(wf.jobs.propose.permissions, { contents: 'write', 'pull-requests': 'write' });
  assert.match(wf.jobs.propose.if, /outcome == 'ready'/);
  assert.equal(wf.jobs.propose.needs, 'preflight');
  assert.equal(wf.concurrency['cancel-in-progress'], false);
  // Inputs reach shell steps only through env.
  for (const job of Object.values(wf.jobs)) for (const step of job.steps) if (step.run) assert.doesNotMatch(step.run, /\$\{\{ *inputs\./);
  // The authority file is never named: renewing it is the owner's separate change.
  assert.doesNotMatch(raw, /qualification-authority/);
});
