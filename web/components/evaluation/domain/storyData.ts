/** Synthetic story data: made-up families and counts, never ledger values. */
import type {
  CoverageTable, DomainCoverageData, DomainMethodData, DomainReadingData, DomainStatusData, DomainViewData, GlanceItem,
} from './types';

export const glance: GlanceItem[] = [
  { label: 'Covered', value: '4 example families', detail: 'Three global, one jurisdictional.' },
  { label: 'Recorded status', value: '3 provisional, 1 pending', detail: 'Candidate, example build. A classification by published rules, not a claim about the product.' },
  { label: 'Held apart', value: '60 protected cases', detail: 'Sealed, run once per family.' },
];

export const glanceNotRecorded: GlanceItem[] = [
  glance[0],
  { label: 'Recorded status', value: null, detail: 'No record matches the mode this page shows.' },
  { label: 'Held apart', value: null, detail: 'No protected run is recorded.' },
];

export const method: DomainMethodData = {
  title: 'How a case is judged',
  steps: [
    { title: 'Author', text: 'A case is made-up text with one value in it. The expected answer is written before any scanner runs.' },
    { title: 'Run', text: 'Every scanner reads the same bytes. The run keeps ranges and actions, never the matched text.' },
    { title: 'Compare', text: 'Each result is checked against the expected answer.' },
    { title: 'Record', text: 'Each metric keeps its own numerator and denominator. Nothing is added across metrics.' },
  ],
  vocabularies: [
    { title: 'Example axis one', rows: [{ word: 'correct', meaning: 'As expected.' }, { word: 'miss', meaning: 'Not found.' }, { word: 'unresolved', meaning: 'Needs review. Stays in the denominator.' }] },
    { title: 'Example axis two', rows: [{ word: 'T1', meaning: 'Documented by the source.' }, { word: 'T0', meaning: 'Pending review, never scored.' }] },
  ],
  oracle: [{ term: 'Identity', text: 'A reference validator runs on the authored range, never on scanner output.' }, { term: 'Peers', text: 'Another scanner is a comparison, never the truth.' }],
  methods: [{ term: 'twin', text: 'Authored positive and negative pairs.' }, { term: 'holdout', text: 'Isolated frozen cases, aggregate output only.' }],
  metrics: {
    summary: 'Two example metrics',
    text: 'Each metric has its own population. None is combined with another.',
    rows: [
      { id: 'example-miss-rate', population: 'scanner × authored example occurrence', counts: 'miss, of resolved assertions', better: 'Lower' },
      { id: 'example-suppression-rate', population: 'scanner × authored benign case', counts: 'assertion passes, of resolved cases', better: 'Higher' },
    ],
  },
  recorded: { title: 'Recorded, not graded', text: 'The ledger records each outcome against the expected answer. It never turns outcomes into a score, a rank or a verdict about a product.' },
};

const table: CoverageTable = {
  id: 'by-family',
  caption: 'Cases by family and view',
  rowHeader: 'Family',
  columns: ['Plan', 'Balanced', 'Stress'],
  rows: [
    { id: 'a', label: 'Example family A', detail: 'global', cells: [{ figure: '25', detail: '8 · 11 · 6' }, { figure: '97', detail: '41 · 15 · 41' }, { figure: '80', detail: '24 · 19 · 37' }] },
    { id: 'b', label: 'Example family B', detail: 'jurisdiction XX', cells: [{ figure: '20', detail: '3 · 0 · 17' }, { figure: '19', detail: '9 · 0 · 10' }, { figure: null }] },
  ],
  note: 'The line under a figure splits the cases by what the author expects: sensitive, non-sensitive, not established.',
};

export const coverage: DomainCoverageData = {
  title: 'What is covered',
  mode: 'Counts are from an example record (candidate, unreleased build).',
  tables: [table, { id: 'by-method', caption: 'Cases and variants by method', text: 'The ledger holds no per-method counts for this domain.', issue: { number: 1, href: 'https://example.com/issues/1' } }],
  columnKey: [{ term: 'Plan', text: 'The frozen plan of each family.' }, { term: 'Stress', text: 'An evaluation view dominated by non-sensitive values.' }],
  scope: [{ term: 'Languages', text: 'English and Korean. Language is not jurisdiction.' }],
};

export const status: DomainStatusData = {
  title: 'Where this stands',
  groups: [
    {
      title: 'Recorded',
      rows: [
        { id: 'family', label: 'Family status', status: 'pass', statusWord: 'Recorded', value: '3 provisional, 1 pending', detail: 'Pending: a protected gate is not met.', link: { label: 'Evidence record', href: 'https://example.com/record', external: true } },
        { id: 'gates', label: 'Public gates', status: 'info', statusWord: 'Recorded', value: '20 of 21 met', detail: 'The 21st was accepted as a tradeoff.' },
      ],
    },
    { title: 'Not measured yet', rows: [{ id: 'activation', label: 'Product activation', status: 'not-measured', statusWord: 'Not measured', detail: 'No activation record exists for this build.', link: { label: '#1', href: 'https://example.com/issues/1', external: true } }] },
    { title: 'Known gaps', rows: [{ id: 'scope', label: 'Narrow scope', status: 'info', statusWord: 'Recorded', value: 'Phone +1 only', detail: 'No other numbering plan is registered.' }] },
  ],
  links: [{ label: 'Report', href: '/report/' }, { label: 'Accuracy comparison', href: '/comparison/accuracy/' }],
};

export const reading: DomainReadingData = {
  title: 'How to read the numbers',
  items: [
    { term: 'N of M', text: 'A numerator over its own denominator. There is no total.' },
    { term: 'Not measured is not zero', text: 'A dashed mark means nothing was recorded.' },
    { term: 'Mode', text: 'Candidate means an unreleased build. Published means a release.' },
  ],
  sources: [{ label: 'Identity oracle', path: 'docs/specs/pii-identity-oracle.md', href: 'https://example.com/spec' }],
};

export const view: DomainViewData = {
  head: {
    domain: 'pii',
    eyebrow: 'Evaluation · Example',
    title: 'How the example domain is evaluated',
    lede: 'The benchmark checks an example value. It records what happened. It does not grade a product.',
    meta: [{ label: 'Evaluation profile', value: 'example-v1' }, { label: 'Mode', value: 'Candidate, build abc1234' }],
    pair: [{ label: 'Credential', href: '/evaluation/credential/' }, { label: 'PII', href: '/evaluation/pii/' }],
    currentHref: '/evaluation/pii/',
    pairLabel: 'Evaluation domain',
    breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Example' }],
  },
  glance,
  method,
  coverage,
  status,
  reading,
};

/** A page whose record is missing: dashed states in every block that needs it. */
export const viewNotRecorded: DomainViewData = {
  ...view,
  glance: glanceNotRecorded,
  coverage: { ...coverage, tables: [{ id: 'none', caption: 'Cases by family and view', text: 'No record matches the mode this page shows.', issue: { number: 2, href: 'https://example.com/issues/2' } }] },
  status: { ...status, groups: [{ title: 'Not measured yet', rows: status.groups[1].rows }] },
};

/** Long names, an unbroken string and many rows: nothing clips or pushes the page sideways. */
export const viewLong: DomainViewData = {
  ...view,
  head: { ...view.head, title: 'How a domain with a very long name that keeps going is evaluated across every one of its families' },
  coverage: {
    ...coverage,
    tables: [{
      ...table,
      rows: Array.from({ length: 14 }, (_, i) => ({
        id: `r${i}`,
        label: i === 0 ? 'A family name that is long enough to need two lines on a narrow screen' : `Example family ${i}`,
        detail: i === 0 ? 'jurisdiction-with-an-unbroken-string-that-never-has-a-natural-break-point-at-all' : 'global',
        cells: [{ figure: '1,234' }, { figure: String(i) }, { figure: null }],
      })),
    }],
  },
};
