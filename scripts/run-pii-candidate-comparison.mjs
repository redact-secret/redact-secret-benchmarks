#!/usr/bin/env node
// Two fresh public-only executions of the same four authored populations; never writes authority or existing runs.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { treeSha256 } from './lib/pii-tree-digest.mjs';
import { buildConversion, snapshotFor, manifestFor, rosterFor, ROOT } from './lib/pii-population-conversion.mjs';
import { semanticDigest, parseStrictJson, canonicalize } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { comparisonPlan } from './pii-candidate-comparison-plan.mjs';
import { comparisonDigest, loadPiiCandidateComparison, SIDES, ACTIVATION_SELECTORS } from '../benchmarks/evaluation/domains/pii/candidate-comparison.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 1) + '\n';
const read = file => parseStrictJson(readFileSync(file, 'utf8'));
let commandDeadline = Infinity;
function command(binary, args) {
  const remaining = commandDeadline - Date.now();
  if (remaining <= 0) throw new Error('comparison-execution-budget-exhausted');
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: Math.min(300000, remaining) });
  if (result.status !== 0) throw new Error(result.error?.code === 'ETIMEDOUT' ? 'measurement-command-timed-out' : 'measurement-command-failed');
  return result.stdout;
}
export function verifyPackages({ plan, side, tarballs, inventory }) {
  if (side === 'baseline') {
    for (const [key, file] of Object.entries(tarballs)) {
      const name = key === 'node' ? `@redact-secret/node-${process.platform}-${process.arch}${process.platform === 'linux' ? '-gnu' : ''}` : `@redact-secret/${key}`;
      const pin = plan.baseline.packages[name], sri = 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64');
      if (!pin || pin.version !== plan.baseline.version || sri !== pin.integrity) throw new Error(`baseline ${key}: lockfile integrity mismatch`);
    }
    return;
  }
  if (sha(readFileSync(inventory)) !== plan.candidate.inventorySha256) throw new Error('candidate inventory digest mismatch');
  const inv = JSON.parse(readFileSync(inventory, 'utf8'));
  if (inv.sourceCommit !== plan.candidate.sourceCommit || String(inv.workflowRun) !== plan.candidate.qualificationRunId || inv.published !== false || inv.productVersion !== plan.candidate.version) throw new Error('candidate inventory identity mismatch');
  const edge = inv.edgeRuntimeQualification?.find(r => r.detectorProfile === 'full' && r.pii === true && r.status === 'qualified');
  if (!edge || !edge.checks?.every(check => check.ok === true) || !edge.binaries.some(b => b.sha256 === plan.candidate.piiWasmBinarySha256)) throw new Error('candidate qualified PII WASM lane missing');
  for (const key of ['core', 'wasm']) {
    const expected = key === 'core' ? plan.candidate.coreTarballSha256 : plan.candidate.piiWasmTarballSha256;
    if (sha(readFileSync(tarballs[key])) !== expected || !edge.packageArtifacts.some(p => p.name === `@redact-secret/${key}` && p.sha256 === expected)) throw new Error(`candidate ${key}: PII-qualified tarball mismatch`);
  }
  // Native packages and payloads are bound to the independently qualified inventory, never inferred from a matching version string.
  const nodeDigest = sha(readFileSync(tarballs.node));
  const lanes = inv.cleanInstallQualification ?? [];
  if (process.platform === 'linux') {
    if (!lanes.some(lane => lane.lane === 'node' && Object.values(lane.results ?? {}).length > 0 && Object.values(lane.results).every(value => value === 'passed') && lane.packages?.some(p => p.name === '@redact-secret/node-linux-x64-gnu' && p.sha256 === nodeDigest))) throw new Error('candidate native tarball not qualified by inventory');
  } else {
    const target = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
    const files = inv.artifacts.filter(a => a.family === 'node-addon' && a.target === target && a.file.endsWith('.node'));
    if (!files.length) throw new Error('candidate native payload inventory missing');
    for (const file of files) { const result = spawnSync('tar', ['-xOf', tarballs.node, `package/${file.file}`], { maxBuffer: 16 * 1024 * 1024 }); if (result.status !== 0 || sha(result.stdout) !== file.sha256) throw new Error('repacked native payload inventory mismatch'); }
  }
}
function captureActivation({ node, packageDir, addonDir }) {
  const script = `import {pathToFileURL} from 'node:url'; const m=await import(pathToFileURL(process.argv[1]).href); const pii=JSON.parse(process.argv[2]); await m.initialize(pii.length?{pii}:undefined); console.log(JSON.stringify({artifact:m.artifact(),activationIdentity:m.piiActivation()}));`;
  const selectors = ACTIVATION_SELECTORS;
  const surfaces = [];
  for (const surface of ['node-addon', 'node-forced-wasm']) {
    if (surface === 'node-forced-wasm') renameSync(addonDir, `${addonDir}.disabled`);
    try {
      const checks = selectors.map(requestedSelectors => ({ requestedSelectors, ...parseStrictJson(command(node, ['--input-type=module', '-e', script, join(packageDir, 'dist/index.js'), JSON.stringify(requestedSelectors)]).trim()) }));
      if (checks.some(check => check.artifact !== (surface === 'node-addon' ? 'addon' : 'wasm') || typeof check.activationIdentity !== 'string')) throw new Error('activation capture runtime mismatch');
      surfaces.push({ surface, checks });
    } finally { if (surface === 'node-forced-wasm') renameSync(`${addonDir}.disabled`, addonDir); }
  }
  return { state: 'available', scope: 'installed-product-configuration-only', supportClaims: false, surfaces };
}
export async function runComparison({ engine, shim, node, tarballs, inventory, out, plan = comparisonPlan(), requireCanonical = false }) {
  if (existsSync(out)) throw new Error('output already exists; choose a fresh directory');
  if (requireCanonical) { if (plan.dispatch?.authorised !== true || typeof plan.dispatch?.costDecision !== 'string' || !plan.dispatch.costDecision.length) throw new Error('fresh official-run cost decision missing'); plan = { ...plan, mode: 'official' }; }
  else if (plan.mode !== 'exploratory') throw new Error('local execution must be exploratory');
  for (const side of SIDES) verifyPackages({ plan, side, tarballs: tarballs[side], inventory });
  const started = Date.now(); commandDeadline = started + 15 * 60 * 1000;
  const binarySha256 = sha(readFileSync(engine));
  if (requireCanonical ? process.platform !== 'linux' || process.arch !== 'x64' || binarySha256 !== plan.engine.binarySha256 : process.platform !== 'darwin' || binarySha256 !== plan.execution.localDarwinBinarySha256) throw new Error('engine binary or execution platform differs from pinned plan');
  const shimSha256 = sha(readFileSync(shim));
  if (shimSha256 !== plan.engine.shimSha256) throw new Error('engine shim mismatch');
  mkdirSync(out, { recursive: true });
  const receipt = { schema: 'pii-candidate-comparison-receipt/1', supportClaims: false, authorityChanged: false, ownerAcceptance: null, planDigest: comparisonDigest(plan), mode: plan.mode,
    engine: { commit: plan.engine.commit, binarySha256, shimSha256, canonical: requireCanonical, platform: `${process.platform}-${process.arch}` }, activation: {}, pins: {} };
  if (requireCanonical) {
    receipt.github = { repository: process.env.GITHUB_REPOSITORY, runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), headSha: process.env.GITHUB_SHA, workflowRef: process.env.GITHUB_WORKFLOW_REF };
    const g = receipt.github;
    if (g.repository !== 'redact-secret/redact-secret-benchmarks' || !Number.isSafeInteger(g.runId) || g.runId <= 0 || g.runAttempt !== 1 || !/^[a-f0-9]{40}$/.test(g.headSha ?? '') || !/^redact-secret\/redact-secret-benchmarks\/\.github\/workflows\/pii-official-run\.yml@refs\/heads\/.+$/.test(g.workflowRef ?? '')) throw new Error('canonical-github-execution-identity-missing');
  }
  const artifacts = [], template = read(join(ROOT, 'benchmarks/pii-eval-population-pins.json'));
  for (const side of SIDES) {
    const installation = await installCandidate(tarballs[side]);
    try {
      const packageDir = join(installation.root, 'node_modules/@redact-secret/core');
      const nodeName = `node-${process.platform}-${process.arch}${process.platform === 'linux' ? '-gnu' : ''}`;
      const addonDir = join(installation.root, 'node_modules/@redact-secret', nodeName), wasmDir = join(installation.root, 'node_modules/@redact-secret/wasm');
      if (installation.declaredVersion !== plan[side].version) throw new Error('installed product version mismatch');
      const packageTreeSha256 = treeSha256(packageDir), addonTreeSha256 = treeSha256(addonDir), wasmTreeSha256 = treeSha256(wasmDir);
      receipt[side] = { sourceCommit: plan[side].sourceCommit, version: installation.declaredVersion, packageTreeSha256, addonTreeSha256, wasmTreeSha256, nativePackageProvenance: side === 'baseline' ? 'published-npm-lockfile' : process.platform === 'linux' ? 'qualified-inventory-whole-package' : 'local-repacked-qualified-payloads', tarballs: Object.fromEntries(Object.entries(tarballs[side]).map(([key, file]) => [key, sha(readFileSync(file))])), tarballIntegrity: Object.fromEntries(Object.entries(tarballs[side]).map(([key, file]) => [key, 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64')])) };
      receipt.activation[side] = captureActivation({ node, packageDir, addonDir });
      const pins = structuredClone(template); pins.build.binarySha256 = binarySha256;
      const ctx = buildConversion(); ctx.candidate = { ...ctx.candidate, version: installation.declaredVersion, artifactSetCommitment: packageTreeSha256 };
      for (const bucket of ctx.populations) {
        const population = plan.populations.find(p => p.view === bucket.view), snapshot = snapshotFor(bucket, ctx), roster = rosterFor(bucket), manifest = manifestFor(snapshot, ctx);
        if (snapshot.semanticDigest !== population.snapshotDigest) throw new Error('frozen public population changed');
        const dir = join(out, side, bucket.view); mkdirSync(dir, { recursive: true });
        for (const [name, body] of Object.entries({ snapshot, manifest, roster })) writeFileSync(join(dir, `${name}.json`), json(body));
        const config = { schema: 'pii-eval-run-config/1', mode: plan.mode, runClass: 'public-synthetic', product: 'candidate', engineVersion: '0.0.0', protocol: { id: plan.protocol.id, revision: plan.protocol.revision },
          snapshot: { path: join(dir, 'snapshot.json'), semanticDigest: snapshot.semanticDigest }, manifest: { path: join(dir, 'manifest.json'), semanticDigest: manifest.semanticDigest },
          scanners: [{ adapter: 'redact-secret-core', node, shim: { path: shim }, package: { dir: packageDir, entry: 'dist/index.js', version: installation.declaredVersion, treeSha256: packageTreeSha256 }, extraArtifacts: [{ path: addonDir, target: 'tree', sha256: addonTreeSha256 }, { path: wasmDir, target: 'tree', sha256: wasmTreeSha256 }] }],
          host: { maxWorkers: 2, resources: 'enforce' }, output: { dir: join(dir, 'run'), overwrite: 'refuse' }, projection: { roster: { path: join(dir, 'roster.json'), rosterDigest: population.rosterDigest } } };
        const configFile = join(dir, 'config.json'); writeFileSync(configFile, json(config)); command(engine, ['run', '--config', configFile]);
        const file = join(dir, 'run/public-synthetic-artifact.json'); command(engine, ['validate', file, '--snapshot', join(dir, 'snapshot.json'), '--projection-roster', join(dir, 'roster.json')]);
        command(engine, ['validate', join(dir, 'run/run-artifact.json'), '--snapshot', join(dir, 'snapshot.json'), '--manifest', join(dir, 'manifest.json')]);
        const text = readFileSync(file, 'utf8'), doc = parseStrictJson(text), pin = pins.populations.find(p => p.label === bucket.view);
        if (semanticDigest(doc) !== doc.semanticDigest) throw new Error('artifact digest mismatch');
        pin.artifactDigest = doc.semanticDigest; pin.manifestDigest = manifest.semanticDigest; pin.retiredArtifactDigests = []; pin.retiredManifestDigests = []; pin.projection.mode = plan.mode;
        pin.scanners = [{ ...pin.scanners[0], scannerVersion: installation.declaredVersion, artifactDigest: packageTreeSha256, product: { kind: 'candidate', candidateDigest: packageTreeSha256 }, candidateSourceCommit: plan[side].sourceCommit }];
        artifacts.push({ side, view: bucket.view, text }); writeFileSync(join(out, `${side}.${bucket.view}.public-synthetic-artifact.json`), text);
      }
      receipt.pins[side] = pins;
    } finally { await removeCandidate(installation); }
  }
  receipt.durationMs = Date.now() - started;
  const summary = loadPiiCandidateComparison({ plan, receipt, artifacts, allowUnrecordedOfficial: true });
  if (summary.state !== 'recorded') throw new Error(`strict consumer: ${summary.reason}`);
  writeFileSync(join(out, 'plan.json'), json(plan)); writeFileSync(join(out, 'receipt.json'), json(receipt)); writeFileSync(join(out, 'summary.json'), json(summary));
  return { receipt, summary };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const value = process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3); if (!value) throw new Error(`missing --${name}=`); return resolve(value); };
  const result = await runComparison({ engine: arg('engine'), shim: arg('shim'), node: arg('node'), inventory: arg('candidate-inventory'), out: arg('out'), requireCanonical: process.argv.includes('--require-canonical'), tarballs: Object.fromEntries(SIDES.map(side => [side, Object.fromEntries(['core', 'node', 'wasm'].map(key => [key, arg(`${side}-${key}`)]))])) });
  console.log(JSON.stringify({ state: result.summary.state, populations: result.summary.populations.length, mode: result.summary.mode, supportClaims: false }));
}
