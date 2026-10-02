import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkOfficialRuns, officialRunProblems } from '../scripts/check-official-runs.mjs';
import { canonical } from '../benchmarks/qualification/canonical.ts';
import { exportPopulation, PRODUCT_POPULATIONS, SNAPSHOT_ENTRY } from '../benchmarks/qualification/population-snapshot.ts';
import { runArtifactSchemaDigest } from '../benchmarks/qualification/run-artifact.ts';

// Structure and identity only. No count, digest value or family read from a committed run or corpus is asserted: a repin
// or a new fixture re-keys them, and the registry gate (not a test) is what holds the pins.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const registry = await read('benchmarks/official-runs.json');
const inputs = await read('benchmarks/qualification-inputs.json');
const context = { schemaDigest: runArtifactSchemaDigest(), inputs };
const clone = () => structuredClone(registry);

test('the real registry is consistent with the vendored schema and the qualification inputs manifest', async () => {
  assert.deepEqual(officialRunProblems(registry, context), []);
  assert.deepEqual(await checkOfficialRuns(), []);
});

test('a drifted vendored schema, an unpinned scanner and a non-canonical platform are refused', () => {
  assert.ok(officialRunProblems(registry, { ...context, schemaDigest: `sha256:${'1'.repeat(64)}` }).some(p => /vendored RunArtifact schema digest/.test(p)));
  const unpinned = clone();
  delete unpinned.scanners[0].version;
  assert.ok(officialRunProblems(unpinned, context).some(p => /version is required/.test(p)));
  const noCanonical = clone();
  noCanonical.config.platforms['linux-x64'].canonical = false;
  assert.ok(officialRunProblems(noCanonical, context).some(p => /canonical/.test(p)));
});

test('a recorded run must match the pinned engine, evidence, scanners and determinism check', () => {
  const run = registry.runs[0];
  assert.ok(run, 'at least one run is recorded');
  const mutate = change => { const r = clone(); change(r.runs[0], r); return officialRunProblems(r, context); };
  assert.ok(mutate(r => { r.engine.revision = 'a'.repeat(40); }).some(p => /engine differs/.test(p)));
  assert.ok(mutate(r => { r.evidence.corpus_digest = `sha256:${'2'.repeat(64)}`; }).some(p => /evidence differs/.test(p)));
  assert.ok(mutate(r => { r.determinism = { runs: 1, semanticDigestsEqual: true }; }).some(p => /at least two runs/.test(p)));
  assert.ok(mutate(r => { r.determinism = { runs: 2, semanticDigestsEqual: false }; }).some(p => /equal semantic digests/.test(p)));
  assert.ok(mutate(r => { r.engineRunClass = 'exploratory'; }).some(p => /only official runs/.test(p)));
  assert.ok(mutate(r => { r.scanners = r.scanners.filter(s => s.id !== 'trufflehog'); }).some(p => /scanner trufflehog is missing/.test(p)));
  assert.ok(mutate(r => { r.scanners.find(s => s.id === 'trufflehog').version = '3.97.6'; }).some(p => /ran 3\.97\.6/.test(p)));
  assert.ok(mutate(r => { r.scanners.find(s => s.id === 'redact-secret').build = 'candidate'; }).some(p => /candidate build/.test(p)));
  assert.ok(mutate(r => { r.canonical = !r.canonical; }).some(p => /canonical must be true/.test(p)));
  assert.ok(mutate(r => { r.runClass = 'public'; r.publication = 'internal'; }).some(p => /public run needs publication public/.test(p)));
});

test('a product population is content-addressed, so a corpus change must be re-pinned', () => {
  const stale = clone();
  stale.populations.find(p => p.id === 'regression-corpus').evidence.release.tag = 'regression-000000000000';
  assert.ok(officialRunProblems(stale, context).some(p => /release.tag must end with/.test(p)));
});

for (const population of PRODUCT_POPULATIONS) {
  test(`${population} exports a deterministic, self-consistent credential-eval snapshot and release manifest`, async () => {
    const a = await exportPopulation(population), b = await exportPopulation(population);
    assert.equal(a.snapshotBytes, b.snapshotBytes);
    assert.equal(a.manifestBytes, b.manifestBytes);
    const { identity, cases } = a.snapshot;
    assert.ok(cases.length > 0);
    assert.equal(identity.corpus_digest, `sha256:${createHash('sha256').update(canonical(cases)).digest('hex')}`);
    assert.equal(identity.revision, `corpus-${identity.corpus_digest}`);
    assert.equal(a.manifest.files.length, 1);
    assert.equal(a.manifest.files[0].path, SNAPSHOT_ENTRY);
    assert.equal(a.manifest.files[0].sha256, createHash('sha256').update(a.snapshotBytes).digest('hex'));
    assert.ok(a.tag.endsWith(identity.corpus_digest.slice(7, 19)));
    assert.deepEqual(cases.map(c => c.id), [...cases.map(c => c.id)].sort((x, y) => Buffer.compare(Buffer.from(x), Buffer.from(y))));
    for (const c of cases) assert.match(c.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(!('release' in identity), 'a snapshot input must not declare its release');
    // Product policy facts are keyed by case id beside the snapshot, never inside it.
    assert.ok(cases.every(c => !('expectedAction' in c) && !('expectedAction' in c.grouping)));
    assert.deepEqual(Object.keys(a.metadata).sort(), cases.map(c => c.id).sort());
  });
}

test('the official-run workflow is dispatch-only, pinned by commit, and gives the engine token the least it needs', async () => {
  const workflow = (await readFile(new URL('../.github/workflows/official-runs.yml', import.meta.url), 'utf8')).replace(/^\s*#.*$/gm, '');
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/m);
  assert.ok(!/pull_request/.test(workflow) && !/^on:.*push/m.test(workflow), 'never on push or pull_request');
  const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map(m => m[1]);
  assert.ok(uses.length > 0);
  for (const use of uses) assert.match(use, /@[0-9a-f]{40}$/, `${use} must be pinned to a commit`);
  assert.match(workflow, /permissions:\n  contents: read\n/);
  assert.ok(!/permissions:[^\n]*write/.test(workflow));
  const checkouts = workflow.split('actions/checkout@').slice(1);
  assert.ok(checkouts.length >= 2);
  for (const block of checkouts) assert.match(block.slice(0, 400), /persist-credentials: false/);
  assert.match(workflow, /repositories: credential-eval\n\s+permission-contents: read/);
  assert.match(workflow, /npm run official-runs:check -- --bindings/);
});

test('the two product populations never share a case, a category or a denominator', async () => {
  const [regression, policy] = await Promise.all(PRODUCT_POPULATIONS.map(exportPopulation));
  assert.equal(regression.categories.filter(c => policy.categories.includes(c)).length, 0);
  const ids = new Set(regression.snapshot.cases.map(c => c.id));
  assert.equal(policy.snapshot.cases.filter(c => ids.has(c.id)).length, 0);
  assert.notEqual(regression.corpusDigest, policy.corpusDigest);
});

test('the methods run is pinned: the gates it feeds, the reference, the seed and the evaluation evidence digest are checked', () => {
  const mutate = change => { const r = clone(); change(r); return officialRunProblems(r, { ...context, evaluationEvidenceDigest: r.methodsRun?.evaluationEvidence?.digest }); };
  assert.deepEqual(mutate(() => {}), []);
  assert.ok(mutate(r => { delete r.methodsRun; }).some(p => /methodsRun is required/.test(p)));
  assert.ok(mutate(r => { r.methodsRun.methods = ['metamorphic', 'mutation']; }).some(p => /must include differential/.test(p)));
  assert.ok(mutate(r => { r.methodsRun.methods = ['mutation', 'metamorphic', 'differential']; }).some(p => /sorted, unique/.test(p)));
  assert.ok(mutate(r => { r.methodsRun.population = 'regression-corpus'; }).some(p => /floors population/.test(p)));
  assert.ok(mutate(r => { r.methodsRun.reference = 'nobody'; }).some(p => /not a pinned scanner/.test(p)));
  assert.ok(mutate(r => { r.methodsRun.seed = 'path'; }).some(p => /seed of case-id or legacy-category/.test(p)));
  assert.ok(officialRunProblems(clone(), { ...context, evaluationEvidenceDigest: `sha256:${'3'.repeat(64)}` }).some(p => /evaluation evidence file has digest/.test(p)));
});

test('a recorded methods run must be the pinned methodsRun, with its own id, and a duplicate id is refused', () => {
  const base = clone();
  const plain = base.runs.find(r => r.population === 'public-evidence-snapshot' && r.kind !== 'methods');
  assert.ok(plain, 'a public run is recorded');
  const methods = { ...structuredClone(plain), id: `${plain.population}+methods@${plain.platform}`, kind: 'methods', methods: [...base.methodsRun.methods], evaluation: { reference: base.methodsRun.reference, seed: base.methodsRun.seed, evidenceDigest: base.methodsRun.evaluationEvidence.digest } };
  const check = (change = () => {}) => { const r = clone(); r.runs = [...r.runs.filter(x => x.id !== methods.id), structuredClone(methods)]; change(r.runs.find(x => x.id === methods.id), r); return officialRunProblems(r, context); };
  assert.deepEqual(check(), []);
  assert.ok(check(run => { run.methods = ['mutation']; }).some(p => /methods differ from the pinned/.test(p)));
  assert.ok(check(run => { run.evaluation.seed = 'legacy-category'; }).some(p => /evaluation .* differs from the pinned methodsRun/.test(p)));
  assert.ok(check(run => { run.id = plain.id; }).some(p => /duplicate run id/.test(p)));
  assert.ok(check(run => { run.population = 'policy-corpus'; run.id = `policy-corpus+methods@${run.platform}`; }).some(p => /pinned methodsRun population only/.test(p)));
  assert.ok(check(run => { delete run.kind; }).some(p => /id must be <population>@<platform>/.test(p)));
  // The pinned darwin configuration hash belongs to the plain measurement; a methods run has its own config_hash.
  assert.ok(!check(run => { run.configHash = `sha256:${'4'.repeat(64)}`; }).some(p => /configHash differs from the pinned/.test(p)));
});
