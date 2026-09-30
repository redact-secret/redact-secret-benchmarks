/**
 * `/comparison/accuracy` (#570): redact-secret and one other tool, read against the
 * expected answer for the same test files. Pure: the catalog, the run, the peer
 * profiles and the recorded runtime comparison in, block props out.
 *
 * Nothing is re-scored. A test file is a fixture; what each scanner did with it is what
 * its row recorded (`RowResult`), the same rows `/report` and the rows pages read. The
 * grids count *files*, where `/report` counts spans; the source note on the page says so.
 *
 *  - `r` files (must-redact at T1/T2, policy at T3) are sorted into Hidden (no PARTIAL or
 *    MISS span), Partly readable (a PARTIAL span, no MISS) and Readable (a MISS span);
 *  - `a` files (must-not-flag) into Left alone and Flagged.
 *
 * A file one of the two scanners has no row for is *not measured* for the pair: it is
 * counted apart and never drawn as a pass or a zero.
 *
 * Boundary rule: each tool is read against the expected answer on its own row; the
 * differences are a list in both directions. There is no score, no total across
 * questions or levels, no winner, no status colour. The "scope" switch narrows to the
 * files whose provider family one of the peer's own rules targets
 * (`scanners/peer-rule-families.json`, the same map `/report` uses): where a tool's rules
 * point, never a claim that it supports the format.
 *
 * Personal data has no accuracy corpus. Its view shows the recorded runtime comparison's
 * made-up texts (evidence/562) as a preview, counted as files of a line, never as a rate
 * where the expected answer depends on the tool's own rule.
 */
import type { SegmentedNavItem } from '../components/nav/SegmentedNav';
import type {
  AccuracyBarRow, AccuracyDifferenceColumn, AccuracyDifferencesData, AccuracyQuestionData, AccuracyResultData, AccuracySide, AccuracySource, AccuracyState,
} from '../components/comparison/accuracyTypes';
import type { AccuracyPairComparisonProps } from '../components/comparison/AccuracyPairComparison';
import type { Catalog, CatalogFixture } from '../services/catalog';
import type { PeerProfile } from '../services/peers';
import type { MeasuredRun, RowResult, RunScanner } from '../services/run';
import type { ComparisonRun, ComparisonWorkload, RuntimeComparison } from '../services/runtime';
import { NOT_PROVIDER_SPECIFIC } from './families';
import { count, int, isoDate } from './format';
import { LEVELS, LEVEL_SHORT, modeText, type Level } from './report';
import { fixtureHref } from './rows';

const PRODUCT = 'redact-secret';
const ACCURACY = '/comparison/accuracy/';
export const FEW_FILES = 20;
/** Providers a difference list shows before "Show all". */
export const GROUPS_SHOWN = 40;

export type PairDomain = 'credentials' | 'pii';
export type PairScope = 'all' | 'listed';
export const DOMAINS: PairDomain[] = ['credentials', 'pii'];
export const SCOPES: PairScope[] = ['all', 'listed'];

/** The tools each data view offers, in run order. Empty when the run has none. */
export type PairOptions = Record<PairDomain, string[]>;

// ---- The address ----------------------------------------------------------------------

/** `?data=credentials|pii&with=<tool>&level=T1|T2|T3&scope=all|listed&peers=1`. Defaults are left out. */
export interface PairQuery { domain: PairDomain; with: string; level: Level; scope: PairScope; peers: boolean }

export function pairQueryOf(params: { get(name: string): string | null }, options: PairOptions): PairQuery {
  const domain: PairDomain = params.get('data') === 'pii' ? 'pii' : 'credentials';
  const offered = options[domain];
  const asked = params.get('with');
  const level = params.get('level');
  const scope = params.get('scope');
  return {
    domain,
    with: asked !== null && offered.includes(asked) ? asked : offered[0] ?? '',
    level: level === 'T2' || level === 'T3' ? level : 'T1',
    scope: scope === 'listed' ? 'listed' : 'all',
    peers: params.get('peers') === '1',
  };
}

/** What the query reduces to on the page that draws it: Personal data ignores level, scope and peers. */
export function normalise(query: PairQuery): PairQuery {
  return query.domain === 'pii' ? { ...query, level: 'T1', scope: 'all', peers: false } : { ...query, peers: query.level === 'T3' && query.peers };
}

export const defaultQuery = (options: PairOptions): PairQuery => ({ domain: 'credentials', with: options.credentials[0] ?? '', level: 'T1', scope: 'all', peers: false });

/** The key of the panel a query shows: `credentials.gitleaks.T1.all.0`, `pii.flare-redact.-.-.-`. */
export function panelKey(query: PairQuery): string {
  const q = normalise(query);
  return q.domain === 'pii' ? `pii.${q.with || '-'}.-.-.-` : `credentials.${q.with || '-'}.${q.level}.${q.scope}.${q.peers ? 1 : 0}`;
}

export function pairSearch(query: PairQuery, options: PairOptions): string {
  const q = normalise(query);
  const base = defaultQuery(options);
  const params: string[] = [];
  if (q.domain === 'pii') params.push('data=pii');
  if (q.with && q.with !== (options[q.domain][0] ?? '')) params.push(`with=${encodeURIComponent(q.with)}`);
  if (q.domain === 'credentials') {
    if (q.level !== base.level) params.push(`level=${q.level}`);
    if (q.scope !== base.scope) params.push(`scope=${q.scope}`);
    if (q.peers) params.push('peers=1');
  }
  return params.length ? `?${params.join('&')}` : '';
}
export const pairHref = (query: PairQuery, options: PairOptions): string => `${ACCURACY}${pairSearch(query, options)}`;

/**
 * Runs before first paint on a direct visit: the same rule as `pairQueryOf` and `panelKey`, as
 * plain script, so the URL picks one pre-rendered panel with no flash of another. It always sets
 * the key, defaults included, so the stylesheet shows exactly one panel.
 */
export const pairScript = (options: PairOptions): string =>
  `(function(){var o=${JSON.stringify(options)},p=new URLSearchParams(location.search),d=p.get('data')==='pii'?'pii':'credentials',a=o[d],w=p.get('with'),l=p.get('level'),s=p.get('scope'),r=document.documentElement;` +
  "w=w!==null&&a.indexOf(w)>=0?w:(a[0]||'');if(!w)w='-';" +
  "if(d==='pii'){r.dataset.accKey='pii.'+w+'.-.-.-';return;}" +
  "l=l==='T2'||l==='T3'?l:'T1';s=s==='listed'?'listed':'all';" +
  "r.dataset.accKey='credentials.'+w+'.'+l+'.'+s+'.'+(l==='T3'&&p.get('peers')==='1'?1:0);})();";

// ---- Facts about the two sides ---------------------------------------------------------

/** Tool ids the run lists, in run order, that are not the product. */
export const peerIds = (run: MeasuredRun): string[] => run.scanners.filter(s => s.id !== PRODUCT).map(s => s.id);

const PRODUCT_JOB = 'Built to redact secrets from text at runtime: logs, prompts and tool output. Personal data only when switched on.';

/** Which of the states a file falls in for a question. `null` when the scanner recorded nothing usable for it. */
type FileState = 'H' | 'P' | 'R' | 'Q' | 'F';

export function stateOf(kind: 'r' | 'a', row: RowResult | undefined): FileState | null {
  if (!row) return null;
  if (kind === 'r') {
    const spans = row.spanOutcomes;
    if (!spans) return null;
    if (spans.includes('MISS')) return 'R';
    return spans.includes('PARTIAL') ? 'P' : 'H';
  }
  return row.flagged === undefined ? null : row.flagged ? 'F' : 'Q';
}

/** Which question a fixture answers, or `null` for one nobody scores (pending review). */
export function questionOf(f: CatalogFixture): 'r' | 'a' | null {
  if (f.tier !== 'T1' && f.tier !== 'T2' && f.tier !== 'T3') return null;
  return f.kind === 'must-not-flag' ? 'a' : 'r';
}

interface QuestionText { position: string; title: string; expect: string; okLabel: string; states: { key: FileState; label: string; shape: AccuracyState['shape'] }[] }
const QUESTIONS: Record<'r' | 'a', QuestionText> = {
  r: {
    position: '1 / 2', title: 'Secrets that must be hidden', expect: 'Expected: hidden', okLabel: 'hidden',
    states: [{ key: 'H', label: 'Hidden', shape: 'fill' }, { key: 'P', label: 'Partly readable', shape: 'hatch' }, { key: 'R', label: 'Readable', shape: 'outline' }],
  },
  a: {
    position: '2 / 2', title: 'Safe text that must be left alone', expect: 'Expected: left alone', okLabel: 'left alone',
    states: [{ key: 'Q', label: 'Left alone', shape: 'fill' }, { key: 'F', label: 'Flagged', shape: 'outline' }],
  },
};
const WHAT: Record<Level, Record<'r' | 'a', string>> = {
  T1: { r: 'Secrets in formats the provider itself documents.', a: 'Look-alikes, placeholders and near misses of provider-documented formats.' },
  T2: { r: 'Secrets whose format is backed by a scanner’s rules, with no provider documentation.', a: 'Look-alikes and near misses of those formats.' },
  T3: { r: 'Values this project’s own masking policy hides.', a: 'Text this project’s policy leaves alone.' },
};

/** "97%" for a share; never "100%" unless every file is, never "0%" unless none is. */
export function share(n: number, total: number): string {
  if (total <= 0) return '—';
  if (n === total) return '100%';
  if (n === 0) return '0%';
  const p = (n / total) * 100;
  if (p >= 99.5) return `${Math.floor(p * 10) / 10}%`;
  if (p < 0.5) return `${Math.max(0.1, Math.ceil(p * 10) / 10)}%`;
  return `${Math.round(p)}%`;
}

// ---- The credentials model -------------------------------------------------------------

/** Counts of one question for one pair at one level and scope, both sides over the same files. */
export interface QuestionCounts {
  /** Files both scanners have a usable row for. */
  total: number;
  /** One count per state of the question, in `QUESTIONS` order. */
  us: number[];
  them: number[];
  /** Files either scanner has no usable row for: left out, never a pass. */
  notMeasured: number;
  /** Files where exactly one of the two gave the expected answer. */
  differing: number;
}

export interface PairPeer {
  id: string;
  name: string;
  version: string;
  mode: string;
  status: string;
  /** "Output recorded 2026-09-29" or "Observed in this run, 2026-09-30". */
  recorded: string;
  profile: PeerProfile | undefined;
  /** Keyed `T1|all`: the two questions for one level and scope. */
  cells: Record<string, { r: QuestionCounts; a: QuestionCounts }>;
}

export interface DiffFixture { c: string; i: string; p: number; l: Level; q: 'r' | 'a' }
/** `[index into fixtures, 1 when only redact-secret gave the expected answer or 2 when only the other tool did, 1 when the peer's rules target the file]`. */
export type DiffEntry = [number, 1 | 2, 0 | 1];
/** Every file where the two differ, for every peer: what the island lists. Shipped once. */
export interface DiffData { providers: string[]; fixtures: DiffFixture[]; peers: Record<string, DiffEntry[]> }

export interface PairModel { peers: PairPeer[]; diff: DiffData; product: { version: string; mode: string; modeLine: string } }

const cellKey = (level: Level, scope: PairScope): string => `${level}|${scope}`;
const zero = (n: number): number[] => Array.from({ length: n }, () => 0);

function observedText(scanner: RunScanner): string {
  const snapshots = [...new Set(scanner.observations.filter(o => o.source === 'snapshot').map(o => isoDate(o.observedAt)))].sort();
  const fresh = [...new Set(scanner.observations.filter(o => o.source === 'fresh').map(o => isoDate(o.observedAt)))].sort();
  if (snapshots.length) return `Output recorded ${snapshots.join(', ')}, replayed while the inputs are unchanged`;
  if (fresh.length) return `Observed in this run, ${fresh.join(', ')}`;
  return 'No observation date recorded';
}

const providerOf = (catalog: Catalog, f: CatalogFixture): string => {
  const family = f.familyIds[0] ? catalog.familyById.get(f.familyIds[0]) : undefined;
  return family?.provider ? catalog.providerById.get(family.provider)?.name ?? NOT_PROVIDER_SPECIFIC.name : NOT_PROVIDER_SPECIFIC.name;
};

export function buildPairModel(catalog: Catalog, run: MeasuredRun, profiles: Map<string, PeerProfile>): PairModel {
  const ours = run.productRows;
  const providers: string[] = [];
  const providerIndex = new Map<string, number>();
  const fixtures: DiffFixture[] = [];
  const fixtureIndex = new Map<string, number>();
  const diffPeers: Record<string, DiffEntry[]> = {};

  const peers: PairPeer[] = run.scanners.filter(s => s.id !== PRODUCT).map(scanner => {
    const profile = profiles.get(scanner.id);
    const cells: PairPeer['cells'] = {};
    const cell = (level: Level, scope: PairScope) => (cells[cellKey(level, scope)] ??= {
      r: { total: 0, us: zero(QUESTIONS.r.states.length), them: zero(QUESTIONS.r.states.length), notMeasured: 0, differing: 0 },
      a: { total: 0, us: zero(QUESTIONS.a.states.length), them: zero(QUESTIONS.a.states.length), notMeasured: 0, differing: 0 },
    });
    for (const level of LEVELS) for (const scope of SCOPES) cell(level, scope);
    const entries: DiffEntry[] = [];
    const complete = scanner.status === 'complete';

    for (const f of catalog.fixtures) {
      const q = questionOf(f);
      if (!q) continue;
      const level = f.tier as Level;
      const targeted = !!profile && f.familyIds.some(id => profile.families.has(id));
      const a = stateOf(q, ours.get(f.slug));
      const b = complete ? stateOf(q, scanner.rows.get(f.slug)) : null;
      const scopes: PairScope[] = targeted ? ['all', 'listed'] : ['all'];
      if (a === null || b === null) {
        for (const scope of scopes) cell(level, scope)[q].notMeasured++;
        continue;
      }
      const states = QUESTIONS[q].states.map(s => s.key);
      const ok = states[0];
      const onlyUs = a === ok && b !== ok;
      const onlyThem = b === ok && a !== ok;
      for (const scope of scopes) {
        const c = cell(level, scope)[q];
        c.total++;
        c.us[states.indexOf(a)]++;
        c.them[states.indexOf(b)]++;
        if (onlyUs || onlyThem) c.differing++;
      }
      if (onlyUs || onlyThem) {
        let at = fixtureIndex.get(f.slug);
        if (at === undefined) {
          const name = providerOf(catalog, f);
          let p = providerIndex.get(name);
          if (p === undefined) { p = providers.length; providers.push(name); providerIndex.set(name, p); }
          at = fixtures.length;
          fixtures.push({ c: f.category, i: f.id, p, l: level, q });
          fixtureIndex.set(f.slug, at);
        }
        entries.push([at, onlyUs ? 1 : 2, targeted ? 1 : 0]);
      }
    }
    diffPeers[scanner.id] = entries;
    return {
      id: scanner.id, name: scanner.name, version: scanner.version ?? '', mode: scanner.mode, status: scanner.status,
      recorded: observedText(scanner), profile, cells,
    };
  });

  const mine = run.scanners.find(s => s.id === PRODUCT);
  return { peers, diff: { providers, fixtures, peers: diffPeers }, product: { version: mine?.version ?? run.productVersion ?? '', mode: mine?.mode ?? '', modeLine: modeText(run) } };
}

// ---- The difference lists (shared by the server's counts and the island) ----------------

export interface DifferenceGroup { name: string; files: { slug: string; href: string }[] }
export interface DifferenceLists { onlyUs: DifferenceGroup[]; onlyThem: DifferenceGroup[]; total: number }

/**
 * The files where the two differ for one question, in both directions, grouped by the
 * fixture's first provider. Providers are alphabetical and files alphabetical by id; never
 * sorted by how many there are.
 */
export function differencesOf(diff: DiffData, peer: string, level: Level, scope: PairScope, q: 'r' | 'a'): DifferenceLists {
  const by = { 1: new Map<string, { slug: string; href: string }[]>(), 2: new Map<string, { slug: string; href: string }[]>() };
  let total = 0;
  for (const [at, dir, targeted] of diff.peers[peer] ?? []) {
    const f = diff.fixtures[at];
    if (f.l !== level || f.q !== q || (scope === 'listed' && !targeted)) continue;
    total++;
    const name = diff.providers[f.p];
    const held = by[dir].get(name) ?? by[dir].set(name, []).get(name)!;
    held.push({ slug: f.i, href: fixtureHref({ category: f.c, id: f.i }) });
  }
  const groups = (m: Map<string, { slug: string; href: string }[]>): DifferenceGroup[] =>
    [...m.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([name, files]) => ({ name, files: files.sort((x, y) => x.slug.localeCompare(y.slug)) }));
  return { onlyUs: groups(by[1]), onlyThem: groups(by[2]), total };
}

const capital = (s: string): string => s[0].toUpperCase() + s.slice(1);
/** "TruffleHog’s", "Gitleaks’". */
const possessive = (name: string): string => (name.endsWith('s') ? `${name}’` : `${name}’s`);

/** The two columns of a difference list. A column whose `showAll` entry is false is cut to the first `GROUPS_SHOWN` providers. */
export function differenceColumns(lists: DifferenceLists, q: 'r' | 'a', peerName: string, showAll: boolean[]): AccuracyDifferenceColumn[] {
  const ok = QUESTIONS[q].okLabel;
  const column = (title: string, groups: DifferenceGroup[], all: boolean): AccuracyDifferenceColumn => {
    const shown = all ? groups : groups.slice(0, GROUPS_SHOWN);
    return {
      title, total: int(groups.reduce((n, g) => n + g.files.length, 0)),
      groups: shown.map(g => ({ name: g.name, count: int(g.files.length), files: g.files })),
      ...(shown.length < groups.length ? { more: `Show all ${int(groups.length)} providers` } : {}),
    };
  };
  return [column(`${capital(ok)} by ${PRODUCT} only`, lists.onlyUs, !!showAll[0]), column(`${capital(ok)} by ${peerName} only`, lists.onlyThem, !!showAll[1])];
}

// ---- Result rows ----------------------------------------------------------------------

function resultRow(name: string, version: string, counts: number[], total: number, q: QuestionText, pct: boolean): AccuracyResultData {
  const ok = counts[0];
  const states = q.states.map((s, i): AccuracyState => ({ label: s.label, count: int(counts[i]), shape: s.shape, weight: counts[i] }));
  return {
    name, version,
    figure: pct ? share(ok, total) : `${int(ok)} of ${int(total)}`,
    figureNote: pct ? `${int(ok)} of ${int(total)} ${q.okLabel}` : q.okLabel,
    states,
    stripLabel: `${name}: ${states.map(s => `${s.label} ${s.count}`).join(', ')}`,
  };
}

// ---- Panels ---------------------------------------------------------------------------

export interface PairPanel { key: string; query: PairQuery; isDefault: boolean; props: AccuracyPairComparisonProps; differences: Record<string, DifferencesSlot> }
/** What the island needs to list one question's differences. Absent when the two never differ. */
export interface DifferencesSlot { peer: string; peerName: string; level: Level; scope: PairScope; q: 'r' | 'a'; summary: string }

interface Context {
  options: PairOptions;
  model: PairModel | undefined;
  run: MeasuredRun | undefined;
  runtime: RuntimeComparison | undefined;
  toolNames: Record<string, string>;
}

const BREADCRUMB = [{ label: 'Comparison', href: '/comparison/' }, { label: 'Accuracy' }];
const TITLE = 'Put one tool next to redact-secret';
const LEDE = 'Pick a tool. Both read the same test files. Each question says what the file expects, and each tool gets its own row: how often it matched that answer. Nothing here is scored or ranked.';
const FIRST_CREDENTIALS = 'The redact-secret team wrote these test files and the expected answer for each, mostly to check formats redact-secret lists, and tuned redact-secret against them. A tool built for a different job can leave more of them readable. That describes scope. It is not a grade.';
const FIRST_PII = 'redact-secret finds personal data only when PII is switched on, and by its own rules it leaves values that standards reserve for examples alone. Other tools make other choices. Where they differ, that is a different rule, not a grade.';

function bar(ctx: Context, query: PairQuery, peerName: string): AccuracyBarRow[] {
  const q = normalise(query);
  const href = (next: Partial<PairQuery>): string => pairHref({ ...q, ...next }, ctx.options);
  const name = (id: string): string => ctx.toolNames[id] ?? id;
  const rows: AccuracyBarRow[] = [
    {
      label: 'Data',
      items: [
        { label: 'Credentials', href: href({ domain: 'credentials', with: ctx.options.credentials.includes(q.with) ? q.with : ctx.options.credentials[0] ?? '' }) },
        { label: 'Personal data (PII)', shortLabel: 'PII', href: href({ domain: 'pii', with: ctx.options.pii.includes(q.with) ? q.with : ctx.options.pii[0] ?? '' }) },
      ],
      currentHref: href({}),
    },
    {
      label: 'Compare with', ...(q.domain === 'pii' ? { sub: 'runtime libraries only' } : {}),
      items: ctx.options[q.domain].map((id): SegmentedNavItem => ({ label: name(id), href: href({ with: id }) })),
      currentHref: href({}),
    },
  ];
  if (q.domain === 'credentials') {
    rows.push(
      {
        label: 'Evidence',
        items: LEVELS.map((level): SegmentedNavItem => ({ label: `${LEVEL_SHORT[level] === 'Provider' ? 'Provider docs' : LEVEL_SHORT[level] === 'Tool' ? 'Tool rules' : 'Our policy'}`, href: href({ level, peers: false }) })),
        currentHref: href({}),
      },
      {
        label: 'Test files',
        items: [
          { label: 'All', href: href({ scope: 'all' }) },
          { label: 'Ones its rules target', shortLabel: 'Its rules', href: href({ scope: 'listed' }) },
        ],
        currentHref: href({}),
        hint: `Test files whose provider family is one that ${possessive(peerName)} own rules target, from the reviewed rule map. Where its rules point, not a claim that it supports the format.`,
      },
    );
  }
  return rows;
}

function side(kind: string, name: string, version: string, ran: string, recorded: string | undefined, job?: string): AccuracySide {
  return { kind, name, version, ran, ...(recorded ? { recorded } : {}), ...(job ? { job } : {}) };
}

function credentialsPanel(ctx: Context, query: PairQuery): PairPanel {
  const q = normalise(query);
  const key = panelKey(q);
  const isDefault = key === panelKey(defaultQuery(ctx.options));
  const base = { breadcrumb: BREADCRUMB, eyebrow: 'Comparison', title: TITLE, lede: LEDE, allScanners: { href: '/report/', label: 'All scanners at once →' } };
  const peer = ctx.model?.peers.find(p => p.id === q.with);
  if (!ctx.model || !ctx.run || !peer) {
    return {
      key, query: q, isDefault, differences: {},
      props: {
        ...base, bar: bar(ctx, q, ctx.toolNames[q.with] ?? 'the other tool'),
        notMeasured: {
          title: 'No benchmark results for this checkout',
          text: 'The corpus is here, but no scanner has run against it, so there is nothing to put side by side. This is not measured, not zero.',
          command: 'npm run bench',
        },
      },
    };
  }
  const { run, model } = ctx;
  const ours = side('Runtime library', PRODUCT, model.product.version, model.product.mode, `Measured in this run, ${isoDate(run.generatedAt)}`, PRODUCT_JOB);
  const kind = peer.profile?.kindLabel ?? 'Scanner';
  const theirs = side(kind, peer.name, peer.version, peer.mode, peer.recorded, peer.profile?.description);
  const head = { ...base, bar: bar(ctx, q, peer.name), pair: { ours, theirs }, first: FIRST_CREDENTIALS, meta: [{ label: 'Run', value: isoDate(run.generatedAt) }, { label: 'Mode', value: model.product.modeLine }] };

  const sources: AccuracySource[] = [
    { text: `redact-secret ${model.product.version} (${run.mode === 'candidate' ? `candidate build of main ${run.candidate?.sourceCommit.slice(0, 7) ?? ''}, unreleased` : 'published package'}), measured in the same run as this page: ${isoDate(run.generatedAt)}, run ${run.runId}.` },
    { text: `${peer.name} ${peer.version}: ${peer.recorded}.${peer.profile ? ` Version pinned in the repository; its own rules checked against the pinned rule file ${peer.profile.ruleFileVersion}, reviewed ${isoDate(peer.profile.reviewedAt)}.` : ''}` },
    { text: 'Evidence levels and file kinds are the ones on the report. The same rows feed it; this page regroups them by file, where the report counts spans, so a file with several secrets counts once here.', link: { href: '/report/', label: 'Open the report' } },
  ];

  if (peer.status !== 'complete') {
    return {
      key, query: q, isDefault, differences: {},
      props: {
        ...head, sources,
        notMeasured: { title: `${peer.name} did not complete in this run`, text: `Its status is “${peer.status}”, so its rows are not measured, not zero. Nothing is drawn for this pair.` },
      },
    };
  }
  if (q.level === 'T3' && !q.peers) {
    return {
      key, query: q, isDefault, differences: {},
      props: {
        ...head, sources,
        gate: {
          title: 'Hidden by default',
          text: 'Project policy is this project’s own masking rule. Other tools are not built to follow it, so a difference here reflects scope, not accuracy.',
          show: { label: 'Show anyway', href: pairHref({ ...q, peers: true }, ctx.options) },
        },
      },
    };
  }

  const cell = peer.cells[cellKey(q.level, q.scope)];
  const differences: Record<string, DifferencesSlot> = {};
  const questions: AccuracyQuestionData[] = (['r', 'a'] as const).map(kindKey => {
    const c = cell[kindKey];
    const text = QUESTIONS[kindKey];
    const scoped = q.scope === 'listed' ? `whose provider family one of ${possessive(peer.name)} rules targets` : '';
    const header = `${int(c.total)} test files${scoped ? ` ${scoped}` : ''}. ${WHAT[q.level][kindKey]}`;
    const id = `${key}.${kindKey}`;
    const question: AccuracyQuestionData = { id, position: text.position, title: text.title, description: header, expect: text.expect, results: [] };
    if (c.notMeasured > 0) question.notes = [`${count(c.notMeasured, 'test file')} left out: at least one of the two has no recorded result. Not measured, never counted as a pass or a zero.`];
    if (c.total === 0) {
      question.empty = c.notMeasured > 0 ? 'Nothing is measured for both tools here.' : q.scope === 'listed' ? `No test files at this level are ones ${possessive(peer.name)} rules target.` : 'No test files at this level.';
      return question;
    }
    const pct = c.total >= FEW_FILES;
    question.results = [resultRow(PRODUCT, model.product.version, c.us, c.total, text, pct), resultRow(peer.name, peer.version, c.them, c.total, text, pct)];
    if (!pct) question.readout = `Fewer than ${FEW_FILES} files, so counts only.`;
    if (c.differing > 0) {
      differences[id] = { peer: peer.id, peerName: peer.name, level: q.level, scope: q.scope, q: kindKey, summary: `Show the ${int(c.differing)} files with different results` };
    }
    return question;
  });
  return { key, query: q, isDefault, differences, props: { ...head, questions, sources } };
}

// ---- Personal data --------------------------------------------------------------------

const PII_TEXT: Record<string, { title: string; expect: string; description: string; pct: boolean }> = {
  'real-looking-values': { title: 'Personal data that looks real', expect: 'Expected: hidden', description: 'Made-up emails, cards, bank accounts, phone numbers and a US SSN that look like the real thing.', pct: false },
  'validator-heavy': { title: 'Values made for examples, or failing a basic check', expect: 'Expected: depends on the rule, so no percentage', description: 'Standards reserve some of these for examples: example.com, 555 phone numbers, documentation IP ranges, test card numbers. redact-secret leaves reserved values alone on purpose. Other tools may hide them on purpose. Neither is marked right here.', pct: false },
  'multilingual-context': { title: 'Values with words around them', expect: 'Expected: depends on the rule, so no percentage', description: 'The same kind of made-up values next to English and Korean labels, and next to words like “example” that say they are not real.', pct: false },
};
const PII_STATES = [{ key: 'H' as const, label: 'Hidden', shape: 'fill' as const }, { key: 'L' as const, label: 'Left some or all', shape: 'outline' as const }];
const PII_SETTING = 'pii-global-us';

/** Did the call hide every value of line `index`? `undefined` when the run recorded nothing for it. */
function hidAll(run: ComparisonRun, tool: string, workload: ComparisonWorkload, index: number): boolean | undefined {
  const recorded = run.outcomes[`${tool}/${workload.id}`]?.[index];
  return recorded ? recorded.valuesHidden === workload.lines[index].values.length : undefined;
}

function piiPanel(ctx: Context, query: PairQuery): PairPanel {
  const q = normalise(query);
  const key = panelKey(q);
  const isDefault = key === panelKey(defaultQuery(ctx.options));
  const cmp = ctx.runtime;
  const setting = cmp?.settings.find(s => s.id === PII_SETTING);
  const run = setting?.run.state === 'measured' ? setting.run : undefined;
  const name = ctx.toolNames[q.with] ?? q.with;
  const base = { breadcrumb: BREADCRUMB, eyebrow: 'Comparison', title: TITLE, lede: LEDE, allScanners: { href: '/report/', label: 'All scanners at once →' }, bar: bar(ctx, q, name) };
  if (!cmp || !run || !q.with || !run.tools.some(t => t.id === q.with)) {
    return {
      key, query: q, isDefault, differences: {},
      props: {
        ...base, first: FIRST_PII,
        notMeasured: {
          title: 'Not measured',
          text: `No personal-data accuracy corpus has been run against other tools, and the recorded runtime comparison does not cover ${name || 'this tool'}. Nothing is shown rather than a guess.`,
        },
      },
    };
  }
  const tool = (id: string) => run.tools.find(t => t.id === id)!;
  const us = tool(PRODUCT);
  const them = tool(q.with);
  const activation = setting!.selectors.length ? `PII switched on (${setting!.selectors.join(', ')})` : 'PII off';
  const pair = {
    ours: side('Runtime library', PRODUCT, us.version, `${activation}${us.buildKind === 'local-source-build' ? ' · local build of main, unreleased' : ' · published package'}`, `Run ${isoDate(run.generatedAt)}`),
    theirs: side('Runtime library', name, them.version, `Defaults${them.buildKind === 'local-source-build' ? ' · local build' : ' · published package'}`, `Run ${isoDate(run.generatedAt)}`),
  };
  const workloads = cmp.workloads.filter(w => w.domain === 'pii');
  const questions: AccuracyQuestionData[] = workloads.map((w, i) => {
    const text = PII_TEXT[w.id] ?? { title: w.question, expect: 'Expected: depends on the rule, so no percentage', description: w.description, pct: false };
    const lines = w.lines.map((line, index) => ({ label: line.label, us: hidAll(run, PRODUCT, w, index), them: hidAll(run, q.with, w, index) }));
    const usable = lines.filter(l => l.us !== undefined && l.them !== undefined);
    const tally = (pick: (l: (typeof lines)[number]) => boolean | undefined) => [usable.filter(l => pick(l) === true).length, usable.filter(l => pick(l) === false).length];
    const row = (nameOf: string, version: string, counts: number[]): AccuracyResultData => {
      const states = PII_STATES.map((s, n): AccuracyState => ({ label: s.label, count: int(counts[n]), shape: s.shape, weight: counts[n] }));
      return {
        name: nameOf, version, figure: text.pct ? share(counts[0], usable.length) : `${int(counts[0])} of ${int(usable.length)}`,
        figureNote: text.pct ? `${int(counts[0])} of ${int(usable.length)} hidden` : 'hidden', states,
        stripLabel: `${nameOf}: ${states.map(s => `${s.label} ${s.count}`).join(', ')}`,
      };
    };
    const onlyUs = usable.filter(l => l.us === true && l.them === false).map(l => l.label);
    const onlyThem = usable.filter(l => l.us === false && l.them === true).map(l => l.label);
    const flat = (title: string, labels: string[]): AccuracyDifferenceColumn => ({ title, total: int(labels.length), groups: labels.length ? [{ name: '', count: int(labels.length), files: labels.map(label => ({ slug: label })) }] : [] });
    const differences: AccuracyDifferencesData | undefined = onlyUs.length || onlyThem.length
      ? { columns: [flat('Hidden by redact-secret only', onlyUs), flat(`Hidden by ${name} only`, onlyThem)], none: 'None here.' } : undefined;
    return {
      id: `${key}.${w.id}`, position: `${i + 1} / ${workloads.length}`, title: text.title,
      description: `${int(w.lines.length)} texts. ${text.description}`, expect: text.expect,
      results: usable.length ? [row(PRODUCT, us.version, tally(l => l.us)), row(name, them.version, tally(l => l.them))] : [],
      ...(!usable.length ? { empty: 'Nothing is recorded for both tools here.' } : {}),
      ...(usable.length < w.lines.length ? { notes: [`${count(w.lines.length - usable.length, 'text')} left out: no recorded result for one of the two.`] } : {}),
      ...(differences ? { differences } : {}),
    };
  });
  return {
    key, query: q, isDefault, differences: {},
    props: {
      ...base, pair, first: FIRST_PII,
      preview: 'Preview, not yet a measurement. No personal-data accuracy corpus has been run against other tools. These are the made-up texts from the runtime comparison, counted by text. The page shows Not measured here until a corpus plan with peer runs exists.',
      questions,
      sources: [
        { text: `redact-secret ${us.version} with ${setting!.selectors.join(' and ') || 'no PII selectors'}, and ${name} ${them.version} at its defaults, each on the same made-up texts, run ${isoDate(run.generatedAt)} (${run.path}). The inputs are described by kind only; their text is never published.` },
        { text: '“Hidden” means every value in the text came back replaced. Partly hidden counts as “Left some or all”.' },
        { text: 'The same texts and outcomes, with times, are on the runtime comparison.', link: { href: '/comparison/runtime/', label: 'Open the runtime comparison' } },
      ],
    },
  };
}

// ---- The page -------------------------------------------------------------------------

export interface AccuracyPage { options: PairOptions; panels: PairPanel[]; diff: DiffData | undefined }

export interface AccuracyInput {
  catalog: Catalog;
  run: MeasuredRun | undefined;
  profiles: Map<string, PeerProfile>;
  runtime: RuntimeComparison | undefined;
  /** Display names by tool id (`toolName` of the runtime resolvers for the runtime libraries). */
  toolNames?: Record<string, string>;
}

const DISPLAY: Record<string, string> = { openredaction: 'OpenRedaction' };

export function resolveAccuracyPage({ catalog, run, profiles, runtime, toolNames = {} }: AccuracyInput): AccuracyPage {
  const model = run ? buildPairModel(catalog, run, profiles) : undefined;
  const names: Record<string, string> = { ...DISPLAY, ...Object.fromEntries((run?.scanners ?? []).map(s => [s.id, s.name])), ...toolNames };
  const piiRun = runtime?.settings.find(s => s.id === PII_SETTING)?.run;
  const piiTools = piiRun?.state === 'measured' ? piiRun.tools.map(t => t.id).filter(id => id !== PRODUCT) : [];
  const options: PairOptions = {
    credentials: model ? model.peers.map(p => p.id) : [],
    // Runtime libraries the recorded comparison covers, in its order.
    pii: piiTools.filter(id => (profiles.get(id)?.kind ?? 'runtime-library') === 'runtime-library'),
  };
  const ctx: Context = { options, model, run, runtime, toolNames: names };
  const panels: PairPanel[] = [];
  const credentialPeers = options.credentials.length ? options.credentials : [''];
  for (const id of credentialPeers) {
    // Without a run there is one notice, not a grid of identical ones.
    for (const level of model ? LEVELS : LEVELS.slice(0, 1)) for (const scope of model ? SCOPES : SCOPES.slice(0, 1)) {
      for (const peers of model && level === 'T3' ? [false, true] : [false]) panels.push(credentialsPanel(ctx, { domain: 'credentials', with: id, level, scope, peers }));
    }
  }
  for (const id of options.pii.length ? options.pii : ['']) panels.push(piiPanel(ctx, { domain: 'pii', with: id, level: 'T1', scope: 'all', peers: false }));
  return { options, panels, diff: model?.diff };
}

