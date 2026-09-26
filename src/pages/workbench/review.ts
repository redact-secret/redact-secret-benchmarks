import { actionEmptyState, escapeHtml as e, evidenceCrumb, statusMark } from '../../components';
import { ledgerSnippet, ledgerClassOf, type ReviewClass } from '../../evaluation-model';
import type { EvaluationCase, EvaluationReport, EvaluationReview } from '../../evaluation-types';

const n = (value: number) => value.toLocaleString('en-US');
const REPO = 'https://github.com/redact-secret/redact-secret-benchmarks';
type Entry = ReviewClass['entries'][number];
interface CurrentEvidence { review: EvaluationReview; source: EvaluationCase }

function currentEvidence(entry: Entry, evaluation: EvaluationReport | null, ledgerProblem: string | null): CurrentEvidence | null {
  if (!evaluation || ledgerProblem) return null;
  const review = evaluation.reviews.find(item => item.id === entry.id);
  const source = review && evaluation.cases.find(item => item.id === review.caseId);
  return review && source && entry.lastSeenRun === evaluation.runId && entry.lastSeenAt === evaluation.finishedAt ? { review, source } : null;
}

const openEntries = (classes: ReviewClass[]) => classes.flatMap(group => group.entries.filter(entry => entry.status === 'open'));

export function reviewQueue(classes: ReviewClass[], evaluation: EvaluationReport | null, ledgerProblem: string | null, selected = ''): string {
  const all = openEntries(classes), current = new Set(all.filter(entry => currentEvidence(entry, evaluation, ledgerProblem)).map(entry => entry.id));
  const cards = classes.map(group => ({ ...group, count: group.entries.filter(entry => entry.status === 'open' && current.has(entry.id)).length }));
  const historical = all.filter(entry => !current.has(entry.id));
  const rows = [...cards.map(card => ({ id: card.id, label: card.label, description: card.description, count: card.count, classes: card.rawClasses.length })), {
    id: 'release-historical', label: 'Release or historical follow-up', description: ledgerProblem ? `Resolution is locked: ${ledgerProblem}.` : 'Absent or unverifiable entries stay out of the current human-decision queue.',
    count: historical.length, classes: new Set(historical.map(entry => ledgerClassOf(entry.note))).size,
  }];
  return `<nav aria-label="Review decision categories"><ul class="decision-cards">${rows.map(card => `<li><a class="decision-card" href="/workbench/review/${e(card.id)}"${selected === card.id ? ' aria-current="page"' : ''}><b>${n(card.count)}</b><span><strong>${e(card.label)}</strong><small>${e(card.description)}</small><small>${n(card.classes)} ledger ${card.classes === 1 ? 'class' : 'classes'}</small></span></a></li>`).join('')}</ul></nav>`;
}

const sourceLink = (entry: Entry, current: CurrentEvidence | null) => {
  const slug = current?.source.sourceSlug ?? entry.lastSeenEvidence?.sourceSlug;
  return slug ? `<a href="/fixture/${e(slug)}">${e(slug)}</a>` : '<span class="muted">Fixture provenance unavailable</span>';
};

const issueLinks = (note: string) => {
  const ids = [...new Set([...note.matchAll(/#(\d+)/g)].map(match => match[1]))];
  return ids.map(id => `<a href="${REPO}/issues/${e(id)}">issue #${e(id)}</a>`).join(' · ') || '<span class="muted">No product issue linked</span>';
};

function item(entry: Entry, group: ReviewClass, evaluation: EvaluationReport | null, ledgerProblem: string | null): string {
  const current = currentEvidence(entry, evaluation, ledgerProblem), evidence = current?.review ?? entry.lastSeenEvidence;
  const observation = current
    ? (current.review.peer ? `Peer disagreement with ${e(current.review.peer)}: ${e(current.review.disagreement)}` : `Review-required variant <code>${e(current.review.variant)}</code> was reproduced.`)
    : evidence ? `Last recorded variant <code>${e(evidence.variant)}</code>${evidence.peer ? ` differed from ${e(evidence.peer)}: ${e(evidence.disagreement ?? '')}` : ''}.` : 'No validated occurrence record is available.';
  const variant = current?.source.variants.find(candidate => candidate.id === current.review.variant);
  const expectation = current && variant ? `${sourceLink(entry, current)} · authored <b>${e(variant.kind)}</b>, tier ${e(variant.tier)}, strategy ${e(variant.strategy)}` : `${sourceLink(entry, current)} · reopen the authored fixture truth before adjudicating.`;
  const state = current ? `${statusMark('review', 'Current-run reproduced')} run <code>${e(evaluation!.runId)}</code> at ${e(evaluation!.finishedAt)}`
    : entry.lastSeenRun ? `${statusMark('withheld', 'Absent from current run')} last observed in <code>${e(entry.lastSeenRun)}</code> at ${e(entry.lastSeenAt!)}`
      : `${statusMark('not-measured', '확인 불가 / cannot verify')} this migrated legacy entry has no last-observation provenance.`;
  const adjudicated = !current && entry.historicalAdjudication;
  const snippet = current ? ledgerSnippet([entry], { kind: 'current-run', runId: evaluation!.runId, observedAt: evaluation!.finishedAt, observedIds: new Set([entry.id]) })
    : adjudicated ? ledgerSnippet([entry], { kind: 'historical-adjudication' }) : null;
  const copy = snippet ? `<div class="ledger-copy"><div class="section-head"><p class="small">This draft is advisory. Review it and merge it through a pull request; the page writes no ledger or fixture data.</p><button class="btn" type="button" data-copy="ledger-snippet-${e(entry.id)}">Copy JSON</button></div><pre class="snippet" id="ledger-snippet-${e(entry.id)}" tabindex="0">${e(snippet)}</pre><p class="small" role="status" aria-live="polite" data-copy-status="ledger-snippet-${e(entry.id)}"></p></div>`
    : `<div class="ledger-locked" role="note"><b>Resolution locked.</b> ${ledgerProblem ? `${e(ledgerProblem)} ` : ''}${entry.lastSeenRun ? 'This entry is not reproduced in the current published run.' : 'Observation provenance is unavailable.'} Run the measurement and publication commands below; no UI, keyboard, copy, or direct-link path can produce a fragment.</div>`;
  return `<li><article class="ledger-item" id="entry-${e(entry.id)}"><header><code>${e(entry.id.slice(0, 12))}</code>${statusMark('review', 'Open')}</header><dl>
    <dt>Observation</dt><dd>${observation}</dd><dt>Expectation / source</dt><dd>${expectation}</dd>
    <dt>Why a person</dt><dd>${e(entry.note.replace(/\s*Class: .+$/s, ''))}</dd><dt>State / provenance</dt><dd>${state}<small>First seen: <code>${e(entry.firstSeenRun)}</code></small></dd>
    <dt>Valid decisions</dt><dd>Resolve with matching observation evidence; record a reviewed historical adjudication; keep open and remeasure; or use a reviewed class-level not-assertable decision. Peer disagreement alone is never product ground truth.</dd>
    <dt>Evidence links</dt><dd>${sourceLink(entry, current)} · <a href="${REPO}/blob/develop/benchmarks/review-ledger.json">ledger</a> · <a href="${REPO}/blob/develop/benchmarks/known-gaps.json">known-gap registry</a> · ${issueLinks(entry.note)}</dd>
    <dt>Next action</dt><dd>${e(current ? group.nextAction : 'Remeasure this entry; release-waiting work remains a tracking item, not a current decision.')}</dd>
  </dl>${copy}${!current && !adjudicated ? '<pre class="cmd">npm run eval -- --strict\nnpm run eval:publish</pre>' : ''}</article></li>`;
}

/** Every open entry belongs to exactly one current category or the historical tracking list. */
export function reviewPage(classes: ReviewClass[], id: string, evaluation: EvaluationReport | null, ledgerProblem: string | null = null): string {
  const crumbFor = (label: string) => evidenceCrumb([{ label: 'Workbench', href: '/workbench' }, { label: 'Review queue', href: '/workbench' }, { label }]);
  const all = openEntries(classes), currentIds = new Set(all.filter(entry => currentEvidence(entry, evaluation, ledgerProblem)).map(entry => entry.id));
  const historical = id === 'release-historical';
  const legacy: Record<string, string> = { 't0-fixtures': 'fixture-expectation-review', 'confirmed-defects': 'product-defect-candidate',
    'pending-fixtures-decided': 'intentional-difference', 'peer-coarser-classification-decided': 'intentional-difference', 'arrival-owning-detector-decided': 'intentional-difference' };
  const legacyOperator = classes.find(candidate => candidate.rawClasses.some(raw => raw.startsWith('operator=') && raw.slice('operator='.length).replace(/[^a-z0-9]+/g, '-') === id));
  const resolvedId = legacy[id] ?? legacyOperator?.id ?? id;
  const group = historical ? { id, label: 'Release or historical follow-up', description: 'Entries absent from the current validated discovery run or lacking occurrence provenance.', nextAction: 'Remeasure before adjudicating.', rawClasses: [], open: 0, resolved: 0, 'not-assertable': 0, entries: [] } as ReviewClass : classes.find(candidate => candidate.id === id);
  const mappedGroup = historical ? group : classes.find(candidate => candidate.id === resolvedId);
  if (!mappedGroup) return `${crumbFor(id)}<div class="page-head"><div><h1>No such review category</h1></div></div>${actionEmptyState({ title: `The reviewed mapping has no category “${e(id)}”`, body: 'Categories come from <code>benchmarks/review-categories.json</code>; unknown classes remain in Needs classification.' })}`;
  const entries = historical ? all.filter(entry => !currentIds.has(entry.id)) : mappedGroup.entries.filter(entry => entry.status === 'open' && currentIds.has(entry.id));
  const classCount = new Set(entries.map(entry => ledgerClassOf(entry.note))).size;
  return `${crumbFor(mappedGroup.label)}<div class="page-head"><div><p class="eyebrow">REVIEW CATEGORY</p><h1>${e(mappedGroup.label)}</h1><div class="meta"><span><b>${n(entries.length)}</b> open here</span><span><b>${n(classCount)}</b> ledger classes</span><span>${e(mappedGroup.description)}</span></div></div></div>
    ${reviewQueue(classes, evaluation, ledgerProblem, id)}
    ${entries.length ? `<section class="section"><h2 class="h2-compact">${n(entries.length)} ${historical ? 'tracking' : 'current decision'} ${entries.length === 1 ? 'item' : 'items'}</h2><ol class="ledger-list">${entries.map(entry => item(entry, mappedGroup, evaluation, ledgerProblem)).join('')}</ol></section>` : actionEmptyState({ title: historical ? 'No historical or unverifiable work' : 'No current-run items in this category', body: historical ? 'Every open entry is reproduced in the validated published run.' : 'Historical items remain in Release or historical follow-up; they are not silently promoted into this decision queue.' })}`;
}

export function bindCopy(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.copy!, status = root.querySelector<HTMLElement>(`[data-copy-status="${id}"]`);
    try { await navigator.clipboard.writeText(root.querySelector<HTMLElement>(`#${id}`)!.textContent ?? ''); if (status) status.textContent = 'Copied to the clipboard.'; }
    catch { if (status) status.textContent = 'Copy is blocked here. Select the text and copy it by hand.'; }
  }));
}
