import { actionEmptyState, escapeHtml as e, evidenceCrumb, statusMark } from '../../components';
import { qualificationGates, type Gate, type GateGroup } from '../../evaluation-model';
import type { EvaluationReport } from '../../evaluation-types';
import suite from '../../../qualification/suite-v1.json';
import { groupsOf, PRODUCT, type BenchData } from '../data';
import { gateRow, gatesSentence } from './shared';

export const gatesFor = (data: BenchData, evaluation: EvaluationReport | null): Gate[] => {
  const groups = groupsOf(data.summaryProblem ? undefined : data.summary, PRODUCT) as unknown as Record<string, GateGroup>;
  return qualificationGates(suite.accounting, evaluation?.qualification ?? null, Object.keys(groups).length ? groups : null);
};

export function qualificationPage(data: BenchData, evaluation: EvaluationReport | null): string {
  const q = evaluation?.qualification ?? null, gates = gatesFor(data, evaluation);
  // eval:qualify always loads the lockfile package the suite pins, on staging too: say so beside a candidate run.
  const product = q?.holdout.scanners.find(s => s.id === PRODUCT);
  const head = `${evidenceCrumb([{ label: 'Workbench', href: '/workbench' }, { label: 'Qualification' }])}<div class="page-head"><div><h1>Qualification floors</h1><div class="meta"><span>Floors from <code>qualification/${e(suite.id)}</code> accounting ${e(suite.accounting.version)}</span>${q ? `<span>Evidence run <b>${e(q.finishedAt.slice(0, 10))}</b></span>${product?.version ? `<span>Qualified with the released package redact-secret <b>${e(product.version)}</b></span>` : ''}<span>${statusMark(q.status === 'execution-qualified' ? 'pass' : 'review', q.status)}</span>` : ''}</div></div></div>`;
  const evidence = q
    ? `<p class="small">${e(q.scope)} · supportClaims: false. Execution-qualified means the evaluation infrastructure executed its contract. It says nothing about how well any scanner detects secrets.${q.accounting?.reasons.length ? ` Not yet qualified because: ${q.accounting.reasons.map(e).join(', ')}.` : ''}</p>`
    : actionEmptyState({ title: 'No qualification evidence published', body: 'The three engine floors below read from a qualification run, and none is published with the current evaluation report. Measurement floors still read from the benchmark run.', command: 'npm run eval:qualify\nnpm run eval:publish -- --qualification=results-output/qualification/engine-v1.json', mark: statusMark('not-measured') });
  const holdout = q ? `<section class="section"><h2 class="h2-compact">Holdout, aggregate only</h2><p class="small">${e(q.holdout.caseCount)} cases · ${e(q.holdout.variantCount)} variants · ${e(q.holdout.generationErrors)} generation errors. <a href="/workbench/method/holdout">Open holdout evidence</a></p><p class="small">Milestone snapshot: ${e(q.milestone.status)}, checked ${e(q.milestone.checkedAt.slice(0, 10))}${q.milestone.openPrerequisites.length ? `, open prerequisites ${q.milestone.openPrerequisites.map(e).join(', ')}` : ''}. Refresh with <code>npm run eval:milestone</code>.</p></section>` : '';
  return `${head}<p class="small" style="margin-bottom:var(--space-4)">${e(gatesSentence(gates))}</p><section aria-label="Floors" class="cov-list">${gates.map(gateRow).join('')}</section><div style="margin-top:var(--space-6)">${evidence}</div>${holdout}`;
}
