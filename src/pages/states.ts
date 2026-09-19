import { actionEmptyState, escapeHtml as e, statusMark } from '../components';
import { currentReports, excludedSuites, hasResults, staleSuites, type BenchData } from './data';

/**
 * The three empty states (redesign plan section 09). Each says what is missing
 * in one sentence and gives the next command. None apologises.
 */
const list = (ids: string[]) => ids.map(id => `<code>${e(id)}</code>`).join(ids.length === 2 ? ' and ' : ', ');
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const noResults = () => actionEmptyState({ title: 'No benchmark results for this checkout', body: 'The corpus is here, but no scanner has run against it. Run the benchmark, then reload.', command: 'npm run bench' });

export function staleRun(data: BenchData): string {
  const stale = staleSuites(data).map(l => l.category.id);
  if (!stale.length) return '';
  return actionEmptyState({ title: `${plural(stale.length, 'suite')} ${stale.length === 1 ? 'is' : 'are'} from an older run`, body: `${list(stale)} ${stale.length === 1 ? 'has' : 'have'} a different run id, so ${stale.length === 1 ? 'it is' : 'they are'} left out of every total. Re-run ${stale.length === 1 ? 'it' : 'them'} to include ${stale.length === 1 ? 'it' : 'them'}.`, command: stale.length === 1 ? `npm run bench -- --category=${stale[0]}` : 'npm run bench' });
}

export function excludedReports(data: BenchData): string {
  const excluded = excludedSuites(data);
  if (!excluded.length || !hasResults(data)) return '';
  return actionEmptyState({ title: `${plural(excluded.length, 'suite report')} ${excluded.length === 1 ? 'is' : 'are'} left out`, body: `${excluded.map(l => `<code>${e(l.category.id)}</code>: ${e(l.problem)}`).join('; ')}. A report that does not re-validate against the fixture bytes is never read. Fixture inputs stay available.`, command: 'npm run bench' });
}

export function unavailableScanners(data: BenchData): string {
  const reports = currentReports(data), seen = new Map<string, { name: string; status: string; message?: string }>();
  for (const scanner of reports.flatMap(r => r.scanners)) if (scanner.status !== 'complete' && !seen.has(scanner.id)) seen.set(scanner.id, scanner);
  return [...seen.entries()].map(([id, scanner]) => scanner.status === 'unavailable'
    ? actionEmptyState({ title: `${id} was not found on PATH`, body: 'Its rows show as Not measured, not as zero. Install a released binary to include it, then re-run.', command: 'npm run bench', mark: statusMark('not-measured') })
    : scanner.status === 'unstable'
      ? actionEmptyState({ title: `${id} gave different findings on identical input`, body: 'Replays disagreed, so its findings are discarded and its rows show as Unstable. A run is never re-rolled for a greener result.', command: 'npm run bench', mark: statusMark('unstable') })
      : actionEmptyState({ title: `${id} did not complete`, body: 'Execution or normalisation failed, so its rows show as Not measured. Check the adapter and the installed version; raw scanner output is suppressed.', command: 'npm run bench -- --strict', mark: statusMark('not-measured') })).join('');
}

export function summaryState(data: BenchData): string {
  if (!data.summaryProblem || !hasResults(data)) return '';
  return actionEmptyState({ title: 'No run summary for this run', body: `${e(data.summaryProblem)}. Cross-suite figures are read from <code>summary.json</code>, which the benchmark writes with the suite reports; this site does not derive them. Suite pages and fixture evidence are unaffected.`, command: 'npm run bench' });
}

/** Everything wrong with the loaded run, in the order a reader should deal with it. */
export const runStates = (data: BenchData) => (hasResults(data) ? summaryState(data) + staleRun(data) + excludedReports(data) + unavailableScanners(data) : noResults());
