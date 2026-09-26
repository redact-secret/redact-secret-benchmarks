import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { publicEvaluation } from '../benchmarks/engine/public-report.ts';
import { hash } from '../benchmarks/engine/model.ts';
import { carryReviewHistory, observeReviewEntries, reviewLedgerProblem, type ReviewLedger } from '../benchmarks/engine/review-ledger.ts';
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(input|qualification|ledger-history)=(.+)$/.exec(arg);
  if (!match) throw Error('Usage: npm run eval:publish -- [--input=results-output/evaluation.json] [--qualification=path] [--ledger-history=previous-review-ledger-v2.json]');
  return [match[1], match[2]];
}));
const raw = JSON.parse(await readFile(options.input ?? 'results-output/evaluation.json', 'utf8'));
const cases = await loadCases(createOperators());
const categories = JSON.parse(await readFile('benchmarks/categories.json', 'utf8')).filter((category: { calibrationOnly?: boolean }) => !category.calibrationOnly);
const hashes = Object.fromEntries(await Promise.all(categories.map(async (c: { id: string; corpus: string }) => [c.id, hash(await readFile(c.corpus))])));
const qualification = options.qualification ? JSON.parse(await readFile(options.qualification, 'utf8')) : null;
const report = publicEvaluation(raw, cases, hashes, qualification);
const sourceLedger = JSON.parse(await readFile('benchmarks/review-ledger.json', 'utf8')) as ReviewLedger;
const sourceProblem = reviewLedgerProblem(sourceLedger);
if (sourceProblem) throw new Error(sourceProblem);
let previous: ReviewLedger | null = null;
if (options['ledger-history']) {
  previous = JSON.parse(await readFile(options['ledger-history'], 'utf8'));
  const previousProblem = reviewLedgerProblem(previous);
  if (previousProblem) throw new Error(`Invalid prior review history: ${previousProblem}`);
}
const sourceByCase = new Map(report.cases.map(source => [source.id, source]));
const occurrences = report.reviews.map(review => {
  const source = sourceByCase.get(review.caseId);
  if (!source) throw new Error(`Review ${review.id.slice(0, 12)} has no public source`);
  return { id: review.id, caseId: review.caseId, sourceSlug: source.sourceSlug, variant: review.variant,
    ...(review.peer ? { peer: review.peer } : {}), ...(review.disagreement ? { disagreement: review.disagreement } : {}) };
});
const publishedLedger = observeReviewEntries(carryReviewHistory(sourceLedger, previous), occurrences, report.runId, report.finishedAt);
await mkdir('public/results', { recursive: true });
const target = 'public/results/evaluation-v1.json', temp = `${target}.tmp`;
await writeFile(temp, JSON.stringify(report) + '\n');
await rename(temp, target);
const ledgerTarget = 'public/results/review-ledger-v2.json', ledgerTemp = `${ledgerTarget}.tmp`;
await writeFile(ledgerTemp, JSON.stringify(publishedLedger) + '\n');
await rename(ledgerTemp, ledgerTarget);
console.log(`Published ${report.cases.length} development/regression cases and ${report.reviews.length} observed review entries; holdout aggregate only: ${Boolean(qualification)}`);
