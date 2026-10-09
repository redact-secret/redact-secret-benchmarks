import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { validateEvidence } from '../benchmarks/evaluation/evidence.ts';
import { validatePiiArrivalCandidateBinding, validatePiiArrivalOperational, validatePiiArrivalQualificationReadiness,
  validatePiiArrivalProtectedEvidence, validatePiiPopulationArrivalBundle, piiArrivalCommitment,
  piiArrivalContractCommitment, piiArrivalFamilyContractCommitment,
  piiArrivalViewGateStatuses } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { evaluatePiiIdentityOracle, piiIdentityOracle, validatePiiIdentityOracle,
  validatePiiOracleFamily } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { piiBindingArtifactCommitment } from '../benchmarks/evaluation/domains/pii/product-binding.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';

import { writeFileSync } from 'node:fs';
import { measurementOutput, stagedMeasurementDirectory } from './lib/measurement-output.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg); if (!match) throw new Error('invalid arguments'); return [match[1], path.resolve(match[2])];
}));
for (const key of ['candidate-evidence', 'core', 'node', 'wasm', 'plan', 'activation-output', 'qualification-output']) if (!args[key]) throw new Error(`missing --${key}`);
if (path.dirname(args['activation-output']) !== path.dirname(args['qualification-output']) || args['activation-output'] === args['qualification-output'])
  throw new Error('activation and qualification require distinct files in the same fresh run directory');
const outputDir = measurementOutput(path.dirname(args['activation-output']), root, { directory: true });
const candidate = JSON.parse(await readFile(args['candidate-evidence'], 'utf8')); validateEvidence(candidate, 'candidate');
if (candidate.status !== 'complete' || candidate.candidate.sourceState !== 'clean' || candidate.benchmark.dirty !== false) throw new Error('candidate evidence is not complete and clean');
const artifact = role => candidate.candidate.artifacts.find(row => row.role === role)?.sha256;
const digestFile = async location => createHash('sha256').update(await readFile(location)).digest('hex');
const actualComponents = { core: await digestFile(args.core), node: await digestFile(args.node), wasm: await digestFile(args.wasm) };
const actualPackedSizes = { core: (await stat(args.core)).size, node: (await stat(args.node)).size, wasm: (await stat(args.wasm)).size };
const actualCandidateEvidenceSha256 = await digestFile(args['candidate-evidence']);
if (actualComponents.core !== artifact('package') || actualComponents.node !== artifact('node') || actualComponents.wasm !== artifact('wasm'))
  throw new Error('candidate component identity mismatch');
const plan = JSON.parse(await readFile(args.plan, 'utf8'));
if (plan.schemaVersion !== 1 || !/^pii:(?:global|[a-z]{2}):/.test(plan.family) || !/^pii_[a-z0-9_]+$/.test(plan.findingType) ||
    !Number.isInteger(plan.familyContractVersion ?? 1) || (plan.familyContractVersion ?? 1) < 1 ||
    typeof plan.piiOffInput !== 'string' || !plan.piiOffInput || !Array.isArray(plan.activationChecks) || plan.activationChecks.length < 2 ||
    plan.activationChecks.some(check => !Array.isArray(check.selectors) || !check.selectors.length || typeof check.expectedActivationIdentity !== 'string') ||
    !Array.isArray(plan.cases) || !plan.cases.length || !Array.isArray(plan.classAccounting) || !plan.classAccounting.length) throw new Error('invalid PII qualification plan');
const planCommitment = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
// #423: every plan case must carry an authored identity/sensitivity oracle label, bound to this exact plan. This is
// also where the plan's `sensitive` label is finally checked (true => oracle sensitive; false => non-sensitive or
// not-established, and never on a public-finding expectation).
const identityOracle = validatePiiIdentityOracle(piiIdentityOracle);
const oracleFamily = identityOracle.families.find(row => row.family === plan.family);
if (!oracleFamily) throw new Error('no identity oracle entry for this PII family');
validatePiiOracleFamily(oracleFamily, plan);
const productIdentityEvidence = args['product-identity-evidence'] ?
  JSON.parse(await readFile(args['product-identity-evidence'], 'utf8')) : null;
const candidateEvidenceCommitment = createHash('sha256').update(JSON.stringify(candidate)).digest('hex');
const product = { repository: 'redact-secret/redact-secret', sourceCommit: candidate.candidate.sourceCommit,
  artifactCommitment: candidate.candidate.artifactSha256, candidateEvidenceCommitment };
let arrivalEvidence = null;
let arrivalGateStatuses = null;
if (plan.family === 'pii:us:ssn') {
  for (const key of ['population-evidence', 'operational-evidence'])
    if (!args[key]) throw new Error(`missing --${key} for US SSN arrival qualification`);
  if (!args['protected-evidence'] && (!args['holdout-evidence'] || !args['holdout-trust']))
    throw new Error('missing protected evidence for US SSN arrival qualification');
  if (args['protected-evidence'] && (args['holdout-evidence'] || args['holdout-trust']))
    throw new Error('protected evidence inputs are mutually exclusive');
  const population = validatePiiPopulationArrivalBundle(JSON.parse(await readFile(args['population-evidence'], 'utf8')));
  const operational = validatePiiArrivalOperational(JSON.parse(await readFile(args['operational-evidence'], 'utf8')), population);
  validatePiiArrivalCandidateBinding(population, operational, product.sourceCommit, actualComponents, actualPackedSizes,
    actualCandidateEvidenceSha256);
  const protectedInput = args['protected-evidence'] ? JSON.parse(await readFile(args['protected-evidence'], 'utf8')) : {
    state: 'completed', report: JSON.parse(await readFile(args['holdout-evidence'], 'utf8')),
    trust: JSON.parse(await readFile(args['holdout-trust'], 'utf8')),
  };
  const protectedEvidence = validatePiiArrivalProtectedEvidence(protectedInput, {
    familyContractCommitment: piiArrivalFamilyContractCommitment, productSourceCommit: product.sourceCommit, candidateEvidenceCommitment,
    candidateArtifactSetCommitment: population.candidate.artifactSetCommitment,
    identitySourceCommitment: population.identitySourceEvidence.artifactCommitment,
    populationBundleCommitment: population.artifactCommitment, operationalCommitment: operational.artifactCommitment,
    populationStatus: population.status, operationalStatus: operational.status,
  });
  if (protectedEvidence.state === 'completed') validatePiiArrivalQualificationReadiness(population, operational, product.sourceCommit,
    actualComponents, actualPackedSizes, actualCandidateEvidenceSha256);
  const protectedProjection = protectedEvidence.state === 'completed' ? { state: 'completed',
    holdoutCommitment: protectedEvidence.reportCommitment, trustCommitment: protectedEvidence.trust.artifactCommitment,
    artifactCommitment: protectedEvidence.artifactCommitment } : { state: 'unspent',
    attestationCommitment: protectedEvidence.artifactCommitment,
    artifactCommitment: piiArrivalCommitment({ state: 'unspent', attestationCommitment: protectedEvidence.artifactCommitment }) };
  const arrivalProjection = {
    contractCommitment: piiArrivalContractCommitment,
    identitySourceCommitment: population.identitySourceEvidence.artifactCommitment,
    populationBundleCommitment: population.artifactCommitment,
    operationalCommitment: operational.artifactCommitment,
    artifactSetCommitment: population.candidate.artifactSetCommitment,
    publicGateStatus: { populationNoRegression: population.status === 'complete' ? 'met' : 'not-met',
      runtimeAndPackageCost: operational.status === 'complete' ? 'met' : 'not-met' },
    protectedEvidence: protectedProjection,
  };
  arrivalEvidence = { ...arrivalProjection, artifactCommitment: piiArrivalCommitment(arrivalProjection) };
  arrivalGateStatuses = piiArrivalViewGateStatuses(population, operational, protectedEvidence.state);
}

const execFileAsync = promisify(execFile);
const sourceEnvironmentPolicy = Object.freeze({
  inherit: ['PATH', 'HOME', 'TMPDIR', 'CARGO_HOME', 'RUSTUP_HOME', 'LANG', 'LC_ALL', 'SYSTEMROOT'],
  fixed: { CARGO_TERM_COLOR: 'never', NO_COLOR: '1', PYTHONNOUSERSITE: '1' },
});
const commandEnvironment = { ...Object.fromEntries(sourceEnvironmentPolicy.inherit.flatMap(key =>
  process.env[key] === undefined ? [] : [[key, process.env[key]]])), ...sourceEnvironmentPolicy.fixed };
const sourceDefinitions = Object.freeze({
  'rust-native-email-conformance': {
    fixture: 'conformance/fixtures/pii-email-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', '--test', 'pii_email_conformance'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'cli-email-conformance': {
    fixture: 'conformance/fixtures/pii-email-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'email_family_fixture_matches_cli_utf8_metadata_for_exact_selection'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'python-email-conformance': {
    fixture: 'conformance/fixtures/pii-email-v1.json',
    commands: [{ executable: 'python3', args: ['-m', 'venv', '--system-site-packages', '{venv}'] },
      { executable: 'maturin', args: ['develop', '--release', '--manifest-path', 'bindings/python/Cargo.toml'], venv: true },
      { executable: '{python}', args: ['-c', 'from tests.test_pii_activation import test_pii_runtime_fixture; test_pii_runtime_fixture()'],
        venv: true, pythonPath: 'bindings/python' }],
    toolchains: [{ executable: 'python3', args: ['--version'] }, { executable: 'maturin', args: ['--version'] },
      { executable: 'rustc', args: ['--version'] }],
  },
  'rust-native-iban-conformance': {
    fixture: 'conformance/fixtures/pii-iban-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', '--test', 'pii_iban_conformance'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'cli-iban-conformance': {
    fixture: 'conformance/fixtures/pii-iban-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'pii_family_fixtures_match_cli_utf8_metadata_for_exact_selection'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'python-iban-conformance': {
    fixture: 'conformance/fixtures/pii-iban-v1.json',
    commands: [{ executable: 'python3', args: ['-m', 'venv', '--system-site-packages', '{venv}'] },
      { executable: 'maturin', args: ['develop', '--release', '--manifest-path', 'bindings/python/Cargo.toml'], venv: true },
      { executable: '{python}', args: ['-c', 'from tests.test_pii_activation import test_pii_runtime_fixture; test_pii_runtime_fixture()'],
        venv: true, pythonPath: 'bindings/python' }],
    toolchains: [{ executable: 'python3', args: ['--version'] }, { executable: 'maturin', args: ['--version'] },
      { executable: 'rustc', args: ['--version'] }],
  },
  'rust-native-payment-card-conformance': {
    fixture: 'conformance/fixtures/pii-payment-card-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', '--test', 'pii_payment_card_conformance'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'cli-payment-card-conformance': {
    fixture: 'conformance/fixtures/pii-payment-card-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'payment_card_family_fixture_matches_cli_utf8_metadata_for_exact_selection'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'python-payment-card-conformance': {
    fixture: 'conformance/fixtures/pii-payment-card-v1.json',
    commands: [{ executable: 'python3', args: ['-m', 'venv', '--system-site-packages', '{venv}'] },
      { executable: 'maturin', args: ['develop', '--release', '--manifest-path', 'bindings/python/Cargo.toml'], venv: true },
      { executable: '{python}', args: ['-c', 'from tests.test_pii_activation import test_pii_runtime_fixture; test_pii_runtime_fixture()'],
        venv: true, pythonPath: 'bindings/python' }],
    toolchains: [{ executable: 'python3', args: ['--version'] }, { executable: 'maturin', args: ['--version'] },
      { executable: 'rustc', args: ['--version'] }],
  },
  'rust-native-phone-conformance': {
    fixture: 'conformance/fixtures/pii-phone-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', '--test', 'pii_phone_conformance'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'cli-phone-conformance': {
    fixture: 'conformance/fixtures/pii-phone-v1.json',
    commands: [
      { executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'phone_family_fixture_matches_cli_for_global_streamed_and_file_paths'] },
      { executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'pii_family_fixtures_match_cli_utf8_metadata_for_exact_selection'] },
    ],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'python-phone-conformance': {
    fixture: 'conformance/fixtures/pii-phone-v1.json',
    commands: [{ executable: 'python3', args: ['-m', 'venv', '--system-site-packages', '{venv}'] },
      { executable: 'maturin', args: ['develop', '--release', '--manifest-path', 'bindings/python/Cargo.toml'], venv: true },
      { executable: '{python}', args: ['-c', 'from tests.test_pii_activation import test_pii_runtime_fixture; test_pii_runtime_fixture()'],
        venv: true, pythonPath: 'bindings/python' },
      { executable: '{python}', args: ['-c', 'from tests.test_pii_activation import test_phone_exact_global_and_off_in_fresh_processes_with_every_partition; test_phone_exact_global_and_off_in_fresh_processes_with_every_partition()'],
        venv: true, pythonPath: 'bindings/python' },
    ],
    toolchains: [{ executable: 'python3', args: ['--version'] }, { executable: 'maturin', args: ['--version'] },
      { executable: 'rustc', args: ['--version'] }],
  },
  'rust-native-us-ssn-conformance': {
    fixture: 'conformance/fixtures/pii-us-ssn-v1.json',
    commands: [
      { executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', '--test', 'pii_us_ssn_conformance'] },
      { executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', 'structured_validators::tests::us_ssn_v1_enforces_only_current_ssa_structural_exclusions'] },
      { executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret', 'pii::pii_us_ssn::tests'] },
    ],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'cli-us-ssn-conformance': {
    fixture: 'conformance/fixtures/pii-us-ssn-v1.json',
    commands: [{ executable: 'cargo', args: ['test', '--locked', '-p', 'redact-secret-cli', 'pii_family_fixtures_match_cli_utf8_metadata_for_exact_selection'] }],
    toolchains: [{ executable: 'rustc', args: ['--version'] }, { executable: 'cargo', args: ['--version'] }],
  },
  'python-us-ssn-conformance': {
    fixture: 'conformance/fixtures/pii-us-ssn-v1.json',
    commands: [{ executable: 'python3', args: ['-m', 'venv', '--system-site-packages', '{venv}'] },
      { executable: 'maturin', args: ['develop', '--release', '--manifest-path', 'bindings/python/Cargo.toml'], venv: true },
      { executable: '{python}', args: ['-c', 'from tests.test_pii_activation import test_pii_runtime_fixture; test_pii_runtime_fixture()'],
        venv: true, pythonPath: 'bindings/python' }],
    toolchains: [{ executable: 'python3', args: ['--version'] }, { executable: 'maturin', args: ['--version'] },
      { executable: 'rustc', args: ['--version'] }],
  },
});
const digest = value => createHash('sha256').update(value).digest('hex');
const utf16ToByteOffset = (input, offset) => {
  let units = 0, bytes = 0;
  for (const scalar of input) {
    if (units === offset) return bytes;
    units += scalar.length; bytes += Buffer.byteLength(scalar);
    if (units > offset) throw new Error('finding offset splits a UTF-16 surrogate pair');
  }
  if (units !== offset) throw new Error('finding offset exceeds input');
  return bytes;
};
const run = async (executable, commandArgs, options = {}) => execFileAsync(executable, commandArgs, {
  cwd: options.cwd, env: options.env ?? commandEnvironment, timeout: 300_000, maxBuffer: 5 * 1024 * 1024,
});

async function runSourceConformance() {
  const ids = plan.sourceConformanceIds;
  if (ids === undefined) return null;
  if (!args['product-source'] || !Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length ||
      ids.some(id => !Object.hasOwn(sourceDefinitions, id))) throw new Error('invalid source conformance selection');
  const source = path.resolve(args['product-source']);
  const verifySource = async () => {
    const [{ stdout: root }, { stdout: sourceCommit }, { stdout: sourceState }] = await Promise.all([
      run('git', ['rev-parse', '--show-toplevel'], { cwd: source }), run('git', ['rev-parse', 'HEAD'], { cwd: source }),
      run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: source }),
    ]);
    if (path.resolve(root.trim()) !== source || sourceCommit.trim() !== product.sourceCommit || sourceState.trim() !== '')
      throw new Error('product source is not the exact clean candidate commit');
  };
  await verifySource();
  const lanes = [];
  for (const id of ids) {
    const definition = sourceDefinitions[id];
    const fixtureCommitment = await digestFile(path.join(source, definition.fixture));
    const toolchain = [];
    for (const probe of definition.toolchains) {
      const { stdout, stderr } = await run(probe.executable, probe.args, { cwd: source });
      toolchain.push({ executable: probe.executable, version: `${stdout}${stderr}`.trim() });
    }
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'redact-secret-pii-source-'));
    try {
      const venv = path.join(temporary, 'venv'), python = path.join(venv, 'bin', 'python');
      for (const command of definition.commands) {
        const executable = command.executable === '{python}' ? python : command.executable;
        const commandArgs = command.args.map(value => value === '{venv}' ? venv : value);
        const env = command.venv ? { ...commandEnvironment, VIRTUAL_ENV: venv, PATH: `${path.join(venv, 'bin')}${path.delimiter}${process.env.PATH}`,
          ...(command.pythonPath ? { PYTHONPATH: path.join(source, command.pythonPath) } : {}) } : commandEnvironment;
        await run(executable, commandArgs, { cwd: source, env });
      }
    } finally { await rm(temporary, { recursive: true, force: true }); }
    lanes.push({ id, status: 'pass', fixture: definition.fixture, fixtureCommitment,
      commandDefinitionCommitment: digest(JSON.stringify({ definition, environmentPolicy: sourceEnvironmentPolicy })), toolchain });
  }
  await verifySource();
  const evidence = { sourceCommit: product.sourceCommit, sourceState: 'clean', lanes, artifactCommitment: '' };
  evidence.artifactCommitment = piiBindingArtifactCommitment(evidence);
  return evidence;
}

async function runSurfaceCheck(id, fallback, check, captureCases) {
  const installation = await installCandidate({ core: args.core, node: args.node, wasm: args.wasm });
  try {
    if (fallback) {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?surface=${id}-${Date.now()}`);
    await module.initialize({ pii: check.selectors });
    const activationIdentity = module.piiActivation();
    if (activationIdentity !== check.expectedActivationIdentity) throw new Error('activation identity mismatch');
    const observations = [];
    for (const row of plan.cases) {
      const findings = module.scan(row.input).filter(finding => finding.type === plan.findingType);
      if (row.expected.publicFinding) {
        if (row.expected.sensitive !== true || findings.length !== 1 || findings[0].action !== 'redact') throw new Error(`case failed: ${row.id}`);
        const canonicalRange = { start: utf16ToByteOffset(row.input, findings[0].start), end: utf16ToByteOffset(row.input, findings[0].end) };
        if (canonicalRange.start !== row.expected.start || canonicalRange.end !== row.expected.end) throw new Error(`case failed: ${row.id}`);
        if (captureCases) observations.push({ id: row.id, publicFinding: true, type: findings[0].type, action: findings[0].action,
          nativeOffsetUnit: 'utf16-code-unit', nativeRange: { start: findings[0].start, end: findings[0].end }, canonicalRange });
      } else if (findings.length || row.expected.sensitive === true) throw new Error(`case failed: ${row.id}`);
      else if (captureCases) observations.push({ id: row.id, publicFinding: false, type: null, action: null,
        nativeOffsetUnit: 'utf16-code-unit', nativeRange: null, canonicalRange: null });
    }
    return { activation: { selectors: check.selectors, activationIdentity,
      availableFamilies: activationIdentity.split(';families=')[1].split(';vocabulary=')[0].split(',') }, observations };
  } finally { await removeCandidate(installation); }
}
const surfaceConfigurations = [['node-addon', false], ['node-wasm', true]];
const surfaces = [];
const installedLanes = [];
for (const [id, fallback] of surfaceConfigurations) {
  const activationChecks = [];
  for (const [index, check] of plan.activationChecks.entries()) {
    const result = await runSurfaceCheck(id, fallback, check, index === 0);
    activationChecks.push(result.activation);
    if (index === 0) installedLanes.push({ id, status: 'pass', nativeOffsetUnit: 'utf16-code-unit', observations: result.observations });
  }
  surfaces.push({ id, status: 'pass', activationChecks });
}
const offSurfaces = [];
for (const [id, fallback] of surfaceConfigurations) {
  const installation = await installCandidate({ core: args.core, node: args.node, wasm: args.wasm });
  try {
    if (fallback) {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?off=${id}-${Date.now()}`);
    await module.initialize();
    if (module.scan(plan.piiOffInput).some(finding => finding.type === plan.findingType)) throw new Error('PII-off invariant failed');
    offSurfaces.push({ id, status: 'pass' });
  } finally { await removeCandidate(installation); }
}
const primary = surfaces[0].activationChecks[0];
const activation = { schemaVersion: 1, reportType: 'pii-activation-evidence', supportClaims: false, product,
  profile: plan.profile, requestedSelectors: primary.selectors, activationIdentity: primary.activationIdentity,
  availableFamilies: primary.availableFamilies, selectorChecks: surfaces[0].activationChecks, surfaces, offSurfaces, artifactCommitment: '' };
activation.artifactCommitment = piiBindingArtifactCommitment(activation);
const installedArtifactConformance = { canonicalOffsetUnit: plan.canonicalOffsetUnit, lanes: installedLanes, artifactCommitment: '' };
installedArtifactConformance.artifactCommitment = piiBindingArtifactCommitment(installedArtifactConformance);
const sourceConformance = await runSourceConformance();
const identityOracleProjection = evaluatePiiIdentityOracle({ plan, oracle: identityOracle,
  productSourceCommit: product.sourceCommit, candidateArtifactCommitment: product.artifactCommitment,
  artifactSetCommitment: piiArrivalCommitment(actualComponents),
  publicObservations: installedLanes.map(lane => lane.observations), productIdentity: productIdentityEvidence });
const gates = [
  { id: 'exact-candidate-artifact', status: 'met' }, { id: 'selector-global-closure', status: 'met' },
  { id: 'selector-exact-family', status: 'met' }, { id: 'cross-surface-determinism', status: 'met' },
  { id: 'sensitive-public-findings', status: 'met' }, { id: 'public-absence-controls', status: 'met' },
  { id: 'identity-only-classification', status: identityOracleProjection.gateStatus },
  { id: 'exact-source-conformance', status: sourceConformance ? 'met' : 'not-applicable' },
  { id: 'pii-off-invariance', status: 'met' }, { id: 'diagnostic-population', status: arrivalGateStatuses?.diagnostic ?? 'unresolved' },
  { id: 'benign-heavy-population', status: arrivalGateStatuses?.benignHeavy ?? 'unresolved' },
  { id: 'population-no-regression', status: arrivalGateStatuses?.population ?? 'unresolved' },
  { id: 'protected-partition', status: arrivalGateStatuses?.protected ?? 'unresolved' },
  { id: 'runtime-and-package-cost', status: arrivalGateStatuses?.operational ?? 'unresolved' },
];
const classAccounting = plan.classAccounting.map(entry => {
  if (!/^[a-z][a-z0-9-]+$/.test(entry.id) || !['measured', 'unresolved'].includes(entry.status)) throw new Error('invalid PII class accounting');
  const observations = plan.cases.filter(row => row.classes?.includes(entry.id)).length * surfaces.length;
  if ((entry.status === 'measured' && observations === 0) || (entry.status === 'unresolved' && observations !== 0))
    throw new Error('PII class accounting does not match executed cases');
  return { id: entry.id, status: entry.status, observations };
});
gates.push(...classAccounting.filter(entry => entry.status === 'unresolved').map(entry => ({ id: `class-${entry.id}`, status: 'unresolved' })));
const reasonCodes = gates.filter(gate => !['met', 'not-applicable'].includes(gate.status)).map(gate => gate.id).sort();
// schemaVersion 2 (#423): gates are independent signals and the identity-only gate comes from the identity oracle.
// Frozen schemaVersion 1 records keep their original meaning and are not rewritten.
const qualification = { schemaVersion: 2, reportType: 'pii-family-qualification', supportClaims: false, family: plan.family, product,
  activationArtifactCommitment: activation.artifactCommitment, planCommitment, profile: plan.profile, gates, classAccounting,
  identityOracle: identityOracleProjection,
  ...(sourceConformance ? { installedArtifactConformance, sourceConformance } : {}),
  ...(arrivalEvidence ? { arrivalEvidence } : {}),
  status: reasonCodes.length ? 'not-qualified' : 'qualified',
  reasonCodes, artifactCommitment: '' };
qualification.artifactCommitment = piiBindingArtifactCommitment(qualification);
stagedMeasurementDirectory(outputDir, stage => {
  writeFileSync(path.join(stage, path.basename(args['activation-output'])), `${JSON.stringify(activation, null, 2)}\n`);
  writeFileSync(path.join(stage, path.basename(args['qualification-output'])), `${JSON.stringify(qualification, null, 2)}\n`);
});
console.log(`PII activation ${activation.artifactCommitment}; qualification ${qualification.artifactCommitment} (${qualification.status})`);
