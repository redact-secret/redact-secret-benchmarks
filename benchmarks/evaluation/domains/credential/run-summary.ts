import type { AccountedGroup, AccountingConfig, ScoredRow } from '../../../types.ts';
import { accountGroups, readCredentialAccountingIdentity, assertCredentialAccountingIdentities } from './accounting.ts';

/**
 * Cross-suite groups for one run, published beside the suite reports as
 * summary.json. A Wilson bound over several suites cannot be read off the
 * per-suite bounds, so it is accounted once here, at bench time, by the same
 * accountGroups that accounts each suite. The site displays these values; it
 * derives none of them.
 */
export { SUMMARY_SCHEMA_VERSION, type RunSummary, type SummaryScanner } from '../../../consumer/credential-metrics.ts';
import { SUMMARY_SCHEMA_VERSION, selectionGroups as recordedSelectionGroups, type RunSummary, type SummaryScanner } from '../../../consumer/credential-metrics.ts';
interface SuiteReport {
  runId: string; category: string; accountingVersion: string; accounting: AccountingConfig;
  domain?: string; evaluationProfile?: string; domainAccountingVersion?: string;
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
/** Compatibility for oracle/rollback summary writers, including their range diagnostics. */
export function selectionGroups(all: SuiteRow[], selected: Set<string>, config: AccountingConfig): Record<string, AccountedGroup> {
  return recordedSelectionGroups(all, selected, config, accountGroups);
}

export function summarizeRun(reports: SuiteReport[], assignments: Record<string, string[]>, generatedAt = new Date().toISOString()): RunSummary {
  if (!reports.length) throw new Error('A run summary needs at least one suite report');
  const [{ runId, accounting, accountingVersion }] = reports;
  if (reports.some(r => r.runId !== runId || r.accountingVersion !== accountingVersion)) throw new Error('A run summary never mixes run ids or accounting versions');
  const identity = assertCredentialAccountingIdentities(reports.map(report => readCredentialAccountingIdentity(report as unknown as Record<string, unknown>, 'measurement-v4')), 'measurement-v4');
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
  return { schemaVersion: SUMMARY_SCHEMA_VERSION, accountingVersion, ...identity, runId, generatedAt, categories: reports.map(r => r.category), accounting, scanners, overall, byDetector };
}
