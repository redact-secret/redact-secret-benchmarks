/**
 * Observe the frozen #425 payment-card and IBAN stress plans on the released baseline and on the exact released
 * beta.10 candidate, then score them (benchmarks #425, core #901).
 *
 * - Candidate: the published `0.1.0-beta.10` npm tarballs, which the release workflow built from `af7f863f`. They
 *   are packed from the registry and fail closed unless the facade SHA-1 and the addon/Wasm payload SHA-256 digests
 *   equal the release manifest digests frozen in `evidence/901/pii-gap-ledger-v1.json`.
 * - Baseline: the lockfile release (`0.1.0-beta.9`), packed and checked against the lockfile integrity, exactly as
 *   `pii:observe:populations` does.
 * - Lanes: Node addon and Node Wasm fallback, each with `pii:global` + `pii:us` (cross-family) and with the exact
 *   family selector. Every lane records public findings (type, detector, action, UTF-8 range) and two booleans from
 *   `scanAndRedact` (target value removed, text outside findings preserved). No input or output text is written.
 *
 * Run: node --import tsx scripts/observe-pii-card-iban-stress.mjs [--observation=…] [--report=…]
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { STRESS_PLAN_FILES, buildStressPlan } from '../benchmarks/evaluation/domains/pii/card-iban-stress/authoring.ts';
import { ibanIdentity, paymentCardIdentity } from '../benchmarks/evaluation/domains/pii/card-iban-stress/contract-model.ts';
import { STRESS_FAMILIES, stressPlans, validateStressPlans } from '../benchmarks/evaluation/domains/pii/card-iban-stress/stress.ts';
import { buildStressReport } from '../benchmarks/evaluation/domains/pii/card-iban-stress/report.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { packLockfileRelease } from './observe-pii-populations.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(observation|report)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unknown argument ${argument}`); return [match[1], match[2]];
}));
const observationFile = path.resolve(root, args.observation ?? 'evidence/901/425/card-iban-stress-observation-v1.json');
const reportFile = path.resolve(root, args.report ?? 'evidence/901/425/card-iban-stress-report-v1.json');
const CANDIDATE_VERSION = '0.1.0-beta.10', CANDIDATE_COMMIT = 'af7f863f29f9fe482dd233c8b7bc5b77dc427314';
const BASELINE_COMMIT = 'f726f2ffb0fd854cc3eeb4c35798695fde3161d3'; // v0.1.0-beta.9
const digest = async (file, algorithm = 'sha256') => createHash(algorithm).update(await readFile(file)).digest('hex');

// 1. Expectations are frozen before any scan: the plans must be committed, clean, regenerable and valid.
const frozenPaths = [...Object.values(STRESS_PLAN_FILES), 'benchmarks/evaluation/domains/pii/card-iban-stress/authoring.ts',
  'benchmarks/evaluation/domains/pii/card-iban-stress/contract-model.ts'];
const { stdout: dirty } = await exec('git', ['status', '--porcelain', '--', ...frozenPaths], { cwd: root });
if (dirty.trim()) throw new Error('stress plans are not committed; freeze expectations before scanning');
const { stdout: frozenAt } = await exec('git', ['log', '-1', '--format=%H', '--', ...Object.values(STRESS_PLAN_FILES)], { cwd: root });
for (const family of STRESS_FAMILIES)
  if (`${JSON.stringify(buildStressPlan(family), null, 2)}\n` !== await readFile(path.join(root, STRESS_PLAN_FILES[family]), 'utf8'))
    throw new Error(`${family} stress plan drifted from its authored truth`);
const validation = validateStressPlans();

const nodePackage = () => {
  const names = { 'darwin-arm64': 'node-darwin-arm64', 'darwin-x64': 'node-darwin-x64', 'linux-x64': 'node-linux-x64-gnu', 'linux-arm64': 'node-linux-arm64-gnu',
    'win32-x64': 'node-win32-x64-msvc', 'win32-arm64': 'node-win32-arm64-msvc' };
  const name = names[`${process.platform}-${process.arch}`];
  if (!name) throw new Error(`No released node package for ${process.platform}-${process.arch}`);
  return name;
};

/** Pack the published candidate and bind it to the frozen release-manifest digests; any mismatch fails closed. */
async function packCandidate(directory) {
  const ledger = JSON.parse(await readFile(path.join(root, 'evidence/901/pii-gap-ledger-v1.json'), 'utf8'));
  const final = ledger.finalCandidate;
  if (final.version !== CANDIDATE_VERSION || final.sourceCommit !== CANDIDATE_COMMIT) throw new Error('ledger final candidate is not the beta.10 release');
  const manifest = artifact => final.artifacts.filter(row => row.artifact === artifact);
  const packed = {}, verified = [];
  for (const [role, name] of [['core', 'core'], ['node', nodePackage()], ['wasm', 'wasm']]) {
    const { stdout } = await exec(npm, ['pack', `@redact-secret/${name}@${CANDIDATE_VERSION}`, '--pack-destination', directory, '--json', '--ignore-scripts'],
      { cwd: directory, maxBuffer: 5 * 1024 * 1024 });
    packed[role] = path.join(directory, path.basename(JSON.parse(stdout)[0].filename));
    const rows = manifest(`npm:@redact-secret/${name}`);
    if (!rows.length) throw new Error(`release manifest lists no ${name}`);
    if (role === 'core') {
      if (rows.length !== 1 || rows[0].algorithm !== 'sha1' || rows[0].digest !== await digest(packed.core, 'sha1')) throw new Error('core facade does not match the release manifest');
      verified.push({ artifact: rows[0].artifact, file: 'tarball', algorithm: 'sha1' });
      continue;
    }
    const extract = path.join(directory, `${role}-x`);
    await mkdir(extract);
    await exec('tar', ['-xzf', packed[role], '-C', extract]);
    const files = new Set(await readdir(path.join(extract, 'package')));
    // Payload files the tarball carries must each equal the manifest; the platform binary / Wasm must be present.
    const payload = rows.filter(row => files.has(row.file));
    if (!payload.some(row => /\.(node|wasm)$/.test(row.file))) throw new Error(`${name} payload is missing`);
    for (const row of payload) {
      if (row.algorithm !== 'sha256' || row.digest !== await digest(path.join(extract, 'package', row.file))) throw new Error(`${name}/${row.file} does not match the release manifest`);
      verified.push({ artifact: row.artifact, file: row.file, algorithm: row.algorithm });
    }
  }
  return { packed, verified };
}

const surfaces = [['node-addon', false], ['node-wasm', true]];
const selections = family => [['pii-global-and-us', ['pii:global', 'pii:us']],
  ['exact-family', [family === 'pii:global:payment-card' ? 'pii:family:global:payment-card' : 'pii:family:global:iban']]];
const byteOffset = (text, index) => Buffer.byteLength(text.slice(0, index));

function redactionFacts(plan, row, result) {
  const output = result.text;
  const findings = [...result.findings].sort((a, b) => a.start - b.start);
  let cursor = 0, at = 0, outsidePreserved = true;
  for (const finding of [...findings, { start: row.input.length, end: row.input.length }]) {
    const segment = row.input.slice(cursor, finding.start);
    const index = output.indexOf(segment, at);
    if (index < 0) { outsidePreserved = false; break; }
    at = index + segment.length; cursor = Math.max(cursor, finding.end);
  }
  if (!findings.length && output !== row.input) outsidePreserved = false;
  let targetValueRemoved = null;
  if (row.expected.publicFinding) {
    const normalized = (plan.family === 'pii:global:payment-card' ? paymentCardIdentity : ibanIdentity)(row.display).normalized;
    targetValueRemoved = !output.includes(row.display) && !output.replace(/[ -]/g, '').includes(normalized);
  }
  return { targetValueRemoved, outsidePreserved };
}

async function observeLane(tarballs, plan, [lane, fallback], [selection, selectors]) {
  const installation = await installCandidate(tarballs);
  try {
    if (fallback) {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?lane=${lane}-${selection}-${Date.now()}`);
    try { await module.initialize({ pii: selectors }); } catch { return { lane, selection, status: 'initialization-rejected', activationIdentity: null, artifact: null, cases: [] }; }
    const artifact = typeof module.artifact === 'function' ? module.artifact() : null;
    if ((fallback && artifact === 'addon') || (!fallback && artifact === 'wasm')) throw new Error(`surface ${lane} did not load the expected artifact`);
    const activationIdentity = typeof module.piiActivation === 'function' ? module.piiActivation() : null;
    const cases = plan.cases.map(row => {
      const findings = module.scan(row.input).map(finding => ({ type: finding.type, detector: finding.detector, action: finding.action,
        start: byteOffset(row.input, finding.start), end: byteOffset(row.input, finding.end) }));
      const result = module.scanAndRedact(row.input);
      const agree = JSON.stringify(result.findings.map(finding => [finding.type, finding.start, finding.end])) ===
        JSON.stringify(module.scan(row.input).map(finding => [finding.type, finding.start, finding.end]));
      return { id: row.id, findings, redaction: { ...redactionFacts(plan, row, result), findingsAgree: agree } };
    });
    return { lane, selection, status: 'observed', activationIdentity, artifact, cases };
  } finally { await removeCandidate(installation); }
}

async function sideIdentity(tarballs, version, sourceCommit) {
  const components = {};
  for (const role of ['core', 'node', 'wasm']) components[role] = await digest(tarballs[role]);
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(components).sort()));
  return { version, sourceCommit, components, artifactSetCommitment: createHash('sha256').update(canonical).digest('hex') };
}

const scratch = await mkdtemp(path.join(tmpdir(), 'pii-425-stress-'));
try {
  const baselineDirectory = path.join(scratch, 'baseline'), candidateDirectory = path.join(scratch, 'candidate');
  await mkdir(baselineDirectory); await mkdir(candidateDirectory);
  const baselineTarballs = await packLockfileRelease(baselineDirectory);
  const { packed: candidateTarballs, verified } = await packCandidate(candidateDirectory);
  const sides = [];
  for (const [id, tarballs, version, commit] of [['baseline', baselineTarballs, '0.1.0-beta.9', BASELINE_COMMIT],
    ['candidate', candidateTarballs, CANDIDATE_VERSION, CANDIDATE_COMMIT]]) {
    const identity = await sideIdentity(tarballs, version, commit);
    const families = [];
    for (const family of STRESS_FAMILIES) {
      const plan = stressPlans[family], lanes = [];
      for (const surface of surfaces) for (const selection of selections(family)) lanes.push(await observeLane(tarballs, plan, surface, selection));
      families.push({ family, lanes });
    }
    sides.push({ side: id, identity, families });
    console.log(`${id}: observed ${STRESS_FAMILIES.length} families on ${surfaces.length} surfaces`);
  }
  const observation = {
    schemaVersion: 1, reportType: 'pii-card-iban-stress-observation', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#425',
    plansFrozenAt: frozenAt.trim(), planCommitments: Object.fromEntries(validation.results.map(result => [result.plan.family, result.commitment])),
    oracleCommitment: validation.oracleCommitment, platform: `${process.platform}-${process.arch}`, node: process.version,
    candidateManifestVerification: { ledger: 'evidence/901/pii-gap-ledger-v1.json', verified },
    baselineVerification: 'package-lock.json sha512 integrity', sides,
  };
  await mkdir(path.dirname(observationFile), { recursive: true });
  await writeFile(observationFile, `${JSON.stringify(observation, null, 1)}\n`);
  const report = buildStressReport(observation);
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  for (const row of report.summary) console.log(JSON.stringify(row));
} finally { await rm(scratch, { recursive: true, force: true }); }
