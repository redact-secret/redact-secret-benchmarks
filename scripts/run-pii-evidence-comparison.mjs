#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync, copyFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyPackages } from './run-pii-candidate-comparison.mjs';
import { treeSha256 } from './lib/pii-tree-digest.mjs';
import { verifyEvidenceSource } from './fetch-pii-evidence-inputs.mjs';
import { sha256, verifyConsumerRuntime, verifyImportDigests } from './lib/pii-evidence-contract.mjs';
import { readEvidenceComparisonPlan, PLAN_PATH, validateEvidenceExecutionSelection, validateEvidenceComparisonPlan, evidenceDigest, same, evidenceSides } from './lib/pii-evidence-comparison-plan.mjs';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';
import { parseStrictJson } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { deriveEvidencePopulationIndex, loadPiiEvidenceComparison, SIDES, POPULATION_INDEX_DIGEST } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
const json = value => JSON.stringify(value, null, 1) + '\n';
const read = file => parseEvidenceJson(readFileSync(file, 'utf8'));
const fail = code => { throw new Error(`evidence-comparison-refusal: ${code}`); };
export function evidenceExecutionContext({ requireCanonical, plan, environment = process.env, now = Date.now() }) {
  if (!requireCanonical) return { github: undefined, deadline: now + 120000 };
  if (plan.mode !== 'official' || plan.dispatch.authorised !== true) fail('fresh-cost-decision-required');
  const github = { repository: environment.GITHUB_REPOSITORY, runId: Number(environment.GITHUB_RUN_ID), runAttempt: Number(environment.GITHUB_RUN_ATTEMPT), headSha: environment.GITHUB_SHA, workflowRef: environment.GITHUB_WORKFLOW_REF };
  if (github.repository !== 'redact-secret/redact-secret-benchmarks' || !Number.isSafeInteger(github.runId) || github.runId <= 0 || github.runAttempt !== 1 ||
      !/^[a-f0-9]{40}$/.test(github.headSha ?? '') || !/^redact-secret\/redact-secret-benchmarks\/\.github\/workflows\/pii-official-run\.yml@refs\/heads\/(?!main$|develop$)[A-Za-z0-9._/-]+$/.test(github.workflowRef ?? '')) fail('canonical-github-identity-missing');
  const jobStart = Number(environment.EVIDENCE_JOB_STARTED_AT) * 1000;
  if (!Number.isSafeInteger(jobStart) || jobStart <= 0 || jobStart > now) fail('job-budget-origin-missing');
  if (jobStart + 900000 <= now) fail('execution-budget-exhausted');
  return { github, deadline: jobStart + 900000 };
}
export function verifyEvidenceImports({ verified, imported, outputs, plan }) {
  const sem = verified?.semantic, mapped = imported?.semantic;
  const losses = mapped?.binding?.losses;
  const normalizedLosses = plan.consumer.contract.mapping.revision === 3 && losses && Object.keys(losses).every(key => Object.hasOwn(plan.losses, key))
    ? Object.fromEntries(Object.keys(plan.losses).map(key => [key, Object.hasOwn(losses, key) ? losses[key] : 0])) : losses;
  if (verified?.state !== 'accepted' || verified.command !== 'verify' || verified.exit?.code !== 0 || sem?.population !== 'public' ||
      sem.snapshotId !== plan.evidence.snapshot.id || sem.contentDigest !== plan.evidence.snapshot.contentDigest || sem.manifestSha256 !== plan.evidence.snapshot.manifestSha256 ||
      !same(sem.contract, { name: plan.evidence.contract.name, version: '1' }) || !same(sem.counts, { cases: plan.counts.evidenceCases, fixtures: plan.counts.evidenceFixtures, skipped: plan.counts.evidenceSkipped }) ||
      imported?.state !== 'accepted' || imported.command !== 'import' || imported.exit?.code !== 0 ||
      mapped?.snapshotId !== sem.snapshotId || mapped.contentDigest !== sem.contentDigest || mapped.manifestSha256 !== sem.manifestSha256 ||
      !same(mapped.contract, sem.contract) || !same(mapped.counts, sem.counts) || !same(imported.outputs, plan.preflight.outputs) ||
      !same(mapped.population, { id: plan.population.id, version: plan.population.version, visibility: 'public-synthetic', schemaVersion: plan.consumer.contract.corpusSchema, semanticDigest: plan.population.digest }) ||
      mapped.binding?.semanticDigest !== plan.population.bindingDigest || !same(mapped.binding?.counts, plan.counts) || !same(normalizedLosses, plan.losses))
    fail('verify-import-summary-mismatch');
  for (const [name, expected] of Object.entries(plan.preflight.outputs))
    if (!outputs[name] || outputs[name].length !== expected.bytes || sha256(outputs[name]) !== expected.sha256) fail('import-output-byte-mismatch');
  const { snapshot, binding } = verifyImportDigests(outputs, plan.population, plan.consumer.contract.corpusSchema);
  const populationIndex = deriveEvidencePopulationIndex(snapshot, binding, plan);
  if (evidenceDigest(populationIndex) !== plan.populationIndexDigest) fail('population-index-mismatch');
  return { snapshot, binding, populationIndex };
}

export async function runEvidenceComparison({ plan = readEvidenceComparisonPlan(), planFile = PLAN_PATH, engine, consumerBin, sourceDir, sourceArchive, buildReceipt,
  shim, node, tarballs, inventory, out, requireCanonical = false, snapshotDir }) {
  validateEvidenceComparisonPlan(plan);
  const sides = evidenceSides(plan);
  if (requireCanonical) validateEvidenceExecutionSelection(plan, { planPath: planFile });
  if (existsSync(out)) fail('output-exists');
  if (requireCanonical ? plan.mode !== 'official' || plan.dispatch.authorised !== true : plan.mode !== 'exploratory') fail('fresh-cost-decision-required');
  const executionContext = evidenceExecutionContext({ requireCanonical, plan });
  const platform = `${process.platform}-${process.arch}`, binarySha256 = sha256(readFileSync(engine));
  if (requireCanonical ? platform !== 'linux-x64' || binarySha256 !== plan.engine.binarySha256 : platform !== 'darwin-arm64' || binarySha256 !== plan.localVerification.engineBinarySha256) fail('engine-platform-mismatch');
  verifyEvidenceSource(sourceDir, sourceArchive, plan.consumer);
  const consumerReceipt = buildReceipt ? read(buildReceipt) : null;
  verifyConsumerRuntime({ sourceCommit: plan.consumer.source.commit, cargoLock: readFileSync(join(sourceDir, 'Cargo.lock')),
    fetchHelper: readFileSync(join(sourceDir, 'tools/pii-evidence/fetch-snapshot.mjs')), binary: readFileSync(consumerBin), platform, buildReceipt: consumerReceipt }, plan.consumer);
  if (sha256(readFileSync(shim)) !== plan.engine.shimSha256) fail('shim-mismatch');
  for (const side of sides) verifyPackages({ plan, side, tarballs: tarballs[side], inventory });
  if (plan.candidate && plan.productTuple && sha256(readFileSync(tarballs.candidate.node)) !==
      (requireCanonical ? plan.candidate.nativeLinuxTarballSha256 : plan.candidate.localNativeDarwinTarballSha256)) fail('reviewed-native-tarball-mismatch');
  const scratch = mkdtempSync(join(tmpdir(), 'pii-evidence-comparison-'));
  let deadline = executionContext.deadline;
  const command = (binary, args, cwd, asJson = true) => {
    const remaining = deadline - Date.now(); if (remaining <= 0) fail('execution-budget-exhausted');
    const result = spawnSync(binary, args, { encoding: 'utf8', timeout: Math.min(120000, remaining), maxBuffer: 16 * 1024 * 1024,
      cwd, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(TOKEN|SECRET|PRIVATE_KEY)/i.test(key))) });
    if (result.status !== 0) fail(result.error?.code === 'ETIMEDOUT' ? 'command-timed-out' : 'command-failed');
    return asJson ? parseEvidenceJson(result.stdout) : result.stdout;
  };
  const started = Date.now();
  try {
    const pinFile = join(scratch, 'evidence-pin.json'); writeFileSync(pinFile, json(plan.evidence));
    if (!snapshotDir) {
      snapshotDir = join(scratch, 'evidence');
      command(node, [realpathSync(join(sourceDir, 'tools/pii-evidence/fetch-snapshot.mjs')), '--pin', pinFile, '--out', snapshotDir]);
    }
    const common = ['--snapshot-dir', snapshotDir, '--pin', pinFile];
    const verified = command(consumerBin, ['verify', ...common]), importDir = join(scratch, 'import');
    const imported = command(consumerBin, ['import', ...common, '--out', importDir,
      ...(plan.consumer.contract.mapping.revision === 3 ? ['--mapping-revision', '3'] : [])]);
    const outputs = Object.fromEntries(['snapshot.json', 'binding.json'].map(name => [name, readFileSync(join(importDir, name))]));
    const { populationIndex } = verifyEvidenceImports({ verified, imported, outputs, plan });
    deadline = requireCanonical ? executionContext.deadline : Date.now() + 60000;
    if (deadline <= Date.now()) fail('execution-budget-exhausted');
    const receipt = { schema: 'pii-evidence-comparison-receipt/1', publicOnly: true, supportClaims: false, authorityChanged: false,
      planDigest: evidenceDigest(plan), mode: plan.mode, engine: { commit: plan.engine.commit, binarySha256, shimSha256: plan.engine.shimSha256, platform, canonical: requireCanonical },
      importer: { binarySha256: sha256(readFileSync(consumerBin)), buildReceipt: consumerReceipt }, replayInputs: [],
      import: { population: plan.population, counts: plan.counts, losses: plan.losses,
        snapshotSha256: sha256(outputs['snapshot.json']), bindingSha256: sha256(outputs['binding.json']), populationIndexDigest: plan.populationIndexDigest } };
    if (requireCanonical) receipt.github = executionContext.github;
    mkdirSync(out, { recursive: true }); const artifacts = [];
    for (const side of sides) {
      const installation = { root: join(scratch, `${side}-package`) }; mkdirSync(installation.root);
      try {
        const nodeName = `@redact-secret/node-${platform}${platform === 'linux-x64' ? '-gnu' : ''}`;
        writeFileSync(join(installation.root, 'package.json'), json({ name: 'pii-evidence-isolated-consumer', private: true, type: 'module',
          dependencies: { '@redact-secret/core': `file:${tarballs[side].core}` }, overrides: { '@redact-secret/wasm': `file:${tarballs[side].wasm}`, [nodeName]: `file:${tarballs[side].node}` } }));
        command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], installation.root, false);
        const packageDir = join(installation.root, 'node_modules/@redact-secret/core');
        const addonDir = join(installation.root, `node_modules/@redact-secret/node-${platform}${platform === 'linux-x64' ? '-gnu' : ''}`);
        const wasmDir = join(installation.root, 'node_modules/@redact-secret/wasm');
        const identity = read(join(packageDir, 'package.json')); installation.declaredVersion = identity.version;
        if (identity.name !== '@redact-secret/core' || installation.declaredVersion !== plan[side].version) fail('installed-version-mismatch');
        const packageTreeSha256 = treeSha256(packageDir), addonTreeSha256 = treeSha256(addonDir), wasmTreeSha256 = treeSha256(wasmDir);
        const dir = join(scratch, side); mkdirSync(dir);
        const config = { schema: 'pii-eval-run-config/1', mode: 'exploratory', runClass: 'public-synthetic', product: 'candidate',
          snapshot: { path: join(importDir, 'snapshot.json') }, manifest: { path: join(dir, 'manifest.json') },
          scanners: [{ adapter: 'redact-secret-core', shim: { path: shim }, package: { dir: packageDir, entry: 'dist/index.js', version: installation.declaredVersion, treeSha256: packageTreeSha256 },
            extraArtifacts: [{ path: addonDir, target: 'tree', sha256: addonTreeSha256 }, { path: wasmDir, target: 'tree', sha256: wasmTreeSha256 }] }], host: { maxWorkers: 2, resources: 'enforce' } };
        const configFile = join(dir, 'config.json'); writeFileSync(configFile, json(config));
        const planned = command(consumerBin, ['plan', '--config', configFile, '--node', node, '--replays', '2']);
        const manifestDigest = planned.semantic.manifestSemanticDigest;
        config.mode = plan.mode; config.engineVersion = plan.consumer.contract.engineVersion; config.protocol = plan.consumer.contract.protocol;
        config.snapshot.semanticDigest = plan.population.digest; config.manifest.semanticDigest = manifestDigest;
        config.output = { dir: join(dir, 'run'), overwrite: 'refuse' }; writeFileSync(configFile, json(config));
        const executed = command(engine, ['run', '--config', configFile, '--node', node]);
        if (executed.state !== 'complete' || executed.semantic?.completeness !== 'complete') fail('execution-incomplete');
        const publicFile = join(dir, 'run/public-synthetic-artifact.json'), text = readFileSync(publicFile, 'utf8'), doc = parseStrictJson(text);
        const replays = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          const replay = command(engine, ['replay', '--snapshot', join(importDir, 'snapshot.json'), '--manifest', join(dir, 'run/manifest.json'),
            '--observation', join(dir, 'run/observation-redact-secret-core.json'), '--original', join(dir, 'run/run-artifact.json'),
            '--out', join(dir, `replay-${attempt}`), '--expect-snapshot-digest', plan.population.digest, '--expect-manifest-digest', manifestDigest]);
          replays.push({ state: replay.state, parity: replay.semantic?.parity, publicArtifactDigest: replay.semantic?.publicArtifactDigest });
        }
        receipt[side] = { sourceCommit: plan[side].sourceCommit, version: installation.declaredVersion, packageTreeSha256, addonTreeSha256, wasmTreeSha256,
          tarballs: Object.fromEntries(Object.entries(tarballs[side]).map(([key, file]) => [key, sha256(readFileSync(file))])),
          tarballIntegrity: Object.fromEntries(Object.entries(tarballs[side]).map(([key, file]) => [key, 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64')])),
          manifestDigest, artifactDigest: doc.semanticDigest, artifactSha256: sha256(text), replays };
        artifacts.push({ side, text }); writeFileSync(join(out, `${side}.public-synthetic-artifact.json`), text);
        const replayDir = join(out, 'replay-inputs', side); mkdirSync(replayDir, { recursive: true });
        for (const [from, to] of [['manifest.json', 'manifest.json'], ['observation-redact-secret-core.json', 'observation.json'], ['run-artifact.json', 'run-artifact.json']]) {
          copyFileSync(join(dir, 'run', from), join(replayDir, to));
          receipt.replayInputs.push({ name: `replay-inputs/${side}/${to}`, sha256: sha256(readFileSync(join(replayDir, to))) });
        }
      } finally { rmSync(installation.root, { recursive: true, force: true }); }
    }
    receipt.durationMs = Date.now() - started;
    const summary = loadPiiEvidenceComparison({ plan, receipt, artifacts, populationIndex, allowUnrecordedOfficial: true });
    if (summary.state !== 'recorded') fail(summary.reason);
    writeFileSync(join(out, 'plan.json'), json(plan)); writeFileSync(join(out, 'receipt.json'), json(receipt));
    if (requireCanonical) writeFileSync(join(out, 'build-receipt.json'), json(consumerReceipt));
    return { receipt, summary };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const value = process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3); if (!value) fail(`missing-${name}`); return resolve(value); };
  const canonical = process.argv.includes('--require-canonical');
  const planFile = process.argv.find(value => value.startsWith('--plan='))?.slice(7) ?? process.env.EVIDENCE_PLAN ?? PLAN_PATH;
  const plan = readEvidenceComparisonPlan(planFile);
  const result = await runEvidenceComparison({ engine: arg('engine'), sourceDir: arg('source'), sourceArchive: arg('source-archive'), consumerBin: arg('consumer'),
    plan, planFile,
    snapshotDir: process.argv.some(value => value.startsWith('--snapshot-dir=')) ? arg('snapshot-dir') : undefined,
    buildReceipt: canonical ? arg('build-receipt') : undefined, shim: arg('shim'), node: arg('node'), inventory: plan.candidate ? arg('candidate-inventory') : undefined, out: arg('out'), requireCanonical: canonical,
    tarballs: Object.fromEntries(evidenceSides(plan).map(side => [side, Object.fromEntries(['core', 'node', 'wasm'].map(key => [key, arg(`${side}-${key}`)]))])) });
  console.log(JSON.stringify({ state: result.summary.state, mode: result.summary.mode, metrics: result.summary.metrics.length, outcomes: result.summary.outcomes.length, changed: result.summary.changes.total, supportClaims: false }));
}
