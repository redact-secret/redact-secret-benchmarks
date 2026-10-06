import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluationProblem } from '../benchmarks/shared/evaluation-model.ts';
import { supportMatrixProblem } from '../benchmarks/shared/support-model.ts';
import { evaluationDomains, evaluationDomainsProblem } from '../benchmarks/shared/evaluation-domains.ts';
import { credentialEvaluationReference, credentialEvidenceChangeProblem, readCredentialEvidence } from '../benchmarks/shared/credential-evidence.ts';

/**
 * The domain gate (#790). Normal publication validates the credential evaluation bundle (streaming, bounded) and the support matrix and writes NOTHING: the current index is
 * `evaluation-domains-v2.json`, committed by `eval:publish:pii-support` with the credential descriptor pointing at the bundle manifest. `evaluation-domains-v1.json` points at the full
 * `evaluation-v1.json`, the supported legacy contract for oracle consumers; it is produced only by `--legacy-v1`, together with the opt-in `eval:publish -- --legacy-v1` export.
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const USAGE = 'Usage: npm run eval:publish:domains -- [--results=public/results] [--support=public/results/support-matrix-v1.json]\n  legacy contract: --legacy-v1 [--evaluation=public/results/evaluation-v1.json] [--output=public/results/evaluation-domains-v1.json]';
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(evaluation|support|output|results)=(.+)$/.exec(arg);
  if (arg === '--legacy-v1') return ['legacy-v1', 'true'];
  if (!match) throw new Error(USAGE);
  return [match[1], match[2]];
}));
const legacy = options['legacy-v1'] === 'true';
if (!legacy && (options.evaluation || options.output)) throw new Error('--evaluation and --output belong to the legacy evaluation-v1 contract; pass --legacy-v1 to use them, or --results for the evaluation bundle');
if (legacy && options.results) throw new Error('--results names an evaluation bundle and cannot be combined with --legacy-v1');
const location = (name: string, fallback: string) => path.resolve(root, options[name] ?? fallback);
const indexIssue = evaluationDomainsProblem(evaluationDomains);
if (indexIssue) throw new Error(indexIssue);
const supportFile = location('support', 'public/results/support-matrix-v1.json');

if (legacy) {
  const read = async (file: string) => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { throw new Error(`Cannot read ${path.relative(root, file)}: ${error instanceof Error ? error.message : error}`); } };
  const evaluationFile = location('evaluation', 'public/results/evaluation-v1.json');
  const evaluationIssue = evaluationProblem(await read(evaluationFile));
  if (evaluationIssue) throw new Error(`Credential evaluation artifact is incompatible: ${evaluationIssue}`);
  const supportIssue = supportMatrixProblem(await read(supportFile));
  if (supportIssue) throw new Error(`Credential support artifact is incompatible: ${supportIssue}`);
  const target = location('output', 'public/results/evaluation-domains-v1.json');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify(evaluationDomains) + '\n');
  await rename(temporary, target);
  console.log(`Published (legacy evaluation-domains-v1) after validating ${path.relative(root, evaluationFile)} and ${path.relative(root, supportFile)}`);
  console.log(`Report: ${path.relative(root, target)}`);
} else {
  const evidence = await readCredentialEvidence(location('results', 'public/results'), supportFile);
  const changed = await credentialEvidenceChangeProblem(evidence);
  if (changed) throw new Error(changed);
  const reference = credentialEvaluationReference(evidence);
  console.log(`Validated credential evidence: bundle ${evidence.bundleId} (${evidence.totals.cases} cases in ${evidence.totals.caseParts} parts, ${evidence.totals.reviews} reviews in ${evidence.totals.reviewParts} parts; largest part ${evidence.totals.maxPartBytes} bytes) and ${path.relative(root, supportFile)}`);
  console.log(`Credential descriptor for evaluation-domains-v2: ${reference.href} (${reference.artifactCommitment}); the index is committed by eval:publish:pii-support. No evaluation-domains-v1 index is written without --legacy-v1.`);
}
