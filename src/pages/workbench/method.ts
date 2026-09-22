import { actionEmptyState, bindPager, escapeHtml as e, evidenceCrumb, pager, statusMark, type StatusKind } from '../../components';
import { METHODS, assertionRows, reviewRows, summarizeEvaluation } from '../../evaluation-model';
import type { EvaluationReport, EvaluationCase, EvidenceRow } from '../../evaluation-types';

const DESCRIPTIONS: Record<string, string> = {
  twin: 'Authored positive/negative pairs. Absolute and must-flip assertions share one underlying pair.',
  benign: 'Adversarial benign controls, grouped by authored taxonomy. Flagged controls and findings are separate counts.',
  metamorphic: 'Source cases transformed by context and encoding operators; same-detection relations check invariants.',
  mutation: 'Preserve, invalidate or defer expectations according to operator contracts. T0 review-required is unscored.',
  differential: 'Scanner disagreements are review evidence. Peer observations are not ground truth or votes.',
  holdout: 'Isolated frozen-candidate execution. Only aggregate evidence crosses the publication boundary.',
};
const STATUS: Record<string, [StatusKind, string]> = {
  pass: ['pass', 'Passed'], fail: ['fail', 'Failed'], 'review-required': ['review', 'Needs review'], 'not-measured': ['not-measured', 'Not measured'],
  complete: ['pass', 'Complete'], unavailable: ['not-measured', 'Not measured'], unsupported: ['not-measured', 'Unsupported'], error: ['fail', 'Error'], unstable: ['unstable', 'Unstable'],
  generated: ['pass', 'Generated'],
};
export const mark = (status: string) => { const [kind, word] = STATUS[status] ?? ['info', status]; return `<span data-eval="${e(status)}">${statusMark(kind, word)}</span>`; };
const table = (label: string, headers: string[], rows: string[][], numeric: number[] = []) => `<div class="tbl wide" tabindex="0" role="region" aria-label="${e(label)}"><table><thead><tr>${headers.map((h, i) => `<th scope="col"${numeric.includes(i) ? ' class="num"' : ''}>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((c, i) => `<td${numeric.includes(i) ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length ? '' : '<p class="small">No evidence in this selection.</p>'}</div>`;
const section = (heading: string, body: string) => `<section class="section"><h2 class="h2-compact">${e(heading)}</h2>${body}</section>`;
const facts = (items: [string, number | string][]) => `<div class="meta">${items.map(([label, value]) => `<span><b>${e(typeof value === 'number' ? value.toLocaleString('en-US') : value)}</b> ${e(label)}</span>`).join('')}</div>`;

function holdout(r: EvaluationReport) {
  const q = r.qualification;
  if (!q) return actionEmptyState({ title: 'No qualification aggregate published', body: 'Holdout is not part of ordinary discovery. Run the qualification workflow and publish its validated output with the evaluation report.', command: 'npm run eval:qualify\nnpm run eval:publish -- --qualification=results-output/qualification/engine-v1.json' });
  const h = q.holdout;
  return section('Holdout and qualification, separate evidence', `<p class="small">${mark(q.status === 'execution-qualified' ? 'complete' : 'review-required')} ${e(q.status)} · ${e(q.scope)} · <b>supportClaims: false</b></p><p class="small">Execution-qualified means the infrastructure executed its contract. It makes no detection quality or support claim. Run ${e(q.runId)} · ${e(q.finishedAt)}. A separate snapshot from discovery ${e(r.runId)}.</p>${facts([['holdout cases', h.caseCount], ['holdout variants', h.variantCount], ['generation errors', h.generationErrors]])}<p class="small">${e(h.methodology)} · ${e(h.independence)} · ${e(h.status)}. Public controls cannot establish independent detector performance.</p>`
    + table('Holdout scanners', ['Scanner', 'Execution', 'Pass', 'Fail', 'Needs review'], h.scanners.map(s => [e(s.id), mark(s.status), String(s.assertions.pass), String(s.assertions.fail), String(s.assertions['review-required'])]), [2, 3, 4])
    + '<p class="small">Unique affected cases across scanners and detector attribution are unavailable in aggregate evidence. No case drill-down is provided.</p>'
    + `<details><summary>Aggregate methodology and candidate provenance</summary><pre class="snippet" tabindex="0">${e(JSON.stringify({ candidate: h.candidate, corpus: h.corpus, planHash: h.planHash, scanners: h.scanners.map(s => ({ id: s.id, version: s.version, byStratum: s.byStratum })) }, null, 2))}</pre></details>`);
}

function diagnostics(cases: EvaluationCase[], method: string, r: EvaluationReport) {
  const rows = assertionRows(cases);
  const fail = (scanner: string, predicate: (a: EvidenceRow) => boolean) => rows.filter(a => a.scanner === scanner && a.status === 'fail' && predicate(a));
  if (method === 'twin') return section('Pair discrimination by scanner', table('Pair discrimination', ['Scanner', 'Evaluated pairs', 'Discriminated pairs', 'Affected pairs', 'Positive-side failures', 'Negative false alarms', 'must-flip failures'], r.scanners.map(s => {
    const relations = rows.filter(a => a.scanner === s.id && a.type === 'must-flip');
    return [e(s.id), String(relations.length), String(relations.filter(a => a.status === 'pass').length), String(new Set(fail(s.id, () => true).map(a => a.caseId)).size), String(fail(s.id, a => a.type === 'present-within-envelope').length), String(fail(s.id, a => a.type === 'absent').length), String(fail(s.id, a => a.type === 'must-flip').length)];
  }), [1, 2, 3, 4, 5, 6]));
  if (method === 'benign') return section('Controls by scanner and taxonomy', table('Controls', ['Scanner', 'Taxonomy', 'Controls evaluated', 'Flagged controls', 'Findings'], r.scanners.flatMap(s => [...new Set(cases.map(c => c.taxonomy))].map(t => {
    const findings = cases.filter(c => c.taxonomy === t).flatMap(c => c.findings.filter(f => f.scanner === s.id));
    return [e(s.id), e(t), String(findings.length), String(findings.filter(f => f.flagged).length), String(findings.reduce((sum, f) => sum + f.count, 0))];
  })), [2, 3, 4]));
  if (method === 'metamorphic') return section('Invariant relations', table('Invariant relations', ['Scanner', 'Relation failures', 'Affected source cases'], r.scanners.map(s => { const fs = fail(s.id, a => Boolean(a.baseline)); return [e(s.id), String(fs.length), String(new Set(fs.map(a => a.caseId)).size)]; }), [1, 2]));
  if (method === 'differential') return section('Comparison availability', table('Comparisons', ['Peer', 'Complete', 'Incomplete', 'Unsupported', 'Disagreements'], [...new Set(cases.flatMap(c => c.comparisons.map(x => x.peer)))].map(peer => {
    const cs = cases.flatMap(c => c.comparisons.filter(x => x.peer === peer));
    return [e(peer), ...['complete', 'incomplete', 'unsupported'].map(status => String(cs.filter(x => x.status === status).length)), String(cs.filter(x => x.disagreement && x.disagreement !== 'none').length)];
  }), [1, 2, 3, 4]) + '<p class="small">Classification can be unsupported even when range comparison completes. Inspect comparison metadata in the public JSON.</p>');
  return '';
}

// #95: `redact`/`block` are gating; `warn` is accepted-by-design noise on ordinary prose per the
// product ADR (docs/decisions/2026-09-21-add-untargeted-benign-corpus.md, Decision 3) and is never
// counted as a false alarm here.
const GATING_ACTIONS = new Set(['redact', 'block']);

/** Untargeted `real-world-shapes` controls, reported on their own labelled row so a reader never
 * mistakes the accepted-by-design `warn` noise on ordinary prose for a family regression. */
function untargetedFalseAlarms(cases: EvaluationCase[], r: EvaluationReport) {
  const untargeted = cases.filter(c => c.sourceSlug.startsWith('real-world-shapes--'));
  if (!untargeted.length) return '';
  return section('Untargeted false-alarm rate', '<p class="small">Real-world-shaped synthetic content (<code>fixtures/real-world-shapes</code>), reported separately from every family: a flag here is discovery evidence, never evidence against a family, and moves no family\'s support status. Per product ADR <a href="https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-20-warn-unconditionally-on-high-signal-contextual-names.md">2026-09-20-warn-unconditionally-on-high-signal-contextual-names</a>, <code>warn</code> findings on ordinary prose are accepted by design; only <code>redact</code>/<code>block</code> findings count as a false alarm below.</p>'
    + table('Untargeted false alarms', ['Scanner', 'Controls', 'Flagged (any action)', 'Gating (redact/block)', 'Warn-only, non-gating'], r.scanners.map(s => {
      const findings = untargeted.flatMap(c => c.findings.filter(f => f.scanner === s.id));
      const flagged = findings.filter(f => f.flagged).length;
      const gating = findings.filter(f => Object.keys(f.actionCounts ?? {}).some(a => GATING_ACTIONS.has(a))).length;
      return [e(s.id), String(findings.length), String(flagged), String(gating), String(flagged - gating)];
    }), [1, 2, 3, 4]));
}

/** Operators generate the mutation and metamorphic variants, so their evidence sits with those methods. */
function operators(r: EvaluationReport) {
  return section('Operator evidence', '<p class="small">Generation attempts exclude canonical identity variants. Assertion totals retain scanner, tier, kind and relation strata in the public JSON.</p>' + table('Operators', ['Operator', 'Generated', 'Unsupported', 'Error', 'Pass', 'Fail', 'Needs review'], Object.entries(r.byOperator).map(([id, o]) => {
    const totals = Object.values(o.assertions).reduce((a, b) => ({ pass: a.pass + b.pass, fail: a.fail + b.fail, review: a.review + b['review-required'] }), { pass: 0, fail: 0, review: 0 });
    return [e(id), String(o.generated), String(o.unsupported), String(o.error), String(totals.pass), String(totals.fail), String(totals.review)];
  }), [1, 2, 3, 4, 5, 6]));
}

let activeRows: EvidenceRow[] = [];
export function methodPage(r: EvaluationReport, id: string): string {
  const cases = r.cases.filter(c => c.method === id);
  let body = `${evidenceCrumb([{ label: 'Workbench', href: '/workbench' }, { label: id }])}<div class="page-head"><div><p class="eyebrow">EVALUATION METHOD</p><h1>${e(id)}</h1><div class="meta"><span>Discovery run <b>${e(r.runId.slice(0, 8))}</b> · ${e(r.finishedAt.slice(0, 10))}</span><a href="/results/evaluation-v1.json">Public JSON</a></div></div><nav class="seg" aria-label="Evaluation methods">${METHODS.map(m => `<a href="/workbench/method/${m}"${m === id ? ' aria-current="page"' : ''}>${m}</a>`).join('')}</nav></div><p class="prose">${e(DESCRIPTIONS[id] ?? '')}</p>`;
  if (id === 'holdout') return body + holdout(r);
  const s = summarizeEvaluation(cases), queue = reviewRows(r, cases);
  body += facts([['cases', s.cases], ['variants', s.variants], ['affected failing cases', s.affected], ['failed assertions', s.assertions.fail], ['passing assertions', s.assertions.pass], ['review-required assertions', s.assertions['review-required']], ['not-measured assertions', s.assertions['not-measured']], ['review queue entries', queue.length], ['generation errors', s.generationErrors], ['unsupported attempts', s.unsupported]]);
  body += `<p class="small" style="margin-top:var(--space-3)">Scanner execution: ${r.scanners.map(sc => `${e(sc.id)} ${mark(sc.status)}`).join(' · ')}</p>`;
  body += diagnostics(cases, id, r);
  if (id === 'benign') body += untargetedFalseAlarms(cases, r);
  if (id === 'mutation' || id === 'metamorphic') body += operators(r);
  const review = id === 'differential';
  activeRows = review ? queue : assertionRows(cases);
  body += section(review ? 'Human review evidence' : 'Assertion explorer', `<p class="small">Review-required is unscored, not a product failure. Relational overlap marks an absolute failure on the same case and scanner; unique case counts include it once.</p><div id="evaluation-filters" class="filters"></div><p class="small" id="evaluation-count" role="status"></p><div id="evaluation-rows"></div>${pager('evaluation')}`);
  const generation = cases.flatMap(c => c.generation.filter(g => g.status !== 'generated').map(g => [e(c.id), e(g.operator), mark(g.status)]));
  if (generation.length) body += section('Generation attempts requiring attention', `<details><summary>${generation.length} unsupported or error attempts</summary>${table('Generation attempts', ['Case', 'Operator', 'Status'], generation)}</details>`);
  return body;
}

const saved = new Map<string, { filters: Record<string, string>; page: number }>();
const PAGE = 50;
export function bindExplorer() {
  const filters = document.querySelector('#evaluation-filters');
  if (!filters) return;
  const state = saved.get(location.pathname) ?? { filters: {}, page: 0 }; saved.set(location.pathname, state);
  const fields: (keyof EvidenceRow)[] = ['detector', 'scanner', 'tier', 'kind', 'type', 'operator', 'status', 'peer', 'disagreement', 'taxonomy', 'effect'];
  filters.innerHTML = fields.flatMap(f => {
    const values = [...new Set(activeRows.flatMap(r => (f === 'detector' ? r.detector.split(', ') : [String(r[f])])).filter(Boolean))].sort();
    return values.length > 1 ? [`<label class="field">${e(f)}<select data-eval-filter="${f}"><option value="">All</option>${values.map(v => `<option value="${e(v)}" ${state.filters[f] === v ? 'selected' : ''}>${e(v)}</option>`).join('')}</select></label>`] : [];
  }).join('');
  const render = () => {
    const rows = activeRows.filter(r => Object.entries(state.filters).every(([f, v]) => !v || (f === 'detector' ? r.detector.split(', ').includes(v) : String(r[f as keyof EvidenceRow]) === v)));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)); state.page = Math.min(state.page, pages - 1);
    document.querySelector('#evaluation-count')!.textContent = `${rows.length.toLocaleString('en-US')} entries · ${new Set(rows.map(r => r.caseId)).size.toLocaleString('en-US')} unique cases in this selection`;
    document.querySelector('#evaluation-rows')!.innerHTML = table('Evidence', ['Case and status', 'Evidence', 'Variant or relation', 'Transformation', 'Scanner or review peer'], rows.slice(state.page * PAGE, state.page * PAGE + PAGE).map(r => [
      `${mark(r.status)}<br><a href="/fixture/${e(r.sourceSlug)}">${e(r.caseId)}</a><small>${e(r.detector)} · ${e(r.taxonomy)}</small>`,
      `${e(r.type)}<small>${e(r.kind)} / ${e(r.tier)}</small>${r.overlap ? '<small>Overlaps absolute failure on this case and scanner</small>' : ''}`,
      `${e(r.baseline ? r.baseline + ' → ' : '')}${e(r.variant)}<small>${r.baseline ? 'Relational' : 'Absolute or observation'}</small>`,
      `${e(r.operator)}<small>${e(r.property)} · effect: ${e(r.effect || 'not specified')} · contract match: ${e(r.contract)}</small>`,
      `${e(r.scanner || 'scanner-independent')} ${r.peer ? '↔ ' + e(r.peer) : ''}<small>${e(r.disagreement)}</small>`]));
    showPage(state.page, pages);
  };
  const showPage = bindPager('evaluation', delta => { state.page += delta; render(); });
  filters.querySelectorAll<HTMLSelectElement>('select').forEach(sel => sel.addEventListener('change', () => { state.filters[sel.dataset.evalFilter!] = sel.value; state.page = 0; render(); }));
  render();
}
