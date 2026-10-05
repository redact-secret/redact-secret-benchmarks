#!/usr/bin/env node
/**
 * Fetch one immutable pii-eval public-synthetic run through a read-only GitHub
 * App installation token. This verifies transport identity before passing the
 * public document to the benchmark-owned semantic consumer. It never executes
 * the downloaded engine and never produces a support verdict.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { consume, loadPins, parseStrictJson } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

export function validateSource(source, pins) {
  if (!exactKeys(source, ['schema', 'environment', 'supportClaims', 'app', 'repository', 'workflow', 'artifacts', 'buildInfo', 'durableCopy', 'publicArtifactMember', 'pins']) ||
      source.schema !== 'redact-secret-benchmarks.pii-eval-artifact-source/1' || source.environment !== 'staging' || source.supportClaims !== false)
    fail('Invalid pii-eval artifact source document');
  if (!exactKeys(source.app, ['id', 'owner', 'repository', 'secret', 'permissions']) || source.app.id !== '5178533' ||
      source.app.owner !== 'redact-secret' || source.app.repository !== 'pii-eval' || source.app.secret !== 'PII_EVAL_APP_PRIVATE_KEY' ||
      JSON.stringify(source.app.permissions) !== JSON.stringify({ actions: 'read', contents: 'read' })) fail('Invalid GitHub App transport identity');
  if (!exactKeys(source.repository, ['fullName', 'id']) || source.repository.fullName !== 'redact-secret/pii-eval' ||
      !Number.isSafeInteger(source.repository.id)) fail('Invalid source repository identity');
  if (!exactKeys(source.workflow, ['id', 'path', 'event', 'branch', 'runId', 'runAttempt', 'headSha', 'conclusion']) ||
      !Number.isSafeInteger(source.workflow.id) || source.workflow.path !== '.github/workflows/ci.yml' || source.workflow.event !== 'push' ||
      source.workflow.branch !== 'main' || !Number.isSafeInteger(source.workflow.runId) || source.workflow.runAttempt !== 1 ||
      !HEX40.test(source.workflow.headSha) || source.workflow.conclusion !== 'success') fail('Invalid source workflow identity');
  if (!exactKeys(source.artifacts, ['engine', 'measurement'])) fail('Invalid source artifact set');
  for (const [role, artifact] of Object.entries(source.artifacts)) {
    if (!exactKeys(artifact, ['id', 'name', 'sizeInBytes', 'archiveSha256', 'expiresAt', 'members']) ||
        !Number.isSafeInteger(artifact.id) || typeof artifact.name !== 'string' || !artifact.name ||
        !Number.isSafeInteger(artifact.sizeInBytes) || artifact.sizeInBytes <= 0 || !HEX64.test(artifact.archiveSha256) ||
        !Number.isFinite(Date.parse(artifact.expiresAt)) || !exactKeys(artifact.members, Object.keys(artifact.members)) ||
        !Object.keys(artifact.members).length || Object.entries(artifact.members).some(([name, digest]) => unsafeMember(name) || !HEX64.test(digest)))
      fail(`Invalid ${role} artifact identity`);
  }
  if (!exactKeys(source.buildInfo, ['binaryBytes', 'binaryVersion', 'target', 'rustc', 'rustToolchainFileSha256']) || !Number.isSafeInteger(source.buildInfo.binaryBytes) ||
      source.buildInfo.binaryBytes <= 0 || typeof source.buildInfo.binaryVersion !== 'string' || source.buildInfo.target !== 'linux-x86_64' ||
      typeof source.buildInfo.rustc !== 'string' || !HEX64.test(source.buildInfo.rustToolchainFileSha256)) fail('Invalid engine build-info pin');
  if (!exactKeys(source.durableCopy, ['path', 'member']) || source.durableCopy.member !== 'run/public-synthetic-artifact.json' ||
      typeof source.durableCopy.path !== 'string' || !/^tests\/fixtures\/pii-eval\/[A-Za-z0-9._-]+\.json$/.test(source.durableCopy.path)) fail('Invalid durable copy pin');
  if (source.publicArtifactMember !== 'run/public-synthetic-artifact.json' ||
      !Object.hasOwn(source.artifacts.measurement.members, source.publicArtifactMember)) fail('Invalid public artifact member');
  if (source.workflow.headSha !== pins.build.commit || pins.build.repository !== source.repository.fullName ||
      source.artifacts.engine.members['pii-eval'] !== pins.build.binarySha256 ||
      source.artifacts.engine.members['build-info.json'] === undefined) fail('Transport pins do not bind the semantic consumer pins');
  return source;
}

function unsafeMember(name) {
  return typeof name !== 'string' || name.length === 0 || name.includes('\\') || name.startsWith('/') ||
    name.split('/').some(part => part === '' || part === '.' || part === '..');
}

export function verifyRunMetadata(run, source) {
  const want = source.workflow;
  if (run?.id !== want.runId || run?.run_attempt !== want.runAttempt || run?.workflow_id !== want.id || run?.path !== want.path ||
      run?.event !== want.event || run?.head_branch !== want.branch || run?.head_sha !== want.headSha || run?.status !== 'completed' ||
      run?.conclusion !== want.conclusion || run?.repository?.id !== source.repository.id || run?.repository?.full_name !== source.repository.fullName ||
      run?.head_repository?.id !== source.repository.id || run?.head_repository?.full_name !== source.repository.fullName)
    fail('GitHub Actions run does not match the immutable source pin');
}

export function verifyArtifactMetadata(actual, expected, now = Date.now()) {
  const digest = `sha256:${expected.archiveSha256}`;
  if (actual?.id !== expected.id || actual?.name !== expected.name || actual?.size_in_bytes !== expected.sizeInBytes ||
      actual?.digest !== digest || actual?.expired !== false || actual?.expires_at !== expected.expiresAt ||
      Date.parse(expected.expiresAt) <= now) fail(`GitHub Actions artifact does not match the immutable pin: ${expected.name}`);
}

export function verifyArchiveMembers(zipFile, expected) {
  const listed = execFileSync('unzip', ['-Z1', zipFile], { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim().split('\n').filter(Boolean);
  const wanted = Object.keys(expected.members).sort();
  if (listed.some(unsafeMember) || new Set(listed).size !== listed.length || JSON.stringify([...listed].sort()) !== JSON.stringify(wanted))
    fail(`Archive member set differs from its pin: ${expected.name}`);
  const members = {};
  for (const name of wanted) {
    const bytes = execFileSync('unzip', ['-p', zipFile, name], { encoding: null, maxBuffer: 40 * 1024 * 1024 });
    if (sha256(bytes) !== expected.members[name]) fail(`Archive member digest differs from its pin: ${expected.name}/${name}`);
    members[name] = bytes;
  }
  return members;
}

export function verifyBuildInfo(members, source, pins) {
  const info = parseStrictJson(members['build-info.json'].toString('utf8'));
  const expected = {
    binary: { bytes: source.buildInfo.binaryBytes, name: 'pii-eval', sha256: pins.build.binarySha256, version: source.buildInfo.binaryVersion },
    commit: pins.build.commit,
    event: source.workflow.event,
    headSha: source.workflow.headSha,
    ref: `refs/heads/${source.workflow.branch}`,
    repository: source.repository.fullName,
    runAttempt: String(source.workflow.runAttempt),
    runId: String(source.workflow.runId),
    schema: 'pii-eval-build-info/1',
    target: source.buildInfo.target,
    toolchain: {
      cargoLockSha256: pins.build.cargoLockSha256,
      rustToolchainFileSha256: source.buildInfo.rustToolchainFileSha256,
      rustc: source.buildInfo.rustc,
    },
  };
  if (JSON.stringify(info) !== JSON.stringify(expected)) fail('Engine build-info differs from the immutable pin');
  const sums = members.SHA256SUMS.toString('utf8');
  const expectedSums = `${source.artifacts.engine.members['build-info.json']}  build-info.json\n${pins.build.binarySha256}  pii-eval\n`;
  if (sums !== expectedSums) fail('Engine SHA256SUMS does not bind the pinned build members');
}

function ghJson(endpoint) {
  return JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
}

function fetchZip(repository, artifact, directory) {
  const bytes = execFileSync('gh', ['api', `/repos/${repository}/actions/artifacts/${artifact.id}/zip`],
    { encoding: null, maxBuffer: 40 * 1024 * 1024 });
  if (sha256(bytes) !== artifact.archiveSha256) fail(`Downloaded archive digest differs from its pin: ${artifact.name}`);
  const file = path.join(directory, `${artifact.id}.zip`);
  writeFileSync(file, bytes, { mode: 0o600 });
  return file;
}

export function checkFiles(sourceFile, pinsFile) {
  const pins = loadPins(readFileSync(pinsFile, 'utf8'));
  const source = validateSource(JSON.parse(readFileSync(sourceFile, 'utf8')), pins);
  if (path.resolve(ROOT, source.pins) !== path.resolve(pinsFile)) fail('Source document names another consumer pin file');
  // The committed copy of the pinned public artifact outlives the Actions artifact (14 days). It is the same bytes by digest and
  // is judged by the same consumer, so a pin can always be re-verified offline; it is never a substitute for transport.
  const copy = readFileSync(path.resolve(ROOT, source.durableCopy.path));
  if (sha256(copy) !== source.artifacts.measurement.members[source.durableCopy.member]) fail('The committed copy is not the pinned public artifact');
  const report = consume(pins, [{ name: path.basename(source.durableCopy.path), text: copy.toString('utf8') }]);
  if (!report.complete) fail(`The committed copy does not pass the semantic consumer: ${JSON.stringify(report.rejections)}`);
  return { source, pins };
}

export function fetchPinnedArtifact({ sourceFile, pinsFile, outDir }) {
  if (!process.env.GH_TOKEN) fail('GH_TOKEN is required');
  const { source, pins } = checkFiles(sourceFile, pinsFile);
  const run = ghJson(`/repos/${source.repository.fullName}/actions/runs/${source.workflow.runId}`);
  verifyRunMetadata(run, source);
  const inventory = ghJson(`/repos/${source.repository.fullName}/actions/runs/${source.workflow.runId}/artifacts?per_page=100`);
  if (!Array.isArray(inventory.artifacts)) fail('GitHub artifact inventory is malformed');
  mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const archives = {};
  for (const [role, expected] of Object.entries(source.artifacts)) {
    const matches = inventory.artifacts.filter(item => item.id === expected.id);
    if (matches.length !== 1) fail(`Pinned ${role} artifact is missing or duplicated`);
    verifyArtifactMetadata(matches[0], expected);
    const zipFile = fetchZip(source.repository.fullName, expected, outDir);
    archives[role] = verifyArchiveMembers(zipFile, expected);
  }
  verifyBuildInfo(archives.engine, source, pins);
  const publicBytes = archives.measurement[source.publicArtifactMember];
  const report = consume(pins, [{ name: path.basename(source.publicArtifactMember), text: publicBytes.toString('utf8') }]);
  if (!report.complete) fail(`Public artifact semantic validation failed: ${JSON.stringify(report.rejections)}`);
  const artifactFile = path.join(outDir, 'public-synthetic-artifact.json');
  writeFileSync(artifactFile, publicBytes, { mode: 0o600 });
  const receipt = {
    schema: 'redact-secret-benchmarks.pii-eval-transport-receipt/1', environment: 'staging', supportClaims: false,
    repository: source.repository, workflow: source.workflow,
    artifacts: Object.fromEntries(Object.entries(source.artifacts).map(([role, artifact]) => [role,
      { id: artifact.id, name: artifact.name, archiveSha256: artifact.archiveSha256, expiresAt: artifact.expiresAt }])),
    publicArtifact: { member: source.publicArtifactMember, bytesSha256: sha256(publicBytes), semanticDigest: report.populations[0].artifactDigest },
    engineExecuted: false,
  };
  writeFileSync(path.join(outDir, 'transport-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `artifact=${artifactFile}\npins=${pinsFile}\n`, { flag: 'a' });
  return receipt;
}

/**
 * Fetch and verify only the pinned engine artifact (#665 linux replay) and write its verified binary. The measurement artifact
 * is not needed (and expires sooner), so this does not read it. The binary is verified by archive, member and build-info digests;
 * the caller runs it in a later step that holds no token.
 */
export function fetchPinnedEngine({ sourceFile, pinsFile, outDir }) {
  if (!process.env.GH_TOKEN) fail('GH_TOKEN is required');
  const { source, pins } = checkFiles(sourceFile, pinsFile);
  const run = ghJson(`/repos/${source.repository.fullName}/actions/runs/${source.workflow.runId}`);
  verifyRunMetadata(run, source);
  const inventory = ghJson(`/repos/${source.repository.fullName}/actions/runs/${source.workflow.runId}/artifacts?per_page=100`);
  if (!Array.isArray(inventory.artifacts)) fail('GitHub artifact inventory is malformed');
  const expected = source.artifacts.engine;
  const matches = inventory.artifacts.filter(item => item.id === expected.id);
  if (matches.length !== 1) fail('Pinned engine artifact is missing or duplicated');
  verifyArtifactMetadata(matches[0], expected);
  mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const members = verifyArchiveMembers(fetchZip(source.repository.fullName, expected, outDir), expected);
  verifyBuildInfo(members, source, pins);
  const binary = path.join(outDir, 'pii-eval');
  writeFileSync(binary, members['pii-eval'], { mode: 0o700 });
  if (sha256(members['pii-eval']) !== pins.build.binarySha256) fail('Engine binary digest differs from the pin');
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `engine=${binary}\n`, { flag: 'a' });
  return { engine: binary, binarySha256: pins.build.binarySha256, artifactId: expected.id, runId: source.workflow.runId, headSha: source.workflow.headSha, engineExecuted: false };
}

function option(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function main() {
  const command = process.argv[2];
  const sourceFile = path.resolve(option('source', path.join(ROOT, 'benchmarks/pii-eval-public-synthetic-source.json')));
  const pinsFile = path.resolve(option('pins', path.join(ROOT, 'benchmarks/pii-eval-public-synthetic-pins.json')));
  if (command === 'check') {
    const { source } = checkFiles(sourceFile, pinsFile);
    process.stdout.write(`${source.repository.fullName}@${source.workflow.headSha} run ${source.workflow.runId} is internally consistent\n`);
    return;
  }
  if (command !== 'fetch' && command !== 'fetch-engine') fail('Usage: fetch-pii-eval-public-synthetic.mjs check|fetch|fetch-engine [--source=FILE] [--pins=FILE] [--out=DIR]');
  const outDir = path.resolve(option('out', path.join(process.cwd(), 'pii-eval-public')));
  if (command === 'fetch-engine') {
    process.stdout.write(`${JSON.stringify(fetchPinnedEngine({ sourceFile, pinsFile, outDir }))}\n`);
    return;
  }
  const receipt = fetchPinnedArtifact({ sourceFile, pinsFile, outDir });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
