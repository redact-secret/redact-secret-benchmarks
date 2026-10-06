// Synthetic evaluation bundles for the domain, PII and CLI tests (#790): a small real-model report written through the production BundleWriter and commitBundle. No scanner run, no retained evidence.
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadCases } from '../../benchmarks/evaluation/domains/credential/cases.ts';
import { createMethods } from '../../benchmarks/evaluation/domains/credential/methods/index.ts';
import { createOperators } from '../../benchmarks/evaluation/domains/credential/operators/index.ts';
import { runEvaluation } from '../../benchmarks/evaluation/domains/credential/runner.ts';
import { publicEvaluation } from '../../benchmarks/evaluation/domains/credential/public-report.ts';
import { taxonomy } from '../../benchmarks/support/taxonomy.ts';
import fixtureIndex from '../../benchmarks/fixture-index.json' with { type: 'json' };
import { withMatrixExtras } from '../support-matrix-extras.mjs';
import { BundleWriter, commitBundle } from '../../benchmarks/evaluation/bundle/bundle.ts';

const operators = createOperators(), sources = await loadCases(operators);
const selected = ['twin', 'benign', 'mutation', 'differential'].map(method => sources.find(c => c.method === method));
const scanners = [{ id: 'redact-secret', mode: 'test', async version() { return '1.0.0'; }, async scan() { return []; } },
  { id: 'peer', mode: 'test', async version() { throw Error('unavailable'); }, async scan() { return []; } }];
const raw = await runEvaluation({ cases: selected, methods: createMethods(), operators, scanners });
const hashes = { test: 'hash' };

export const syntheticReport = (runId = raw.runId) => publicEvaluation(structuredClone({ ...raw, runId }), sources, hashes);
export const tempDirectory = prefix => mkdtemp(path.join(tmpdir(), prefix));

/** Writes the synthetic report as a committed bundle under `resultsDirectory` and returns what commitBundle returns. */
export async function publishSyntheticBundle(resultsDirectory, { runId, maxPartBytes = 8 * 1024 * 1024 } = {}) {
  const report = syntheticReport(runId);
  const staging = path.join(resultsDirectory, `.staging-${report.runId}`);
  await mkdir(resultsDirectory, { recursive: true });
  const writer = new BundleWriter(staging, { runId: report.runId, casesHash: report.provenance.casesHash }, maxPartBytes);
  await writer.open();
  for (const c of report.cases) await writer.addCase(c);
  for (const r of report.reviews) await writer.addReview(r);
  const { cases: _cases, reviews: _reviews, ...summary } = report;
  const manifest = await writer.finish(summary);
  return commitBundle(resultsDirectory, staging, manifest);
}

/** A minimal credential support matrix the support-model contract accepts (every family unsupported): only its validity and bytes matter to the publishers. */
export const syntheticSupportMatrix = () => withMatrixExtras({
  schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
  sourceReport: { schemaVersion: 1, generatedAt: '2026-10-02T00:00:00.000Z', runId: 'run', revision: 'f'.repeat(40), dirty: false, criteriaSchemaVersion: 1,
    fixtureIndex: fixtureIndex.identity, taxonomyDigest: fixtureIndex.sources.taxonomy.digest,
    scannerObservations: { 'redact-secret': { source: 'fresh', observedAt: '2026-10-02T00:00:00.000Z', sourceRunId: 'run' } } },
  providerCount: taxonomy.providers.length, familyCount: taxonomy.families.length,
  distribution: { stable: 0, provisional: 0, pending: 0, unsupported: taxonomy.families.length }, stableDistribution: { documented: 0, empirical: 0 },
  families: taxonomy.families.map(family => ({ provider: family.provider, family: family.id, familyName: family.name, status: 'unsupported', evidenceTier: null, evidenceBasis: 'none', qualificationProfile: null,
    providerSource: null, corroboratingScanners: [], twinCoverage: null, unresolvedCriticalItems: null, empiricalEvidence: null, policyQualification: null,
    fixtureProfile: null, profileCoverage: null, detectors: [], reason: 'unsupported for this test' })),
});
