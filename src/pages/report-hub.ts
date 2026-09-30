import rawGaps from '../../benchmarks/known-gaps.json';
import { validateKnownGaps, type KnownGaps } from '../../benchmarks/lib/promotion';
import { taxonomy } from '../../benchmarks/support/taxonomy.ts';
import { escapeHtml as e, statusMark, type StatusKind } from '../components';
import { registry, type Fixture } from '../catalog';

const gaps = validateKnownGaps(rawGaps as unknown as KnownGaps);
const n = (value: number) => value.toLocaleString('en-US');
const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

type Gap = (typeof gaps.issues)[number];
type Step = 'observed' | 'reviewed' | 'promoted' | 'fixed' | 'verified';
const STEPS: Step[] = ['verified', 'fixed', 'promoted', 'reviewed', 'observed'];
const WORD: Record<string, { kind: StatusKind; word: string }> = {
  verified: { kind: 'pass', word: 'Verified' }, fixed: { kind: 'pass', word: 'Fixed' },
  promoted: { kind: 'info', word: 'Handed off' }, reviewed: { kind: 'review', word: 'Reviewed' }, observed: { kind: 'review', word: 'Observed' },
  'policy-decision': { kind: 'withheld', word: 'Policy' }, rejected: { kind: 'withheld', word: 'Rejected' },
};

export interface NewsItem { gap: Gap; at: string; status: string }
/** The latest lifecycle step each tracked finding reached, newest first. Read from
 * `known-gaps.json`; a terminal status is dated by the last step it passed. */
export function newsItems(): NewsItem[] {
  return gaps.issues.map(gap => {
    const history = gap.history as Partial<Record<Step, { at: string }>>;
    const at = STEPS.map(step => history[step]?.at).find(Boolean) ?? '';
    return { gap, at, status: gap.status };
  }).sort((a, b) => b.at.localeCompare(a.at) || b.gap.number - a.gap.number);
}

interface Tile { label: string; count: number; noun: string; detail: string; href: string; cta: string }
const tile = (t: Tile) => `<a class="hub-tile" href="${e(t.href)}"><span class="eyebrow muted">${e(t.label)}</span><span class="hub-n"><b>${n(t.count)}</b><span class="visually-hidden"> ${e(t.noun)}</span></span><span class="small">${t.detail}</span><span class="hub-go">${e(t.cta)} →</span></a>`;

/**
 * The first screen of /report: a hub, not a result. Each tile counts what the
 * page behind it holds and links there; no rate, time or score sits here, so a
 * lone number cannot be read as a rank. Counts come from the taxonomy, the
 * detector registry, the fixture index and the known-gaps ledger.
 */
export function reportHub(fixtures: Fixture[]): string {
  const familyIds = new Set(fixtures.flatMap(f => f.familyIds ?? []));
  const providerIds = new Set(taxonomy.families.filter(f => familyIds.has(f.id) && f.provider).map(f => f.provider));
  const detectorIds = new Set(fixtures.flatMap(f => f.detectors));
  const news = newsItems(), latest = news[0]?.at ?? '', sameDay = news.filter(item => item.at === latest).length;
  const tiles: Tile[] = [
    { label: 'Providers', count: taxonomy.providers.length, noun: 'providers', detail: `<b>${n(providerIds.size)}</b> with fixtures in this corpus. Each opens its families and rows.`, href: '/coverage', cta: 'By provider' },
    { label: 'Families', count: taxonomy.families.length, noun: 'families', detail: `<b>${n(familyIds.size)}</b> with fixtures. Support status for each family, stable to unsupported.`, href: '/support', cta: 'Support by family' },
    { label: 'Detectors', count: registry.detectors.length, noun: 'detectors', detail: `<b>${n(detectorIds.size)}</b> exercised by <b>${n(fixtures.length)}</b> fixtures. Sample size and rows per detector.`, href: '/coverage?show=detectors', cta: 'By detector' },
    { label: 'News', count: sameDay, noun: sameDay === 1 ? 'change' : 'changes', detail: latest ? `Latest on <b>${e(latest)}</b>: findings from this benchmark and where each one stands.` : 'No tracked findings yet.', href: '#news', cta: 'What changed' },
  ];
  return `<nav class="hub" aria-label="Report sections">${tiles.map(tile).join('')}</nav>`;
}

/** What changed: the newest tracked findings. Historical ledger state, not live issue status. */
export function newsSection(limit = 6): string {
  const items = newsItems();
  if (!items.length) return '';
  const shown = items.slice(0, limit);
  return `<section class="section" id="news"><div class="section-head"><div><h2 class="h2-compact">What changed</h2><p class="small">Findings this benchmark handed to the product, newest first. Ledger snapshot ${e(gaps.reviewedAt)}; not live issue status.</p></div><a href="/coverage?show=inventory">All ${plural(items.length, 'finding', 'findings')}</a></div>${shown.map(({ gap, at, status }) => {
    const mark = WORD[status] ?? { kind: 'info' as StatusKind, word: status };
    return `<div class="chg">${statusMark(mark.kind, mark.word)}<span><a href="${e(gap.url)}">#${gap.number} · ${e(gap.title)}</a><small>${gap.kind === 'false-positive' ? 'Flagged a safe value' : 'Left a secret readable'} · ${plural(gap.fixtures.length, 'fixture', 'fixtures')}</small></span><span class="d">${e(at)}</span></div>`;
  }).join('')}</section>`;
}
