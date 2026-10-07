import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseStrictJson, semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { officialRecordExists, officialRecordProblems } from './lib/pii-official-record.mjs';

const file = new URL('../benchmarks/pii-eval-migration.json', import.meta.url);
const record = JSON.parse(await readFile(file, 'utf8'));
const digest = async path => createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex');
const digestCanonicalFixture = async path => createHash('sha256')
  .update((await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).trimEnd())
  .digest('hex');
const fail = message => { throw new Error(`PII migration acceptance invalid: ${message}`); };

if (record.schemaVersion !== 1 || record.reportType !== 'pii-eval-migration-acceptance' || record.supportClaims !== false || record.authorityChanged !== false)
  fail('top-level boundary');
if (record.engine?.artifactSchema?.id !== 'pii-eval.public-synthetic-artifact' || record.engine?.artifactSchema?.version !== '1.4' || JSON.stringify(record.engine.artifactSchema.readableVersions) !== JSON.stringify(['1.1', '1.2', '1.4']) ||
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
if (record.acceptance?.benchmarkPopulationDualRun !== 'accepted' || dual?.unexplainedDifferences !== 0 ||
    record.acceptance?.residual?.notRepresentableCases !== dual?.coverage?.notRepresentableCases)
  fail('dual-run acceptance state');
// The dual-run record: pinned report, sealed schema 1.4 artifacts and counts that add up to the frozen populations.
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
  // Schema 1.4: located plus range-less (authored not-established, no candidate range) memberships are the carried ones, none dropped,
  // and every range-less membership is an `unresolved` outcome in the artifact (never a pass or a fail).
  if (entry.rangeless?.cases !== item.unresolvedRangeCases || entry.rangeless.located !== item.locatedCases || item.locatedCases + item.unresolvedRangeCases !== item.carriedCases ||
      item.notRepresentableCases !== 0 || entry.rangeless.reportedAs?.typeIdentity !== 'unresolved' || entry.rangeless.reportedAs.range !== 'unresolved')
    fail(`range-less memberships of ${item.view}`);
  if (await digest(item.path) !== item.sha256) fail(`dual-run artifact drift at ${item.path}`);
  const artifact = parseStrictJson(await readFile(new URL(`../${item.path}`, import.meta.url), 'utf8'));
  if (artifact.schema !== record.engine.artifactSchema.id || artifact.schemaVersion !== record.engine.artifactSchema.version || semanticDigest(artifact) !== artifact.semanticDigest ||
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
  const unresolved = artifact.semantic.outcomes.filter(outcome => outcome.range === 'unresolved');
  if (unresolved.length !== item.unresolvedRangeCases || unresolved.some(outcome => outcome.typeIdentity !== 'unresolved' || outcome.sensitivityContext !== 'unresolved' || outcome.action.state !== 'not-measured') ||
      artifact.semantic.outcomes.filter(outcome => outcome.typeIdentity === 'unresolved').length !== item.unresolvedRangeCases)
    fail(`unresolved outcomes of ${item.path}`);
  carried += item.carriedCases; excluded += item.notRepresentableCases;
}
if (carried !== dual.coverage.carriedCases || excluded !== dual.coverage.notRepresentableCases || carried + excluded !== dual.coverage.benchmarkCases ||
    carried + excluded !== views.reduce((n, row) => n + row.cases, 0))
  fail('dual-run coverage');
if (JSON.stringify(report.populations.flatMap(row => row.classifiedDifferences.map(d => d.class))) !== JSON.stringify(report.populations.flatMap(row => row.classifiedDifferences.map(() => 'compatibility'))))
  fail('an unrecorded difference class');
// Schema 1.1, 1.2 and 1.4 files the consumer validates against are the pinned upstream ones.
for (const [version, item] of Object.entries(record.engine.artifactSchema.schemaFiles)) {
  if (!/^[0-9a-f]{40}$/.test(item.upstreamCommit) || await digest(item.path) !== item.sha256) fail(`public artifact schema ${version} drift`);
}
// The consumer pins of the four populations are the dual-run artifacts (exploratory replays of the frozen observation, the oracle parity evidence) until an official run is recorded; from then on
// the pins head is that run's artifact, the replays' digests are retired by the pins, and the record of the run (durable copies, receipt, provenance) is checked whole.
const popPins = JSON.parse(await readFile(new URL(`../${dual.consumerPins}`, import.meta.url), 'utf8'));
if (popPins.schema !== 'pii-eval-consumer-pins/1' || popPins.artifactSchema.version !== record.engine.artifactSchema.version || popPins.build.commit !== record.pins.piiEvalProjection ||
    popPins.build.cargoLockSha256 !== record.pins.piiEvalProjectionCargoLockSha256 || popPins.requireComplete !== true || popPins.populations.length !== dual.artifacts.length)
  fail('population consumer pins');
const rootPath = new URL('../', import.meta.url).pathname;
const official = officialRecordExists(rootPath);
if (official) {
  const problems = officialRecordProblems({ root: rootPath });
  if (problems.length) fail(`official run record: ${problems.join('; ')}`);
}
for (const item of dual.artifacts) {
  const pin = popPins.populations.find(row => row.label === item.view);
  // Everything the exploratory replay and the official run share must equal the migration record; the three digests an execution changes are checked by the official record.
  const sharedOk = pin && pin.population.populationDigest === item.snapshotDigest && pin.projection.rosterDigest === item.rosterDigest &&
    JSON.stringify(pin.projection.requiredViews) === JSON.stringify([item.view]) && pin.scanners.length === 1 && pin.scanners[0].product.kind === 'candidate' &&
    pin.scanners[0].candidateSourceCommit === record.benchmarkPopulations.candidate.sourceCommit && pin.scanners[0].activationDigest === record.scanner.activationDigest &&
    pin.scanners[0].configurationDigest === record.scanner.configurationDigest;
  const exploratoryOk = pin && pin.artifactDigest === item.semanticDigest && pin.manifestDigest === item.manifestDigest && pin.projection.mode === item.mode &&
    pin.scanners[0].product.candidateDigest === record.benchmarkPopulations.candidate.artifactSetCommitment;
  const officialOk = official && pin && pin.projection.mode === 'official' && pin.retiredArtifactDigests.includes(item.semanticDigest) && pin.retiredManifestDigests.includes(item.manifestDigest);
  if (!sharedOk || !(exploratoryOk || officialOk)) fail(`population consumer pin for ${item.view}`);
}
// The linux replay: the canonical engine reproduces the committed artifacts' semantic digests and bytes (a darwin build made them).
const linux = dual.linuxReplay;
if (await digest(linux.path) !== linux.sha256) fail('linux replay receipt drift');
const receipt = JSON.parse(await readFile(new URL(`../${linux.path}`, import.meta.url), 'utf8'));
if (receipt.schema !== 'redact-secret-benchmarks.pii-population-engine-replay/1' || receipt.supportClaims !== false || receipt.authorityChanged !== false || receipt.scannersLaunched !== 0 ||
    receipt.mode !== 'exploratory' || receipt.canonical !== true || receipt.engine.platform !== linux.platform || receipt.engine.binarySha256 !== linux.engineBinarySha256 ||
    receipt.engine.binarySha256 !== popPins.build.binarySha256 || receipt.engine.commit !== record.pins.piiEvalProjection || receipt.engine.matchesPin !== true ||
    linux.result !== 'equal' || receipt.verdict.allEqualSemanticDigest !== true || receipt.verdict.allReplaysByteIdentical !== true || receipt.verdict.allBytesEqualCommitted !== true ||
    receipt.populations.length !== dual.artifacts.length)
  fail('linux replay receipt');
for (const item of dual.artifacts) {
  const row = receipt.populations.find(entry => entry.view === item.view);
  if (!row || row.semanticDigestReplayed !== item.semanticDigest || row.semanticDigestCommitted !== item.semanticDigest || row.artifactSha256Replayed !== item.sha256 ||
      !row.equalSemanticDigest || !row.bytesEqualCommitted || !row.replaysByteIdentical)
    fail(`linux replay differs from the committed artifact for ${item.view}`);
}
const binding = record.publicationBinding;
const source = JSON.parse(await readFile(new URL(`../${binding.transportPins}`, import.meta.url), 'utf8'));
if (source.workflow.runId !== binding.ciRun.runId || source.workflow.headSha !== binding.ciRun.headSha || source.workflow.headSha !== record.pins.piiEvalProjection ||
    source.artifacts.engine.id !== binding.ciRun.engineArtifactId || source.artifacts.measurement.id !== binding.ciRun.measurementArtifactId ||
    source.durableCopy.path !== binding.durableCopy || binding.stagingOnly !== true || popPins.build.binarySha256 !== source.artifacts.engine.members['pii-eval'])
  fail('publication binding');
console.log('PII migration ownership, pins, populations and parity classifications are consistent.');
