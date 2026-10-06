/**
 * Measure how the evaluation report artifacts weigh and what reading them costs (#786; contract: docs/specs/evaluation-report-storage.md). Reads retained files only and runs no scanner:
 *
 *   results-output/evaluation.json                 the legacy single-file discovery report (the ~420 MB file)
 *   public/results/evaluation-v1.json              the public projection
 *   public/results/review-ledger-v2.json           the observed review ledger
 *   results-output/qualification/engine-v1.json    the qualification artifact, when present
 *
 * Per file it records the exact byte size, the UTF-16 string length, MB and MiB, the whole-document parse and compact/pretty stringify times, the contribution of each section, and
 * the process peak RSS and heap after each stage. Runtime facts (Node, V8, string limit, heap limit) are recorded once. Timings and RSS are one machine's observation, not a gate.
 *
 *   node --import tsx scripts/measure-report-growth.ts [--out=docs/generated/evaluation-report-baseline.json] [--discovery=...] [--public=...] [--ledger=...] [--qualification=...] [--no-projection]
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:buffer';
import v8 from 'node:v8';
import { createHash } from 'node:crypto';

const options = Object.fromEntries(process.argv.slice(2).map(arg => { const m = /^--(out|discovery|public|ledger|qualification)=(.+)$/.exec(arg); if (m) return [m[1], m[2]]; if (arg === '--no-projection') return ['no-projection', 'true']; throw new Error('Unknown option'); }));
const FILES = { discovery: options.discovery ?? 'results-output/evaluation.json', public: options.public ?? 'public/results/evaluation-v1.json', ledger: options.ledger ?? 'public/results/review-ledger-v2.json',
  qualification: options.qualification ?? 'results-output/qualification/engine-v1.json' };
const MiB = 1024 * 1024;
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const size = (bytes: number) => ({ bytes, MB: round(bytes / 1e6), MiB: round(bytes / MiB) });
const clock = async <T>(fn: () => Promise<T> | T): Promise<{ value: T; ms: number }> => { const t = performance.now(); const value = await fn(); return { value, ms: Math.round(performance.now() - t) }; };
const memory = () => ({ peakRssBytes: process.resourceUsage().maxRSS * 1024, heapUsedBytes: process.memoryUsage().heapUsed, heapTotalBytes: v8.getHeapStatistics().total_heap_size });
const len = (value: unknown) => JSON.stringify(value).length; // compact UTF-16 length (JSON is mostly ASCII; bytes are measured separately where exact)
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const spread = (values: number[]) => { const s = [...values].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; return { count: s.length, total: sum(s), max: s.at(-1) ?? 0, p50: q(0.5), p99: q(0.99) }; };
const exists = (file: string) => stat(file).then(() => true, () => false);

async function measureFile(file: string, analyse: (value: any) => Record<string, unknown>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!(await exists(file))) return { file, present: false };
  const { size: bytes } = await stat(file);
  const read = await clock(() => readFile(file, 'utf8'));
  const text = read.value;
  const length = text.length;
  const sha256 = createHash('sha256').update(text).digest('hex');
  const pretty = /^\{\n {2}"/.test(text.slice(0, 8));
  const parse = await clock(() => JSON.parse(text));
  const afterParse = memory();
  let value: any = parse.value; // eslint-disable-line @typescript-eslint/no-explicit-any
  const compact = await clock(() => JSON.stringify(value));
  const compactLength = compact.value.length;
  let prettyMs: number | null = null, prettyLength: number | null = null;
  try { const p = await clock(() => JSON.stringify(value, null, 2)); prettyMs = p.ms; prettyLength = p.value.length; } catch (error) { prettyLength = null; prettyMs = null; void error; }
  const sections = analyse(value);
  const result = { file, present: true, sha256, ...size(bytes), utf16Length: length, prettyPrinted: pretty, readUtf8Ms: read.ms, parseMs: parse.ms, stringifyCompactMs: compact.ms, stringifyPrettyMs: prettyMs,
    compactUtf16Length: compactLength, compactToFileRatio: round(compactLength / length, 4), prettyReserialisedLength: prettyLength,
    fractionOfStringLimit: round(length / constants.MAX_STRING_LENGTH, 4), memoryAfterParse: afterParse, memoryAfterStages: memory(), sections };
  value = null;
  return result;
}

const byKey = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).map(([k, v]) => [k, len(v)]));
const fieldTotals = (records: Record<string, unknown>[], fields: string[]) => Object.fromEntries(fields.map(f => [f, sum(records.map(r => len(r[f] ?? null)))]));

const discovery = await measureFile(FILES.discovery, report => {
  const { results, failures, reviewQueue, ...header } = report;
  const variants = sum(results.map((r: any) => r.variants.length)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const resultBytes = results.map((r: unknown) => len(r)), failureBytes = failures.map((r: unknown) => len(r)), queueBytes = reviewQueue.map((r: unknown) => len(r));
  const resultFields = [...new Set(results.flatMap((r: Record<string, unknown>) => Object.keys(r)))] as string[];
  const methods = [...new Set(results.map((r: any) => r.method))] as string[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { topLevelCompactUtf16: byKey(report), headerCompactUtf16: len(header),
    counts: { results: results.length, variants, failures: failures.length, reviewQueue: reviewQueue.length, generationErrors: header.generationErrors?.length ?? null, scanners: header.scanners?.length ?? null },
    perRecordCompactUtf16: { results: spread(resultBytes), failures: spread(failureBytes), reviewQueue: spread(queueBytes) },
    resultFieldsCompactUtf16: fieldTotals(results, resultFields),
    byMethod: Object.fromEntries(methods.map(m => { const rows = results.filter((r: any) => r.method === m); return [m, { cases: rows.length, variants: sum(rows.map((r: any) => r.variants.length)), compactUtf16: sum(rows.map((r: unknown) => len(r))) }]; })), // eslint-disable-line @typescript-eslint/no-explicit-any
    perCaseCompactUtf16: round(sum(resultBytes) / Math.max(1, results.length), 1), perVariantCompactUtf16: round(sum(resultBytes) / Math.max(1, variants), 1) };
});

const publicReport = await measureFile(FILES.public, report => {
  const { cases, reviews, ...summary } = report;
  const parts = ['variants', 'assertions', 'findings', 'generation', 'comparisons'];
  const caseBytes = cases.map((c: unknown) => len(c));
  const sumLen = (list: unknown[]) => sum(list.map(len));
  const methods = [...new Set(cases.map((c: any) => c.method))] as string[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const comparisons = sum(cases.map((c: any) => c.comparisons.length)); // eslint-disable-line @typescript-eslint/no-explicit-any
  return { topLevelCompactUtf16: byKey(report), summaryCompactUtf16: len(summary),
    counts: { cases: cases.length, variants: sum(cases.map((c: any) => c.variants.length)), assertions: sum(cases.map((c: any) => c.assertions.length)), findings: sum(cases.map((c: any) => c.findings.length)), comparisons, reviews: reviews.length, scanners: summary.scanners.length }, // eslint-disable-line @typescript-eslint/no-explicit-any
    perCaseCompactUtf16: spread(caseBytes), perReviewCompactUtf16: spread(reviews.map((r: unknown) => len(r))),
    caseFieldsCompactUtf16: fieldTotals(cases, parts), reviewsCompactUtf16: sumLen(reviews),
    byMethod: Object.fromEntries(methods.map(m => { const rows = cases.filter((c: any) => c.method === m); return [m, { cases: rows.length, variants: sum(rows.map((c: any) => c.variants.length)), assertions: sum(rows.map((c: any) => c.assertions.length)), compactUtf16: sumLen(rows) }]; })) }; // eslint-disable-line @typescript-eslint/no-explicit-any
});

const ledger = await measureFile(FILES.ledger, report => ({ topLevelCompactUtf16: Object.fromEntries(Object.entries(report).map(([k, v]) => [k, len(v)])),
  entries: Object.keys((report as any).entries ?? {}).length, perEntryCompactUtf16: spread(Object.values((report as any).entries ?? {}).map(len)) })); // eslint-disable-line @typescript-eslint/no-explicit-any

const qualification = await measureFile(FILES.qualification, report => ({ topLevelCompactUtf16: byKey(report) }));

let projection: Record<string, unknown> | { skipped: true } = { skipped: true };
if (!options['no-projection'] && discovery.present) {
  // Time the discovery-to-public projection (whole report, in memory) the way publish-evaluation's legacy path does it. It loads the fixture corpus; it runs no scanner.
  const { credentialDomain } = await import('../benchmarks/evaluation/domains/credential/contract.ts');
  const { publicEvaluation } = await import('../benchmarks/evaluation/domains/credential/public-report.ts');
  const { hash } = await import('../benchmarks/evaluation/model/model.ts');
  const sources = await credentialDomain.loadCases(credentialDomain.createOperators());
  const categories = JSON.parse(await readFile('benchmarks/categories.json', 'utf8')).filter((c: { calibrationOnly?: boolean }) => !c.calibrationOnly);
  const hashes = Object.fromEntries(await Promise.all(categories.map(async (c: { id: string; corpus: string }) => [c.id, hash(await readFile(c.corpus))])));
  const raw = JSON.parse(await readFile(FILES.discovery, 'utf8'));
  const before = memory();
  const projected = await clock(() => publicEvaluation(raw, sources, hashes, null));
  const stringified = await clock(() => JSON.stringify(projected.value));
  projection = { wholeReportProjectionMs: projected.ms, stringifyPublicMs: stringified.ms, publicCompactBytes: Buffer.byteLength(stringified.value), publicCompactUtf16Length: stringified.value.length, memoryBefore: before, memoryAfter: memory(),
    note: 'one discovery parse, one projection and one stringify held at once; this is the legacy publication cost, not the bundle path' };
}

const growth = (() => {
  const d = discovery as any, p = publicReport as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!d.present) return null;
  const cases = d.sections.counts.results, variants = d.sections.counts.variants, limit = constants.MAX_STRING_LENGTH;
  return { basis: 'Linear extrapolation from this one run; the figure is a measurement of today\'s ratio, not a forecast of corpus growth.',
    discoveryPrettyUtf16PerCase: round(d.utf16Length / cases, 1), discoveryPrettyUtf16PerVariant: round(d.utf16Length / variants, 1),
    discoveryCompactUtf16PerCase: round(d.compactUtf16Length / cases, 1),
    casesAtStringLimitPretty: Math.floor(limit / (d.utf16Length / cases)), casesAtStringLimitCompact: Math.floor(limit / (d.compactUtf16Length / cases)),
    casesNow: cases, variantsNow: variants,
    publicUtf16PerCase: p.present ? round(p.utf16Length / p.sections.counts.cases, 1) : null,
    casesAtStringLimitPublic: p.present ? Math.floor(limit / (p.utf16Length / p.sections.counts.cases)) : null,
    discoveryHeadroomFactorPretty: round(limit / d.utf16Length, 3), discoveryHeadroomFactorCompact: round(limit / d.compactUtf16Length, 3) };
})();

const heap = v8.getHeapStatistics();
const baseline = { schema: 'redact-secret/evaluation-report-baseline/v1', issue: 786, measuredAt: new Date().toISOString(), runsScanners: false,
  runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, maxStringLengthChars: constants.MAX_STRING_LENGTH, maxBufferBytes: constants.MAX_LENGTH, heapSizeLimitBytes: heap.heap_size_limit },
  memoryNote: 'peakRssBytes is the process high-water mark and only grows: the files are measured in order discovery, public, ledger, qualification, projection in one process, so a later stage inherits the earlier peak. heapUsedBytes is the live heap at that moment.',
  note: 'results-output/evaluation.json is the discovery source and is the single large report; the public projection, the ledger and the qualification artifact are separate contracts. Site and Next export totals are not report sizes.',
  discovery, public: publicReport, ledger, qualification, projection, growth, finalMemory: memory() };
const text = `${JSON.stringify(baseline, null, 2)}\n`;
if (options.out) await writeFile(options.out, text); else process.stdout.write(text);
