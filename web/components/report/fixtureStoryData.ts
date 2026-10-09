/**
 * Synthetic story data for the fixture, level, suite, detector and findings blocks
 * (#559). Invented ids and values; the byte examples are obviously fake and no
 * credential value appears anywhere.
 */
import type {
  ByteLineData,
  DetectorGroupRowData,
  DetectorRowData,
  FindingRowData,
  FixtureCounts,
  FixtureRowData,
  FixtureScannerData,
  LanePiece,
  ScannerColumnData,
  StatusLabel,
  SuiteRowData,
} from './types';

const s = (status: StatusLabel['status'], label: string): StatusLabel => ({ status, label });
const c = (leftReadable: string, tooMuch: string, falseAlarms: string, notMeasured?: string): FixtureCounts => ({ leftReadable, tooMuch, falseAlarms, notMeasured });

// ---- Rows with one outcome column per scanner ----------------------------------------------------

export const scannerColumns: ScannerColumnData[] = [
  { id: 'redact-secret', name: 'redact-secret' },
  { id: 'gitleaks', name: 'Gitleaks' },
  { id: 'trufflehog', name: 'TruffleHog' },
  { id: 'flare-redact', name: 'flare-redact' },
  { id: 'openredaction', name: 'OpenRedaction' },
];

const redacted = s('pass', 'Redacted');
const readable = s('fail', 'Left readable');
const quiet = s('pass', 'Quiet');
const flagged = s('fail', 'Flagged');
const notMeasured = s('not-measured', 'Not measured');

export const scannerRows: FixtureRowData[] = [
  { slug: 'pat-in-env-file', group: 'github-token · github', kind: 'Must redact', evidence: 'T1 · Provider-documented', outcome: redacted, href: '/report/corpus/github-token/?fixture=pat-in-env-file', outcomes: [redacted, redacted, redacted, readable, readable] },
  { slug: 'pat-in-curl-header', group: 'github-token · github', alsoIn: 'also in 1 other family', kind: 'Must redact', evidence: 'T1 · Provider-documented', outcome: readable, href: '/report/corpus/github-token/?fixture=pat-in-curl-header', outcomes: [readable, redacted, redacted, redacted, readable] },
  { slug: 'pat-look-alike-one-char-off', group: 'github-token · github', kind: 'Must not flag', evidence: 'T2 · Tool-corroborated', outcome: quiet, href: '/report/corpus/github-token/?fixture=pat-look-alike-one-char-off', outcomes: [quiet, quiet, flagged, quiet, quiet] },
  { slug: 'pat-in-shell-history', group: 'github-token · github', kind: 'Must redact', evidence: 'T2 · Tool-corroborated', outcome: s('review', 'Too much'), href: '/report/corpus/github-token/?fixture=pat-in-shell-history', outcomes: [s('review', 'Too much'), redacted, redacted, notMeasured, readable] },
  { slug: 'pat-placeholder-in-docs', group: 'github-token · github', kind: 'Project policy', evidence: 'T3 · Project policy', outcome: s('info', 'Redacted'), href: '/report/corpus/github-token/?fixture=pat-placeholder-in-docs', outcomes: [s('info', 'Redacted'), s('info', 'Left readable'), s('info', 'Left readable'), s('info', 'Left readable'), s('info', 'Redacted')] },
];

export const manyScannerRows: FixtureRowData[] = Array.from({ length: 50 }, (_, i) => ({
  ...scannerRows[i % scannerRows.length],
  slug: i === 3 ? 'pat-in-a-very-long-nested-fixture-slug-that-has-no-natural-break-points-at-all-0123456789' : `pat-fixture-${i + 1}`,
  href: `/report/corpus/github-token/?fixture=pat-fixture-${i + 1}`,
}));

// ---- One fixture: bytes, lanes, expected spans, reported ranges ------------------------------------

export const fixtureScanners: FixtureScannerData[] = [
  { id: 'redact-secret', name: 'redact-secret', verdict: [s('pass', 'Redacted')] },
  { id: 'gitleaks', name: 'Gitleaks', verdict: [s('fail', 'Left readable')] },
  { id: 'trufflehog', name: 'TruffleHog', verdict: [s('review', 'Too much')] },
];

const lane = (pieces: LanePiece[], label: string) => ({ label, pieces });

/** `TOKEN=` then a synthetic 8-character value, with an envelope around it. Nothing here is a credential. */
export const fixtureLines: ByteLineData[] = [
  { number: 1, segments: [{ text: '# example configuration\n' }], lanes: [] },
  {
    number: 2,
    segments: [{ text: 'TOKEN=', envelope: true }, { text: 'synth-01', role: 'secret', envelope: true }, { text: '\n' }],
    lanes: [
      lane([{ text: 'TOKEN=' }, { text: 'synth-01', shape: 'fill' }, { text: '\n' }], 'redact-secret, line 2: covered bytes 6-14'),
      lane([{ text: 'TOKEN=' }, { text: 'synth-', shape: 'hatch' }, { text: '01\n' }], 'Gitleaks, line 2: partly covered bytes 6-12'),
      lane([{ text: 'TOKEN=', shape: 'fill' }, { text: 'synth-01', shape: 'fill' }, { text: '\n' }], 'TruffleHog, line 2: covered bytes 0-14'),
    ],
  },
  { number: 3, segments: [{ text: 'password:\tvalue with a trailing space \r\n' }], lanes: [] },
];

/** A missed span is a dashed frame where the secret is; a control has no secret span at all. */
export const missedLines: ByteLineData[] = [
  {
    number: 1,
    segments: [{ text: 'key=' }, { text: 'synth-02', role: 'secret' }, { text: '\n' }],
    lanes: [lane([{ text: 'key=' }, { text: 'synth-02', shape: 'outline' }, { text: '\n' }], 'Gitleaks, line 1: missed bytes 4-12')],
  },
];

// ---- Detectors ------------------------------------------------------------------------------------

export const detectorRows: DetectorRowData[] = [
  { id: 'github-token', title: 'GitHub tokens', href: '/report/detectors/github-token/', fixtures: '412', value: 412, max: 412, minimum: 5 },
  { id: 'stripe-token', title: 'Stripe keys', href: '/report/detectors/stripe-token/', fixtures: '96', value: 96, max: 412, minimum: 5 },
  { id: 'example-token', title: 'Example token', href: '/report/detectors/example-token/', fixtures: '5', value: 5, max: 412, minimum: 5, flag: s('withheld', 'At minimum') },
  { id: 'rare-token', title: 'A rarely exercised detector with a very long display name that should wrap', href: '/report/detectors/rare-token/', fixtures: '3', value: 3, max: 412, minimum: 5, flag: s('withheld', 'Below minimum') },
];

export const detectorGroups: DetectorGroupRowData[] = [
  {
    group: 'Must redact · Provider-documented', fixtures: '58',
    headline: { label: 'Leaked, at most', value: '7.2%', note: '2 of 61 spans' },
    secondary: { label: 'Tells near-twins apart, at least', value: '79.0%', note: '45 of 50 pairs' },
    outcomes: { segments: [{ kind: 'fill', weight: 58 }, { kind: 'wide', weight: 1 }, { kind: 'hatch', weight: 1 }, { kind: 'outline', weight: 1 }], label: '58 redacted, 1 too much, 1 partly exposed, 1 missed', text: '58 redacted · 1 too much · 1 partly exposed · 1 missed' },
    others: [{ scanner: 'Gitleaks', value: 'at most 45.0%' }, { scanner: 'TruffleHog', value: 'at most 36.0%' }],
  },
  {
    group: 'Must not flag · Provider-documented', fixtures: '10',
    headline: { label: 'False alarms, at most', value: '27.8%', note: '0 of 10 controls flagged' },
    outcomes: { segments: [{ kind: 'fill', weight: 10 }], label: '10 quiet, 0 flagged', text: '10 quiet · 0 flagged' },
    others: [{ scanner: 'Gitleaks', value: 'at most 27.8%' }, { scanner: 'TruffleHog', value: 'insufficient-evidence' }],
  },
  { group: 'Pending review', fixtures: '3', headline: { label: 'Unscored', value: 'Not scored', note: 'Inspect only: never scored until evidence exists' }, others: [] },
];

// ---- Findings inventory ---------------------------------------------------------------------------

export const findingRows: FindingRowData[] = [
  { id: '292', number: '#292', title: 'Preserve Windows environment references and SQL bind parameters in contextual detection', href: 'https://github.com/redact-secret/redact-secret/issues/292', status: s('pass', 'Fixed'), kind: 'Flagged a safe value', fixtures: [{ label: 'windows-env', href: '/report/corpus/reference-syntax/?fixture=windows-env' }, { label: 'sql-bind', href: '/report/corpus/reference-syntax/?fixture=sql-bind' }], measured: '0.1.0-beta.3', reviewed: '2026-09-16' },
  { id: '936', number: '#936', title: 'Policy: keyword co-occurrence spans warn instead of redact', href: 'https://github.com/redact-secret/redact-secret/issues/936', status: s('withheld', 'Policy'), kind: 'Left a secret readable', fixtures: [{ label: 'keyword-cooccurrence', href: '/report/corpus/policy/?fixture=keyword-cooccurrence' }], measured: '0.1.0-beta.3', reviewed: '2026-09-28' },
  { id: '999', number: '#999', title: 'Context-gated legacy keys missed when the provider context is on the previous line (a_very_long_unbroken_identifier_that_keeps_going_and_going_without_a_break)', href: 'https://github.com/redact-secret/redact-secret/issues/999', status: s('review', 'In review'), kind: 'Left a secret readable', fixtures: [{ label: 'a-fixture-slug-that-is-not-in-the-corpus' }], measured: '0.1.0-beta.3', reviewed: '2026-09-28' },
];

// ---- Suites ---------------------------------------------------------------------------------------

export const suiteRows: SuiteRowData[] = [
  { id: 'detector-coverage', title: 'Detector coverage', href: '/report/corpus/detector-coverage/', fixtures: '1,309', description: 'One fixture per detector shape, in the plainest context.', counts: c('12', '3', '1') },
  { id: 'context-edges', title: 'Context edges', href: '/report/corpus/context-edges/', fixtures: '173', description: 'One credential wrapped in many syntactic contexts.', counts: c('4', '0', '0', '2') },
  { id: 'not-run-yet', title: 'A suite with no fixtures', href: '/report/corpus/not-run-yet/', fixtures: '0', description: 'Registered, no fixtures.', counts: null },
];
