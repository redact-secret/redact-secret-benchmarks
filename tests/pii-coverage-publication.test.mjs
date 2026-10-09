import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PII_COVERAGE_VIEW, piiCoveragePublication, writePiiCoveragePublication, piiCoveragePublicationProblems, validatePiiCoverageMembership } from '../scripts/pii-coverage-publication.mjs';
import { piiEvidencePublication } from '../scripts/pii-evidence-publication.mjs';
import { summarizeCoverage } from '../scripts/lib/pii-coverage-summary.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedFiles = ['benchmarks/pii-authority.json', 'benchmarks/qualification-authority.json',
  'benchmarks/pii-evidence/snapshot-pin.json', 'benchmarks/pii-evidence/consumer-pin.json',
  'benchmarks/inputs/pii-evidence-snapshot-v2-candidate/snapshot-pin.json', 'benchmarks/inputs/pii-evidence-snapshot-v2-candidate/consumer-pin.json'];
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pii-coverage-source-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const [projection, evidence] = await Promise.all([piiCoveragePublication(repo), piiEvidencePublication(repo)]);
  const files = [...new Set([...projection.sources.map(row => row.path), ...evidence.view.sources.map(row => row.path), ...protectedFiles,
    'benchmarks/inputs/pii-coverage/baseline-product-catalog.json', 'benchmarks/inputs/pii-coverage/candidate-product-catalog.json'])];
  await Promise.all(files.map(async file => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await cp(path.join(repo, file), path.join(root, file)); }));
  return { root, evidenceSources: evidence.view.sources };
}
async function checkpoint(root) { return Promise.all(protectedFiles.map(async file => [file, sha(await readFile(path.join(root, file)))])); }
async function saved(root, value) { await writeFile(path.join(root, PII_COVERAGE_VIEW), `${JSON.stringify(value, null, 2)}\n`); }

test('real byte-verified source publication recounts and leaves both authorities and active/proposed pins unchanged', async t => {
  const { root } = await fixture(t), before = await checkpoint(root);
  const result = await writePiiCoveragePublication(root);
  assert.deepEqual(await piiCoveragePublicationProblems(root), []);
  assert.equal(result.supportClaims, false); assert.equal(result.qualified, false);
  assert.notEqual(result.coverage.inventories.active.source.snapshot.id, result.coverage.inventories.proposed.source.snapshot.id);
  for (const role of ['active', 'proposed']) for (const side of ['baseline', 'candidate']) {
    const joined = result.coverage.matrices[role][side];
    const keys = result.coverage.inventories[role].rows.map(row => row.kindKey).sort();
    assert.deepEqual(joined.matrix.rows.map(row => row.kindKey).sort(), keys);
    assert.equal(joined.summary.discoveredKinds, keys.length);
    assert.equal(Object.values(joined.summary.states).reduce((a, b) => a + b, 0), keys.length);
    assert.equal(joined.summary.descriptiveCoverage.denominator, keys.length);
    assert.equal(joined.matrix.identity.snapshotId, result.coverage.inventories[role].source.snapshot.id);
    if (role === 'proposed') assert.ok(joined.matrix.rows.every(row => row.observation.status !== 'valid'));
  }
  for (const source of result.sources) assert.equal(source.sha256, sha(await readFile(path.join(root, source.path))));
  assert.deepEqual(await checkpoint(root), before);
});

test('saved projection edits fail closed for drops, duplicates, unknown states, mixed identities and summaries', async t => {
  const { root } = await fixture(t), result = await writePiiCoveragePublication(root);
  const mutations = [
    value => { value.coverage.matrices.active.baseline.matrix.rows.pop(); },
    value => { value.coverage.matrices.active.baseline.matrix.rows.push(structuredClone(value.coverage.matrices.active.baseline.matrix.rows[0])); },
    value => { value.coverage.matrices.active.baseline.matrix.rows[0].state = 'stable'; },
    value => { value.coverage.matrices.active.baseline.matrix.identity.snapshotCommitment = 'f'.repeat(64); },
    value => { value.coverage.matrices.active.baseline.summary.descriptiveCoverage.denominator++; },
    value => { value.coverage.matrices.active.baseline.summary.discoveredKinds--; },
    value => { value.supportClaims = true; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(result); mutate(value); await saved(root, value);
    assert.ok((await piiCoveragePublicationProblems(root)).length > 0);
  }
});

test('independent membership guard refuses source drops/duplicates and hidden unsupported or unknown rows', async t => {
  const { root } = await fixture(t), { coverage } = await piiCoveragePublication(root);
  const changes = [
    value => { const joined = value.matrices.active.baseline; joined.matrix.rows.pop(); joined.summary = summarizeCoverage(joined.matrix); },
    value => { value.inventories.active.rows.push(structuredClone(value.inventories.active.rows[0])); },
    value => { const joined = value.matrices.active.baseline; joined.matrix.rows[0].evidence.authoredCases++; joined.summary = summarizeCoverage(joined.matrix); },
    value => { const joined = value.matrices.active.baseline; joined.matrix.identity.snapshotId = 'another-source'; joined.summary = summarizeCoverage(joined.matrix); },
  ];
  for (const change of changes) { const value = structuredClone(coverage); change(value); assert.throws(() => validatePiiCoverageMembership(value)); }
});

test('source byte mutations, unavailable source and invalid observation artifacts prevent publication', async t => {
  const { root, evidenceSources } = await fixture(t);
  await writePiiCoveragePublication(root);
  const runtimeRegistry = 'benchmarks/pii-evidence/candidate-runtimes.json';
  const runtimeBytes = await readFile(path.join(root, runtimeRegistry));
  await writeFile(path.join(root, runtimeRegistry), '{malformed');
  await assert.rejects(piiCoveragePublication(root));
  assert.ok((await piiCoveragePublicationProblems(root)).length > 0);
  await writeFile(path.join(root, runtimeRegistry), runtimeBytes);
  const taxonomy = 'benchmarks/inputs/pii-coverage/active/privacy-kinds.json';
  const original = await readFile(path.join(root, taxonomy));
  await writeFile(path.join(root, taxonomy), Buffer.concat([original, Buffer.from(' ')]));
  await assert.rejects(piiCoveragePublication(root), /taxonomy-bytes-mismatch/);
  assert.ok((await piiCoveragePublicationProblems(root)).length > 0);
  await writeFile(path.join(root, taxonomy), original);
  const catalog = 'benchmarks/inputs/pii-coverage/baseline-product-catalog.json';
  const catalogBytes = await readFile(path.join(root, catalog));
  await writeFile(path.join(root, catalog), Buffer.concat([catalogBytes, Buffer.from(' ')]));
  await assert.rejects(piiCoveragePublication(root), /product-catalog-projection-mismatch/);
  await writeFile(path.join(root, catalog), catalogBytes);
  const artifact = evidenceSources.find(row => row.path.endsWith('.public-synthetic-artifact.json'));
  if (artifact) {
    const bytes = await readFile(path.join(root, artifact.path));
    await writeFile(path.join(root, artifact.path), Buffer.concat([bytes, Buffer.from(' ')]));
    await assert.rejects(piiCoveragePublication(root), /invalid-observation-source/);
    await writeFile(path.join(root, artifact.path), bytes);
  }
  await rm(path.join(root, taxonomy));
  await assert.rejects(piiCoveragePublication(root));
});

test('absent observations remain explicit without changing source inventory denominator', async t => {
  const { root, evidenceSources } = await fixture(t);
  const before = await checkpoint(root);
  await Promise.all(evidenceSources.map(source => rm(path.join(root, source.path))));
  const result = await writePiiCoveragePublication(root);
  assert.deepEqual(await piiCoveragePublicationProblems(root), []);
  for (const role of ['active', 'proposed']) for (const side of ['baseline', 'candidate']) {
    const joined = result.coverage.matrices[role][side];
    assert.equal(joined.summary.discoveredKinds, result.coverage.inventories[role].rows.length);
    assert.ok(joined.matrix.rows.every(row => row.observation.status === 'absent'));
    assert.ok(joined.matrix.rows.every(row => !['measured-supported', 'measured-missed', 'measured-partial'].includes(row.state)));
    assert.equal(joined.matrix.identity.productCommitment, null);
    assert.equal(joined.matrix.identity.bindingCommitment, null);
    assert.deepEqual(joined.summary.metrics, []);
  }
  assert.deepEqual(await checkpoint(root), before);
});
