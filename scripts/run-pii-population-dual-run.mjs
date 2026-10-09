#!/usr/bin/env node
// Dual run of the four frozen benchmark PII populations (#664): the pinned TypeScript oracle against the extracted
// pii-eval engine, over identical inputs, with every difference classified. No scanner is run: the frozen Beta.13
// observation is replayed. Nothing here sets a threshold, tolerance, support status or authority.
//
//   node --import tsx scripts/run-pii-population-dual-run.mjs --pii-eval=<git checkout of pii-eval> [--work=<dir>] [--write | --check]
//
// What runs, per population (oracle-plan, qualification-plan, diagnostic-balanced, benign-heavy-stress):
//   1. scripts/lib/pii-population-conversion.mjs writes the snapshot, manifest, observation set, projection roster and the
//      oracle's input from the pinned plans and the pinned frozen observation.
//   2. The oracle files at the pinned benchmark commit run unmodified (pii-eval's own module hooks stub only ajv and the
//      evidence loader) and export their variants, outcomes and ten metrics.
//   3. `pii-eval replay` derives the schema 1.4 public artifact from the same observation, three times.
//   4. pii-eval's own parity comparator (unmodified, scripts/pii-eval-population-parity/population_parity.rs) classifies
//      every oracle-versus-engine difference; the engine side of that comparator is compared with the CLI artifact too.
//   5. The same comparison runs for every (family), (family, language) and (family, control class) cell of the artifact's
//      product projection, so each projected number has an oracle counterpart.
// `--write` records scripts' results under benchmarks/pii-eval-population-dual-run/ with the human report in results-output/; `--check`
// regenerates everything and fails on any byte of difference in the recorded, platform-independent part.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeConversion } from './convert-pii-populations.mjs';
import { ROOT, SCANNER_ID, VIEWS, readMigration, semanticDigest } from './lib/pii-population-conversion.mjs';
import { generatedStage } from './lib/generated-output.mjs';
import { renderReport } from './lib/pii-population-report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(ROOT, 'benchmarks/pii-eval-population-dual-run');
export const REPORT_JSON = join(OUT_DIR, 'report.json');
export const REPORT_MD = join(ROOT, 'results-output/pii-population-dual-run/summary.md');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sh = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...options });
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
const stableSort = (list, key) => [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));

// ---------------------------------------------------------------------------------------------------------------
// Sources: the pinned pii-eval commit, the pinned oracle files and the engine binary
// ---------------------------------------------------------------------------------------------------------------
function prepareSources({ piiEval, work, migration }) {
  const pin = migration.pins.piiEvalProjection;
  sh('git', ['-C', piiEval, 'cat-file', '-e', `${pin}^{commit}`]);
  const src = join(work, 'pii-eval-src');
  rmSync(src, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  const archive = execFileSync('git', ['-C', piiEval, 'archive', pin], { maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', src], { input: archive });
  const lock = sha256(readFileSync(join(src, 'Cargo.lock')));
  if (lock !== migration.pins.piiEvalProjectionCargoLockSha256) throw new Error(`Cargo.lock digest ${lock} is not the pinned one`);
  cpSync(join(HERE, 'pii-eval-population-parity/population_parity.rs'), join(src, 'crates/pii-eval-cli/tests/population_parity.rs'));
  const target = join(work, 'target');
  const env = { ...process.env, CARGO_TARGET_DIR: target };
  sh('cargo', ['build', '--release', '--locked', '-p', 'pii-eval-cli'], { cwd: src, env, stdio: ['ignore', 'ignore', 'inherit'] });
  const binary = join(target, 'release/pii-eval');
  const built = sh('cargo', ['test', '-p', 'pii-eval-cli', '--locked', '--test', 'population_parity', '--no-run', '--message-format=json'], { cwd: src, env });
  const harness = built.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(m => m.reason === 'compiler-artifact' && m.target?.name === 'population_parity' && m.executable)?.executable;
  if (!harness) throw new Error('the parity comparator did not build');
  // The oracle: the pinned files of this repository, byte for byte.
  const spec = readJson(join(src, 'tools/oracle-parity/oracle-files.json'));
  if (spec.pin !== migration.pins.oracle || spec.treeDigest !== migration.pins.oracleFilesTreeSha256) throw new Error('the oracle file list is not the pinned one');
  const oracle = join(work, 'oracle');
  rmSync(oracle, { recursive: true, force: true });
  for (const file of spec.files) {
    const out = join(oracle, file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, execFileSync('git', ['-C', ROOT, 'show', `${spec.pin}:${file}`], { maxBuffer: 1 << 28 }));
  }
  return { src, binary, harness, oracle, spec, lock, nodeTools: join(src, 'tools/oracle-parity') };
}

function exportOracle(tools, oracle, dir) {
  sh('node', ['--experimental-strip-types', '--no-warnings', '--import', './register.mjs', 'export-oracle.mjs', oracle, join(dir, 'parity-input.json'), join(dir, 'oracle-export.json')], { cwd: tools, stdio: ['ignore', 'pipe', 'inherit'] });
}
function runHarness(harness, dir) {
  const out = join(dir, 'summary.json');
  const result = spawnSync(harness, ['--nocapture'], { env: { ...process.env, PII_POPULATION_DIR: dir, PII_POPULATION_OUT: out }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`the parity comparator failed in ${dir}: ${result.stdout}${result.stderr}`.slice(0, 2000));
  return readJson(out);
}

// ---------------------------------------------------------------------------------------------------------------
// Representations of one metric, so the oracle, the comparator and the engine artifact are compared on integers/strings
// ---------------------------------------------------------------------------------------------------------------
const scaled6 = d => {
  const big = BigInt(d.mantissa) * 10n ** BigInt(6 - d.scale);
  return `${big / 1000000n}.${String(big % 1000000n).padStart(6, '0')}`;
};
const fromArtifact = m => ({
  status: m.status, counts: m.counts, effectiveN: m.effectiveN,
  rate: m.value.state === 'measured' ? { kind: 'value', point: scaled6(m.value.point), bound: scaled6(m.value.bound) }
    : { kind: m.value.reason === 'zero-denominator' ? 'null' : m.value.reason },
});
const fromOracle = m => ({
  status: m.status, counts: m.counts, effectiveN: m.effectiveN,
  rate: m.rate.kind === 'value' ? { kind: 'value', point: m.rate.point, bound: m.rate.bound } : { kind: m.rate.kind },
});
const fromHarness = m => ({
  status: m.status, effectiveN: m.effectiveN,
  counts: { eligible: m.counts.eligible, measured: m.counts.measured, notApplicable: m.counts.notApplicable, notMeasured: m.counts.notMeasured, numerator: m.counts.numerator, total: m.counts.total, unresolved: m.counts.unresolved },
  rate: m.rate.kind === 'value' ? { kind: 'value', point: scaled6({ mantissa: m.rate.point, scale: 6 }), bound: scaled6({ mantissa: m.rate.bound, scale: 6 }) } : { kind: m.rate.kind === 'insufficient-evidence' ? 'insufficient-evidence' : 'null' },
});
const stable = value => (Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value !== null && typeof value === 'object'
  ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}` : JSON.stringify(value ?? null));
const same = (a, b) => stable(a) === stable(b);
const metricMap = list => Object.fromEntries(list.map(m => [m.metric.id, fromArtifact(m)]));

/**
 * Compare the oracle's (located-case) metric map with the artifact's. The oracle contract is closed over located valid/invalid
 * cases; the artifact also carries `rangeless` authored not-established memberships (schema 1.4, pii-eval ADR 0017/0018) that
 * the engine accounts for as `unresolved`. That is the only permitted difference and it is stated exactly: every located
 * quantity (eligible, measured, numerator, effective N, rate, status) of a judged metric is equal; `total` and `notApplicable`
 * grow by `rangeless`; `measurable-share` counts each range-less membership once per axis as `unresolved`, so its denominator
 * grows by 2 x rangeless and its rate is recomputed by the engine (verified by `pii-eval validate`). With `rangeless = 0`
 * this is plain equality. Every key must exist on both sides.
 */
function diffMetrics(left, right, label, sink, layer, rangeless = 0) {
  const ids = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const id of ids) {
    const l = left[id] ?? null, r = right[id] ?? null;
    if (!l || !r || rangeless === 0) {
      if (!same(l, r)) sink.push({ layer, subject: label, aspect: id, left: l, right: r });
      continue;
    }
    const share = id === 'measurable-share';
    const lc = l.counts;
    // `context-discrimination-rate` counts twin pairs of the twin method, which no schema-only membership joins: unchanged.
    const expected = id === 'context-discrimination-rate' ? lc : share
      ? { ...lc, eligible: lc.eligible + 2 * rangeless, total: lc.total + 2 * rangeless, unresolved: lc.unresolved + 2 * rangeless }
      : { ...lc, total: lc.total + rangeless, notApplicable: lc.notApplicable + rangeless };
    const locatedEqual = share || same({ status: l.status, effectiveN: l.effectiveN, rate: l.rate }, { status: r.status, effectiveN: r.effectiveN, rate: r.rate });
    const shareLocated = !share || (r.counts.measured === lc.measured && r.counts.numerator === lc.numerator);
    if (!same(expected, r.counts) || !locatedEqual || !shareLocated) sink.push({ layer, subject: label, aspect: id, left: { ...l, counts: expected }, right: r });
  }
  return ids.length;
}

/** The oracle side of a cell that has no located case: no located quantity at all. */
const emptyOracle = ids => Object.fromEntries(ids.map(id => [id, {
  status: 'not-applicable', counts: { eligible: 0, measured: 0, notApplicable: 0, notMeasured: 0, numerator: 0, total: 0, unresolved: 0 }, effectiveN: 0, rate: { kind: 'null' },
}]));

// ---------------------------------------------------------------------------------------------------------------
// One population
// ---------------------------------------------------------------------------------------------------------------
function replay(binary, dir, out, extra = []) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(dirname(out), { recursive: true });
  const args = ['replay', '--snapshot', join(dir, 'snapshot.json'), '--manifest', join(dir, 'manifest.json'), '--observation', join(dir, 'observation.json'),
    '--out', out, '--projection-roster', join(dir, 'projection-roster.json'), '--projection-mode', 'exploratory', ...extra];
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  return { exit: result.status, summary: result.stdout ? JSON.parse(result.stdout.split('\n')[0]) : null, stderr: result.stderr };
}

function subsetInput(input, ids, suffix) {
  const keep = new Set(ids);
  return {
    ...input, population: { ...input.population, id: `${input.population.id}-${suffix}`.slice(0, 80) },
    cases: input.cases.filter(c => keep.has(c.id)),
    scanners: input.scanners.map(s => ({ ...s, recipe: { ...s.recipe, cases: Object.fromEntries(Object.entries(s.recipe.cases).filter(([id]) => keep.has(id))) } })),
  };
}

function oracleSide(exported) {
  const scanner = exported.scanners[0];
  return { status: scanner.status, metrics: Object.fromEntries(Object.entries(scanner.accounting.metrics).map(([id, m]) => [id, fromOracle(m)])), outcomes: scanner.outcomes };
}

function classifyHarness(summary) {
  return summary.differences.map(d => ({ layer: d.layer, aspect: d.aspect, ids: d.ids, class: d.class, count: d.count }));
}

function runPopulation(ctx, bucket, index) {
  const { work, tools, oracle, harness, binary } = ctx;
  const dir = join(work, 'conv', bucket.view);
  const input = readJson(join(dir, 'parity-input.json'));
  const snapshot = readJson(join(dir, 'snapshot.json'));
  const manifest = readJson(join(dir, 'manifest.json'));
  const roster = readJson(join(dir, 'projection-roster.json'));
  exportOracle(tools, oracle, dir);
  const exported = readJson(join(dir, 'oracle-export.json'));
  const comparator = runHarness(harness, dir);

  // Three replays of the same observation: equal bytes, equal semantic digests.
  const runs = [1, 2, 3].map(n => replay(binary, dir, join(work, 'out', bucket.view, `run${n}`)));
  for (const r of runs) if (r.exit !== 0 || r.summary?.state !== 'replayed') throw new Error(`replay failed for ${bucket.view}: ${r.stderr}`);
  const files = name => runs.map((_, i) => readFileSync(join(work, 'out', bucket.view, `run${i + 1}`, name)));
  const fileNames = ['manifest.json', `observation-${SCANNER_ID}.json`, 'public-synthetic-artifact.json', 'run-artifact.json'];
  const byteIdentical = fileNames.every(name => new Set(files(name).map(sha256)).size === 1);
  const publicPath = join(work, 'out', bucket.view, 'run1', 'public-synthetic-artifact.json');
  const artifact = readJson(publicPath);
  const digests = runs.map(r => r.summary.semantic.publicArtifactDigest);
  const validated = JSON.parse(sh(binary, ['validate', publicPath, '--snapshot', join(dir, 'snapshot.json'), '--projection-roster', join(dir, 'projection-roster.json')]));

  const differences = [];
  const compared = {};
  const bump = (layer, n) => { compared[layer] = (compared[layer] ?? 0) + n; };
  const ours = oracleSide(exported);
  const semantic = artifact.semantic;

  // Layer: case and variant identities and counts.
  // The population is every authored membership (schema 1.4); the oracle's input is its located part. A range-less case is an
  // authored `not-established` identity with no candidate range (pii-eval ADR 0017/0018): the oracle cannot state it, so it is
  // checked here against what the authors wrote and what the engine must report (`unresolved` on every axis), never dropped.
  const allSnapCases = snapshot.semantic.cases;
  const isRangeless = c => c.variants.every(v => v.expectations.every(e => e.range === undefined));
  const snapCases = allSnapCases.filter(c => !isRangeless(c));
  const rangelessCases = allSnapCases.filter(isRangeless);
  const exportedCases = exported.cases;
  if (snapCases.length !== exportedCases.length || snapCases.length !== input.cases.length) differences.push({ layer: 'identity', subject: bucket.view, aspect: 'case-count', left: exportedCases.length, right: snapCases.length });
  if (allSnapCases.length !== semantic.populationCounts.authoredCases || allSnapCases.length !== bucket.cases.length) differences.push({ layer: 'identity', subject: bucket.view, aspect: 'membership-count', left: bucket.cases.length, right: semantic.populationCounts.authoredCases });
  const variantsOracle = exportedCases.reduce((n, c) => n + c.variants.length, 0);
  const variantsSnapshot = allSnapCases.reduce((n, c) => n + c.variants.length, 0);
  if (variantsOracle !== snapCases.reduce((n, c) => n + c.variants.length, 0) || variantsSnapshot !== semantic.populationCounts.variants) differences.push({ layer: 'identity', subject: bucket.view, aspect: 'variant-count', left: variantsOracle, right: variantsSnapshot });
  bump('case-identity', snapCases.length);
  bump('variant-identity', variantsSnapshot - rangelessCases.reduce((n, c) => n + c.variants.length, 0));
  // Range-less memberships: authored not-established on both axes, no range, schema-only, neutral context, and reported unresolved.
  const rangelessIds = new Set(rangelessCases.map(c => c.caseId));
  const rangelessOutcomes = new Map(semantic.outcomes.filter(o => rangelessIds.has(o.caseId)).map(o => [o.caseId, o]));
  for (const c of rangelessCases) {
    const e = c.variants[0].expectations[0], o = rangelessOutcomes.get(c.caseId);
    const ok = c.variants.length === 1 && c.variants[0].expectations.length === 1 && e.typeExpectation === 'not-established' && e.sensitivity === 'not-established' && c.method === 'schema-only' &&
      e.contextClass === 'neutral' && o && o.typeIdentity === 'unresolved' && o.sensitivityContext === 'unresolved' && o.range === 'unresolved' && o.action.state === 'not-measured';
    if (!ok) differences.push({ layer: 'identity', subject: c.caseId, aspect: 'range-less-membership', left: 'authored not-established', right: o ?? null });
  }
  bump('range-less-membership', rangelessCases.length);
  const bySlug = new Map(snapCases.map(c => [c.caseId, c]));
  for (const c of exportedCases) {
    const s = bySlug.get(c.id);
    const variant = s?.variants[0];
    const exp = variant?.expectations[0];
    const authored = input.cases.find(x => x.id === c.id);
    const text = `${authored.prefix}${authored.value}${authored.suffix}`;
    const ok = s && exp && c.family === exp.family && c.language === s.language && c.method === s.method && c.variants.length === 1 && c.variants[0].slot === 'authored' &&
      c.variants[0].text === variant.text && variant.text === text && sha256(text) === variant.textDigest &&
      c.variants[0].candidate.start === exp.range.start && c.variants[0].candidate.end === exp.range.end &&
      c.variants[0].expectation.type === exp.typeExpectation && c.variants[0].expectation.sensitivity === exp.sensitivity;
    if (!ok) differences.push({ layer: 'identity', subject: c.id, aspect: 'case-content', left: 'oracle', right: 'snapshot' });
  }
  // The comparator generated the engine corpus from the oracle's input; it must be the corpus we replay (lineage, population and
  // the authored action expectation are metadata the oracle input cannot carry).
  const engineBody = comparator.engineSnapshot.body;
  const strip = c => ({ caseId: c.caseId, method: c.method, language: c.language, jurisdiction: c.jurisdiction ?? null, variants: c.variants.map(v => ({
    text: v.text, textDigest: v.textDigest, strategy: v.derivation.strategy, expectations: v.expectations.map(e => ({ family: e.family, range: e.range, type: e.typeExpectation, sensitivity: e.sensitivity, contextClass: e.contextClass, obligation: e.contextObligation })) })) });
  if (!same(engineBody.cases.map(strip), snapCases.map(strip))) differences.push({ layer: 'identity', subject: bucket.view, aspect: 'engine-generated-corpus', left: 'comparator', right: 'snapshot' });
  bump('corpus-equivalence', snapCases.length);

  // Layer: both outcome axes, range and review-required/not-measured states, per variant.
  const outcomeByCase = new Map(semantic.outcomes.map(o => [o.caseId, o]));
  for (const o of ours.outcomes) {
    const got = outcomeByCase.get(o.case);
    const a = got ? { type: got.typeIdentity, sensitivity: got.sensitivityContext, range: got.range } : null;
    const b = { type: o.type.state, sensitivity: o.sensitivity.state, range: o.range };
    if (!same(a, b)) differences.push({ layer: 'outcome', subject: o.case, aspect: 'axes', left: b, right: a });
  }
  bump('outcome', ours.outcomes.length);
  const states = (list, pick) => Object.fromEntries(Object.entries(list.reduce((m, o) => ({ ...m, [pick(o)]: (m[pick(o)] ?? 0) + 1 }), {})).sort());
  const censusOf = list => ({ typeIdentity: states(list, o => o.typeIdentity), sensitivityContext: states(list, o => o.sensitivityContext), range: states(list, o => o.range) });
  const stateCensus = censusOf(semantic.outcomes);
  const locatedCensus = censusOf(semantic.outcomes.filter(o => !rangelessIds.has(o.caseId)));
  const oracleCensus = { typeIdentity: states(ours.outcomes, o => o.type.state), sensitivityContext: states(ours.outcomes, o => o.sensitivity.state), range: states(ours.outcomes, o => o.range) };
  if (!same(locatedCensus, oracleCensus)) differences.push({ layer: 'outcome', subject: bucket.view, aspect: 'state-census', left: oracleCensus, right: locatedCensus });
  if (semantic.outcomes.length !== allSnapCases.length) differences.push({ layer: 'outcome', subject: bucket.view, aspect: 'outcome-count', left: allSnapCases.length, right: semantic.outcomes.length });

  // Layer: ten metrics (numerator, denominator, intervals, withheld states), population level.
  const artifactMetrics = metricMap(semantic.scannerMetrics[0].metrics);
  const R = rangelessCases.length;
  bump('metric', diffMetrics(ours.metrics, artifactMetrics, bucket.view, differences, 'metric', R));
  // The comparison is not vacuous: corrupted copies of the same data are found.
  const probe = [];
  const bent = structuredClone(artifactMetrics);
  bent['type-miss-rate'].counts.numerator += 1;
  diffMetrics(ours.metrics, bent, bucket.view, probe, 'probe', R);
  const bentRate = structuredClone(artifactMetrics);
  bentRate['sensitive-miss-rate'].rate = { kind: 'value', point: '0.000001', bound: '0.000002' };
  diffMetrics(ours.metrics, bentRate, bucket.view, probe, 'probe', R);
  const bentOutcome = { ...ours.outcomes[0], range: ours.outcomes[0].range === 'exact' ? 'miss' : 'exact' };
  const injectedFound = probe.length === 2 && !same({ type: bentOutcome.type.state, sensitivity: bentOutcome.sensitivity.state, range: bentOutcome.range },
    { type: outcomeByCase.get(bentOutcome.case).typeIdentity, sensitivity: outcomeByCase.get(bentOutcome.case).sensitivityContext, range: outcomeByCase.get(bentOutcome.case).range });
  const canonical = Object.fromEntries(Object.entries(comparator.canonicalMetrics[SCANNER_ID]).map(([id, m]) => [id, fromHarness(m)]));
  const enginePath = [];
  diffMetrics(canonical, artifactMetrics, bucket.view, enginePath, 'engine-path', R);
  if (semantic.scanners[0].status !== 'complete' || exported.scanners[0].status !== 'complete') differences.push({ layer: 'scanner-status', subject: bucket.view, aspect: 'status', left: exported.scanners[0].status, right: semantic.scanners[0].status });

  // Layer: the projection, cell by cell, stratum by stratum, each against its own oracle run.
  const cells = [];
  const cellDifferences = [];
  const classified = [];
  const projection = semantic.productProjection;
  const authoredById = new Map(allSnapCases.map(c => [c.caseId, c]));
  const roleClass = new Map();
  for (const entry of roster.controlClasses ?? []) for (const id of entry.cases) roleClass.set(id, entry.class);
  let cellIndex = 0;
  const subset = (ids, label) => {
    // Only located cases reach the oracle. A cell whose every membership is range-less has no located quantity: it is held to
    // zero located counts (`emptyOracle`) instead of an oracle run the contract cannot make.
    ids = ids.filter(id => !rangelessIds.has(id));
    if (ids.length === 0) {
      const none = emptyOracle(Object.keys(artifactMetrics));
      return { oracleMetrics: none, canonical: none, unexplained: 0, compat: 0, label };
    }
    cellIndex += 1;
    const sub = join(work, 'sub', bucket.view, String(cellIndex));
    mkdirSync(sub, { recursive: true });
    writeJson(join(sub, 'parity-input.json'), subsetInput(input, ids, `cell-${cellIndex}`));
    exportOracle(tools, oracle, sub);
    const summary = runHarness(harness, sub);
    const oracleMetrics = oracleSide(readJson(join(sub, 'oracle-export.json'))).metrics;
    classified.push(...classifyHarness(summary));
    return { oracleMetrics, canonical: Object.fromEntries(Object.entries(summary.canonicalMetrics[SCANNER_ID]).map(([id, m]) => [id, fromHarness(m)])), unexplained: summary.unexplained, compat: summary.compatibilityDifferences, label };
  };
  for (const row of projection.rows) {
    const ids = allSnapCases.filter(c => c.variants[0].expectations[0].family === row.family).map(c => c.caseId);
    if (ids.length !== row.counts.authoredCases) cellDifferences.push({ layer: 'projection', subject: `${row.family}`, aspect: 'case-count', left: ids.length, right: row.counts.authoredCases });
    const targets = [{ kind: 'cell', key: row.family, ids, metrics: metricMap(row.metrics), counts: row.counts }];
    for (const stratum of row.byLanguage ?? []) targets.push({ kind: 'language', key: `${row.family}/${stratum.language}`, ids: ids.filter(id => authoredById.get(id).language === stratum.language), metrics: metricMap(stratum.metrics), counts: stratum.counts });
    for (const stratum of row.byControlClass ?? []) targets.push({ kind: 'control-class', key: `${row.family}/${stratum.controlClass}`, ids: ids.filter(id => roleClass.get(id) === stratum.controlClass), metrics: metricMap(stratum.metrics), counts: stratum.counts });
    for (const target of targets) {
      if (target.ids.length !== target.counts.authoredCases) cellDifferences.push({ layer: 'projection', subject: target.key, aspect: 'case-count', left: target.ids.length, right: target.counts.authoredCases });
      const result = subset(target.ids, target.key);
      const before = cellDifferences.length;
      const cellRangeless = target.ids.filter(id => rangelessIds.has(id)).length;
      diffMetrics(result.oracleMetrics, target.metrics, target.key, cellDifferences, 'projection', cellRangeless);
      diffMetrics(result.canonical, target.metrics, target.key, cellDifferences, 'projection-engine-path', cellRangeless);
      if (result.unexplained !== 0 || result.compat !== 0) cellDifferences.push({ layer: 'projection', subject: target.key, aspect: 'comparator', left: 0, right: result.unexplained + result.compat });
      cells.push({ kind: target.kind, key: target.key, cases: target.ids.length, metricsEqual: cellDifferences.length === before });
    }
  }
  const everyBinding = projection.rows.every(r => r.mode === 'exploratory' && r.binding.scannerId === SCANNER_ID && r.binding.product.kind === 'candidate' && r.binding.population.populationDigest === snapshot.semanticDigest &&
    r.binding.activationDigest === manifest.semantic.scanners[0].identity.activationDigest && r.binding.configurationDigest === manifest.semantic.scanners[0].identity.configurationDigest);
  const projectionSummary = {
    rows: projection.rows.length, mode: 'exploratory', requiredViews: projection.requiredViews, rosterDigest: projection.rosterDigest, bindingsEqualToManifest: everyBinding,
    cellsCompared: cells.filter(c => c.kind === 'cell').length, languageStrataCompared: cells.filter(c => c.kind === 'language').length, controlClassStrataCompared: cells.filter(c => c.kind === 'control-class').length,
    oracleRunsBehindTheProjection: cells.length,
  };
  bump('projection-cell', projectionSummary.cellsCompared);
  bump('projection-language-stratum', projectionSummary.languageStrataCompared);
  bump('projection-control-class-stratum', projectionSummary.controlClassStrataCompared);

  const harnessClassified = classifyHarness(comparator);
  const classes = {};
  for (const d of [...harnessClassified, ...classified]) {
    const key = `${d.layer}|${d.aspect}|${d.ids.join('+')}`;
    classes[key] = { layer: d.layer, aspect: d.aspect, ids: d.ids, class: d.class, count: (classes[key]?.count ?? 0) + d.count };
  }
  const all = [...differences, ...enginePath, ...cellDifferences];
  const unexplained = all.length + comparator.unexplained + comparator.compatibilityDifferences;
  return {
    view: bucket.view,
    identities: {
      populationId: snapshot.semantic.population.populationId, snapshotDigest: snapshot.semanticDigest, manifestDigest: manifest.semanticDigest,
      observationDigest: readJson(join(dir, 'observation.json')).semanticDigest, rosterDigest: projection.rosterDigest,
      inputSha256: sha256(readFileSync(join(dir, 'parity-input.json'))), oracleExportSha256: sha256(readFileSync(join(dir, 'oracle-export.json'))),
    },
    conversion: (({ excluded, ...rest }) => ({ ...rest, excludedIds: excluded.map(e => `${e.family}/${e.caseId}`) }))(readJson(join(dir, 'census.json'))),
    // Authored not-established memberships carried range-less (pii-eval ADR 0017/0018): in the artifact, never in the oracle.
    rangeless: {
      cases: rangelessCases.length, located: snapCases.length,
      byFamily: Object.fromEntries(Object.entries(rangelessCases.reduce((m, c) => ({ ...m, [c.variants[0].expectations[0].family]: (m[c.variants[0].expectations[0].family] ?? 0) + 1 }), {})).sort()),
      reportedAs: { typeIdentity: 'unresolved', sensitivityContext: 'unresolved', range: 'unresolved', action: 'not-measured' },
    },
    artifact: {
      schemaVersion: artifact.schemaVersion, publicArtifactSha256: sha256(readFileSync(publicPath)), semanticDigest: artifact.semanticDigest,
      semanticDigestRecomputed: semanticDigest(artifact) === artifact.semanticDigest, runArtifactDigest: runs[0].summary.semantic.runArtifactDigest,
      validatedAgainstSnapshotAndRoster: validated.state === 'valid' && validated.semantic.productProjection === 'recomputed' && validated.semantic.verification === 'verified',
    },
    comparisonDetectsInjectedDifferences: injectedFound,
    determinism: { replays: runs.length, equalSemanticDigest: new Set(digests).size === 1, byteIdenticalDocuments: byteIdentical, scannersLaunched: runs.map(r => r.summary.semantic.scannersLaunched) },
    census: { outcomeStates: stateCensus, oracleOutcomeStates: oracleCensus, scannerStatus: semantic.scanners[0].status, completeness: semantic.completeness, failures: semantic.failures.length,
      methodCoverage: semantic.methodCoverage },
    compared: Object.fromEntries(Object.entries({ ...compared, ...Object.fromEntries(Object.entries(comparator.compared)) }).sort()),
    comparatorCompared: comparator.compared,
    metrics: Object.fromEntries(Object.entries(artifactMetrics).map(([id, m]) => [id, { status: m.status, numerator: m.counts.numerator, eligible: m.counts.eligible, effectiveN: m.effectiveN, rate: m.rate }])),
    projection: projectionSummary,
    classifiedDifferences: stableSort(Object.values(classes), d => `${d.layer}|${d.aspect}`),
    unexplainedDifferences: all,
    unexplained,
    publicPath,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Wrong bindings are refused by the engine
// ---------------------------------------------------------------------------------------------------------------
function bindingRejections(ctx) {
  const { work, binary } = ctx;
  const dirOf = view => join(work, 'conv', view);
  const a = dirOf('oracle-plan'), b = dirOf('qualification-plan');
  const scratch = join(work, 'negative');
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const results = [];
  const tryReplay = (name, snapshot, manifest, observation, mutate) => {
    const dir = join(scratch, name);
    mkdirSync(dir, { recursive: true });
    for (const [file, doc] of [['snapshot.json', snapshot], ['manifest.json', manifest], ['observation.json', observation]]) writeJson(join(dir, file), doc);
    const out = join(dir, 'out');
    const result = spawnSync(binary, ['replay', '--snapshot', join(dir, 'snapshot.json'), '--manifest', join(dir, 'manifest.json'), '--observation', join(dir, 'observation.json'), '--out', out, '--projection-roster', join(a, 'projection-roster.json'), '--projection-mode', 'exploratory', ...(mutate ?? [])], { encoding: 'utf8' });
    const refusal = /^pii-eval: ([a-z0-9-]+) \(([a-z0-9-]+), exit (\d+)\): ([a-z0-9-]+)/m.exec(result.stderr);
    results.push({ case: name, exit: result.status, outputWritten: existsSync(out), refusal: refusal ? `${refusal[1]}: ${refusal[4]}` : null });
  };
  const snapA = readJson(join(a, 'snapshot.json')), manA = readJson(join(a, 'manifest.json')), obsA = readJson(join(a, 'observation.json'));
  const snapB = readJson(join(b, 'snapshot.json')), obsB = readJson(join(b, 'observation.json'));
  const reseal = (doc, mutate) => { const copy = structuredClone(doc); mutate(copy.semantic); copy.semanticDigest = semanticDigest(copy); return copy; };
  tryReplay('control-same-population', snapA, manA, obsA);
  tryReplay('wrong-population', snapA, manA, obsB);
  tryReplay('wrong-population-snapshot', snapB, manA, obsA);
  tryReplay('wrong-activation', snapA, manA, reseal(obsA, s => { s.scanner.activationDigest = sha256('pii:global'); }));
  tryReplay('wrong-candidate', snapA, manA, reseal(obsA, s => { s.scanner.product.candidateDigest = sha256('another candidate'); s.scanner.artifactDigest = s.scanner.product.candidateDigest; }));
  tryReplay('released-instead-of-candidate', snapA, manA, reseal(obsA, s => { s.scanner.product = { kind: 'released' }; }));
  tryReplay('wrong-configuration', snapA, manA, reseal(obsA, s => { s.scanner.configurationDigest = sha256('another configuration'); }));
  return results;
}

// ---------------------------------------------------------------------------------------------------------------
// Benchmark report agreement on identities and counts
// ---------------------------------------------------------------------------------------------------------------
function benchmarkReportCounts(migration, populations) {
  const report = readJson(join(ROOT, migration.benchmarkPopulations.report.path));
  const rows = [];
  for (const family of report.families) {
    for (const view of family.views.reviewed) {
      const population = populations.find(p => p.view === view.view);
      const converted = population.conversion.byFamily[family.family];
      rows.push({ view: view.view, family: family.family, reportCases: view.cases, convertedPlusExcluded: converted.converted + converted.excluded, equal: view.cases === converted.converted + converted.excluded });
    }
  }
  return rows;
}

export async function main(argv) {
  const arg = name => argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const piiEval = resolve(arg('pii-eval') ?? process.env.PII_EVAL_DIR ?? '');
  if (!piiEval || !existsSync(join(piiEval, '.git'))) throw new Error('--pii-eval=<git checkout of redact-secret/pii-eval> is required');
  const work = resolve(arg('work') ?? generatedStage(ROOT));
  mkdirSync(work, { recursive: true });
  try {
    const migration = readMigration();
    const ctx = { work, ...prepareSources({ piiEval, work, migration }) };
    ctx.tools = ctx.nodeTools;
    const { ctx: conversion, summary } = writeConversion(join(work, 'conv'));

    const populations = conversion.populations.map((bucket, i) => runPopulation(ctx, bucket, i));
    const rejections = bindingRejections(ctx);
    const countAgreement = benchmarkReportCounts(migration, populations.map(p => ({ view: p.view, conversion: p.conversion })));
    const scriptDigest = file => sha256(readFileSync(join(HERE, file)));
    const record = {
      schemaVersion: 1, reportType: 'pii-eval-population-dual-run', supportClaims: false, authorityChanged: false,
      identities: {
        oracle: { repository: 'redact-secret/redact-secret-benchmarks', commit: ctx.spec.pin, filesTreeDigest: ctx.spec.treeDigest, fileCount: ctx.spec.files.length, runsUnmodified: true, stubs: ['ajv (accepts every document)', 'benign-collision-evidence (no entries)'] },
        piiEval: { repository: 'redact-secret/pii-eval', commit: migration.pins.piiEvalProjection, cargoLockSha256: ctx.lock, engineVersion: '0.0.0', artifactSchema: '1.4', protocolRevision: 2, buildFlags: '--release --locked' },
        candidate: migration.benchmarkPopulations.candidate, activationDigest: migration.scanner.activationDigest, configurationDigest: migration.scanner.configurationDigest, mode: 'exploratory',
        tooling: { 'scripts/lib/pii-population-conversion.mjs': scriptDigest('lib/pii-population-conversion.mjs'), 'scripts/pii-eval-population-parity/population_parity.rs': scriptDigest('pii-eval-population-parity/population_parity.rs') },
      },
      populations: populations.map(({ publicPath, ...p }) => p),
      benchmarkReportCounts: countAgreement,
      bindingRejections: rejections,
    };
    record.verdict = {
      populations: record.populations.length,
      unexplainedDifferences: record.populations.reduce((n, p) => n + p.unexplained, 0),
      reportCountDisagreements: countAgreement.filter(r => !r.equal).length,
      bindingsRefused: rejections.filter(r => r.case !== 'control-same-population').every(r => r.exit !== 0 && !r.outputWritten) && rejections.find(r => r.case === 'control-same-population').exit === 0,
      comparisonDetectsInjectedDifferences: record.populations.every(p => p.comparisonDetectsInjectedDifferences),
      deterministic: record.populations.every(p => p.determinism.equalSemanticDigest && p.determinism.byteIdenticalDocuments),
    };
    const environment = { platform: `${process.platform}-${process.arch}`, node: process.version, binarySha256: sha256(readFileSync(ctx.binary)), cargo: sh('cargo', ['--version']).trim() };

    writeJson(join(work, 'record.json'), record);
    const transient = join(ROOT, 'results-output/pii-population-dual-run');
    mkdirSync(transient, { recursive: true });
    for (const p of populations) writeFileSync(join(transient, `${p.view}.public-synthetic-artifact.json`), readFileSync(p.publicPath));
    writeJson(join(transient, 'record.json'), record);
    writeFileSync(join(transient, 'summary.md'), renderReport(record));
    if (argv.includes('--write')) {
      mkdirSync(OUT_DIR, { recursive: true });
      for (const p of populations) writeFileSync(join(OUT_DIR, `${p.view}.public-synthetic-artifact.json`), readFileSync(p.publicPath));
      writeJson(REPORT_JSON, record);
      writeFileSync(REPORT_MD, renderReport(record));
      console.log(`wrote ${REPORT_JSON}`);
    }
    if (argv.includes('--check')) {
      const recorded = readFileSync(REPORT_JSON, 'utf8');
      if (recorded !== `${JSON.stringify(record, null, 1)}\n`) throw new Error('benchmarks/pii-eval-population-dual-run/report.json differs from a fresh run');
      for (const p of populations) if (!readFileSync(p.publicPath).equals(readFileSync(join(OUT_DIR, `${p.view}.public-synthetic-artifact.json`)))) throw new Error(`${p.view} public artifact differs from a fresh run`);
      const retained = JSON.parse(readFileSync(join(ROOT, 'benchmarks/inputs/pii-population-report-receipt.json'), 'utf8'));
      if (sha256(renderReport(record)) !== retained.markdownSha256) throw new Error('the regenerated report differs from the retained accepted report digest');
      console.log('the recorded dual run equals a fresh run');
    }
    console.log(JSON.stringify({ verdict: record.verdict, environment }, null, 1));
    return record;
  } finally { if (!arg('work')) rmSync(work, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack ?? error); process.exit(1); });
}
