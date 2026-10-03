import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluationProblem } from '../src/evaluation-model.ts';
import { supportMatrixProblem } from '../src/support-model.ts';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2, type PiiSupportBuildOptions } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { piiEvalMeasurementFrom, populationBindingsFrom, productEvidenceFor, type PiiMeasuredProduct } from './pii-publication-inputs.ts';
import { bindPiiProtectedSupport } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
import { buildEvaluationDomainsV2, evaluationDomainsV2Problem } from '../src/evaluation-domains-v2.ts';
import { publishArtifactAndIndex } from './atomic-publication.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), piiEvalArtifacts = args.flatMap(arg => /^--pii-eval-artifact=(.+)$/.exec(arg)?.[1] ?? []);
const options = Object.fromEntries(args.filter(arg => !arg.startsWith('--pii-eval-artifact=')).map(arg => {
  const match = /^--(evaluation|credential-support|pii-directory|output|population-bundle|population-mode|product-commit|product-core|evidence-root|pii-eval-pins)=(.+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:publish:pii-support -- [--evaluation=...] [--credential-support=...] [--pii-directory=...] [--output=...] [--product-commit=<sha> --product-core=<core.tgz>] [--pii-eval-pins=<pins> --pii-eval-artifact=<artifact>...] (--population-bundle=... | --population-mode=not-measured)');
  return [match[1], match[2]];
}));
const location = (key: string, fallback: string) => path.resolve(root, options[key] ?? fallback);
const credentialEvaluation = location('evaluation', 'public/results/evaluation-v1.json');
const credentialSupport = location('credential-support', 'public/results/support-matrix-v1.json');
const indexTarget = location('output', 'public/results/evaluation-domains-v2.json');
// Validate every referenced artifact before the first write. Credential v1 files are read-only inputs.
const [evaluationBytes, supportBytes] = await Promise.all([readFile(credentialEvaluation), readFile(credentialSupport)]);
const evaluationIssue = evaluationProblem(JSON.parse(evaluationBytes.toString('utf8')));
if (evaluationIssue) throw new Error(`Credential evaluation artifact is incompatible: ${evaluationIssue}`);
const supportIssue = supportMatrixProblem(JSON.parse(supportBytes.toString('utf8')));
if (supportIssue) throw new Error(`Credential support artifact is incompatible: ${supportIssue}`);
const hasBundle = Boolean(options['population-bundle']);
if (hasBundle === (options['population-mode'] === 'not-measured'))
  throw new Error('Choose exactly one of --population-bundle or --population-mode=not-measured');
if (!hasBundle && options['population-mode'] !== 'not-measured') throw new Error('Unknown PII population publication mode');
if (Boolean(options['product-commit']) !== Boolean(options['product-core'])) throw new Error('Pass --product-commit and --product-core together');
if (Boolean(options['pii-eval-pins']) !== Boolean(piiEvalArtifacts.length)) throw new Error('Pass --pii-eval-pins and at least one --pii-eval-artifact together');
// The one product this publication measured (staging's qualified candidate). Production measures the release and passes none.
const product: PiiMeasuredProduct | null = options['product-commit'] ? { sourceCommit: options['product-commit'],
  coreSha256: createHash('sha256').update(await readFile(location('product-core', ''))).digest('hex') } : null;
const bindings: PiiSupportBuildOptions = {};
if (options['pii-eval-pins']) bindings.piiEvalMeasurement = await piiEvalMeasurementFrom(location('pii-eval-pins', ''), piiEvalArtifacts.map(file => path.resolve(root, file)));
if (product) {
  const recorded = await productEvidenceFor(product, location('evidence-root', 'evidence'));
  if (recorded) { bindings.product = recorded.binding; console.log(`PII product activation: bound ${path.relative(root, recorded.directory)} for ${product.sourceCommit}`); }
  else console.log(`PII product activation: no committed record for ${product.sourceCommit}; activation stays not-measured`);
}
// Without a v1 record for the measured product, the reviewed v2 protected disposition (benchmarks #428) decides each
// family's status, after it re-derives from committed evidence. The two routes never bind one matrix.
if (!bindings.product) {
  const route = await bindPiiProtectedSupport(root);
  if (route) { bindings.protectedRoute = route; console.log(`PII protected route: bound ${route.id} (${route.route}, core ${route.coreCommit.slice(0, 12)}, record ${route.record})`); }
}
if (hasBundle) Object.assign(bindings, populationBindingsFrom(JSON.parse(await readFile(location('population-bundle', 'results-output/pii/population-release-v1.json'), 'utf8')), product));
const pii = validatePiiSupportMatrixV2(buildPiiSupportMatrixV2(bindings), bindings);
const piiTarget = path.join(location('pii-directory', 'public/results'), `pii-support-matrix-v2-${pii.artifactCommitment}.json`);
const index = buildEvaluationDomainsV2(pii.artifactCommitment);
const indexIssue = evaluationDomainsV2Problem(index);
if (indexIssue) throw new Error(indexIssue);

await publishArtifactAndIndex(piiTarget, JSON.stringify(pii) + '\n', indexTarget, JSON.stringify(index) + '\n', {
  artifact(bytes) { const value = JSON.parse(bytes.toString('utf8')); validatePiiSupportMatrixV2(value); if (value.artifactCommitment !== pii.artifactCommitment) throw new Error('PII artifact readback commitment mismatch'); },
  index(bytes) { const value = JSON.parse(bytes.toString('utf8')); const issue = evaluationDomainsV2Problem(value); if (issue) throw new Error(issue);
    if (value.domains[1].support.href !== `/results/${path.basename(piiTarget)}` || value.domains[1].support.artifactCommitment !== pii.artifactCommitment) throw new Error('PII index does not bind its immutable artifact'); },
  async beforeCommit() { const [evaluationAfter, supportAfter] = await Promise.all([readFile(credentialEvaluation), readFile(credentialSupport)]);
    if (!evaluationAfter.equals(evaluationBytes) || !supportAfter.equals(supportBytes)) throw new Error('Credential v1 artifact bytes changed during PII publication'); },
});
console.log(`Published ${path.relative(root, piiTarget)} and committed it through ${path.relative(root, indexTarget)}`);
console.log(`PII support: ${pii.families.map(row => `${row.family}=${row.status.state}`).join(', ')}`);
console.log(`PII population comparisons: ${pii.populationComparisons.map(row => `${row.id}=${row.verdict}`).join(', ')}`);
