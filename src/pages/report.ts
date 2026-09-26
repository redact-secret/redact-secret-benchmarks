import { escapeHtml as e, figure } from '../components';
import type { Fixture } from '../catalog';
import { currentReports, groupsOf, hasResults, PRODUCT, runIdOf, type BenchData } from './data';
import { boundCell, confidence, metric, type Floors } from './figures';
import { peerObservation, reportHierarchy } from './report-hierarchy';
import { tierTitle } from './rows';
import { runStates } from './states';

export type Level = 'T1' | 'T2' | 'T3';
export const LEVELS: Level[] = ['T1', 'T2', 'T3'];
/** At 360px the segment labels shorten; the full name stays the accessible name. */
const SHORT: Record<Level, string> = { T1: 'Provider', T2: 'Tool', T3: 'Policy' };
export const levelOf = (search: string): Level => { const value = new URLSearchParams(search).get('level'); return LEVELS.includes(value as Level) ? (value as Level) : 'T1'; };
/** Project policy is its own kind: T3 has no must-redact group, by construction. */
export const redactKey = (level: Level) => (level === 'T3' ? 'policy/T3' : `must-redact/${level}`);
export const controlKey = (level: Level) => `must-not-flag/${level}`;

/**
 * Report: three answers, each one Figure. Production reads the published
 * package; a staging run may measure an unreleased candidate (#201), and the
 * eyebrow then names it. Other scanners are reference rows in run order: no
 * sort, no rank, no winner.
 */
export function reportPage(data: BenchData, level: Level, fixtures: Fixture[]): string {
  const version = data.run?.scannerVersions[PRODUCT], runId = runIdOf(data), candidate = data.run?.candidate;
  const measured = `${PRODUCT}${version ? ` ${version}` : ''}${candidate ? ` · candidate ${candidate.sourceCommit.slice(0, 7)} · unreleased` : ''}`;
  const seg = `<div class="seg" role="group" aria-label="Evidence level">${LEVELS.map(l => `<a href="/report${l === 'T1' ? '' : `?level=${l}`}"${l === level ? ' aria-current="true"' : ''} aria-label="${e(tierTitle(l))}"><span class="wide">${e(tierTitle(l))}</span><span class="narrow">${SHORT[l]}</span></a>`).join('')}</div>`;
  const summary = data.summaryProblem ? undefined : data.summary;
  const reports = currentReports(data), scanners = summary?.scanners ?? [];
  const head = `<div class="page-head"><div><p class="eyebrow"${candidate ? ' data-candidate' : ''}>${e(measured.toUpperCase())}</p><h1>What the benchmark shows</h1><div class="meta">${runId ? `<span>Run <b>${e(runId.slice(0, 10))}</b></span>` : ''}${summary ? `<span>Same ${fixtures.length.toLocaleString('en-US')} inputs for ${scanners.length} scanners</span><span>Accounting <b>v${e(summary.accountingVersion)}</b></span>` : ''}<a href="/how-to-read">How to read these numbers</a></div></div>${seg}</div>`;
  if (!hasResults(data) || !summary) return head + runStates(data);

  const floors = summary.accounting as unknown as Floors, mine = groupsOf(summary, PRODUCT);
  const rKey = redactKey(level), cKey = controlKey(level), policy = level === 'T3';
  const figs = `<div class="figs">${[
    figure({ question: policy ? 'Does it leave policy spans readable?' : 'Does it miss real secrets?', ...metric(mine[rKey], 'leak', rKey, floors), href: '#rows', definition: `Leaked span rate. Lower is better. ${confidence(floors)}.${policy ? ' These spans are this project’s redaction policy: a difference here is a difference of opinion, not a defect.' : ''}` }),
    figure({ question: 'Does it flag safe values?', ...metric(mine[cKey], 'alarm', cKey, floors), href: '#rows', definition: `False alarm rate on ${tierTitle(level).toLowerCase()} controls. Lower is better. Few controls keep the bound wide.` }),
    figure({ question: 'Does it tell near-twins apart?', ...metric(mine[rKey], 'twins', rKey, floors), href: '#rows', definition: 'Twin discrimination: the secret is covered and its one-character fake stays quiet. Higher is better.' }),
  ].join('')}</div>`;

  const others = scanners.filter(s => s.id !== PRODUCT);
  const peers = others.length ? `<section class="section peers"><p class="eyebrow">OTHER SCANNERS ON THE SAME INPUTS</p><p class="small">Reference only. Not a ranking: scanners differ in scope and defaults. Listed in run order.</p><div class="tbl"><table><thead><tr><th scope="col">Scanner</th><th scope="col" class="num">Leaked, at most</th><th scope="col" class="num">False alarms, at most</th><th scope="col" class="num">Twins, at least</th></tr></thead><tbody>${others.map(s => { const g = groupsOf(summary, s.id); return `<tr><td>${e(s.id)} ${e(s.version ?? '')}${peerObservation(s.id, reports)}</td><td class="num">${boundCell(g[rKey], 'leak', rKey, floors)}</td><td class="num">${boundCell(g[cKey], 'alarm', cKey, floors)}</td><td class="num">${boundCell(g[rKey], 'twins', rKey, floors)}</td></tr>`; }).join('')}</tbody></table></div></section>` : '';

  const selected = fixtures.filter(f => f.assessment.tier === level && (policy ? f.assessment.kind !== 'must-redact' : f.assessment.kind !== 'policy'));
  return head + figs + runStates(data) + peers + reportHierarchy(selected, reports, `Rows behind these numbers · ${tierTitle(level)}`);
}
