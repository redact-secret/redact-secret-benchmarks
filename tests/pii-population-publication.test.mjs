import test from 'node:test';
import assert from 'node:assert/strict';
import { piiFindingIdentity } from '../scanners/candidate.mjs';
import { piiPopulationSelectors, piiPopulationScannerConfiguration } from '../scripts/observe-pii-populations.mjs';
import { populationOracleBindingsFrom as populationBindingsFrom, productEvidenceFor } from '../scripts/pii-publication-inputs.ts';
import { piiSupportRegistry } from '../benchmarks/evaluation/domains/pii/support-v2.ts';

const PHONE_PRODUCT = { sourceCommit: '2e1bdcf0905f7a374c4c54b7caac41303cd7d88b', coreSha256: 'ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1' };

test('every product PII finding type maps back to its exact family, and nothing else does', () => {
  assert.deepEqual(piiFindingIdentity('pii_global_network_address'), { family: 'pii:global:network-address', sensitive: true });
  assert.deepEqual(piiFindingIdentity('pii_jurisdiction_us_ssn'), { family: 'pii:us:ssn', jurisdiction: 'US', sensitive: true });
  for (const row of piiSupportRegistry.families) {
    const [, scope, slug] = row.family.split(':'), type = scope === 'global' ? `pii_global_${slug.replaceAll('-', '_')}` : `pii_jurisdiction_${scope}_${slug.replaceAll('-', '_')}`;
    assert.equal(piiFindingIdentity(type).family, row.family, type);
  }
  for (const type of ['pii_global_', 'pii_jurisdiction_usa_ssn', 'github_token', 'PII_GLOBAL_EMAIL']) assert.equal(piiFindingIdentity(type), null, type);
});

test('the population observer requests one selector per registered scope under one scanner identity', () => {
  assert.deepEqual(piiPopulationSelectors(), ['pii:global', 'pii:us']);
  assert.deepEqual(piiPopulationScannerConfiguration().requestedSelectors, piiPopulationSelectors());
});

test('historical activation records do not describe the current measured products', async () => {
  assert.equal(await productEvidenceFor(PHONE_PRODUCT), null);
  assert.equal(await productEvidenceFor({ ...PHONE_PRODUCT, sourceCommit: 'f'.repeat(40) }), null);
  await assert.rejects(productEvidenceFor({ ...PHONE_PRODUCT, sourceCommit: 'not-a-sha' }), /Invalid measured product/);
});

test('a population bundle binds only when its candidate is the measured product', () => {
  const report = population => ({ population }), rows = [];
  const bundle = candidate => ({ schemaVersion: 1, candidate, comparisons: ['diagnostic-balanced', 'benign-heavy-stress'].map(population =>
    ({ population, baselineReport: report(population), candidateReport: report(population), baselineRows: rows, candidateRows: rows })) });
  const matching = bundle({ sourceCommit: PHONE_PRODUCT.sourceCommit, components: { core: PHONE_PRODUCT.coreSha256 } });
  assert.equal(populationBindingsFrom(matching, PHONE_PRODUCT).populations.length, 2);
  assert.throws(() => populationBindingsFrom(bundle({ sourceCommit: 'f'.repeat(40), components: { core: PHONE_PRODUCT.coreSha256 } }), PHONE_PRODUCT), /another product/);
  assert.throws(() => populationBindingsFrom(bundle(undefined), PHONE_PRODUCT), /another product/);
  assert.throws(() => populationBindingsFrom({ ...matching, comparisons: matching.comparisons.slice(1) }, null), /Invalid PII population release bundle/);
});

test('a candidate that is the released lockfile package writes no population bundle', async () => {
  const { mkdtemp, mkdir, rm, access } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), path = await import('node:path');
  const { execFile } = await import('node:child_process'), { promisify } = await import('node:util');
  const { packLockfileRelease } = await import('../scripts/observe-pii-populations.mjs');
  await mkdir('results-output', {recursive:true});
  const scratch = await mkdtemp(path.resolve('results-output/pii-population-released-')), output = path.join(scratch, 'out', 'bundle.json');
  try {
    const released = await packLockfileRelease(scratch);
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/observe-pii-populations.mjs',
      `--candidate-core=${released.core}`, `--candidate-node=${released.node}`, `--candidate-wasm=${released.wasm}`, `--output=${output}`]);
    assert.match(stdout, /no unreleased candidate/);
    assert.match(stdout, /candidate equals the published release; no comparison/);
    await assert.rejects(access(output));
  } finally { await rm(scratch, { recursive: true, force: true }); }
});

test('equal baseline and candidate artifact sets are detected offline, and the direct comparison still refuses them', async () => {
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), path = await import('node:path');
  const { sameArtifacts, observePiiPopulations, CANDIDATE_EQUALS_RELEASE_LABEL } = await import('../scripts/observe-pii-populations.mjs');
  const scratch = await mkdtemp(path.join(tmpdir(), 'pii-population-equal-'));
  try {
    const make = async (dir, tag) => Object.fromEntries(await Promise.all(['core', 'node', 'wasm'].map(async role => {
      const file = path.join(scratch, `${dir}-${role}.tgz`); await writeFile(file, `${role}:${tag}`); return [role, file]; })));
    const a = await make('a', 'x'), b = await make('b', 'x'), c = await make('c', 'y');
    assert.equal(await sameArtifacts(a, b), true);
    assert.equal(await sameArtifacts(a, c), false);
    await assert.rejects(observePiiPopulations({ baseline: a, candidate: b }), /same artifacts/);
    assert.equal(CANDIDATE_EQUALS_RELEASE_LABEL, 'candidate equals the published release; no comparison');
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
