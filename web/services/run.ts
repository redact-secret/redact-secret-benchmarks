/**
 * The benchmark run, read from what `npm run bench` writes to `public/results/`:
 * `run.json`, `summary.json` and one report per suite. The existing site fetches
 * the same files in the browser and re-validates them; here they are read at
 * build time and re-validated with the same functions before any page may use a
 * number:
 *
 *  - every suite report is checked against the fixture bytes and re-scored
 *    (`reportProblem`, src/model.mjs). A report that fails is left out and named;
 *  - the run summary is checked to add up to the suite reports it covers
 *    (`summaryProblem`, src/pages/data.ts).
 *
 * The site displays what the run recorded. Counts, bounds and rates are the
 * summary's and the rows'; this module derives none of them.
 *
 * `public/results/*.json` is generated and never committed. When it is absent
 * the result is `{ state: 'not-published' }` and every page shows "Not measured";
 * CI runs `npm run bench` before the web build, as the publish workflow does.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { reportProblem } from '../../src/model.mjs';
import { summaryProblem, type RunSummary } from '../../src/pages/data';
import type { Report, Row, Run, Scanner } from '../../src/types';
import { loadCatalogSources } from './catalog';
import { once, REPO_ROOT } from './repo';

export const PRODUCT = 'redact-secret';
export type Mode = 'published' | 'candidate';
export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';

/** What one scanner recorded for one fixture. Only the fields the report pages read. */
export interface RowResult {
  /** A must-redact or policy row: one outcome per expected secret span. */
  spanOutcomes?: Outcome[];
  /** A control row: did the scanner flag it. */
  flagged?: boolean;
  /** The byte ranges the scanner reported, as recorded (never the matched values). Read by the fixture page. */
  actual?: { start: number; end: number }[];
  /** Bytes of a secret left readable, and bytes redacted outside the allowed envelope, as the row recorded them. */
  leakedBytes?: number;
  collateralBytes?: number;
  /** Findings on a control the scanner flagged. */
  findings?: number;
  /** How many ranges the scanner reported, when the source records the count but not the ranges (the qualification view). */
  observed?: number;
}

export interface ScannerObservation { source: 'fresh' | 'snapshot'; observedAt: string; sourceRunId: string }

export interface RunScanner {
  id: string;
  name: string;
  version: string | null;
  /** The scanner's mode line from the run, e.g. "Directory scan · default rules". */
  mode: string;
  status: string;
  /** Distinct observations across suites: a peer's snapshot dates. */
  observations: ScannerObservation[];
  /**
   * What this scanner recorded for every fixture slug that has a row (all scanners, not only
   * redact-secret). A slug with no row is not measured: its suite report was left out, or the
   * scanner did not complete there.
   */
  rows: Map<string, RowResult>;
}

export interface MeasuredRun {
  state: 'measured';
  runId: string;
  generatedAt: string;
  accountingVersion: string;
  mode: Mode;
  /** Set only when the run measured an unreleased candidate build. */
  candidate?: { sourceCommit: string; declaredVersion: string };
  productVersion: string | null;
  summary: RunSummary;
  scanners: RunScanner[];
  /** The redact-secret row for every fixture slug that has one. A missing slug is not measured. */
  productRows: Map<string, RowResult>;
  /** Where the suite reports say the run executed: each distinct host and how many suites ran on it. Never summed with another run. */
  hosts: { node: string; platform: string; arch: string; suites: number }[];
  /** The repository revision the run recorded, and whether the tree was modified. */
  revision: string | null;
  dirty: boolean | null;
  /** Suites left out because their report did not re-validate, with the reason. Never summed. */
  excludedSuites: { id: string; problem: string }[];
  /** Suites whose report is from another run id. Never summed. */
  staleSuites: string[];
  suiteCount: number;
}

export type RunLoad = MeasuredRun | { state: 'not-published'; reason: string } | { state: 'unusable'; reason: string };

const RESULTS_DIR = () => process.env.WEB_RESULTS_DIR ?? path.join(REPO_ROOT, 'public', 'results');

async function readResult<T>(name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(RESULTS_DIR(), name), 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`public/results/${name} is unreadable: ${(error as Error).message}`);
  }
}

const resultOf = (row: Row): RowResult => ({
  ...(row.spanOutcomes ? { spanOutcomes: row.spanOutcomes as Outcome[] } : {}),
  ...(row.flagged != null ? { flagged: row.flagged } : {}),
  ...(row.actual ? { actual: row.actual.map(r => ({ start: r.start, end: r.end })) } : {}),
  ...(row.leakedBytes != null ? { leakedBytes: row.leakedBytes } : {}),
  ...(row.collateralBytes != null ? { collateralBytes: row.collateralBytes } : {}),
  ...(row.findings != null ? { findings: row.findings } : {}),
});

export function loadRun(): Promise<RunLoad> {
  return once('run', async () => {
    const [run, summary] = await Promise.all([readResult<Run>('run.json'), readResult<RunSummary>('summary.json')]);
    if (!run) return { state: 'not-published', reason: 'public/results/run.json is absent: no benchmark run was written for this checkout.' };
    const { categories, hashes, fixtures } = await loadCatalogSources();

    const loaded = await Promise.all(categories.map(async id => {
      const report = await readResult<Report>(`${id}.json`);
      if (!report) return { id, problem: 'Missing or unreadable report' as string | null, report: undefined };
      // The same check the existing site runs in the browser before it reads a report.
      const problem = reportProblem(report, id, hashes[id], fixtures) as string | null;
      return { id, problem, report: problem ? undefined : report };
    }));

    const data = { run, loaded: loaded.map(l => ({ category: { id: l.id, title: l.id, description: '' }, report: l.report, problem: l.problem ?? undefined })) };
    const problem = summaryProblem(summary, data);
    if (problem || !summary) return { state: 'unusable', reason: `${problem ?? 'No run summary published'}: cross-suite figures are read from summary.json, which the benchmark writes with the suite reports.` };

    const reports = loaded.flatMap(l => (l.report && l.report.runId === run.runId ? [l.report] : []));
    const scanners = new Map<string, RunScanner>();
    for (const s of summary.scanners) scanners.set(s.id, { id: s.id, name: s.name, version: s.version, mode: s.mode, status: s.status, observations: [], rows: new Map() });
    for (const report of reports) {
      for (const scanner of report.scanners as Scanner[]) {
        const held = scanners.get(scanner.id);
        if (held && scanner.observation && !held.observations.some(o => o.source === scanner.observation!.source && o.observedAt === scanner.observation!.observedAt && o.sourceRunId === scanner.observation!.sourceRunId)) {
          held.observations.push({ source: scanner.observation.source, observedAt: scanner.observation.observedAt, sourceRunId: scanner.observation.sourceRunId });
        }
        if (held && scanner.status === 'complete') {
          for (const row of scanner.rows ?? []) held.rows.set(`${report.category}--${row.id}`, resultOf(row));
        }
      }
    }
    const productRows = scanners.get(PRODUCT)?.rows ?? new Map<string, RowResult>();

    const hostCounts = new Map<string, { node: string; platform: string; arch: string; suites: number }>();
    for (const report of reports) {
      const { node, platform, arch } = report.runtime;
      const key = `${node}|${platform}|${arch}`;
      const held = hostCounts.get(key);
      if (held) held.suites++; else hostCounts.set(key, { node, platform, arch, suites: 1 });
    }

    const candidate = run.candidate ? { sourceCommit: run.candidate.sourceCommit, declaredVersion: run.candidate.declaredVersion } : undefined;
    return {
      state: 'measured',
      runId: run.runId,
      generatedAt: summary.generatedAt,
      accountingVersion: summary.accountingVersion,
      mode: candidate ? 'candidate' : 'published',
      ...(candidate ? { candidate } : {}),
      productVersion: run.scannerVersions?.[PRODUCT] ?? null,
      summary,
      scanners: [...scanners.values()],
      productRows,
      hosts: [...hostCounts.values()],
      revision: run.revision ?? null,
      dirty: run.dirty ?? null,
      excludedSuites: loaded.filter(l => l.problem).map(l => ({ id: l.id, problem: l.problem! })),
      staleSuites: loaded.filter(l => l.report && l.report.runId !== run.runId).map(l => l.id),
      suiteCount: categories.length,
    } satisfies MeasuredRun;
  });
}
