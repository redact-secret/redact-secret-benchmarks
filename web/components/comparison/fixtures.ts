/**
 * Synthetic story data for the comparison blocks, shaped like the ledger and
 * report outputs the pages will read (see ./types.ts). Values come from the
 * design mockups' preview run; none is a real credential or a real person.
 * Stories import this; components never do.
 */
import type {
  ComparisonQuestion,
  FeatureCell,
  FeatureGroup,
  FeatureLibrary,
  FeatureRow,
  FeatureSource,
  Principle,
  RunLine,
  RuntimeColumn,
  RuntimeFactRow,
  RuntimeLegendItem,
  RuntimeOutcome,
  RuntimeQuestion,
  RuntimeValueRow,
  ToolKind,
} from './types';

/* ---- hub ---- */

export const questions: ComparisonQuestion[] = [
  {
    href: '/comparison/runtime',
    label: 'Runtime',
    title: 'How fast is each one, and what does it hide?',
    description: 'Time and output on the same text, for passwords and API keys and for personal data. Also compares redact-secret’s own settings.',
    tools: ['redact-secret', 'flare-redact', 'OpenRedaction'],
    fact: '6 test texts',
    factNote: '3 for secrets, 3 for personal data',
    action: 'Runtime comparison →',
  },
  {
    href: '/comparison/feature',
    label: 'Features',
    title: 'What can each one do?',
    description: 'Where it runs, what it finds, how it hides things and how it fits into an app, from each project’s own docs.',
    tools: ['redact-secret', 'flare-redact', 'OpenRedaction'],
    fact: '28 features',
    factNote: '13 checked by us',
    action: 'Feature comparison →',
  },
  {
    href: '/report',
    label: 'Accuracy',
    title: 'Does it miss real secrets, or flag safe values?',
    description: 'How often each scanner lets a secret through or flags something harmless, on the same synthetic inputs, with the rows behind every number.',
    tools: ['redact-secret', 'gitleaks', 'TruffleHog', 'flare-redact'],
    fact: '3 evidence levels',
    factNote: 'provider, tool, policy',
    action: 'Accuracy report →',
  },
];

export const toolKinds: ToolKind[] = [
  {
    name: 'Runtime libraries',
    description: 'Run inside your app and hide sensitive text as it passes through: logs, prompts, tool results.',
    tools: [
      { name: 'redact-secret', detail: 'Node.js, browsers, Python, Rust' },
      { name: 'flare-redact', detail: 'Node.js 20+' },
      { name: 'OpenRedaction', detail: 'Node.js 20+' },
    ],
    comparedIn: 'Compared in Runtime and Features. flare-redact is also in Accuracy, with its secret detectors only.',
  },
  {
    name: 'Repository scanners',
    description: 'Look through code, files and git history for secrets that were already committed.',
    tools: [
      { name: 'gitleaks', detail: 'command line' },
      { name: 'TruffleHog', detail: 'command line' },
    ],
    comparedIn: 'Compared in Accuracy only. They are not built to run inside an app, so they have no runtime numbers.',
  },
];

export const principles: Principle[] = [
  { title: 'Same input', description: 'Every tool gets exactly the same text.' },
  { title: 'Made-up data', description: 'No real person, account or key. Ever.' },
  { title: 'Pinned versions', description: 'Each result names the version and the date it ran.' },
  { title: 'No ranking', description: 'We record what happened. We never pick a winner.' },
];

export const runs: RunLine[] = [
  { label: 'Runtime', detail: '2026-09-29 · redact-secret 0.1.0-beta.11, flare-redact 1.6.1, OpenRedaction core 1.1.5' },
  { label: 'Features', detail: 'docs read 2026-09-29, same versions' },
  { label: 'Accuracy', detail: 'each run is dated on the report' },
];

/* ---- features ---- */

export const featureLibraries: FeatureLibrary[] = [
  { id: 'rs', name: 'redact-secret', version: '0.1.0-beta.11' },
  { id: 'fr', name: 'flare-redact', version: '1.6.1' },
  { id: 'or', name: 'OpenRedaction', version: 'core 1.1.5' },
];

const y = (note = '', tested = false): FeatureCell => ({ mark: 'yes', note, tested });
const p = (note = ''): FeatureCell => ({ mark: 'partly', note });
const n = (note = '', tested = false): FeatureCell => ({ mark: 'no', note, tested });

function row(id: string, label: string, rs: FeatureCell, fr: FeatureCell, or: FeatureCell): FeatureRow {
  const marks = [rs.mark, fr.mark, or.mark];
  return { id, label, same: marks.every(m => m === marks[0]), cells: { rs, fr, or } };
}

export const featureGroups: FeatureGroup[] = [
  {
    label: 'WHERE IT RUNS',
    rows: [
      row('node', 'Node.js', y('Native add-on, WebAssembly fallback', true), y('Node 20+', true), y('Node 20+', true)),
      row('browser', 'Web browser', y('WebAssembly build'), y('Listed: browser and edge'), n('Main entry loads Node-only modules', true)),
      row('python', 'Python', y('PyPI wheel'), p('Separate SDK, installed from git'), n()),
      row('cli', 'Command line', y('Checks files and staged changes'), y('CLI'), n()),
      row('service', 'As a separate service', n('Runs inside your app only'), y('Docker sidecar gateway'), p('REST API, in the larger openredaction package')),
    ],
  },
  {
    label: 'WHAT IT FINDS',
    rows: [
      row('secrets', 'Passwords and API keys', y('152 kinds from 76 providers, each with published evidence'), y('About 45 listed detectors'), y('API keys, OAuth, JWT, bearer tokens')),
      row('emails', 'Emails, cards, bank accounts', p('Opt-in PII switch'), y('On by default'), y('On by default')),
      row('phones', 'Phone numbers', p('Opt-in; US and Canada numbers only'), p('Opt-in (phone)'), y('US, UK and international')),
      row('custom', 'Your own formats', y('Rules written as data, no code callbacks'), y('Custom detectors and allow-lists'), n('Not listed in its README')),
    ],
  },
  {
    label: 'HOW IT HIDES THINGS',
    rows: [
      {
        id: 'look',
        label: 'What hidden text looks like',
        same: false,
        cells: {
          rs: { mark: 'yes', note: '<SECRET_1>', tested: true, literal: true },
          fr: { mark: 'yes', note: 'b***@***', tested: true, literal: true },
          or: { mark: 'yes', note: '[EMAIL_9619]', tested: true, literal: true },
        },
      },
      row('restore', 'Get the originals back', p('Vault add-on, alpha'), y('Vault, optional AES-GCM encryption'), n()),
      row('policy', 'Warn or block instead of hiding', y('Policy: redact, block, warn or allow'), n(), n()),
    ],
  },
  {
    label: 'SAFETY',
    rows: [
      row('leak', 'Results never repeat the secret', y('Findings carry position and type only', true), y('scan() leaves values out', true), n('Result includes the original text and a value map', true)),
      row('deps', 'No required dependencies', p('Its own platform add-on only'), y('Zero dependencies'), y('No required dependencies')),
      row('same', 'Deterministic placeholders', y('Same input, same output'), y('Hash, pseudonym, surrogate modes'), y('Deterministic placeholders')),
    ],
  },
];

export const featureSources: FeatureSource[] = [
  { name: 'redact-secret', detail: 'main at 0.1.0-beta.11: its README, detector-families spec and support matrix.' },
  { name: 'flare-redact', detail: '1.6.1: the README shipped in the npm package.' },
  { name: 'OpenRedaction', detail: '@openredaction/core 1.1.5: the README shipped in the npm package. Features listed for the larger openredaction package say so in the cell.' },
  { name: '“tested”', detail: 'means we ran it on 2026-09-29 with the versions above. Everything else is what the project says about itself.' },
];

/** Worst case: many libraries, a cell with no entry, long notes and an unbroken string. */
export const manyLibraries: FeatureLibrary[] = [
  ...featureLibraries,
  { id: 'a', name: 'library-with-a-very-long-package-name', version: '10.20.30-beta.40' },
  { id: 'b', name: 'another-runtime-library', version: '0.0.1' },
  { id: 'c', name: 'yet-another', version: '2.0.0' },
];

/* ---- runtime ---- */

export const outcomeWords = { replaced: 'Hidden', partial: 'Partly hidden', unchanged: 'Left as is', 'not-applicable': 'Switch off' } as const;
const O = {
  R: (how?: string): RuntimeOutcome => ({ outcome: 'replaced', word: outcomeWords.replaced, how }),
  P: (how?: string): RuntimeOutcome => ({ outcome: 'partial', word: outcomeWords.partial, how }),
  U: (): RuntimeOutcome => ({ outcome: 'unchanged', word: outcomeWords.unchanged }),
  N: (): RuntimeOutcome => ({ outcome: 'not-applicable', word: outcomeWords['not-applicable'] }),
};

export const legend: RuntimeLegendItem[] = [
  { outcome: 'replaced', label: 'Hidden' },
  { outcome: 'partial', label: 'Partly' },
  { outcome: 'unchanged', label: 'Left as is' },
  { outcome: 'not-applicable', label: 'Switch off' },
];

export const internalColumns: RuntimeColumn[] = [
  { id: 'df', name: 'Default', sub: 'no PII' },
  { id: 'rs', name: 'PII', sub: 'pii:global' },
  { id: 'us', name: 'PII + US', sub: 'adds pii:us' },
];

export const externalColumns: RuntimeColumn[] = [
  { id: 'us', name: 'redact-secret', sub: 'PII + US' },
  { id: 'fr', name: 'flare-redact' },
  { id: 'or', name: 'OpenRedaction' },
];

type Cells = Record<string, RuntimeOutcome | null>;
const vrow = (label: string, cells: Cells): RuntimeValueRow => ({ label, cells });

/** The value rows for one question, keyed like the mockup's preview run. */
const realRows: RuntimeValueRow[] = [
  vrow('IP address', { df: O.N(), rs: O.R(), us: O.R(), fr: O.U(), or: O.R('labelled IPV4') }),
  vrow('Email', { df: O.N(), rs: O.R(), us: O.R(), fr: O.R('starred out'), or: O.R('labelled EMAIL') }),
  vrow('Card number', { df: O.N(), rs: O.R(), us: O.R(), fr: O.R('starred out, last 4 kept'), or: O.R('labelled CREDIT_CARD') }),
  vrow('Bank account', { df: O.N(), rs: O.R(), us: O.R(), fr: O.R('labelled IBAN'), or: O.R('labelled IBAN') }),
  vrow('US Social Security no.', { df: O.N(), rs: O.N(), us: O.R(), fr: O.U(), or: O.U() }),
  vrow('US phone number', { df: O.N(), rs: O.R(), us: O.R(), fr: O.U(), or: O.R('labelled PHONE_UK') }),
  vrow('Email, Korean label', { df: O.N(), rs: O.R(), us: O.R(), fr: O.R('starred out'), or: O.R('labelled EMAIL') }),
  vrow('Phone, Korean label', { df: O.N(), rs: O.R(), us: O.R(), fr: O.U(), or: O.R('labelled PHONE_UK') }),
];

const fakeRows: RuntimeValueRow[] = [
  vrow('Example IP address', { df: O.N(), rs: O.U(), us: O.U(), fr: O.U(), or: O.R('labelled IPV4') }),
  vrow('example.com email', { df: O.N(), rs: O.U(), us: O.U(), fr: O.R('starred out'), or: O.U() }),
  vrow('Test card number', { df: O.N(), rs: O.U(), us: O.U(), fr: O.R('starred out, last 4 kept'), or: O.R('labelled CREDIT_CARD') }),
  vrow('Textbook bank account', { df: O.N(), rs: O.R(), us: O.R(), fr: O.R('labelled IBAN'), or: O.R('labelled IBAN') }),
  vrow('Social Security no.', { df: O.N(), rs: O.N(), us: O.R(), fr: O.U(), or: O.U() }),
  vrow('555 phone number', { df: O.N(), rs: O.U(), us: O.U(), fr: O.U(), or: O.U() }),
  vrow('Card no., wrong check digit', { df: O.N(), rs: O.U(), us: O.U(), fr: O.U(), or: O.R('labelled TWITTER_ID') }),
  vrow('SSN starting 000', { df: O.N(), rs: O.N(), us: O.U(), fr: O.U(), or: O.U() }),
];

const contextRows: RuntimeValueRow[] = [
  vrow('Email, English label', { df: O.N(), rs: O.U(), us: O.U(), fr: O.R('starred out'), or: O.U() }),
  vrow('Email, Korean label', { df: O.N(), rs: O.U(), us: O.U(), fr: O.R('starred out'), or: O.U() }),
  vrow('Phone, English label', { df: O.N(), rs: O.U(), us: O.U(), fr: O.U(), or: O.R('labelled PHONE_UK') }),
  vrow('Email and phone, one line', { df: O.N(), rs: O.U(), us: O.U(), fr: O.P('email starred out, phone left'), or: O.P('phone labelled PHONE_UK, email left') }),
  vrow('SSN after “example”', { df: O.N(), rs: O.N(), us: O.U(), fr: O.U(), or: O.U() }),
  vrow('IP after “documentation”', { df: O.N(), rs: O.U(), us: O.U(), fr: O.U(), or: O.R('labelled IPV4') }),
];

const timing = (medianMs: string, throughput: string) => ({ medianMs, throughput });

export const piiQuestions: RuntimeQuestion[] = [
  {
    id: 'q-real',
    position: '1 / 3',
    question: 'Does it catch real sensitive values?',
    description: 'Made-up emails, card numbers, bank accounts and phone numbers that look like the real thing.',
    workload: 'real-looking',
    size: '116.5 KiB',
    repeat: 'each line repeated 512 times',
    rows: realRows,
    hidden: {
      df: { percent: '0%', count: '0 of 8' },
      rs: { percent: '88%', count: '7 of 8' },
      us: { percent: '100%', count: '8 of 8' },
      fr: { percent: '50%', count: '4 of 8' },
      or: { percent: '88%', count: '7 of 8' },
    },
    timing: { df: timing('6.9', '17.4'), rs: timing('307', '0.4'), us: timing('333', '0.4'), fr: timing('14.3', '8.3'), or: timing('904', '0.1') },
  },
  {
    id: 'q-fake',
    position: '2 / 3',
    question: 'Does it redact fake values?',
    description: 'Values made for examples and testing, like example.com emails and test card numbers, plus look-alikes that fail a basic check.',
    workload: 'validator-heavy',
    size: '92.5 KiB',
    repeat: 'each line repeated 512 times',
    rows: fakeRows,
    hidden: {
      df: { percent: '0%', count: '0 of 8' },
      rs: { percent: '13%', count: '1 of 8' },
      us: { percent: '25%', count: '2 of 8' },
      fr: { percent: '38%', count: '3 of 8' },
      or: { percent: '50%', count: '4 of 8' },
    },
    timing: { df: timing('5.1', '18.6'), rs: timing('47.9', '2.0'), us: timing('75.5', '1.3'), fr: timing('6.0', '15.7'), or: timing('744', '0.1') },
  },
  {
    id: 'q-context',
    position: '3 / 3',
    question: 'Does it understand context?',
    description: 'The same kind of fake values, now next to English and Korean labels, and next to words like “example” that say it is not real.',
    workload: 'multilingual-context',
    size: '147.0 KiB',
    repeat: 'each line repeated 512 times',
    rows: contextRows,
    hidden: {
      df: { percent: '0%', count: '0 of 6' },
      rs: { percent: '0%', count: '0 of 6' },
      us: { percent: '0%', count: '0 of 6' },
      fr: { percent: '50%', count: '3 of 6' },
      or: { percent: '50%', count: '3 of 6' },
    },
    timing: { df: timing('10.3', '14.6'), rs: timing('19.6', '7.7'), us: timing('32.5', '4.6'), fr: timing('13.4', '11.3'), or: timing('932', '0.2') },
  },
];

/** A question with a missing time and a cell nobody measured. */
export const missingMeasurements: RuntimeQuestion = {
  ...piiQuestions[0],
  id: 'q-missing',
  rows: piiQuestions[0].rows.map((r, i) => (i === 2 ? { ...r, cells: { ...r.cells, fr: null } } : r)),
  hidden: { ...piiQuestions[0].hidden, fr: null },
  timing: { ...piiQuestions[0].timing, or: null },
};

/** An older snapshot: times were recorded, outcomes were not. */
export const olderSnapshot: RuntimeQuestion = { ...piiQuestions[1], id: 'q-older', outcomesRecorded: false, rows: [], hidden: {} };

/** Credentials have no cross-library workload timed yet. */
export const credentialQuestions: RuntimeQuestion[] = [
  { question: 'Does it catch real secrets?', description: 'Made-up API keys and tokens in the places people paste them: a .env file, a command line, an HTTP header.', workload: 'cred-real' },
  { question: 'Does it redact fake secrets?', description: 'Placeholders like YOUR_TOKEN_HERE, keys that are public by design, and look-alikes that are too short or use the wrong letters.', workload: 'cred-fake' },
  { question: 'Does it understand context?', description: 'Real secrets inside sentences, logs and code, next to look-alikes whose surroundings say they are not secrets.', workload: 'cred-context' },
].map((q, i) => ({
  id: `c-${i}`,
  position: `${i + 1} / 3`,
  ...q,
  size: '385.0 KiB',
  repeat: 'each line repeated 512 times',
  notMeasured: 'No credential text has been timed across these libraries. redact-secret’s own credential speed is on Performance. How well scanners find secrets is in the report.',
  rows: [],
  hidden: {},
  timing: {},
}));

/** Worst case: six columns with long names. */
export const wideColumns: RuntimeColumn[] = [
  ...externalColumns,
  { id: 'x1', name: 'a-library-with-a-long-name', sub: 'settings profile with a long description' },
  { id: 'x2', name: 'second-long-library-name' },
  { id: 'x3', name: 'third' },
];

export const wideQuestion: RuntimeQuestion = {
  ...piiQuestions[0],
  id: 'q-wide',
  rows: piiQuestions[0].rows.map(r => ({ ...r, cells: { ...r.cells, x1: O.R('a long detail that has to wrap inside its cell'), x2: O.U(), x3: O.P() } })),
  hidden: { ...piiQuestions[0].hidden, x1: { percent: '100%', count: '8 of 8' }, x2: { percent: '0%', count: '0 of 8' }, x3: { percent: '25%', count: '2 of 8' } },
  timing: { ...piiQuestions[0].timing, x1: timing('1,087', '0.4'), x2: timing('16.4', '24.1'), x3: timing('3,533', '0.1') },
};

export const externalFactColumns: RuntimeColumn[] = [
  { id: 'rs', name: 'redact-secret' },
  { id: 'fr', name: 'flare-redact' },
  { id: 'or', name: 'OpenRedaction' },
];

export const externalFacts: RuntimeFactRow[] = [
  {
    label: 'Version',
    cells: { rs: { text: '0.1.0-beta.11', chip: 'local build · unreleased' }, fr: { text: '1.6.1', chip: 'npm' }, or: { text: '1.1.5', chip: 'npm' } },
  },
  {
    label: 'Runs in',
    cells: {
      rs: { text: 'Node.js, browsers, Python, Rust, command line', note: 'Node uses a native add-on on 8 platforms, WebAssembly elsewhere' },
      fr: { text: 'Node.js 20+', note: 'its README also lists browsers, edge, Bun and Deno' },
      or: { text: 'Node.js 20+', note: 'its main entry loads Node-only modules' },
    },
  },
  {
    label: 'Install size',
    cells: {
      rs: { text: '148 KiB + one 1.0–1.1 MB add-on', note: 'npm, unpacked; or 766 KiB WebAssembly' },
      fr: { text: '927 KiB', note: 'npm, unpacked; no dependencies' },
      or: { text: '3.6 MiB', note: 'npm, unpacked, with source maps; no required dependencies' },
    },
  },
  {
    label: 'In a web page',
    cells: { rs: { text: '141 KiB', note: 'gzip, smallest working bundle' }, fr: { text: '—', note: 'not measured here' }, or: null },
  },
];

export const internalFactColumns: RuntimeColumn[] = internalColumns;

export const internalFacts: RuntimeFactRow[] = [
  {
    label: 'Turns on',
    cells: {
      df: { text: 'Passwords and API keys only' },
      rs: { text: '+ emails, bank accounts, IP addresses, cards, phone numbers' },
      us: { text: '+ US Social Security numbers' },
    },
  },
  {
    label: 'Meant for',
    cells: { df: { text: 'Secrets only' }, rs: { text: 'Personal data, anywhere' }, us: { text: 'Personal data, with US IDs' } },
  },
];

export const runMeta = [
  { label: 'Run', value: '2026-09-29' },
  { value: 'linux x64 · Node v22.22.2' },
  { value: 'Each time is the middle of 12 runs' },
];

export const factNotes = [
  '“Hidden” means the line came back different from what went in. “Switch off” comes from redact-secret’s own list of what it has turned on. We show what happened; we do not grade it.',
];

export const runtimeViews = (base: string) => [
  { label: 'All', href: base },
  { label: 'Speed', href: `${base}?view=speed` },
  { label: 'Accuracy', href: `${base}?view=accuracy` },
];

export const runtimeSwitches = (analysis: 'internal' | 'external', domain: 'pii' | 'credentials') => ({
  analysis: {
    label: 'Analysis',
    items: [
      { label: 'Internal', href: '/comparison/runtime?analysis=internal' },
      { label: 'External', href: '/comparison/runtime?analysis=external' },
    ],
    currentHref: `/comparison/runtime?analysis=${analysis}`,
  },
  domain: {
    label: 'Kind of data',
    items: [
      { label: 'Credentials', href: '/comparison/runtime?domain=credentials' },
      { label: 'PII', href: '/comparison/runtime?domain=pii' },
    ],
    currentHref: `/comparison/runtime?domain=${domain}`,
  },
});
