#!/usr/bin/env node
// A fresh official execution of the four PII populations (#796), public synthetic only: `pii-eval run --config` with `mode: official` against the pinned
// scanner package, one run per population, then validation under the real official-mode contract. It is the body of .github/workflows/pii-official-run.yml;
// it also runs locally as a verification (a local darwin run is never an official run and never compared with a linux one: the receipt says so).
//
//   node --import tsx scripts/run-pii-official.mjs --engine=<pii-eval> --shim=<redact-secret-core.mjs> --package=<@redact-secret/core dir> \
//        --addon=<@redact-secret/node-<platform> dir> --node=<absolute node> --work=<dir> --receipt=<file> [--require-canonical]
//
// What is derived and what is checked, never typed:
//   - the plan (`benchmarks/pii-eval-official-execution-plan.json`) must equal the pins (`pii-official-plan.mjs --check`);
//   - the candidate identity of a run is the tree digest of the package it launches (`package.treeSha256`, the candidate digest), computed here from the
//     installed tree and recomputed by the engine before anything is executed. It is NOT the artifact-set commitment of the frozen observation (different
//     construct, different bytes), so the manifest is rebuilt for it (`writeConversion(.., { candidateDigest })`); snapshot and roster stay byte-identical;
//   - after each run the artifact must carry mode `official`, the pinned configuration, activation, adapter, population, roster and engine identities, the
//     candidate digest of this run, `complete`, two agreeing replays and no failure; `pii-eval validate` re-verifies it against its snapshot and manifest;
//   - the artifacts then go through the production consumer under a pin set derived from the committed pins with only the new digests changed (artifact,
//     manifest, candidate) and the mode official, so anything else that differs from the committed pins is a rejection, not a repin.
// It writes no committed file, sets no threshold, status or authority and records no owner acceptance. A failure is never normalised.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consume, loadPins, semanticDigest, parseStrictJson } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { writeConversion } from './convert-pii-populations.mjs';
import { VIEWS, ROOT } from './lib/pii-population-conversion.mjs';
import { treeSha256 } from './lib/pii-tree-digest.mjs';
import { buildPlan } from './pii-official-plan.mjs';

export const RECEIPT_SCHEMA = 'redact-secret-benchmarks.pii-official-run/1';
const PLAN_FILE = 'benchmarks/pii-eval-official-execution-plan.json';
const PINS_FILE = 'benchmarks/pii-eval-population-pins.json';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const stable = value => JSON.stringify(value);

function arg(name, required = true) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (required && !hit) { console.error(`missing --${name}=`); process.exit(2); }
  return hit;
}

/** The run configuration of one population: every pin of the run is written from the derived inputs, the engine verifies each before it launches a scanner. */
export function runConfig({ plan, population, files, scanner, outDir }) {
  return {
    schema: 'pii-eval-run-config/1', mode: 'official', runClass: plan.runClass, product: plan.product, engineVersion: '0.0.0',
    protocol: { id: plan.protocol.id, revision: plan.protocol.revision },
    snapshot: { path: files.snapshot, semanticDigest: population.snapshotDigest },
    manifest: { path: files.manifest, semanticDigest: files.manifestDigest },
    scanners: [{
      adapter: 'redact-secret-core', node: scanner.node, shim: { path: scanner.shim },
      package: { dir: scanner.packageDir, entry: 'dist/index.js', version: plan.candidate.version, treeSha256: scanner.packageTree },
      extraArtifacts: [{ path: scanner.addonDir, target: 'tree', sha256: scanner.addonTree }],
    }],
    host: { maxWorkers: 2, resources: 'enforce' },
    output: { dir: outDir, overwrite: 'refuse' },
    projection: { roster: { path: files.roster, rosterDigest: population.rosterDigest } },
  };
}

/**
 * Descriptive only: the fresh metric cells against the committed exploratory replay of the frozen observation (counts, effective N, value, status of each of the ten
 * metrics in every family and view row). A difference is reported, never judged: the two are different identities (the candidate digest differs by construction).
 */
export function metricParity(fresh, committed) {
  const a = committed?.semantic?.productProjection?.rows ?? [], b = fresh?.semantic?.productProjection?.rows ?? [];
  let cells = 0, differing = 0;
  const keyOf = row => `${row.view}/${row.family}`;
  const byKey = new Map(a.map(row => [keyOf(row), row]));
  for (const row of b) {
    const other = byKey.get(keyOf(row));
    for (const metric of row.metrics) {
      cells += 1;
      const mate = other?.metrics.find(item => item.metric.id === metric.metric.id);
      if (!mate || stable([mate.counts, mate.effectiveN, mate.value, mate.status]) !== stable([metric.counts, metric.effectiveN, metric.value, metric.status])) differing += 1;
    }
  }
  return { against: 'committed exploratory replay of the frozen observation', rows: b.length, rowsCommitted: a.length, metricCells: cells, metricCellsDiffering: differing };
}

/** Problems with a fresh artifact, against the plan and the committed pins. An empty list is the official-mode contract met by this artifact. */
export function artifactProblems({ doc, plan, population, pinPopulation, candidateDigest, manifestDigest }) {
  const problems = [];
  const sem = doc.semantic ?? {};
  const scanner = sem.scanners?.[0];
  const identity = scanner?.identity ?? {};
  if (doc.schemaVersion !== plan.protocol.artifactSchema) problems.push(`artifact schema ${doc.schemaVersion}, plan ${plan.protocol.artifactSchema}`);
  if (semanticDigest(doc) !== doc.semanticDigest) problems.push('the semantic digest does not recompute');
  if (sem.completeness?.status !== undefined && sem.completeness.status !== 'complete') problems.push(`run is ${sem.completeness.status}`);
  if (sem.runClass !== plan.runClass) problems.push(`run class ${sem.runClass}`);
  if (sem.manifestDigest !== manifestDigest) problems.push('the artifact is bound to another manifest');
  if (sem.population?.populationDigest !== population.snapshotDigest || sem.population?.populationId !== population.populationId) problems.push('the artifact is bound to another population');
  if (sem.productProjection?.rosterDigest !== population.rosterDigest) problems.push('the artifact is bound to another roster');
  const rows = sem.productProjection?.rows ?? [];
  if (!rows.length || rows.some(row => row.mode !== 'official')) problems.push('a projection row is not official');
  if (!scanner || scanner.status !== 'complete' || scanner.replays?.agreed !== true || scanner.replays?.count < 2) problems.push('the scanner did not complete with two agreeing replays');
  if (identity.configurationDigest !== plan.scanner.configurationDigest) problems.push('configuration digest differs from the pin');
  if (identity.activationDigest !== plan.scanner.activationDigest) problems.push('activation digest differs from the pin');
  if (stable(identity.adapter) !== stable({ adapterId: plan.scanner.adapter.id, adapterVersion: plan.scanner.adapter.version, normalizationVersion: plan.scanner.adapter.normalizationVersion })) problems.push('adapter identity differs from the pin');
  if (identity.product?.kind !== 'candidate' || identity.product?.candidateDigest !== candidateDigest || identity.artifactDigest !== candidateDigest) problems.push('the candidate digest is not the tree digest of the launched package');
  if (identity.scannerVersion !== plan.candidate.version) problems.push(`scanner version ${identity.scannerVersion}`);
  if (sem.populationCounts?.authoredCases !== population.memberships) problems.push(`authored cases ${sem.populationCounts?.authoredCases}, plan ${population.memberships}`);
  if (Array.isArray(sem.failures) && sem.failures.length) problems.push(`${sem.failures.length} failure(s) are recorded`);
  if (pinPopulation === undefined) problems.push('no committed pin for this population');
  return problems;
}

function readCommitted(root, view) {
  try { return readJson(join(root, 'benchmarks/pii-eval-population-dual-run', `${view}.public-synthetic-artifact.json`)); } catch { return null; }
}

function run(binary, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...options });
  return { status: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '', ms: Date.now() - started };
}

export function runOfficial({ engine, shim, packageDir, addonDir, node, work, root = ROOT, requireCanonical = false, runBinary = run }) {
  const plan = readJson(join(root, PLAN_FILE));
  if (stable(plan) !== stable(buildPlan())) throw new Error(`${PLAN_FILE} differs from the pins: run node scripts/pii-official-plan.mjs --write`);
  const pins = readJson(join(root, PINS_FILE));
  const engineBytes = readFileSync(engine);
  const binarySha256 = sha256(engineBytes);
  const platform = `${process.platform}-${process.arch}`;
  const matchesPin = binarySha256 === plan.engine.binarySha256;
  const canonical = matchesPin && platform === 'linux-x64';
  if (requireCanonical && !canonical) throw new Error(`not the canonical engine on the canonical platform (binary ${binarySha256} ${matchesPin ? 'matches' : 'differs from'} the pin; platform ${platform})`);
  const pkg = readJson(join(packageDir, 'package.json'));
  if (pkg.name !== '@redact-secret/core' || pkg.version !== plan.candidate.version) throw new Error(`the package is ${pkg.name}@${pkg.version}, the plan names @redact-secret/core@${plan.candidate.version}`);
  const packageTree = treeSha256(packageDir), addonTree = treeSha256(addonDir), shimSha256 = sha256(readFileSync(shim));
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const conv = join(work, 'conv');
  const { summary } = writeConversion(conv, { candidateDigest: packageTree });
  const populations = [], accepted = [], derivedPins = structuredClone(pins);
  derivedPins.requireComplete = true;
  for (const planned of plan.populations) {
    const view = planned.view, dir = join(conv, view), out = join(work, 'out', view);
    const row = summary.find(item => item.view === view);
    const files = { snapshot: join(dir, 'snapshot.json'), manifest: join(dir, 'manifest.json'), roster: join(dir, 'projection-roster.json'), manifestDigest: row.manifestDigest };
    if (row.snapshotDigest !== planned.snapshotDigest) throw new Error(`${view}: the converted snapshot differs from the plan (${row.snapshotDigest})`);
    mkdirSync(join(work, 'out'), { recursive: true });
    const config = runConfig({ plan, population: planned, files, scanner: { node, shim, packageDir, addonDir, packageTree, addonTree }, outDir: out });
    const configFile = join(work, `run-config.${view}.json`);
    writeFileSync(configFile, `${JSON.stringify(config, null, 1)}\n`);
    const result = runBinary(engine, ['run', '--config', configFile]);
    const entry = { view, exit: result.status, durationMs: result.ms, problems: [] };
    if (result.status !== 0) {
      entry.problems.push(`pii-eval run exited ${result.status}${result.signal ? ` (${result.signal})` : ''}: ${result.stderr.trim().split('\n').slice(0, 3).join(' | ').slice(0, 300)}`);
      populations.push(entry);
      continue;
    }
    const artifactFile = join(out, 'public-synthetic-artifact.json');
    const bytes = readFileSync(artifactFile);
    const doc = parseStrictJson(bytes.toString('utf8'));
    const pinPopulation = pins.populations.find(item => item.label === view);
    entry.problems.push(...artifactProblems({ doc, plan, population: planned, pinPopulation, candidateDigest: packageTree, manifestDigest: row.manifestDigest }));
    // The engine's own validation of the artifact against its snapshot and manifest (strict contract and the accounting verifier).
    const validated = runBinary(engine, ['validate', artifactFile, '--snapshot', files.snapshot, '--projection-roster', files.roster]);
    if (validated.status !== 0) entry.problems.push(`pii-eval validate (public artifact, recomputed projection) exited ${validated.status}: ${validated.stderr.trim().slice(0, 200)}`);
    const validatedRun = runBinary(engine, ['validate', join(out, 'run-artifact.json'), '--snapshot', files.snapshot, '--manifest', files.manifest]);
    if (validatedRun.status !== 0) entry.problems.push(`pii-eval validate (run artifact, accounting verifier) exited ${validatedRun.status}: ${validatedRun.stderr.trim().slice(0, 200)}`);
    Object.assign(entry, {
      snapshotDigest: planned.snapshotDigest, manifestDigest: row.manifestDigest, rosterDigest: planned.rosterDigest, populationId: planned.populationId, memberships: planned.memberships,
      artifactSemanticDigest: doc.semanticDigest, artifactSha256: sha256(bytes), artifactBytes: bytes.length, mode: doc.semantic?.productProjection?.rows?.[0]?.mode ?? null,
      scannerReplays: doc.semantic?.scanners?.[0]?.replays ?? null, artifactFile,
      exploratoryParity: metricParity(doc, readCommitted(root, view)),
    });
    populations.push(entry);
    accepted.push({ name: `${view}.public-synthetic-artifact.json`, text: bytes.toString('utf8') });
    // The pin set the artifacts are consumed under: the committed pins with the three digests a fresh execution changes and the mode official.
    const pin = derivedPins.populations.find(item => item.label === view);
    pin.retiredArtifactDigests = [...new Set([...(pin.retiredArtifactDigests ?? []), pin.artifactDigest])].sort();
    pin.retiredManifestDigests = [...new Set([...(pin.retiredManifestDigests ?? []), pin.manifestDigest])].sort();
    pin.artifactDigest = doc.semanticDigest;
    pin.manifestDigest = row.manifestDigest;
    pin.projection.mode = 'official';
    for (const scanner of pin.scanners) { scanner.artifactDigest = packageTree; scanner.product = { kind: 'candidate', candidateDigest: packageTree }; }
  }
  let consumed = null;
  if (populations.every(item => item.problems.length === 0) && accepted.length === plan.populations.length) {
    const report = consume(loadPins(JSON.stringify(derivedPins)), accepted);
    consumed = { complete: report.complete === true, decision: report.decision, pooling: report.pooling, rejections: report.rejections, populations: report.populations.map(item => ({ label: item.label, status: item.status })) };
    if (!consumed.complete) for (const item of populations) item.problems.push('the production consumer rejected the artifacts under the derived official pins');
  }
  return {
    schema: RECEIPT_SCHEMA, supportClaims: false, authorityChanged: false, ownerAcceptance: null, mode: 'official', runClass: plan.runClass,
    execution: { kind: 'fresh-execution', scannersLaunched: true, replay: false, canonical, platform, node: process.version, note: canonical ? 'canonical linux-x64 execution with the pinned engine binary' : 'verification only: not the canonical platform and engine, never compared with a linux official run' },
    engine: { commit: plan.engine.commit, binarySha256, pinnedBinarySha256: plan.engine.binarySha256, matchesPin, shimSha256 },
    candidate: {
      version: plan.candidate.version, sourceCommit: plan.candidate.sourceCommit, packageTreeSha256: packageTree, addonTreeSha256: addonTree,
      recordedArtifactSetCommitment: plan.candidate.artifactSetCommitment, equalsRecordedArtifactSetCommitment: packageTree === plan.candidate.artifactSetCommitment,
    },
    scanner: { configurationDigest: plan.scanner.configurationDigest, activationDigest: plan.scanner.activationDigest, activation: plan.scanner.activation },
    populations: populations.map(({ artifactFile: _file, ...rest }) => rest),
    consumer: consumed,
    verdict: { allPopulationsRan: populations.length === plan.populations.length && populations.every(item => item.exit === 0), noProblems: populations.every(item => item.problems.length === 0), consumedComplete: consumed?.complete === true },
    plan: { path: PLAN_FILE, sha256: sha256(readFileSync(join(root, PLAN_FILE))) },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const receipt = runOfficial({
    engine: resolve(arg('engine')), shim: resolve(arg('shim')), packageDir: resolve(arg('package')), addonDir: resolve(arg('addon')), node: resolve(arg('node')),
    work: resolve(arg('work')), requireCanonical: process.argv.includes('--require-canonical'),
  });
  const file = arg('receipt', false);
  if (file) writeFileSync(resolve(file), `${JSON.stringify(receipt, null, 1)}\n`);
  console.log(JSON.stringify({ verdict: receipt.verdict, canonical: receipt.execution.canonical, candidate: receipt.candidate, populations: receipt.populations.map(p => ({ view: p.view, exit: p.exit, problems: p.problems, artifactSemanticDigest: p.artifactSemanticDigest })) }, null, 1));
  if (!receipt.verdict.noProblems || !receipt.verdict.allPopulationsRan || !receipt.verdict.consumedComplete) process.exit(1);
}
