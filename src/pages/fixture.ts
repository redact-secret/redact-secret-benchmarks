import rawKnownGaps from '../../benchmarks/known-gaps.json';
import { validateKnownGaps, type KnownGaps } from '../../benchmarks/lib/promotion';
import { actionEmptyState, byteLines, byteView, describeSpans, escapeHtml as e, evidenceCrumb, laneMarks, redactionLane, statusMark, type ByteLine, type LaneMark } from '../components';
import { baseline, categories, corpora, fixtures, registry, type Fixture } from '../catalog';
import { outcomeCode } from '../model.mjs';
import type { Report } from '../types';
import { kindTitle, rowMarks, tierTitle } from './rows';
import { fixtureFamilyNavigation, fixtureProjectionLinks } from './exploration';

const knownGaps = validateKnownGaps(rawKnownGaps as unknown as KnownGaps);
// 'v0.1.0-beta.4' reads as 'Beta.4' beside an issue number.
const milestone = (knownGaps.milestone.split('-').pop() ?? knownGaps.milestone).replace(/^./, c => c.toUpperCase());
const ranges = (items: { start: number; end: number }[]) => items.map(r => `[${r.start}, ${r.end})`).join(' · ') || 'none';
const touches = (line: ByteLine, r: { start: number; end: number }) => r.start < line.end && r.end > line.start;

/**
 * Evidence: what had to be redacted, how far a redaction may reach, and what
 * each scanner actually covered. Green = secret bytes. Ink underline =
 * envelope. Black bar = the scanner's finding; hatched = partly exposed;
 * dashed empty frame = missed.
 */
export function fixturePage(f: Fixture, report: Report | undefined, problem?: string): string {
  const category = categories.find(c => c.id === f.category)!, corpus = corpora[f.category], a = f.assessment;
  const bytes = new TextEncoder().encode(f.content);
  const secrets = f.expected.filter(s => (s.role ?? 'secret') === 'secret');
  const envelopes = f.expected.flatMap(s => (s.envelope ? [s.envelope] : []));
  const crumb = fixtureFamilyNavigation(f);
  const head = `${crumb}<div class="page-head"><div><p class="eyebrow">${e(f.group.toUpperCase())}</p><h1 class="h1-evidence">${e(f.id)}</h1><div class="meta"><span>${e(kindTitle(a.kind))} · ${e(tierTitle(a.tier))}</span><span class="mono">${e(f.path)}</span><span>${bytes.length.toLocaleString('en-US')} UTF-8 bytes, [start, end)</span>${f.detectors.map(id => `<a href="/coverage/detectors/${e(id)}">${e(registry.detectors.find(d => d.id === id)?.title ?? id)}</a>`).join('')}</div></div></div>${fixtureProjectionLinks(f)}`;

  const scanners = (report?.scanners ?? []).map(scanner => {
    const row = scanner.status === 'complete' ? scanner.rows?.find(r => r.id === f.id) : undefined;
    const marks: LaneMark[] = row ? laneMarks(row.expected.filter(s => (s.role ?? 'secret') === 'secret'), row.spanOutcomes, row.actual) : [];
    return { scanner, row, marks, verdict: rowMarks(row, scanner.status, true) };
  });
  const lines = byteLines(f.content);
  // A line is active when an expectation or any scanner's mark touches it. Every active line carries every scanner's
  // lane, so the lanes read as one aligned block; a quiet control file has no active line, so its first line stands in.
  const isActive = (line: ByteLine) => f.expected.some(s => touches(line, s)) || envelopes.some(r => touches(line, r)) || scanners.some(sc => sc.marks.some(m => touches(line, m)));
  const active = new Set(lines.filter(isActive).map(l => l.index));
  if (!active.size && lines.length) active.add(0);
  const firstActive = Math.min(...active);
  const describe = (marks: LaneMark[], line: ByteLine) => marks.filter(m => touches(line, m)).map(m => `${m.shape === 'outline' ? 'missed' : m.shape === 'hatch' ? 'partly covered' : 'covered'} bytes ${m.start}–${m.end}`).join('; ') || 'nothing covered';
  const grid = lines.map(line => {
    const lanes = active.has(line.index) ? scanners.map(({ scanner, marks, verdict }) => `<span class="lb">${e(scanner.name)}</span>${redactionLane({ content: f.content, marks, line, label: `${scanner.name}, line ${line.index + 1}: ${describe(marks, line)}` })}<span>${line.index === firstActive ? verdict : ''}</span>`).join('') : '';
    return `<span class="lb line-no" aria-label="Line ${line.index + 1}">${line.index + 1}</span>${byteView({ content: f.content, spans: f.expected, envelopes, line })}<span></span>${lanes}${lanes ? '<span class="gap"></span>' : ''}`;
  }).join('');
  const caption = secrets.length
    ? `Secret bytes ${e(describeSpans(secrets))}.${f.expected.filter(s => s.envelope).map(s => ` Envelope ${s.envelope!.start}–${s.envelope!.end}: ${e((s.envelope!.reason ?? 'a finding may extend this far at no cost').replace(/\.\s*$/, ''))}.`).join('')}`
    : `No authored secret spans.${a.kind === 'must-not-flag' ? ' Any finding on this file is a false alarm.' : ''}`;
  const legend = `<ul class="legend" aria-label="Legend"><li><span class="key sec"></span>Secret bytes, must be redacted</li><li><span class="key env"></span>Envelope, may be redacted</li><li><span class="key fill"></span>Scanner redacted</li><li><span class="key hatch"></span>Partly exposed</li><li><span class="key outline"></span>Missed</li></ul>`;
  const evidence = `<div class="bytes-scroll" tabindex="0" role="region" aria-label="Fixture bytes and scanner redactions"><div class="bytes-grid">${grid}</div></div><p class="small" style="margin-top:var(--space-3)">${caption} All values are synthetic test data.</p>${legend}`;

  const twins = fixtures.filter(t => t.category === f.category && t.twinOf === f.id);
  const issue = f.issue ?? /#(\d+)/.exec(f.group)?.[1], followUps = knownGaps.issues.filter(item => item.fixtures.includes(f.slug));
  const why = `<div class="col"><p class="eyebrow">WHY THIS EXPECTATION</p><dl class="kv"><dt>Kind</dt><dd>${e(kindTitle(a.kind))}</dd><dt>Evidence</dt><dd>${e(a.tier)} · ${e(tierTitle(a.tier))}${a.tier === 'T0' ? ` ${statusMark('withheld', 'Unscored')}` : ''}</dd>${a.contract ? `<dt>Contract</dt><dd><code>${e(a.contract)}</code></dd>` : ''}${f.twinOf ? `<dt>Twin of</dt><dd><a href="/fixture/${e(f.category)}--${e(f.twinOf)}">${e(f.twinOf)}</a><small class="muted"> ${e(f.mutationKind ?? '')}: ${e(f.mutation ?? '')}</small></dd>` : ''}${twins.length ? `<dt>Negative twins</dt><dd>${twins.map(t => `<a href="/fixture/${e(t.slug)}">${e(t.id)}</a>`).join(', ')}</dd>` : ''}<dt>Reason</dt><dd>${e(a.reason)}</dd>${a.sources.length ? `<dt>Sources</dt><dd>${a.sources.map((url, i) => `<a href="${e(url)}">Evidence ${i + 1}</a>`).join(' · ')}</dd>` : ''}${issue || followUps.length ? `<dt>Issues</dt><dd>${issue ? `<a href="https://github.com/redact-secret/redact-secret/issues/${Number(issue)}">Issue #${Number(issue)}</a> ` : ''}${followUps.map(item => `<a href="${e(item.url)}">${e(milestone)} #${item.number}</a>`).join(' ')}</dd>` : ''}<dt>Review</dt><dd>${a.tier === 'T0' ? 'Pending review: excluded from comparative scores.' : 'Authored from construction and evidence, never from scanner output.'} ${e(corpus.reviewStatus)}.</dd></dl></div>`;
  const reproduce = `<div class="col"><p class="eyebrow">REPRODUCE</p><pre class="cmd"><code>npm run bench -- --category=${e(f.category)}</code></pre><p><a class="btn" id="download-fixture" href="#" download>Download exact bytes</a></p><details data-key="escaped"><summary>Escaped representation</summary><pre class="snippet" tabindex="0">${e(JSON.stringify(f.content).replace(/\uFEFF/g, '\\uFEFF'))}</pre></details></div>`;

  const expected = f.expected.length ? `<section class="section"><h2 class="h2-compact">Expected spans and envelopes</h2><p class="small">An envelope is the widest range a finding may reach at no cost. It is authored with a reason, hashed with the corpus and never widened in response to a scanner.</p><div class="tbl wide" tabindex="0" role="region" aria-label="Expected spans"><table><thead><tr><th scope="col">Span</th><th scope="col">Role</th><th scope="col">Value</th><th scope="col">Envelope</th><th scope="col">Rationale</th></tr></thead><tbody>${f.expected.map(r => `<tr><td class="mono nowrap">[${r.start}, ${r.end})</td><td class="nowrap">${e(r.role ?? 'secret')}</td><td><code>${e(new TextDecoder().decode(bytes.slice(r.start, r.end)))}</code></td><td>${r.envelope ? `<span class="mono">[${r.envelope.start}, ${r.envelope.end})</span><small>${e(r.envelope.reason)}</small>` : '<small>the span itself</small>'}</td><td>${e(r.note)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
  const reported = report
    ? `<section class="section"><h2 class="h2-compact">Reported ranges</h2><p class="small">Run <span class="mono">${e(report.runId)}</span> · <a href="/results/${e(f.category)}.json" download>Source report</a>. Ranges and counts are exported; matched values and raw scanner output never are.</p><div class="tbl wide" tabindex="0" role="region" aria-label="Reported ranges"><table><thead><tr><th scope="col">Scanner</th><th scope="col">Outcome</th><th scope="col">Reported byte ranges</th><th scope="col">Bytes</th>${baseline ? `<th scope="col">Baseline ${e(baseline.version)}</th>` : ''}</tr></thead><tbody>${scanners.map(({ scanner, row, verdict }) => { const base = baseline?.rows[f.slug]?.[scanner.id]; return `<tr><td>${e(scanner.name)}<small>${e(scanner.version ?? 'version unavailable')} · ${e(scanner.mode)}</small></td><td>${verdict}${row ? `<small class="mono">${e(outcomeCode(row))}</small>` : `<small>${e(scanner.message ?? scanner.status)}</small>`}</td><td class="mono">${row ? e(ranges(row.actual)) : '—'}</td><td>${row?.spanOutcomes ? `leaked ${row.leakedBytes} · outside envelope ${row.collateralBytes}` : '—'}</td>${baseline ? `<td class="mono">${base === undefined ? '—' : e(base)}${base !== undefined && row && base !== outcomeCode(row) ? ` ${statusMark('info', 'Changed')}` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div></section>`
    : actionEmptyState({ title: problem && problem !== 'Missing or unreadable report' ? 'The report for these bytes is left out' : 'No scanner results for these bytes', body: problem && problem !== 'Missing or unreadable report' ? `${e(problem)}. The expectation above stands on its own; lanes appear once a report re-validates against these bytes.` : 'The expectation above stands on its own. Run this suite to see what each scanner covers.', command: `npm run bench -- --category=${f.category}` });
  return `${head}${evidence}<div class="side">${why}${reproduce}</div>${expected}${reported}`;
}
