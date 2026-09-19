import { actionEmptyState, escapeHtml as e, evidenceCrumb, statusMark } from '../../components';
import { ledgerSnippet, ledgerClassOf, type ReviewClass } from '../../evaluation-model';
import type { EvaluationReport } from '../../evaluation-types';

const n = (value: number) => value.toLocaleString('en-US');
const SAMPLE = 3;

export function reviewQueue(classes: ReviewClass[]): string {
  const open = classes.filter(c => c.open), most = Math.max(1, ...open.map(c => c.open));
  return `<div class="tbl"><table><thead><tr><th scope="col">Group</th><th scope="col" class="num">Open</th><th scope="col" style="width:30%">Share</th></tr></thead><tbody>${open.map(c => `<tr><td><a href="/workbench/review/${e(c.id)}">${e(c.label)}</a><small>${e(c.description)}</small></td><td class="num">${n(c.open)}</td><td style="vertical-align:middle"><div class="qbar" role="img" aria-label="${n(c.open)} of ${n(most)}, the largest group"><i style="width:${(c.open / most * 100).toFixed(2)}%"></i></div></td></tr>`).join('')}</tbody></table></div>`;
}

/** One review group: three representative entries and a ledger fragment to paste into a PR. The page writes nothing. */
export function reviewPage(classes: ReviewClass[], id: string, evaluation: EvaluationReport | null): string {
  const crumbFor = (label: string) => evidenceCrumb([{ label: 'Workbench', href: '/workbench' }, { label: 'Review queue', href: '/workbench' }, { label }]);
  const group = classes.find(c => c.id === id);
  if (!group) return `${crumbFor(id)}<div class="page-head"><div><h1>No such review group</h1></div></div>${actionEmptyState({ title: `The ledger has no group “${e(id)}”`, body: `Groups come from the <code>Class:</code> line of each note in <code>benchmarks/review-ledger.json</code>. Open groups: ${classes.filter(c => c.open).map(c => `<a href="/workbench/review/${e(c.id)}">${e(c.label)}</a>`).join(', ')}.` })}`;
  const open = group.entries.filter(entry => entry.status === 'open');
  const queue = new Map((evaluation?.reviews ?? []).map(r => [r.id, r]));
  const cases = new Map((evaluation?.cases ?? []).map(c => [c.id, c]));
  // Prefer entries the published discovery run can link to bytes; fall back to the first open entries.
  const linked = open.filter(entry => queue.has(entry.id));
  const sample = [...linked, ...open.filter(entry => !queue.has(entry.id))].slice(0, SAMPLE);
  const rows = sample.map(entry => {
    const review = queue.get(entry.id), source = review ? cases.get(review.caseId) : undefined;
    return `<tr><td><code>${e(entry.id.slice(0, 12))}</code><small>first seen in run ${e(entry.firstSeenRun.slice(0, 8))}</small></td><td>${source ? `<a href="/fixture/${e(source.sourceSlug)}">${e(source.sourceSlug)}</a><small>${e(review!.variant)}${review!.peer ? ` · differs from ${e(review!.peer)}: ${e(review!.disagreement)}` : ''}</small>` : '<span class="muted">Not in the published discovery run</span>'}</td><td>${statusMark('review', 'Open')}</td></tr>`;
  }).join('');
  const snippet = open.length ? ledgerSnippet(sample, evaluation?.runId ?? '<run id>') : '';
  const note = open[0]?.note ?? group.entries[0].note;
  return `${crumbFor(group.label)}<div class="page-head"><div><p class="eyebrow">REVIEW GROUP</p><h1>${e(group.label)}</h1><div class="meta"><span><b>${n(group.open)}</b> open</span><span><b>${n(group.resolved)}</b> resolved</span><span>${e(group.description)}</span></div></div></div>
    <section class="section"><h2 class="h2-compact">Why these need a person</h2><p class="prose">${e(note.replace(/\s*Class: .+$/s, ''))}</p><p class="small">Ledger class${group.rawClasses.length === 1 ? '' : 'es'}: ${group.rawClasses.map(raw => `<code>${e(raw)}</code>`).join(', ')}</p></section>
    ${open.length ? `<section class="section"><h2 class="h2-compact">${sample.length} representative ${sample.length === 1 ? 'entry' : 'entries'} of ${n(open.length)}</h2><div class="tbl"><table><thead><tr><th scope="col">Ledger entry</th><th scope="col">Source fixture</th><th scope="col">State</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="section"><div class="section-head"><div><h2 class="h2-compact">Ledger fragment</h2><p class="small">A draft for these ${sample.length} entries. Replace the decision text, then merge it into <code>benchmarks/review-ledger.json</code> through a pull request. This page copies text; it writes no file and changes no expectation.</p></div><button class="btn" type="button" data-copy="ledger-snippet">Copy JSON</button></div><pre class="snippet" id="ledger-snippet" tabindex="0">${e(snippet)}</pre><p class="small" role="status" aria-live="polite" data-copy-status="ledger-snippet"></p></section>` : `<section class="section"><p class="small">Nothing open in this group. ${n(group.resolved)} resolved ${group.resolved === 1 ? 'entry' : 'entries'} stay in the ledger with ${group.resolved === 1 ? 'its' : 'their'} decision${group.rawClasses.length ? `: ${e(ledgerClassOf(group.entries[0].note))}` : ''}.</p></section>`}`;
}

export function bindCopy(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.copy!, status = root.querySelector<HTMLElement>(`[data-copy-status="${id}"]`);
    try { await navigator.clipboard.writeText(root.querySelector<HTMLElement>(`#${id}`)!.textContent ?? ''); if (status) status.textContent = 'Copied to the clipboard.'; }
    catch { if (status) status.textContent = 'Copy is blocked here. Select the text and copy it by hand.'; }
  }));
}
