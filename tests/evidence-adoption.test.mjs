import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { adoptionBranch, adoptionKey, candidateRecord, diffRunArtifacts, diffSnapshots, incompatibilityMessage, releaseIdentityProblems, representationSummary, reviewStateSummary, repinPopulation, sha256Digest, snapshotCompatibility } from '../scripts/evidence-adoption.mjs';
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
  const moved = repinned.registry.historicalRuns.filter(r => r.supersededOn === '2000-01-02');
  assert.equal(moved.length, floors.length);
  assert.ok(moved.every(r => r.status === 'historical' && r.supersededBy.manifestDigest === candidate.manifestDigest));
  assert.ok(repinned.registry.historicalRuns.every(r => r.status === 'historical'));
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

test('a prepared acceptance is checked for its files, its digest and for never filling an owner field (#680)', () => {
  const pin = inputs.populations.find(p => p.id === 'public-evidence-snapshot').pin;
  const patch = '+    "acceptedBy": "OWNER-TO-SET",\n+    "acceptedOn": "OWNER-TO-SET",\n';
  const digest = createHash('sha256').update(patch).digest('hex');
  const record = candidateRecord({ tag: candidate.evidenceRelease, manifest: { sourceRevision: { commit: candidate.sourceRevision } }, manifestDigest: candidate.manifestDigest, snapshotIdentity: { corpus_digest: candidate.snapshotDigest, evidence_schema: candidate.evidenceSchema, revision: candidate.evidenceRevision }, key: 'f'.repeat(64), compat: { compatible: true, cases: 1 }, diff: { cases: {} }, registry, previous: { evidenceRelease: pin.evidenceRelease, manifestDigest: pin.manifestDigest } });
  record.candidate.acceptance = { report: 'r.md', comparison: 'c.json', patch: 'p.patch', patchDigestFile: 'p.sha' };
  const files = { 'p.patch': patch, 'p.sha': `${digest}  p.patch\n` };
  const run = (over = {}) => evidenceAdoptionProblems(record, { pin, exists: () => true, read: path => ({ ...files, ...over })[path] });
  assert.deepEqual(run(), []);
  assert.match(run({ 'p.sha': `${'0'.repeat(64)}  p.patch\n` }).join(), /records 0{64}/);
  const filled = '+    "acceptedBy": "someone",\n';
  assert.match(run({ 'p.patch': filled, 'p.sha': `${createHash('sha256').update(filled).digest('hex')}  p.patch\n` }).join(), /fills an owner field/);
  assert.match(evidenceAdoptionProblems(record, { pin, exists: p => p !== 'p.patch', read: () => '' }).join(), /candidate\.acceptance\.patch p\.patch does not exist/);
});

test('the adoption workflow is dispatch-only, least-privilege, and opens a pull request only after a passing preflight', async () => {
  const raw = await text('.github/workflows/adopt-evidence-snapshot.yml');
  const wf = YAML.parse(raw);
  assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
  assert.deepEqual(wf.permissions, {});
  assert.deepEqual(wf.jobs.preflight.permissions, { contents: 'read' });
  assert.deepEqual(wf.jobs.propose.permissions, { contents: 'write', 'pull-requests': 'write', actions: 'write' });
  // A workflow-token pull request starts no pull_request run (observed on #727); the propose job dispatches validate.yml, which accepts a dispatch, so the required check reports on the head commit.
  const open = wf.jobs.propose.steps.find(s => /gh pr create/.test(s.run ?? ''));
  assert.match(open.run, /gh workflow run validate\.yml --ref "\$BRANCH"/);
  assert.ok('workflow_dispatch' in YAML.parse(await text('.github/workflows/validate.yml')).on);
  assert.match(wf.jobs.propose.if, /outcome == 'ready'/);
  assert.equal(wf.jobs.propose.needs, 'preflight');
  assert.equal(wf.concurrency['cancel-in-progress'], false);
  // Inputs reach shell steps only through env.
  for (const job of Object.values(wf.jobs)) for (const step of job.steps) if (step.run) assert.doesNotMatch(step.run, /\$\{\{ *inputs\./);
  // The authority file is never named: renewing it is the owner's separate change.
  assert.doesNotMatch(raw, /qualification-authority/);
});

test('a candidate read by a newer engine records the engine change, a superseded candidate and no acceptance (#690)', () => {
  const pin = inputs.populations.find(p => p.id === 'public-evidence-snapshot').pin;
  const engine = { ...registry.engine, tag: 'v9.9.9', revision: '9'.repeat(40), runArtifactSchema: { ...registry.engine.runArtifactSchema, sha256: `sha256:${'8'.repeat(64)}` } };
  const args = { tag: candidate.evidenceRelease, manifest: { sourceRevision: { commit: candidate.sourceRevision } }, manifestDigest: candidate.manifestDigest, snapshotIdentity: { corpus_digest: candidate.snapshotDigest, evidence_schema: candidate.evidenceSchema, revision: candidate.evidenceRevision }, compat: { compatible: true, cases: 1 }, diff: { cases: {} }, registry, previous: { evidenceRelease: pin.evidenceRelease, manifestDigest: pin.manifestDigest } };
  const plain = candidateRecord({ ...args, key: 'f'.repeat(64) });
  assert.equal(plain.candidate.engineChange, undefined);
  assert.equal(plain.candidate.supersedesCandidate, undefined);
  const record = candidateRecord({ ...args, key: 'e'.repeat(64), engine, supersededCandidate: { evidenceRelease: 'snapshot-2000.01.01', adoptionKey: `sha256:${'d'.repeat(64)}` } });
  assert.deepEqual(record.candidate.engine, { tag: 'v9.9.9', revision: '9'.repeat(40) });
  assert.equal(record.candidate.engineChange.from.tag, registry.engine.tag);
  assert.equal(record.candidate.engineChange.to.tag, 'v9.9.9');
  assert.equal(record.candidate.engineChange.runArtifactSchemaSha256, `sha256:${'8'.repeat(64)}`);
  assert.equal(record.candidate.supersedesCandidate.evidenceRelease, 'snapshot-2000.01.01');
  assert.equal(record.candidate.ownerAcceptance, null);
  assert.deepEqual(evidenceAdoptionProblems(record, { pin, exists: () => true }), []);
  // The engine that reads the snapshot is part of the adoption key: the same snapshot read by another engine is another adoption.
  const base = { tag: 'snapshot-2000.01.01', manifestDigest: `sha256:${'1'.repeat(64)}`, snapshotDigest: `sha256:${'2'.repeat(64)}` };
  assert.notEqual(adoptionKey({ ...base, registry }), adoptionKey({ ...base, registry: { ...registry, engine } }));
});

test('representation facts are summarised by counts only and absent facts are reported as absent', () => {
  const withFacts = { ...snapshot(makeCase('a', { representation: { derivation: { kind: 'authored-base' } } }),
    makeCase('b', { representation: { input_validity: 'unpaired-surrogate-split', transformation: { steps: [{ op: 'encode', codec: 'base64' }, { op: 'fragment', mechanism: 'fixed-width-wrap' }] } }, expected: [{ start: 0, end: 1, fragments: [{ start: 0, end: 1 }], decoded: { via: [{ codec: 'strip-codepoints' }] } }] })) };
  withFacts.identity = { ...withFacts.identity, representation: 'credential-eval/representation/1' };
  const summary = representationSummary(withFacts, { evalExport: { representation: { facts_digest: `sha256:${'a'.repeat(64)}` }, materialized: 3, exported: 2, notExported: { total: 1 } } });
  assert.equal(summary.present, true);
  assert.equal(summary.casesWithFacts, 2);
  assert.deepEqual(summary.casesByEncodeCodec, { 'encode:base64': 1 });
  assert.deepEqual(summary.fragmentMechanisms, { 'fixed-width-wrap': 1 });
  assert.equal(summary.expectedSpansWithFragments, 1);
  assert.deepEqual(summary.decodedByCodec, { 'strip-codepoints': 1 });
  assert.equal(summary.notExported.exported, 2);
  assert.deepEqual(representationSummary(snapshot(makeCase('a')), {}), { present: false });
});

test('the adoption workflow can name the engine and supersede a candidate, still only through env and the script (#690)', async () => {
  const wf = YAML.parse(await text('.github/workflows/adopt-evidence-snapshot.yml'));
  assert.deepEqual(Object.keys(wf.on.workflow_dispatch.inputs).sort(), ['engine_tag', 'manifest_digest', 'supersede', 'tag']);
  assert.equal(wf.on.workflow_dispatch.inputs.supersede.type, 'boolean');
  assert.equal(wf.on.workflow_dispatch.inputs.supersede.default, false);
  const prepare = wf.jobs.preflight.steps.find(s => s.id === 'prepare');
  assert.match(prepare.run, /--engine-tag "\$ENGINE_TAG"/);
  assert.match(prepare.run, /--supersede/);
  assert.equal(prepare.env.GH_TOKEN, '${{ github.token }}');
});

test('the review state names maintainer-only fixtures by their Case or Scenario lifecycle and reports the rest as unattributed, never guessed (#690)', () => {
  const manifest = { reviewState: { contract: 'x', rule: 'solo-maintainer-period', fixtures: { reviewed: 0 }, maintainerOnly: { fixtures: 3 } } };
  const record = (kind, id, lifecycle) => ({ path: `records/${kind}s/${id}.json`, text: JSON.stringify({ kind, id, lifecycle }) });
  const bundle = { records: [record('case', 'c1', 'maintainer-only'), record('scenario', 's1', 'maintainer-only'), record('case', 'c2', 'draft')] };
  const materialized = { fixtures: [
    { id: 'a', case: 'c1', target: { type: 'case', id: 'c1' }, expected: { outcome: 'must-flag' } },
    { id: 'b', target: { type: 'scenario', id: 's1' }, expected: { outcome: 'must-not-flag' } },
    { id: 'c', case: 'c2', target: { type: 'case', id: 'c2' }, expected: { outcome: 'must-flag' } },
  ] };
  const summary = reviewStateSummary(manifest, bundle, materialized);
  assert.deepEqual(summary.maintainerOnlyFixtureIds, ['a', 'b']);
  assert.equal(summary.unattributedFixtures, 1);
  assert.deepEqual(reviewStateSummary({}, bundle, materialized), { present: false });
});

test('an engine candidate on the identical evidence rides next to the accepted adoption and carries no owner acceptance (#697)', async () => {
  const { engineCandidateRecord } = await import('../scripts/evidence-adoption.mjs');
  const { engineCandidateProblems } = await import('../scripts/check-evidence-adoption.mjs');
  const pin = { evidenceRelease: 'snapshot-2026.10.04.3', manifestDigest: `sha256:${'a'.repeat(64)}`, snapshotDigest: `sha256:${'b'.repeat(64)}`, sourceRevision: 'c'.repeat(40) };
  const engine = { tag: 'v0.1.0-alpha.5', revision: 'd'.repeat(40), runArtifactSchema: { sha256: `sha256:${'e'.repeat(64)}` } };
  const registry = { engine: { tag: 'v0.1.0-alpha.4', revision: 'f'.repeat(40) } };
  const product = { package: '@redact-secret/core', version: '0.1.0-beta.13', integrity: 'sha512-AAAA' };
  const record = engineCandidateRecord({ pinned: pin, manifestDigest: pin.manifestDigest, key: '1'.repeat(64), compat: { compatible: true, cases: 3 }, registry, engine, product, previousProduct: { version: '0.1.0-beta.12', integrity: 'sha512-BBBB' } });
  const ctx = { pin, exists: () => true };
  assert.deepEqual(engineCandidateProblems({ state: 'accepted', engineCandidate: record }, ctx), []);
  assert.equal(record.ownerAcceptance, null);
  assert.ok(engineCandidateProblems({ state: 'accepted', engineCandidate: { ...record, ownerAcceptance: { acceptedBy: 'x' } } }, ctx).some(p => /no owner acceptance/.test(p)));
  assert.ok(engineCandidateProblems({ state: 'accepted', engineCandidate: { ...record, snapshotDigest: `sha256:${'0'.repeat(64)}` } }, ctx).some(p => /identical evidence/.test(p)));
  assert.ok(engineCandidateProblems({ state: 'candidate', engineCandidate: record }, ctx).some(p => /accepted adoption/.test(p)));
});

test('an evidence candidate rides next to the accepted adoption and carries the same registered product candidate bytes (#690, #698)', async () => {
  const { evidenceCandidateProblems, packagesDigest } = await import('../scripts/check-evidence-adoption.mjs');
  const D = c => `sha256:${c.repeat(64)}`;
  const packages = [{ name: 'a', sha256: D('1') }, { name: 'b', sha256: D('2') }];
  const registry = { candidates: [{ id: 'core-x', product: { commit: 'c'.repeat(40) }, packages }] };
  const record = { state: 'accepted', evidenceCandidate: { evidenceRelease: 'snapshot-2026.10.04.4', manifestDigest: D('3'), snapshotDigest: D('4'), adoptionKey: D('5'), engine: { tag: 'v0.1.0-alpha.5', revision: 'd'.repeat(40) }, engineCompatibility: { compatible: true }, ownerAcceptance: null, changeReport: 'r.json', productCandidates: [{ id: 'core-x', commit: 'c'.repeat(40), packagesDigest: packagesDigest(packages) }] } };
  const ctx = { pin: { evidenceRelease: 'snapshot-2026.10.04.3' }, exists: () => true, productCandidates: registry };
  assert.deepEqual(evidenceCandidateProblems(record, ctx), []);
  assert.equal(packagesDigest([...packages].reverse()), packagesDigest(packages), 'order does not matter');
  const bad = (change) => evidenceCandidateProblems({ ...record, evidenceCandidate: { ...record.evidenceCandidate, ...change } }, ctx);
  assert.ok(bad({ ownerAcceptance: { acceptedBy: 'x' } }).some(p => /no owner acceptance/.test(p)));
  assert.ok(bad({ evidenceRelease: 'snapshot-2026.10.04.3' }).some(p => /newer release/.test(p)));
  assert.ok(bad({ productCandidates: [{ id: 'core-x', commit: 'c'.repeat(40), packagesDigest: D('9') }] }).some(p => /same bytes/.test(p)));
  assert.ok(bad({ productCandidates: [{ id: 'nope', commit: 'c'.repeat(40), packagesDigest: D('9') }] }).some(p => /does not register/.test(p)));
  assert.ok(bad({ product: { version: '0.1.0-beta.13', integrity: `sha512-${'A'.repeat(86)}=` } }).some(p => /well-formed sha512/.test(p)), 'a truncated integrity is refused (the first candidate dispatch used one)');
  assert.deepEqual(bad({ product: { version: '0.1.0-beta.13', integrity: `sha512-${'A'.repeat(86)}==` } }), []);
  assert.ok(evidenceCandidateProblems({ ...record, state: 'candidate' }, ctx).some(p => /accepted adoption/.test(p)));
});

test('a prepared acceptance of an evidence candidate needs its report, data and patch, the patch digest and no filled owner field (#690)', async () => {
  const { evidenceCandidateProblems } = await import('../scripts/check-evidence-adoption.mjs');
  const { createHash } = await import('node:crypto');
  const D = c => `sha256:${c.repeat(64)}`;
  const patch = '+    "acceptedBy": "OWNER-TO-SET",\n';
  const files = { 'p.patch': patch, 'p.sha': `${createHash('sha256').update(patch).digest('hex')}  p.patch\n`, 'r.md': '', 'c.json': '' };
  const ec = { evidenceRelease: 'snapshot-2026.10.05.2', manifestDigest: D('3'), snapshotDigest: D('4'), adoptionKey: D('5'), engine: { tag: 'v0.1.0-alpha.5', revision: 'd'.repeat(40) }, engineCompatibility: { compatible: true }, ownerAcceptance: null, changeReport: 'r.json', acceptance: { report: 'r.md', comparison: 'c.json', patch: 'p.patch', patchDigestFile: 'p.sha' } };
  const ctx = { pin: { evidenceRelease: 'snapshot-2026.10.05' }, exists: p => p === 'r.json' || p in files, read: p => files[p] };
  const run = (change, read = ctx.read) => evidenceCandidateProblems({ state: 'accepted', evidenceCandidate: { ...ec, ...change } }, { ...ctx, read });
  assert.deepEqual(run({}), []);
  assert.match(run({ acceptance: { ...ec.acceptance, patch: 'missing.patch' } }).join(), /evidenceCandidate\.acceptance\.patch missing\.patch does not exist/);
  assert.match(run({}, p => (p === 'p.patch' ? `${patch}+x` : files[p])).join(), /records/);
  assert.match(run({}, p => (p === 'p.patch' ? '+    "acceptedBy": "someone",\n' : files[p])).join(), /fills an owner field|records/);
});
