/**
 * What the family page shows beyond its fixture rows (#589): the research status, the dossier's
 * format notes, the benchmark counts at every evidence level and for every scanner, the peer rules
 * that target the family, and its sources. Pure: the catalog, the run, the provider dossier and the
 * peer rule map in, block props out. Nothing is read or re-scored here.
 *
 *  - Counts reuse `tally`, `isLeft`, `isTooMuch` (resolvers/families.ts), so a number on this page is the
 *    number on the family list and the rows table, by the counting rule of
 *    docs/decisions/2026-09-30-count-a-fixture-in-every-family-it-is-related-to.md.
 *  - A scanner with no recorded row on any of the family's fixtures reads "—" and "not measured", never zero.
 *  - Dossier notes are shown as written. A label the dossier leaves blank is absent, and an absent note is
 *    a "not recorded" box on the page, not a placeholder value.
 *  - Scanners stay in run order and are never ranked, sorted by count or summed.
 */
import type { CatalogFixture } from '../services/catalog';
import type { DossierFamily, DossierNote, Verdict } from '../services/dossiers';
import type { PeerProfile } from '../services/peers';
import type { MeasuredRun } from '../services/run';
import type { StatusBarItem } from '../components/feedback';
import type {
  FamilyBenchmarkData, FamilyCountsRow, FamilyNoteItem, FamilyRulesData, FamilyScannerRow, FamilySourceLink,
  FamilySourcesData, InlinePart,
} from '../components/family/types';
import type { Family } from '../../benchmarks/support/taxonomy';
import { TIER_TITLE, tally, type Tally } from './families';
import { LIST_LEVELS } from './filters';
import { count, int } from './format';
import { modeText } from './report';

// ---- Dossier prose -------------------------------------------------------------------------

const TOKEN = /`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*/g;

/**
 * Dossier prose as parts a block draws: text, `code` spans and `[text](https://...)` links. Bold markers are
 * dropped, a link to anything but https is left as the text it was, and no markup reaches the page.
 */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1] !== undefined) parts.push({ code: match[1] });
    else if (match[3] !== undefined) parts.push({ href: match[3], text: match[2].replace(/`/g, '') });
    else parts.push(match[4]);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const noteOf = (notes: DossierNote[], label: string): DossierNote | undefined => notes.find(n => n.label === label);
const item = (term: string, text: string): FamilyNoteItem => ({ term, parts: inlineParts(text) });

/** The dossier notes under the three headings the page uses, each in the order the heading lists them. */
export function resolveNotes(dossier: DossierFamily | undefined): { format: FamilyNoteItem[]; lookAlikes: FamilyNoteItem[]; open: FamilyNoteItem[] } {
  const notes = dossier?.notes ?? [];
  const pick = (pairs: [string, string][]): FamilyNoteItem[] => pairs.flatMap(([label, term]) => {
    const note = noteOf(notes, label);
    return note ? [item(term, note.text)] : [];
  });
  return {
    format: pick([['Shape', 'Shape'], ['Sources', 'Basis'], ['Issuance', 'Issuance'], ['Current contract in core', 'Contract in core']]),
    lookAlikes: pick([['Collisions', 'Collisions']]),
    open: [...(dossier?.blockedBy ? [item('Blocked by', dossier.blockedBy)] : []), ...pick([['Open caveat', 'Open caveat']])],
  };
}

// ---- Research status -----------------------------------------------------------------------

const VERDICT: Record<Verdict, string> = {
  unresearched: 'Not researched', ready: 'Ready', 'issuance-gated': 'Issuance-gated', 'date-gated': 'Date-gated', 'not-found': 'Not found', rejected: 'Rejected',
};

/** The research record in three cells. An unresearched family has no tier and no date: those read "Not recorded", dashed. */
export function resolveStatus(dossier: DossierFamily | undefined): StatusBarItem[] {
  const researched = !!dossier && dossier.verdict !== 'unresearched';
  return [
    { label: 'Research', value: dossier ? VERDICT[dossier.verdict] : 'Not recorded', tone: researched ? 'neutral' : 'not-measured' },
    { label: 'Evidence level', value: dossier?.tier ? `${dossier.tier} · ${TIER_TITLE[dossier.tier] ?? dossier.tier}` : 'Not recorded', tone: dossier?.tier ? 'neutral' : 'not-measured' },
    { label: 'Researched', value: dossier?.researchedAt ?? 'Not recorded', tone: dossier?.researchedAt ? 'neutral' : 'not-measured' },
  ];
}

// ---- Benchmark counts ----------------------------------------------------------------------

/** A count, or "—" when no row is recorded for any of the fixtures: never a zero standing in for "not measured". */
const figure = (t: Tally, value: number): string => (t.fixtures > 0 && t.notMeasured === t.fixtures ? '—' : int(value));

function countsRow(id: string, label: string, t: Tally, extra: { detail?: string } = {}): FamilyCountsRow {
  return {
    id, label, ...(extra.detail ? { detail: extra.detail } : {}),
    fixtures: int(t.fixtures), leftReadable: figure(t, t.leftReadable), tooMuch: figure(t, t.tooMuch), falseAlarms: figure(t, t.falseAlarms),
    ...(t.notMeasured > 0 ? { notMeasured: int(t.notMeasured) } : {}),
  };
}

/** "25 fixtures: 11 expect a redaction, 14 must stay quiet." What the corpus says each fixture expects, never what a scanner did. */
export function kindsText(fixtures: CatalogFixture[]): string {
  const of = (kind: string): number => fixtures.filter(f => f.kind === kind).length;
  const parts = [
    [of('must-redact'), 'expect a redaction'], [of('must-not-flag'), 'must stay quiet'], [of('policy'), 'record project policy'],
  ].filter(([n]) => (n as number) > 0).map(([n, text]) => `${int(n as number)} ${text}`);
  return parts.length ? `${count(fixtures.length, 'fixture')}: ${parts.join(', ')}.` : '';
}

export interface BenchmarkInput {
  family: Family;
  fixtures: CatalogFixture[];
  /** `undefined` when no usable run is published. */
  run: MeasuredRun | undefined;
  peers: Map<string, PeerProfile>;
  /** The headline counts the family list and the rows table state: `FamilyDetail.facts`, reused as is. */
  facts: { term: string; value: string }[] | undefined;
  rowsHref: string;
}

export function resolveBenchmark({ family, fixtures, run, peers, facts, rowsHref }: BenchmarkInput): FamilyBenchmarkData {
  if (!facts || fixtures.length === 0) return { mode: run ? modeText(run) : null, facts: [], kinds: '', levels: [], scanners: [] };
  const rows = run?.productRows;
  const levels = LIST_LEVELS.filter(l => l.level !== 'all').flatMap(l => {
    const at = fixtures.filter(f => f.tier === l.level);
    return at.length ? [countsRow(l.level, l.level, tally(at, rows), { detail: l.label })] : [];
  });
  const scanners: FamilyScannerRow[] = (run?.scanners ?? []).map(s => {
    const profile = peers.get(s.id);
    const t = tally(fixtures, s.rows);
    const rules = profile?.rulesByFamily.get(family.id)?.length ?? 0;
    const own = s.id === 'redact-secret';
    return {
      ...countsRow(s.id, s.name, t, { detail: [s.version, s.mode].filter(Boolean).join(' · ') }),
      kind: profile?.kindLabel ?? 'Product measured here',
      rules: own
        ? (family.detectors.length ? `${count(family.detectors.length, 'detector')} mapped` : 'No detector mapped')
        : rules > 0 ? `${count(rules, 'rule')} target${rules === 1 ? 's' : ''} it` : 'No rule maps to it',
    };
  });
  return {
    mode: run ? modeText(run) : null,
    // With one level there is no per-level table: the sentence names the level instead.
    facts, kinds: `${kindsText(fixtures)}${levels.length === 1 ? ` All at the ${levels[0].label} level, ${levels[0].detail!.toLowerCase()}.` : ''}`, levels, scanners,
    ...(run ? {} : { runNote: 'No benchmark run is published, so every count is not measured.' }),
    rowsHref,
  };
}

// ---- Peer rules ------------------------------------------------------------------------------

export function resolveRules(familyId: string, peers: Map<string, PeerProfile>, names: Map<string, string>): FamilyRulesData {
  const rules = [...peers.values()].flatMap(p => (p.rulesByFamily.get(familyId) ?? []).map(r => ({
    scanner: `${names.get(p.id) ?? p.id} · rules ${p.ruleFileVersion}`, rule: r.rule, basis: r.basis,
  })));
  const withoutRules = [...peers.values()].filter(p => !p.rulesByFamily.has(familyId)).map(p => names.get(p.id) ?? p.id);
  const reviewed = [...peers.values()][0]?.reviewedAt;
  return {
    rules, withoutRules,
    reviewed: `Mapped by hand${reviewed ? ` (reviewed ${reviewed})` : ''} from each scanner's pinned rule file, never from what a scanner found on the fixtures.`,
  };
}

// ---- Sources -----------------------------------------------------------------------------------

const asSource = (href: string): FamilySourceLink => {
  try {
    const url = new URL(href);
    const rest = `${url.pathname}${url.search}${url.hash}`;
    return { href, label: url.host, ...(rest !== '/' ? { detail: rest } : {}) };
  } catch {
    return { href, label: href };
  }
};

export function resolveSources(family: Family, dossier: DossierFamily | undefined): FamilySourcesData {
  const hrefs = [...new Set([...(family.sources ?? []), ...(dossier?.sources ?? [])])];
  const issues: FamilySourceLink[] = (dossier?.issues ?? []).map(ref => ({
    href: `https://github.com/${ref.replace('#', '/issues/')}`, label: ref, detail: 'Research issue',
  }));
  const evidence: FamilySourceLink[] = dossier?.evidence ? [{ ...asSource(dossier.evidence), label: 'Final evidence, pinned to a commit' }] : [];
  return {
    sources: hrefs.map(asSource),
    log: [...issues, ...evidence],
    ...(dossier?.researchedAt ? { researched: `Researched ${dossier.researchedAt}.` } : {}),
  };
}
