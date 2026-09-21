import { actionEmptyState, escapeHtml as e, statusMark, type StatusKind } from '../components';
import { tiers } from '../../benchmarks/lib/assessment.ts';
import { statusCriteria } from '../../benchmarks/support/status.ts';
import type { SupportMatrixEntry } from '../../benchmarks/support/matrix.ts';
import type { SupportStatus } from '../../benchmarks/support/status.ts';
import { orderedFamilies, providerName, statusesOf, SUPPORT_STATUSES, type SupportMatrixFile } from '../support-model';

/**
 * Support status per provider x credential family (issue #50, A9). Every
 * status and every reason on this page is read from the generated
 * `support-matrix.json`; this module only says what a status means to a reader
 * who has never opened the qualification profile, and where its evidence is.
 * Changing a status is a matrix change, never an edit here.
 */
export interface SupportStatusCopy {
  kind: StatusKind;
  /** Always the status id as the reader sees it; the UI never invents a word for a status. */
  word: string;
  /** The row gloss: short enough to sit beside 72 families without shouting. */
  short: string;
  /** One sentence for a reader who has not read the qualification profile. */
  meaning: string;
  /** The profile's own words for why this status exists, from `status-criteria.json`. */
  rationale: string;
}

export const SUPPORT_STATUS_COPY: Record<SupportStatus, SupportStatusCopy> = {
  stable: {
    kind: 'pass', word: 'Stable', short: 'every floor met',
    meaning: 'Detected, and every evidence floor in the profile is met — the floors are listed below.',
    rationale: statusCriteria.stable.positiveContract.rationale,
  },
  provisional: {
    kind: 'unstable', word: 'Provisional', short: 'evidence incomplete',
    meaning: 'Useful today, but the evidence behind it is incomplete. This is not “almost stable”: it records a gap, and each family below names the floors its evidence has not cleared.',
    rationale: statusCriteria.provisional.rationale,
  },
  pending: {
    kind: 'not-measured', word: 'Pending', short: 'nothing measured yet',
    meaning: 'Nothing is claimed either way. No positive fixture has cleared review, so no statement about detection is available for this family.',
    rationale: statusCriteria.pending.rationale,
  },
  unsupported: {
    kind: 'withheld', word: 'Unsupported', short: 'not detected, on purpose',
    meaning: 'Not detected, and the reason is recorded, so the absence reads as a decision rather than an oversight.',
    rationale: statusCriteria.unsupported.rationale,
  },
};

export type SupportFilter = SupportStatus | 'all';
export const supportFilterOf = (search: string): SupportFilter => {
  const value = new URLSearchParams(search).get('status');
  return SUPPORT_STATUSES.includes(value as SupportStatus) ? (value as SupportStatus) : 'all';
};

const n = (value: number) => value.toLocaleString('en-US');
const families = (count: number) => `${n(count)} ${count === 1 ? 'family' : 'families'}`;
const tierTitle = (tier: string) => (tiers as Record<string, { title: string }>)[tier]?.title ?? tier;

/** The `stable` floors, read from `status-criteria.json`: no threshold is repeated here. */
function floors(): string {
  const s = statusCriteria.stable;
  const rows: [string, string, string][] = [
    ['Positive contract', 'Provider-documented (T1)', s.positiveContract.rationale],
    ['Twin pairs', `at least ${n(s.minimumTwinPairs.value)}`, s.minimumTwinPairs.rationale],
    ['Twin failures', `at most ${n(s.twinFailures.value)}`, s.twinFailures.rationale],
    ['Benign controls', `at least ${n(s.benign.minimumCases.value)}`, s.benign.minimumCases.rationale],
    ['False alarms on benign controls', `at most ${n(s.benign.falseAlarms.value)}`, s.benign.falseAlarms.rationale],
    ['Metamorphic critical failures', `at most ${n(s.metamorphic.criticalFailures.value)}`, s.metamorphic.criticalFailures.rationale],
    ['Unresolved critical mutation findings', `at most ${n(s.mutation.unresolvedCritical.value)}`, s.mutation.unresolvedCritical.rationale],
    ['Unresolved differential contract disagreements', `at most ${n(s.differential.unresolvedContractDisagreements.value)}`, s.differential.unresolvedContractDisagreements.rationale],
  ];
  return `<details data-key="support:floors"><summary><small>The floors a family clears to read ${e(SUPPORT_STATUS_COPY.stable.word)}, from <code>benchmarks/support/status-criteria.json</code></small></summary>
    <div class="tbl"><table><thead><tr><th scope="col">Floor</th><th scope="col">Requires</th><th scope="col">Why</th></tr></thead><tbody>${rows.map(([label, requires, why]) => `<tr><td>${e(label)}</td><td>${e(requires)}</td><td><small>${e(why)}</small></td></tr>`).join('')}</tbody></table></div></details>`;
}

function legend(matrix: SupportMatrixFile): string {
  return `<section class="section"><h2 class="h2-compact">What each status means</h2>
    <p class="small">Each status below is decided from evidence by <code>classifyFamilySupport</code> and carried into the matrix verbatim; none of it is typed into this page. A family's status moves when its evidence moves.</p>
    ${statusesOf(matrix).map(status => {
      const copy = SUPPORT_STATUS_COPY[status];
      return `<div class="chg" data-support-status="${e(status)}">${statusMark(copy.kind, copy.word)}<span>${e(copy.meaning)}<small>${e(copy.rationale)}</small></span><span class="d">${families(matrix.distribution[status])}</span></div>`;
    }).join('')}
    <div style="margin-top:var(--space-4)">${floors()}</div></section>`;
}

function filterBar(matrix: SupportMatrixFile, filter: SupportFilter): string {
  const link = (href: string, label: string, current: boolean, status?: SupportStatus) =>
    `<a href="${e(href)}"${status ? ` data-support-status="${e(status)}"` : ''}${current ? ' aria-current="true"' : ''}>${e(label)}</a>`;
  return `<div class="seg" role="group" aria-label="Filter families by support status">${link('/support', `All ${n(matrix.familyCount)}`, filter === 'all')}${statusesOf(matrix).map(status => link(`/support?status=${status}`, `${SUPPORT_STATUS_COPY[status].word} ${n(matrix.distribution[status])}`, filter === status, status)).join('')}</div>`;
}

/** Tier, provider source, corroboration, twin coverage and unresolved items — the evidence a status was decided from. */
function evidence(entry: SupportMatrixEntry): string {
  if (!entry.detectors.length) return '<small>No detector is registered for this family, so there is no evidence to inspect.</small>';
  const source = entry.providerSource;
  const twin = entry.twinCoverage;
  const items = entry.unresolvedCriticalItems;
  const lines = [
    `<b>Detectors</b> ${entry.detectors.map(id => `<a href="/coverage/${e(id)}">${e(id)}</a>`).join(' · ')}`,
    `<b>Format evidence</b> ${entry.evidenceTier ? `${e(entry.evidenceTier)} · ${e(tierTitle(entry.evidenceTier))}` : 'none recorded'}`,
    `<b>Provider source</b> ${source ? `<a href="${e(source.url)}" rel="noreferrer">${e(source.formatVersion)}</a> <span class="muted">observed ${e(source.observedAt)} · ${e(source.covers)}</span>` : 'none recorded'}`,
    `<b>Corroborating scanners</b> ${entry.corroboratingScanners.length ? entry.corroboratingScanners.map(e).join(' · ') : 'none recorded'}`,
    `<b>Twin coverage</b> ${!twin ? 'none recorded' : twin.unprobeable ? `un-probeable · ${e(twin.unprobeable.reason)} <span class="muted">checked ${e(twin.unprobeable.observedAt)}</span>` : `${n(twin.pairs)} pair${twin.pairs === 1 ? '' : 's'} · ${n(twin.failures)} failure${twin.failures === 1 ? '' : 's'}`}`,
    `<b>Unresolved critical items</b> ${items ? `metamorphic ${n(items.metamorphic)} · mutation ${n(items.mutation)} · differential ${n(items.differential)}` : 'none recorded'}`,
  ];
  return `<details data-key="support:${e(entry.family)}"><summary><small>Evidence</small></summary><ul class="small">${lines.map(line => `<li>${line}</li>`).join('')}</ul></details>`;
}

function familyRow(entry: SupportMatrixEntry): string {
  const copy = SUPPORT_STATUS_COPY[entry.status];
  const reasons = entry.reason ? entry.reason.split(' | ') : [];
  return `<tr data-support-status="${e(entry.status)}" data-family="${e(entry.family)}">
    <td>${e(providerName(entry.provider))}</td>
    <td>${e(entry.familyName)}<small class="mono">${e(entry.family)}</small></td>
    <td>${statusMark(copy.kind, copy.word)}<small>${e(copy.short)}</small></td>
    <td>${reasons.length ? `<ul class="small">${reasons.map(reason => `<li>${e(reason)}</li>`).join('')}</ul>` : '<small>No unmet floor is recorded.</small>'}</td>
    <td>${evidence(entry)}</td></tr>`;
}

export function supportPage(matrix: SupportMatrixFile | null, problem: string | null, filter: SupportFilter = 'all'): string {
  const head = (meta: string) => `<div class="page-head"><div><h1>Support status by family</h1><div class="meta">${meta}</div></div>${matrix ? filterBar(matrix, filter) : ''}</div>`;
  if (!matrix) {
    return `${head('<span>Generated per provider × credential family, never authored here</span>')}
      ${actionEmptyState({
        title: problem ?? 'No support matrix published',
        body: 'This page reads <code>public/results/support-matrix-v1.json</code>, the artifact generated from evidence. No status is written into the site, so until that file is published there is nothing to show.',
        command: 'npm run eval:classify\nnpm run eval:matrix\nnpm run eval:publish:matrix',
        mark: statusMark('not-measured'),
      })}`;
  }
  const source = matrix.sourceReport;
  const meta = `<span><b>${n(matrix.familyCount)}</b> families across <b>${n(matrix.providerCount)}</b> providers</span>
    <span>Evidence run <b>${e(source.runId.slice(0, 8))}</b> · ${e(source.generatedAt.slice(0, 10))}</span>
    <span>Revision <code>${e(source.revision.slice(0, 12))}</code></span>
    ${source.dirty === null ? `<span>${statusMark('not-measured', 'Working tree not recorded')}</span>` : source.dirty ? `<span>${statusMark('review', 'Uncommitted changes in the run')}</span>` : ''}`;
  const shown = orderedFamilies(matrix, filter);
  const table = shown.length
    ? `<div class="tbl wide"><table><thead><tr><th scope="col">Provider</th><th scope="col">Credential family</th><th scope="col">Status</th><th scope="col">Why this status</th><th scope="col">Evidence</th></tr></thead><tbody>${shown.map(familyRow).join('')}</tbody></table></div>`
    : `<p class="small">No family carries this status in the published matrix.</p>`;
  return `${head(meta)}
    <p class="prose small" style="margin-bottom:var(--space-4)">Every provider × credential family in the taxonomy is listed, including the ones nothing here detects: an unsupported family is visible with its recorded reason rather than left out. This repository measures and records — a status is the output of the published profile run against evidence, not a claim about the product.</p>
    ${legend(matrix)}
    <section class="section"><h2 class="h2-compact">Families</h2><p class="small">${n(shown.length)} of ${families(matrix.familyCount)}${filter === 'all' ? '' : `, filtered to ${e(SUPPORT_STATUS_COPY[filter].word)}`}. Open a family's evidence to see the tier, the provider source it was read from, and the twin coverage behind its status.</p>${table}</section>`;
}
