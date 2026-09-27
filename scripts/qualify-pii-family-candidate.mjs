import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEvidence } from '../benchmarks/evaluation/domains/credential/evidence.ts';
import { piiBindingArtifactCommitment } from '../benchmarks/evaluation/domains/pii/product-binding.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg); if (!match) throw new Error('invalid arguments'); return [match[1], path.resolve(match[2])];
}));
for (const key of ['candidate-evidence', 'core', 'node', 'wasm', 'plan', 'activation-output', 'qualification-output']) if (!args[key]) throw new Error(`missing --${key}`);
const candidate = JSON.parse(await readFile(args['candidate-evidence'], 'utf8')); validateEvidence(candidate, 'candidate');
if (candidate.status !== 'complete' || candidate.candidate.sourceState !== 'clean' || candidate.benchmark.dirty !== false) throw new Error('candidate evidence is not complete and clean');
const artifact = role => candidate.candidate.artifacts.find(row => row.role === role)?.sha256;
const digestFile = async location => createHash('sha256').update(await readFile(location)).digest('hex');
if (await digestFile(args.core) !== artifact('package') || await digestFile(args.node) !== artifact('node') || await digestFile(args.wasm) !== artifact('wasm'))
  throw new Error('candidate component identity mismatch');
const plan = JSON.parse(await readFile(args.plan, 'utf8'));
if (plan.schemaVersion !== 1 || !/^pii:(?:global|[a-z]{2}):/.test(plan.family) || !/^pii_[a-z0-9_]+$/.test(plan.findingType) ||
    typeof plan.piiOffInput !== 'string' || !plan.piiOffInput || !Array.isArray(plan.activationChecks) || plan.activationChecks.length < 2 ||
    plan.activationChecks.some(check => !Array.isArray(check.selectors) || !check.selectors.length || typeof check.expectedActivationIdentity !== 'string') ||
    !Array.isArray(plan.cases) || !plan.cases.length || !Array.isArray(plan.classAccounting) || !plan.classAccounting.length) throw new Error('invalid PII qualification plan');
const planCommitment = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const candidateEvidenceCommitment = createHash('sha256').update(JSON.stringify(candidate)).digest('hex');
const product = { repository: 'redact-secret/redact-secret', sourceCommit: candidate.candidate.sourceCommit,
  artifactCommitment: candidate.candidate.artifactSha256, candidateEvidenceCommitment };

async function runSurfaceCheck(id, fallback, check) {
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
    for (const row of plan.cases) {
      const findings = module.scan(row.input).filter(finding => finding.type === plan.findingType);
      if (row.expected.publicFinding) {
        if (findings.length !== 1 || findings[0].start !== row.expected.start || findings[0].end !== row.expected.end) throw new Error(`case failed: ${row.id}`);
      } else if (findings.length) throw new Error(`case failed: ${row.id}`);
    }
    return { selectors: check.selectors, activationIdentity,
      availableFamilies: activationIdentity.split(';families=')[1].split(';vocabulary=')[0].split(',') };
  } finally { await removeCandidate(installation); }
}
const surfaceConfigurations = [['node-addon', false], ['node-wasm', true]];
const surfaces = [];
for (const [id, fallback] of surfaceConfigurations) {
  const activationChecks = [];
  for (const check of plan.activationChecks) activationChecks.push(await runSurfaceCheck(id, fallback, check));
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
const gates = [
  { id: 'exact-candidate-artifact', status: 'met' }, { id: 'selector-global-closure', status: 'met' },
  { id: 'selector-exact-family', status: 'met' }, { id: 'cross-surface-determinism', status: 'met' },
  { id: 'sensitive-public-findings', status: 'met' }, { id: 'public-absence-controls', status: 'met' },
  { id: 'identity-only-classification', status: 'unresolved' },
  { id: 'pii-off-invariance', status: 'met' }, { id: 'diagnostic-population', status: 'unresolved' },
  { id: 'benign-heavy-population', status: 'unresolved' }, { id: 'protected-partition', status: 'unresolved' },
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
const qualification = { schemaVersion: 1, reportType: 'pii-family-qualification', supportClaims: false, family: plan.family, product,
  activationArtifactCommitment: activation.artifactCommitment, planCommitment, profile: plan.profile, gates, classAccounting,
  status: reasonCodes.length ? 'not-qualified' : 'qualified',
  reasonCodes, artifactCommitment: '' };
qualification.artifactCommitment = piiBindingArtifactCommitment(qualification);
await Promise.all([writeFile(args['activation-output'], `${JSON.stringify(activation, null, 2)}\n`),
  writeFile(args['qualification-output'], `${JSON.stringify(qualification, null, 2)}\n`)]);
console.log(`PII activation ${activation.artifactCommitment}; qualification ${qualification.artifactCommitment} (${qualification.status})`);
