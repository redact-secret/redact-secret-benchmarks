import type { EvaluationReport } from '../../evaluation-types';
import { currentReports, runIdOf, type BenchData } from '../data';

/**
 * The five-cell status line above the Workbench. Every cell is a sentence of
 * the form "n of m", so a maintainer reads whether the run can be trusted
 * before reading anything it says. Only a cell with a problem changes shape.
 */
export interface HealthCell { id: string; label: string; sentence: string; state: 'ok' | 'bad' | 'not-measured'; href?: string }
const n = (value: number) => value.toLocaleString('en-US');

export function healthCells(data: BenchData, evaluation: EvaluationReport | null): HealthCell[] {
  const reports = currentReports(data), suites = data.loaded.length, runId = runIdOf(data);
  const cells: HealthCell[] = [];
  if (!reports.length) {
    for (const [id, label] of [['scanners', 'SCANNERS'], ['suites', 'SUITES'], ['corpus', 'CORPUS'], ['replays', 'REPLAYS']]) cells.push({ id, label, sentence: 'No benchmark run published', state: 'not-measured', href: '/report' });
  } else {
    const ids = [...new Set(reports.flatMap(r => r.scanners.map(s => s.id)))];
    const complete = ids.filter(id => reports.every(r => r.scanners.find(s => s.id === id)?.status === 'complete'));
    cells.push({ id: 'scanners', label: 'SCANNERS', sentence: `${complete.length} of ${ids.length} complete`, state: complete.length === ids.length ? 'ok' : 'bad', href: '/report' });
    cells.push({ id: 'suites', label: 'SUITES', sentence: `${reports.length} of ${suites} on one run id`, state: reports.length === suites ? 'ok' : 'bad', href: '/report' });
    const matching = data.loaded.filter(l => l.report && l.report.corpusHash === data.hashes[l.category.id]).length;
    cells.push({ id: 'corpus', label: 'CORPUS', sentence: `${matching} of ${suites} hashes match`, state: matching === suites ? 'ok' : 'bad', href: '/report' });
    const unstable = ids.filter(id => reports.some(r => { const s = r.scanners.find(x => x.id === id); return s?.status === 'unstable' || s?.replays?.agreed === false; }));
    const replays = reports[0].accounting?.replays;
    cells.push({ id: 'replays', label: 'REPLAYS', sentence: `${replays ?? '—'} replays, ${unstable.length} of ${ids.length} scanners unstable`, state: unstable.length ? 'bad' : 'ok', href: '/workbench/qualification' });
  }
  // Only a qualification run reads the checked-in ledger; discovery never does, so its queue state says nothing here.
  const review = evaluation?.qualification?.accounting?.review;
  cells.push(review
    ? { id: 'ledger', label: 'LEDGER', sentence: `${n(review.unknown)} of ${n(review.open + review.resolved + review.unknown)} queue entries unreviewed`, state: review.unknown ? 'bad' : 'ok', href: '/workbench/qualification' }
    : { id: 'ledger', label: 'LEDGER', sentence: 'No qualification evidence published', state: 'not-measured', href: '/workbench/qualification' });
  void runId;
  return cells;
}
