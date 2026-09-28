import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { piiProfileCostCommitment, piiProfileCostPlan, piiProfileCostSchedule, piiProfileCostWorkloads,
  assertPiiProfileCostPublicEvidenceSafe, validatePiiProfileCostPlan, validatePiiProfileCostThresholds,
  evaluatePiiProfileCostCandidate, validatePiiProfileCostCandidateReport,
  validatePiiProfileCostWorkloads } from '../benchmarks/evaluation/domains/pii/profile-cost-v2.ts';
import { digest, exact, parseAdapterSample, sha256, verifyImplementationFreeze } from './pii-profile-cost/adapter-protocol.mjs';

await verifyImplementationFreeze(piiProfileCostPlan);

const rawArgs = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(rawArgs, match[1])) throw new Error('Invalid PII profile-cost arguments');
  rawArgs[match[1]] = match[2];
}
if (!['aa', 'candidate'].includes(rawArgs.mode) || !rawArgs.config || !rawArgs.output || !rawArgs['run-id'])
  throw new Error('Required: --mode=aa|candidate --config=<json> --output=<json> --run-id=<stable-id>');
if (rawArgs.mode === 'candidate' && !rawArgs.thresholds) throw new Error('Candidate measurement requires pre-frozen thresholds');
if (rawArgs.mode === 'aa' && rawArgs.thresholds) throw new Error('A/A measurement must precede threshold freeze');
validatePiiProfileCostPlan(); validatePiiProfileCostWorkloads();
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawArgs['run-id'])) throw new Error('Invalid PII profile-cost run id');

const configPath = path.resolve(rawArgs.config), outputPath = path.resolve(rawArgs.output);
const config = JSON.parse(await readFile(configPath, 'utf8'));
const expectedSurfaceIds = piiProfileCostPlan.surfaces.map(row => row.id);
if (!exact(config, ['schemaVersion', 'sourceCommit', 'producer', 'qualification', 'productCheckout', 'artifacts', 'surfaces', 'configCommitment']) || config.schemaVersion !== 1 ||
    config.sourceCommit !== piiProfileCostPlan.inputs.candidateProductCommit || !Array.isArray(config.artifacts) ||
    config.artifacts.some(row => !exact(row, ['id', 'sha256']) || typeof row.id !== 'string' || !digest(row.sha256)) ||
    JSON.stringify(config.surfaces.map(row => row.id)) !== JSON.stringify(expectedSurfaceIds) ||
    config.configCommitment !== piiProfileCostCommitment(Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'configCommitment'))))
  throw new Error('Invalid PII profile-cost adapter configuration');
if (JSON.stringify(config.qualification) !== JSON.stringify({ candidateRun: piiProfileCostPlan.inputs.candidateQualificationRun,
    candidateInventorySha256: piiProfileCostPlan.inputs.candidateInventorySha256 }) ||
    !exact(config.productCheckout, ['path', 'commit'])) throw new Error('Invalid PII profile-cost qualification binding');
const officialProducer = piiProfileCostPlan.implementationFreeze.files.find(row => row.path === 'scripts/prepare-pii-profile-cost-linux-v2.mjs');
if (!officialProducer || JSON.stringify(config.producer) !== JSON.stringify({ id: 'prepare-pii-profile-cost-linux-v2', sha256: officialProducer.sha256 }) ||
    sha256(await readFile(path.resolve('scripts/prepare-pii-profile-cost-linux-v2.mjs'))) !== officialProducer.sha256)
  throw new Error('Invalid PII profile-cost configuration producer');
for (const surface of config.surfaces) {
  if (!exact(surface, ['id', 'cwd', 'executable', 'args', 'definitionFiles', 'definitionCommitment', 'artifactIds', 'credentialProfiles']) ||
      typeof surface.cwd !== 'string' ||
      !exact(surface.executable, ['path', 'sha256']) || typeof surface.executable.path !== 'string' || !digest(surface.executable.sha256) ||
      sha256(await readFile(path.resolve(surface.executable.path))) !== surface.executable.sha256 || !Array.isArray(surface.args) ||
      surface.args.some(value => typeof value !== 'string') || !Array.isArray(surface.definitionFiles) ||
      surface.definitionFiles.some(row => !exact(row, ['role', 'path', 'sha256']) || typeof row.role !== 'string' ||
        typeof row.path !== 'string' || !digest(row.sha256)) ||
      !Array.isArray(surface.artifactIds) || surface.artifactIds.some(id => !config.artifacts.some(row => row.id === id)) ||
      JSON.stringify(surface.credentialProfiles) !== JSON.stringify(piiProfileCostPlan.surfaces.find(row => row.id === surface.id).credentialProfiles))
    throw new Error(`Invalid PII profile-cost adapter identity: ${surface.id}`);
  for (const file of surface.definitionFiles)
    if (sha256(await readFile(path.resolve(file.path))) !== file.sha256) throw new Error(`PII profile-cost adapter file drift: ${surface.id}/${file.role}`);
  if (surface.definitionCommitment !== piiProfileCostCommitment({ cwd: path.resolve(surface.cwd), executableSha256: surface.executable.sha256, args: surface.args,
      files: surface.definitionFiles.map(row => ({ role: row.role, sha256: row.sha256 })) }))
    throw new Error(`Invalid PII profile-cost adapter commitment: ${surface.id}`);
}

let thresholds = null;
if (rawArgs.thresholds) {
  thresholds = validatePiiProfileCostThresholds(JSON.parse(await readFile(path.resolve(rawArgs.thresholds), 'utf8')));
  if (thresholds.aaProvenance.configCommitment !== config.configCommitment ||
      thresholds.aaProvenance.benchmarkCommit !== process.env.GITHUB_SHA || thresholds.freezeProvenance.kind !== 'github-actions' ||
      thresholds.freezeProvenance.job !== 'freeze' || thresholds.freezeProvenance.event !== 'workflow_dispatch' ||
      !/^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost-v2\.yml@/.test(thresholds.freezeProvenance.workflowRef ?? '') ||
      thresholds.freezeProvenance.benchmarkCommit !== process.env.GITHUB_SHA)
    throw new Error('PII profile-cost thresholds were frozen for a different implementation or artifact configuration');
}

function materializeWorkload(definition) {
  const lines = Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) => definition.lines[index % definition.lines.length]);
  const text = `${lines.join('\n')}\n`, chunks = [];
  for (let index = 0; index < text.length; index += piiProfileCostWorkloads.generator.chunkCodeUnits)
    chunks.push(text.slice(index, index + piiProfileCostWorkloads.generator.chunkCodeUnits));
  return { text, chunks, commitment: sha256(text), bytes: Buffer.byteLength(text) };
}
const workloads = piiProfileCostWorkloads.workloads.map(definition => ({ id: definition.id, ...materializeWorkload(definition) }));
const filter = rawArgs.filter ?? null;
const official = filter === null;
if (official) {
  const git = (cwd, ...arguments_) => execFileSync('git', arguments_, { cwd, encoding: 'utf8' }).trim();
  const benchmarkHead = git(process.cwd(), 'rev-parse', 'HEAD');
  const expectedArtifacts = ['browser-common-wasm', 'browser-full-wasm', 'candidate-inventory', 'cli-linux-x64', 'node-forced-wasm',
    'node-native', 'python-wheel-install', 'rust-release-helper'];
  if (JSON.stringify(config.artifacts.map(row => row.id).sort()) !== JSON.stringify(expectedArtifacts) ||
      new Set(config.artifacts.map(row => row.sha256)).size < 6 ||
      process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== 'redact-secret/redact-secret-benchmarks' ||
      process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_JOB !== 'runtime' ||
      !/^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost-v2\.yml@/.test(process.env.GITHUB_WORKFLOW_REF ?? '') ||
      !/^\d+$/.test(process.env.GITHUB_RUN_ID ?? '') || process.env.GITHUB_SHA !== benchmarkHead || git(process.cwd(), 'status', '--porcelain') !== '' ||
      git(config.productCheckout.path, 'rev-parse', 'HEAD') !== config.productCheckout.commit ||
      config.productCheckout.commit !== piiProfileCostPlan.inputs.candidateProductCommit || git(config.productCheckout.path, 'status', '--porcelain') !== '')
    throw new Error('Full-matrix PII profile-cost measurement requires clean exact official GitHub Actions checkouts');
}
const developmentSamples = rawArgs['development-samples'] === undefined ? null : Number(rawArgs['development-samples']);
if ((developmentSamples !== null && filter === null) || (developmentSamples === null && rawArgs['development-samples'] !== undefined))
  throw new Error('Underpowered sample counts are allowed only for filtered development');
const schedule = piiProfileCostSchedule(developmentSamples ?? piiProfileCostPlan.sampleProtocol.minimumSamplesPerSide,
  developmentSamples !== null);
const startedAt = new Date().toISOString();
if (thresholds && thresholds.frozenAt >= startedAt) throw new Error('PII profile-cost thresholds must be frozen before candidate measurement');

async function observe(surface, credentialProfile, profile, workload) {
  const sides = { reference: [], comparison: [] };
  let transientRetries = 0;
  const attempt = async step => {
    const selected = rawArgs.mode === 'aa' ? profile : step.side === 'off' ? piiProfileCostPlan.piiProfiles[0] : profile;
    const selectors = selected.selectors.length ? selected.selectors.join(',') : 'off';
    const expectedActivation = `credentials=${credentialProfile};selectors=${selectors};families=${selected.families.join(',')};vocabulary=${piiProfileCostPlan.inputs.contextVocabulary}`;
    const expectedArtifact = surface.id === 'node-native' ? 'addon' : ['node-wasm', 'chromium-wasm'].includes(surface.id) ? 'wasm' : 'compiled';
    const input = { credentialProfile, selectors: selected.selectors, expectedActivation, expectedArtifact,
      workloadBase64: Buffer.from(workload.text).toString('base64url'),
      chunksBase64: workload.chunks.map(chunk => Buffer.from(chunk).toString('base64url')) };
    const child = spawn(surface.executable.path, surface.args, { cwd: path.resolve(surface.cwd), stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', TMPDIR: process.env.TMPDIR ?? '', NO_COLOR: '1' } });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 64 * 1024) child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 64 * 1024) child.kill('SIGKILL'); });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 120_000);
    child.stdin.end(`${JSON.stringify(input)}\n`);
    const outcome = await new Promise((resolve, reject) => { child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal })); });
    clearTimeout(timeout);
    // A non-zero exit or kill signal here means the launch itself did not complete -- not that a produced
    // measurement was wrong. `parseAdapterSample` below still runs unretried: a shape/identity failure on a
    // completed process is a real defect, never a transient launch failure.
    if (outcome.code !== 0 || outcome.signal !== null)
      return { ok: false, code: outcome.code, signal: outcome.signal, stderr: stderr.slice(0, 4096), stdout: stdout.slice(0, 1024) };
    return { ok: true, sample: parseAdapterSample(stdout, stderr) };
  };
  const sample = async step => {
    const limit = piiProfileCostPlan.sampleProtocol.transientRetryLimit;
    for (let retry = 0; ; retry++) {
      const outcome = await attempt(step);
      if (outcome.ok) return outcome.sample;
      if (retry >= limit) throw new Error(`PII profile-cost adapter failed: ${surface.id} (after ${retry + 1} attempts; ` +
        `last code=${outcome.code} signal=${outcome.signal} stderr=${JSON.stringify(outcome.stderr)} stdout=${JSON.stringify(outcome.stdout)})`);
      transientRetries++;
    }
  };
  const warmups = piiProfileCostSchedule(piiProfileCostPlan.sampleProtocol.warmupSamples, true);
  for (const step of warmups) await sample(step);
  for (const step of schedule) {
    const label = step.side === 'off' ? 'reference' : 'comparison';
    sides[label].push(await sample(step));
  }
  return { surface: surface.id, credentialProfile, profile: profile.id, workload: workload.id,
    workloadCommitment: workload.commitment, workloadBytes: workload.bytes, samplesPerSide: schedule.length / 2, transientRetries, sides };
}

const observations = [];
for (const surface of config.surfaces) for (const credentialProfile of surface.credentialProfiles)
  for (const profile of piiProfileCostPlan.piiProfiles.filter(row => row.id !== 'off')) for (const workload of workloads)
    if (filter === null || `${surface.id}/${credentialProfile}/${profile.id}/${workload.id}` === filter)
      observations.push(await observe(surface, credentialProfile, profile, workload));
if (!observations.length) throw new Error('PII profile-cost filter selected no cells');

const derived = thresholds ? evaluatePiiProfileCostCandidate(observations, thresholds) : null;

const projection = { schemaVersion: 1, reportType: rawArgs.mode === 'aa' ? 'pii-profile-cost-aa' : 'pii-profile-cost-candidate',
  supportClaims: false, planCommitment: piiProfileCostPlan.contentCommitment, workloadCommitment: piiProfileCostWorkloads.contentCommitment,
  sourceCommit: config.sourceCommit, mode: rawArgs.mode, runId: rawArgs['run-id'],
  selection: { scope: filter === null ? 'full-matrix' : 'filtered-development', filter },
  runner: { platform: process.platform, arch: process.arch, node: process.version, cpuModel: rawArgs['cpu-model'] ?? os.cpus()[0]?.model ?? null },
  provenance: official ? { kind: 'github-actions', repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB, event: process.env.GITHUB_EVENT_NAME,
    workflowRef: process.env.GITHUB_WORKFLOW_REF, benchmarkCommit: process.env.GITHUB_SHA,
    configCommitment: config.configCommitment } : { kind: 'local-development', configCommitment: config.configCommitment },
  startedAt, completedAt: new Date().toISOString(),
  artifactCommitments: config.artifacts, adapterCommitments: config.surfaces.map(row => ({ surface: row.id, sha256: row.definitionCommitment })),
  ...(derived ?? {}), observations };
const report = { ...projection, artifactCommitment: piiProfileCostCommitment(projection) };
assertPiiProfileCostPublicEvidenceSafe(report);
if (official && thresholds) validatePiiProfileCostCandidateReport(report, thresholds);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.artifactCommitment} ${report.reportType} ${observations.length} cells`);
