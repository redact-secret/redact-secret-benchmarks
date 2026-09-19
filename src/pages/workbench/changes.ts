import { actionEmptyState, escapeHtml as e, evidenceCrumb } from '../../components';
import { candidatePairs, changeRows, type CandidateReport, type ChangeRow, type OutcomePair } from '../../evaluation-model';
import { outcomeCode } from '../../model.mjs';
import type { Baseline } from '../../types';
import { currentReports, PRODUCT, type BenchData } from '../data';
import { changeRow } from './shared';

export type Corpus = 'fixed-corpus' | 'expanded-corpus';
export interface ChangesInput { data: BenchData; baseline?: Baseline; candidate?: CandidateReport; candidateProblem?: string; fixtures: { slug: string; category: string; id: string; assessment: { kind: string; tier: string } }[] }
export const CANDIDATE_COMMAND = 'npm run eval:candidate -- --output-dir "$PWD/public/results" --candidate-package <core.tgz> --candidate-node-package <node.tgz> --candidate-wasm-package <wasm.tgz> --candidate-source-commit <40-hex> --product-state clean';

/** The saved baseline against the current run, for the product scanner. A fixture added since the baseline has no "before". */
export function baselinePairs({ data, baseline, fixtures }: ChangesInput): OutcomePair[] {
  const reports = currentReports(data);
  return fixtures.flatMap(f => {
    const scanner = reports.find(r => r.category === f.category)?.scanners.find(s => s.id === PRODUCT && s.status === 'complete');
    const row = scanner?.rows?.find(r => r.id === f.id);
    if (!row) return [];
    const before = baseline?.rows[f.slug]?.[PRODUCT] ?? null;
    return [{ slug: f.slug, kind: f.assessment.kind, tier: f.assessment.tier, section: (before == null ? 'expanded-corpus' : 'fixed-corpus') as Corpus, before, after: outcomeCode(row) }];
  });
}

export interface ChangeView { title: string; source: string; pairs: OutcomePair[]; usingCandidate: boolean }
export function changeView(input: ChangesInput): ChangeView | null {
  const { candidate, baseline } = input;
  if (candidate) return { title: `${candidate.results[0]?.baseline.version ?? 'baseline'} → candidate ${candidate.candidate.sourceCommit.slice(0, 7)}`, source: `Candidate ${candidate.candidate.packageName} ${candidate.candidate.declaredVersion} · ${candidate.candidate.sourceState} · ${candidate.status} · ${candidate.completeness.scannedFixtures} of ${candidate.completeness.selectedFixtures} fixtures scanned${candidate.selection.filter ? ` · filter ${candidate.selection.filter}` : ''}`, pairs: candidatePairs(candidate), usingCandidate: true };
  if (!baseline) return null;
  const pairs = baselinePairs(input);
  return pairs.length ? { title: `${baseline.version} → this run`, source: `Saved baseline ${baseline.version} against the current run, ${PRODUCT} only`, pairs, usingCandidate: false } : null;
}
export const rowsFor = (view: ChangeView, corpus: Corpus): ChangeRow[] => changeRows(view.pairs.filter(p => p.section === corpus));

export function changesPage(input: ChangesInput, corpus: Corpus): string {
  const crumb = evidenceCrumb([{ label: 'Workbench', href: '/workbench' }, { label: 'Changes' }]);
  const view = changeView(input);
  if (!view) return `${crumb}<div class="page-head"><div><h1>Changes</h1></div></div>${actionEmptyState(input.baseline
    ? { title: 'No current run to compare', body: `Baseline <code>${e(input.baseline.version)}</code> is saved, but no complete benchmark run is published for this checkout. Run the benchmark, then reload.`, command: 'npm run bench' }
    : { title: 'No saved baseline', body: 'Changes are read against a released comparison point in <code>baselines/</code>. Save one after a complete run.', command: 'npm run baseline -- --save <version>' })}`;
  const rows = rowsFor(view, corpus), changed = rows.filter(r => r.status !== 'held');
  const seg = `<div class="seg" role="group" aria-label="Corpus section">${([['fixed-corpus', 'Fixed corpus'], ['expanded-corpus', 'Expanded corpus']] as const).map(([id, label]) => `<a href="/workbench/changes${id === 'fixed-corpus' ? '' : '?corpus=expanded'}"${id === corpus ? ' aria-current="true"' : ''}>${label}</a>`).join('')}</div>`;
  const note = view.usingCandidate ? '' : actionEmptyState({ title: 'No candidate evidence published', body: `${input.candidateProblem ? `${e(input.candidateProblem)}. ` : ''}This page shows the saved baseline against the current run. To read a release candidate here, write its evidence next to the run reports.`, command: CANDIDATE_COMMAND });
  return `${crumb}<div class="page-head"><div><h1>${e(view.title)}</h1><div class="meta"><span>${e(view.source)}</span></div></div>${seg}</div>
    <p class="small">${corpus === 'fixed-corpus' ? 'Rows that have a saved baseline outcome.' : 'Rows added since the baseline. With nothing to compare against, they are listed, not scored as changes.'} Only what changed is listed, each with its reason; unchanged rows fold into one Held line per kind.</p>
    <section class="section" aria-label="Changes"><h2 class="h2-compact">${changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'} to read` : 'Nothing changed'}</h2>${rows.length ? rows.map(r => changeRow(r, true)).join('') : '<p class="small">No rows in this corpus section.</p>'}</section>${note}`;
}
