import knownGaps from '../../benchmarks/known-gaps.json';
import { categories, registry, fixtures, corpora, type Fixture } from '../catalog';
import { summarize, contentSegments } from '../model.mjs';
import { cohorts, contracts } from '../../benchmarks/lib/cohorts.mjs';
import { escape as e, type Report, type Row } from '../types';

export const title = (label: string, description: string, eyebrow = 'BENCHMARK LAB') => `<div class="eyebrow">${e(eyebrow)}</div><h1>${e(label)}<span>.</span></h1><p class="intro">${e(description)}</p>`;
export const ranges = (items: {start: number; end: number}[]) => items.map(r => `[${r.start}, ${r.end})`).join(' · ') || 'None';
const cohortTitle = (id: string) => cohorts[id as keyof typeof cohorts]?.title ?? 'Format review pending';
export function stats(selected: Fixture[]) {
  return `<section class="stats">${Object.entries(cohorts).map(([id, c]) => `<article><span>${e(c.title)}</span><strong>${selected.filter(f => f.assessment.cohort === id).length}</strong><small>Fixture instances · ${id === 'unreviewed' ? 'unscored' : 'separate measurement purpose'}</small></article>`).join('')}</section>`;
}

export function comparison(selected: Fixture[], reports: Report[]) {
  const summaries = summarize(selected, reports.filter(r => selected.some(f => f.category === r.category)));
  return `<div class="notice"><div><strong>Results are separated by measurement purpose</strong><p>No combined score or product ranking. Format samples, masking policy, malformed/example controls and pending review never share a denominator. A format-correct miss remains visible, even when a scanner has no matching detector.</p></div></div>` + Object.entries(cohorts).map(([id, cohort]) => {
    const members = selected.filter(f => f.assessment.cohort === id);
    const groups = summaries.filter(s => s.cohort === id);
    const unscored = id === 'unreviewed';
    return `<section class="panel" data-cohort="${id}"><h2>${e(cohort.title)}</h2><p class="intro">${e(cohort.description)}</p><p>${members.length} fixture instances · ${members.reduce((n, f) => n + f.expected.length, 0)} authored expected spans</p>${groups.length ? `<div class="table-scroll"><table><thead><tr><th>Scanner / version</th><th>Measured files</th>${unscored ? '<th>Observation only</th>' : '<th>Contained / expected</th><th>Broader only</th><th>Exact matches / extra / unmatched</th><th>Clean controls</th>'}</tr></thead><tbody>${groups.map(s => `<tr><td class="wrap-cell"><strong>${e(s.name)}</strong><small>${e(s.version ?? 'Version unavailable')} · ${e(s.mode)}</small><small>${s.sources.map((source: string) => `<a class="text-link" href="/benchmark/${e(source)}">${e(source)}</a>`).join(' · ')}</small><small>Corpus review: ${e([...new Set(s.reviews)].join('; '))}</small><small>Run statuses: ${e([...new Set(s.statuses)].join(', '))}</small><details><summary>Measurement provenance</summary><small>Lock: ${e(s.lockHash?.slice(0, 12))} · ${e(s.matching)}</small></details></td><td>${s.rows.length} / ${s.selectedCount}</td>${unscored ? '<td>Unscored — inspect raw ranges below</td>' : `<td>${s.rows.length ? `${s.contained} / ${s.rows.reduce((n: number, r: Row) => n + r.expected.length, 0)}` : '—'}</td><td>${s.rows.length ? s.broader : '—'}</td><td>${s.rows.length ? `${s.tp} / ${s.fp} / ${s.fn}` : '—'}</td><td>${s.rows.length ? s.tn : '—'}</td>`}</tr>`).join('')}</tbody></table></div>` : `<p class="empty">${members.length ? 'No current measurements. Run npm run bench.' : 'No reviewed fixtures in this cohort. No coverage claim.'}</p>`}<p class="footnote">${id === 'common-format' ? 'Positive format samples only: no balanced precision/F1 claim. Containment is detection evidence, not safe redaction; exact range disagreement is shown separately. Variants and repeated contexts are not independent provider coverage.' : 'Authored expectations describe this project’s policy. A mismatch does not by itself establish a scanner defect.'}</p></section>`;
  }).join('');
}

function outcome(row: Row | undefined, status: string) {
  if (!row) return e(status);
  if (row.assessment.cohort === 'unreviewed') return `<span class="outcome">Unscored observation</span><small>${row.actual.length} reported range(s)</small>`;
  const differs = row.fp || row.fn;
  return `<span class="outcome ${differs ? 'miss' : 'pass'}">${differs ? `${row.fp} extra / ${row.fn} unmatched` : 'Exact match'}</span><small>Contained: ${row.contained}/${row.expected.length} · broader only: ${row.broader}</small>`;
}

export function fixtureList(selected: Fixture[], reports: Report[]) {
  const scanners = [...new Map(reports.flatMap(r => r.scanners.map(s => [s.id, s.name] as const))).entries()];
  return `<section class="panel"><div class="section-heading"><div><h2>Fixtures</h2><p>Classification, evidence and original expectations are inspectable for every case.</p></div><label class="search-label">Find a fixture<input id="filter" type="search" placeholder="Name, cohort, group or source case…"></label></div><div class="table-scroll"><table><thead><tr><th>Fixture / source case</th><th>Measurement purpose</th><th>Authored expectation</th>${scanners.map(([,name]) => `<th>${e(name)}</th>`).join('')}</tr></thead><tbody>${selected.map(f => `<tr data-search="${e(`${f.id} ${f.group} ${f.category} ${f.assessment.cohort} ${cohortTitle(f.assessment.cohort)}`.toLowerCase())}"><td><a class="text-link" href="/fixture/${e(f.slug)}">${e(f.id)} ↗</a><small>${e(f.category)} · ${e(f.group)}</small></td><td class="wrap-cell">${e(cohortTitle(f.assessment.cohort))}<small>${e(f.assessment.reason)}</small></td><td>${f.expected.length ? `${f.expected.length} expected span(s)` : 'Negative control'}</td>${scanners.map(([id]) => {
    const scanner = reports.find(r => r.category === f.category)?.scanners.find(s => s.id === id);
    const row = scanner?.status === 'complete' ? scanner.rows?.find(r => r.id === f.id) : undefined;
    return `<td>${outcome(row, scanner?.status ?? 'Not measured')}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table><p id="no-matches" ${selected.length ? 'hidden' : ''}>${selected.length ? 'No fixtures match this filter.' : 'No fixtures assigned yet. This detector is not covered.'}</p></div></section>`;
}

export function overview(reports: Report[]) {
  return title('Benchmark overview', 'Source-reviewed formats and project-specific masking expectations, measured separately.') + stats(fixtures) + comparison(fixtures, reports) + `<section class="panel"><h2>Format audit · all ${registry.detectors.length} detector families</h2><p>Counts describe audited inputs, not verified credentials. Open a detector to inspect cohort results and every fixture. Pending formats are explicit gaps, never inferred from related provider names.</p><div class="table-scroll"><table><thead><tr><th>Detector</th>${Object.values(cohorts).map(c => `<th>${e(c.title)}</th>`).join('')}<th>Evidence / limits</th></tr></thead><tbody>${registry.detectors.map(d => {
    const assigned = fixtures.filter(f => f.detectors.includes(d.id));
    const contract = contracts[d.id as keyof typeof contracts];
    return `<tr><td><a class="text-link" href="/benchmark/${e(d.id)}">${e(d.title)} ↗</a></td>${Object.keys(cohorts).map(id => `<td>${assigned.filter(f => f.assessment.cohort === id).length}</td>`).join('')}<td class="wrap-cell">${e('review' in contract ? contract.review : 'companion' in contract ? contract.companion : 'Pinned lexical format; no issuance, checksum or live validation.')}${contract.sources.map((url: string, i: number) => `<small><a class="text-link" href="${e(url)}">Source ${i + 1} ↗</a></small>`).join('')}</td></tr>`;
  }).join('')}</tbody></table></div></section><section class="panel"><h2>Cases & regression suites</h2><div class="category-grid">${categories.map(c => `<a class="category-card" href="/benchmark/${e(c.id)}"><strong>${e(c.title)} ↗</strong><small>${e(c.description)}</small></a>`).join('')}</div></section>`;
}

export function fixturePage(f: Fixture, reports: Report[]) {
  const category = categories.find(c => c.id === f.category)!;
  const corpus = corpora[f.category];
  const report = reports.find(r => r.category === f.category);
  const bytes = new TextEncoder().encode(f.content);
  const highlighted = contentSegments(f.content, f.expected).map(s => s.highlighted ? `<mark>${e(s.text)}</mark>` : e(s.text)).join('');
  const followups = knownGaps.issues.filter(issue => issue.fixtures.includes(f.slug));
  const issue = f.issue ?? /#(\d+)/.exec(f.group)?.[1];
  return title(f.id, f.group, 'FIXTURE / '+category.title.toUpperCase()) + `<p class="fixture-links"><a class="text-link" href="/benchmark/${e(f.category)}">← ${e(category.title)}</a>${f.detectors.map(id => `<a class="tag text-link" href="/benchmark/${e(id)}">${e(registry.detectors.find(d => d.id === id)?.title)}</a>`).join('')}${issue ? `<a class="text-link" href="https://github.com/redact-secret/redact-secret/issues/${Number(issue)}">Issue #${Number(issue)} ↗</a>` : ''}${followups.map(item => `<a class="text-link" href="${e(item.url)}">Beta.4 #${item.number} ↗</a>`).join('')}</p><div class="notice"><div><strong>${e(cohortTitle(f.assessment.cohort))}</strong><p>${e(f.assessment.reason)}</p>${f.assessment.sources.map((url, i) => `<a class="text-link" href="${e(url)}">Format evidence ${i + 1} ↗</a> `).join('')}<p>${f.assessment.cohort === 'unreviewed' ? 'Excluded from comparative scores.' : 'Expectations below are authored for this measurement purpose.'}</p><p>${e(corpus.reviewStatus)}. ${e(corpus.scope ?? category.description)}</p></div></div><section class="panel"><h2>Exact synthetic input</h2><p class="intro">${e(f.path)} · ${bytes.length} UTF-8 bytes · highlighted text is the authored expected span. All values are test data.</p><pre class="fixture-content"><code>${highlighted || '<span class="empty">(empty file)</span>'}</code></pre><details><summary>Escaped representation (reveals whitespace, CRLF and BOM)</summary><pre class="fixture-content"><code>${e(JSON.stringify(f.content).replace(/\uFEFF/g, '\\uFEFF'))}</code></pre></details><a class="button" id="download-fixture" href="#">↓ Download exact fixture</a></section><section class="panel"><h2>Expected ranges</h2><p class="intro">UTF-8 bytes, inclusive start and exclusive end. Historical regression expectations are preserved even when a fixture is malformed or pending review.</p>${f.expected.length ? `<div class="table-scroll"><table><thead><tr><th>Range</th><th>Expected value</th><th>Rationale</th></tr></thead><tbody>${f.expected.map(r => `<tr><td>[${r.start}, ${r.end})</td><td class="wrap-cell"><code>${e(new TextDecoder().decode(bytes.slice(r.start, r.end)))}</code></td><td class="wrap-cell">${e(r.note)}</td></tr>`).join('')}</tbody></table></div>` : '<p>No authored secret spans. Findings are disagreements with this control’s policy.</p>'}</section><section class="panel"><h2>Scanner outcomes</h2>${report ? `<p class="intro">Measured ${e(new Date(report.generatedAt).toLocaleString())} · <a class="text-link" href="/results/${e(f.category)}.json" download>Source report ↗</a></p><div class="table-scroll"><table><thead><tr><th>Scanner</th><th>Outcome</th><th>Reported byte ranges</th></tr></thead><tbody>${report.scanners.map(s => {
    const row = s.status === 'complete' ? s.rows?.find(r => r.id === f.id) : undefined;
    return `<tr><td>${e(s.name)}<small>${e(s.version)} · ${e(s.mode)}</small></td><td>${outcome(row, s.status)}<small>${e(s.message ?? '')}</small></td><td>${row ? e(ranges(row.actual)) : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>` : '<p>No current report for these fixture bytes. Run <code>npm run bench</code>.</p>'}</section>`;
}
