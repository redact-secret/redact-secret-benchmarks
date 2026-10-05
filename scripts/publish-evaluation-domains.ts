import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluationProblem } from '../benchmarks/shared/evaluation-model.ts';
import { supportMatrixProblem } from '../benchmarks/shared/support-model.ts';
import { evaluationDomains, evaluationDomainsProblem } from '../benchmarks/shared/evaluation-domains.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(evaluation|support|output)=(.+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:publish:domains -- [--evaluation=public/results/evaluation-v1.json] [--support=public/results/support-matrix-v1.json] [--output=public/results/evaluation-domains-v1.json]');
  return [match[1], match[2]];
}));
const read = async (name: string, fallback: string) => {
  const file = path.resolve(root, options[name] ?? fallback);
  try { return { file, value: JSON.parse(await readFile(file, 'utf8')) }; }
  catch (error) { throw new Error(`Cannot read ${path.relative(root, file)}: ${error instanceof Error ? error.message : error}`); }
};

const credentialEvaluation = await read('evaluation', 'public/results/evaluation-v1.json');
const credentialSupport = await read('support', 'public/results/support-matrix-v1.json');
const evaluationIssue = evaluationProblem(credentialEvaluation.value);
if (evaluationIssue) throw new Error(`Credential evaluation artifact is incompatible: ${evaluationIssue}`);
const supportIssue = supportMatrixProblem(credentialSupport.value);
if (supportIssue) throw new Error(`Credential support artifact is incompatible: ${supportIssue}`);
const indexIssue = evaluationDomainsProblem(evaluationDomains);
if (indexIssue) throw new Error(indexIssue);

const target = path.resolve(root, options.output ?? 'public/results/evaluation-domains-v1.json');
await mkdir(path.dirname(target), { recursive: true });
const temporary = `${target}.tmp`;
await writeFile(temporary, JSON.stringify(evaluationDomains) + '\n');
await rename(temporary, target);
console.log(`Published domain index after validating ${path.relative(root, credentialEvaluation.file)} and ${path.relative(root, credentialSupport.file)}`);
console.log(`Report: ${path.relative(root, target)}`);
