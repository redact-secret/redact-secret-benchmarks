import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { validateEvidence } from '../benchmarks/evaluation/domains/credential/evidence.ts';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { piiAccountingRowsFromEvaluation } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { buildPiiPopulationReport, comparePiiPopulationReports, piiPopulationContract,
  validatePiiPopulationReport } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { piiArrivalContract, piiArrivalPopulationScannerConfiguration,
  piiArrivalSelectionEvidence } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';

const execFileAsync = promisify(execFile);
const raw = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument); if (!match) throw new Error('invalid arguments'); return [match[1], match[2]];
}));
for (const side of ['baseline', 'candidate']) for (const key of ['evidence', 'core', 'node', 'wasm'])
  if (!raw[`${side}-${key}`]) throw new Error(`missing --${side}-${key}`);
if (!raw['candidate-source'] || !raw.output) throw new Error('missing --candidate-source or --output');
const args = Object.fromEntries(Object.entries(raw).map(([key, value]) =>
  [key, key === 'output' || key === 'candidate-source' || key.includes('evidence') || ['core', 'node', 'wasm'].some(role => key.endsWith(role)) ? path.resolve(value) : value]));
const digestFile = async location => createHash('sha256').update(await readFile(location)).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = value => hash(JSON.stringify(canonical(value)));
const validSsn = compact => /^\d{9}$/.test(compact) && !['000', '666'].includes(compact.slice(0, 3)) && Number(compact.slice(0, 3)) < 900 &&
  compact.slice(3, 5) !== '00' && compact.slice(5) !== '0000';

async function candidateIdentity(side) {
  const evidence = JSON.parse(await readFile(args[`${side}-evidence`], 'utf8')); validateEvidence(evidence, 'candidate');
  if (evidence.status !== 'complete' || evidence.selection.scope !== 'full-suite' || evidence.candidate.sourceState !== 'clean' || evidence.benchmark.dirty)
    throw new Error(`${side} candidate evidence is not complete, full-suite, and clean`);
  const components = {};
  for (const [role, argument] of [['package', 'core'], ['node', 'node'], ['wasm', 'wasm']]) {
    const expected = evidence.candidate.artifacts.find(row => row.role === role)?.sha256, actual = await digestFile(args[`${side}-${argument}`]);
    if (!expected || actual !== expected) throw new Error(`${side} ${role} artifact mismatch`); components[argument] = actual;
  }
  return { evidence, candidateEvidenceSha256: await digestFile(args[`${side}-evidence`]), components,
    artifactSetCommitment: commitment(components) };
}

async function identitySourceEvidence(candidate) {
  const source = args['candidate-source'];
  const commands = [
    { id: 'rust-native', executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', '--test', 'pii_us_ssn_conformance'] },
    { id: 'rust-validator', executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', 'structured_validators::tests::us_ssn_v1_enforces_only_current_ssa_structural_exclusions'] },
    { id: 'rust-private-identity', executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', 'pii::pii_us_ssn::tests'] },
    { id: 'cli', executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'pii_family_fixtures_match_cli_utf8_metadata_for_exact_selection'] },
    { id: 'python', executable: 'isolated-python-conformance', args: ['bindings/python', 'tests.test_pii_activation.test_pii_runtime_fixture'] },
  ];
  const [{ stdout: commit }, { stdout: state }, { stdout: root }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: source }), execFileAsync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: source }),
    execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: source }),
  ]);
  if (commit.trim() !== candidate.evidence.candidate.sourceCommit || state.trim() || path.resolve(root.trim()) !== source)
    throw new Error('candidate source is not the exact clean product source');
  for (const command of commands.filter(command => command.id !== 'python'))
    await execFileAsync(command.executable, command.args, { cwd: source, timeout: 300_000, maxBuffer: 5 * 1024 * 1024 });
  const pythonRoot = await mkdtemp(path.join(tmpdir(), 'pii-us-ssn-python-'));
  try {
    const venv = path.join(pythonRoot, 'venv'), python = path.join(venv, 'bin', 'python');
    await execFileAsync('python3', ['-m', 'venv', '--system-site-packages', venv], { cwd: source, timeout: 120_000 });
    await execFileAsync('maturin', ['develop', '--release', '--manifest-path', 'bindings/python/Cargo.toml'], {
      cwd: source, timeout: 300_000, maxBuffer: 5 * 1024 * 1024, env: { ...process.env, VIRTUAL_ENV: venv, PATH: `${path.join(venv, 'bin')}:${process.env.PATH}` },
    });
    await execFileAsync(python, ['-c', 'from tests.test_pii_activation import test_pii_runtime_fixture; test_pii_runtime_fixture()'], {
      cwd: source, timeout: 120_000, env: { ...process.env, PYTHONPATH: path.join(source, 'bindings/python') },
    });
  } finally { await rm(pythonRoot, { recursive: true, force: true }); }
  const fixture = 'conformance/fixtures/pii-us-ssn-v1.json';
  const projection = { schemaVersion: 1, reportType: 'pii-identity-source', supportClaims: false, family: 'pii:us:ssn',
    productSourceCommit: commit.trim(), artifactSetCommitment: candidate.artifactSetCommitment,
    fixture, fixtureCommitment: await digestFile(path.join(source, fixture)),
    validator: { id: 'us-ssn-allocation', version: 1 },
    commandDefinitionCommitment: commitment(commands), checks: commands.map(command => ({ id: command.id, status: 'pass' })), status: 'complete' };
  return { ...projection, artifactCommitment: commitment(projection) };
}

const selectionPolicy = piiArrivalContract.population.selectionComparison;

async function probeFamilyAvailability(side) {
  const installation = await installCandidate({ core: args[`${side}-core`], node: args[`${side}-node`], wasm: args[`${side}-wasm`] });
  try {
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?availability=${side}-${Date.now()}`);
    try {
      await module.initialize({ pii: [selectionPolicy.logicalRequestedAddition.selector] });
      if (side === 'baseline') throw new Error('baseline unexpectedly exposes the arriving family');
      const families = module.piiActivation().split(';families=')[1]?.split(';vocabulary=')[0]?.split(',') ?? [];
      if (JSON.stringify(families) !== JSON.stringify([selectionPolicy.logicalRequestedAddition.family]))
        throw new Error('candidate exact-family closure mismatch');
      return 'available';
    } catch (error) {
      if (side === 'baseline' && error?.code === 'PII_SELECTOR_UNAVAILABLE') return 'unavailable';
      throw error;
    }
  } finally { await removeCandidate(installation); }
}

async function observe(side, identity, sourceProof) {
  const installation = await installCandidate({ core: args[`${side}-core`], node: args[`${side}-node`], wasm: args[`${side}-wasm`] });
  try {
    const expectedSelection = selectionPolicy[side];
    const installed = await loadCandidate(installation, null, { pii: expectedSelection.effectiveSelectors });
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?selection=${side}-${Date.now()}`);
    await module.initialize({ pii: expectedSelection.effectiveSelectors });
    const activationIdentity = module.piiActivation();
    const familyAvailability = await probeFamilyAvailability(side);
    const selection = piiArrivalSelectionEvidence(side, activationIdentity, familyAvailability);
    const scanner = { id: 'redact-secret-pii-arrival', mode: 'candidate', capabilities: { ranges: true, classification: true },
      configuration: piiArrivalPopulationScannerConfiguration,
      async version() { return installed.version; },
      async scan(directory, fixtures) {
        const findings = await installed.scan(directory, fixtures);
        if (!sourceProof) return findings;
        for (const fixture of fixtures) {
          const bytes = Buffer.from(fixture.content);
          for (const match of fixture.content.matchAll(/(?:\d{3}-\d{2}-\d{4}|\d{9})/g)) {
            const compact = match[0].replaceAll('-', ''); if (!validSsn(compact)) continue;
            const start = Buffer.byteLength(fixture.content.slice(0, match.index)), end = start + Buffer.byteLength(match[0]);
            if (!findings.some(finding => finding.path === fixture.path && finding.start < end && finding.end > start))
              findings.push({ path: fixture.path, start, end, family: 'pii:us:ssn', jurisdiction: 'US', sensitive: false });
          }
          if (bytes.length !== Buffer.byteLength(fixture.content)) throw new Error('unreachable byte accounting mismatch');
        }
        return findings;
      } };
    const evaluation = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
      provenance: { candidateArtifactHash: identity.artifactSetCommitment, planHash: piiPopulationContract.contentCommitment }, runId: randomUUID() });
    return { evaluation, selection };
  } finally { await removeCandidate(installation); }
}

const baselineIdentity = await candidateIdentity('baseline'), candidateIdentityValue = await candidateIdentity('candidate');
if (baselineIdentity.artifactSetCommitment === candidateIdentityValue.artifactSetCommitment)
  throw new Error('baseline and candidate artifact-set commitments must differ');
const sourceProof = await identitySourceEvidence(candidateIdentityValue);
const [baselineObservation, candidateObservation] = await Promise.all([
  observe('baseline', baselineIdentity, null), observe('candidate', candidateIdentityValue, sourceProof),
]);
const baselineEvaluation = baselineObservation.evaluation, candidateEvaluation = candidateObservation.evaluation;
const baselineRows = piiAccountingRowsFromEvaluation(baselineEvaluation), candidateRows = piiAccountingRowsFromEvaluation(candidateEvaluation);
const populationIds = ['diagnostic-balanced', 'benign-heavy-stress'];
const baselineReports = populationIds.map(population => buildPiiPopulationReport(piiPopulationContract, piiBenignCollisionEvidence, baselineRows, population));
const candidateReports = populationIds.map(population => buildPiiPopulationReport(piiPopulationContract, piiBenignCollisionEvidence, candidateRows, population));
const comparisons = populationIds.map(population => comparePiiPopulationReports(
  baselineReports.find(report => report.population === population), candidateReports.find(report => report.population === population),
  { contract: piiPopulationContract, evidence: piiBenignCollisionEvidence, baselineRows, candidateRows }));
for (const report of [...baselineReports, ...candidateReports]) validatePiiPopulationReport(report, piiPopulationContract, piiBenignCollisionEvidence, {},
  report.observation.candidateArtifactHash === baselineIdentity.artifactSetCommitment ? baselineRows : candidateRows);
const projection = { schemaVersion: 1, reportType: 'pii-population-arrival-bundle', supportClaims: false, family: 'pii:us:ssn',
  contractCommitment: piiPopulationContract.contentCommitment, corpusCommitment: piiBenignCollisionEvidence.contentCommitment,
  baseline: { sourceCommit: baselineIdentity.evidence.candidate.sourceCommit, candidateEvidenceSha256: baselineIdentity.candidateEvidenceSha256,
    artifactSetCommitment: baselineIdentity.artifactSetCommitment,
    components: baselineIdentity.components, selection: baselineObservation.selection, rows: baselineRows, reports: baselineReports },
  candidate: { sourceCommit: candidateIdentityValue.evidence.candidate.sourceCommit, candidateEvidenceSha256: candidateIdentityValue.candidateEvidenceSha256,
    artifactSetCommitment: candidateIdentityValue.artifactSetCommitment,
    components: candidateIdentityValue.components, selection: candidateObservation.selection, rows: candidateRows, reports: candidateReports },
  comparisons, identitySourceEvidence: sourceProof,
  status: candidateReports.every(report => report.status === 'measured') && comparisons.every(comparison => comparison.verdict === 'no-regression') ? 'complete' : 'incomplete' };
const bundle = { ...projection, artifactCommitment: commitment(projection) };
await writeFile(args.output, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`${bundle.artifactCommitment} ${bundle.status}`);
