/**
 * Beta.11 PII C3 (benchmarks #426): measure the exact released beta.10 npm artifacts on the frozen US SSN and
 * phone stress plans, replay the frozen v1 qualification plans (before-state), and re-measure the v1 populations
 * (#408/#411-corrected corpus) against the lockfile release.
 *
 * The artifacts are the published `0.1.0-beta.10` tarballs (`npm pack`), accepted only if they equal the release
 * manifest digests the #422 ledger copied: the facade tarball's SHA-1 and every file digest of the platform Node
 * addon and the Wasm package. Only counts, commitments and deviating case ids are written; never an input,
 * candidate value, range or finding text. The protected partition is not run here (#428).
 *
 * Run: node --import tsx scripts/measure-pii-ssn-phone-stress.mjs --core=… --node=… --wasm=… --output-dir=evidence/901/426
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib';
import { applyC3Corrections, c3Files, c3Commitment, materializeC3Case, summarizeC3Surface, validateC3File } from '../benchmarks/evaluation/domains/pii/ssn-phone-stress.ts';
import { PII_ORACLE_PLANS, PII_ORACLE_UNAVAILABLE_REASON, piiIdentityOracle, piiIdentityOracleCommitment, piiOraclePlanCommitment,
  validatePiiIdentityOracle } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { observePiiPopulations, packLockfileRelease } from './observe-pii-populations.mjs';

const exec = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(core|node|wasm|output-dir|iterations|corrections)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unknown argument ${argument}`); return [match[1], match[2]];
}));
for (const key of ['core', 'node', 'wasm', 'output-dir']) if (!args[key]) throw new Error(`missing --${key}`);
const ITERATIONS = Number(args.iterations ?? 25);
const tarballs = { core: path.resolve(args.core), node: path.resolve(args.node), wasm: path.resolve(args.wasm) };
const outputDir = path.resolve(args['output-dir']);
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const git = async (...command) => (await exec('git', command)).stdout.trim();

// ---------------------------------------------------------------------------------------------------------------
// 1. Exact candidate binding: the published tarballs must equal the beta.10 release manifest the ledger copied.
// ---------------------------------------------------------------------------------------------------------------
const ledger = JSON.parse(await readFile('evidence/901/pii-gap-ledger-v1.json', 'utf8'));
const candidate = ledger.finalCandidate;
const manifestFiles = artifact => candidate.artifacts.filter(row => row.artifact === artifact);
async function extract(tarball) {
  const root = await mkdtemp(path.join(tmpdir(), 'pii-426-extract-'));
  await exec('tar', ['-xzf', tarball, '-C', root]);
  return path.join(root, 'package');
}
const binding = { version: candidate.version, tag: candidate.tag, sourceCommit: candidate.sourceCommit,
  releaseManifestSha256: candidate.releaseManifest.sha256, tarballs: {}, verifiedFiles: 0, unshippedManifestFiles: 0 };
{
  const [facade] = manifestFiles('npm:@redact-secret/core');
  if (facade.algorithm !== 'sha1' || digest(await readFile(tarballs.core), 'sha1') !== facade.digest) throw new Error('core tarball is not the released facade');
  for (const [role, file] of Object.entries(tarballs)) binding.tarballs[role] = { sha256: digest(await readFile(file)), bytes: (await stat(file)).size };
  for (const role of ['core', 'node', 'wasm']) {
    const root = await extract(tarballs[role]);
    try {
      const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
      if (pkg.version !== candidate.version) throw new Error(`${role} is not ${candidate.version}`);
      binding.tarballs[role].name = pkg.name;
      if (role === 'core') continue;
      const rows = manifestFiles(`npm:${pkg.name}`);
      if (!rows.length) throw new Error(`${pkg.name} is not in the release manifest`);
      // The manifest also lists build-stage loader files the published tarball does not ship (the node package's
      // index.js/index.d.ts). Every listed file that is shipped must match, and every binary payload must be shipped.
      for (const row of rows) {
        const location = path.join(root, row.file);
        const shipped = await stat(location).then(() => true, () => false);
        if (!shipped) { if (/\.(?:node|wasm)$/.test(row.file)) throw new Error(`${pkg.name} lacks ${row.file}`); binding.unshippedManifestFiles += 1; continue; }
        if (row.algorithm !== 'sha256' || digest(await readFile(location)) !== row.digest) throw new Error(`${pkg.name}/${row.file} differs from the release manifest`);
        binding.verifiedFiles += 1;
      }
    } finally { await rm(path.dirname(root), { recursive: true, force: true }); }
  }
}
binding.artifactSetCommitment = c3Commitment(Object.fromEntries(Object.entries(binding.tarballs).map(([role, row]) => [role, row.sha256])));

// ---------------------------------------------------------------------------------------------------------------
// 2. Frozen plans. The stress plans must be unmodified relative to the commit that froze them.
// ---------------------------------------------------------------------------------------------------------------
const oracle = validatePiiIdentityOracle(piiIdentityOracle);
const planPaths = Object.values(c3Files).map(entry => entry.path);
// The materializer may change; the frozen commitment inside each committed plan still pins every input.
if (await git('status', '--porcelain', '--', ...planPaths)) throw new Error('stress plans are not committed');
const benchmark = { repository: 'redact-secret/redact-secret-benchmarks', revision: await git('rev-parse', 'HEAD'),
  planFrozenAt: await git('log', '-1', '--format=%H', '--', ...planPaths) };

const FAMILIES = {
  'pii:us:ssn': { v1Plan: 'benchmarks/evaluation/domains/pii/us-ssn-qualification-v1.json',
    selections: { exact: ['pii:family:us:ssn'], closure: ['pii:us'], foreign: ['pii:global'], all: ['pii:global', 'pii:us'], off: null } },
  'pii:global:phone': { v1Plan: 'benchmarks/evaluation/domains/pii/phone-qualification-v1.json',
    selections: { exact: ['pii:family:global:phone'], closure: ['pii:global'], all: ['pii:global', 'pii:us'], off: null } },
};

/** Uniform rows: a frozen v2 stress case or a frozen v1 plan case with its #423 oracle label. */
function rowsFor(family) {
  const { file, path: planPath } = c3Files[family];
  const { plan } = validateC3File(structuredClone(file), ledger.axisBacklog, planPath);
  const stress = file.cases.map((row, index) => { const built = materializeC3Case(row);
    return { id: row.id, view: row.view, input: plan.cases[index].input, candidate: built.candidate, range: built.range,
      expectedFinding: row.expected.publicFinding, oracle: row.oracle }; });
  const v1 = PII_ORACLE_PLANS[family], labels = oracle.families.find(row => row.family === family).labels;
  const before = v1.cases.map((row, index) => { const label = labels[index];
    const range = label.candidate, bytes = Buffer.from(row.input, 'utf8');
    return { id: row.id, view: 'qualification-plan', input: row.input, candidate: range ? bytes.subarray(range.start, range.end).toString('utf8') : null,
      range, expectedFinding: row.expected.publicFinding, oracle: label }; });
  return { file, stress, before, stressCommitment: file.frozen.planCommitment, beforeCommitment: piiOraclePlanCommitment(v1) };
}

const utf16ToByte = (input, offset) => Buffer.byteLength(input.slice(0, offset), 'utf8');
const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };

async function withSurface(surface, selectors, body) {
  const installation = await installCandidate(tarballs);
  try {
    if (surface === 'node-wasm') {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?c3=${surface}-${Date.now()}-${Math.random()}`);
    await (selectors ? module.initialize({ pii: selectors }) : module.initialize());
    const loaded = module.artifact();
    if (loaded !== (surface === 'node-wasm' ? 'wasm' : 'addon')) throw new Error(`${surface} loaded ${loaded}`);
    return await body(module);
  } finally { await removeCandidate(installation); }
}

/** One selection on one surface: per-row family findings (byte ranges), overlaps, output and cost. Nothing textual is returned. */
function observeRows(module, rows, findingType, { cost = false } = {}) {
  return rows.map(row => {
    const findings = module.scan(row.input);
    const family = findings.filter(finding => finding.type === findingType)
      .map(finding => ({ start: utf16ToByte(row.input, finding.start), end: utf16ToByte(row.input, finding.end), action: finding.action }));
    const others = row.range ? [...new Set(findings.filter(finding => finding.type !== findingType &&
      overlaps({ start: utf16ToByte(row.input, finding.start), end: utf16ToByte(row.input, finding.end) }, row.range)).map(finding => finding.type))].sort() : [];
    const piiTypes = [...new Set(findings.filter(finding => finding.type.startsWith('pii_')).map(finding => finding.type))].sort();
    const redacted = module.scanAndRedact(row.input);
    const exactRange = row.range !== null && family.length === 1 && family[0].start === row.range.start && family[0].end === row.range.end;
    let scanNanoseconds = 0;
    if (cost) {
      for (let warm = 0; warm < 3; warm += 1) module.scan(row.input);
      const samples = [];
      for (let index = 0; index < ITERATIONS; index += 1) { const start = process.hrtime.bigint(); module.scan(row.input); samples.push(Number(process.hrtime.bigint() - start)); }
      scanNanoseconds = median(samples);
    }
    return { id: row.id, familyFindings: family, exactRange, piiTypes,
      outputContainsCandidate: Boolean(row.candidate) && redacted.text.includes(row.candidate),
      findingCarriesPlaintext: Boolean(row.candidate) && JSON.stringify(findings).includes(row.candidate),
      overlapTypes: others, scanNanoseconds };
  });
}
const signature = observations => observations.map(row => JSON.stringify(row.familyFindings.map(finding => [finding.start, finding.end, finding.action])));
const disagreements = (a, b) => signature(a).filter((value, index) => value !== signature(b)[index]).length;
const deviations = (rows, observations) => rows.flatMap((row, index) => {
  const seen = observations[index], flagged = seen.familyFindings.length > 0;
  if (row.expectedFinding && !(flagged && seen.exactRange)) return [{ id: row.id, view: row.view, outcome: flagged ? 'range-mismatch' : 'missed' }];
  if (!row.expectedFinding && flagged) return [{ id: row.id, view: row.view, outcome: 'false-alarm' }];
  return [];
});

const corrections = args.corrections ? JSON.parse(await readFile(path.resolve(args.corrections), 'utf8')) : null;
if (corrections && (corrections.reportType !== 'pii-c3-reviewed-corrections' || !Array.isArray(corrections.corrections))) throw new Error('invalid corrections');
const families = [];
for (const [family, config] of Object.entries(FAMILIES)) {
  const { file, stress, before, stressCommitment, beforeCommitment } = rowsFor(family);
  const findingType = file.findingType, all = [...stress, ...before];
  const surfaces = {};
  for (const surface of ['node-addon', 'node-wasm']) {
    const result = {};
    for (const [name, selectors] of Object.entries(config.selections)) {
      result[name] = await withSurface(surface, selectors, async module => ({ activation: module.piiActivation(),
        observations: observeRows(module, all, findingType, { cost: name === 'exact' }) }));
    }
    surfaces[surface] = result;
  }
  const split = observations => ({ stress: observations.slice(0, stress.length), before: observations.slice(stress.length) });
  const primary = split(surfaces['node-addon'].exact.observations), wasm = split(surfaces['node-wasm'].exact.observations);
  const beforeFile = { cases: before.map(row => ({ id: row.id, view: row.view, oracle: row.oracle })), populations: [] };
  const activation = Object.fromEntries(Object.entries(config.selections).map(([name, selectors]) => {
    const perSurface = Object.values(surfaces).map(result => result[name]);
    const familyFindings = perSurface.reduce((sum, result) => sum + result.observations.filter(row => row.familyFindings.length).length, 0);
    const piiFindings = perSurface.reduce((sum, result) => sum + result.observations.filter(row => row.piiTypes.length).length, 0);
    const identity = perSurface[0].activation;
    const available = /;families=([^;]*)/.exec(identity)?.[1].split(',').filter(Boolean) ?? [];
    return [name, { selectors: selectors ?? [], activationIdentity: identity, activationAgreesAcrossSurfaces: perSurface.every(result => result.activation === identity),
      familyAvailable: available.includes(family), casesWithFamilyFinding: familyFindings, casesWithAnyPiiFinding: piiFindings }];
  }));
  const overlapFrom = observations => { const counts = {}; for (const row of observations) for (const type of row.overlapTypes) counts[type] = (counts[type] ?? 0) + 1; return counts; };
  const allSplit = split(surfaces['node-addon'].all.observations);
  families.push({
    family, findingType,
    plans: {
      stress: { path: c3Files[family].path, planCommitment: stressCommitment, cases: stress.length },
      beforeState: { path: config.v1Plan, planCommitment: beforeCommitment, cases: before.length, oracleCommitment: piiIdentityOracleCommitment(oracle) },
    },
    stress: {
      addon: summarizeC3Surface(file, primary.stress),
      wasmPublicStream: Object.fromEntries(Object.entries(summarizeC3Surface(file, wasm.stress).views).map(([view, row]) => [view, row.publicStream])),
      deviations: deviations(stress, primary.stress),
      crossFamilyOverlapAllSelectors: overlapFrom(allSplit.stress),
      afterReviewedCorrections: corrections ? (() => {
        const deviating = deviations(stress, primary.stress).map(row => row.id);
        const corrected = applyC3Corrections(file, corrections.corrections, deviating);
        const correctedRows = stress.map((row, index) => ({ ...row, expectedFinding: corrected.cases[index].expected.publicFinding }));
        return { correctedCases: corrections.corrections.filter(row => row.family === family).map(row => row.caseId),
          views: Object.fromEntries(Object.entries(summarizeC3Surface(corrected, primary.stress).views).map(([view, row]) => [view, row])),
          outputLeakage: summarizeC3Surface(corrected, primary.stress).outputLeakage,
          remainingDeviations: deviations(correctedRows, primary.stress) };
      })() : null,
    },
    beforeState: {
      addon: summarizeC3Surface(beforeFile, primary.before).views['qualification-plan'],
      deviations: deviations(before, primary.before),
      crossFamilyOverlapAllSelectors: overlapFrom(allSplit.before),
    },
    surfaceAgreement: { comparedCases: all.length, addonVsWasmDisagreements: disagreements(surfaces['node-addon'].exact.observations, surfaces['node-wasm'].exact.observations),
      exactVsClosureDisagreements: disagreements(surfaces['node-addon'].exact.observations, surfaces['node-addon'].closure.observations) +
        disagreements(surfaces['node-wasm'].exact.observations, surfaces['node-wasm'].closure.observations) },
    activation,
    identityOnly: { status: 'not-measured', reason: { ...PII_ORACLE_UNAVAILABLE_REASON } },
    protectedPartition: { status: 'not-run', owner: 'redact-secret/redact-secret-benchmarks#428',
      reason: 'The protected partition runs only when every public gate is eligible and is owned by #428; this development evidence does not spend it.' },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Package cost against the frozen #879 common-Wasm zero-growth budget (the cost decision itself is core #794).
// ---------------------------------------------------------------------------------------------------------------
const frozenOperational = JSON.parse(await readFile('evidence/879/pii-operational-evidence-v1.json', 'utf8'));
const wasmRoot = await extract(tarballs.wasm);
const payload = async name => { const bytes = await readFile(path.join(wasmRoot, name));
  return { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } }).length }; };
const common = await payload('redact_secret_wasm_common_bg.wasm'), full = await payload('redact_secret_wasm_bg.wasm');
await rm(path.dirname(wasmRoot), { recursive: true, force: true });
const budget = Object.fromEntries(['Raw', 'Gzip', 'Brotli'].map(encoding => {
  const frozen = frozenOperational.byteComparisons[`wasmCommon${encoding}`], value = common[encoding.toLowerCase()];
  return [encoding.toLowerCase(), { frozenBaseline: frozen.baseline, beta10: value, delta: value - frozen.baseline, maximumIncrease: frozen.maximumIncrease,
    pass: value - frozen.baseline <= frozen.maximumIncrease }];
}));
const packageCost = { tarballBytes: Object.fromEntries(Object.entries(binding.tarballs).map(([role, row]) => [role, row.bytes])),
  wasmPayloads: { common, full }, commonWasmZeroGrowthBudget: { source: 'evidence/879/pii-operational-evidence-v1.json', comparisons: budget,
    status: Object.values(budget).every(row => row.pass) ? 'passed' : 'failed', owner: 'redact-secret/redact-secret#794 (cost decision), benchmarks #428 (gate)' } };

// ---------------------------------------------------------------------------------------------------------------
// 4. Before-state population re-measure (#408/#411-corrected corpus) on the exact candidate.
// ---------------------------------------------------------------------------------------------------------------
await mkdir(outputDir, { recursive: true });
const scratch = await mkdtemp(path.join(tmpdir(), 'pii-426-baseline-'));
let populationV1;
try {
  const baseline = await packLockfileRelease(scratch);
  const bundle = await observePiiPopulations({ baseline, candidate: tarballs, candidateSourceCommit: candidate.sourceCommit });
  if (bundle.candidate.artifactSetCommitment === bundle.baseline.artifactSetCommitment) throw new Error('baseline equals candidate');
  const text = `${JSON.stringify(bundle)}\n`;
  await writeFile(path.join(outputDir, 'pii-population-v1-remeasure.json'), text);
  populationV1 = { file: 'pii-population-v1-remeasure.json', sha256: digest(text), contractCommitment: bundle.contractCommitment,
    corpusCommitment: bundle.corpusCommitment, baselineVersion: bundle.baseline.version, candidateVersion: bundle.candidate.version,
    candidateComponents: bundle.candidate.components,
    comparisons: bundle.comparisons.map(row => ({ population: row.population, verdict: row.verdict, candidateStatus: row.candidateReport.status,
      falseAlarms: row.candidateReport.strata.reduce((sum, stratum) => sum + stratum.falseAlarms, 0),
      measured: row.candidateReport.strata.reduce((sum, stratum) => sum + stratum.measured, 0),
      placeholderFalseAlarms: row.candidateReport.strata.filter(stratum => stratum.evidenceClass === 'placeholder').reduce((sum, stratum) => sum + stratum.falseAlarms, 0),
      sensitiveMass: row.candidateReport.baseRate.sensitiveMass })) };
} finally { await rm(scratch, { recursive: true, force: true }); }

const evidence = { schemaVersion: 1, reportType: 'pii-c3-ssn-phone-stress-evidence', issue: 'redact-secret/redact-secret-benchmarks#426',
  parent: 'redact-secret/redact-secret#901', supportClaims: false, evidenceKind: 'development', candidate: binding, benchmark,
  runtime: { node: process.version, platform: `${process.platform}-${process.arch}`, iterationsPerCostSample: ITERATIONS },
  families, packageCost, populationV1,
  corrections: corrections ? { file: path.basename(args.corrections), sha256: digest(await readFile(path.resolve(args.corrections))) } : null, artifactCommitment: '' };
evidence.artifactCommitment = c3Commitment({ ...evidence, artifactCommitment: '' });
await writeFile(path.join(outputDir, 'pii-c3-ssn-phone-evidence-v1.json'), `${JSON.stringify(evidence, null, 2)}\n`);
for (const row of families) {
  const views = row.stress.addon.views;
  console.log(`${row.family}: ${Object.entries(views).map(([view, value]) => `${view} ${JSON.stringify(value.publicStream)}`).join('; ')}; ` +
    `v1 ${JSON.stringify(row.beforeState.addon.publicStream)}; deviations ${row.stress.deviations.length + row.beforeState.deviations.length}`);
}
console.log(`population v1: ${populationV1.comparisons.map(row => `${row.population} ${row.verdict}`).join(', ')}; common wasm budget ${packageCost.commonWasmZeroGrowthBudget.status}`);
