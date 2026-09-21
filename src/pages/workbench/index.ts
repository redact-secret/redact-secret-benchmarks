import { actionEmptyState, escapeHtml as e, statusMark } from '../../components';
import { METHODS, type ReviewClass } from '../../evaluation-model';
import type { EvaluationReport } from '../../evaluation-types';
import type { BenchData } from '../data';
import { changeView, rowsFor, type ChangesInput } from './changes';
import { healthCells } from './health';
import { gatesFor } from './qualification';
import { reviewQueue } from './review';
import { changeRow, gateRow, gatesSentence } from './shared';

const n = (value: number) => value.toLocaleString('en-US');
const SUMMARY_ROWS = 3;

export interface WorkbenchInput { data: BenchData; evaluation: EvaluationReport | null; evaluationProblem: string | null; classes: ReviewClass[]; changes: ChangesInput }

export function healthStrip(data: BenchData, evaluation: EvaluationReport | null): string {
  return `<div class="health" role="group" aria-label="Run health">${healthCells(data, evaluation).map(cell => {
    const body = `<b>${e(cell.label)}</b>${cell.state === 'bad' ? statusMark('fail') : ''}${e(cell.sentence)}`;
    return cell.state === 'ok' ? `<div data-health="${cell.id}">${body}</div>` : `<a class="${cell.state === 'bad' ? 'bad' : 'nm'}" data-health="${cell.id}" href="${e(cell.href ?? '/workbench')}">${body}</a>`;
  }).join('')}</div>`;
}

export function workbenchPage({ data, evaluation, evaluationProblem, classes, changes }: WorkbenchInput): string {
  const open = classes.reduce((sum, c) => sum + c.open, 0), total = classes.reduce((sum, c) => sum + c.open + c.resolved + c['not-assertable'], 0);
  const view = changeView(changes), rows = view ? rowsFor(view, 'fixed-corpus') : [];
  const lead = [...rows.filter(r => r.status !== 'held'), ...rows.filter(r => r.status === 'held')].slice(0, SUMMARY_ROWS);
  const gates = gatesFor(data, evaluation), notMet = gates.filter(g => g.status === 'not-met');
  return `<div class="page-head"><div><h1>Workbench</h1><div class="meta"><span>Maintainer view: is the run trustworthy, what needs a person, what changed</span></div></div></div>
    ${healthStrip(data, evaluation)}
    <div class="wb"><div>
      <h2 class="h2-compact" id="review-queue">Review queue</h2>
      <p class="small" style="margin:var(--space-1) 0 var(--space-4)">${n(open)} open of ${n(total)}, grouped by the reason they need a person. Decisions are recorded in <code>review-ledger.json</code>.</p>
      ${reviewQueue(classes)}
    </div><div>
      <h2 class="h2-compact">${view ? e(`Since ${view.title.split(' → ')[0]}`) : 'Changes'}</h2>
      ${view ? `<p class="small" style="margin:var(--space-1) 0 var(--space-4)">${e(view.source)}</p>${lead.map(r => changeRow(r)).join('') || '<p class="small">No rows to compare.</p>'}<p style="margin-top:var(--space-3)"><a href="/workbench/changes">All changes</a></p>` : `<p class="small" style="margin:var(--space-1) 0 var(--space-3)">No baseline and run to compare yet.</p><p><a href="/workbench/changes">Open changes</a></p>`}
      <h2 class="h2-compact" style="margin-top:var(--space-8)">Qualification</h2>
      <p class="small" style="margin:var(--space-1) 0 var(--space-3)">${e(gatesSentence(gates))}</p>
      ${notMet.map(gateRow).join('')}
      <p style="margin-top:var(--space-3)"><a href="/workbench/qualification">Open checklist</a></p>
    </div></div>
    <section class="section"><h2 class="h2-compact">Evaluation methods</h2><p class="small">Case, variant and assertion evidence from the discovery run${evaluation ? ` <span class="mono">${e(evaluation.runId.slice(0, 8))}</span>, ${e(evaluation.finishedAt.slice(0, 10))}` : ''}. Review-required is unscored; a peer scanner's disagreement is evidence to read, never ground truth.</p>
      ${evaluation ? `<p class="meta">${METHODS.map(m => `<a href="/workbench/method/${m}">${m}</a>`).join('')}</p>` : actionEmptyState({ title: evaluationProblem ?? 'No evaluation report published', body: 'Method pages read <code>public/results/evaluation-v1.json</code>. Generate and publish current evidence, then reload. The review queue above reads the checked-in ledger and is unaffected.', command: 'npm run eval\nnpm run eval:publish' })}</section>`;
}
