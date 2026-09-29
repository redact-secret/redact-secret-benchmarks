import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { validatePiiPopulationArrivalBundle } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { piiPopulationContract } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { bindPiiProtectedSupport } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
import { piiReviewedProtectedRoute } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg); if (!match) throw new Error('invalid arguments'); return [match[1], path.resolve(match[2])];
}));
// Two routes: a v1 product record (--candidate-evidence, --activation-evidence, --qualification-evidence), or a
// reviewed v2 protected disposition (--protected-binding=<id> from protected-support-bindings-v1.json).
const protectedId = process.argv.slice(2).map(arg => /^--protected-binding=([a-z][a-z0-9-]{1,79})$/.exec(arg)?.[1]).find(Boolean);
if (protectedId) delete options['protected-binding'];
const v1Keys = ['candidate-evidence', 'activation-evidence', 'qualification-evidence'];
if (!options.output) throw new Error('missing --output');
if (protectedId && v1Keys.some(key => options[key])) throw new Error('--protected-binding and a v1 product record cannot bind one matrix');
const bindings: any = {};
if (protectedId) {
  const reviewed = piiReviewedProtectedRoute(protectedId);
  if (!reviewed) throw new Error(`--protected-binding=${protectedId} is not a reviewed binding`);
  bindings.protectedRoute = await bindPiiProtectedSupport(process.cwd(), reviewed);
} else {
  for (const key of v1Keys) if (!options[key]) throw new Error(`missing --${key}`);
  const [candidateEvidence, activationArtifact, qualificationArtifact] = await Promise.all([
    readFile(options['candidate-evidence'], 'utf8').then(JSON.parse), readFile(options['activation-evidence'], 'utf8').then(JSON.parse),
    readFile(options['qualification-evidence'], 'utf8').then(JSON.parse),
  ]);
  bindings.product = { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] };
}
if (options['population-evidence']) {
  const population = validatePiiPopulationArrivalBundle(JSON.parse(await readFile(options['population-evidence'], 'utf8')));
  bindings.populations = population.candidate.reports.map(report => ({ report, rows: population.candidate.rows,
    contract: piiPopulationContract, evidence: piiBenignCollisionEvidence }));
  bindings.comparisons = population.comparisons.map(comparison => ({
    baseline: population.baseline.reports.find(report => report.population === comparison.population),
    candidate: population.candidate.reports.find(report => report.population === comparison.population),
    baselineRows: population.baseline.rows, candidateRows: population.candidate.rows,
    contract: piiPopulationContract, evidence: piiBenignCollisionEvidence,
  }));
}
const matrix = validatePiiSupportMatrixV2(buildPiiSupportMatrixV2(bindings), bindings);
await writeFile(options.output, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`${matrix.artifactCommitment} ${matrix.families.map(row => `${row.family}=${row.status.state}(${row.status.reasonCodes.join(',')})`).join(' ')}`);
