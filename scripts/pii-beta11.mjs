/**
 * Beta.11 PII E (benchmarks #428, core #901): freeze and measure one exact core commit for the six-family `pii-v1`
 * disposition. One command, run twice with a commit in between:
 *
 *   npm run pii:beta11 -- --core-commit=<40-hex> --core-repo=<absolute path to a redact-secret clone> --role=interim|final
 *
 * 1. No committed freeze for that commit yet: build the candidate from a temporary detached worktree (the core
 *    `benchmark-candidate` recipe plus the maintainer-local identity example of redact-secret#910), build the
 *    evidence/879 operational baseline, fetch the commit's CI artifact-qualification inventory when it exists, and
 *    write `evidence/901/428/core-<sha12>/pii-beta11-freeze-v1.json`. It then stops: commit the freeze.
 * 2. Freeze committed and the tree clean: verify every frozen hash, observe every frozen case on the installed Node
 *    addon and forced Wasm under every selection (candidate and the lockfile beta.10 release), run the identity seam
 *    on the six oracle plans, measure runtime and artifact size, and write the observation, operational and report
 *    files plus the six-row disposition next to the freeze.
 *
 * Nothing written carries an input, candidate value or sanitized text: case ids, UTF-8 ranges, booleans, counts and
 * digests only. The protected partition is never read here.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { B11_CANDIDATE, B11_FAMILIES, B11_SELECTIONS, activationProblem, b11CaseTables, b11ObservedRanges, b11Selectors,
  b11EvidenceCommitment, b11Commitment } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { B11_FREEZE_FILES, B11_BASELINE_879, b11ProtectedEpochs, buildB11Report, buildB11Disposition, b11WasmRole,
  b11SizeBudgetRows } from '../benchmarks/evaluation/domains/pii/beta11-disposition.ts';
import { PII_PRODUCT_IDENTITY_FORMAT, PII_ORACLE_PLANS } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { piiArrivalCommitment } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { packLockfileRelease } from './observe-pii-populations.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(core-commit|core-repo|role|work|samples)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unknown argument ${argument}`); return [match[1], match[2]];
}));
if (!/^[0-9a-f]{40}$/.test(args['core-commit'] ?? '') || !path.isAbsolute(args['core-repo'] ?? '') || !['interim', 'final'].includes(args.role))
  throw new Error('Usage: npm run pii:beta11 -- --core-commit=<40-hex> --core-repo=<absolute path> --role=interim|final [--work=<absolute dir>]');
const commit = args['core-commit'], sha12 = commit.slice(0, 12);
const workRoot = path.resolve(args.work ?? path.join(root, 'results-output/pii-beta11'));
const work = path.join(workRoot, `core-${sha12}`);
const evidenceDir = path.join(root, 'evidence/901/428', `core-${sha12}`);
const freezeFile = path.join(evidenceDir, 'pii-beta11-freeze-v1.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileSha256 = async file => sha256(await readFile(file));
const run = async (command, argv, options = {}) => (await exec(command, argv, { maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60_000,
  ...options, env: { ...process.env, npm_config_update_notifier: 'false', ...(options.env ?? {}) } })).stdout;
const git = (...argv) => run('git', argv, { cwd: root }).then(value => value.trim());
const writeJson = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); };
const nodePackage = () => ({ 'darwin-arm64': 'darwin-arm64', 'darwin-x64': 'darwin-x64', 'linux-x64': 'linux-x64-gnu', 'linux-arm64': 'linux-arm64-gnu' })[`${process.platform}-${process.arch}`];

async function payloads(tarball) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pii-b11-wasm-'));
  try {
    await run('tar', ['-xzf', tarball, '-C', directory]);
    const rows = [];
    for (const name of (await readdir(path.join(directory, 'package'))).filter(file => file.endsWith('.wasm')).sort()) {
      const bytes = await readFile(path.join(directory, 'package', name));
      rows.push({ file: name, role: b11WasmRole(name), sha256: sha256(bytes), raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length,
        brotli: brotliCompressSync(bytes, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length });
    }
    return rows;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
async function artifactRow(file) { const bytes = await readFile(file); return { file: path.basename(file), sha256: sha256(bytes), bytes: bytes.length }; }

/** The core repository's candidate recipe (#427 harness / core `benchmark-candidate`), plus a PII Wasm build when the commit has one. */
async function buildProduct(sourceCommit, target, { example }) {
  const checkout = path.join(target, 'core');
  await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
  await run('git', ['-C', args['core-repo'], 'fetch', '--quiet', 'origin', sourceCommit]).catch(() => {});
  await run('git', ['-C', args['core-repo'], 'worktree', 'add', '--detach', checkout, sourceCommit]);
  const steps = [];
  const step = async (label, command, argv, cwd, env) => { steps.push(label); await run(command, argv, { cwd, env }); };
  try {
    if ((await run('git', ['rev-parse', 'HEAD'], { cwd: checkout })).trim() !== sourceCommit) throw new Error('core checkout head mismatch');
    const scripts = JSON.parse(await readFile(path.join(checkout, 'package.json'), 'utf8')).scripts ?? {};
    await step('npm ci', npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], checkout);
    await step('bindings/node npm ci', npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], path.join(checkout, 'bindings/node'));
    await step('npm run js:build', npm, ['run', 'js:build'], checkout);
    await step('bindings/node npm run build', npm, ['run', 'build'], path.join(checkout, 'bindings/node'));
    const wasmStage = path.join(target, 'wasm-package'); await cp(path.join(checkout, 'bindings/wasm/npm'), wasmStage, { recursive: true });
    for (const script of ['wasm:build', 'wasm:build:common', ...Object.keys(scripts).filter(name => /^wasm:build:.*pii/.test(name)).sort()]) {
      const out = path.join(target, `out-${script.replace(/[^a-z0-9]+/g, '-')}`);
      await step(`npm run ${script} -- --out-dir <out>`, npm, ['run', script, '--', '--out-dir', out], checkout);
      await cp(out, wasmStage, { recursive: true });
    }
    const packDir = path.join(target, 'npm'); await mkdir(packDir);
    const pack = async directory => path.join(packDir, JSON.parse(await run(npm, ['pack', '--json', '--pack-destination', packDir], { cwd: directory }))[0].filename);
    const core = await pack(path.join(checkout, 'packages/javascript'));
    const nodeManifest = JSON.parse(await readFile(path.join(checkout, 'bindings/node/npm', nodePackage(), 'package.json'), 'utf8'));
    const nodeStage = path.join(target, 'node-package'); await cp(path.join(checkout, 'bindings/node/npm', nodePackage()), nodeStage, { recursive: true });
    await cp(path.join(checkout, 'bindings/node', nodeManifest.main), path.join(nodeStage, nodeManifest.main));
    const node = await pack(nodeStage), wasm = await pack(wasmStage);
    steps.push('npm pack core, node, wasm');
    let exampleBinary = null;
    if (example) {
      await step('cargo build --release --locked -p redact-secret --example pii_identity_evaluation', 'cargo',
        ['build', '--release', '--locked', '--quiet', '-p', 'redact-secret', '--example', 'pii_identity_evaluation'], checkout,
        { CARGO_TARGET_DIR: path.join(target, 'target') });
      exampleBinary = path.join(target, 'bin', 'pii_identity_evaluation'); await mkdir(path.dirname(exampleBinary), { recursive: true });
      await cp(path.join(target, 'target/release/examples/pii_identity_evaluation'), exampleBinary);
    }
    const version = JSON.parse(await readFile(path.join(checkout, 'packages/javascript/package.json'), 'utf8')).version;
    const coreCrateTree = (await run('git', ['rev-parse', `${sourceCommit}:crates/secret-scan-core`], { cwd: checkout })).trim();
    return { version, coreCrateTree, steps, tarballs: { core, node, wasm }, exampleBinary };
  } finally { await run('git', ['-C', args['core-repo'], 'worktree', 'remove', '--force', checkout]).catch(() => {}); }
}

async function ciQualification() {
  try {
    const runs = JSON.parse(await run('gh', ['run', 'list', '-R', B11_CANDIDATE.repository, '--commit', commit, '--workflow', 'Artifact qualification',
      '--json', 'databaseId,conclusion,event', '--limit', '5']));
    const good = runs.find(row => row.conclusion === 'success' && row.event === 'push');
    if (!good) return { status: 'not-available', reason: 'no successful push Artifact qualification run for this commit' };
    const directory = path.join(work, 'qualified');
    await rm(directory, { recursive: true, force: true });
    await run(process.execPath, ['scripts/qualified-candidate.mjs', 'fetch', '--repository', B11_CANDIDATE.repository, '--sha', commit,
      '--run-id', String(good.databaseId), '--product-ref', 'main', '--dir', directory], { cwd: root });
    const inventory = path.join(directory, 'artifact-inventory', 'artifact-inventory.json');
    const qualified = JSON.parse(await readFile(path.join(directory, 'qualified.json'), 'utf8'));
    const wasm = [];
    for (const entry of await readdir(directory)) {
      if (!entry.startsWith('wasm-')) continue;
      for (const name of (await readdir(path.join(directory, entry)).catch(() => [])).filter(file => file.endsWith('.wasm'))) {
        const bytes = await readFile(path.join(directory, entry, name));
        wasm.push({ artifact: entry, file: name, role: b11WasmRole(name), sha256: sha256(bytes), raw: bytes.length,
          gzip: gzipSync(bytes, { level: 9 }).length, brotli: brotliCompressSync(bytes, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length });
      }
    }
    return { status: 'available', runId: String(good.databaseId), inventorySha256: await fileSha256(inventory), productVersion: qualified.productVersion,
      packages: Object.fromEntries(Object.entries(qualified.packages).map(([role, row]) => [role, { name: row.name, sha256: row.sha256 }])),
      binaries: Object.fromEntries(Object.entries(qualified.binaries).map(([id, row]) => [id, row.sha256])), wasm: wasm.sort((a, b) => a.file.localeCompare(b.file)) };
  } catch (error) { return { status: 'not-available', reason: `ci qualification fetch failed: ${String(error.message).split('\n')[0].slice(0, 160)}` }; }
}

async function contractHashes() {
  const show = async (ref, file) => sha256(Buffer.from(await run('git', ['-C', args['core-repo'], 'show', `${ref}:${file}`]).catch(() => ''), 'utf8'));
  const beta10 = 'af7f863f29f9fe482dd233c8b7bc5b77dc427314';
  return Promise.all(B11_FREEZE_FILES.productContracts.map(async file => {
    const [atCandidate, atBeta10] = await Promise.all([show(commit, file), show(beta10, file)]);
    return { path: file, sha256: atCandidate, sha256AtBeta10: atBeta10 === sha256('') ? null : atBeta10,
      changedSinceBeta10: atBeta10 !== atCandidate };
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Phase 1: build and freeze
// ---------------------------------------------------------------------------------------------------------------
async function freeze() {
  const candidate = await buildProduct(commit, work, { example: true });
  const baselineWork = path.join(workRoot, `baseline-${B11_BASELINE_879.sourceCommit.slice(0, 12)}`);
  const baseline = await buildProduct(B11_BASELINE_879.sourceCommit, baselineWork, { example: false });
  const ci = await ciQualification();
  const toolchain = Object.fromEntries(await Promise.all([['node', process.execPath, ['--version']], ['rustc', 'rustc', ['--version']],
    ['cargo', 'cargo', ['--version']], ['wasm-bindgen', 'wasm-bindgen', ['--version']], ['wasm-opt', 'wasm-opt', ['--version']]]
    .map(async ([id, command, argv]) => [id, (await run(command, argv).catch(() => 'unavailable')).trim()])));
  const lockfileSha256 = await fileSha256(path.join(root, 'package-lock.json'));
  const hashed = async list => Promise.all(list.map(async file => ({ path: file, sha256: await fileSha256(path.join(root, file)) })));
  const value = {
    schemaVersion: 1, reportType: 'pii-beta11-freeze', issue: 'redact-secret/redact-secret-benchmarks#428', productIssue: 'redact-secret/redact-secret#901',
    supportClaims: false, role: args.role,
    roleNote: args.role === 'interim' ? 'Interim evidence: not the final exact beta.11 candidate. redact-secret#937 (PII runtime split out of the default Wasm builds, on #929) changes the Wasm artifact set after this commit.' :
      'Declared final exact beta.11 candidate by the orchestrator.',
    candidate: { repository: B11_CANDIDATE.repository, sourceCommit: commit, versionString: candidate.version, released: false,
      releaseNote: 'No beta.11 release exists; the version string is the one core main carries at this commit.',
      coreCrateTree: candidate.coreCrateTree, expectedContextVocabulary: B11_CANDIDATE.contextVocabulary, buildRecipe: candidate.steps,
      platform: `${process.platform}-${process.arch}`, toolchain,
      artifacts: { core: await artifactRow(candidate.tarballs.core), node: await artifactRow(candidate.tarballs.node), wasm: await artifactRow(candidate.tarballs.wasm) },
      wasmPayloads: await payloads(candidate.tarballs.wasm),
      identityExample: { path: 'crates/secret-scan-core/examples/pii_identity_evaluation.rs', binarySha256: await fileSha256(candidate.exampleBinary) } },
    ciQualification: ci,
    operationalBaseline: { sourceCommit: B11_BASELINE_879.sourceCommit, source: 'evidence/879/pii-operational-evidence-v1.json (baseline.sourceCommit)',
      version: baseline.version, artifacts: { core: await artifactRow(baseline.tarballs.core), node: await artifactRow(baseline.tarballs.node),
        wasm: await artifactRow(baseline.tarballs.wasm) }, wasmPayloads: await payloads(baseline.tarballs.wasm) },
    populationBaseline: { kind: 'lockfile-release', version: JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8')).packages['node_modules/@redact-secret/core'].version,
      verification: 'package-lock.json sha512 integrity' },
    benchmark: { repository: 'redact-secret/redact-secret-benchmarks', baseRevision: await git('rev-parse', 'HEAD'), lockfileSha256 },
    contracts: await contractHashes(),
    frozenInputs: await hashed(B11_FREEZE_FILES.benchmarkInputs),
    evaluationSchema: await hashed(B11_FREEZE_FILES.evaluationSchema),
    activation: (await import('../benchmarks/evaluation/domains/pii/beta11-qualification.ts')).B11_EXPECTED_ACTIVATION,
    protectedEpochs: [],
    freezeCommitment: '',
  };
  value.protectedEpochs = b11ProtectedEpochs(value);
  value.freezeCommitment = b11Commitment({ ...value, freezeCommitment: undefined });
  await writeJson(freezeFile, value);
  console.log(`Wrote ${path.relative(root, freezeFile)} (${value.freezeCommitment}). Commit it, then run the same command again to measure.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Phase 2: verify and measure
// ---------------------------------------------------------------------------------------------------------------
async function verifyFreeze() {
  if (await git('status', '--porcelain')) throw new Error('benchmark tree is not clean; measure only from the committed freeze');
  await git('ls-files', '--error-unmatch', path.relative(root, freezeFile));
  const frozen = JSON.parse(await readFile(freezeFile, 'utf8'));
  if (frozen.freezeCommitment !== b11Commitment({ ...frozen, freezeCommitment: undefined }) || frozen.candidate.sourceCommit !== commit)
    throw new Error('freeze commitment mismatch');
  for (const row of [...frozen.frozenInputs, ...frozen.evaluationSchema])
    if (await fileSha256(path.join(root, row.path)) !== row.sha256) throw new Error(`frozen file changed after the freeze: ${row.path}`);
  const tarballs = {};
  for (const role of ['core', 'node', 'wasm']) {
    const file = path.join(work, 'npm', frozen.candidate.artifacts[role].file);
    if (await fileSha256(file) !== frozen.candidate.artifacts[role].sha256) throw new Error(`candidate ${role} artifact differs from the freeze`);
    tarballs[role] = file;
  }
  const baselineTarballs = {};
  for (const role of ['core', 'node', 'wasm']) {
    const file = path.join(workRoot, `baseline-${B11_BASELINE_879.sourceCommit.slice(0, 12)}`, 'npm', frozen.operationalBaseline.artifacts[role].file);
    if (await fileSha256(file) !== frozen.operationalBaseline.artifacts[role].sha256) throw new Error(`baseline ${role} artifact differs from the freeze`);
    baselineTarballs[role] = file;
  }
  const example = path.join(work, 'bin', 'pii_identity_evaluation');
  if (await fileSha256(example) !== frozen.candidate.identityExample.binarySha256) throw new Error('identity example binary differs from the freeze');
  const freezeCommit = await git('log', '-1', '--format=%H', '--', path.relative(root, freezeFile));
  return { frozen, tarballs, baselineTarballs, example, freezeCommit };
}

const utf8Offset = (input, offset) => Buffer.byteLength(input.slice(0, offset), 'utf8');
function outsidePreserved(input, result) {
  const findings = [...result.findings].sort((a, b) => a.start - b.start);
  let cursor = 0, at = 0;
  for (const finding of [...findings, { start: input.length, end: input.length }]) {
    const segment = input.slice(cursor, finding.start), index = result.text.indexOf(segment, at);
    if (index < 0) return false;
    at = index + segment.length; cursor = Math.max(cursor, finding.end);
  }
  return findings.length > 0 || result.text === input;
}

async function withSurface(tarballs, lane, selectors, body) {
  const installation = await installCandidate(tarballs);
  try {
    if (lane === 'node-wasm') {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?b11=${lane}-${Date.now()}-${Math.random()}`);
    await (selectors.length ? module.initialize({ pii: selectors }) : module.initialize());
    const artifact = typeof module.artifact === 'function' ? module.artifact() : null;
    if (artifact !== (lane === 'node-wasm' ? 'wasm' : 'addon')) throw new Error(`${lane} loaded ${artifact}`);
    return await body(module, artifact);
  } finally { await removeCandidate(installation); }
}

function observeCases(module, family, table, rangesPerCase) {
  const findingType = PII_ORACLE_PLANS[family].findingType;
  return table.map((row, index) => {
    const findings = module.scan(row.input).map(finding => ({ ...finding, start: utf8Offset(row.input, finding.start), end: utf8Offset(row.input, finding.end) }));
    const result = module.scanAndRedact(row.input);
    const agree = JSON.stringify(result.findings.map(f => [f.type, f.start, f.end, f.action])) === JSON.stringify(module.scan(row.input).map(f => [f.type, f.start, f.end, f.action]));
    const target = row.target;
    const otherPii = findings.filter(f => f.detector === 'pii-domain' && f.type !== findingType);
    const bytes = Buffer.from(row.input, 'utf8');
    return { id: row.id, family: findings.filter(f => f.type === findingType).map(f => [f.start, f.end, f.action]),
      otherPii: [...new Set(otherPii.map(f => f.type))].sort(),
      otherPiiAtTarget: Boolean(target) && otherPii.some(f => f.start < target.end && target.start < f.end),
      credential: findings.filter(f => f.detector !== 'pii-domain').length,
      ranges: rangesPerCase[index].map(range => [range.start, range.end, result.text.includes(bytes.subarray(range.start, range.end).toString('utf8'))]),
      outsidePreserved: outsidePreserved(row.input, result), scanRedactAgree: agree };
  });
}

async function observeSide(side, tarballs) {
  const families = [];
  for (const family of B11_FAMILIES) {
    const { frozen } = b11CaseTables(family), ranges = b11ObservedRanges(family);
    const lanes = [];
    for (const lane of ['node-addon', 'node-wasm']) for (const selection of B11_SELECTIONS(family)) {
      const selectors = b11Selectors(family, selection);
      lanes.push(await withSurface(tarballs, lane, selectors, async (module, artifact) => {
        const activationIdentity = typeof module.piiActivation === 'function' ? module.piiActivation() : null;
        if (side === 'candidate') { const problem = activationProblem(family, selection, activationIdentity); if (problem) throw new Error(`${family} ${selection}: ${problem}`); }
        return { lane, selection, activationIdentity, artifact, cases: observeCases(module, family, frozen, ranges) };
      }));
    }
    families.push({ family, lanes });
    console.log(`${side}: ${family} observed on ${lanes.length} lanes`);
  }
  return families;
}

async function seam(example, frozen, tarballs, candidateFamilies) {
  const components = Object.fromEntries(await Promise.all(Object.entries(tarballs).map(async ([role, file]) => [role, await fileSha256(file)])));
  const artifactSetCommitment = piiArrivalCommitment(components);
  const rows = [];
  for (const family of B11_FAMILIES) {
    const cases = b11CaseTables(family).frozen.filter(row => row.source === 'oracle-plan');
    const jsonl = cases.map(row => JSON.stringify({ id: row.id, family, text: row.input, candidate: row.candidate })).join('\n') + '\n';
    const stdout = await new Promise((resolve, reject) => {
      const child = execFile(example, ['--family', family], { maxBuffer: 16 * 1024 * 1024 }, (error, out) => error ? reject(error) : resolve(out));
      child.stdin.end(jsonl);
    });
    const [header, ...observations] = stdout.trim().split('\n').map(line => JSON.parse(line));
    if (header.format !== PII_PRODUCT_IDENTITY_FORMAT || header.family !== family) throw new Error(`${family}: unexpected seam header`);
    const evidence = { format: header.format, family, contextVocabulary: header.vocabulary, activationIdentity: header.activationIdentity,
      sourceCommit: commit, artifactSetCommitment, observations, artifactCommitment: '' };
    evidence.artifactCommitment = b11EvidenceCommitment(evidence);
    rows.push(evidence);
  }
  return { components, artifactSetCommitment, candidateArtifactCommitment: components.core, evidence: rows };
}

async function operational(frozen, tarballs, baselineTarballs) {
  const contract = JSON.parse(await readFile(path.join(root, 'qualification/pii-national-id-arrival-v1.json'), 'utf8')).operational;
  const helper = path.join(root, 'scripts/measure-pii-arrival-runtime-sample.mjs');
  if (await fileSha256(helper) !== contract.sampleProtocol.helperSha256) throw new Error('runtime sample helper identity mismatch');
  const samples = Number(args.samples ?? contract.minimumPairedSamples);
  if (!Number.isInteger(samples) || samples < contract.minimumPairedSamples) throw new Error('too few paired samples');
  const workload = ['authorization=Bearer SYNTHETIC_REVOKED_OPERATIONAL_TOKEN_392', 'order_reference=890626879', 'ssn documentation=890-62-6879', 'ssn=890-62-6879'].join('\n');
  const env = { ...Object.fromEntries(contract.sampleProtocol.environment.inherit.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]])),
    ...contract.sampleProtocol.environment.fixed };
  const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
  const rows = [];
  for (const [surface, wasm] of [['node-addon', false], ['node-wasm', true]]) {
    const installs = { baseline: await installCandidate(baselineTarballs), candidate: await installCandidate(tarballs) };
    try {
      if (wasm) for (const installation of Object.values(installs)) {
        const scope = path.join(installation.root, 'node_modules', '@redact-secret');
        for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
      }
      for (const profile of contract.profiles) {
        const series = { baseline: { initialize: [], wholeInput: [], incrementalLineCalls: [] }, candidate: { initialize: [], wholeInput: [], incrementalLineCalls: [] } };
        for (let index = 0; index < samples + contract.sampleProtocol.warmupSamples; index++) for (const side of ['baseline', 'candidate']) {
          const selectors = contract.profileSelections[profile][side].effectiveSelectors;
          const stdout = await run(process.execPath, [helper, `--module=${path.join(installs[side].root, 'node_modules/@redact-secret/core/dist/index.js')}`,
            `--selectors-base64=${Buffer.from(JSON.stringify(selectors)).toString('base64url')}`, `--workload-base64=${Buffer.from(workload).toString('base64url')}`],
          { env, timeout: 30_000 });
          const sample = JSON.parse(stdout.trim());
          if (index >= contract.sampleProtocol.warmupSamples) for (const key of Object.keys(series[side])) series[side][key].push(sample[key]);
        }
        const metrics = Object.fromEntries(Object.keys(series.candidate).map(metric => {
          const before = median(series.baseline[metric]), after = median(series.candidate[metric]), delta = after - before, relative = before ? delta / before : null;
          return [metric, { baselineMedian: before, candidateMedian: after, delta, relative,
            pass: delta <= contract.runtime.maximumAbsoluteIncreaseMilliseconds || (relative !== null && relative <= contract.runtime.maximumRelativeIncrease) }];
        }));
        rows.push({ surface, profile, samples, metrics });
      }
    } finally { await Promise.all(Object.values(installs).map(removeCandidate)); }
  }
  const packed = async set => Object.fromEntries(await Promise.all(Object.entries(set).map(async ([role, file]) => [role, (await stat(file)).size])));
  return { contract: 'qualification/pii-national-id-arrival-v1.json#operational', contractCommitment: b11Commitment(contract), workloadCommitment: sha256(workload),
    runtime: { node: process.version, platform: process.platform, arch: process.arch }, runtimeComparisons: rows,
    sizes: { baseline: { packed: await packed(baselineTarballs), wasmPayloads: frozen.operationalBaseline.wasmPayloads },
      candidate: { packed: await packed(tarballs), wasmPayloads: frozen.candidate.wasmPayloads } },
    sizeBudgetRows: b11SizeBudgetRows(frozen) };
}

async function measure() {
  const { frozen, tarballs, baselineTarballs, example, freezeCommit } = await verifyFreeze();
  const benchmarkRevision = await git('rev-parse', 'HEAD');
  const startedAt = new Date().toISOString();
  const candidate = await observeSide('candidate', tarballs);
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'pii-b11-baseline-'));
  let baseline;
  try {
    const packed = await packLockfileRelease(scratch);
    const components = Object.fromEntries(await Promise.all(Object.entries(packed).map(async ([role, file]) => [role, await fileSha256(file)])));
    baseline = { version: frozen.populationBaseline.version, components, families: await observeSide('baseline', packed) };
  } finally { await rm(scratch, { recursive: true, force: true }); }
  const identity = await seam(example, frozen, tarballs, candidate);
  const cost = await operational(frozen, tarballs, baselineTarballs);
  const finishedAt = new Date().toISOString();
  const observation = { schemaVersion: 1, reportType: 'pii-beta11-observation', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#428',
    role: frozen.role, freeze: { file: path.relative(root, freezeFile), commit: freezeCommit, freezeCommitment: frozen.freezeCommitment },
    benchmark: { revision: benchmarkRevision, dirty: false }, platform: `${process.platform}-${process.arch}`, node: process.version, startedAt, finishedAt,
    candidate: { sourceCommit: commit, components: identity.components, artifactSetCommitment: identity.artifactSetCommitment, families: candidate },
    baseline, identitySeam: { candidateArtifactCommitment: identity.candidateArtifactCommitment, evidence: identity.evidence },
    peerScanners: 'none', credentialAccounting: 'separate-not-scored' };
  const operationalEvidence = { schemaVersion: 1, reportType: 'pii-beta11-operational', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#428',
    role: frozen.role, sourceCommit: commit, freezeCommitment: frozen.freezeCommitment, ...cost, artifactCommitment: '' };
  operationalEvidence.artifactCommitment = b11EvidenceCommitment(operationalEvidence);
  await writeJson(path.join(evidenceDir, 'pii-beta11-observation-v1.json'), observation);
  await writeJson(path.join(evidenceDir, 'pii-beta11-operational-v1.json'), operationalEvidence);
  const parityFile = path.join(root, 'evidence/901/427', `mixed-parity-core-${sha12}-plan-v2-report-v1.json`);
  const parity = existsSync(parityFile) ? { file: path.relative(root, parityFile), report: JSON.parse(await readFile(parityFile, 'utf8')) } : null;
  const report = buildB11Report({ freeze: frozen, observation, operational: operationalEvidence, parity });
  await writeJson(path.join(evidenceDir, 'pii-beta11-report-v1.json'), report);
  const disposition = buildB11Disposition(report);
  await writeJson(path.join(evidenceDir, 'pii-beta11-disposition-v1.json'), disposition);
  for (const row of disposition.families) console.log(`${row.family}: ${row.status} (${row.failedOrWithheldGates.map(gate => gate.gate).join(', ')})`);
  console.log(`protected eligibility: ${disposition.protectedPartition.eligibleFamilies.length ? disposition.protectedPartition.eligibleFamilies.join(', ') : 'none'}`);
}

if (existsSync(freezeFile) && (await git('ls-files', path.relative(root, freezeFile)))) await measure();
else await freeze();
