import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg); if (!match) throw new Error('invalid arguments'); return [match[1], path.resolve(match[2])];
}));
for (const key of ['candidate-evidence', 'activation-evidence', 'qualification-evidence', 'output']) if (!options[key]) throw new Error(`missing --${key}`);
const [candidateEvidence, activationArtifact, qualificationArtifact] = await Promise.all([
  readFile(options['candidate-evidence'], 'utf8').then(JSON.parse), readFile(options['activation-evidence'], 'utf8').then(JSON.parse),
  readFile(options['qualification-evidence'], 'utf8').then(JSON.parse),
]);
const bindings = { product: { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] } };
const matrix = validatePiiSupportMatrixV2(buildPiiSupportMatrixV2(bindings), bindings);
await writeFile(options.output, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`${matrix.artifactCommitment} ${matrix.families.map(row => `${row.family}=${row.status.state}(${row.status.reasonCodes.join(',')})`).join(' ')}`);
