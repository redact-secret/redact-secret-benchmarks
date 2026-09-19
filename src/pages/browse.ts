import rawKnownGaps from '../../benchmarks/known-gaps.json';
import { validateKnownGaps, type KnownGaps } from '../../benchmarks/lib/promotion';
import { categories, registry, fixtures, corpora, baseline, type Fixture } from '../catalog';
import { summarize, contentSegments, rowSignal, outcomeCode } from '../model.mjs';
import { kinds, tiers, contracts } from '../../benchmarks/lib/assessment.ts';
import { escape as e, published, ratio, type Report, type Row, type Run, type Summary, type RedactGroup, type ControlGroup, type Outcome } from '../types';

type Kinds = keyof typeof kinds;
const knownGaps = validateKnownGaps(rawKnownGaps as unknown as KnownGaps);
type Tiers = keyof typeof tiers;
const OUTCOMES: Outcome[] = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'];
export const GLYPH: Record<Outcome, string> = { EXACT: '■', COVERED: '◩', OVERBROAD: '◫', PARTIAL: '◪', MISS: '□' };
const SECTIONS: Kinds[] = ['must-redact', 'must-not-flag', 'policy'];

export const title = (label: string, description: string, eyebrow = 'BENCHMARK LAB') => `<div class="eyebrow">${e(eyebrow)}</div><h1>${e(label)}<span>.</span></h1><p class="intro">${e(description)}</p>`;
export const ranges = (items: { start: number; end: number }[]) => items.map(r => `[${r.start}, ${r.end})`).join(' · ') || 'None';
export const tierBadge = (tier: string) => `<span class="tier tier-${e(tier)}" title="${e(tier)} · ${e(tiers[tier as Tiers]?.description ?? '')}">${e(tiers[tier as Tiers]?.title ?? tier)}</span>`;
const kindTitle = (kind: string) => kinds[kind as Kinds]?.title ?? kind;
const num = (n: number) => `<span class="num">${n}</span>`;
export const readingNote = (extra = '') => `<p class="reading-note">Three questions, asked separately. A tool can be perfect at one and poor at another, which is why they are never averaged.${extra ? ` ${e(extra)}` : ''} <a class="text-link" href="/methodology">Full protocol and limits →</a></p>`;
const HEADINGS: Record<Kinds, { title: string; blurb: (files: number, spans: number) => string }> = {
  'must-redact': { title: 'Real secrets — must be found', blurb: (files, spans) => `${files} files holding ${spans} genuine credentials. Missing one is a failure by any tool’s standard.` },
  'must-not-flag': { title: 'Safe values — must stay quiet', blurb: files => `${files} files with nothing secret in them: examples, placeholders, near-misses, public keys. Any finding here is a false alarm.` },
  policy: { title: 'Our redaction policy — tools may differ', blurb: (files, spans) => `${spans} spans we chose to mask, across ${files} files. A tool doing otherwise is a difference of opinion, not a bug.` },
};
const OUTCOME_LEGEND = '■ exact · ◩ covered · ◫ covered but wider than allowed · ◪ partly covered (leaked) · □ missed (leaked)';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One sentence per scanner, from the strongest evidence tier present. Denominators never cross tiers. */
export function leadLine(summaries: Summary[]) {
  const pick = (kind: string) => { const tier = [...new Set(summaries.filter(s => s.kind === kind && s.metrics).map(s => s.tier))].sort()[0]; return { tier, rows: summaries.filter(s => s.kind === kind && s.metrics && s.tier === tier) }; };
  const redact = pick('must-redact'), control = pick('must-not-flag');
  const names = [...new Set([...redact.rows, ...control.rows].map(s => s.name))].sort();
  if (!names.length) return '';
  const secretWord = redact.tier === 'T1' ? 'documented secrets' : 'secrets';
  const sentences = names.map(name => {
    const r = redact.rows.find(s => s.name === name)?.metrics as RedactGroup | null | undefined;
    const c = control.rows.find(s => s.name === name)?.metrics as ControlGroup | null | undefined;
    const issues: string[] = [];
    if (r) issues.push(r.leakedSpans ? `left ${r.leakedSpans} of ${r.spans} ${secretWord} readable` : `left none of ${r.spans} ${secretWord} readable`);
    if (r && r.twins.pairs && r.twins.discriminated < r.twins.pairs) issues.push(`flagged ${r.twins.pairs - r.twins.discriminated} of ${r.twins.pairs} near-miss fakes`);
    if (c && c.flaggedFiles) issues.push(`raised false alarms on ${c.flaggedFiles} of ${c.files} safe files`);
    if (c && !c.flaggedFiles && r && !r.leakedSpans && r.twins.discriminated === r.twins.pairs) return `${name} left nothing readable and flagged nothing safe.`;
    return `${name} ${issues.join(', ')}.`;
  });
  return `<p class="lead-line"><strong>This run:</strong> ${sentences.map(e).join(' ')}</p>`;
}

const histogram = (g: RedactGroup) => {
  const total = OUTCOMES.reduce((n, o) => n + g.outcomes[o], 0) || 1;
  return `<div class="bar" role="img" aria-label="${OUTCOMES.map(o => `${o} ${g.outcomes[o]}`).join(', ')}" title="${OUTCOMES.map(o => `${GLYPH[o]} ${o} ${g.outcomes[o]}`).join(' · ')}">${OUTCOMES.map(o => `<i class="o-${o.toLowerCase()}" style="flex:${g.outcomes[o] / total}"></i>`).join('')}</div>`;
};
const controlBar = (g: ControlGroup) => `<div class="bar" role="img" aria-label="${g.files - g.flaggedFiles} clean, ${g.flaggedFiles} flagged" title="○ clean ${g.files - g.flaggedFiles} · ● flagged ${g.flaggedFiles}"><i class="o-exact" style="flex:${(g.files - g.flaggedFiles) / (g.files || 1)}"></i><i class="o-miss" style="flex:${g.flaggedFiles / (g.files || 1)}"></i></div>`;

const scannerCell = (s: Summary, diag = '') => `<td class="wrap-cell"><strong>${e(s.name)}</strong> <small class="mono">${e(s.version ?? 'version unavailable')}</small>${tierBadge(s.tier)}<details data-key="prov-${e(s.key)}-${e(s.scanner)}"><summary>Provenance</summary><small>${diag}${e(s.mode)} · suites: ${s.sources.map(source => `<a class="text-link" href="/benchmark/${e(source)}">${e(source)}</a>`).join(', ')} · status: ${e([...new Set(s.statuses)].join(', '))} · review: ${e([...new Set(s.reviews)].join('; '))} · lock ${e(s.lockHash?.slice(0, 12))} · run ${e(s.runId ?? '—')}</small></details></td>`;

const rowOpen = (s: Summary) => `<tr data-tier="${e(s.tier)}" data-scanner="${e(s.name)}">`;
function redactRow(s: Summary) {
  const g = s.metrics as RedactGroup | null;
  if (!g || !s.rows.length) return `${rowOpen(s)}${scannerCell(s)}<td>${num(s.rows.length)} of ${s.selectedCount}</td><td colspan="4" class="empty">Not measured</td></tr>`;
  const diag = `exact-range agreement (diagnostic, not comparable): ${g.diagnostics.exact.tp} exact · ${g.diagnostics.exact.fp} extra · ${g.diagnostics.exact.fn} inexact · `;
  const untwinned = g.twins.positives - g.twins.pairs;
  return `${rowOpen(s)}${scannerCell(s, diag)}<td>${num(g.files)} of ${s.selectedCount}</td><td title="${g.leakedSpans} leaked spans of ${g.spans} · ${g.leakedBytes} of ${g.secretBytes} secret bytes left readable (${e(published(g.leakedByteRate))}) · measurable share ${e(published(g.measurableShare))}, ${g.pendingFiles} pending · envelopes widen ${g.envelopeWidth.spans} spans by ${g.envelopeWidth.bytes} B">${g.leakedSpans ? `${num(g.leakedSpans)} of ${g.spans} <small>${e(published(g.leakedSpanRate))}</small>` : `<span class="good">none</span> of ${g.spans} <small>${e(published(g.leakedSpanRate))}</small>`}</td><td title="${g.collateralBytes} redacted bytes outside every allowed range, against ${g.secretBytes} secret bytes">${g.collateralBytes ? `${num(g.collateralBytes)} B extra <small>${e(published(g.collateralRatio, ratio))}× the secrets</small>` : '<span class="good">none</span><small>no extra text destroyed</small>'}</td><td title="pairs where the real secret was covered and its one-character fake stayed clean">${g.twins.pairs ? `${num(g.twins.discriminated)} of ${g.twins.pairs} pairs <small>${e(published(g.twins.rate))}</small>` : '<span class="empty">no fakes authored</span>'}${untwinned ? `<small>${plural(untwinned, 'secret')} without a fake yet · coverage ${e(published(g.twins.coverage))}</small>` : ''}</td><td class="bar-cell">${histogram(g)}</td></tr>`;
}
function controlRow(s: Summary) {
  const g = s.metrics as ControlGroup | null;
  if (!g || !s.rows.length) return `${rowOpen(s)}${scannerCell(s)}<td>${num(s.rows.length)} of ${s.selectedCount}</td><td colspan="3" class="empty">Not measured</td></tr>`;
  return `${rowOpen(s)}${scannerCell(s, `${g.diagnostics.exact.fp} findings on control files · `)}<td>${num(g.files)} of ${s.selectedCount}</td><td>${g.flaggedFiles ? `${num(g.flaggedFiles)} of ${g.files} <small>${e(published(g.falseAlarmRate))}</small>` : `<span class="good">none</span> of ${g.files} <small>${e(published(g.falseAlarmRate))}</small>`}</td><td>${e(published(g.meanFindingsPerFlagged, v => v.toFixed(2)))}</td><td class="bar-cell">${controlBar(g)}</td></tr>`;
}

export function comparison(selected: Fixture[], reports: Report[], run?: Run) {
  const { summaries, stale, runId } = summarize(selected, reports.filter(r => selected.some(f => f.category === r.category)), run?.runId);
  const pending = selected.filter(f => f.assessment.tier === 'T0').length;
  const relevantSuites = [...new Set(selected.map(f => f.category))];
  const measured = relevantSuites.filter(c => reports.some(r => r.category === c && r.runId === runId));
  const partial = runId && measured.length !== relevantSuites.length ? `<div class="notice"><div><strong>Partial run — ${measured.length} of ${relevantSuites.length} suites at run ${e(runId.slice(0, 19))}</strong><p>Not aggregated (stale or missing): ${relevantSuites.filter(c => !measured.includes(c)).map(c => e(c)).join(', ')}. Rerun <code>npm run bench</code> for one atomic run.</p></div></div>` : '';
  const splitToggle = (kind: string) => `<label class="toggle split"><input type="checkbox" data-split="${e(kind)}"> Split by evidence</label>`;
  const sections = SECTIONS.map(kind => {
    const members = selected.filter(f => f.assessment.kind === kind && f.assessment.tier !== 'T0');
    const groups = summaries.filter(s => s.kind === kind).sort((a, b) => a.name.localeCompare(b.name) || a.tier.localeCompare(b.tier));
    const present = [...new Set(members.map(f => f.assessment.tier))].sort();
    const spans = members.reduce((n, f) => n + f.expected.filter(s => s.role === 'secret').length, 0);
    const control = kind === 'must-not-flag';
    const head = control
      ? '<th>Scanner</th><th>Files measured</th><th>Safe files wrongly flagged</th><th>Findings per flagged file</th><th title="○ clean · ● flagged">Clean ○ · flagged ●</th>'
      : `<th>Scanner</th><th>Files measured</th><th>Secrets left readable</th><th>Over-redaction</th><th>Tells fakes apart</th><th title="${OUTCOME_LEGEND}">Outcome per secret ■ ◩ ◫ ◪ □</th>`;
    const tierHead = (tier: string) => `<tr class="tier-head" data-tier="${e(tier)}" hidden><td colspan="${control ? 5 : 6}">${tierBadge(tier)} ${members.filter(f => f.assessment.tier === tier).length} files · compared only within this evidence level</td></tr>`;
    const body = present.map(t => tierHead(t) + groups.filter(g => g.tier === t).map(control ? controlRow : redactRow).join('')).join('');
    return `<section class="panel" data-kind="${kind}"><div class="section-heading"><div><h2>${e(HEADINGS[kind].title)}</h2><p>${e(HEADINGS[kind].blurb(members.length, spans))}</p></div>${present.length > 1 && groups.length ? splitToggle(kind) : ''}</div>${groups.length ? `<div class="table-scroll"><table class="compact"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` : `<p class="empty">${members.length ? 'No current measurements. Run npm run bench.' : 'No fixtures of this kind in this selection.'}</p>`}</section>`;
  }).join('');
  return partial + leadLine(summaries) + sections + (pending ? `<p class="pending-link"><a class="text-link" href="/pending">${plural(pending, 'file')} we haven’t verified yet — shown, never scored →</a></p>` : '');
}

const glyphs = (row: Row | undefined, status: string, base?: string) => {
  if (!row) return `<span class="glyph muted" title="${e(status)}">—</span>`;
  const { changed, clean } = rowSignal(row, base);
  const text = row.spanOutcomes ? row.spanOutcomes.map(o => GLYPH[o]).join('') : row.flagged != null ? (row.flagged ? '●' : '○') : '·';
  const label = row.spanOutcomes ? row.spanOutcomes.join(', ') : row.flagged != null ? (row.flagged ? `flagged (${row.findings})` : 'clean') : `observed ${row.actual.length} range(s), unscored`;
  return `<span class="glyph ${clean === false ? 'bad' : clean ? 'good' : 'muted'}${changed ? ' changed' : ''}" title="${e(label)}${changed ? ` · changed since baseline (${e(base)})` : ''}">${text}${changed ? '<sup>Δ</sup>' : ''}</span>`;
};

export function fixtureList(selected: Fixture[], reports: Report[], run?: Run) {
  const scanners = [...new Map(reports.flatMap(r => r.scanners.map(s => [s.id, s.name] as const))).entries()];
  const runId = run?.runId ?? reports.map(r => r.runId).sort().at(-1);
  let signalCount = 0;
  const rows = selected.map(f => {
    const report = reports.find(r => r.category === f.category);
    const cells = scanners.map(([id]) => {
      const scanner = report?.scanners.find(s => s.id === id);
      const row = scanner?.status === 'complete' ? scanner.rows?.find(r => r.id === f.id) : undefined;
      const base = baseline?.rows[f.slug]?.[id];
      return { id, scanner, row, base, signal: rowSignal(row, base) };
    });
    const signal = cells.some(c => c.signal.changed || c.signal.clean === false);
    if (signal) signalCount++;
    const stale = report && runId && report.runId !== runId;
    const search = `${f.id} ${f.group} ${f.category} ${f.assessment.kind} ${f.assessment.tier} ${kindTitle(f.assessment.kind)} ${f.assessment.contract ?? ''} ${f.twinOf ? 'twin' : ''}`.toLowerCase();
    return `<tr data-search="${e(search)}" data-signal="${signal ? 1 : 0}" data-row="${e(f.slug)}"><td><button type="button" class="expand" aria-expanded="false" aria-controls="x-${e(f.slug)}" aria-label="Details for ${e(f.id)}">›</button><a class="text-link" href="/fixture/${e(f.slug)}">${e(f.id)}</a><small>${e(f.category)} · ${e(f.group)}</small></td><td>${tierBadge(f.assessment.tier)} ${e(kindTitle(f.assessment.kind))}${f.twinOf ? '<small>twin</small>' : ''}</td><td class="num">${f.expected.filter(s => s.role === 'secret').length || '—'}</td>${cells.map(c => `<td class="glyph-cell">${glyphs(c.row, c.scanner?.status ?? 'Not measured', c.base)}${stale ? '<small>stale run</small>' : ''}</td>`).join('')}</tr><tr class="expansion" id="x-${e(f.slug)}" hidden><td colspan="${3 + scanners.length}"><p>${e(f.assessment.reason)}</p>${f.twinOf ? `<p>Twin of <a class="text-link" href="/fixture/${e(f.category)}--${e(f.twinOf)}">${e(f.twinOf)}</a> · ${e(f.mutation)}</p>` : ''}${f.assessment.sources.length ? `<p>${f.assessment.sources.map((url, i) => `<a class="text-link" href="${e(url)}">Evidence ${i + 1} ↗</a>`).join(' · ')}</p>` : ''}${cells.filter(c => c.row).map(c => `<p><strong>${e(scanners.find(s => s[0] === c.id)?.[1])}</strong> <span class="mono">${e(ranges(c.row!.actual))}</span>${c.row!.spanOutcomes ? ` · ${e(c.row!.spanOutcomes.join(', '))} · leaked ${c.row!.leakedBytes} B · collateral ${c.row!.collateralBytes} B` : ''}${c.base !== undefined ? ` · baseline ${e(baseline?.version)}: <span class="mono">${e(c.base)}</span>` : ''}</p>`).join('')}</td></tr>`;
  }).join('');
  return `<section class="panel"><div class="section-heading"><div><h2>Fixtures</h2><p>${selected.length} fixtures · ${signalCount} with signal${baseline ? ` (changed since ${e(baseline.version)} or not clean)` : ' (not clean)'}. Glyphs: ■ exact · ◩ covered · ◫ overbroad · ◪ partial · □ miss · ○ clean · ● flagged · Δ changed.</p></div><div class="list-controls"><label class="search-label">Find<input id="filter" type="search" placeholder="id, suite, kind, tier, contract…"></label><label class="toggle"><input type="checkbox" id="show-all"> Show all ${selected.length}</label></div></div><div class="table-scroll sticky"><table class="fixtures"><thead><tr><th>Fixture</th><th>Kind · tier</th><th>Spans</th>${scanners.map(([, name]) => `<th>${e(name)}</th>`).join('')}</tr></thead><tbody id="fixture-rows">${rows}</tbody></table></div><div class="list-footer"><p id="no-matches" hidden>No fixtures match.</p><p id="list-count" role="status" aria-live="polite"></p><div class="pager" id="pager" hidden><button type="button" class="button" id="page-prev">← Previous</button><span id="page-label"></span><button type="button" class="button" id="page-next">Next →</button></div></div></section>`;
}

export function stats(selected: Fixture[]) {
  const count = (kind: string) => selected.filter(f => f.assessment.kind === kind && f.assessment.tier !== 'T0');
  const spans = (list: Fixture[]) => list.reduce((n, f) => n + f.expected.filter(s => s.role === 'secret').length, 0);
  const pending = selected.filter(f => f.assessment.tier === 'T0').length;
  return `<section class="stats">${SECTIONS.map(kind => { const list = count(kind); return `<article><span>${e(kinds[kind].title)}</span><strong>${list.length}</strong><small>${kind === 'must-not-flag' ? 'control files' : `files · ${spans(list)} secret spans`} · ${[...new Set(list.map(f => f.assessment.tier))].sort().join(' ') || '—'}</small></article>`; }).join('')}<article><span>Pending</span><strong>${pending}</strong><small>${pending ? `<a class="text-link" href="/pending">T0, unscored →</a>` : 'nothing pending'}</small></article></section>`;
}

export function runLine(run: Run | undefined, reports: Report[]) {
  if (!run) return reports.length ? `<p class="run-line">Reports without a run manifest · newest run ${e(reports.map(r => r.runId).sort().at(-1)?.slice(0, 19) ?? '—')}</p>` : '';
  return `<p class="run-line">Run <span class="mono">${e(run.runId)}</span> · ${e(new Date(run.startedAt).toLocaleString())} · ${run.categories.length} of ${categories.length} suites${run.partial ? ' · <strong>partial</strong>' : ''} · ${Object.entries(run.scannerVersions).map(([id, v]) => `${e(id)} ${e(v)}`).join(' · ')}${baseline ? ` · baseline ${e(baseline.version)}` : ''} · <a class="text-link" href="/results/run.json" download>run.json ↗</a></p>`;
}

export function overview(reports: Report[], run?: Run) {
  return title('Benchmark overview', 'Three questions, measured separately: what leaks, what false-alarms, and what this project’s own policy expects.') + runLine(run, reports) + stats(fixtures) + readingNote() + comparison(fixtures, reports, run) + `<section class="panel"><div class="section-heading"><div><h2>Format evidence · ${registry.detectors.length} detector families</h2><p>Tier is assigned from provider documentation first; tool sources are corroboration only. Counts are fixture instances, not verified credentials.</p></div></div><div class="table-scroll"><table class="compact"><thead><tr><th>Detector</th><th>Tier</th><th>Must redact</th><th>Controls</th><th>Policy</th><th>Pending</th><th>Evidence</th></tr></thead><tbody>${registry.detectors.map(d => {
    const assigned = fixtures.filter(f => f.detectors.includes(d.id));
    const c = contracts[d.id as keyof typeof contracts] as any;
    const n = (kind: string) => assigned.filter(f => f.assessment.kind === kind && f.assessment.tier !== 'T0').length;
    return `<tr><td><a class="text-link" href="/benchmark/${e(d.id)}">${e(d.title)}</a></td><td>${tierBadge(c.tier)}</td><td class="num">${n('must-redact')}</td><td class="num">${n('must-not-flag')}</td><td class="num">${n('policy')}</td><td class="num">${assigned.filter(f => f.assessment.tier === 'T0').length}</td><td class="wrap-cell">${c.providerSource ? `<a class="text-link" href="${e(c.providerSource.url)}">Provider ↗</a> <small>${e(c.providerSource.formatVersion)} · observed ${e(c.providerSource.observedAt)} · ${e(c.providerSource.covers)}</small>` : ''}${c.candidateSource ? `<a class="text-link" href="${e(c.candidateSource.url)}">Provider (prefix only) ↗</a> ` : ''}${(c.corroboration ?? []).map((s: any) => `<a class="text-link" href="${e(s.url)}">${e(s.tool)} ↗</a>`).join(' · ')}${(c.references ?? []).map((url: string) => `<a class="text-link" href="${e(url)}">Reference ↗</a>`).join(' · ')}${c.review ? `<small>${e(c.review)}</small>` : c.companion ? `<small>${e(c.companion)}</small>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div></section><section class="panel"><h2>Cases & regression suites</h2><div class="category-grid">${categories.map(c => `<a class="category-card" href="/benchmark/${e(c.id)}"><strong>${e(c.title)}</strong><small>${e(c.description)}</small></a>`).join('')}</div></section>`;
}

export function fixturePage(f: Fixture, reports: Report[]) {
  const category = categories.find(c => c.id === f.category)!;
  const corpus = corpora[f.category];
  const report = reports.find(r => r.category === f.category);
  const bytes = new TextEncoder().encode(f.content);
  const highlighted = contentSegments(f.content, f.expected).map(s => s.highlighted ? `<mark>${e(s.text)}</mark>` : e(s.text)).join('');
  const followups = knownGaps.issues.filter(issue => issue.fixtures.includes(f.slug));
  const issue = f.issue ?? /#(\d+)/.exec(f.group)?.[1];
  const twins = fixtures.filter(t => t.category === f.category && t.twinOf === f.id);
  const a = f.assessment;
  return title(f.id, f.group, 'FIXTURE / ' + category.title.toUpperCase()) + `<p class="fixture-links"><a class="text-link" href="/benchmark/${e(f.category)}">← ${e(category.title)}</a>${f.detectors.map(id => `<a class="tag text-link" href="/benchmark/${e(id)}">${e(registry.detectors.find(d => d.id === id)?.title)}</a>`).join('')}${issue ? `<a class="text-link" href="https://github.com/redact-secret/redact-secret/issues/${Number(issue)}">Issue #${Number(issue)} ↗</a>` : ''}${followups.map(item => `<a class="text-link" href="${e(item.url)}">Beta.4 #${item.number} ↗</a>`).join('')}</p><div class="notice"><div><strong>${tierBadge(a.tier)} ${e(kindTitle(a.kind))}${a.contract ? ` · ${e(a.contract)}` : ''}</strong><p>${e(a.reason)}</p>${f.twinOf ? `<p>Negative twin of <a class="text-link" href="/fixture/${e(f.category)}--${e(f.twinOf)}">${e(f.twinOf)}</a> · mutation (${e(f.mutationKind)}): ${e(f.mutation)}</p>` : ''}${twins.length ? `<p>Twins: ${twins.map(t => `<a class="text-link" href="/fixture/${e(t.slug)}">${e(t.id)}</a>`).join(', ')}</p>` : ''}${a.sources.length ? `<p>${a.sources.map((url, i) => `<a class="text-link" href="${e(url)}">Evidence ${i + 1} ↗</a>`).join(' · ')}</p>` : ''}<p>${a.tier === 'T0' ? 'Pending review: excluded from comparative scores.' : 'Expectations below are authored from construction and evidence, never from scanner output.'} ${e(corpus.reviewStatus)}. ${e(corpus.scope ?? category.description)}</p></div></div><section class="panel"><h2>Exact synthetic input</h2><p class="intro">${e(f.path)} · ${bytes.length} UTF-8 bytes · highlighted text is the authored secret span. All values are test data.</p><pre class="fixture-content"><code>${highlighted || '<span class="empty">(empty file)</span>'}</code></pre><details data-key="escaped"><summary>Escaped representation (reveals whitespace, CRLF and BOM)</summary><pre class="fixture-content"><code>${e(JSON.stringify(f.content).replace(/\uFEFF/g, '\\uFEFF'))}</code></pre></details><a class="button" id="download-fixture" href="#">↓ Download exact fixture</a></section><section class="panel"><h2>Expected spans and envelopes</h2><p class="intro">UTF-8 bytes, inclusive start and exclusive end. An envelope is the widest range a finding may extend to at no cost; it is authored with a reason and hashed with the corpus.</p>${f.expected.length ? `<div class="table-scroll"><table class="compact"><thead><tr><th>Span</th><th>Role</th><th>Value</th><th>Envelope</th><th>Rationale</th></tr></thead><tbody>${f.expected.map(r => `<tr><td class="mono">[${r.start}, ${r.end})</td><td>${e(r.role)}</td><td class="wrap-cell"><code>${e(new TextDecoder().decode(bytes.slice(r.start, r.end)))}</code></td><td class="wrap-cell">${r.envelope ? `<span class="mono">[${r.envelope.start}, ${r.envelope.end})</span><small>${e(r.envelope.reason)}</small>` : '<small>span itself</small>'}</td><td class="wrap-cell">${e(r.note)}</td></tr>`).join('')}</tbody></table></div>` : `<p>No authored secret spans. ${f.assessment.kind === 'must-not-flag' ? 'Any finding is a false alarm against this control.' : ''}</p>`}</section><section class="panel"><h2>Scanner outcomes</h2>${report ? `<p class="intro">Run <span class="mono">${e(report.runId)}</span> · measured ${e(new Date(report.generatedAt).toLocaleString())} · <a class="text-link" href="/results/${e(f.category)}.json" download>Source report ↗</a></p><div class="table-scroll"><table class="compact"><thead><tr><th>Scanner</th><th>Outcome</th><th>Reported byte ranges</th><th>Bytes</th>${baseline ? `<th>Baseline ${e(baseline.version)}</th>` : ''}</tr></thead><tbody>${report.scanners.map(s => {
    const row = s.status === 'complete' ? s.rows?.find(r => r.id === f.id) : undefined;
    const base = baseline?.rows[f.slug]?.[s.id];
    return `<tr><td>${e(s.name)}<small>${e(s.version)} · ${e(s.mode)}</small></td><td>${glyphs(row, s.status, base)} ${row ? `<small>${e(outcomeCode(row))}</small>` : `<small>${e(s.message ?? s.status)}</small>`}</td><td class="mono">${row ? e(ranges(row.actual)) : '—'}</td><td>${row?.spanOutcomes ? `leaked ${row.leakedBytes} · collateral ${row.collateralBytes}` : '—'}</td>${baseline ? `<td class="mono">${base === undefined ? '—' : e(base)}</td>` : ''}</tr>`;
  }).join('')}</tbody></table></div>` : '<p>No current report for these fixture bytes. Run <code>npm run bench</code>.</p>'}</section>`;
}
