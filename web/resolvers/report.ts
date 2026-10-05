/**
 * The `/report` hub: run facts, the three answers at each evidence level, the
 * findings feed and the other scanners, resolved to block props. Pure.
 *
 * Boundary rule: everything here is a value the run or the ledger recorded. The
 * bounds are the run summary's (accounted once at bench time); this file picks
 * the group, formats the number and places it on an axis. It never computes a
 * rate, a bound or a comparison, and it words nothing as "better" or "worse".
 */
import type { AnswerData, EvidenceLevelLink, FindingData, HubTileData, PeerScannerNotes, PeerScannerRow, Ratio, StatusLabel } from '../components/report/types';
import type { MetaItem } from '../components/page/MetaList';
import type { KnownGaps } from '../services/findings';
import type { MeasuredRun, RunScanner } from '../services/run';
import type { Catalog, CatalogFixture } from '../services/catalog';
import type { PeerProfile } from '../services/peers';
import type { FamilyList } from './families';
import { agreesWithSummary, inputsAt, sliceInputs } from './peers';
import { rowsHref } from './rows';
import { axisMaxFor, count, int, isoDate, onAxis, percent } from './format';

export type Level = 'T1' | 'T2' | 'T3';
export const LEVELS: Level[] = ['T1', 'T2', 'T3'];
export const isLevel = (value: string | null): value is Level => value === 'T1' || value === 'T2' || value === 'T3';

const PRODUCT = 'redact-secret';
const TIER_TITLE: Record<Level, string> = { T1: 'Provider-documented', T2: 'Tool-corroborated', T3: 'Project policy' };
const SHORT: Record<Level, string> = { T1: 'Provider', T2: 'Tool', T3: 'Policy' };
export const LEVEL_TITLE = TIER_TITLE;
export const LEVEL_SHORT = SHORT;
/** Below this many samples a published bound stays wide enough that the figure says so. Display rule only. */
const FEW_SAMPLES_BELOW = 30;

/** Project policy is its own kind: T3 has no must-redact group, by construction. */
const redactKey = (level: Level) => (level === 'T3' ? 'policy/T3' : `must-redact/${level}`);
const controlKey = (level: Level) => `must-not-flag/${level}`;

// ---- Published shapes read from the run summary (benchmarks/types.ts AccountedGroup) ----
interface Rate { point: number; bound: number | null; n: number; direction: 'upper' | 'lower' | null }
type Published = Rate | string | null | undefined;
interface RedactGroup { files: number; spans: number; leakedSpans: number; leakedSpanRate: Published; twins: { positives: number; pairs: number; discriminated: number; rate: Published } }
interface ControlGroup { files: number; flaggedFiles: number; falseAlarmRate: Published }
const isRate = (value: Published): value is Rate => !!value && typeof value === 'object';
const groupsOf = (run: MeasuredRun, scanner: string, key: string): unknown => (run.summary.overall[scanner] as Record<string, unknown> | undefined)?.[key];
const isRedact = (g: unknown): g is RedactGroup => !!g && typeof g === 'object' && 'spans' in g;
const isControl = (g: unknown): g is ControlGroup => !!g && typeof g === 'object' && 'flaggedFiles' in g;

export const levelLinks = (): EvidenceLevelLink[] => LEVELS.map(level => ({
  label: TIER_TITLE[level], shortLabel: SHORT[level], href: level === 'T1' ? '/report/' : `/report/?level=${level}`,
}));
export const levelHref = (level: Level): string => (level === 'T1' ? '/report/' : `/report/?level=${level}`);
/** The rows behind a level's figures (`/report/rows/T1/`); a figure links here with the `show` that isolates its rows. */
const rowsLink = (level: Level): string => rowsHref(level);

// ---- Run facts ---------------------------------------------------------------

/** "published · redact-secret 0.1.0-beta.11" or "candidate · redact-secret main 1a2b3c4 · unreleased". */
export function modeText(run: MeasuredRun): string {
  return run.mode === 'candidate' && run.candidate
    ? `candidate · ${PRODUCT} main ${run.candidate.sourceCommit.slice(0, 7)} · unreleased`
    : `published · ${PRODUCT} ${run.productVersion ?? 'unknown version'}`;
}

/** The eyebrow over the page title: which build the numbers came from. */
export const runEyebrow = (run: MeasuredRun): string => (run.mode === 'candidate' && run.candidate
  ? `${PRODUCT} candidate ${run.candidate.sourceCommit.slice(0, 7)} · unreleased`
  : `${PRODUCT} ${run.productVersion ?? ''}`.trim()).toUpperCase();

/** The two facts every report page states: which run, and which mode the stable counts came from. */
export const runFacts = (run: MeasuredRun): MetaItem[] => [
  { label: 'Run', value: isoDate(run.generatedAt) },
  { label: 'Mode', value: modeText(run) },
];

// ---- Three answers -----------------------------------------------------------

const status = (s: StatusLabel['status'], label: string): StatusLabel => ({ status: s, label });

interface Figure { value: string; qualifier: string; observed: number | null; bound: number | null; direction: 'upper' | 'lower' | null; fewSamples: boolean; withheld?: string }

function figureOf(rate: Published, n: number): Figure {
  if (isRate(rate)) {
    const bound = rate.bound ?? rate.point;
    return {
      value: percent(bound), qualifier: rate.direction === 'upper' ? 'at most' : rate.direction === 'lower' ? 'at least' : '',
      observed: rate.point, bound, direction: rate.direction, fewSamples: n < FEW_SAMPLES_BELOW,
    };
  }
  return { value: '—', qualifier: 'not published', observed: null, bound: null, direction: null, fewSamples: false, withheld: typeof rate === 'string' ? rate : 'not-measured' };
}

const WITHHELD_WHY: Record<string, string> = {
  'insufficient-evidence': 'Too few samples, or too much of the group still pending review, to publish a bound.',
  'insufficient-coverage': 'Too few secrets have an authored near-twin to publish a rate.',
  'not-measured': 'Nothing is recorded for this group.',
};

function answer(id: string, question: string, fig: Figure, count_: { strong: string; rest: string }, definition: string, href?: string): AnswerData {
  const withheld = fig.withheld !== undefined;
  const axisMax = fig.direction === 'lower' ? 1 : axisMaxFor(fig.bound ?? 0);
  const interval = withheld || fig.observed === null || fig.bound === null
    ? { ariaLabel: `No bound is published for this figure. ${WITHHELD_WHY[fig.withheld ?? 'not-measured'] ?? ''}`.trim(), observed: 0, bound: 0, range: [0, 0] as [number, number], axisMin: '0%', axisMax: '100%' }
    : (() => {
        const o = onAxis(fig.observed, axisMax), b = onAxis(fig.bound, axisMax);
        return {
          ariaLabel: `Observed ${percent(fig.observed)}. Published bound: ${fig.qualifier} ${percent(fig.bound)}. Axis 0% to ${percent(axisMax, 0)}.`,
          observed: o, bound: b, range: (fig.direction === 'lower' ? [b, o] : [o, b]) as [number, number],
          axisMin: '0%', axisMax: percent(axisMax, 0),
        };
      })();
  return {
    id, question, qualifier: fig.qualifier, value: fig.value, interval, observation: count_,
    ...(href ? { href } : {}),
    ...(withheld ? { status: status(fig.withheld === 'not-measured' ? 'not-measured' : 'withheld', fig.withheld === 'not-measured' ? 'Not measured' : 'Withheld') }
      : fig.fewSamples ? { status: status('withheld', 'Few samples') } : {}),
    definition: withheld ? `${definition} ${WITHHELD_WHY[fig.withheld!] ?? ''}`.trim() : definition,
  };
}

export interface LevelAnswers {
  level: Level;
  /** The URL of this level: `/report/`, `/report/?level=T2`. */
  href: string;
  eyebrow: string;
  answers: AnswerData[];
  /** Inputs at this level for redact-secret: fixtures in the must-redact (or policy) and control groups. */
  inputs: { positives: number; controls: number };
}

const CONFIDENCE = (run: MeasuredRun): string => {
  const z = (run.summary.accounting as { intervalZ?: number }).intervalZ;
  return `${z === 1.96 ? '95% pessimistic bound' : `Pessimistic bound at z = ${z ?? '—'}`}, corpus-relative`;
};

export function resolveAnswers(run: MeasuredRun, level: Level): LevelAnswers {
  const policy = level === 'T3';
  const mine = groupsOf(run, PRODUCT, redactKey(level));
  const controls = groupsOf(run, PRODUCT, controlKey(level));

  const leak = isRedact(mine) ? answer(
    'miss', policy ? 'Does it leave policy spans readable?' : 'Does it miss real secrets?',
    figureOf(mine.leakedSpanRate, mine.spans), { strong: `${int(mine.leakedSpans)} of ${int(mine.spans)}`, rest: 'secret spans leaked' },
    `Leaked span rate. Lower is better. ${CONFIDENCE(run)}.${policy ? ' These spans are this project’s redaction policy: a difference here is a difference of opinion, not a defect.' : ''}`,
    `${rowsLink(level)}?show=leaked`,
  ) : missing('miss', policy ? 'Does it leave policy spans readable?' : 'Does it miss real secrets?');

  const alarm = isControl(controls) ? answer(
    'flag', 'Does it flag safe values?',
    figureOf(controls.falseAlarmRate, controls.files), { strong: `${int(controls.flaggedFiles)} of ${int(controls.files)}`, rest: 'controls flagged' },
    `False alarm rate on ${TIER_TITLE[level].toLowerCase()} controls. Lower is better. Few controls keep the bound wide.`,
    `${rowsLink(level)}?show=flagged`,
  ) : missing('flag', 'Does it flag safe values?');

  const twins = isRedact(mine) && mine.twins.rate !== null && mine.twins.rate !== undefined ? answer(
    'twins', 'Does it tell near-twins apart?',
    figureOf(mine.twins.rate, mine.twins.pairs), { strong: `${int(mine.twins.discriminated)} of ${int(mine.twins.pairs)}`, rest: 'pairs discriminated' },
    'Twin discrimination: the secret is covered and its one-character fake stays quiet. Higher is better.',
    `${rowsLink(level)}?show=twins`,
  ) : missing('twins', 'Does it tell near-twins apart?', 'No near-twin pairs are authored in this group.');

  return {
    level, href: levelHref(level), eyebrow: TIER_TITLE[level].toUpperCase(), answers: [leak, alarm, twins],
    inputs: { positives: isRedact(mine) ? mine.files : 0, controls: isControl(controls) ? controls.files : 0 },
  };
}

function missing(id: string, question: string, why = 'Nothing is recorded for this group.'): AnswerData {
  return {
    id, question, qualifier: 'not published', value: '—',
    interval: { ariaLabel: `No bound is published for this figure. ${why}`, observed: 0, bound: 0, range: [0, 0], axisMin: '0%', axisMax: '100%' },
    observation: { strong: 'No fixtures', rest: 'at this level' },
    status: status('not-measured', 'Not measured'),
    definition: why,
  };
}

/** The line under the answers title: run, inputs, scanners, accounting and mode. */
export function answerMeta(run: MeasuredRun, catalog: Catalog): MetaItem[] {
  return [
    { label: 'Run', value: isoDate(run.generatedAt) },
    { value: `Same ${int(catalog.fixtures.length)} inputs for ${count(run.summary.scanners.length, 'scanner')}` },
    { label: 'Accounting', value: `v${run.accountingVersion}` },
    { label: 'Mode', value: modeText(run) },
  ];
}

// ---- Hub tiles ---------------------------------------------------------------

/**
 * The hub links to the pages this app has, and only those: every tile stays inside
 * the app (a link that left it would leave the preview base path). The detector and
 * findings pages exist here since #559, so their tiles are back.
 */
export function resolveHubTiles(list: FamilyList, findings: KnownGaps, detectors?: { count: number; fixtures: number }): HubTileData[] {
  const { totals } = list;
  return [
    { href: '/report/providers/', label: 'Providers', figure: int(totals.providers), figureUnit: 'providers', emphasis: int(totals.providersWithFixtures), text: 'with fixtures in this corpus. Each opens its families and rows.', action: 'By provider →' },
    { href: '/report/families/', label: 'Families', figure: int(totals.families), figureUnit: 'families', emphasis: int(totals.familiesWithFixtures), text: 'with fixtures. Rows and outcomes for every family, in one list.', action: 'All families →' },
    ...(detectors ? [{ href: '/report/detectors/', label: 'Detectors', figure: int(detectors.count), figureUnit: 'detectors', emphasis: int(detectors.fixtures), text: 'fixtures exercise them. Sample size and rows per detector.', action: 'By detector →' }] : []),
    { href: '/report/findings/', label: 'News', figure: int(findings.issues.length), figureUnit: 'findings', text: `Ledger last reviewed ${findings.reviewedAt}, last measured on ${findings.measuredVersion}: findings from this benchmark and where each one stands.`, action: 'What changed →' },
  ];
}

// ---- Findings ----------------------------------------------------------------

export const FINDING_STATUS: Record<string, StatusLabel> = {
  verified: status('pass', 'Verified'),
  fixed: status('pass', 'Fixed'),
  promoted: status('review', 'Promoted'),
  reviewed: status('review', 'In review'),
  observed: status('review', 'Observed'),
  rejected: status('not-measured', 'Rejected'),
  'policy-decision': status('withheld', 'Policy'),
};

export const lastDate = (history: Record<string, { at: string } | undefined>): string =>
  Object.values(history).flatMap(t => (t ? [t.at] : [])).sort().at(-1) ?? '';

export interface FindingsBlock { title: string; description: string; findings: FindingData[]; allHref: string; allLabel: string }

export function resolveFindings(gaps: KnownGaps, limit = 6): FindingsBlock {
  const newest = [...gaps.issues]
    .map(i => ({ i, date: lastDate(i.history) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.i.number - a.i.number)
    .slice(0, limit);
  return {
    title: 'What changed',
    description: `Findings this benchmark handed to the product, newest first. Ledger last reviewed ${gaps.reviewedAt}, last measured on ${gaps.measuredVersion}; not live issue status.`,
    findings: newest.map(({ i, date }) => ({
      id: String(i.number),
      href: i.url,
      title: `#${i.number} · ${i.title}`,
      detail: `${i.kind === 'false-positive' ? 'Flagged a safe value' : 'Left a secret readable'} · ${count(i.fixtures.length, 'fixture')}`,
      date,
      status: FINDING_STATUS[i.status] ?? status('info', i.status),
    })),
    // Inside the app: the inventory page lists every finding and links the milestone.
    allHref: '/report/findings/',
    allLabel: `All ${int(gaps.issues.length)} findings`,
  };
}

// ---- Other scanners ------------------------------------------------------------

export interface PeersBlock {
  title: string;
  description: string;
  rows: PeerScannerRow[];
  notes: PeerScannerNotes;
  /** T3 is this project's masking policy; its peer rates reflect scope, so the table is hidden until asked for. */
  hiddenByDefault: boolean;
}

const peerRatio = (count_: number, of: number, note?: string): Ratio => ({ count: int(count_), of: int(of), ...(note ? { note } : {}) });

/** What the ledger holds about the peers beyond their results: the fixtures, and each peer's kind, description and targeted families. */
export interface PeerContext { fixtures: CatalogFixture[]; profiles: Map<string, PeerProfile> }

/** "Repository scanner · Directory scan": the kind, then the first part of the run's mode line. */
const roleOf = (peer: RunScanner, profile: PeerProfile | undefined): string =>
  profile ? `${profile.kindLabel} · ${peer.mode.split(' · ')[0]}` : peer.mode;

interface Targeting { targeted: Ratio; leftReadable: Ratio; elsewhere: Ratio; sentence: string; inputsTargeted: number }

/** The three "rules target" figures for one peer at one level, or `null` when the run cannot confirm them. */
function targetingOf(run: MeasuredRun, peer: RunScanner, level: Level, context: PeerContext | undefined): Targeting | null {
  const profile = context?.profiles.get(peer.id);
  const group = groupsOf(run, peer.id, redactKey(level));
  if (!context || !profile || !isRedact(group)) return null;
  const inputs = inputsAt(context.fixtures, level);
  const slices = sliceInputs(inputs, peer.rows, profile.families);
  if (!slices || !agreesWithSummary(slices, group)) return null;
  const mineRows = run.scanners.find(s => s.id === PRODUCT)?.rows;
  const mine = sliceInputs(inputs, mineRows, profile.families);
  const { targeted, elsewhere } = slices;
  return {
    targeted: { count: int(targeted.inputs), of: int(inputs.length), note: `${int(profile.mappedRules)} of its ${int(profile.ruleCount)} rules target a credential family` },
    leftReadable: {
      count: int(targeted.leaked), of: int(targeted.spans), unit: 'spans',
      ...(mine ? { note: `${PRODUCT}, same inputs: ${int(mine.targeted.leaked)} of ${int(mine.targeted.spans)}` } : {}),
    },
    elsewhere: {
      count: int(elsewhere.leaked), of: int(elsewhere.spans), unit: 'spans',
      note: elsewhere.inputs === 0 ? 'Every input at this level is one its rules target' : 'No rule of its own targets these',
    },
    sentence: `${int(targeted.inputs)} ${TIER_TITLE[level].toLowerCase()} inputs that match ${peer.name} ${peer.version ?? ''}’s default rules`.replace('  ', ' '),
    inputsTargeted: targeted.inputs,
  };
}

export function resolvePeers(run: MeasuredRun, gaps: KnownGaps, level: Level, context?: PeerContext): PeersBlock {
  const mine = groupsOf(run, PRODUCT, redactKey(level));
  const myControls = groupsOf(run, PRODUCT, controlKey(level));
  const peers = run.scanners.filter(s => s.id !== PRODUCT);
  const targeting = new Map(peers.map(peer => [peer.id, targetingOf(run, peer, level, context)]));
  const rows: PeerScannerRow[] = peers.map(peer => {
    const g = groupsOf(run, peer.id, redactKey(level));
    const c = groupsOf(run, peer.id, controlKey(level));
    const mineNote = isRedact(mine) && isRedact(g) ? `${PRODUCT}, same inputs: ${int(mine.leakedSpans)} of ${int(mine.spans)}` : undefined;
    const profile = context?.profiles.get(peer.id);
    const t = targeting.get(peer.id) ?? null;
    return {
      name: peer.name, version: peer.version ?? '', role: roleOf(peer, profile), blurb: profile?.description ?? '',
      // Which inputs a peer's own rules target: read from the reviewed rule-to-family map (scanners/peer-rule-families.json).
      targeted: t?.targeted ?? null, leftReadable: t?.leftReadable ?? null, elsewhere: t?.elsewhere ?? null,
      allInputs: isRedact(g) ? { count: int(g.leakedSpans), of: int(g.spans), unit: 'spans', ...(mineNote ? { note: mineNote } : {}) } : null,
      safeFlagged: isControl(c)
        ? peerRatio(c.flaggedFiles, c.files, c.files < FEW_SAMPLES_BELOW ? 'Too few controls to tell apart' : isControl(myControls) ? `${PRODUCT}, same inputs: ${int(myControls.flaggedFiles)} of ${int(myControls.files)}` : undefined)
        : null,
    };
  });

  const inputs = isRedact(mine) ? mine.files : 0;
  const first = rows.find(r => r.allInputs);
  // The quote guidance uses the targeted slice when the run confirms one: the inputs the peer's own rules target.
  const quotable = peers.find(p => targeting.get(p.id));
  const quotableTarget = quotable ? targeting.get(quotable.id) : null;
  const fixedShare = `${int(gaps.issues.filter(i => i.status === 'fixed' || i.status === 'verified').length)} of ${int(gaps.issues.length)}`;
  return {
    title: 'Other scanners on the same inputs',
    description: `We ran ${count(peers.length, 'other scanner')} on the same ${int(inputs)} ${TIER_TITLE[level].toLowerCase()} inputs. This shows what each one left readable. It does not show which scanner is better.`,
    rows,
    hiddenByDefault: level === 'T3',
    notes: {
      caveatsTitle: 'Read this before the numbers',
      caveats: [
        { lead: 'Our inputs, our answer key.', text: `The ${PRODUCT} team wrote every input and every expected span, using ${PRODUCT}’s own definition of a secret.` },
        { lead: `${PRODUCT} was tuned on these inputs.`, text: `${fixedShare} findings from this corpus are recorded as fixed in ${PRODUCT}. The other scanners were never tuned against it.` },
        { lead: 'Different jobs.', text: 'Most inputs fall outside at least one scanner’s rules. A readable span there shows where its rules end, not that it failed.' },
      ],
      source: `${peerSource(peers)}${quotableTarget ? ` Rules are matched to families from each scanner’s pinned rule file (reviewed ${isoDate(context?.profiles.get(quotable!.id)?.reviewedAt)}).` : ''}`,
      quoteTitle: 'Quoting these numbers',
      quoteDont: first ? `“${PRODUCT} leaks far fewer secrets than ${first.name}.”` : `“${PRODUCT} leaks far fewer secrets than other scanners.”`,
      quoteDo: quotableTarget
        ? `“On ${quotableTarget.sentence}, in a corpus written and used for tuning by the ${PRODUCT} team, ${quotable!.name} left ${quotableTarget.leftReadable.count} of ${quotableTarget.leftReadable.of} secret spans readable.”`
        : first?.allInputs
          ? `“On ${int(inputs)} ${TIER_TITLE[level].toLowerCase()} inputs written and used for tuning by the ${PRODUCT} team, ${first.name} ${first.version} left ${first.allInputs.count} of ${first.allInputs.of} secret spans readable.”`
          : 'Name the input slice, the scanner version, the date and who wrote the inputs.',
      quoteNote: 'Any quote names the input slice, the version, the date, and who wrote the inputs.',
    },
  };
}

function peerSource(peers: RunScanner[]): string {
  const observations = peers.flatMap(p => p.observations);
  const snapshots = [...new Set(observations.filter(o => o.source === 'snapshot').map(o => isoDate(o.observedAt)))].sort();
  const fresh = [...new Set(observations.filter(o => o.source === 'fresh').map(o => isoDate(o.observedAt)))].sort();
  const parts: string[] = [];
  if (snapshots.length) parts.push(`Results from ${snapshots.join(', ')}, reused because the inputs have not changed since.`);
  if (fresh.length) parts.push(`Observed in this run on ${fresh.join(', ')}.`);
  if (!parts.length) parts.push('No observation dates are recorded for these scanners.');
  return `${parts.join(' ')} Listed in run order; a new scanner adds a row.`;
}
