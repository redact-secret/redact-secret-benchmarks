import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const file = new URL('../benchmarks/pii-eval-migration.json', import.meta.url);
const record = JSON.parse(await readFile(file, 'utf8'));
const digest = async path => createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex');
const fail = message => { throw new Error(`PII migration acceptance invalid: ${message}`); };

if (record.schemaVersion !== 1 || record.reportType !== 'pii-eval-migration-acceptance' || record.supportClaims !== false || record.authorityChanged !== false)
  fail('top-level boundary');
if (record.engine?.artifactSchema?.id !== 'pii-eval.public-synthetic-artifact' || record.engine?.artifactSchema?.version !== '1.1' ||
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
if (record.acceptance?.benchmarkPopulationDualRun !== 'blocked-schema-1.2' || !record.acceptance?.reason?.includes('schema 1.1'))
  fail('missing explicit schema blocker');
console.log('PII migration ownership, pins, populations and parity classifications are consistent.');
