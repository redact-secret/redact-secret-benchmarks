import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AXIS_OVERLAY_FILE, axisOverlayProblems, buildAxisOverlay, contextGroup, joinLegacyToSnapshot, serializeAxisOverlay } from '../benchmarks/qualification/axis-overlay.ts';
import { buildEvaluationEvidence, evaluationEvidenceDigest, serializeEvaluationEvidence, EVALUATION_EVIDENCE_FILE } from '../benchmarks/qualification/evaluation-evidence.ts';
import { canonical } from '../benchmarks/qualification/canonical.ts';
import { controlAxis, scoredContractIds } from '../benchmarks/evaluation/domains/credential/assessment.ts';

// Structure and derivation only. No axis value, count or digest read from a committed file is asserted: a new snapshot or fixture
// re-keys them, and `npm run qualification:axis-overlay -- --check` (with the snapshot) is what holds the committed overlay.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');

/** One real development fixture of each kind, with the axes the legacy classifier gave it. */
async function sample() {
  const categories = await read('benchmarks/categories.json');
  const development = (await read('corpora/development/manifest.json')).categories;
  let positive, control;
  for (const category of categories.filter(c => development.includes(c.id))) {
    const corpus = await read(category.corpus);
    for (const f of corpus.fixtures) {
      if (f.twinOf || f.assessment.tier === 'T0') continue;
      const secret = f.expected.some(e => (e.role ?? 'secret') === 'secret');
      if (secret && !positive) positive = { category: category.id, fixture: f };
      if (!secret && !control && controlAxis(category.id, f) && controlAxis(category.id, f) !== 'pending') control = { category: category.id, fixture: f };
    }
    if (positive && control) return { positive, control };
  }
  throw new Error('no development fixtures to sample');
}

const caseOf = ({ category, fixture }, id) => ({
  id, path: `${id}.txt`, content: fixture.content, expected: fixture.expected.map(e => ({ start: e.start, end: e.end, role: e.role ?? 'secret' })),
  grouping: { kind: 'must-redact', tier: 'T1', group: 'a-scenario-id' },
});

test('the overlay is derived by content join: a positive gets its category and group, a control its reviewed axis, an unknown case nothing', async () => {
  const { positive, control } = await sample();
  const snapshot = {
    identity: { corpus_digest: `sha256:${'a'.repeat(64)}` },
    cases: [caseOf(positive, 'canonical-positive'), caseOf(control, 'canonical-control'), { id: 'canonical-new', path: 'n.txt', content: 'no legacy fixture has this exact content\n', expected: [], grouping: { kind: 'must-not-flag', tier: 'T1', group: 's' } }],
  };
  const overlay = await buildAxisOverlay(snapshot);
  assert.equal(overlay.contexts['canonical-positive'], `${positive.category}/${positive.fixture.group}`);
  assert.equal(contextGroup(overlay.contexts['canonical-positive']), positive.fixture.group);
  assert.equal(overlay.controls['canonical-control'], controlAxis(control.category, control.fixture));
  assert.ok(!('canonical-new' in overlay.contexts) && !('canonical-new' in overlay.controls));
  assert.equal(overlay.derivation.joinedCases + overlay.derivation.unjoinedCases, snapshot.cases.length);
  assert.deepEqual(axisOverlayProblems(overlay), []);
  // Deterministic: the same snapshot writes the same bytes, whatever order its cases are in.
  assert.equal(serializeAxisOverlay(await buildAxisOverlay({ ...snapshot, cases: [...snapshot.cases].reverse() })), serializeAxisOverlay(overlay));
});

test('the overlay carries the legacy targets of a joined case as its detector attribution, product detectors only', async () => {
  const { positive, control } = await sample();
  const targetsOf = async ({ category, fixture }) => {
    const fixtureDetectors = await read('benchmarks/fixture-detectors.json');
    return [...new Set([...(fixtureDetectors[`${category}--${fixture.id}`] ?? fixture.detectors ?? []), ...(fixture.arrivalTargets ?? [])].filter(d => scoredContractIds.includes(d)))].sort();
  };
  const overlay = await buildAxisOverlay({
    identity: { corpus_digest: `sha256:${'a'.repeat(64)}` },
    cases: [caseOf(positive, 'canonical-positive'), caseOf(control, 'canonical-control'), { id: 'canonical-new', path: 'n.txt', content: 'no legacy fixture has this exact content\n', expected: [], grouping: { kind: 'must-not-flag', tier: 'T1', group: 's' } }],
  });
  for (const [id, sampled] of [['canonical-positive', positive], ['canonical-control', control]]) {
    const targets = await targetsOf(sampled);
    if (targets.length) assert.deepEqual(overlay.detectors[id], targets, id); else assert.ok(!(id in overlay.detectors), id);
  }
  assert.ok(!('canonical-new' in overlay.detectors), 'a case no legacy fixture joins is attributed nothing');
  assert.ok(Object.values(overlay.detectors).every(list => list.every(d => scoredContractIds.includes(d))));
  assert.deepEqual(axisOverlayProblems(overlay), []);
});

test('the identity join pairs a development fixture first and a legacy regression fixture second, one to one, and names no axis for the second', async () => {
  const { positive } = await sample();
  const categories = await read('benchmarks/categories.json');
  const regression = (await read('corpora/regression/manifest.json')).categories;
  const regressionFixture = [];
  for (const category of categories.filter(c => regression.includes(c.id))) {
    const corpus = await read(category.corpus);
    if (corpus.fixtures.length) { regressionFixture.push({ category: category.id, fixture: corpus.fixtures[0] }); break; }
  }
  assert.ok(regressionFixture.length, 'a regression fixture to sample');
  const snapshot = {
    identity: { corpus_digest: `sha256:${'a'.repeat(64)}` },
    cases: [caseOf(positive, 'canonical-positive'), caseOf(regressionFixture[0], 'canonical-regression'), { id: 'canonical-new', path: 'n.txt', content: 'no legacy fixture has this exact content\n', expected: [], grouping: { kind: 'must-not-flag', tier: 'T1', group: 's' } }],
  };
  const joined = await joinLegacyToSnapshot(snapshot);
  assert.equal(joined.get(`${positive.category}--${positive.fixture.id}`), 'canonical-positive');
  assert.equal(joined.get(`${regressionFixture[0].category}--${regressionFixture[0].fixture.id}`), 'canonical-regression');
  assert.ok(![...joined.values()].includes('canonical-new'));
  // The regression join identifies a case only: the overlay (axes, attribution) is still derived from the development fixtures alone.
  const overlay = await buildAxisOverlay(snapshot);
  assert.ok(!('canonical-regression' in overlay.contexts) && !('canonical-regression' in overlay.controls) && !('canonical-regression' in overlay.detectors));
});

test('an overlay that is not well formed is refused', async () => {
  const { positive } = await sample();
  const good = await buildAxisOverlay({ identity: { corpus_digest: `sha256:${'a'.repeat(64)}` }, cases: [caseOf(positive, 'c1')] });
  const mutate = change => { const o = structuredClone(good); change(o); return axisOverlayProblems(o); };
  assert.ok(mutate(o => { o.contexts.c1 = 'no-category'; }).some(p => /<category>\/<group>/.test(p)));
  assert.ok(mutate(o => { o.controls.c2 = 'not-an-axis'; }).some(p => /not a reviewed control axis/.test(p)));
  assert.ok(mutate(o => { o.controls.c1 = null; }).some(p => /both a context and a control/.test(p)));
  assert.ok(mutate(o => { o.snapshot.corpusDigest = 'x'; }).some(p => /corpusDigest/.test(p)));
  assert.ok(mutate(o => { o.owner = 'credential-evidence'; }).some(p => /identity/.test(p)));
  assert.ok(mutate(o => { o.controls.c2 = 'pending'; }).some(p => /not a reviewed control axis/.test(p)), 'pending is no axis');
  assert.ok(mutate(o => { o.detectors.c1 = ['not-a-detector']; }).some(p => /detectors\[c1\]/.test(p)));
  assert.ok(mutate(o => { o.detectors.c1 = []; }).some(p => /detectors\[c1\]/.test(p)));
  assert.ok(mutate(o => { o.detectors.c1 = [scoredContractIds[1], scoredContractIds[0]].sort().reverse(); }).some(p => /sorted, unique/.test(p)));
  assert.ok(mutate(o => { delete o.detectors; }).some(p => /detectors is a required object/.test(p)));
  assert.deepEqual(axisOverlayProblems(null), ['the overlay is not an object']);
});

test('the committed overlay is well formed, product-owned, bound to the pinned public corpus and a policy revision component', async () => {
  const overlay = await read(AXIS_OVERLAY_FILE);
  const registry = await read('benchmarks/official-runs.json');
  assert.deepEqual(axisOverlayProblems(overlay), []);
  assert.equal(overlay.owner, 'redact-secret-benchmarks');
  assert.equal(overlay.snapshot.corpusDigest, registry.populations.find(p => p.id === overlay.population).evidence.corpusDigest);
  const { POLICY_FILES } = await import('../benchmarks/qualification/inputs.ts');
  assert.ok(POLICY_FILES.includes(AXIS_OVERLAY_FILE));
});

test('the evaluation evidence is derived from the product contracts, deterministic, and pinned by digest', async () => {
  const evidence = buildEvaluationEvidence();
  assert.equal(evidence.schema, 'credential-eval/evaluation-evidence/v1');
  assert.equal(serializeEvaluationEvidence(), serializeEvaluationEvidence());
  assert.ok(Object.keys(evidence.validators).every(family => family in evidence.families), 'a validator belongs to a family');
  assert.ok(evidence.classification_allowlist);
  assert.ok(evidence.benign_taxonomies.includes('pending'), 'the pending axis is in the vocabulary, as the engine treats T0 controls');
  assert.equal(evaluationEvidenceDigest(), `sha256:${sha256(canonical(evidence))}`);
  // The committed file is the derivation, and the registry pins its digest.
  assert.equal(await readFile(new URL(`../${EVALUATION_EVIDENCE_FILE}`, import.meta.url), 'utf8'), serializeEvaluationEvidence());
  const registry = await read('benchmarks/official-runs.json');
  assert.equal(registry.methodsRun.evaluationEvidence.digest, evaluationEvidenceDigest());
});
