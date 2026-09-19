// Read-only v1.1 scorer over rows an existing run already produced. It runs
// no scanner, enforces no floor and writes nothing but a Markdown table of
// group keys and counts: no fixture bytes, seeds, ranges or scanner output.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoredRow, AccountingConfig } from '../benchmarks/types.ts';
import { accountGroups, accountingDelta, accountCounts, floorFor, validateAccounting } from '../benchmarks/lib/accounting.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
const overrides = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(minDenominator|resolvedRateFloor|measurableShareFloor|twinCoverageFloor)=([0-9.]+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:dry-run -- [--minDenominator=5] [--resolvedRateFloor=0.9] [--measurableShareFloor=0.8] [--twinCoverageFloor=0.5]');
  return [match[1], Number(match[2])];
}));
const config: AccountingConfig = validateAccounting({ ...suite.accounting, ...overrides });

const resultsDir = path.join(root, 'public/results');
const files = (await readdir(resultsDir)).filter(f => f.endsWith('.json') && f !== 'run.json' && !f.startsWith('.')).sort();
if (!files.length) throw new Error('No bench reports: run npm run bench first');
// Only per-suite bench reports carry rows; the published evaluation lives beside them.
const reports = (await Promise.all(files.map(async f => JSON.parse(await readFile(path.join(resultsDir, f), 'utf8'))))).filter(r => typeof r.category === 'string');
if (new Set(reports.map(r => r.runId)).size !== 1) throw new Error('Bench reports come from different runs: rerun npm run bench');

const verdict = (ok: boolean | null) => (ok === null ? 'n/a' : ok ? 'pass' : '**fail**');
const share = (n: number, d: number) => (d ? `${n}/${d} = ${(n / d).toFixed(3)}` : '—');
const lines: string[] = [`Accounting dry run — run \`${reports[0].runId}\`, ${reports.length} suites. Floors: minDenominator ${config.minDenominator}, resolvedRate ${JSON.stringify(config.resolvedRateFloor)}, measurableShare ${JSON.stringify(config.measurableShareFloor)}, twinCoverage ${JSON.stringify(config.twinCoverageFloor)}.`, ''];

const scannerIds: string[] = [...new Set(reports.flatMap(r => r.scanners.filter((s: any) => s.status === 'complete').map((s: any) => s.id as string)))];
const corpusRows = (scanner: string): ScoredRow[] => reports.flatMap(r => (r.scanners.find((s: any) => s.id === scanner && s.status === 'complete')?.rows ?? [])
  .map((row: ScoredRow) => ({ ...row, id: `${r.category}--${row.id}`, twinOf: row.twinOf ? `${r.category}--${row.twinOf}` : undefined })));

// Structural floors depend on the corpus, not on any scanner's findings.
lines.push('### Corpus-wide groups × floors (scanner-independent)', '',
  '| Group | files | spans | pending (same kind) | measurableShare | floor | twin pairs/positives | floor | n ≥ minDenominator |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
const reference = accountGroups(corpusRows(scannerIds[0]), config);
for (const [key, g] of Object.entries(reference)) {
  if (key === 'pending/T0') { lines.push(`| ${key} | ${g.files} | — | ${JSON.stringify(g.candidateKinds)} | — | n/a | — | n/a | n/a |`); continue; }
  const kind = key.split('/')[0], n = g.spans ?? g.files;
  if (g.twins) lines.push(`| ${key} | ${g.files} | ${g.spans} | ${g.pendingFiles} | ${share(g.files, g.files + g.pendingFiles!)} | ${verdict(g.files / (g.files + g.pendingFiles!) >= floorFor(config.measurableShareFloor, kind))} | ${share(g.twins.pairs, g.twins.positives)} | ${verdict(g.twins.pairs / g.twins.positives >= floorFor(config.twinCoverageFloor, kind) && g.twins.pairs >= config.minDenominator)} | ${verdict(n >= config.minDenominator)} |`);
  else lines.push(`| ${key} | ${g.files} | — | — | — | n/a | — | n/a | ${verdict(n >= config.minDenominator)} |`);
}

lines.push('', '### Per-suite reports: groups each floor would withhold', '', '| Suite | groups | below minDenominator | below measurableShare | twins withheld (coverage or pairs) |', '| --- | --- | --- | --- | --- |');
for (const r of reports) {
  const rows = r.scanners.find((s: any) => s.status === 'complete')?.rows ?? [];
  const groups = Object.entries(accountGroups(rows, config)).filter(([k]) => k !== 'pending/T0');
  const small = groups.filter(([, g]) => (g.spans ?? g.files) < config.minDenominator).map(([k]) => k);
  const unmeasurable = groups.filter(([k, g]) => g.twins && g.files / (g.files + g.pendingFiles!) < floorFor(config.measurableShareFloor, k.split('/')[0])).map(([k]) => k);
  const twinless = groups.filter(([k, g]) => g.twins && (g.twins.pairs / g.twins.positives < floorFor(config.twinCoverageFloor, k.split('/')[0]) || g.twins.pairs < config.minDenominator)).map(([k]) => k);
  lines.push(`| ${r.category} | ${groups.length} | ${small.join(', ') || '—'} | ${unmeasurable.join(', ') || '—'} | ${twinless.join(', ') || '—'} |`);
}

lines.push('', '### accountingDelta per scanner (corpus-wide)', '', '| Scanner | Group | cause | v1.0 → v1.1 (published figure) |', '| --- | --- | --- | --- |');
const figure = (v: unknown) => (v && typeof v === 'object' ? `${(v as any).point} (bound ${(v as any).bound}, n ${(v as any).n})` : String(v));
for (const scanner of scannerIds) {
  for (const [key, d] of Object.entries(accountingDelta(corpusRows(scanner), config).groups)) {
    const headline = key.startsWith('must-not-flag/') ? 'falseAlarmRate' : 'leakedSpanRate';
    const twins = 'twins.rate' in d.v10 ? `; twins.rate ${d.v10['twins.rate']} → ${figure(d.v11['twins.rate'])}` : '';
    lines.push(`| ${scanner} | ${key} | ${d.cause.join(', ') || 'no-op'} | ${headline} ${d.v10[headline]} → ${figure(d.v11[headline])}${twins} |`);
  }
}

try {
  const evaluation = JSON.parse(await readFile(path.join(root, 'results-output/evaluation.json'), 'utf8'));
  // Review-required rows come from T0 tiers and deferred expectations, so collapse scanners and assertion types.
  const strata: Record<string, Record<string, number>> = {};
  for (const [key, counts] of Object.entries<Record<string, number>>(evaluation.byMethod)) {
    const [method, , stratum] = key.split('/');
    const row = (strata[`${method}/${stratum}`] ??= {});
    for (const [status, n] of Object.entries(counts)) if (typeof n === 'number' && ['pass', 'fail', 'review-required', 'not-measured'].includes(status)) row[status] = (row[status] ?? 0) + n;
  }
  lines.push('', '### resolvedRate per method/stratum (discovery run, all scanners)', '', '| Method/stratum | resolved/total | floor | verdict |', '| --- | --- | --- | --- |');
  for (const [key, counts] of Object.entries(strata).sort(([a], [b]) => a.localeCompare(b))) {
    const c = accountCounts(counts, config), floor = floorFor(config.resolvedRateFloor, key.split('/')[0]);
    // T0 strata are unresolved by construction; they are charged through measurableShare and the review ledger, not this floor.
    const exempt = key.includes(':T0');
    lines.push(`| ${key} | ${share(c.resolved, c.total)} | ${exempt ? 'exempt (T0)' : floor} | ${exempt ? 'n/a' : verdict(c.total ? c.resolved / c.total >= floor : null)} |`);
  }
  lines.push('', `Review queue entries: ${evaluation.reviewQueue.length} (differential disagreements and deferred mutation expectations).`);
} catch {
  lines.push('', '_No results-output/evaluation.json: run `npm run eval` to include the resolvedRate table._');
}
console.log(lines.join('\n'));
