import { readFile, mkdir, writeFile, rename, rm, stat } from 'node:fs/promises';
import { credentialDomain } from '../benchmarks/evaluation/domains/credential/contract.ts';
import { assertPublicDiscovery, projectPublicCase, projectPublicReview, publicCaseAccepted, publicEvaluation, publicEvaluationSummary, type DiscoveryHeader } from '../benchmarks/evaluation/domains/credential/public-report.ts';
import { hash } from '../benchmarks/evaluation/model/model.ts';
import { carryReviewHistory, observeReviewEntries, reviewLedgerProblem, type ReviewLedger } from '../benchmarks/evaluation/model/review-ledger.ts';
import { BundleWriter, bundleReviews, commitBundle } from '../benchmarks/evaluation/bundle/bundle.ts';
import { materializeDiscovery, openDiscovery } from '../benchmarks/evaluation/storage/discovery-store.ts';
import { DEFAULT_MAX_PART_BYTES } from '../benchmarks/evaluation/storage/parts.ts';
import type { EvaluationCase as PublicCase } from '../benchmarks/shared/evaluation-types.ts';

const USAGE = 'Usage: npm run eval:publish -- [--input=results-output/evaluation (a discovery store directory, or a legacy single evaluation.json)] [--qualification=path] [--ledger-history=previous-review-ledger-v2.json] [--max-part-bytes=N] [--legacy-v1]';
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(input|qualification|ledger-history|max-part-bytes)=(.+)$/.exec(arg);
  if (!match && arg !== '--legacy-v1') throw Error(USAGE);
  return match ? [match[1], match[2]] : ['legacy-v1', 'true'];
}));
// The default input is the sharded discovery store; a pre-existing single file is the explicit legacy read (cheap, never a scanner run).
const exists = (file: string) => stat(file).then(() => true, () => false);
const input = options.input ?? ((await exists('results-output/evaluation/manifest.json')) || !(await exists('results-output/evaluation.json')) ? 'results-output/evaluation' : 'results-output/evaluation.json');
const reader = await openDiscovery<DiscoveryHeader>(input);
if (reader.kind === 'legacy-file') console.warn(`Reading the legacy single-file discovery report ${input}; new runs write a sharded store.`);
const header = await reader.header();
assertPublicDiscovery(header);
const cases = await credentialDomain.loadCases(credentialDomain.createOperators());
const categories = JSON.parse(await readFile('benchmarks/categories.json', 'utf8')).filter((category: { calibrationOnly?: boolean }) => !category.calibrationOnly);
const hashes = Object.fromEntries(await Promise.all(categories.map(async (c: { id: string; corpus: string }) => [c.id, hash(await readFile(c.corpus))])));
const qualification = options.qualification ? JSON.parse(await readFile(options.qualification, 'utf8')) : null;
const sourceLedger = JSON.parse(await readFile('benchmarks/review-ledger.json', 'utf8')) as ReviewLedger;
const sourceProblem = reviewLedgerProblem(sourceLedger);
if (sourceProblem) throw new Error(sourceProblem);
let previous: ReviewLedger | null = null;
if (options['ledger-history']) {
  previous = JSON.parse(await readFile(options['ledger-history'], 'utf8'));
  const previousProblem = reviewLedgerProblem(previous);
  if (previousProblem) throw new Error(`Invalid prior review history: ${previousProblem}`);
}
const observe = (reviews: { id: string; caseId: string; variant: string; peer?: string; disagreement?: string }[], slugOf: (caseId: string) => string | undefined, runId: string, finishedAt: string) => {
  const occurrences = reviews.map(review => {
    const sourceSlug = slugOf(review.caseId);
    if (!sourceSlug) throw new Error(`Review ${review.id.slice(0, 12)} has no public source`);
    return { id: review.id, caseId: review.caseId, sourceSlug, variant: review.variant, ...(review.peer ? { peer: review.peer } : {}), ...(review.disagreement ? { disagreement: review.disagreement } : {}) };
  });
  const unknown = occurrences.filter(occurrence => !Object.hasOwn(sourceLedger.entries, occurrence.id));
  if (unknown.length) console.warn(`Publishing locked review provenance: ${unknown.length} observed review entries are absent from the checked-in ledger.`);
  return observeReviewEntries(carryReviewHistory(sourceLedger, previous), occurrences, runId, finishedAt, { unknown: 'ignore' });
};
const writeAtomic = async (target: string, text: string) => { const temporary = `${target}.tmp`; await writeFile(temporary, text); await rename(temporary, target); };
await mkdir('public/results', { recursive: true });
const ledgerTarget = 'public/results/review-ledger-v2.json';

if (options['legacy-v1']) {
  // Explicit compatibility: the whole evaluation-v1.json for an oracle consumer. Whole-report, bounded only by V8's string limit; never part of normal publication.
  const report = publicEvaluation(await materializeDiscovery(reader) as never, cases, hashes, qualification);
  await writeAtomic('public/results/evaluation-v1.json', JSON.stringify(report) + '\n');
  const slugs = new Map(report.cases.map(c => [c.id, c.sourceSlug]));
  const published = observe(report.reviews, id => slugs.get(id), report.runId, report.finishedAt);
  await writeAtomic(ledgerTarget, JSON.stringify(published) + '\n');
  console.log(`Published (legacy evaluation-v1) ${report.cases.length} cases and ${report.reviews.length} observed review entries; holdout aggregate only: ${Boolean(qualification)}`);
} else {
  const sources = new Map(cases.map(source => [source.id, source]));
  const staging = `public/results/.evaluation-bundle-${header.runId}.staging`;
  await rm(staging, { recursive: true, force: true });
  const maxPartBytes = options['max-part-bytes'] ? Number(options['max-part-bytes']) : DEFAULT_MAX_PART_BYTES;
  const writer = new BundleWriter(staging, { runId: header.runId, casesHash: String((header.provenance as unknown as Record<string, unknown>).casesHash) }, maxPartBytes);
  try {
    await writer.open();
    let caseCount = 0, variantCount = 0;
    for await (const result of reader.results<Parameters<typeof projectPublicCase>[1]>()) {
      const source = sources.get(result.id);
      if (!source || !publicCaseAccepted(source, result)) throw new Error('Unknown, protected or stale discovery source; publication refused');
      const projected: PublicCase = projectPublicCase(source, result);
      caseCount += 1; variantCount += projected.variants.length;
      await writer.addCase(projected);
    }
    if (header.caseCount !== caseCount || header.variantCount !== variantCount) throw new Error('Discovery totals mismatch');
    for await (const review of reader.reviewQueue<Parameters<typeof projectPublicReview>[0]>()) await writer.addReview(projectPublicReview(review));
    const manifest = await writer.finish(publicEvaluationSummary(header, writer.operatorTotals(), hashes, qualification));
    let reviews = 0;
    const { validation, pointer } = await commitBundle('public/results', staging, manifest, { beforePointer: async validation => {
      // Bind the observed ledger to the same run before the pointer moves; a mismatch publishes nothing as complete.
      const dir = `public/results/evaluation-bundles/${manifest.bundleId}`, list = [];
      for await (const review of bundleReviews(dir, validation.manifest)) { list.push(review); reviews += 1; }
      const published = observe(list, id => validation.index.cases.get(id)?.sourceSlug, validation.summary.runId, validation.summary.finishedAt);
      // The observed ledger must describe this exact run; membership and per-entry binding are the publication gate's (check-review-ledger), as before.
      if (published.observationRun?.runId !== validation.summary.runId || published.observationRun.observedAt !== validation.summary.finishedAt) throw new Error('Review ledger does not describe the published bundle run');
      await writeAtomic(ledgerTarget, JSON.stringify(published) + '\n');
    } });
    console.log(`Published evaluation bundle ${pointer.bundleId}: ${validation.manifest.totals.cases} cases in ${validation.manifest.cases.length} parts, ${reviews} observed review entries in ${validation.manifest.reviews.length} parts; largest part ${validation.maxPartBytes} bytes; holdout aggregate only: ${Boolean(qualification)}`);
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
}
