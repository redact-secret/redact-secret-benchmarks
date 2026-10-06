/**
 * Validate a published evaluation bundle by streaming (digests, schema, contract rules, reconciled totals) and, with --legacy, compare it with a whole-report evaluation-v1.json for semantic
 * equivalence: the same summary, the same cases and reviews (grouped by method in discovery order), nothing dropped or added. Prints what it measured (bytes, parts, time, peak RSS).
 * The legacy comparison parses the whole old file, so it is a verification tool, not a publication path. Reads only; runs no scanner.
 *
 *   node --import tsx scripts/verify-evaluation-bundle.ts [--results=public/results] [--legacy=public/results/evaluation-v1.json] [--out=file.json]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { BundleError, CASE_METHODS, bundleCases, bundleReviews, resolveBundle, validateBundle } from '../benchmarks/evaluation/bundle/bundle.ts';
import { canonical } from '../benchmarks/shared/evaluation-model.ts';
import type { EvaluationReport } from '../benchmarks/shared/evaluation-types.ts';

const options = Object.fromEntries(process.argv.slice(2).map(arg => { const m = /^--(results|legacy|out)=(.+)$/.exec(arg); if (!m) throw new Error('Usage: verify-evaluation-bundle.ts [--results=DIR] [--legacy=FILE] [--out=FILE]'); return [m[1], m[2]]; }));
const results = options.results ?? 'public/results';
const started = Date.now();
const { directory, manifest } = await resolveBundle(results);
const validation = await validateBundle(directory);
const measured: Record<string, unknown> = { bundleId: manifest.bundleId, runId: manifest.runId, cases: manifest.totals.cases, variants: manifest.totals.variants, reviews: manifest.totals.reviews,
  caseParts: manifest.cases.length, reviewParts: manifest.reviews.length, largestPartBytes: validation.maxPartBytes, maxPartBytes: manifest.maxPartBytes,
  detailBytes: [...manifest.cases, ...manifest.reviews].reduce((n, p) => n + p.bytes, 0), summaryBytes: manifest.summary.bytes, validateMs: Date.now() - started };
if (options.legacy) {
  const legacy = JSON.parse(await readFile(options.legacy, 'utf8')) as EvaluationReport;
  const { cases, reviews, ...summary } = legacy;
  const problems: string[] = [];
  if (canonical(summary) !== canonical(validation.summary)) problems.push('the summary differs from the legacy report');
  const byMethod = new Map<string, EvaluationReport['cases']>();
  for (const c of cases) byMethod.set(c.method, [...(byMethod.get(c.method) ?? []), c]);
  for (const method of CASE_METHODS) {
    const expected = byMethod.get(method) ?? [];
    let i = 0;
    for await (const c of bundleCases(directory, manifest, method)) { if (canonical(c) !== canonical(expected[i])) problems.push(`case ${c.id} differs`); i += 1; }
    if (i !== expected.length) problems.push(`${method}: ${i} cases, legacy has ${expected.length}`);
  }
  let r = 0;
  for await (const q of bundleReviews(directory, manifest)) { if (canonical(q) !== canonical(reviews[r])) problems.push(`review ${q.id} differs`); r += 1; }
  if (r !== reviews.length) problems.push(`${r} reviews, legacy has ${reviews.length}`);
  measured.legacy = { file: options.legacy, equivalent: problems.length === 0, problems: problems.slice(0, 20), cases: cases.length, reviews: reviews.length };
  if (problems.length) { console.error(JSON.stringify(measured, null, 2)); throw new BundleError(`The bundle is not equivalent to ${options.legacy}`); }
}
measured.peakRssBytes = process.resourceUsage().maxRSS * 1024;
const text = `${JSON.stringify(measured, null, 2)}\n`;
if (options.out) await writeFile(options.out, text); else process.stdout.write(text);
