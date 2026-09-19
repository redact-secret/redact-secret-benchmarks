import { escape as e } from '../types';
import { title } from './browse';
import { METHODS, assertionRows, reviewRows, summarizeEvaluation } from '../evaluation-model';
import type { EvaluationReport, EvaluationCase, EvidenceRow } from '../evaluation-types';

const descriptions: Record<string, string> = {
  twin: 'Authored positive/negative pairs. Absolute and must-flip assertions share one underlying pair.',
  benign: 'Adversarial benign controls, grouped by authored taxonomy. Flagged controls and findings are separate counts.',
  metamorphic: 'Source cases transformed by context and encoding operators; same-detection relations check invariants.',
  mutation: 'Preserve, invalidate or defer expectations according to operator contracts. T0 review-required is unscored.',
  differential: 'Scanner disagreements are review evidence. Peer observations are not ground truth or votes.',
  holdout: 'Isolated frozen-candidate execution. Only aggregate evidence crosses the publication boundary.',
};
const link = (path: string, label: string) => `<a class="text-link" href="${e(path)}">${e(label)}</a>`;
const badge = (status: string) => `<span class="eval-status eval-${e(status)}">${e(status)}</span>`;
const table = (headers: string[], rows: string[][]) => `<p class="eval-table-hint">Scroll horizontally to inspect all evidence columns.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Evidence table"><table><thead><tr>${headers.map(h => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length ? '' : '<p class="empty">No evidence in this selection.</p>'}</div>`;
const panel = (heading: string, body: string) => `<section class="panel"><h2>${e(heading)}</h2>${body}</section>`;
const metrics = (items: [string, number | string][]) => `<div class="eval-metrics">${items.map(([label, n]) => `<div><strong>${e(n)}</strong><span>${e(label)}</span></div>`).join('')}</div>`;
const nav = () => `<nav class="fixture-links" aria-label="Evaluation">${[['','Dashboard'],['failures','Failures'],['reviews','Review queue'],['operators','Operators'], ...METHODS.map(m => [`method/${m}`, m])].map(([p, t]) => link(`/evaluation${p ? '/' + p : ''}`, t)).join('')}</nav>`;
export function evaluationEmpty(problem: string) {
  return title('Evaluation Engine', 'Case, variant and assertion evidence alongside the measurement-v4 benchmarks.') + nav() + `<div class="notice" role="status"><div><strong>${e(problem)}</strong><p>Generate and publish current evidence:</p><pre>npm run eval
npm run eval:publish</pre><p>Optional: add --qualification=path/to/validated-qualification.json to eval:publish. Existing fixture measurements remain available.</p></div></div>`;
}
function summary(cases: EvaluationCase[], reviews: number) {
  const s = summarizeEvaluation(cases);
  return metrics([['Cases', s.cases], ['Variants', s.variants], ['Affected failing cases', s.affected], ['Failed assertions', s.assertions.fail], ['Passing assertions', s.assertions.pass], ['Review-required assertions', s.assertions['review-required']], ['Not-measured assertions', s.assertions['not-measured']], ['Cases with review assertions', s.reviewed], ['Review queue entries', reviews], ['Generation errors', s.generationErrors], ['Unsupported attempts', s.unsupported]]);
}
function methodMatrix(cases: EvaluationCase[], r: EvaluationReport) {
  return panel('Method evidence', '<p>Development counts span selected scanners. Cases are unique within a method; assertions are not independent cases. Detector assignments overlap.</p>' + table(['Method','Cases','Variants','Affected cases','Pass assertions','Fail assertions','Review assertions','Queue entries','Generation errors','Evidence'], METHODS.slice(0, 5).map(m => {
    const cs = cases.filter(c => c.method === m), s = summarizeEvaluation(cs);
    return [link(`/evaluation/method/${m}`, m), ...[s.cases,s.variants,s.affected,s.assertions.pass,s.assertions.fail,s.assertions['review-required'],reviewRows(r, cs).length,s.generationErrors].map(String), e(m === 'twin' ? `${s.affected} affected pairs / ${s.cases} pairs` : m === 'benign' ? `${new Set(cs.filter(c => c.findings.some(f => f.flagged)).map(c => c.id)).size} flagged controls / ${cs.length} controls` : m === 'metamorphic' ? `${s.affected} affected cases / ${s.variants} variants` : m === 'mutation' ? `${s.assertions.fail} fail / ${s.assertions['review-required']} review assertions` : `${reviewRows(r,cs).length} unresolved disagreements`)];
  })) + `<p>${link('/evaluation/method/holdout','Holdout')} is a separate aggregate run below; its counts are never added to development totals.</p>`);
}
function holdout(r: EvaluationReport) {
  const q = r.qualification;
  if (!q) return panel('Holdout / qualification', '<p>No qualification aggregate published. Run the qualification workflow and pass its validated output to <code>eval:publish -- --qualification=…</code>. Holdout is not part of ordinary discovery.</p>');
  const h = q.holdout;
  return panel('Holdout / qualification — separate evidence', `<p>${badge(q.status)} · ${e(q.scope)} · <strong>supportClaims: false</strong></p><p>Execution-qualified means the infrastructure executed its contract. It makes no global detection quality or support claim.</p><p>Run ${e(q.runId)} · ${e(q.finishedAt)}. This is a separate snapshot from discovery ${e(r.runId)}.</p><p>Milestone snapshot: ${e(q.milestone.status)} · checked ${e(q.milestone.checkedAt)} · open prerequisites ${e(q.milestone.openPrerequisites.join(', ') || 'none')}. Historical snapshots may be stale; refresh with <code>npm run eval:milestone</code> and regenerate qualification.</p>` + metrics([['Holdout cases', h.caseCount],['Holdout variants',h.variantCount],['Generation errors',h.generationErrors]]) + `<p>${e(h.methodology)} · ${e(h.independence)} · ${e(h.status)}. Public controls cannot establish independent detector performance. Protected corpus lifecycle is historical; consult the custodian for current contamination status.</p>` + table(['Scanner','Execution','Pass assertions','Fail assertions','Review assertions'], h.scanners.map(s => [e(s.id),badge(s.status),String(s.assertions.pass),String(s.assertions.fail),String(s.assertions['review-required'])])) + '<p>Unique affected cases across scanners and detector attribution are unavailable in aggregate evidence. No case drill-down is provided.</p>' + `<details><summary>Aggregate methodology and candidate provenance</summary><pre>${e(JSON.stringify({ candidate: h.candidate, corpus: h.corpus, planHash: h.planHash, scanners: h.scanners.map(s => ({ id: s.id, version: s.version, byStratum: s.byStratum })) }, null, 2))}</pre></details>`);
}
function diagnostics(cases: EvaluationCase[], method: string, r: EvaluationReport) {
  const rows = assertionRows(cases);
  const fail = (scanner: string, predicate: (a: EvidenceRow) => boolean) => rows.filter(a => a.scanner === scanner && a.status === 'fail' && predicate(a));
  if (method === 'twin') return panel('Pair discrimination by scanner', table(['Scanner','Evaluated pairs','Discriminated pairs','Affected pairs','Positive-side assertion failures','Negative false alarms','must-flip failures'], r.scanners.map(s => {
    const selected = rows.filter(a => a.scanner === s.id), relations = selected.filter(a => a.type === 'must-flip');
    return [e(s.id), String(relations.length), String(relations.filter(a => a.status === 'pass').length), String(new Set(fail(s.id, () => true).map(a => a.caseId)).size), String(fail(s.id,a => a.type === 'present-within-envelope').length),String(fail(s.id,a => a.type === 'absent').length),String(fail(s.id,a => a.type === 'must-flip').length)];
  })));
  if (method === 'benign') return panel('Controls by scanner and taxonomy', table(['Scanner','Taxonomy','Controls evaluated','Flagged controls','Findings'], r.scanners.flatMap(s => [...new Set(cases.map(c => c.taxonomy))].map(t => {
    const cs = cases.filter(c => c.taxonomy === t), findings = cs.flatMap(c => c.findings.filter(f => f.scanner === s.id));
    return [e(s.id),e(t),String(findings.length),String(findings.filter(f => f.flagged).length),String(findings.reduce((n,f) => n+f.count,0))];
  }))));
  if (method === 'metamorphic') return panel('Invariant relations', table(['Scanner','Relation failures','Affected source cases'], r.scanners.map(s => { const fs = fail(s.id, a => Boolean(a.baseline)); return [e(s.id),String(fs.length),String(new Set(fs.map(a => a.caseId)).size)]; })));
  if (method === 'differential') return panel('Comparison availability', table(['Peer','Complete comparisons','Incomplete','Unsupported','Disagreements'], [...new Set(cases.flatMap(c => c.comparisons.map(x => x.peer)))].map(peer => {
    const cs = cases.flatMap(c => c.comparisons.filter(x => x.peer === peer));
    return [e(peer),...['complete','incomplete','unsupported'].map(status => String(cs.filter(x => x.status === status).length)),String(cs.filter(x => x.disagreement && x.disagreement !== 'none').length)];
  })) + '<p>Classification can be unsupported even when range comparison completes. Inspect comparison metadata in the public JSON.</p>');
  return '';
}
function operators(r: EvaluationReport) {
  return panel('Operator evidence', '<p>Generation attempts exclude canonical identity variants. Assertion totals retain scanner, tier, kind and relation strata in the public JSON.</p>' + table(['Operator','Generated','Unsupported','Error','Pass assertions','Fail assertions','Review assertions'], Object.entries(r.byOperator).map(([id,o]) => {
    const totals = Object.values(o.assertions).reduce((a,b) => ({pass:a.pass+b.pass,fail:a.fail+b.fail,'review-required':a['review-required']+b['review-required']}), {pass:0,fail:0,'review-required':0});
    return [e(id),String(o.generated),String(o.unsupported),String(o.error),String(totals.pass),String(totals.fail),String(totals['review-required'])];
  })));
}
let activeRows: EvidenceRow[] = [];
export function evaluationPage(r: EvaluationReport, view: string, id: string) {
  const cases = r.cases.filter(c => view === 'method' ? c.method === id : view === 'detector' ? c.targets.includes(id) : true);
  const label = view === 'method' ? id : view === 'detector' ? `Detector: ${id}` : view === 'overview' ? 'Evaluation Engine' : view === 'reviews' ? 'Review queue' : view;
  let body = title(label, descriptions[id] ?? 'Inspect development evidence, assertion failures and human review separately.', 'EVALUATION ENGINE') + nav();
  if (view === 'method' && !METHODS.includes(id)) return body + '<p>Unknown evaluation method.</p>';
  body += `<p class="run-line">Discovery run ${e(r.runId)} · ${e(r.finishedAt)} · ${link('/results/evaluation-v1.json','Public JSON')}</p>`;
  if (view === 'method' && id === 'holdout') return body + holdout(r);
  if (view === 'detector') body += `<p>${link(`/benchmark/${id}`,'Measurement-v4 detector fixtures')} · ${link('/evaluation/method/holdout','Holdout aggregate: detector attribution unavailable')}</p>`;
  if (view === 'operators') return body + operators(r);
  body += summary(cases, reviewRows(r, cases).length);
  // Ledger state covers the whole run, not the current filter: `unknown` is a disagreement nobody has looked at.
  if (view === 'overview' || view === 'reviews') body += `<p>Review ledger (accounting v${e(r.accountingVersion)}): ${r.review.unknown} unknown · ${r.review.open} open · ${r.review.resolved} resolved${r.review.oldestOpenRun ? ` · oldest open since run ${e(r.review.oldestOpenRun)}` : ''}. Qualification requires zero unknown entries, not zero open ones.</p>`;
  if (view !== 'overview') body += `<p>Scanner execution: ${r.scanners.map(s => `${e(s.id)} ${badge(s.status)}`).join(' · ')}</p>`;
  if (view === 'overview') {
    return body + panel('Scanner execution', table(['Scanner','Version','Mode','Status'],r.scanners.map(s => [e(s.id),e(s.version ?? 'unavailable'),e(s.mode),badge(s.status)]))) + methodMatrix(cases,r) + panel('Detector evidence', `<div class="category-grid">${[...new Set(cases.flatMap(c => c.targets))].sort().map(d => link(`/evaluation/detector/${d}`,d)).join('')}</div>`) + holdout(r) + panel('Discovery provenance',`<details><summary>Revision, case hash, method and operator versions</summary><pre>${e(JSON.stringify(r.provenance,null,2))}</pre></details><p>Scope is this selection and run only. No overall accuracy score or scanner ranking.</p>`);
  }
  if (view === 'detector') body += methodMatrix(cases,r);
  if (view === 'method') body += diagnostics(cases,id,r);
  activeRows = view === 'reviews' || id === 'differential' ? reviewRows(r,cases) : assertionRows(cases).filter(a => view !== 'failures' || a.status === 'fail');
  body += panel(view === 'reviews' || id === 'differential' ? 'Human review evidence' : 'Assertion explorer', `<p>Review-required is unscored, not a product failure. Relational overlap identifies an absolute failure on the same case/scanner; unique case counts include it once.</p><div id="evaluation-filters" class="eval-filters"></div><p id="evaluation-count" role="status"></p><div id="evaluation-rows"></div><div class="fixture-links"><button class="button" id="evaluation-prev">Previous</button><span id="evaluation-page"></span><button class="button" id="evaluation-next">Next</button></div>`);
  const generation = cases.flatMap(c => c.generation.filter(g => g.status !== 'generated').map(g => [e(c.id),e(g.operator),badge(g.status)]));
  if (generation.length) body += panel('Generation attempts requiring attention', `<details><summary>${generation.length} unsupported/error attempts</summary>${table(['Case','Operator','Status'], generation)}</details>`);
  return body;
}
const saved = new Map<string, { filters: Record<string,string>; page: number }>();
export function bindEvaluation() {
  const filters = document.querySelector('#evaluation-filters');
  if (!filters) return;
  const state = saved.get(location.pathname) ?? { filters: {}, page: 0 }; saved.set(location.pathname,state);
  const fields: (keyof EvidenceRow)[] = ['method','detector','scanner','tier','kind','type','operator','status','peer','disagreement','taxonomy','effect'];
  filters.innerHTML = fields.map(f => {
    const values = [...new Set(activeRows.flatMap(r => f === 'detector' ? r.detector.split(', ') : [String(r[f])]).filter(Boolean))].sort();
    return `<label>${e(f)}<select data-eval-filter="${f}"><option value="">All</option>${values.map(v => `<option value="${e(v)}" ${state.filters[f] === v ? 'selected' : ''}>${e(v)}</option>`).join('')}</select></label>`;
  }).join('');
  const render = () => {
    const rows = activeRows.filter(r => Object.entries(state.filters).every(([f,v]) => !v || (f === 'detector' ? r.detector.split(', ').includes(v) : String(r[f as keyof EvidenceRow]) === v)));
    const pages = Math.max(1, Math.ceil(rows.length/50)); state.page = Math.min(state.page,pages-1);
    document.querySelector('#evaluation-count')!.textContent = `${rows.length} entries · ${new Set(rows.map(r => r.caseId)).size} unique affected/listed cases in this selection`;
    document.querySelector('#evaluation-rows')!.innerHTML = table(['Case / source / status','Evidence','Variant / relation','Transformation','Scanner / review peer'],rows.slice(state.page*50,state.page*50+50).map(r => [
      `${badge(r.status)}<br>${link(`/fixture/${r.sourceSlug}`,r.caseId)}<small>${e(r.method)} · ${e(r.detector)} · ${e(r.taxonomy)}</small>`,
      `${e(r.type)}<small>${e(r.kind)} / ${e(r.tier)}</small>${r.overlap ? '<small>Overlaps absolute failure on this case/scanner</small>' : ''}`,
      `${e(r.baseline ? r.baseline + ' → ' : '')}${e(r.variant)}<small>${r.baseline ? 'Relational' : 'Absolute / observation'}</small>`,
      `${e(r.operator)}<small>${e(r.property)} · effect: ${e(r.effect || 'not specified')} · contract match: ${e(r.contract)}</small>`,
      `${e(r.scanner || 'scanner-independent')} ${r.peer ? '↔ ' + e(r.peer) : ''}<small>${e(r.disagreement)}</small>`]));
    document.querySelector('#evaluation-page')!.textContent = `Page ${state.page+1} of ${pages}`;
    (document.querySelector('#evaluation-prev') as HTMLButtonElement).disabled = state.page === 0;
    (document.querySelector('#evaluation-next') as HTMLButtonElement).disabled = state.page === pages-1;
  };
  filters.querySelectorAll<HTMLSelectElement>('select').forEach(s => s.addEventListener('change', () => { state.filters[s.dataset.evalFilter!] = s.value; state.page=0; render(); }));
  document.querySelector('#evaluation-prev')!.addEventListener('click',()=>{state.page--;render();});
  document.querySelector('#evaluation-next')!.addEventListener('click',()=>{state.page++;render();});
  render();
}
