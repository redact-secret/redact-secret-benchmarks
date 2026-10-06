/**
 * Writes a synthetic evaluation report as a real bundle (BundleWriter + commitBundle, the producer's own code) into a results directory,
 * for the service and the old-versus-new equivalence tests. Every figure is the synthetic report's; nothing here reads the run or the ledger.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BundleWriter, commitBundle } from '../../../benchmarks/evaluation/bundle/bundle.ts';
import type { EvaluationReport } from '../../../benchmarks/shared/evaluation-types.ts';

/** 4000 bytes holds the synthetic summary (about 3.8 KB) and a few cases, so a padded method spans several parts. */
export async function writeBundle(resultsDir: string, report: EvaluationReport, corpusHashes?: Record<string, string>, maxPartBytes = 4000) {
  const staging = mkdtempSync(path.join(tmpdir(), 'web-bundle-staging-'));
  const writer = new BundleWriter(staging, { runId: report.runId, casesHash: report.provenance.casesHash }, maxPartBytes);
  await writer.open();
  for (const c of report.cases) await writer.addCase(c);
  for (const r of report.reviews) await writer.addReview(r);
  const { cases: _cases, reviews: _reviews, ...summary } = report;
  const manifest = await writer.finish(summary);
  return commitBundle(resultsDir, staging, manifest, { corpusHashes });
}
