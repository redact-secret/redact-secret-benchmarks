import type { AccountedGroup, AccountingConfig, ScoredRow } from '../types.ts';
import { groupKey } from './lattice.ts';
import { accountGroups } from './accounting.ts';

/**
 * Cross-suite groups for one run, published beside the suite reports as
 * summary.json. A Wilson bound over several suites cannot be read off the
 * per-suite bounds, so it is accounted once here, at bench time, by the same
 * accountGroups that accounts each suite. The site displays these values; it
 * derives none of them.
 */
export const SUMMARY_SCHEMA_VERSION = 1;
interface SummaryScanner { id: string; name: string; version: string | null; mode: string; status: string; completeSuites: number }
export interface RunSummary {
  schemaVersion: typeof SUMMARY_SCHEMA_VERSION; accountingVersion: string; runId: string; generatedAt: string;
  categories: string[]; accounting: AccountingConfig; scanners: SummaryScanner[];
  overall: Record<string, Record<string, AccountedGroup>>;
  byDetector: Record<string, Record<string, Record<string, AccountedGroup>>>;
}
interface SuiteReport {
  runId: string; category: string; accountingVersion: string; accounting: AccountingConfig;
  scanners: { id: string; name: string; version: string | null; mode: string; status: string; rows?: ScoredRow[] }[];
}

const slugOf = (category: string, id: string) => `${category}--${id}`;

type SuiteRow = ScoredRow & { category: string };

/**
 * Groups of the selected fixtures for one scanner, accounted exactly as the
 * site's per-selection view always has (src/model.mjs summarize): a group is
 * accounted over the suites that hold it, and within those suites a positive's
 * twin and the selection's pending (T0) rows travel with it. Pending rows that
 * live only in other suites do not consume this group's measurable share;
 * whether they should is an accounting question, not one this module settles.
 */
export function selectionGroups(all: SuiteRow[], selected: Set<string>, config: AccountingConfig): Record<string, AccountedGroup> {
  const mine = all.filter(r => selected.has(r.id));
  const pending = new Set(mine.filter(r => r.tier === 'T0').map(r => r.id));
  const groups: Record<string, AccountedGroup> = {};
  for (const key of [...new Set(mine.map(r => groupKey(r.kind, r.tier)))].sort()) {
    const members = mine.filter(r => groupKey(r.kind, r.tier) === key);
    const own = new Set(members.map(r => r.id)), suites = new Set(members.map(r => r.category));
    const group = accountGroups(all.filter(r => suites.has(r.category) && (own.has(r.id) || pending.has(r.id) || (r.twinOf != null && own.has(r.twinOf)))), config)[key];
    if (group) groups[key] = group;
  }
  return groups;
}

export function summarizeRun(reports: SuiteReport[], assignments: Record<string, string[]>, generatedAt = new Date().toISOString()): RunSummary {
  if (!reports.length) throw new Error('A run summary needs at least one suite report');
  const [{ runId, accounting, accountingVersion }] = reports;
  if (reports.some(r => r.runId !== runId || r.accountingVersion !== accountingVersion)) throw new Error('A run summary never mixes run ids or accounting versions');
  const scanners: SummaryScanner[] = [];
  for (const scanner of reports.flatMap(r => r.scanners)) {
    let entry = scanners.find(s => s.id === scanner.id);
    if (!entry) scanners.push(entry = { id: scanner.id, name: scanner.name, version: scanner.version, mode: scanner.mode, status: 'complete', completeSuites: 0 });
    if (scanner.status === 'complete') entry.completeSuites++; else if (entry.status === 'complete') entry.status = scanner.status;
  }
  const rowsOf = (id: string) => reports.flatMap(r => (r.scanners.find(s => s.id === id && s.status === 'complete')?.rows ?? [])
    .map(row => ({ ...row, category: r.category, id: slugOf(r.category, row.id), twinOf: row.twinOf ? slugOf(r.category, row.twinOf) : undefined })));
  const everything = new Set(Object.keys(assignments));
  const detectors = [...new Set(Object.values(assignments).flat())].sort();
  const overall: RunSummary['overall'] = {}, byDetector: RunSummary['byDetector'] = Object.fromEntries(detectors.map(d => [d, {}]));
  for (const { id } of scanners) {
    const all = rowsOf(id);
    overall[id] = selectionGroups(all, everything, accounting);
    for (const detector of detectors) {
      const groups = selectionGroups(all, new Set(Object.entries(assignments).filter(([, ids]) => ids.includes(detector)).map(([slug]) => slug)), accounting);
      if (Object.keys(groups).length) byDetector[detector][id] = groups;
    }
  }
  return { schemaVersion: SUMMARY_SCHEMA_VERSION, accountingVersion, runId, generatedAt, categories: reports.map(r => r.category), accounting, scanners, overall, byDetector };
}
