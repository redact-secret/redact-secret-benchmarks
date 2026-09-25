import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoHoldout, buildDataset, extractorSourceHash, holdoutIdentifiers, loadCategoryInputs } from '../benchmarks/lib/candidate-features.ts';
import {
  BANDS, CAP_GRID, GENERATED_SHARE_OVERRIDE, SIGNALS, bandOf, buildManifestDraft, buildProjection, capNeighbours, combineWithinGroup,
  conformance, evaluate, experimentSpecs, fitConfig, generatedShareWeights, halving, isotonicFit, ramp, runConfig, runExperiments,
} from '../benchmarks/lib/calibration-experiments.ts';
import { MIN_STRATUM_ROWS, projectionProblems } from '../benchmarks/lib/calibration-projection.mjs';
import { FEATURE_NAMES, extractEvidenceFeatures } from '../benchmarks/lib/evidence-features.ts';
import { loadRepositoryState, scoringIdentity, validateTuningManifest } from '../benchmarks/lib/tuning-manifest.ts';
import { exclusionProblems } from '../scripts/check-feature-dataset-exclusion.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const holdout = holdoutIdentifiers(root, readdirSync(path.join(root, 'holdout')));
const dataset = buildDataset(loadCategoryInputs(root), { sourceHash: extractorSourceHash(root), commit: 'a'.repeat(40), dirty: false, holdoutIdentifiers: holdout });
const development = dataset.rows.filter(r => r.partition === 'development');
const evaluation = dataset.rows.filter(r => r.partition === 'regression');

// A small, representative spec set keeps the suite fast; the CLI runs the whole grid.
const all = experimentSpecs();
const SUBSET = all.filter(s => !s.id.startsWith('halving-') && s.kind !== 'logistic' && s.kind !== 'lookup-2d')
  .concat(all.filter(s => /^halving-r1-l0-r(50|60)-l0-c(30|40|50)$/.test(s.id)));
const result = runExperiments(dataset, { specs: SUBSET, sensitivity: false });

// Synthetic values only; none resembles an issued credential.
const RANDOMISH = 'q7Vd2LmZ9xKp4TsW8nRb3YhJ6cFg1AeU';
const row = (value, overrides = {}) => ({
  id: 'synthetic--row#0', category: 'synthetic', fixtureId: 'row', partition: 'development', tuningEligible: true, origin: 'authored',
  originBasis: 'authored-corpus', kind: 'must-redact', tier: 'T2', role: 'secret', candidateSource: 'expected-span', candidateIndex: 0,
  range: { start: 0, end: value.length }, family: 'generic-token', contract: 'generic-token', targets: [], contextAxis: null, twinOf: null,
  mutationKind: null, contextClass: 'bare', negativeClass: 'none', features: extractEvidenceFeatures(value), ...overrides,
});

test('the contract within-group rule halves each further contribution and caps the group', () => {
  assert.equal(halving([10, 40, 20], 100), 40 + 10 + 2);
  assert.equal(halving([40, 40, 40, 40], 60), 60);
  assert.equal(halving([], 60), 0);
  assert.equal(combineWithinGroup('linear', [40, 40, 40, 40], 60), 160, 'the forbidden baseline double-counts');
  assert.equal(combineWithinGroup('max', [10, 40, 20], 100), 40);
  assert.equal(combineWithinGroup('capped-sum', [40, 40], 60), 60);
  // Correlated signals: four maximal randomness measures are worth one capped contribution.
  assert.ok(halving([30, 30, 30, 30], 40) <= 40);
});

test('ramps are integer, clamped and non-decreasing', () => {
  let previous = -1;
  for (let x = 0; x <= 120; x++) {
    const y = ramp(x, 20, 100, 60);
    assert.ok(Number.isInteger(y) && y >= previous && y >= 0 && y <= 60);
    previous = y;
  }
  assert.equal(ramp(20, 20, 100, 60), 0);
  assert.equal(ramp(100, 20, 100, 60), 60);
  assert.equal(ramp(5, 5, 5, 60), 0);
  assert.equal(ramp(6, 5, 5, 60), 60);
});

test('every signal is an integer measure over evidence-features/v1', () => {
  for (const [id, signal] of Object.entries(SIGNALS)) {
    for (const name of signal.features) assert.ok(FEATURE_NAMES.includes(name), `${id} reads ${name}`);
    for (const value of ['', 'ab', 'aaaaaaaaaaaaaaaa', 'abcabcabcabcabcabc', RANDOMISH]) {
      const measure = signal.measure(row(value));
      assert.ok(Number.isInteger(measure) && measure >= 0, `${id} on ${JSON.stringify(value)}`);
    }
  }
});

const selectedLike = () => fitConfig(all.find(s => s.id === 'halving-r1-l0-r60-l0-c40'), development);

test('the aggregation is monotone (contract §4)', () => {
  const config = selectedLike();
  const values = ['aaaaaaaaaaaaaaaa', 'abcabcabcabcabcabc', 'XXXX-XXXX-XXXX-XXXX', 'abcdefghijklmnop', RANDOMISH];
  for (const value of values) {
    const base = evaluate(config, row(value));
    // Adding credential-bearing context (a positive group) never lowers the score.
    for (const context of ['credential-name', 'authorization-header', 'url-userinfo']) {
      assert.ok(evaluate(config, row(value, { contextClass: context })).score >= base.score);
    }
    // Whole-value negative evidence never raises it.
    for (const negativeClass of ['template-reference', 'mask', 'placeholder-vocabulary', 'environment-reference']) {
      assert.ok(evaluate(config, row(value, { negativeClass })).score <= base.score);
    }
  }
  // Raising the Shannon measure, all else fixed, never lowers the score.
  const features = extractEvidenceFeatures(RANDOMISH);
  const at = FEATURE_NAMES.indexOf('shannon_entropy_q16');
  let previous = -1;
  for (let h = 0; h <= 400000; h += 5000) {
    const v = [...features]; v[at] = h;
    const score = evaluate(config, row(RANDOMISH, { features: v })).score;
    assert.ok(score >= previous); previous = score;
  }
  // The band is a non-decreasing step function of the score.
  let rank = 0;
  for (let s = 0; s <= config.maxScore + 5; s++) {
    const r = BANDS.indexOf(bandOf(s, config.thresholds));
    assert.ok(r >= rank); rank = r;
  }
});

test('the selectable configurations meet the contract cap inequalities; the forbidden ones are flagged', () => {
  const config = selectedLike();
  const { caps } = config.spec, t = config.thresholds;
  assert.deepEqual(config.conformanceProblems, []);
  assert.ok(t.low >= 1 && t.low < t.medium && t.medium < t.high);
  for (const g of ['randomness', 'lexical', 'contextual', 'validation']) assert.ok(caps[g] < t.high, `cap_${g} < t_high`);
  assert.ok(caps.randomness + caps.lexical < t.high, 'randomness and lexical together never reach high');
  // Statistical evidence alone never reaches high, however random the value.
  assert.notEqual(bandOf(evaluate(config, row(RANDOMISH)).score, t), 'high');
  const flat = result.configurations.find(c => c.id === 'flat-linear');
  assert.equal(flat.adrConformant, false);
  assert.match(flat.conformanceProblems.join(' '), /linearly/);
  assert.equal(result.configurations.find(c => c.id === 'grouped-halving-no-context').thresholds.high > 60, true);
  assert.ok(conformance({ ...config.spec, withinGroup: 'max' }, t, config.maxScore).some(p => /halving/.test(p)));
});

test('tuning reads development rows only: evaluation rows cannot move a fitted value', () => {
  const spec = all.find(s => s.id === 'halving-r1-l0-r60-l0-c40');
  const base = runConfig(spec, development, evaluation);
  const scrambled = evaluation.map(r => ({ ...r, role: r.role === 'none' ? 'secret' : 'none', kind: r.kind === 'must-not-flag' ? 'must-redact' : 'must-not-flag', features: r.features.map(() => 0) }));
  const other = runConfig(spec, development, scrambled);
  assert.deepEqual(other.fitted.thresholds, base.fitted.thresholds);
  assert.deepEqual(other.fitted.ramps, base.fitted.ramps);
  assert.notDeepEqual(other.evaluation.medium, base.evaluation.medium);
  assert.equal(result.rows.development, development.length);
  assert.equal(result.holdoutAccess, 'none');
  assert.doesNotThrow(() => assertNoHoldout(result, holdout));
});

test('the experiment result is deterministic and selects a conformant grid configuration', () => {
  const again = runExperiments(dataset, { specs: SUBSET, sensitivity: false });
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(result)));
  const chosen = result.configurations.find(c => c.id === result.selection.selectedId);
  assert.ok(chosen.adrConformant && chosen.id.startsWith('halving-'));
  assert.ok(result.selection.admissible.includes(chosen.id));
  assert.ok(result.selection.loco.folds > 10);
  for (const band of ['low', 'medium', 'high']) {
    const m = chosen.development[band];
    for (const v of [m.leakedSpanRate, m.falseAlarmRate, m.measurableShare, m.twins.rate]) assert.ok(v >= 0 && v <= 1);
  }
  assert.equal(result.selection.strata.development.family['generic-token'].rows, development.filter(r => r.family === 'generic-token').length);
  assert.match(result.selection.calibration.note, /never a probability/);
});

test('cap neighbours are one grid step away with the same signals', () => {
  const pool = result.configurations.filter(c => c.id.startsWith('halving-')).map(c => ({ id: c.id, fitted: { spec: c.spec } }));
  const target = pool.find(c => c.id === 'halving-r1-l0-r60-l0-c40');
  const ids = capNeighbours(target, pool).map(c => c.id).sort();
  assert.deepEqual(ids, ['halving-r1-l0-r50-l0-c40', 'halving-r1-l0-r60-l0-c30', 'halving-r1-l0-r60-l0-c50']);
  assert.deepEqual(CAP_GRID.randomness, [30, 40, 50, 60]);
});

test('generated-share weights balance generated and authored rows', () => {
  const w = generatedShareWeights(development);
  const total = development.reduce((s, r) => s + w(r), 0);
  const generated = development.filter(r => r.origin === 'generated').reduce((s, r) => s + w(r), 0);
  assert.ok(Math.abs(generated / total - 0.5) < 1e-9);
});

test('isotonic calibration is monotone and lies in [0, 1]', () => {
  const f = isotonicFit([1, 2, 3, 4, 5, 6], [0, 1, 0, 1, 1, 1]);
  let previous = -1;
  for (let s = 0; s <= 7; s++) { const p = f(s); assert.ok(p >= previous && p >= 0 && p <= 1); previous = p; }
});

const identity = c => scoringIdentity(c);
const repo = loadRepositoryState(root);
const placeholder = { sourceRevision: '1'.repeat(40), sourceHash: '2'.repeat(64), lockHash: '3'.repeat(64), candidateArtifactHash: '4'.repeat(64) };
const draft = buildManifestDraft(result, dataset, { createdAt: '2026-09-25', selectionSourceHash: '5'.repeat(64), corpusHashes: repo.corpusHashes, product: placeholder }, identity);

test('the tuning manifest draft passes #256 with its reviewed generated-share override, and only with it', () => {
  const { draftNotes, ...manifest } = draft;
  assert.ok(draftNotes.tuningGeneratedShare > 0.5, 'the corpus really is mostly generated');
  assert.deepEqual(validateTuningManifest(manifest, repo), []);
  assert.deepEqual(manifest.generatedShare, { cap: 0.5, override: GENERATED_SHARE_OVERRIDE });
  const withoutOverride = validateTuningManifest({ ...manifest, generatedShare: { cap: 0.5 } }, repo);
  assert.ok(withoutOverride.some(p => /generatedShare/.test(p)));
  // The manifest carries hashes and counts only: no configuration id (which encodes caps), no threshold, no weight.
  const text = JSON.stringify(manifest);
  assert.ok(!/halving-r\d|"thresholds"|"ramps"|"caps"/.test(text));
  assert.equal(manifest.holdoutAccess, 'none');
  assert.ok(manifest.corpora.tuning.every(s => repo.developmentCategories.includes(s.category)));
  assert.ok(manifest.corpora.evaluation.every(s => s.role === 'regression' && repo.regressionCategories.includes(s.source)));
});

test('the public projection carries aggregate outcomes and identities only', () => {
  const projection = buildProjection(result, draft.scoring.identity, '5'.repeat(64), { tuningShare: 0.78, overrideApplied: true }, MIN_STRATUM_ROWS);
  assert.deepEqual(projectionProblems(projection), []);
  const text = JSON.stringify(projection);
  assert.ok(!text.includes(result.selection.selectedId));
  const chosen = result.configurations.find(c => c.id === result.selection.selectedId);
  assert.ok(!/"(low|medium|high)":\s*\d+[,}]/.test(JSON.stringify(projection.partitions)), 'no band threshold value');
  assert.ok(!text.includes(`"points":${chosen.ramps[0]?.points}`));
  const bad = [
    { ...projection, thresholds: chosen.thresholds },
    { ...projection, partitions: { ...projection.partitions, development: { ...projection.partitions.development, weights: [1] } } },
    { ...projection, notice: result.selection.selectedId },
    { ...projection, strata: { ...projection.strata, development: { ...projection.strata.development, family: { tiny: { ...projection.partitions.development.operatingPoints.medium, rows: 2 } } } } },
    { ...projection, rowScores: [1, 2, 3] },
    { ...projection, holdoutAccess: 'epoch-1' },
  ];
  for (const candidate of bad) assert.ok(projectionProblems(candidate).length > 0, JSON.stringify(Object.keys(candidate)));
});

test('the public-surface check refuses calibration results and malformed projections', () => {
  assert.deepEqual(exclusionProblems(root), []);
  const temp = mkdtempSync(path.join(tmpdir(), 'calibration-exclusion-'));
  try {
    mkdirSync(path.join(temp, 'public/results'), { recursive: true });
    const projection = buildProjection(result, draft.scoring.identity, '5'.repeat(64), { tuningShare: 0.78, overrideApplied: true }, MIN_STRATUM_ROWS);
    writeFileSync(path.join(temp, 'public/results/aggregate.json'), JSON.stringify(projection));
    assert.deepEqual(exclusionProblems(temp, { checkIgnore: false }), []);
    writeFileSync(path.join(temp, 'public/results/calibration-experiments-v1.json'), '{}');
    writeFileSync(path.join(temp, 'public/results/renamed.json'), JSON.stringify({ datasetType: 'calibration-experiments' }));
    writeFileSync(path.join(temp, 'public/results/draft.json'), JSON.stringify({ draftNotes: {} }));
    writeFileSync(path.join(temp, 'public/results/leaky.json'), JSON.stringify({ ...projection, thresholds: { low: 1, medium: 2, high: 3 } }));
    const problems = exclusionProblems(temp, { checkIgnore: false });
    assert.equal(problems.length, 4, problems.join('\n'));
    assert.ok(problems.some(p => /leaky\.json: .*thresholds/.test(p)));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
