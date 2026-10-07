import { actionEmptyState, escapeHtml as e, statusMark, type StatusKind } from '../components';
import { DOSSIER_VERDICTS, PROVIDER_STAGES, type DossierVerdict, type ProviderDossierFamily, type ProviderDossiersFile, type ProviderStage } from '../providers-model';

/**
 * Providers roadmap (#478): where each provider's credential families stand
 * before and after measurement. Every stage, verdict, blocker and date on this
 * page is read from the generated `provider-dossiers-v1.json`; this module only
 * says what a stage means. It never states when a family will be supported: the
 * answer to "when" is a stage and a blocker, and a stage moves when its evidence
 * moves, in a dossier or the corpus, never by an edit here.
 */
export const PROVIDER_STAGE_COPY: Record<ProviderStage, { word: string; meaning: string }> = {
  researched: { word: 'Researched', meaning: 'A research verdict is recorded in the provider dossier. Nothing has been built for the family yet.' },
  'in-taxonomy': { word: 'In taxonomy', meaning: 'The family is listed in the taxonomy. No research verdict is recorded and nothing is built for it.' },
  benchmarked: { word: 'Benchmarked', meaning: 'Every detector mapped to the family has fixtures that meet the stable fixture floors. No core detector is recorded for it.' },
  'core-detector': { word: 'Core detector', meaning: 'A detector for the family is in the pinned product inventory. Its fixtures may still be short of the stable floors, and no status is measured yet.' },
  measured: { word: 'Measured', meaning: 'The support matrix classifies the family as stable or provisional.' },
};

export const DOSSIER_VERDICT_COPY: Record<DossierVerdict, { kind: StatusKind; word: string; meaning: string }> = {
  unresearched: { kind: 'not-measured', word: 'Unresearched', meaning: 'Nobody has recorded research for this family yet.' },
  ready: { kind: 'pass', word: 'Ready', meaning: 'The grammar is backed well enough to build fixtures and a detector.' },
  'issuance-gated': { kind: 'review', word: 'Issuance-gated', meaning: 'Needs a minted-and-revoked sample that cannot be obtained yet.' },
  'date-gated': { kind: 'review', word: 'Date-gated', meaning: 'Waiting on a provider rollout or deprecation.' },
  'not-found': { kind: 'withheld', word: 'Not found', meaning: 'No reviewed source establishes the grammar.' },
  rejected: { kind: 'withheld', word: 'Rejected', meaning: 'Deliberately not pursued.' },
};

export type ProviderStageFilter = ProviderStage | 'all';
export const providerStageFilterOf = (search: string): ProviderStageFilter => {
  const value = new URLSearchParams(search).get('stage');
  return PROVIDER_STAGES.includes(value as ProviderStage) ? (value as ProviderStage) : 'all';
};

const n = (value: number) => value.toLocaleString('en-US');
const families = (count: number) => `${n(count)} ${count === 1 ? 'family' : 'families'}`;
const host = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };
const short = (url: string) => url.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|tree)\/([0-9a-f]{7})[0-9a-f]*\//, '$1@$2/');

function filterBar(file: ProviderDossiersFile, filter: ProviderStageFilter): string {
  const link = (href: string, label: string, current: boolean, stage?: ProviderStage) =>
    `<a href="${e(href)}"${stage ? ` data-stage="${e(stage)}"` : ''}${current ? ' aria-current="true"' : ''}>${e(label)}</a>`;
  return `<div class="seg" role="group" aria-label="Filter families by stage">${link('/support/providers', `All ${n(file.familyCount)}`, filter === 'all')}${PROVIDER_STAGES.map(stage => link(`/support/providers?stage=${stage}`, `${PROVIDER_STAGE_COPY[stage].word} ${n(file.stageDistribution[stage])}`, filter === stage, stage)).join('')}</div>`;
}

function legend(file: ProviderDossiersFile): string {
  return `<section class="section"><h2 class="h2-compact">The stages</h2>
    <p class="small">The stages run in this order, though a family can reach a later one without an earlier one, so each is shown separately. Each is derived from data that already exists: the dossier for research, <code>taxonomy.json</code>, the fixture-profile floors, <code>detectors.json</code> and the support matrix. Only the research verdict, blocker, research date and links are written by hand, in <code>benchmarks/support/dossiers/</code>.</p>
    ${PROVIDER_STAGES.map(stage => `<div class="chg" data-stage="${e(stage)}"><span><b>${e(PROVIDER_STAGE_COPY[stage].word)}</b></span><span>${e(PROVIDER_STAGE_COPY[stage].meaning)}</span><span class="d">${families(file.stageDistribution[stage])}</span></div>`).join('')}</section>`;
}

function chain(entry: ProviderDossierFamily): string {
  return `<ol class="stage-chain" aria-label="Stages reached">${PROVIDER_STAGES.map(stage => {
    const reached = entry.reached[stage];
    return `<li data-stage="${e(stage)}" data-reached="${reached}">${statusMark(reached ? 'pass' : 'not-measured', `${PROVIDER_STAGE_COPY[stage].word}${reached ? '' : ' not reached'}`)}</li>`;
  }).join('')}</ol>`;
}

function links(entry: ProviderDossierFamily): string {
  const items = [
    ...entry.issues.map(issue => `<a href="${e(issue.url)}" rel="noreferrer">${e(issue.ref)}</a>`),
    ...(entry.evidence ? [`<a href="${e(entry.evidence)}" rel="noreferrer">evidence ${e(short(entry.evidence))}</a>`] : []),
    ...entry.sources.map(source => `<a href="${e(source)}" rel="noreferrer">${e(host(source))}</a>`),
  ];
  return items.length ? items.join(' · ') : 'none recorded';
}

function familyRow(entry: ProviderDossierFamily): string {
  const verdict = DOSSIER_VERDICT_COPY[entry.verdict];
  const gaps = entry.fixtureGaps.length
    ? entry.fixtureGaps.map(g => `${e(g.detector)} ${e(g.cell)} ${n(g.actual)} of ${n(g.required)}`).join(' · ') : null;
  return `<article data-stage="${e(entry.stage)}" data-verdict="${e(entry.verdict)}" data-family="${e(entry.family)}">
    <div><a href="/coverage/${e(entry.family)}"><b>${e(entry.name)}</b></a><small><code>${e(entry.family)}</code></small></div>
    <div><b>${e(PROVIDER_STAGE_COPY[entry.stage].word)}</b>${statusMark(verdict.kind, verdict.word)}<small>${entry.researchedAt ? `Researched ${e(entry.researchedAt)}${entry.tier ? ` · ${e(entry.tier)}` : ''}` : 'No research date'}${entry.supportStatus ? ` · support <span class="mono">${e(entry.supportStatus)}</span>` : ''}</small></div>
    <div>${chain(entry)}<small><b>Blocked by</b> ${entry.blockedBy ? e(entry.blockedBy) : 'nothing recorded'}</small>${gaps ? `<small><b>Fixture floors short</b> ${gaps}</small>` : ''}<small><b>Links</b> ${links(entry)}</small></div>
  </article>`;
}

export function providersPage(file: ProviderDossiersFile | null, problem: string | null, filter: ProviderStageFilter = 'all'): string {
  const head = (meta: string) => `<div class="page-head"><div><h1>Providers roadmap</h1><div class="meta">${meta}</div></div>${file ? filterBar(file, filter) : ''}</div>`;
  if (!file) {
    return `${head('<span>Generated from provider dossiers and the support matrix, never authored here</span>')}
      ${actionEmptyState({
        title: problem ?? 'No provider dossiers published',
        body: 'This page reads <code>public/results/provider-dossiers-v1.json</code>, generated from <code>benchmarks/support/dossiers/</code> and the support matrix. No stage is written into the site, so until that file is published there is nothing to show.',
        command: 'npm run eval:matrix\nnpm run dossiers:publish',
        mark: statusMark('not-measured'),
      })}`;
  }
  const meta = `<span><b>${n(file.familyCount)}</b> families across <b>${n(file.providerCount)}</b> providers</span>
    <span>${DOSSIER_VERDICTS.map(v => `${e(DOSSIER_VERDICT_COPY[v].word)} <b>${n(file.verdictDistribution[v])}</b>`).join(' · ')}</span>
    ${file.supportMatrix && 'runId' in file.supportMatrix ? `<span>Measured status from evidence run <b>${e(file.supportMatrix.runId.slice(0, 8))}</b> · ${e(file.supportMatrix.generatedAt.slice(0, 10))}</span>` : file.supportMatrix ? `<span>Measured status from the qualification view · policy <b>${e(file.supportMatrix.policyRevision.slice(0, 24))}</b></span>` : `<span>${statusMark('not-measured', 'No support matrix in this build')}</span>`}`;
  const shown = file.providers
    .map(provider => ({ provider, rows: filter === 'all' ? provider.families : provider.families.filter(f => f.stage === filter) }))
    .filter(({ rows }) => rows.length);
  const total = shown.reduce((sum, { rows }) => sum + rows.length, 0);
  const body = shown.length
    ? shown.map(({ provider, rows }) => `<section class="section" data-provider="${e(provider.id)}"><h3 class="h3">${e(provider.name)} <small class="muted">${families(rows.length)}</small></h3><div class="support-family-links">${rows.map(familyRow).join('')}</div></section>`).join('')
    : '<p class="small">No family is at this stage.</p>';
  return `${head(meta)}
    <p class="prose small" style="margin-bottom:var(--space-4)">Where each provider's credential families stand, and what blocks the next stage. A family's position is a stage and a blocker, never a date: this page makes no promise about timing. This repository measures and records; a stage is derived from the dossier and the evidence, not a claim about the product. <a href="/support">Measured support status by family.</a></p>
    ${legend(file)}
    <section class="section"><h2 class="h2-compact">Providers and families</h2><p class="small">${n(total)} of ${families(file.familyCount)}${filter === 'all' ? '' : `, filtered to ${e(PROVIDER_STAGE_COPY[filter].word)}`}.</p>${body}</section>`;
}
