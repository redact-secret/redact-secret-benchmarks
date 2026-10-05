import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseStrictJson, semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const file = new URL('../benchmarks/pii-eval-migration.json', import.meta.url);
const record = JSON.parse(await readFile(file, 'utf8'));
const digest = async path => createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex');
const digestCanonicalFixture = async path => createHash('sha256')
  .update((await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).trimEnd())
  .digest('hex');
const fail = message => { throw new Error(`PII migration acceptance invalid: ${message}`); };

if (record.schemaVersion !== 1 || record.reportType !== 'pii-eval-migration-acceptance' || record.supportClaims !== false || record.authorityChanged !== false)
  fail('top-level boundary');
if (record.engine?.artifactSchema?.id !== 'pii-eval.public-synthetic-artifact' || record.engine?.artifactSchema?.version !== '1.2' || JSON.stringify(record.engine.artifactSchema.readableVersions) !== JSON.stringify(['1.1', '1.2']) ||
    record.engine?.protocol?.id !== 'pii-v1' || record.engine?.protocol?.revision !== 2 || record.engine?.compatibilityProtocol?.revision !== 1)
  fail('engine contract');
if (record.engine.methods?.length !== 7 || new Set(record.engine.methods.map(row => row.id)).size !== 7 ||
    record.engine.metrics?.length !== 10 || new Set(record.engine.metrics).size !== 10 ||
    JSON.stringify(record.engine.outcomeAxes) !== JSON.stringify(['typeIdentity', 'sensitivityContext']))
  fail('method, metric or outcome contract');
if (JSON.stringify(record.scanner?.activation) !== JSON.stringify(['pii:global', 'pii:us']) || record.scanner?.releasedVersion !== '0.1.0-beta.12')
  fail('scanner identity');
if (record.upstreamParity?.compatibilityDifferences !== 0 || record.upstreamParity?.canonicalClassifications?.unexplained !== 0 ||
    record.upstreamParity?.deterministicSemanticDigest !== true)
  fail('parity classification');
const expectedViews = [['oracle-plan', 146], ['qualification-plan', 266], ['diagnostic-balanced', 477], ['benign-heavy-stress', 299]];
if (JSON.stringify(record.benchmarkPopulations?.views?.map(row => [row.id, row.cases])) !== JSON.stringify(expectedViews))
  fail('population identities or counts');
for (const item of [record.benchmarkPopulations.report, record.benchmarkPopulations.observation, ...record.benchmarkPopulations.plans]) {
  if (await digest(item.path) !== item.sha256) fail(`digest drift at ${item.path}`);
}
if (!/^[0-9a-f]{40}$/.test(record.pins?.privateCustodian) || !/^[0-9a-f]{40}$/.test(record.pins?.privateLedger))
  fail('custodian or ledger source pin');
const custodianFixtures = [
  ['tests/fixtures/custodian/golden/public-projection-v2.canonical.json', record.pins.custodianProjectionV2GoldenSha256],
  ['tests/fixtures/custodian/golden/revocation-envelope.canonical.json', record.pins.custodianRevocationGoldenSha256],
];
for (const [path, expected] of custodianFixtures) {
  if (!/^[0-9a-f]{64}$/.test(expected) || await digestCanonicalFixture(path) !== expected) fail(`custodian golden drift at ${path}`);
}
if (await digest('tests/fixtures/custodian/synthetic-pii-bundle.json') !== record.pins.custodianSyntheticBundleSha256)
  fail('custodian synthetic bundle drift');
for (const key of ['custodianProjectionV2SchemaSha256', 'custodianRevocationSchemaSha256', 'custodianBridgeRequestSchemaSha256', 'custodianBridgeResponseSchemaSha256']) {
  if (!/^[0-9a-f]{64}$/.test(record.pins[key])) fail(`missing immutable ${key}`);
}
const dual = record.benchmarkPopulationDualRun;
const views = record.benchmarkPopulations.views;
if (record.acceptance?.benchmarkPopulationDualRun !== 'accepted-representable-cases' || dual?.unexplainedDifferences !== 0 ||
    record.acceptance?.residual?.notRepresentableCases !== dual?.coverage?.notRepresentableCases)
  fail('dual-run acceptance state');
// The dual-run record: pinned report, sealed schema 1.2 artifacts and counts that add up to the frozen populations.
if (await digest(dual.report.path) !== dual.report.sha256) fail('dual-run report drift');
const report = JSON.parse(await readFile(new URL(`../${dual.report.path}`, import.meta.url), 'utf8'));
if (report.reportType !== 'pii-eval-population-dual-run' || report.supportClaims !== false || report.authorityChanged !== false ||
    report.verdict?.unexplainedDifferences !== 0 || report.verdict.reportCountDisagreements !== 0 || report.verdict.bindingsRefused !== true ||
    report.verdict.comparisonDetectsInjectedDifferences !== true || report.verdict.deterministic !== true)
  fail('dual-run report verdict');
if (report.identities.piiEval.commit !== record.pins.piiEvalProjection || report.identities.piiEval.cargoLockSha256 !== record.pins.piiEvalProjectionCargoLockSha256 ||
    report.identities.oracle.commit !== record.pins.oracle || report.identities.oracle.filesTreeDigest !== record.pins.oracleFilesTreeSha256 ||
    report.identities.candidate.artifactSetCommitment !== record.benchmarkPopulations.candidate.artifactSetCommitment ||
    report.identities.activationDigest !== record.scanner.activationDigest || report.identities.configurationDigest !== record.scanner.configurationDigest)
  fail('dual-run identities');
if (dual.artifacts.length !== 4 || JSON.stringify(dual.artifacts.map(row => [row.view, row.cases])) !== JSON.stringify(expectedViews)) fail('dual-run populations');
let carried = 0, excluded = 0;
for (const item of dual.artifacts) {
  const entry = report.populations.find(row => row.view === item.view);
  if (!entry || entry.unexplained !== 0 || entry.identities.snapshotDigest !== item.snapshotDigest || entry.identities.manifestDigest !== item.manifestDigest ||
      entry.identities.rosterDigest !== item.rosterDigest || entry.artifact.semanticDigest !== item.semanticDigest || entry.artifact.publicArtifactSha256 !== item.sha256 ||
      entry.conversion.benchmarkCases !== item.cases || entry.conversion.convertedCases !== item.carriedCases || entry.conversion.excludedCases !== item.notRepresentableCases ||
      item.carriedCases + item.notRepresentableCases !== item.cases || !entry.determinism.equalSemanticDigest || !entry.determinism.byteIdenticalDocuments)
    fail(`dual-run record for ${item.view}`);
  if (await digest(item.path) !== item.sha256) fail(`dual-run artifact drift at ${item.path}`);
  const artifact = parseStrictJson(await readFile(new URL(`../${item.path}`, import.meta.url), 'utf8'));
  if (artifact.schema !== record.engine.artifactSchema.id || artifact.schemaVersion !== '1.2' || semanticDigest(artifact) !== artifact.semanticDigest ||
      artifact.semanticDigest !== item.semanticDigest || artifact.semantic.population.populationDigest !== item.snapshotDigest ||
      artifact.semantic.population.populationId !== item.populationId || artifact.semantic.manifestDigest !== item.manifestDigest)
    fail(`dual-run artifact identity at ${item.path}`);
  const projection = artifact.semantic.productProjection;
  if (JSON.stringify(projection?.requiredViews) !== JSON.stringify([item.view]) || projection.rosterDigest !== item.rosterDigest ||
      projection.rows.length === 0 || projection.rows.some(row => row.view !== item.view || row.mode !== item.mode || row.binding.scannerId !== record.scanner.id ||
        row.binding.activationDigest !== record.scanner.activationDigest || row.binding.configurationDigest !== record.scanner.configurationDigest ||
        row.binding.product.kind !== 'candidate' || row.binding.product.candidateDigest !== record.benchmarkPopulations.candidate.artifactSetCommitment ||
        row.binding.population.populationDigest !== item.snapshotDigest || row.binding.population.visibility !== 'public-synthetic'))
    fail(`dual-run projection bindings at ${item.path}`);
  if (projection.rows.reduce((n, row) => n + row.counts.authoredCases, 0) !== item.carriedCases || artifact.semantic.populationCounts.authoredCases !== item.carriedCases)
    fail(`dual-run projection denominators at ${item.path}`);
  carried += item.carriedCases; excluded += item.notRepresentableCases;
}
if (carried !== dual.coverage.carriedCases || excluded !== dual.coverage.notRepresentableCases || carried + excluded !== dual.coverage.benchmarkCases ||
    carried + excluded !== views.reduce((n, row) => n + row.cases, 0))
  fail('dual-run coverage');
if (JSON.stringify(report.populations.flatMap(row => row.classifiedDifferences.map(d => d.class))) !== JSON.stringify(report.populations.flatMap(row => row.classifiedDifferences.map(() => 'compatibility'))))
  fail('an unrecorded difference class');
console.log('PII migration ownership, pins, populations and parity classifications are consistent.');
