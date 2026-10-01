import type {
  EvidenceCell, EvidenceColumn, EvidenceGroup, MethodInputsData, MethodPageProps, MethodRecordedData, NotMeasuredData, TextTable,
} from './types';

/** Synthetic values for stories: the shape of a run, never a recorded count. */
export const columns: EvidenceColumn[] = [
  { id: 'redact-secret', name: 'redact-secret', version: '1.2.3' },
  { id: 'scanner-b', name: 'scanner-b', version: '4.5.6' },
  { id: 'scanner-c', name: 'scanner-c', version: '7.8.9' },
  { id: 'scanner-d', name: 'scanner-d', version: '0.1.0' },
];

const n = (value: string, of: string): EvidenceCell => ({ kind: 'count', value, of });

export const pairRows: EvidenceGroup[] = [{
  label: '',
  rows: [
    { key: 'pair', label: 'Pair told apart', note: 'The positive is detected and its twin is left alone', cells: [n('2', '1,372'), n('520', '1,372'), n('894', '1,372'), n('1,049', '1,372')] },
    { key: 'positive', label: 'Positive side', note: 'Detected within its expected envelope', cells: [n('2', '1,388'), n('435', '1,388'), n('837', '1,388'), n('1,015', '1,388')] },
    { key: 'negative', label: 'Negative twin', note: 'Left alone', cells: [n('0', '1,372'), n('94', '1,372'), n('62', '1,372'), n('49', '1,372')] },
  ],
}];

export const groupedRows: EvidenceGroup[] = [
  {
    label: 'Same detection after the transform',
    rows: [
      { key: 'context.indent', label: 'context.indent', note: 'Indents the text by four spaces', cells: [n('5', '4,531'), n('914', '4,531'), n('1,553', '4,531'), n('1,803', '4,531')] },
      { key: 'encoding.crlf', label: 'encoding.crlf', note: 'Changes line endings to CRLF', cells: [n('5', '3,747'), n('720', '3,747'), n('1,325', '3,747'), n('1,559', '3,747')] },
      { key: 'context.json', label: 'context.json', note: 'Wraps the value as a JSON string', cells: [n('0', '611'), n('105', '611'), n('118', '611'), n('128', '611')] },
    ],
  },
  {
    label: 'The transformed text on its own',
    rows: [
      { key: 'detected', label: 'Value detected', cells: [n('6', '7,799'), n('2,857', '7,799'), n('4,930', '7,799'), n('5,624', '7,799')] },
      { key: 'left-alone', label: 'Look-alike left alone', cells: [n('9', '8,080'), n('216', '8,080'), n('105', '8,080'), n('196', '8,080')] },
    ],
  },
];

/** A scanner that did not run, a row with nothing to score, one that waits for review and one with no check of that kind. */
export const edgeRows: EvidenceGroup[] = [{
  label: '',
  rows: [
    { key: 'a', label: 'A check every scanner scored', cells: [n('0', '120'), n('7', '120'), { kind: 'not-measured' }, n('3', '120')] },
    { key: 'b', label: 'A check that waits for review', note: 'Deferred: the format no longer matches', cells: [{ kind: 'unscored', of: '48' }, { kind: 'unscored', of: '48' }, { kind: 'not-measured' }, { kind: 'unscored', of: '48' }] },
    { key: 'c', label: 'A check only one scanner reports', cells: [n('0', '120'), { kind: 'none' }, { kind: 'not-measured' }, { kind: 'none' }] },
  ],
}];

export const manyColumns: EvidenceColumn[] = Array.from({ length: 8 }, (_, i) => ({ id: `scanner-${i}`, name: `scanner-${i + 1}`, version: `${i + 1}.0.0` }));
export const manyRows: EvidenceGroup[] = [{
  label: '',
  rows: Array.from({ length: 6 }, (_, r) => ({ key: `r${r}`, label: `Taxonomy ${r + 1}`, cells: manyColumns.map((_c, c) => n(String(r * c), '1,000')) })),
}];

export const recorded: MethodRecordedData = {
  state: 'recorded',
  title: 'Do the pairs come apart?',
  description: 'One row for the pair and one for each side, per scanner.',
  rowHeader: 'Check',
  cellMeaning: 'Checks that did not hold, of those scored for that scanner.',
  columns,
  groups: pairRows,
  unscored: { title: 'Needs review', text: '19 pairs have a side whose expected outcome is unresolved (tier T0). They are counted in no row above.' },
  caption: 'Twin: checks that did not hold, per scanner',
};

export const suiteTable: TextTable = {
  caption: 'Suites the cases come from',
  columns: [{ key: 'suite', header: 'Suite' }, { key: 'cases', header: 'Pairs', numeric: true }],
  rows: [
    { key: 'credential-formats', cells: [{ text: 'Credential formats', href: '/report/fixtures/credential-formats/', note: 'credential-formats' }, { text: '15' }] },
    { key: 'context-edges', cells: [{ text: 'Context & boundaries', href: '/report/fixtures/context-edges/', note: 'context-edges' }, { text: '57' }] },
    { key: 'unlisted-suite', cells: [{ text: 'unlisted-suite' }, { text: '4' }] },
  ],
};

export const operatorTable: TextTable = {
  caption: 'Operators and what they generated',
  columns: [
    { key: 'operator', header: 'Operator' }, { key: 'what', header: 'What it changes' }, { key: 'generated', header: 'Generated', numeric: true },
    { key: 'scored', header: 'Scored', numeric: true }, { key: 'deferred', header: 'Deferred to review', numeric: true }, { key: 'unsupported', header: 'Not applicable', numeric: true },
  ],
  rows: [
    { key: 'lexical.length-minus-one', cells: [{ text: 'lexical.length-minus-one' }, { text: 'Drops the last character of the secret' }, { text: '1,838' }, { text: '321' }, { text: '1,517' }, { text: '2,721' }] },
    { key: 'lexical.invalid-alphabet', cells: [{ text: 'lexical.invalid-alphabet' }, { text: 'Replaces the last character with one outside the format' }, { text: '1,838' }, { text: '0' }, { text: '1,838' }, { text: '2,721' }] },
  ],
};

export const inputs: MethodInputsData = {
  state: 'recorded',
  title: 'Where the cases come from',
  description: '120 pairs read by this method. Synthetic content only.',
  tables: [{ title: 'Suites', description: 'Every case comes from a published suite. Open a suite to read its fixtures.', summary: 'Show the 3 suites', table: suiteTable }],
};

export const operatorInputs: MethodInputsData = {
  ...inputs,
  tables: [...inputs.tables, { title: 'Operators', description: 'Generated counts exclude the unaltered source.', table: operatorTable }],
};

export const holdoutInputs: MethodInputsData = {
  state: 'recorded',
  title: 'The corpus and the candidate',
  description: 'A holdout case cannot be opened. These are the aggregate facts the report publishes.',
  tables: [],
  facts: [
    { term: 'Corpus', description: 'public-controls, revision 1' },
    { term: 'Purpose', description: 'public-conformance' },
    { term: 'Lifecycle', description: 'sealed-at-execution' },
    { term: 'Cases', description: '12 cases, 12 variants, 0 generation errors' },
  ],
  provenance: { summary: 'Full hashes of the corpus, the plan and the candidate', text: '{\n  "corpusHash": "0000000000000000000000000000000000000000000000000000000000000000",\n  "planHash": "1111111111111111111111111111111111111111111111111111111111111111"\n}' },
};

export const missingEvaluation: NotMeasuredData = {
  state: 'not-measured',
  title: 'Not measured: no evaluation published',
  body: 'public/results/evaluation-v1.json is absent: no evaluation was published for this checkout. Method pages read public/results/evaluation-v1.json.',
  command: 'npm run eval:discover\nnpm run eval:publish',
};

const switcher = ['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'].map(id => ({ label: id.charAt(0).toUpperCase() + id.slice(1), href: `/evaluation/method/${id}/` }));

export const pageArgs: MethodPageProps = {
  switchLabel: 'Evaluation methods',
  switcher,
  currentHref: '/evaluation/method/twin/',
  crumbs: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Methods', href: '/evaluation/method/twin/' }, { label: 'Twin' }],
  eyebrow: 'EVALUATION METHOD',
  title: 'Twin',
  lede: 'Each case is an authored pair: a value that should be redacted, and the same text with one authored change that makes it not a secret. A scanner has to treat the two sides differently.',
  meta: [{ label: 'Run', value: '0a1b2c3d · 2026-10-01' }, { label: 'redact-secret', value: '1.2.3 · Published npm package · default detectors' }, { label: 'Accounting', value: 'v1.1' }],
  how: {
    title: 'Does the scanner tell a secret from its harmless twin?',
    steps: [
      { label: 'Input', text: 'An authored pair: a positive text and its negative twin.' },
      { label: 'Change', text: 'One authored change turns the secret into something that is not one.' },
      { label: 'Check', text: 'The positive side is detected within its expected envelope, the twin is left alone, and the pair flips between the two.' },
    ],
    figures: [{ term: 'Pairs', description: '120' }, { term: 'Texts', description: '240' }, { term: 'Suites', description: '3' }],
  },
  recorded,
  read: {
    title: 'Reading twin',
    rules: [
      'The first row is the pair as a whole. The next two are its sides, so a pair that was not told apart shows up in at least one of them.',
      'A pair with a side whose expected outcome is unresolved (tier T0) is counted apart and in none of these rows.',
    ],
  },
  inputs,
};
