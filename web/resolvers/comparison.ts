/**
 * The `/comparison` pages, resolved to block props. Pure.
 *
 * Boundary rule: every value shown is one the ledger recorded (the runtime
 * snapshot, the feature claims file, the run). Nothing is ranked, graded or
 * called better; a value that was not recorded resolves to a stated "not
 * measured" state, never to a zero or a guess.
 */
import type { ComparisonQuestion, FeatureFilter, Principle, RunLine, RuntimeColumn, RuntimeFactRow, RuntimeQuestion, RuntimeTiming, RuntimeView, ToolKind } from '../components/comparison/types';
import type { ComparisonHubProps } from '../components/comparison/ComparisonHub';
import type { FeatureComparisonProps } from '../components/comparison/FeatureComparison';
import type { RuntimeComparisonProps } from '../components/comparison/RuntimeComparison';
import type { FeatureClaims, FeatureClaimsLoad } from '../services/features';
import type { PeerRuntime, RuntimeTool, RuntimeWorkload } from '../services/runtime';
import type { RunLoad } from '../services/run';
import { count, int, isoDate } from './format';
import { levelLinks, modeText } from './report';

const fixed = (n: number, digits: number) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "6.9" under 100 ms, "307" and "1,087" above: three figures are enough to read a time. */
export const milliseconds = (ms: number): string => (ms < 100 ? fixed(ms, 1) : fixed(ms, 0));
/** Megabytes (10^6 bytes) per second, one decimal, as the existing site shows them. */
export const megabytesPerSecond = (bytesPerSecond: number): string => fixed(bytesPerSecond / 1e6, 1);
export const kibibytes = (bytes: number): string => `${fixed(bytes / 1024, 1)} KiB`;

const DISPLAY: Record<string, string> = { 'redact-secret': 'redact-secret', 'flare-redact': 'flare-redact', openredaction: 'OpenRedaction' };
export const toolName = (id: string): string => DISPLAY[id] ?? id;

const COMPARISON = '/comparison/';
const RUNTIME = '/comparison/runtime/';
const FEATURE = '/comparison/feature/';

// ---- Hub -----------------------------------------------------------------------

const buildText = (t: RuntimeTool): string => (t.buildKind === 'local-source-build' ? ' (local build, unreleased)' : '');
const versionsOf = (tools: RuntimeTool[]): string => tools.filter(t => t.version).map(t => `${toolName(t.id)} ${t.version}${buildText(t)}`).join(', ');
const featureRows = (claims: FeatureClaims) => claims.groups.flatMap(g => g.rows);

export interface HubInput { runtime: PeerRuntime; features: FeatureClaimsLoad; run: RunLoad }

export function resolveHub({ runtime, features, run }: HubInput): ComparisonHubProps {
  const measured = runtime.measurement.state === 'measured';
  const tools = runtime.tools.map(t => toolName(t.id));
  const claims = features.state === 'recorded' ? features.claims : undefined;
  const rows = claims ? featureRows(claims) : [];
  const tested = rows.filter(r => Object.values(r.cells).some(c => c.tested)).length;

  const questions: ComparisonQuestion[] = [
    {
      href: RUNTIME, label: 'Runtime', title: 'How fast is each one, and what does it hide?',
      description: 'Time on the same text for each library. What each one hid is not recorded yet.',
      tools,
      fact: measured ? `${count(runtime.workloads.length, 'test text')}` : 'Not measured yet',
      factNote: measured ? 'personal data, made up' : 'no snapshot committed',
      action: 'Runtime comparison →',
    },
    {
      href: FEATURE, label: 'Features', title: 'What can each one do?',
      description: 'What each project’s own documentation says it can do, one row per feature.',
      tools,
      fact: claims ? count(rows.length, 'feature') : 'Not recorded yet',
      factNote: claims ? `${int(tested)} checked by us` : 'no documentation read into the ledger',
      action: 'Feature comparison →',
    },
    {
      href: '/report/', label: 'Accuracy', title: 'Does it miss real secrets, or flag safe values?',
      description: 'How often each scanner lets a secret through or flags something harmless, on the same synthetic inputs, with the rows behind every number.',
      tools: run.state === 'measured' ? run.scanners.map(s => s.name) : ['redact-secret'],
      fact: `${count(levelLinks().length, 'evidence level')}`,
      factNote: levelLinks().map(l => l.shortLabel.toLowerCase()).join(', '),
      action: 'Accuracy report →',
    },
  ];

  const kinds: ToolKind[] = [
    {
      name: 'Runtime libraries',
      description: 'Run inside your app and hide sensitive text as it passes through: logs, prompts, tool results.',
      tools: runtime.tools.map(t => ({ name: toolName(t.id), ...(t.package !== toolName(t.id) ? { detail: t.package } : {}) })),
      comparedIn: 'Compared in Runtime and Features. Also in Accuracy, next to the scanners.',
    },
    {
      name: 'Repository scanners',
      description: 'Look through code, files and git history for secrets that were already committed.',
      tools: [{ name: 'Gitleaks', detail: 'command line' }, { name: 'TruffleHog', detail: 'command line' }],
      comparedIn: 'Compared in Accuracy only. They scan files and history, not text at runtime, so they have no runtime numbers.',
    },
  ];

  const principles: Principle[] = [
    { title: 'Same input', description: 'Every tool gets exactly the same text.' },
    { title: 'Made-up data', description: 'No real person, account or key. Ever.' },
    { title: 'Pinned versions', description: 'Each result names the version and the date it ran.' },
    { title: 'No ranking', description: 'We record what happened. We never pick a winner.' },
  ];

  const runs: RunLine[] = [
    {
      label: 'Runtime',
      detail: runtime.measurement.state === 'measured' ? `${isoDate(runtime.measurement.generatedAt)} · ${versionsOf(runtime.tools)}` : 'not measured yet',
    },
    {
      label: 'Features',
      detail: claims ? `docs read ${claims.readOn}, ${claims.libraries.map(l => `${l.name} ${l.version}`).join(', ')}` : 'not recorded yet',
    },
    {
      label: 'Accuracy',
      detail: run.state === 'measured' ? `${isoDate(run.generatedAt)} · ${modeText(run)}` : 'no benchmark run for this checkout',
    },
  ];

  return {
    eyebrow: 'Comparison',
    title: 'How does redact-secret compare?',
    lede: 'Pick the question you came with. Each page shows what was recorded, in the same order for every tool.',
    questions,
    kindsTitle: 'Two kinds of tool',
    kindsIntro: 'A runtime library and a repository scanner do different jobs, so each is compared only where the comparison means something.',
    kinds,
    methodTitle: 'How we compare',
    principles,
    runsLabel: 'Latest runs',
    runs,
  };
}

// ---- Feature -------------------------------------------------------------------

export type FeatureViewProps = Omit<FeatureComparisonProps, 'filter' | 'onFilterChange'>;

export type FeaturePage =
  | { state: 'recorded'; view: FeatureViewProps }
  | { state: 'empty'; breadcrumb: FeatureViewProps['breadcrumb']; eyebrow: string; title: string; lede: string; notice: { title: string; text: string }; runtime: { href: string; label: string } };

const CRUMBS = [{ label: 'Comparison', href: COMPARISON }, { label: 'Feature' }];
const FEATURE_LEDE = 'What each project says it can do, from its own documentation.';

export function resolveFeaturePage(load: FeatureClaimsLoad): FeaturePage {
  const runtime = { href: RUNTIME, label: 'Runtime comparison →' };
  if (load.state !== 'recorded') {
    return {
      state: 'empty', breadcrumb: CRUMBS, eyebrow: 'Comparison', title: 'Feature comparison', lede: FEATURE_LEDE, runtime,
      notice: {
        title: load.state === 'invalid' ? 'The feature claims did not validate' : 'No feature claims recorded yet',
        text: load.state === 'invalid'
          ? `${load.reason} Nothing from it is shown.`
          : `${load.reason} A row appears here only when a project’s documentation, read at a stated version and date, says it, and “tested” only where a committed test checks it. Nothing is filled in from memory.`,
      },
    };
  }
  const { claims } = load;
  return {
    state: 'recorded',
    view: {
      breadcrumb: CRUMBS,
      eyebrow: 'Comparison',
      title: 'Feature comparison',
      lede: `${FEATURE_LEDE} Read on ${claims.readOn}. A mark means listed only; “tested” means a committed test checks it.`,
      runtime,
      libraries: claims.libraries,
      groups: claims.groups.map(g => ({
        label: g.label,
        rows: g.rows.map(r => {
          const marks = claims.libraries.map(l => r.cells[l.id]?.mark);
          return { id: r.id, label: r.label, same: marks.every(m => m !== undefined && m === marks[0]), cells: r.cells };
        }),
      })),
      sourcesTitle: 'Where this comes from',
      sources: claims.sources,
    },
  };
}

export const featureFilterOf = (params: URLSearchParams): FeatureFilter => (params.get('rows') === 'differences' ? 'differences' : 'all');
export const featureFilterString = (filter: FeatureFilter): string => (filter === 'differences' ? '?rows=differences' : '');

// ---- Runtime -------------------------------------------------------------------

export type Analysis = 'internal' | 'external';
export type Domain = 'credentials' | 'pii';
export const ANALYSES: Analysis[] = ['internal', 'external'];
export const DOMAINS: Domain[] = ['credentials', 'pii'];
export const VIEWS: RuntimeView[] = ['all', 'speed', 'accuracy'];
export const analysisOf = (value: string | null): Analysis => (value === 'internal' ? 'internal' : 'external');
export const domainOf = (value: string | null): Domain => (value === 'credentials' ? 'credentials' : 'pii');
export const viewOf = (value: string | null): RuntimeView => (value === 'speed' || value === 'accuracy' ? value : 'all');

export interface RuntimePanel {
  /** `external-pii-speed`, or `internal-pii` for a panel that has no view switch. */
  key: string;
  analysis: Analysis;
  domain: Domain;
  /** `null` for a panel with nothing to switch between (it shows at every view). */
  view: RuntimeView | null;
  props: RuntimeComparisonProps;
}

/** The two questions the plan's workloads answer. Text is the design's; an unknown workload falls back to its id and purpose. */
const WORKLOAD_TEXT: Record<string, { question: string; description: string }> = {
  'validator-heavy': {
    question: 'Does it redact fake values?',
    description: 'Values made for examples and testing, like example.com emails and test card numbers, plus look-alikes that fail a basic check.',
  },
  'multilingual-context': {
    question: 'Does it understand context?',
    description: 'The same kind of fake values, now next to English and Korean labels, and next to words like “example” that say it is not real.',
  },
};

const CREDENTIAL_QUESTIONS = [
  { question: 'Does it catch real secrets?', description: 'Made-up API keys and tokens in the places people paste them: a .env file, a command line, an HTTP header.' },
  { question: 'Does it redact fake secrets?', description: 'Placeholders like YOUR_TOKEN_HERE, keys that are public by design, and look-alikes that are too short or use the wrong letters.' },
  { question: 'Does it understand context?', description: 'Real secrets inside sentences, logs and code, next to look-alikes whose surroundings say they are not secrets.' },
];

const NOT_MEASURED = {
  credentials: 'No credential text has been timed across these libraries, and none has been timed for redact-secret’s own settings. redact-secret’s own credential speed is on the Performance page. How well scanners find secrets is in the report.',
  internal: 'No timing is recorded for redact-secret’s own settings (default, PII, PII plus US) on this text. The one PII setting that was timed, pii:global, is under External.',
  notPublished: 'No runtime comparison has been committed yet. It needs a redact-secret Node add-on built from source, so it is recorded by hand and published as a snapshot.',
};

const repeatText = (w: RuntimeWorkload): string => (w.lineCount % w.distinctLines === 0 ? `each line repeated ${int(w.lineCount / w.distinctLines)} times` : `${int(w.lineCount)} lines`);

const hrefFor = (analysis: Analysis, domain: Domain, view: RuntimeView = 'all'): string =>
  `${RUNTIME}?analysis=${analysis}&domain=${domain}${view === 'all' ? '' : `&view=${view}`}`;

const switches = (analysis: Analysis, domain: Domain): RuntimeComparisonProps['switches'] => ({
  analysis: {
    label: 'Analysis',
    items: [{ label: 'Internal', href: hrefFor('internal', domain) }, { label: 'External', href: hrefFor('external', domain) }],
    currentHref: hrefFor(analysis, domain),
  },
  domain: {
    label: 'Kind of data',
    items: [{ label: 'Credentials', href: hrefFor(analysis, 'credentials') }, { label: 'PII', href: hrefFor(analysis, 'pii') }],
    currentHref: hrefFor(analysis, domain),
  },
});

function timingFor(runtime: PeerRuntime, tool: string, workload: string): RuntimeTiming | null {
  if (runtime.measurement.state !== 'measured') return null;
  const o = runtime.measurement.observations.find(x => x.tool === tool && x.workload === workload);
  return o ? { medianMs: milliseconds(o.medianMs), throughput: megabytesPerSecond(o.medianBytesPerSecond) } : null;
}

function piiQuestions(runtime: PeerRuntime, key: string, notMeasured?: string): RuntimeQuestion[] {
  return runtime.workloads.map((w, i) => {
    const text = WORKLOAD_TEXT[w.id] ?? { question: w.id, description: w.purpose };
    const observed = runtime.measurement.state === 'measured' ? runtime.measurement.observations.find(o => o.workload === w.id) : undefined;
    return {
      id: `${key}-${w.id}`,
      position: `${i + 1} / ${runtime.workloads.length}`,
      question: text.question,
      description: text.description,
      workload: w.id,
      ...(observed ? { size: kibibytes(observed.workloadBytes) } : {}),
      repeat: repeatText(w),
      ...(notMeasured ? { notMeasured } : {}),
      // The snapshot records times, not what each call did to each value.
      outcomesRecorded: false,
      rows: [],
      hidden: {},
      timing: Object.fromEntries(runtime.tools.map(t => [t.id, timingFor(runtime, t.id, w.id)])),
    };
  });
}

const libraryColumns = (runtime: PeerRuntime): RuntimeColumn[] =>
  runtime.tools.map(t => ({ id: t.id, name: toolName(t.id), ...(t.piiSelectors.length ? { sub: t.piiSelectors.join(', ') } : {}) }));

function libraryFacts(runtime: PeerRuntime): RuntimeFactRow[] {
  const by = (cell: (t: RuntimeTool) => RuntimeFactRow['cells'][string]) => Object.fromEntries(runtime.tools.map(t => [t.id, cell(t)]));
  return [
    { label: 'Version', cells: by(t => (t.version ? { text: t.version, chip: t.buildKind === 'local-source-build' ? 'local build · unreleased' : 'npm' } : null)) },
    { label: 'Package', cells: by(t => ({ text: t.package })) },
    { label: 'Call timed', cells: by(t => ({ text: `${t.call}()`, note: t.async ? 'asynchronous: returns a Promise' : 'synchronous' })) },
  ];
}

/** "email, iban, network address" from `families=pii:global:email,pii:global:iban,...` as the snapshot recorded it. */
export function activeFamilies(piiActivation: string | undefined): string[] {
  const list = /(?:^|;)families=([^;]*)/.exec(piiActivation ?? '')?.[1];
  return list ? list.split(',').map(f => f.replace(/^pii:[^:]+:/, '').replace(/-/g, ' ')).filter(Boolean) : [];
}

export function resolveRuntimePanels(runtime: PeerRuntime): RuntimePanel[] {
  const { measurement } = runtime;
  const measured = measurement.state === 'measured' ? measurement : undefined;
  const externalNote = measurement.state === 'invalid' ? measurement.reason : measurement.state === 'not-published' ? NOT_MEASURED.notPublished : undefined;
  const head = (analysis: Analysis, domain: Domain): Pick<RuntimeComparisonProps, 'breadcrumb' | 'eyebrow' | 'title' | 'lede' | 'switches'> => ({
    breadcrumb: [{ label: 'Comparison', href: COMPARISON }, { label: 'Runtime' }],
    eyebrow: 'Comparison',
    title: 'Runtime comparison',
    lede: 'How long one redact call takes on the same made-up text. What each library hid is not recorded yet. Nothing here is ranked.',
    switches: switches(analysis, domain),
  });

  const runMeta: RuntimeComparisonProps['run'] = measured ? [
    { label: 'Run', value: isoDate(measured.generatedAt) },
    { value: `${measured.runner.platform} ${measured.runner.arch} · Node ${measured.runner.node}` },
    { value: `Each time is the middle of ${int(measured.samplesPerCell)} runs` },
    ...(runtime.tools.some(t => t.buildKind === 'local-source-build')
      ? [{ label: 'Build', value: `${runtime.tools.filter(t => t.buildKind === 'local-source-build').map(t => toolName(t.id)).join(', ')} from a local build of main, unreleased; the others from npm` }] : []),
  ] : undefined;

  const external = libraryColumns(runtime);
  const internalColumns: RuntimeColumn[] = [{ id: 'pii', name: 'PII', sub: runtime.tools.find(t => t.id === 'redact-secret')?.piiSelectors.join(', ') || undefined }];
  const families = activeFamilies(runtime.tools.find(t => t.id === 'redact-secret')?.piiActivation);
  const internalFacts: RuntimeFactRow[] = families.length
    ? [{ label: 'Turns on', cells: { pii: { text: `${runtime.tools.find(t => t.id === 'redact-secret')?.piiSelectors.join(', ')}: ${families.join(', ')}` } } }]
    : [];

  const panels: RuntimePanel[] = [];

  // External, PII: the one measured surface. Three views.
  for (const view of VIEWS) {
    const key = `external-pii-${view}`;
    panels.push({
      key, analysis: 'external', domain: 'pii', view,
      props: {
        ...head('external', 'pii'),
        toolbar: {
          views: [
            { label: 'All', href: hrefFor('external', 'pii') },
            { label: 'Speed', href: hrefFor('external', 'pii', 'speed') },
            { label: 'Accuracy', href: hrefFor('external', 'pii', 'accuracy') },
          ],
          currentHref: hrefFor('external', 'pii', view),
          view,
        },
        columns: external,
        columnKind: 'library',
        questions: piiQuestions(runtime, key, externalNote),
        factsTitle: 'About the libraries',
        factColumns: external.map(c => ({ id: c.id, name: c.name })),
        facts: libraryFacts(runtime),
        run: runMeta,
        notes: measured?.methodologyNotes,
      },
    });
  }

  // Internal, PII: nothing timed per setting yet.
  panels.push({
    key: 'internal-pii', analysis: 'internal', domain: 'pii', view: null,
    props: {
      ...head('internal', 'pii'),
      columns: internalColumns,
      columnKind: 'redact-secret setting',
      questions: piiQuestions(runtime, 'internal-pii', NOT_MEASURED.internal),
      factsTitle: 'About the settings',
      factColumns: internalColumns.map(c => ({ id: c.id, name: c.name, sub: c.sub })),
      facts: internalFacts,
    },
  });

  // Credentials: no workload has been timed across libraries or settings.
  for (const analysis of ANALYSES) {
    const key = `${analysis}-credentials`;
    const columns = analysis === 'external' ? external : internalColumns;
    panels.push({
      key, analysis, domain: 'credentials', view: null,
      props: {
        ...head(analysis, 'credentials'),
        columns,
        columnKind: analysis === 'external' ? 'library' : 'redact-secret setting',
        questions: CREDENTIAL_QUESTIONS.map((q, i) => ({
          id: `${key}-c${i}`, position: `${i + 1} / ${CREDENTIAL_QUESTIONS.length}`, ...q, notMeasured: NOT_MEASURED.credentials,
          rows: [], hidden: {}, timing: {},
        })),
        factsTitle: analysis === 'external' ? 'About the libraries' : 'About the settings',
        factColumns: analysis === 'external' ? external.map(c => ({ id: c.id, name: c.name })) : internalColumns.map(c => ({ id: c.id, name: c.name, sub: c.sub })),
        facts: analysis === 'external' ? libraryFacts(runtime) : internalFacts,
      },
    });
  }
  return panels;
}
