/**
 * CI gate (#680): the known-gaps ledger header cannot silently go stale. `benchmarks/known-gaps.json` carries hand-set `reviewedAt` and `measuredVersion`; nothing
 * refreshes them, and a header that lags the records or the accepted run misdescribes every finding page. Two read-only checks:
 *
 *   1. the newest history date of any record is not after `reviewedAt` (a record was advanced without a header review);
 *   2. `measuredVersion` is the product release the ACCEPTED official run scanned (the `redact-secret` pin of `benchmarks/official-runs.json`, which the authority file
 *      names): an acceptance of a new product release fails this check until the ledger is re-checked against it (`scripts/verify-known-gaps.ts`).
 *
 * When `reverification` is recorded it must name the same product and run the accepted archive records, and be dated no later than `reviewedAt`. This repository
 * records and never asserts: the gate compares dates and identities, it marks no record verified.
 *
 * Run: npm run known-gaps:currency:check
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

/** Pure. `gaps` is known-gaps.json, `registry` official-runs.json, `archive` official-run-archive.json. Returns the problems. */
export function knownGapsCurrencyProblems(gaps, registry, archive) {
  const problems = [];
  const dates = [];
  for (const record of gaps.issues ?? []) for (const entry of Object.values(record.history ?? {})) if (entry?.at) dates.push(entry.at);
  const newest = dates.sort().at(-1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gaps.reviewedAt ?? '')) problems.push('reviewedAt must be YYYY-MM-DD');
  else if (newest && newest > gaps.reviewedAt) problems.push(`the newest record history date ${newest} is after reviewedAt ${gaps.reviewedAt}: review the header (reviewedAt, measuredVersion, reverification) when records advance`);
  const product = registry.scanners?.find(s => s.id === 'redact-secret');
  if (!product?.version) problems.push('official-runs.json pins no redact-secret product release');
  else if (gaps.measuredVersion !== product.version) problems.push(`measuredVersion ${gaps.measuredVersion} is not the release the accepted official run scanned (${product.version}): re-check the ledger against the accepted run (scripts/verify-known-gaps.ts) and update the header`);
  const r = gaps.reverification;
  if (r) {
    if (product?.version && r.product !== `${product.package}@${product.version}`) problems.push(`reverification.product ${r.product} is not the accepted run's product ${product.package}@${product.version}`);
    if (archive?.source?.ciRun && !String(r.run).endsWith(`/${archive.source.ciRun}`)) problems.push(`reverification.run ${r.run} is not the accepted run ${archive.source.ciRun}`);
    if (gaps.reviewedAt && r.checkedOn > gaps.reviewedAt) problems.push(`reverification.checkedOn ${r.checkedOn} is after reviewedAt ${gaps.reviewedAt}`);
  }
  return problems;
}

export function checkKnownGapsCurrency() {
  return knownGapsCurrencyProblems(readJson('benchmarks/known-gaps.json'), readJson('benchmarks/official-runs.json'), readJson('benchmarks/official-run-archive.json'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkKnownGapsCurrency();
  if (problems.length) { console.error(`${problems.length} known-gaps currency problem(s):\n${problems.map(p => `  - ${p}`).join('\n')}`); process.exit(1); }
  console.log('Known-gaps ledger header is current: reviewedAt is not before the newest record date, and measuredVersion is the accepted run\'s product release.');
}
