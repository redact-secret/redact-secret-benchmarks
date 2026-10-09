import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialEvaluationReference, credentialEvidenceChangeProblem, readCredentialEvidence } from '../benchmarks/shared/credential-evidence.ts';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2, type PiiSupportBuildOptions } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { custodianConformanceFrom, piiEvalMeasurementFrom, populationOracleBindingsFrom, productEvidenceFor, type PiiMeasuredProduct } from './pii-publication-inputs.ts';
import { bindPiiProtectedSupport } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
import { buildEvaluationDomainsV2, evaluationDomainsV2Problem } from '../benchmarks/shared/evaluation-domains-v2.ts';
import { publishArtifactAndIndex } from './atomic-publication.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), piiEvalArtifacts = args.flatMap(arg => /^--pii-eval-artifact=(.+)$/.exec(arg)?.[1] ?? []);
const piiEvalPinFiles = args.flatMap(arg => /^--pii-eval-pins=(.+)$/.exec(arg)?.[1] ?? []);
const boundedPopulationOracle = args.includes('--bounded-population-oracle');
const options = Object.fromEntries(args.filter(arg => arg !== '--bounded-population-oracle' && !arg.startsWith('--pii-eval-artifact=') && !arg.startsWith('--pii-eval-pins=')).map(arg => {
  if (arg.startsWith('--evaluation=')) throw new Error('--evaluation (a full evaluation-v1.json) is the legacy credential contract and is no longer an input: pass --credential-results=<results directory with evaluation-bundle-v1.json>');
  const match = /^--(credential-results|credential-support|pii-directory|output|population-bundle|population-mode|product-commit|product-core|evidence-root|custodian-bundle)=(.+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:publish:pii-support -- [--credential-results=<results directory holding evaluation-bundle-v1.json>] [--credential-support=...] [--pii-directory=...] [--output=...] [--product-commit=<sha> --product-core=<core.tgz>] [--pii-eval-pins=<pins> --pii-eval-artifact=<artifact>...] [--custodian-bundle=<public-synthetic-bundle>] (--population-bundle=... | --population-mode=not-measured)');
  return [match[1], match[2]];
}));
const location = (key: string, fallback: string) => path.resolve(root, options[key] ?? fallback);
const credentialResults = location('credential-results', 'public/results');
const credentialSupport = location('credential-support', 'public/results/support-matrix-v1.json');
const indexTarget = location('output', 'public/results/evaluation-domains-v2.json');
// Validate every referenced artifact before the first write. Credential evidence is a read-only input: the evaluation bundle is validated by streaming (one part in memory at a time) and the
// publication binds its pointer, bundle id and manifest digest as a read set that is re-checked before the index moves.
const evidence = await readCredentialEvidence(credentialResults, credentialSupport);
console.log(`Credential evidence: bundle ${evidence.bundleId} (${evidence.totals.cases} cases in ${evidence.totals.caseParts} parts, ${evidence.totals.reviews} reviews in ${evidence.totals.reviewParts} parts; largest part ${evidence.totals.maxPartBytes} bytes)`);
const hasBundle = Boolean(options['population-bundle']);
if (hasBundle && !boundedPopulationOracle) throw new Error('Legacy PII population bundles require --bounded-population-oracle; current publication uses --population-mode=not-measured and validated pii-eval artifacts');
if (boundedPopulationOracle && !hasBundle) throw new Error('--bounded-population-oracle requires --population-bundle');
if (hasBundle === (options['population-mode'] === 'not-measured'))
  throw new Error('Choose exactly one of --population-bundle or --population-mode=not-measured');
if (!hasBundle && options['population-mode'] !== 'not-measured') throw new Error('Unknown PII population publication mode');
if (Boolean(options['product-commit']) !== Boolean(options['product-core'])) throw new Error('Pass --product-commit and --product-core together');
if (Boolean(piiEvalPinFiles.length) !== Boolean(piiEvalArtifacts.length)) throw new Error('Pass --pii-eval-pins (one or more) and at least one --pii-eval-artifact together');
// The one product this publication measured (staging's qualified candidate). Production measures the release and passes none.
const product: PiiMeasuredProduct | null = options['product-commit'] ? { sourceCommit: options['product-commit'],
  coreSha256: createHash('sha256').update(await readFile(location('product-core', ''))).digest('hex') } : null;
const bindings: PiiSupportBuildOptions = {};
if (piiEvalPinFiles.length) bindings.piiEvalMeasurement = await piiEvalMeasurementFrom(piiEvalPinFiles.map(file => path.resolve(root, file)), piiEvalArtifacts.map(file => path.resolve(root, file)), product);
if (options['custodian-bundle']) bindings.custodianConformance = await custodianConformanceFrom(location('custodian-bundle', ''));
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
if (hasBundle) Object.assign(bindings, populationOracleBindingsFrom(JSON.parse(await readFile(location('population-bundle', 'results-output/pii/population-release-v1.json'), 'utf8')), product));
const publication = boundedPopulationOracle ? await import('../benchmarks/evaluation/domains/pii/support-oracle.ts') :
  { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 };
const pii = publication.validatePiiSupportMatrixV2(publication.buildPiiSupportMatrixV2(bindings), bindings);
const piiTarget = path.join(location('pii-directory', 'public/results'), `pii-support-matrix-v2-${pii.artifactCommitment}.json`);
const index = buildEvaluationDomainsV2(pii.artifactCommitment, evidence);
const indexIssue = evaluationDomainsV2Problem(index);
if (indexIssue) throw new Error(indexIssue);

await publishArtifactAndIndex(piiTarget, JSON.stringify(pii) + '\n', indexTarget, JSON.stringify(index) + '\n', {
  artifact(bytes) { const value = JSON.parse(bytes.toString('utf8')); publication.validatePiiSupportMatrixV2(value); if (value.artifactCommitment !== pii.artifactCommitment) throw new Error('PII artifact readback commitment mismatch'); },
  index(bytes) { const value = JSON.parse(bytes.toString('utf8')); const issue = evaluationDomainsV2Problem(value); if (issue) throw new Error(issue);
    if (value.domains[1].support.href !== `/results/${path.basename(piiTarget)}` || value.domains[1].support.artifactCommitment !== pii.artifactCommitment) throw new Error('PII index does not bind its immutable artifact');
    const reference = credentialEvaluationReference(evidence), credential = value.domains[0].evaluation;
    if (credential.href !== reference.href || credential.artifactCommitment !== reference.artifactCommitment) throw new Error('Domain index does not bind the credential evaluation bundle that was read'); },
  async beforeCommit() { const changed = await credentialEvidenceChangeProblem(evidence); if (changed) throw new Error(changed); },
});
console.log(`Published ${path.relative(root, piiTarget)} and committed it through ${path.relative(root, indexTarget)}`);
console.log(`PII support: ${pii.families.map(row => `${row.family}=${row.status.state}`).join(', ')}`);
console.log(`PII population comparisons: ${pii.populationComparisons.map(row => `${row.id}=${row.verdict}`).join(', ')}`);
