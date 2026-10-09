// The official PII run (#796): the workflow's trust boundaries, the run configuration, the official-mode contract an artifact must meet, the tree digest the
// engine pins a package with, and the derivation of the consumer's pin set. A stand-in engine writes the committed artifact transformed the way a real
// official run differs from the replay (mode, candidate digest, manifest digest), so the whole path is exercised offline; the real engine runs in the
// dispatch workflow and locally with --engine. No test asserts a ledger value: every expectation is derived from the plan, the pins or the files under test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import YAML from 'yaml';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { artifactProblems, metricParity, runConfig, runOfficial } from '../scripts/run-pii-official.mjs';
import { treeSha256 } from '../scripts/lib/pii-tree-digest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const readJson = file => JSON.parse(read(file));
const plan = readJson('benchmarks/pii-eval-official-execution-plan.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const completeWorkflow = read('.github/workflows/pii-official-run.yml');
const workflow = completeWorkflow.split('\n  candidate-comparison:')[0];

test('the workflow is dispatch only, selects only a committed lane, and holds least privilege', () => {
  const parsed = YAML.parse(completeWorkflow);
  assert.deepEqual(Object.keys(parsed.on), ['workflow_dispatch']);
  assert.deepEqual(parsed.on.workflow_dispatch.inputs, { lane: {
    description: 'Committed measurement plan to execute', type: 'choice', default: 'pinned-official',
    options: ['pinned-official', 'candidate-comparison', 'evidence-comparison'],
  }, evidence_plan: { description: 'Committed public evidence plan, used only by evidence-comparison', type: 'string',
    default: 'benchmarks/pii-evidence-comparison/plan.json' } });
  assert.deepEqual(parsed.jobs['candidate-comparison'].permissions, { contents: 'read', actions: 'read' });
  assert.equal(parsed.jobs['candidate-comparison'].uses, './.github/workflows/pii-candidate-comparison.yml');
  assert.deepEqual(parsed.jobs['evidence-comparison'].permissions, { contents: 'read', actions: 'read' });
  assert.equal(parsed.jobs['evidence-comparison'].uses, './.github/workflows/pii-evidence-comparison.yml');
  for (const lane of ['candidate-comparison', 'evidence-comparison']) {
    const ref = parsed.jobs[lane].uses;
    assert.match(ref, /^\.\/\.github\/workflows\/[a-z-]+\.yml$/, 'a local call runs the reusable workflow from this same commit');
    assert.ok(YAML.parse(read(ref.slice(2))).on.workflow_call, `${lane} names an existing reusable workflow`);
  }
  const lanes = { 'official-run': 'pinned-official', 'candidate-comparison': 'candidate-comparison', 'evidence-comparison': 'evidence-comparison' };
  for (const [job, lane] of Object.entries(lanes))
    assert.equal(parsed.jobs[job].if, `github.repository == 'redact-secret/redact-secret-benchmarks' && inputs.lane == '${lane}'`);
  for (const requested of [...Object.values(lanes), 'unknown']) {
    const selected = Object.keys(lanes).filter(job => parsed.jobs[job].if.endsWith(`inputs.lane == '${requested}'`));
    assert.deepEqual(selected, Object.keys(lanes).filter(job => lanes[job] === requested));
  }
  const header = workflow.split('\njobs:')[0];
  assert.doesNotMatch(header.replace(/^#.*$/gm, ''), /pull_request|push:|schedule:|workflow_run/);
  assert.deepEqual(Object.keys(parsed.jobs).sort(), Object.keys(lanes).sort());
  assert.deepEqual(parsed.jobs['official-run'].permissions, { contents: 'read' });
  for (const job of Object.values(parsed.jobs))
    assert.ok(Object.values(job.permissions).every(permission => permission === 'read'), 'every lane has read-only permissions');
  assert.match(workflow, /concurrency:\n {2}group: pii-official-run\n {2}cancel-in-progress: false/);
});

test('every action is pinned by commit SHA, credentials are not persisted and no dispatch context reaches a script', () => {
  const uses = [...workflow.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)];
  assert.ok(uses.length >= 6);
  for (const [, ref, rest] of uses) {
    assert.match(ref, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${ref} is pinned by a full commit SHA`);
    assert.match(rest, /# v\d/, `${ref} carries its version comment`);
  }
  const checkouts = workflow.split('actions/checkout@').slice(1);
  assert.equal(checkouts.length, 2);
  for (const block of checkouts) assert.match(block.split('\n      - ')[0].split('\n      # ')[0], /persist-credentials: false/);
  const code = workflow.replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(code, /github\.event|github\.head_ref/, 'no untrusted context is interpolated');
  for (const run of code.split(/^\s+run: /m).slice(1)) assert.doesNotMatch(run.split('\n      - ')[0], /\$\{\{/, 'a run script holds no expression: values arrive through env');
});

test('the App tokens are read-only and absent from every step that runs product code or the scanner', () => {
  assert.equal([...workflow.matchAll(/create-github-app-token@/g)].length, 2);
  assert.equal([...workflow.matchAll(/permission-actions: read/g)].length, 2);
  assert.equal([...workflow.matchAll(/permission-contents: read/g)].length, 2);
  assert.doesNotMatch(workflow, /permission-[a-z-]+: write/);
  const steps = workflow.split(/\n {6}- /).slice(1);
  const holdsToken = step => /steps\.(engine|product)-token\.outputs\.token|secrets\./.test(step);
  const named = pattern => steps.find(step => pattern.test(step.split('\n')[0] + step));
  for (const pattern of [/Pack the qualified artifacts/, /Install the candidate read-only/, /Run the four populations in official mode/, /packed tarballs are the bytes/])
    assert.equal(holdsToken(named(pattern)), false, `${pattern} has no token or secret`);
  const run = named(/Run the four populations in official mode/);
  assert.match(run, /--require-canonical/);
  assert.doesNotMatch(run, /GH_TOKEN|GITHUB_TOKEN/);
  assert.match(workflow, /chmod -R a-w/);
  assert.match(workflow, /--ignore-scripts/);
});

test('the run configuration pins the engine, snapshot, manifest, package, addon and roster of one population, officially', () => {
  const population = plan.populations[0];
  const config = runConfig({ plan, population, files: { snapshot: '/x/snapshot.json', manifest: '/x/manifest.json', roster: '/x/roster.json', manifestDigest: 'a'.repeat(64) },
    scanner: { node: '/n/node', shim: '/s/shim.mjs', packageDir: '/p/core', addonDir: '/p/addon', packageTree: 'b'.repeat(64), addonTree: 'c'.repeat(64) }, outDir: '/o' });
  assert.equal(config.mode, 'official');
  assert.equal(config.runClass, 'public-synthetic');
  assert.equal(config.product, 'candidate');
  assert.deepEqual(config.protocol, { id: plan.protocol.id, revision: plan.protocol.revision });
  assert.equal(config.snapshot.semanticDigest, population.snapshotDigest);
  assert.equal(config.projection.roster.rosterDigest, population.rosterDigest);
  assert.equal(config.scanners[0].package.treeSha256, 'b'.repeat(64));
  assert.equal(config.scanners[0].package.version, plan.candidate.version);
  assert.deepEqual(config.scanners[0].extraArtifacts, [{ path: '/p/addon', target: 'tree', sha256: 'c'.repeat(64) }]);
  assert.deepEqual(config.host, { maxWorkers: 2, resources: 'enforce' });
  assert.equal(config.output.overwrite, 'refuse');
});

test('the tree digest is the engine\'s listing digest, and a symlink or an unlistable name is refused', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tree-'));
  mkdirSync(path.join(dir, 'lib'));
  writeFileSync(path.join(dir, 'b.txt'), 'b');
  writeFileSync(path.join(dir, 'lib', 'a.js'), 'a');
  const listing = `${sha256('b')}  b.txt\n${sha256('a')}  lib/a.js\n`;
  assert.equal(treeSha256(dir), sha256(listing));
  symlinkSync('b.txt', path.join(dir, 'link'));
  assert.throws(() => treeSha256(dir), /symlink/);
  const odd = mkdtempSync(path.join(tmpdir(), 'tree-'));
  writeFileSync(path.join(odd, 'a\\b'), 'x');
  assert.throws(() => treeSha256(odd), /not listable/);
});

// The committed artifact of a view, changed the way an official run differs from the replay of the frozen observation.
function officialLike(view, { candidateDigest, manifestDigest, mode = 'official' }) {
  const doc = structuredClone(readJson(`benchmarks/pii-eval-population-dual-run/${view}.public-synthetic-artifact.json`));
  const sem = doc.semantic;
  sem.manifestDigest = manifestDigest;
  const identity = sem.scanners[0].identity;
  identity.artifactDigest = candidateDigest;
  identity.product = { kind: 'candidate', candidateDigest };
  for (const row of sem.productProjection.rows) { row.mode = mode; row.binding.product = { kind: 'candidate', candidateDigest }; }
  doc.semanticDigest = semanticDigest(doc);
  return doc;
}

test('an artifact meets the official-mode contract only when mode, candidate, manifest and pins all agree', () => {
  const planned = plan.populations[0], pinPopulation = readJson('benchmarks/pii-eval-population-pins.json').populations.find(p => p.label === planned.view);
  const candidateDigest = 'd'.repeat(64), manifestDigest = 'e'.repeat(64);
  const good = officialLike(planned.view, { candidateDigest, manifestDigest });
  assert.deepEqual(artifactProblems({ doc: good, plan, population: planned, pinPopulation, candidateDigest, manifestDigest }), []);
  const exploratory = officialLike(planned.view, { candidateDigest, manifestDigest, mode: 'exploratory' });
  assert.ok(artifactProblems({ doc: exploratory, plan, population: planned, pinPopulation, candidateDigest, manifestDigest }).some(p => /not official/.test(p)));
  assert.ok(artifactProblems({ doc: good, plan, population: planned, pinPopulation, candidateDigest: 'f'.repeat(64), manifestDigest }).some(p => /candidate digest/.test(p)));
  assert.ok(artifactProblems({ doc: good, plan, population: planned, pinPopulation, candidateDigest, manifestDigest: '0'.repeat(64) }).some(p => /another manifest/.test(p)));
  const replayOfTheFrozenObservation = structuredClone(readJson(`benchmarks/pii-eval-population-dual-run/${planned.view}.public-synthetic-artifact.json`));
  assert.ok(artifactProblems({ doc: replayOfTheFrozenObservation, plan, population: planned, pinPopulation, candidateDigest, manifestDigest }).length > 0, 'a replay is not an official run');
  const tampered = structuredClone(good);
  tampered.semantic.populationCounts.authoredCases += 1;
  assert.ok(artifactProblems({ doc: tampered, plan, population: planned, pinPopulation, candidateDigest, manifestDigest }).some(p => /does not recompute/.test(p)));
});

test('metric parity counts the cells and reports a difference without judging it', () => {
  const a = readJson('benchmarks/pii-eval-population-dual-run/oracle-plan.public-synthetic-artifact.json');
  const same = metricParity(a, a);
  assert.equal(same.metricCellsDiffering, 0);
  assert.equal(same.metricCells, a.semantic.productProjection.rows.length * 10);
  const b = structuredClone(a);
  b.semantic.productProjection.rows[0].metrics[0].counts.numerator += 1;
  assert.equal(metricParity(b, a).metricCellsDiffering, 1);
  assert.equal(metricParity(a, null).metricCellsDiffering, same.metricCells);
});

// A stand-in engine: `run` writes the transformed committed artifact for the population named in the configuration it is given; `validate` succeeds.
function standInEngine() {
  const calls = [];
  const runBinary = (_engine, args) => {
    calls.push(args[0]);
    if (args[0] === 'validate') return { status: 0, stdout: '', stderr: '', ms: 1 };
    const config = JSON.parse(readFileSync(args[2], 'utf8'));
    const snapshot = JSON.parse(readFileSync(config.snapshot.path, 'utf8'));
    const view = snapshot.semantic.population.populationId.replace('b11-population-v2-', '');
    const doc = officialLike(view, { candidateDigest: config.scanners[0].package.treeSha256, manifestDigest: config.manifest.semanticDigest });
    mkdirSync(config.output.dir, { recursive: true });
    writeFileSync(path.join(config.output.dir, 'public-synthetic-artifact.json'), `${JSON.stringify(doc, null, 1)}\n`);
    writeFileSync(path.join(config.output.dir, 'run-artifact.json'), '{}\n');
    return { status: 0, stdout: '{}', stderr: '', ms: 1 };
  };
  return { runBinary, calls };
}

function stand(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pii-official-'));
  const packageDir = path.join(dir, 'core'), addonDir = path.join(dir, 'addon');
  mkdirSync(path.join(packageDir, 'dist'), { recursive: true });
  mkdirSync(addonDir);
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: '@redact-secret/core', version: plan.candidate.version }));
  writeFileSync(path.join(packageDir, 'dist', 'index.js'), files);
  writeFileSync(path.join(addonDir, 'addon.node'), 'addon');
  const engine = path.join(dir, 'pii-eval');
  writeFileSync(engine, '#!/bin/sh\n');
  chmodSync(engine, 0o755);
  const shim = path.join(dir, 'shim.mjs');
  writeFileSync(shim, '// shim');
  return { dir, packageDir, addonDir, engine, shim };
}

test('four official artifacts for one package are consumed complete under the derived pins, and the receipt says what it is', () => {
  const s = stand('export {}');
  const { runBinary, calls } = standInEngine();
  const receipt = runOfficial({ engine: s.engine, shim: s.shim, packageDir: s.packageDir, addonDir: s.addonDir, node: '/usr/bin/node', work: path.join(s.dir, 'work'), runBinary });
  assert.equal(receipt.verdict.noProblems, true, JSON.stringify(receipt.populations.map(p => p.problems)));
  assert.equal(receipt.verdict.consumedComplete, true);
  assert.equal(receipt.consumer.decision, 'none');
  assert.equal(receipt.consumer.pooling, 'none');
  assert.deepEqual(receipt.populations.map(p => p.view), plan.populations.map(p => p.view));
  assert.ok(receipt.populations.every(p => p.mode === 'official' && p.exploratoryParity.metricCellsDiffering === 0));
  assert.deepEqual(calls.filter(c => c === 'run').length, plan.populations.length);
  assert.equal(receipt.execution.kind, 'fresh-execution');
  assert.equal(receipt.execution.replay, false);
  assert.equal(receipt.execution.canonical, false, 'a stand-in engine off linux is never canonical');
  assert.equal(receipt.candidate.packageTreeSha256, treeSha256(s.packageDir));
  assert.equal(receipt.candidate.equalsRecordedArtifactSetCommitment, false, 'the run identity is the tree digest, not the recorded commitment');
  assert.equal(receipt.ownerAcceptance, null);
  assert.equal(receipt.authorityChanged, false);
  assert.equal(receipt.supportClaims, false);
});

test('a canonical run is refused off the pinned engine, a wrong package version is refused, and a failed run is a problem, not a result', () => {
  const s = stand('export {}');
  const { runBinary } = standInEngine();
  assert.throws(() => runOfficial({ engine: s.engine, shim: s.shim, packageDir: s.packageDir, addonDir: s.addonDir, node: '/usr/bin/node', work: path.join(s.dir, 'w1'), runBinary, requireCanonical: true }), /canonical/);
  writeFileSync(path.join(s.packageDir, 'package.json'), JSON.stringify({ name: '@redact-secret/core', version: '9.9.9' }));
  assert.throws(() => runOfficial({ engine: s.engine, shim: s.shim, packageDir: s.packageDir, addonDir: s.addonDir, node: '/usr/bin/node', work: path.join(s.dir, 'w2'), runBinary }), /plan names/);
  writeFileSync(path.join(s.packageDir, 'package.json'), JSON.stringify({ name: '@redact-secret/core', version: plan.candidate.version }));
  const failing = (engine, args) => (args[0] === 'run' ? { status: 4, stdout: '', stderr: 'provenance-mismatch (exit 4)', ms: 1, signal: null } : runBinary(engine, args));
  const receipt = runOfficial({ engine: s.engine, shim: s.shim, packageDir: s.packageDir, addonDir: s.addonDir, node: '/usr/bin/node', work: path.join(s.dir, 'w3'), runBinary: failing });
  assert.equal(receipt.verdict.noProblems, false);
  assert.equal(receipt.verdict.allPopulationsRan, false);
  assert.equal(receipt.consumer, null);
});

test('the plan states the candidate identity resolution and the workflow it dispatches', () => {
  assert.equal(plan.candidate.package.identity.equal, false);
  assert.ok(plan.resolvedItems.some(item => item.id === 'candidate-package-identity'));
  assert.equal(plan.dispatch.workflow, '.github/workflows/pii-official-run.yml');
  assert.equal(plan.scanner.activation.join(','), 'pii:global,pii:us');
  assert.equal(plan.authorityChanged, false);
});
