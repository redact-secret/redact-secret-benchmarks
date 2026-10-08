/**
 * Synthetic story data for the accuracy pair blocks. Every name, file slug and count is made up:
 * no real credential, no real fixture, no measured figure. The shapes are exactly what
 * `resolvers/accuracy.ts` hands the blocks.
 */
import type {
  AccuracyBarRow, AccuracyDifferenceColumn, AccuracyDifferencesData, AccuracyQuestionData, AccuracyResultData, AccuracySide, AccuracySource,
} from './accuracyTypes';
import type { AccuracyPairComparisonProps } from './AccuracyPairComparison';

const hiddenStates = (h: number, p: number, r: number) => [
  { label: 'Hidden', count: String(h), shape: 'fill' as const, weight: h },
  { label: 'Partly readable', count: String(p), shape: 'hatch' as const, weight: p },
  { label: 'Readable', count: String(r), shape: 'outline' as const, weight: r },
];
const aloneStates = (q: number, f: number) => [
  { label: 'Left alone', count: String(q), shape: 'fill' as const, weight: q },
  { label: 'Flagged', count: String(f), shape: 'outline' as const, weight: f },
];
const strip = (name: string, states: { label: string; count: string }[]) => `${name}: ${states.map(s => `${s.label} ${s.count}`).join(', ')}`;

export const result = (name: string, version: string, figure: string, figureNote: string, states: ReturnType<typeof hiddenStates>): AccuracyResultData => ({
  name, version, figure, figureNote, states, stripLabel: strip(name, states),
});

export const ours: AccuracySide = {
  kind: 'Runtime library', name: 'redact-secret', version: '0.0.0-story',
  job: 'Built to redact secrets from text at runtime: logs, prompts and tool output. Personal data only when switched on.',
  ran: 'Published npm package · default detectors', recorded: 'Measured in this run, 2000-01-02',
};
export const theirs: AccuracySide = {
  kind: 'Repository scanner', name: 'Examplescan', version: '1.2.3',
  job: 'Built to find secrets in git history, files and directories before they are committed.',
  ran: 'Directory scan · default rules', recorded: 'Output recorded 2000-01-01, replayed while the inputs are unchanged',
};
export const theirsLong: AccuracySide = {
  kind: 'Runtime library', name: 'An-extremely-long-example-scanner-name-with-no-break-points', version: '10.20.30-beta.1+build.12345678901234567890',
  job: 'Built to find every kind of synthetic example value in any text that an application might pass through it, at any hour, in any language.',
  ran: 'Published npm package · secrets-only (pii, generic_assignment disabled) · JavaScript engine · pattern coverage only',
  recorded: 'Output recorded 2000-01-01, 2000-01-03, replayed while the inputs are unchanged',
};

const ALL = '/comparison/accuracy/';
const nav = (label: string, items: [string, string][], current: string, extra?: Partial<AccuracyBarRow>): AccuracyBarRow => ({
  label, items: items.map(([l, href]) => ({ label: l, href: `${ALL}${href}` })), currentHref: `${ALL}${current}`, ...extra,
});

export const credentialsBar: AccuracyBarRow[] = [
  nav('Data', [['Credentials', ''], ['Personal data (PII)', '?data=pii']], ''),
  nav('Compare with', [['Examplescan', ''], ['Sampleleaks', '?with=sampleleaks'], ['Libsample', '?with=libsample']], ''),
  nav('Evidence', [['Provider docs', ''], ['Tool rules', '?level=T2'], ['Our policy', '?level=T3']], ''),
  nav('Test files', [['All', ''], ['Ones its rules target', '?scope=listed']], '', { hint: 'Test files whose provider family is one that Examplescan’s own rules target.' }),
];
export const piiBar: AccuracyBarRow[] = [
  nav('Data', [['Personal data (PII)', '?data=pii'], ['Credentials', '']], '?data=pii'),
  nav('Compare with', [['Libsample', '?data=pii'], ['Another library', '?data=pii&with=another']], '?data=pii', { sub: 'runtime libraries only' }),
];
export const longBar: AccuracyBarRow[] = [
  nav('Data', [['Credentials', ''], ['Personal data (PII)', '?data=pii']], ''),
  nav('Compare with', [['An-extremely-long-example-scanner-name', ''], ['Another-extremely-long-example-library-name', '?with=b'], ['A third long name to force wrapping', '?with=c'], ['Libsample', '?with=d']], ''),
  credentialsBar[2],
  credentialsBar[3],
];

export const hiddenQuestion: AccuracyQuestionData = {
  id: 'story.r', position: '1 / 2', title: 'Secrets that must be hidden',
  description: '1,000 test files. Secrets in formats the provider itself documents.', expect: 'Expected: hidden',
  results: [
    result('redact-secret', '0.0.0-story', '95%', '950 of 1,000 hidden', hiddenStates(950, 10, 40)),
    result('Examplescan', '1.2.3', '60%', '600 of 1,000 hidden', hiddenStates(600, 20, 380)),
  ],
};
export const aloneQuestion: AccuracyQuestionData = {
  id: 'story.a', position: '2 / 2', title: 'Safe text that must be left alone',
  description: '400 test files. Look-alikes, placeholders and near misses of provider-documented formats.', expect: 'Expected: left alone',
  results: [
    result('redact-secret', '0.0.0-story', '100%', '400 of 400 left alone', aloneStates(400, 0)),
    result('Examplescan', '1.2.3', '97%', '388 of 400 left alone', aloneStates(388, 12)),
  ],
};
/** Fewer than 20 files: counts only, no percentage. */
export const fewQuestion: AccuracyQuestionData = {
  ...aloneQuestion, id: 'story.few', description: '10 test files. Look-alikes, placeholders and near misses of provider-documented formats.',
  results: [
    result('redact-secret', '0.0.0-story', '10 of 10', 'left alone', aloneStates(10, 0)),
    result('Examplescan', '1.2.3', '9 of 10', 'left alone', aloneStates(9, 1)),
  ],
  readout: 'Fewer than 20 files, so counts only.',
};
/** One state empty on both sides, and a side where every file is in one state. */
export const uniformQuestion: AccuracyQuestionData = {
  ...hiddenQuestion, id: 'story.uniform',
  results: [
    result('redact-secret', '0.0.0-story', '100%', '1,000 of 1,000 hidden', hiddenStates(1000, 0, 0)),
    result('Examplescan', '1.2.3', '0%', '0 of 1,000 hidden', hiddenStates(0, 0, 1000)),
  ],
};
/** A share that is not exactly all must never round up to 100%. */
export const nearlyAllQuestion: AccuracyQuestionData = {
  ...hiddenQuestion, id: 'story.nearly', position: '2 / 3', title: 'Secrets that must be hidden, nearly all', description: '4,827 test files. Secrets in formats the provider itself documents.',
  results: [
    result('redact-secret', '0.0.0-story', '99.9%', '4,826 of 4,827 hidden', hiddenStates(4826, 1, 0)),
    result('Examplescan', '1.2.3', '0.1%', '5 of 4,827 hidden', hiddenStates(5, 0, 4822)),
  ],
};
/** No test file at the level, or none both tools recorded. */
export const emptyQuestion: AccuracyQuestionData = {
  id: 'story.empty', position: '2 / 2', title: 'Safe text that must be left alone',
  description: '0 test files whose provider family one of Examplescan’s rules targets. Look-alikes and near misses of those formats.', expect: 'Expected: left alone',
  results: [], empty: 'No test files at this level are ones Examplescan’s rules target.',
};
export const leftOutQuestion: AccuracyQuestionData = {
  ...hiddenQuestion, id: 'story.leftout', position: '3 / 3', title: 'Secrets that must be hidden, some left out',
  notes: ['3 test files left out: at least one of the two has no recorded result. Not measured, never counted as a pass or a zero.'],
};

const files = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ slug: `${prefix}-${String(i + 1).padStart(2, '0')}`, href: `/report/fixtures/story-suite/?fixture=${prefix}-${i + 1}` }));
const NOTE = 'Each list holds the files one tool hid and the other did not (readable or only partly hidden). A list is empty when every file one tool hid, the other hid too; that says nothing about the rest of its results, which are in its bar above.';
const TITLE_US = 'Hidden by redact-secret, not hidden by Examplescan';
const TITLE_THEM = 'Hidden by Examplescan, not hidden by redact-secret';
const NONE_US = 'None. All 12 files redact-secret hid, Examplescan hid too.';
const NONE_THEM = 'None. All 9 files Examplescan hid, redact-secret hid too.';
export const differences: AccuracyDifferencesData = {
  note: NOTE,
  columns: [
    { title: TITLE_US, none: NONE_US, total: '5', groups: [{ name: 'Example Cloud', count: '3', files: files('example-cloud-token', 3) }, { name: 'Sample Pay', count: '2', files: files('sample-pay-key', 2) }] },
    { title: TITLE_THEM, none: NONE_THEM, total: '1', groups: [{ name: 'Example Cloud', count: '1', files: files('example-cloud-secret', 1) }] },
  ],
};
/** Both directions always render, even when one has nothing: the zero says which files it comes from. */
export const oneSided: AccuracyDifferencesData = { note: NOTE, columns: [differences.columns[0], { title: TITLE_THEM, none: NONE_THEM, total: '0', groups: [] }] };
/** Neither tool hid a file the other left readable: each empty state names its own count. */
export const neither: AccuracyDifferencesData = { note: NOTE, columns: [{ title: TITLE_US, none: NONE_US, total: '0', groups: [] }, { title: TITLE_THEM, none: 'None. Examplescan has no files hidden here.', total: '0', groups: [] }] };
const manyGroups = (n: number, prefix: string): AccuracyDifferenceColumn['groups'] => Array.from({ length: n }, (_, i) => ({ name: `${prefix} provider ${String(i + 1).padStart(3, '0')}`, count: '2', files: files(`${prefix.toLowerCase()}-${i + 1}`, 2) }));
/** Worst case: 40 providers shown of 240, with a long name and a long slug. */
export const longLists: AccuracyDifferencesData = {
  note: NOTE,
  columns: [
    { title: TITLE_US, none: NONE_US, total: '480', groups: [{ name: 'A provider with a very long display name that has to wrap inside its column', count: '1', files: [{ slug: `a-very-long-fixture-slug-${'x'.repeat(80)}`, href: '/report/' }] }, ...manyGroups(39, 'Alpha')], more: 'Show all 240 providers' },
    { title: TITLE_THEM, none: NONE_THEM, total: '12', groups: manyGroups(6, 'Beta') },
  ],
};
/** Personal-data texts: a flat list of labels with no page of their own. */
export const flatDifferences: AccuracyDifferencesData = {
  note: 'Each list holds the texts one tool hid and the other did not (readable or only partly hidden). A list is empty when every text one tool hid, the other hid too; that says nothing about the rest of its results, which are in its bar above.',
  columns: [
    { title: 'Hidden by redact-secret, not hidden by Libsample', none: 'None. All 3 texts redact-secret hid, Libsample hid too.', total: '2', groups: [{ name: '', count: '2', files: [{ slug: 'Email, example label' }, { slug: 'Phone, example label' }] }] },
    { title: 'Hidden by Libsample, not hidden by redact-secret', none: 'None. All 2 texts Libsample hid, redact-secret hid too.', total: '0', groups: [] },
  ],
};

export const sources: AccuracySource[] = [
  { text: 'redact-secret 0.0.0-story (published package), measured in the same run as this page: 2000-01-02, run story-run.' },
  { text: 'Examplescan 1.2.3: Output recorded 2000-01-01, replayed while the inputs are unchanged. Version pinned in the repository.' },
  { text: 'Evidence levels and file kinds are the ones on the report. The same rows feed it; this page regroups them by file, where the report counts spans.', link: { href: '/report/', label: 'Open the report' } },
];

const base = {
  breadcrumb: [{ label: 'Comparison', href: '/comparison/' }, { label: 'Accuracy' }],
  eyebrow: 'Comparison',
  title: 'Put one tool next to redact-secret',
  lede: 'Pick a tool. Both read the same test files. Each question says what the file expects, and each tool gets its own row: how often it matched that answer. Nothing here is scored or ranked.',
  allScanners: { href: '/report/', label: 'All scanners at once →' },
  meta: [{ label: 'Run', value: '2000-01-02' }, { label: 'Mode', value: 'published · redact-secret 0.0.0-story' }],
  first: 'The redact-secret team wrote these test files and the expected answer for each, mostly to check formats redact-secret lists, and tuned redact-secret against them. A tool built for a different job can leave more of them readable. That describes scope. It is not a grade.',
  sources,
};

export const credentialsPage: AccuracyPairComparisonProps = { ...base, bar: credentialsBar, pair: { ours, theirs }, questions: [hiddenQuestion, aloneQuestion] };
export const fewFilesPage: AccuracyPairComparisonProps = { ...credentialsPage, questions: [hiddenQuestion, fewQuestion] };
export const noSharedPage: AccuracyPairComparisonProps = { ...credentialsPage, questions: [{ ...hiddenQuestion, id: 'story.ns.r', description: '0 test files whose provider family one of Examplescan’s rules targets. Secrets in formats the provider itself documents.', results: [], empty: 'No test files at this level are ones Examplescan’s rules target.' }, emptyQuestion] };
export const worstCasePage: AccuracyPairComparisonProps = { ...credentialsPage, bar: longBar, pair: { ours, theirs: theirsLong }, questions: [nearlyAllQuestion, leftOutQuestion] };
export const gatedPage: AccuracyPairComparisonProps = {
  ...base, bar: credentialsBar, pair: { ours, theirs },
  gate: { title: 'Hidden by default', text: 'Project policy is this project’s own masking rule. Other tools are not built to follow it, so a difference here reflects scope, not accuracy.', show: { label: 'Show anyway', href: `${ALL}?level=T3&peers=1` } },
};
export const peerNotCompletePage: AccuracyPairComparisonProps = {
  ...base, bar: credentialsBar, pair: { ours, theirs }, sources,
  notMeasured: { title: 'Examplescan did not complete in this run', text: 'Its status is “unavailable”, so its rows are not measured, not zero. Nothing is drawn for this pair.' },
};
export const noRunPage: AccuracyPairComparisonProps = {
  ...base, bar: credentialsBar, first: undefined, meta: undefined, sources: undefined,
  notMeasured: { title: 'No benchmark results for this checkout', text: 'The corpus is here, but no scanner has run against it, so there is nothing to put side by side. This is not measured, not zero.', command: 'npm run bench' },
};
export const piiPage: AccuracyPairComparisonProps = {
  ...base, bar: piiBar, meta: undefined,
  pair: {
    ours: { kind: 'Runtime library', name: 'redact-secret', version: '0.0.0-story', ran: 'PII switched on (pii:global, pii:us) · local build of main, unreleased', recorded: 'Run 2000-01-02' },
    theirs: { kind: 'Runtime library', name: 'Libsample', version: '4.5.6', ran: 'Defaults · published package', recorded: 'Run 2000-01-02' },
  },
  first: 'redact-secret finds personal data only when PII is switched on, and by its own rules it leaves values that standards reserve for examples alone. Other tools make other choices. Where they differ, that is a different rule, not a grade.',
  preview: 'Runtime preview, not peer accuracy measurement. Public pii-eval populations exist; reviewed peer adapters and same-population accuracy artifacts are not recorded. These are synthetic runtime texts counted by text, with no accuracy percentage.',
  questions: [
    {
      id: 'story.pii1', position: '1 / 3', title: 'Personal data that looks real', description: '8 texts. Made-up emails, cards, bank accounts and phone numbers.', expect: 'Expected: hidden',
      results: [
        result('redact-secret', '0.0.0-story', '8 of 8', 'hidden', [{ label: 'Hidden', count: '8', shape: 'fill', weight: 8 }, { label: 'Left some or all', count: '0', shape: 'outline', weight: 0 }]),
        result('Libsample', '4.5.6', '6 of 8', 'hidden', [{ label: 'Hidden', count: '6', shape: 'fill', weight: 6 }, { label: 'Left some or all', count: '2', shape: 'outline', weight: 2 }]),
      ],
      differences: flatDifferences,
    },
  ],
  sources: [{ text: 'redact-secret 0.0.0-story with pii:global and pii:us, and Libsample 4.5.6 at its defaults, on the same made-up texts, run 2000-01-02.' }],
};
export const piiNotMeasuredPage: AccuracyPairComparisonProps = {
  ...base, bar: piiBar, meta: undefined, first: piiPage.first, sources: undefined,
  notMeasured: { title: 'Not measured', text: 'No personal-data accuracy corpus has been run against other tools, and the recorded runtime comparison does not cover this tool. Nothing is shown rather than a guess.' },
};
