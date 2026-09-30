/**
 * What a page says about the state of the run behind its numbers: no run, an
 * unusable run, or a usable one with suites left out. Pure.
 *
 * A missing measurement is stated, with the command that produces it. It is
 * never drawn as zero.
 */
import type { RunLoad } from '../services/run';
import { count } from './format';

export type RunState =
  | { kind: 'measured'; notes: RunNote[] }
  | { kind: 'not-published'; title: string; text: string; command: string }
  | { kind: 'unusable'; title: string; text: string; command: string };

export interface RunNote { title: string; text: string }

export function resolveRunState(run: RunLoad): RunState {
  if (run.state === 'not-published') {
    return { kind: 'not-published', title: 'No benchmark results for this checkout', text: `${run.reason} The corpus is here, but no scanner has run against it, so every count below is not measured.`, command: 'npm run bench' };
  }
  if (run.state === 'unusable') {
    return { kind: 'unusable', title: 'The run summary did not validate', text: `${run.reason} Counts that come from it are not shown; fixture counts still are.`, command: 'npm run bench' };
  }
  const notes: RunNote[] = [];
  if (run.excludedSuites.length) {
    notes.push({
      title: `${count(run.excludedSuites.length, 'suite report')} left out`,
      text: `${run.excludedSuites.map(s => `${s.id}: ${s.problem}`).join('; ')}. A report that does not re-validate against the fixture bytes is never read; those fixtures show as not measured.`,
    });
  }
  if (run.staleSuites.length) {
    notes.push({ title: `${count(run.staleSuites.length, 'suite')} from an older run`, text: `${run.staleSuites.join(', ')} carry a different run id, so they are left out of every total.` });
  }
  const unavailable = run.scanners.filter(s => s.status !== 'complete');
  if (unavailable.length) {
    notes.push({ title: `${count(unavailable.length, 'scanner')} did not complete`, text: `${unavailable.map(s => `${s.name} (${s.status})`).join(', ')}. Its rows are not measured, not zero.` });
  }
  return { kind: 'measured', notes };
}
