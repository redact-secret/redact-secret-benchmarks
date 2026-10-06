import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateEvidence } from '../benchmarks/evaluation/evidence.ts';
import { piiHoldoutDomain } from '../benchmarks/evaluation/domains/pii/holdout.ts';
import { validatePiiPopulationArrivalBundle, piiArrivalCommitment } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { runHoldout } from '../holdout/lifecycle.ts';
import { installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';

const parsed = process.argv.slice(2).map(argument => {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument);
  if (!match) throw new Error('invalid arguments');
  return [match[1], match[2]];
});
if (new Set(parsed.map(([key]) => key)).size !== parsed.length) throw new Error('duplicate arguments');
const raw = Object.fromEntries(parsed);
for (const key of ['manifest', 'candidate-evidence', 'population-evidence', 'core', 'node', 'wasm', 'output'])
  if (!raw[key]) throw new Error(`missing --${key}`);
const args = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, path.resolve(value)]));
const digestFile = async location => createHash('sha256').update(await readFile(location)).digest('hex');
const candidateEvidence = JSON.parse(await readFile(args['candidate-evidence'], 'utf8'));
validateEvidence(candidateEvidence, 'candidate');
if (candidateEvidence.status !== 'complete' || candidateEvidence.selection.scope !== 'full-suite' ||
    candidateEvidence.candidate.sourceState !== 'clean' || candidateEvidence.benchmark.dirty)
  throw new Error('candidate evidence is not complete, full-suite, and clean');
const population = validatePiiPopulationArrivalBundle(JSON.parse(await readFile(args['population-evidence'], 'utf8')));
const components = {};
for (const [role, argument] of [['core', 'core'], ['node', 'node'], ['wasm', 'wasm']]) {
  const evidenceRole = role === 'core' ? 'package' : role;
  const expected = candidateEvidence.candidate.artifacts.find(row => row.role === evidenceRole)?.sha256;
  const actual = await digestFile(args[argument]);
  if (!expected || expected !== actual || population.candidate.components[role] !== actual)
    throw new Error(`${role} candidate artifact mismatch`);
  components[role] = actual;
}
const artifactSetCommitment = piiArrivalCommitment(components);
if (artifactSetCommitment !== population.candidate.artifactSetCommitment ||
    candidateEvidence.candidate.sourceCommit !== population.candidate.sourceCommit)
  throw new Error('candidate source or artifact-set mismatch');

const candidate = {
  sourceHash: createHash('sha256').update(population.candidate.sourceCommit).digest('hex'),
  lockHash: candidateEvidence.benchmark.lockfileSha256,
  candidateArtifactHash: artifactSetCommitment,
};
const snapshot = async () => {
  const current = {};
  for (const role of ['core', 'node', 'wasm']) current[role] = await digestFile(args[role]);
  if (piiArrivalCommitment(current) !== artifactSetCommitment) throw new Error('candidate artifacts changed');
  return candidate;
};
const installation = await installCandidate({ core: args.core, node: args.node, wasm: args.wasm });
try {
  const installed = await loadCandidate(installation, null, { pii: ['pii:us'] });
  const scanner = {
    id: 'redact-secret-pii-arrival', mode: 'candidate', capabilities: { ranges: true, classification: true },
    configuration: { adapter: 'candidate-v2', selectors: ['pii:us'], artifactSetCommitment,
      identitySourceCommitment: population.identitySourceEvidence.artifactCommitment },
    async version() { return installed.version; }, async scan(directory, fixtures) { return installed.scan(directory, fixtures); },
  };
  const report = await runHoldout({ manifestFile: args.manifest, scanners: [scanner], candidate, verifyCandidate: snapshot, domain: piiHoldoutDomain });
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  process.exitCode = report.status === 'complete' ? 0 : 1;
} finally { await removeCandidate(installation); }
