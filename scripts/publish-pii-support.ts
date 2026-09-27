import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluationProblem } from '../src/evaluation-model.ts';
import { supportMatrixProblem } from '../src/support-model.ts';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { piiPopulationContract, type PiiPopulationReport } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import type { PiiAccountingRow } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { buildEvaluationDomainsV2, evaluationDomainsV2Problem } from '../src/evaluation-domains-v2.ts';
import { publishArtifactAndIndex } from './atomic-publication.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(evaluation|credential-support|pii-directory|output|population-bundle|population-mode)=(.+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:publish:pii-support -- [--evaluation=...] [--credential-support=...] [--pii-directory=...] [--output=...] (--population-bundle=... | --population-mode=not-measured)');
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
type BundleRow = { population: 'diagnostic-balanced' | 'benign-heavy-stress'; baselineReport: PiiPopulationReport;
  candidateReport: PiiPopulationReport; baselineRows: PiiAccountingRow[]; candidateRows: PiiAccountingRow[] };
const hasBundle = Boolean(options['population-bundle']);
if (hasBundle === (options['population-mode'] === 'not-measured'))
  throw new Error('Choose exactly one of --population-bundle or --population-mode=not-measured');
if (!hasBundle && options['population-mode'] !== 'not-measured') throw new Error('Unknown PII population publication mode');
let bindings = {};
if (hasBundle) {
  const bundlePath = location('population-bundle', 'results-output/pii/population-release-v1.json');
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as { schemaVersion?: unknown; comparisons?: unknown };
  if (bundle.schemaVersion !== 1 || !Array.isArray(bundle.comparisons) || bundle.comparisons.length !== 2 ||
      new Set(bundle.comparisons.map((row: any) => row?.population)).size !== 2 || bundle.comparisons.some((row: any) =>
        !['diagnostic-balanced', 'benign-heavy-stress'].includes(row?.population) || !Array.isArray(row?.baselineRows) || !Array.isArray(row?.candidateRows) ||
        row?.baselineReport?.population !== row.population || row?.candidateReport?.population !== row.population))
    throw new Error('Invalid PII population release bundle');
  const rows = bundle.comparisons as BundleRow[];
  bindings = {
    populations: rows.map(row => ({ report: row.candidateReport, rows: row.candidateRows, contract: piiPopulationContract, evidence: piiBenignCollisionEvidence })),
    comparisons: rows.map(row => ({ baseline: row.baselineReport, candidate: row.candidateReport, baselineRows: row.baselineRows,
      candidateRows: row.candidateRows, contract: piiPopulationContract, evidence: piiBenignCollisionEvidence })),
  };
}
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
console.log(`PII population comparisons: ${pii.populationComparisons.map(row => `${row.id}=${row.verdict}`).join(', ')}`);
