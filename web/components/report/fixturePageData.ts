/**
 * Synthetic data for the fixture page blocks (#588). Invented ids and values; the example secret is an
 * obviously fake string and no credential, real or credential-shaped, appears anywhere. The page-level
 * states in `FixtureDetail.stories.tsx` are built from synthetic records by the real resolver; the
 * values here feed the single blocks.
 */
import type {
  FixtureDetailData, FixtureFactData, FixtureFileData, FixturePeersData, FixtureSpanRow, FixtureTwinData, FixtureVerdictData,
} from './fixtureTypes';
import type { StatusLabel } from './types';

const s = (status: StatusLabel['status'], label: string): StatusLabel => ({ status, label });

export const FAKE = 'synth_token_0123456789_abcdef';
const FACTS = '95 bytes · LF · UTF-8';

/** The input: a synthetic assignment with its value expected and an envelope around the whole assignment. */
export const inputFile: FixtureFileData = {
  label: 'Input file',
  title: 'cases/example-provider-block.tf',
  facts: FACTS,
  note: 'expected bytes 41–70',
  rows: [
    { number: 1, segments: [{ text: 'provider "example" {' }] },
    { number: 2, segments: [{ text: '  owner = "acme"' }] },
    { number: 3, segments: [{ text: '  token = "', envelope: true }, { text: FAKE, mark: 'expected', envelope: true, title: 'Expected secret, bytes 41 to 70' }, { text: '"', envelope: true }] },
    { number: 4, segments: [{ text: '}' }] },
  ],
};

/** The output: the reported range drawn as a bar over the same bytes. */
export const outputFile: FixtureFileData = {
  label: 'Output with the reported ranges drawn over the input',
  title: '1 range reported',
  facts: FACTS,
  note: 'bytes 41–70',
  rows: [
    { number: 1, segments: [{ text: 'provider "example" {' }] },
    { number: 2, segments: [{ text: '  owner = "acme"' }] },
    { number: 3, segments: [{ text: '  token = "' }, { text: FAKE, mark: 'redacted', label: 'redacted, 29 bytes', title: 'Reported range, bytes 41 to 70' }, { text: '"' }] },
    { number: 4, segments: [{ text: '}' }] },
  ],
};

/** A reported range that covers part of the secret (hatched) with the rest left readable (dashed frame). */
export const partialOutputFile: FixtureFileData = {
  ...outputFile,
  title: '1 range reported',
  note: 'bytes 41–55',
  rows: [
    { number: 3, segments: [{ text: '  token = "' }, { text: FAKE.slice(0, 14), mark: 'partial', label: 'redacted, a secret is partly exposed, 14 bytes' }, { text: FAKE.slice(14), mark: 'exposed', title: 'Secret bytes no reported range covers' }, { text: '"' }] },
  ],
};

/** A missed secret: nothing reported, the bytes show inside a dashed frame. */
export const missedOutputFile: FixtureFileData = {
  ...outputFile,
  title: 'no range reported',
  note: undefined,
  rows: [{ number: 3, segments: [{ text: '  token = "' }, { text: FAKE, mark: 'exposed', title: 'Secret bytes no reported range covers' }, { text: '"' }] }],
};

/** A long file keeps the lines a mark touches and counts the rest. */
export const windowedFile: FixtureFileData = {
  ...inputFile,
  title: 'cases/a-long-file.log',
  facts: '4,812 bytes · LF · UTF-8',
  rows: [
    { gap: 41 },
    { number: 42, segments: [{ text: 'INFO started worker 7' }] },
    { number: 43, segments: [{ text: 'auth header: Bearer ' }, { text: FAKE, mark: 'expected', title: 'Expected secret, bytes 2210 to 2239' }] },
    { number: 44, segments: [{ text: 'INFO finished' }] },
    { gap: 156 },
  ],
};

/** Characters nobody can see are drawn as symbols and the file says so. */
export const unreadableFile: FixtureFileData = {
  label: 'Input file',
  title: 'cases/hidden-characters.txt',
  facts: '38 bytes · CRLF · UTF-8 with BOM',
  rows: [
    { number: 1, segments: [{ text: '\ufeffkey=' }, { text: FAKE.slice(0, 12), mark: 'expected' }, { text: '\u200b\u202e  \r' }] },
    { number: 2, segments: [{ text: 'tab\there\u0000nul and a no-break\u00a0space\r' }] },
    { number: 3, segments: [] },
    { number: 4, segments: [{ text: 'trailing spaces   ' }] },
  ],
  notice: 'This file holds 5 characters that are not normally visible (U+FEFF, U+200B, U+202E, U+0000, U+00A0), drawn as symbols. The bytes are exact; the symbols are only how they are drawn.',
};

export const longLineFile: FixtureFileData = {
  ...inputFile,
  title: 'cases/a-fixture-with-an-extremely-long-path-and-an-unbroken-name-0123456789-0123456789-0123456789.env',
  rows: [{ number: 1, segments: [{ text: `value=${'0123456789'.repeat(24)}` }] }, { number: 2, segments: [] }],
};

export const verdictExact: FixtureVerdictData = {
  who: 'redact-secret 0.1.0-beta.11',
  run: 'published run 2026-09-30',
  headline: s('pass', 'Redacted exactly'),
  explanation: 'It reported one range that starts and ends on the same bytes as the expected secret.',
  figures: [
    { label: 'Secret spans covered', value: '1', of: 'of 1' },
    { label: 'Bytes left readable', value: '0' },
    { label: 'Bytes redacted outside the envelope', value: '0' },
  ],
};

export const verdictLeft: FixtureVerdictData = {
  who: 'redact-secret 0.1.0-beta.11',
  run: 'published run 2026-09-30',
  headline: s('fail', 'Some left readable'),
  explanation: 'Of 3 expected secret spans: 1 exact, 1 partly covered, 1 not covered.',
  figures: [
    { label: 'Secret spans covered', value: '1', of: 'of 3' },
    { label: 'Bytes left readable', value: '41' },
    { label: 'Bytes redacted outside the envelope', value: '0' },
  ],
};

export const verdictOver: FixtureVerdictData = {
  who: 'redact-secret candidate main 1a2b3c4',
  run: 'candidate run 2026-10-01',
  headline: s('review', 'Redacted past the envelope'),
  explanation: 'Of 1 expected secret span: 1 covered past the envelope.',
  figures: [
    { label: 'Secret spans covered', value: '1', of: 'of 1' },
    { label: 'Bytes left readable', value: '0' },
    { label: 'Bytes redacted outside the envelope', value: '212' },
  ],
};

export const verdictQuiet: FixtureVerdictData = {
  who: 'redact-secret 0.1.0-beta.11',
  run: 'published run 2026-09-30',
  headline: s('pass', 'Quiet'),
  explanation: 'It reported no range on this file, which holds no expected secret.',
  figures: [
    { label: 'Secret spans expected', value: '0' },
    { label: 'Ranges reported', value: '0' },
    { label: 'Bytes in reported ranges', value: '0' },
  ],
};

export const verdictFlagged: FixtureVerdictData = {
  who: 'redact-secret 0.1.0-beta.11',
  run: 'published run 2026-09-30',
  headline: s('fail', 'Flagged'),
  explanation: 'It reported 2 ranges on a file that holds no expected secret.',
  figures: [
    { label: 'Secret spans expected', value: '0' },
    { label: 'Ranges reported', value: '2' },
    { label: 'Bytes in reported ranges', value: '34' },
  ],
};

export const verdictPolicy: FixtureVerdictData = {
  who: 'redact-secret 0.1.0-beta.11',
  run: 'published run 2026-09-30',
  headline: s('info', 'Left readable'),
  explanation: 'Of 1 expected secret span: 1 not covered. This is a project-policy fixture: the outcome is recorded as information.',
  figures: [
    { label: 'Secret spans covered', value: '0', of: 'of 1' },
    { label: 'Bytes left readable', value: '29' },
    { label: 'Bytes redacted outside the envelope', value: '0' },
  ],
};

export const verdictNotMeasured: FixtureVerdictData = {
  who: 'redact-secret',
  run: 'no run recorded',
  headline: s('not-measured', 'Not measured'),
  explanation: 'No benchmark run is published for this checkout.',
  figures: [],
};

export const spanRows: FixtureSpanRow[] = [
  {
    label: 'Secret 1', role: 'role: secret',
    expected: { range: '41–70', size: '29 bytes', envelope: '32–71: the assignment name may be redacted with its value' },
    reported: [{ range: '41–70', size: '29 bytes' }], reportedNote: 'none reported',
    outcome: s('pass', 'Exact'), outcomeNote: 'A reported range equals the span: same start, same end',
  },
];

export const spanRowsEvery: FixtureSpanRow[] = [
  { label: 'Secret 1', role: 'role: secret', expected: { range: '10–38', size: '28 bytes' }, reported: [{ range: '10–38', size: '28 bytes' }], reportedNote: '', outcome: s('pass', 'Exact'), outcomeNote: 'A reported range equals the span: same start, same end' },
  { label: 'Secret 2', role: 'role: secret', expected: { range: '60–88', size: '28 bytes' }, reported: [{ range: '55–95', size: '40 bytes' }], reportedNote: '', outcome: s('pass', 'Within range'), outcomeNote: 'One reported range contains it and stays inside the envelope' },
  { label: 'Secret 3', role: 'role: secret', expected: { range: '120–148', size: '28 bytes', envelope: '120–150' }, reported: [{ range: '100–400', size: '300 bytes' }], reportedNote: '', outcome: s('review', 'Too much'), outcomeNote: 'One reported range contains it and reaches past the envelope' },
  { label: 'Secret 4', role: 'role: secret', expected: { range: '170–198', size: '28 bytes' }, reported: [{ range: '170–184', size: '14 bytes' }, { range: '190–198', size: '8 bytes' }], reportedNote: '', outcome: s('fail', 'Partly exposed'), outcomeNote: 'Reported ranges overlap it but none contains it' },
  { label: 'Secret 5', role: 'role: secret', expected: { range: '220–248', size: '28 bytes' }, reported: [], reportedNote: 'none reported', outcome: s('fail', 'Missed'), outcomeNote: 'No reported range overlaps it' },
  { label: 'Companion 1', role: 'role: companion', expected: { range: '210–219', size: '9 bytes' }, reported: [], reportedNote: 'none reported', outcomeNote: 'context, not scored' },
  { label: 'Outside the expected spans', role: 'reported where nothing is expected', reported: [{ range: '300–312', size: '12 bytes' }], reportedNote: '' },
];

export const spanRowsPolicy: FixtureSpanRow[] = [
  { label: 'Secret 1', role: 'role: secret', expected: { range: '41–70', size: '29 bytes' }, reported: [], reportedNote: 'none reported', outcome: s('info', 'Missed'), outcomeNote: 'No reported range overlaps it' },
];

export const spanRowsControl: FixtureSpanRow[] = [
  { label: 'Reported range 1', role: 'no secret expected', reported: [{ range: '12–20', size: '8 bytes' }], reportedNote: '', outcome: s('fail', 'Flagged'), outcomeNote: 'a finding on a file with no expected secret' },
  { label: 'Reported range 2', role: 'no secret expected', reported: [{ range: '40–66', size: '26 bytes' }], reportedNote: '', outcome: s('fail', 'Flagged'), outcomeNote: 'a finding on a file with no expected secret' },
];

export const spanRowsNotMeasured: FixtureSpanRow[] = [
  { label: 'Secret 1', role: 'role: secret', expected: { range: '41–70', size: '29 bytes' }, reported: [], reportedNote: 'not measured', outcome: s('not-measured', 'Not measured') },
];

const twinFile: FixtureFileData = {
  label: 'example-provider-block-alphabet-twin, changed lines',
  title: 'cases/example-provider-block-alphabet-twin.tf',
  facts: FACTS,
  note: 'byte 52 changed',
  rows: [
    { gap: 2 },
    { number: 3, segments: [{ text: `  token = "${FAKE.slice(0, 11)}` }, { text: '!', mark: 'changed', title: 'A byte that differs from this fixture' }, { text: `${FAKE.slice(12)}"` }] },
    { gap: 1 },
  ],
};

export const twin: FixtureTwinData = {
  id: 'example-provider-block-alphabet-twin',
  href: '/report/fixtures/example-suite/?fixture=example-provider-block-alphabet-twin',
  title: 'Alphabet twin',
  description: "alphabet: one character in the middle of segment 2 replaced with '!', outside every cited alphabet; length unchanged",
  changed: 'byte 52 changed',
  file: twinFile,
  outcome: [s('pass', 'Quiet')],
  outcomeNote: 'redact-secret flagged nothing',
  linkLabel: 'Open the twin',
};

export const twinFlagged: FixtureTwinData = {
  ...twin,
  id: 'example-provider-block-prefix-twin',
  title: 'Prefix twin',
  file: { ...twin.file!, label: 'example-provider-block-prefix-twin, changed lines' },
  description: 'prefix: the documented prefix is replaced with another of the same length',
  outcome: [s('fail', 'Flagged')],
  outcomeNote: 'redact-secret reported 1 range',
};

export const original: FixtureTwinData = {
  ...twin,
  id: 'example-provider-block',
  title: 'The original',
  description: 'example-provider-block is the file this one was made from. What was changed: alphabet: one character replaced with !',
  outcome: [s('pass', 'Exact')],
  outcomeNote: 'redact-secret: 1 secret span',
  linkLabel: 'Open the original',
};

export const facts: FixtureFactData[] = [
  { term: 'What it tests', notRecorded: true, note: 'The corpus records a group label, “#211 · example · sdk-config”, and no description.' },
  { term: 'Why it must be redacted', value: 'Synthetic value matches the pinned lexical format contract. Provider issuance, payload/checksum validity and liveness are not claimed.' },
  { term: 'Contract', value: 'example-token', mono: true },
  { term: 'Evidence level', value: 'T2 · Tool-corroborated' },
  { term: 'Family', links: [{ label: 'Example API key', href: '/report/families/example--api-key/' }] },
  { term: 'Detector', links: [{ label: 'Example token', href: '/report/detectors/example-token/' }] },
  { term: 'Scenarios', value: 'Context and encoding · Regression behavior' },
  { term: 'Context axis', value: 'sdk-config', mono: true },
  { term: 'Added', value: 'Beta.8 · suite Example arrivals', note: 'Suite example-suite' },
  { term: 'Issues', links: [{ label: 'Issue #211', href: 'https://github.com/redact-secret/redact-secret/issues/211', external: true }] },
  { term: 'Review', value: 'Authored from construction and evidence, never from scanner output.' },
  { term: 'File', value: 'cases/example-provider-block.tf', mono: true, note: '95 bytes · sha256 1e024712fd4e…' },
];

export const peers: FixturePeersData = {
  summary: 'Same input, 3 other scanners',
  relatedHeading: 'Its twin',
  rows: [
    { id: 'gitleaks', name: 'Gitleaks 8.30.1', detail: 'Results from 2026-09-29 · Directory scan · default rules', fixture: [s('pass', 'Exact')], ranges: '[41, 70)', related: [{ label: 'example-provider-block-alphabet-twin', outcome: [s('pass', 'Quiet')] }] },
    { id: 'trufflehog', name: 'TruffleHog 3.97.4', detail: 'Results from 2026-09-29 · Filesystem scan · verification disabled', fixture: [s('review', 'Too much')], ranges: '[32, 71)', related: [{ label: 'example-provider-block-alphabet-twin', outcome: [s('fail', 'Flagged')] }] },
    { id: 'flare-redact', name: 'flare-redact 1.6.1', detail: 'Results from 2026-09-29 · Published npm package', fixture: [s('not-measured', 'Not measured')], ranges: '—' },
  ],
};

export const fixtureDetail: FixtureDetailData = {
  id: 'example-provider-block',
  head: {
    eyebrow: 'Fixture · must redact',
    title: 'example-provider-block',
    slug: 'example-suite--example-provider-block',
    tags: [{ label: 'Must redact' }, { label: 'T2 · Tool-corroborated' }, { label: 'sdk-config', mono: true }, { label: 'Synthetic value', dashed: true }],
  },
  crumbs: [{ label: 'Report', href: '/report/' }, { label: 'Providers', href: '/report/providers/' }, { label: 'Example', href: '/report/providers/?q=Example' }, { label: 'Example API key', href: '/report/families/example--api-key/' }, { label: 'example-provider-block' }],
  suiteHref: '/report/fixtures/example-suite/',
  verdict: verdictExact,
  input: inputFile,
  output: outputFile,
  key: [{ mark: 'expected', label: 'Expected secret' }, { mark: 'envelope', label: 'Envelope: may be redacted at no cost' }, { mark: 'redacted', label: 'Reported by redact-secret' }],
  spans: spanRows,
  spansLede: 'Offsets are UTF-8 bytes, [start, end). An envelope is the widest range a finding may reach at no cost: authored with a reason, hashed with the corpus and never widened in response to a scanner.',
  twins: {
    heading: 'Its near-twin',
    lede: 'The same file with one authored mutation. The corpus expects nothing to be flagged on a twin; a scanner that redacts this fixture and stays quiet on the twin tells the two apart.',
    items: [twin],
  },
  whyHeading: 'Why this fixture exists',
  facts,
  sources: [{ href: 'https://docs.example.com/tokens', label: 'docs.example.com/tokens' }, { href: 'https://example.com/community/36441', label: 'example.com/community' }],
  escaped: `"provider \\"example\\" {\\n  owner = \\"acme\\"\\n  token = \\"${FAKE}\\"\\n}\\n"`,
  command: 'npm run bench -- --category=example-suite',
  actions: { download: { href: 'data:text/plain;charset=utf-8,example', filename: 'example-provider-block.tf' }, corpusHref: '/report/fixtures/example-suite/' },
  peers,
};
