/**
 * Observe both PII populations (diagnostic-balanced, benign-heavy-stress) on a
 * released baseline and one product candidate, and write the population
 * release bundle `eval:publish:pii-support --population-bundle` binds.
 *
 * The baseline is the released `@redact-secret/core` this repository's lockfile
 * pins, packed from the registry and checked against the lockfile integrity, so
 * the comparison answers one question: does this candidate add benign false
 * alarms or lose type/validator/context accuracy relative to what users run?
 * Both sides run through one scanner identity with one requested selection; a
 * release without PII activation simply observes no PII findings.
 *
 * Run: npm run pii:observe:populations -- --candidate-core=… --candidate-node=… --candidate-wasm=… --output=…
 *      [--baseline-core=… --baseline-node=… --baseline-wasm=…]   (default: pack the lockfile release)
 */
import { measurementOutput, writeMeasurement } from './lib/measurement-output.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { piiAccountingRowsFromEvaluation } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { buildPiiPopulationReport, comparePiiPopulationReports, piiPopulationContract,
  validatePiiPopulationReport } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { piiSupportRegistry } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const POPULATIONS = ['diagnostic-balanced', 'benign-heavy-stress'];
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = value => hash(JSON.stringify(canonical(value)));
const digestFile = async (location, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(await readFile(location)).digest(encoding);

/** One selector per registered scope, so every registered family is requested and none is inferred from a neighbour. */
export const piiPopulationSelectors = () => [...new Set(piiSupportRegistry.families.map(row => row.scope === 'global' ? 'pii:global' : `pii:${row.jurisdiction.toLowerCase()}`))].sort();
export const piiPopulationScannerConfiguration = () => Object.freeze({
  adapter: 'redact-secret-pii-population', adapterVersion: 1, runtime: 'node', installation: 'isolated-npm-tarballs-with-overrides',
  requestedSelectors: piiPopulationSelectors(), findings: 'pii-domain-only',
});

const nodePackage = () => {
  const names = { 'darwin-arm64': 'node-darwin-arm64', 'darwin-x64': 'node-darwin-x64', 'linux-x64': 'node-linux-x64-gnu', 'linux-arm64': 'node-linux-arm64-gnu',
    'win32-x64': 'node-win32-x64-msvc', 'win32-arm64': 'node-win32-arm64-msvc' };
  const name = names[`${process.platform}-${process.arch}`];
  if (!name) throw new Error(`No released redact-secret node package for ${process.platform}-${process.arch}`);
  return `@redact-secret/${name}`;
};

/** Pack the lockfile release from the registry and fail closed unless each tarball matches the lockfile integrity. */
export async function packLockfileRelease(directory) {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const packed = {};
  for (const [role, name] of [['core', '@redact-secret/core'], ['node', nodePackage()], ['wasm', '@redact-secret/wasm']]) {
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry?.version || !/^sha512-/.test(entry.integrity ?? '')) throw new Error(`${name} is not pinned with sha512 integrity in package-lock.json`);
    const { stdout } = await execFileAsync(npm, ['pack', `${name}@${entry.version}`, '--pack-destination', directory, '--json', '--ignore-scripts'], { cwd: directory, maxBuffer: 5 * 1024 * 1024 });
    const [{ filename }] = JSON.parse(stdout), file = path.join(directory, path.basename(filename));
    if (`sha512-${await digestFile(file, 'sha512', 'base64')}` !== entry.integrity) throw new Error(`${name}@${entry.version} does not match its lockfile integrity`);
    packed[role] = file;
  }
  return packed;
}

/** The view label when the staging candidate is the published release (#515): one publish, no comparison. */
export const CANDIDATE_EQUALS_RELEASE_LABEL = 'candidate equals the published release; no comparison';

export async function sameArtifacts(a, b) {
  const [left, right] = await Promise.all([sideIdentity(a), sideIdentity(b)]);
  return left.artifactSetCommitment === right.artifactSetCommitment;
}

async function sideIdentity(tarballs) {
  const components = {};
  for (const role of ['core', 'node', 'wasm']) components[role] = await digestFile(tarballs[role]);
  return { components, artifactSetCommitment: commitment(components) };
}

/** Scan both populations' cases on one side. Only `pii-domain` findings are PII observations; credential findings are not read. */
async function observe(tarballs, identity) {
  const selectors = piiPopulationSelectors(), installation = await installCandidate(tarballs);
  try {
    const installed = await loadCandidate(installation, null, { pii: selectors });
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?activation=${Date.now()}`);
    let activationIdentity = null;
    if (typeof module.piiActivation === 'function') { await module.initialize({ pii: selectors }); activationIdentity = module.piiActivation(); }
    const scanner = { id: 'redact-secret-pii-population', mode: 'candidate', capabilities: { ranges: true, classification: true },
      configuration: piiPopulationScannerConfiguration(),
      async version() { return installed.version; },
      async scan(directory, fixtures) { return (await installed.scan(directory, fixtures)).filter(finding => typeof finding.family === 'string' && finding.family.startsWith('pii:')); } };
    const evaluation = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
      provenance: { candidateArtifactHash: identity.artifactSetCommitment, planHash: piiPopulationContract.contentCommitment }, runId: randomUUID() });
    return { version: installed.version, activationIdentity, rows: piiAccountingRowsFromEvaluation(evaluation) };
  } finally { await removeCandidate(installation); }
}

export async function observePiiPopulations({ baseline, candidate, candidateSourceCommit = null }) {
  const [baselineIdentity, candidateIdentity] = await Promise.all([sideIdentity(baseline), sideIdentity(candidate)]);
  if (baselineIdentity.artifactSetCommitment === candidateIdentity.artifactSetCommitment) throw new Error('Baseline and candidate are the same artifacts');
  const before = await observe(baseline, baselineIdentity), after = await observe(candidate, candidateIdentity);
  const reports = rows => POPULATIONS.map(population => buildPiiPopulationReport(piiPopulationContract, piiBenignCollisionEvidence, rows, population));
  const baselineReports = reports(before.rows), candidateReports = reports(after.rows);
  for (const [list, rows] of [[baselineReports, before.rows], [candidateReports, after.rows]])
    for (const report of list) validatePiiPopulationReport(report, piiPopulationContract, piiBenignCollisionEvidence, {}, rows);
  const comparisons = POPULATIONS.map((population, index) => {
    const verdict = comparePiiPopulationReports(baselineReports[index], candidateReports[index],
      { contract: piiPopulationContract, evidence: piiBenignCollisionEvidence, baselineRows: before.rows, candidateRows: after.rows }).verdict;
    return { population, verdict, baselineReport: baselineReports[index], candidateReport: candidateReports[index], baselineRows: before.rows, candidateRows: after.rows };
  });
  const side = (identity, observed, sourceCommit) => ({ sourceCommit, ...identity, version: observed.version, activationIdentity: observed.activationIdentity });
  return { schemaVersion: 1, reportType: 'pii-population-release', supportClaims: false, contractCommitment: piiPopulationContract.contentCommitment,
    corpusCommitment: piiBenignCollisionEvidence.contentCommitment, scanner: piiPopulationScannerConfiguration(),
    baseline: side(baselineIdentity, before, null), candidate: side(candidateIdentity, after, candidateSourceCommit), comparisons };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).map(argument => {
    const match = /^--((?:baseline|candidate)-(?:core|node|wasm)|candidate-source-commit|output)=(.+)$/.exec(argument);
    if (!match) throw new Error(`Unknown argument ${argument}`); return [match[1], match[2]];
  }));
  for (const key of ['candidate-core', 'candidate-node', 'candidate-wasm', 'output']) if (!args[key]) throw new Error(`missing --${key}`);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = measurementOutput(path.resolve(args.output), root);
  if (args['candidate-source-commit'] && !/^[0-9a-f]{40}$/.test(args['candidate-source-commit'])) throw new Error('--candidate-source-commit must be 40 hex');
  const explicit = ['baseline-core', 'baseline-node', 'baseline-wasm'].filter(key => args[key]);
  if (explicit.length !== 0 && explicit.length !== 3) throw new Error('Pass all three --baseline-* tarballs or none');
  const scratch = await mkdtemp(path.join(tmpdir(), 'pii-population-baseline-'));
  try {
    const baseline = explicit.length ? { core: path.resolve(args['baseline-core']), node: path.resolve(args['baseline-node']), wasm: path.resolve(args['baseline-wasm']) }
      : await packLockfileRelease(scratch);
    const candidate = { core: path.resolve(args['candidate-core']), node: path.resolve(args['candidate-node']), wasm: path.resolve(args['candidate-wasm']) };
    // Right after a release there is no unreleased candidate: the candidate is the release the lockfile pins. There is
    // nothing to compare, so write no bundle; publication then records the populations as not-measured.
    if (!explicit.length && await sameArtifacts(baseline, candidate)) {
      console.log(`${CANDIDATE_EQUALS_RELEASE_LABEL}. Candidate is the released lockfile package; no unreleased candidate to compare, so no population bundle is written.`);
      process.exit(0);
    }
    const bundle = await observePiiPopulations({ baseline, candidate, candidateSourceCommit: args['candidate-source-commit'] ?? null });
    writeMeasurement(output, `${JSON.stringify(bundle)}\n`);
    console.log(bundle.comparisons.map(row => `${row.population}: ${row.verdict} (candidate ${row.candidateReport.status})`).join('\n'));
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
