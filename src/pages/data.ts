import type { RunSummary } from '../../benchmarks/lib/run-summary.ts';
import type { Group, Report, Run } from '../types';

/** What the pages read. Loaded once per refresh by main.ts; pages never fetch. */
export const PRODUCT = 'redact-secret';
export interface Suite { id: string; title: string; description: string }
export interface Loaded { category: Suite; report?: Report; problem?: string }
export interface BenchData {
  run?: Run; loaded: Loaded[]; hashes: Record<string, string>;
  summary?: RunSummary; summaryProblem?: string;
}
export type { RunSummary };

export const runIdOf = (data: BenchData) => data.run?.runId ?? data.loaded.flatMap(l => (l.report ? [l.report.runId] : [])).sort().at(-1) ?? null;
/** Reports that belong to the current run. A suite from another run id is never summed in. */
export const currentReports = (data: BenchData) => { const id = runIdOf(data); return data.loaded.flatMap(l => (l.report && l.report.runId === id ? [l.report] : [])); };
export const staleSuites = (data: BenchData) => { const id = runIdOf(data); return data.loaded.filter(l => l.report && l.report.runId !== id); };
export const excludedSuites = (data: BenchData) => data.loaded.filter(l => l.problem);
export const hasResults = (data: BenchData) => data.loaded.some(l => l.report);

const COUNTS = ['files', 'spans', 'leakedSpans', 'flaggedFiles'] as const;
/**
 * The summary is re-checked, never trusted: same run, same accounting version,
 * and every integer count equal to the sum over the suite reports it claims to
 * cover. Counts are summed; no rate or bound is derived.
 */
export function summaryProblem(summary: RunSummary | undefined, data: Pick<BenchData, 'run' | 'loaded'>): string | null {
  if (!summary) return 'No run summary published';
  if (summary.schemaVersion !== 1 || !summary.overall || !summary.byDetector) return 'Unsupported run summary';
  const runId = runIdOf({ ...data, hashes: {} });
  if (summary.runId !== runId) return 'Run summary is from another run';
  const reports = data.loaded.flatMap(l => (l.report && l.report.runId === runId ? [l.report] : []));
  if (reports.some(r => (r as unknown as { accountingVersion: string }).accountingVersion !== summary.accountingVersion)) return 'Run summary accounting version differs from its suites';
  if (summary.categories.length !== reports.length || summary.categories.some(c => !reports.some(r => r.category === c))) return 'Run summary covers different suites';
  for (const [scanner, groups] of Object.entries(summary.overall)) for (const [key, group] of Object.entries(groups)) for (const field of COUNTS) {
    const total = (group as unknown as Record<string, unknown>)[field];
    if (typeof total !== 'number') continue;
    const sum = reports.reduce((n, r) => n + Number((r.scanners.find(s => s.id === scanner && s.status === 'complete')?.groups?.[key] as Record<string, unknown> | undefined)?.[field] ?? 0), 0);
    if (sum !== total) return `Run summary ${field} for ${scanner} ${key} does not add up to its suites`;
  }
  return null;
}
export const groupsOf = (summary: RunSummary | undefined, scanner: string, detector?: string): Record<string, Group> =>
  ((detector ? summary?.byDetector[detector]?.[scanner] : summary?.overall[scanner]) ?? {}) as unknown as Record<string, Group>;
