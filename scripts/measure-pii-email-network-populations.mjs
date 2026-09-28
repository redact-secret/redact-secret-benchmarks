// Beta.11 PII C1 (benchmarks #424): measure the frozen email and network-address population plans on two exact,
// published npm releases (baseline and candidate), on the installed Node addon and forced-Wasm surfaces.
//
// Inputs are registry tarballs plus the product repository's durable release manifests. Every tarball must match the
// manifest's registry shasum and integrity, and the candidate manifest must be the one the frozen #422 ledger binds.
// The output carries commitments, case ids and outcome counts only: no candidate value, span or sanitized text.
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { C1_FAMILIES, C1_POPULATION_PLANS, C1_PII_V1_MECHANICS, c1Commitment, c1PriorPlanCandidates, compareC1, scoreC1Surface,
  validateC1PopulationPlan } from '../benchmarks/evaluation/domains/pii/email-network-population.ts';
import { PII_ORACLE_UNAVAILABLE_REASON, piiIdentityOracle } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { PII_GAP_LEDGER_PLANS } from '../benchmarks/evaluation/domains/pii/gap-ledger.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';

const exec = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg); if (!match) throw new Error('invalid arguments'); return [match[1], match[2]];
}));
for (const key of ['artifacts-dir', 'product-repo', 'output']) if (!args[key]) throw new Error(`missing --${key}`);
const RELEASES = [
  { role: 'baseline', version: args['baseline-version'] ?? '0.1.0-beta.9' },
  { role: 'candidate', version: args['candidate-version'] ?? '0.1.0-beta.10' },
];
const PACKAGES = [['core', '@redact-secret/core', 'redact-secret-core'], ['node', '@redact-secret/node-darwin-arm64', 'redact-secret-node-darwin-arm64'],
  ['wasm', '@redact-secret/wasm', 'redact-secret-wasm']];
const SELECTORS = ['pii:global'];
const sha = (algorithm, data, encoding = 'hex') => createHash(algorithm).update(data).digest(encoding);
const ledger = JSON.parse(await readFile('evidence/901/pii-gap-ledger-v1.json', 'utf8'));

// 1. Frozen plans must validate before anything is scanned.
const plans = {};
for (const family of C1_FAMILIES) {
  const prior = c1PriorPlanCandidates(PII_GAP_LEDGER_PLANS[family].plan, piiIdentityOracle.families.find(row => row.family === family));
  const { plan, independence } = validateC1PopulationPlan(C1_POPULATION_PLANS[family].plan, prior);
  plans[family] = { plan, independence, file: C1_POPULATION_PLANS[family].file,
    fileSha256: sha('sha256', await readFile(C1_POPULATION_PLANS[family].file)) };
}

// 2. Exact artifacts: registry tarballs checked against the product's durable release manifests.
const { stdout: benchmarkHead } = await exec('git', ['rev-parse', 'HEAD']);
const { stdout: benchmarkStatus } = await exec('git', ['status', '--porcelain']);
const releases = [];
for (const release of RELEASES) {
  const manifestPath = path.join(args['product-repo'], 'docs/releases', release.version, 'manifest.json');
  const manifestBytes = await readFile(manifestPath); const manifest = JSON.parse(manifestBytes);
  if (manifest.version !== release.version) throw new Error('release manifest version mismatch');
  if (release.role === 'candidate' && (sha('sha256', manifestBytes) !== ledger.finalCandidate.releaseManifest.sha256 ||
      release.version !== ledger.finalCandidate.version)) throw new Error('candidate manifest is not the one the #422 ledger binds');
  const artifacts = {};
  for (const [role, name, stem] of PACKAGES) {
    const file = path.join(args['artifacts-dir'], `${stem}-${release.version}.tgz`); const data = await readFile(file);
    const registry = manifest.release_evidence?.registries?.[`npm:${name}`];
    const shasum = sha('sha1', data), integrity = `sha512-${sha('sha512', data, 'base64')}`;
    if (!registry || registry.shasum !== shasum || registry.integrity !== integrity) throw new Error(`registry identity mismatch: ${name}@${release.version}`);
    artifacts[role] = { package: name, file, shasum, integrity, sha256: sha('sha256', data) };
  }
  // The compiled addon inside the tarball must also equal the manifest's qualified addon digest when the manifest lists one.
  const root = await mkdtemp(path.join(os.tmpdir(), 'c1-addon-'));
  try {
    await exec('tar', ['-xzf', artifacts.node.file, '-C', root]);
    const addon = (await readdir(path.join(root, 'package'))).find(entry => entry.endsWith('.node'));
    const addonSha256 = sha('sha256', await readFile(path.join(root, 'package', addon)));
    const qualified = (manifest.artifact_digests?.['npm:@redact-secret/node-darwin-arm64'] ?? []).flatMap(row => String(row.qualified ?? '').split('\n'));
    if (qualified.length && !qualified.includes(addonSha256)) throw new Error(`addon digest mismatch: ${release.version}`);
    artifacts.node.addonSha256 = addonSha256; artifacts.node.addonMatchesQualifiedDigest = qualified.includes(addonSha256);
  } finally { await rm(root, { recursive: true, force: true }); }
  releases.push({ ...release, sourceRevision: manifest.source_revision ?? null, manifestSha256: sha('sha256', manifestBytes),
    artifactInventorySha256: manifest.artifact_inventory_sha256 ?? null, artifacts,
    artifactSetCommitment: c1Commitment(Object.fromEntries(Object.entries(artifacts).map(([role, row]) => [role, row.integrity]))) });
}

// 3. Observe every case on both installed surfaces of both releases.
const byteOffset = (input, offset) => Buffer.byteLength(input.slice(0, offset));
const spanText = (input, start, end) => Buffer.from(input, 'utf8').subarray(start, end).toString('utf8');
async function observe(release, surface) {
  const installation = await installCandidate({ core: release.artifacts.core.file, node: release.artifacts.node.file, wasm: release.artifacts.wasm.file });
  try {
    if (surface === 'node-wasm') {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?c1=${release.role}-${surface}`);
    await module.initialize({ pii: SELECTORS });
    const activation = typeof module.piiActivation === 'function' ? module.piiActivation() : 'unavailable';
    const families = {};
    let scanRedactDisagreements = 0;
    for (const family of C1_FAMILIES) {
      const { plan } = plans[family];
      const labels = new Map(plan.oracle.labels.map(row => [row.caseId, row]));
      families[family] = plan.plan.cases.map(row => {
        const findings = module.scan(row.input).map(finding => ({ ...finding, start: byteOffset(row.input, finding.start), end: byteOffset(row.input, finding.end) }));
        const redacted = module.scanAndRedact(row.input);
        const redactFindings = redacted.findings.map(finding => ({ ...finding, start: byteOffset(row.input, finding.start), end: byteOffset(row.input, finding.end) }));
        if (JSON.stringify(redactFindings.map(f => [f.type, f.start, f.end, f.action])) !== JSON.stringify(findings.map(f => [f.type, f.start, f.end, f.action])))
          scanRedactDisagreements += 1;
        const label = labels.get(row.id);
        const sensitiveSpans = [...(label.sensitivity === 'sensitive' ? [label.candidate] : []),
          ...(row.lineCandidates ?? []).filter(other => other.sensitivity === 'sensitive')];
        const pii = redactFindings.filter(f => f.detector === 'pii-domain'), credential = redactFindings.filter(f => f.detector !== 'pii-domain');
        const collateralBytes = pii.filter(f => !sensitiveSpans.some(span => span.start === f.start && span.end === f.end) &&
          !credential.some(c => c.start < f.end && f.start < c.end)).reduce((n, f) => n + (f.end - f.start), 0);
        return {
          caseId: row.id,
          familyFindings: findings.filter(f => f.type === plan.findingType).map(f => ({ start: f.start, end: f.end, action: f.action })),
          otherPiiFindings: findings.filter(f => f.detector === 'pii-domain' && f.type !== plan.findingType).map(f => ({ type: f.type, start: f.start, end: f.end, action: f.action })),
          credentialFindings: findings.filter(f => f.detector !== 'pii-domain').length,
          leakedSensitiveSpans: sensitiveSpans.filter(span => redacted.text.includes(spanText(row.input, span.start, span.end))).length,
          collateralBytes,
        };
      });
    }
    return { surface, version: module.VERSION ?? installation.declaredVersion, activation, scanRedactDisagreements, families };
  } finally { await removeCandidate(installation); }
}

const startedAt = new Date().toISOString();
const runs = [];
for (const release of releases) for (const surface of ['node-addon', 'node-wasm']) runs.push({ release, ...(await observe(release, surface)) });
const finishedAt = new Date().toISOString();

// 4. Score, compare and derive conditional pii-v1 reasons per family. Credential and PII accounting stay separate.
const outcomeVector = (plan, observations) => observations.map(row => {
  const findings = row.familyFindings.map(f => `${f.start}-${f.end}-${f.action}`).join(',');
  return `${row.caseId}:${findings}:${row.leakedSensitiveSpans}:${row.collateralBytes}`;
}).join('|');
const families = C1_FAMILIES.map(family => {
  const { plan, independence, file, fileSha256 } = plans[family];
  const score = (role, surface) => { const run = runs.find(r => r.release.role === role && r.surface === surface); return scoreC1Surface(plan, run.families[family]); };
  const surfaces = ['node-addon', 'node-wasm'].map(surface => {
    const baseline = score('baseline', surface), candidate = score('candidate', surface);
    return { surface, baseline: baseline.views, candidate: candidate.views, comparison: compareC1(baseline, candidate) };
  });
  const crossSurface = Object.fromEntries(['baseline', 'candidate'].map(role => {
    const [a, b] = ['node-addon', 'node-wasm'].map(surface => runs.find(r => r.release.role === role && r.surface === surface).families[family]);
    return [role, outcomeVector(plan, a) === outcomeVector(plan, b) ? 'identical' : 'divergent'];
  }));
  const candidateAddon = runs.find(r => r.release.role === 'candidate' && r.surface === 'node-addon').families[family];
  const labels = new Map(plan.oracle.labels.map(row => [row.caseId, row]));
  const scored = scoreC1Surface(plan, candidateAddon);
  const disagreements = candidateAddon.flatMap(observation => {
    const label = labels.get(observation.caseId), row = plan.plan.cases.find(item => item.id === observation.caseId);
    const exact = observation.familyFindings.filter(f => label.candidate && f.start === label.candidate.start && f.end === label.candidate.end && f.action === 'redact');
    const onTarget = label.candidate ? observation.familyFindings.filter(f => f.start < label.candidate.end && label.candidate.start < f.end) : observation.familyFindings;
    const outcome = label.sensitivity === 'sensitive' ? (exact.length === 1 && onTarget.length === 1 ? null : onTarget.length ? 'range-mismatch' : 'missed') :
      onTarget.length ? 'false-alarm' : null;
    return outcome ? [{ caseId: observation.caseId, stratum: row.stratum, authored: `${label.identity}/${label.sensitivity}`, outcome,
      leaked: observation.leakedSensitiveSpans > 0, collateralBytes: observation.collateralBytes }] : [];
  });
  const view = id => scored.views.find(row => row.view === id);
  const metricsMet = id => view(id).piiV1Metrics.every(metric => ['met', 'not-applicable'].includes(metric.status));
  const noRegression = surfaces.every(row => row.comparison.every(item => item.verdict === 'no-regression'));
  const gates = [
    { id: 'exact-candidate-artifact', status: 'met' },
    { id: 'cross-surface-determinism', status: crossSurface.candidate === 'identical' ? 'met' : 'not-met' },
    { id: 'identity-only-classification', status: 'unresolved', reason: PII_ORACLE_UNAVAILABLE_REASON },
    { id: 'diagnostic-population', status: metricsMet('diagnostic-balanced') ? 'met' : 'not-met' },
    { id: 'benign-heavy-population', status: metricsMet('benign-heavy-stress') ? 'met' : 'not-met' },
    { id: 'population-no-regression', status: noRegression ? 'met' : 'not-met' },
    { id: 'authored-truth-agreement', status: disagreements.length ? 'not-met' : 'met' },
    { id: 'min-benign-cases-and-axes', status: ['diagnostic-balanced', 'benign-heavy-stress'].every(id =>
      view(id).sensitivity.nonSensitive.cases + view(id).sensitivity.notEstablished.cases >= 6 && view(id).benignAxesPresent.length >= 3) ? 'met' : 'not-met' },
    { id: 'independent-evidence', status: independence.priorPlanCandidateOverlap === 0 && independence.duplicateInputs === 0 ? 'met' : 'not-met' },
    { id: 'protected-partition', status: 'unresolved', owner: '#428' },
    { id: 'trusted-accounting-source', status: 'unresolved', owner: '#428' },
    { id: 'runtime-and-package-cost', status: 'unresolved', owner: '#428' },
    { id: 'cross-surface-output', status: 'unresolved', owner: '#427' },
  ];
  return {
    family, planFile: file, planFileSha256: fileSha256, planCommitment: plan.oracle.planCommitment, planFileCommitment: c1Commitment(plan),
    independence, crossSurface, surfaces, disagreements,
    identityOnly: { status: 'not-measured', reason: PII_ORACLE_UNAVAILABLE_REASON },
    gates, supportState: 'pending', promotion: 'none',
    reasonCodes: gates.filter(gate => gate.status !== 'met').map(gate => gate.id).sort(),
  };
});

const report = {
  schemaVersion: 1, reportType: 'pii-family-population-evidence', id: 'pii-email-network-population-evidence-v1', supportClaims: false,
  issue: 'redact-secret/redact-secret-benchmarks#424', productIssue: 'redact-secret/redact-secret#901', evidenceKind: 'development',
  ledger: { file: 'evidence/901/pii-gap-ledger-v1.json', contentCommitment: ledger.contentCommitment },
  benchmark: { repository: 'redact-secret/redact-secret-benchmarks', revision: benchmarkHead.trim(), dirty: benchmarkStatus.trim() !== '',
    lockfileSha256: sha('sha256', await readFile('package-lock.json')) },
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  selectors: SELECTORS, accounting: { profile: 'pii-v1', mechanics: C1_PII_V1_MECHANICS },
  peerScanners: 'none', credentialAccounting: 'separate-not-scored',
  runId: randomUUID(), startedAt, finishedAt,
  releases: releases.map(({ role, version, sourceRevision, manifestSha256, artifactInventorySha256, artifacts, artifactSetCommitment }) => ({
    role, version, sourceRevision, manifestSha256, artifactInventorySha256, artifactSetCommitment,
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([k, v]) => [k, { package: v.package, shasum: v.shasum, integrity: v.integrity, sha256: v.sha256,
      ...(v.addonSha256 ? { addonSha256: v.addonSha256, addonMatchesQualifiedDigest: v.addonMatchesQualifiedDigest } : {}) }])),
  })),
  surfaces: runs.map(run => ({ role: run.release.role, surface: run.surface, version: run.version, activation: run.activation,
    scanRedactDisagreements: run.scanRedactDisagreements })),
  families,
  artifactCommitment: '',
};
report.artifactCommitment = c1Commitment({ ...report, artifactCommitment: undefined });
await mkdir(path.dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`);
for (const row of families) console.log(`${row.family}: ${row.disagreements.length} disagreement(s); reasons ${row.reasonCodes.join(', ')}`);
console.log(`C1 population evidence ${report.artifactCommitment}`);
