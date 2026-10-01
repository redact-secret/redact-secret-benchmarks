import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { packRow, resolveFixtureRecord, type FixtureRecord, type SuiteShared } from '../../resolvers/fixtures';
import type { RowResult } from '../../services/run';
import { FixtureDetail } from './FixtureDetail';
import { fixtureDetail } from './fixturePageData';

/*
 * Page-level states. Each is built by the real resolver from synthetic records, so a story cannot drift
 * from what the page shows: a record is bytes, expected spans and one packed row per scanner. The values
 * are obviously fake; no credential, real or credential-shaped, appears here.
 */
const FAKE = 'synth_token_0123456789_abcdef';
const enc = new TextEncoder();
const at = (text: string, needle: string): [number, number] => {
  const start = enc.encode(text.slice(0, text.indexOf(needle))).length;
  return [start, start + enc.encode(needle).length];
};

const SCANNERS = [
  { id: 'redact-secret', name: 'redact-secret', version: '0.1.0-beta.11', mode: 'Published npm package', status: 'complete', observed: ['2026-09-30'] },
  { id: 'gitleaks', name: 'Gitleaks', version: '8.30.1', mode: 'Directory scan · default rules', status: 'complete', observed: ['2026-09-29'] },
  { id: 'trufflehog', name: 'TruffleHog', version: '3.97.4', mode: 'Filesystem scan · verification disabled', status: 'complete', observed: ['2026-09-29'] },
  { id: 'flare-redact', name: 'flare-redact', version: '1.6.1', mode: 'Published npm package · secrets only', status: 'complete', observed: ['2026-09-29'] },
];

const shared = (over: Partial<SuiteShared> = {}): SuiteShared => ({
  category: 'example-suite',
  suite: { title: 'Example arrivals', reviewStatus: 'Reviewed 2026-09-30' },
  scanners: SCANNERS,
  assessments: [{ reason: 'Synthetic value matches the pinned lexical format contract. Provider issuance and liveness are not claimed.', sources: ['https://docs.example.com/tokens', 'https://github.com/example/scanner/blob/v1/rules.toml'] }],
  followUps: [{ number: 7, url: 'https://github.com/redact-secret/redact-secret/issues/7', milestone: 'Beta.11' }],
  detectorTitles: { 'example-token': 'Example token' },
  familyNames: { 'example:api-key': 'Example API key' },
  providerNames: { 'example:api-key': 'Example' },
  scenarios: [{ id: 'context-and-encoding', title: 'Context and encoding' }, { id: 'regression-behavior', title: 'Regression behavior' }],
  texts: ['#211 · example · sdk-config', 'sdk-config', 'beta.8', 'redact'],
  run: { date: '2026-09-30', mode: 'published' },
  ...over,
});

const row = (r: RowResult): string => packRow(r);
const exact = (range: [number, number]): RowResult => ({ spanOutcomes: ['EXACT'], actual: [{ start: range[0], end: range[1] }], leakedBytes: 0, collateralBytes: 0 });
const missed: RowResult = { spanOutcomes: ['MISS'], actual: [] };
const quiet: RowResult = { flagged: false, actual: [] };

const block = `provider "example" {\n  owner = "acme"\n  token = "${FAKE}"\n}\n`;
const blockRange = at(block, FAKE);
const twinContent = block.replace('_0123', '!0123');

const record = (over: Partial<FixtureRecord>): FixtureRecord => ({
  id: 'example-provider-block', path: 'cases/example-provider-block.tf', kind: 'must-redact', tier: 'T2', contract: 'example-token',
  content: block, expected: [{ start: blockRange[0], end: blockRange[1], role: 'secret', envelope: { start: blockRange[0] - 9, end: blockRange[1] + 1, reason: 'the assignment may be redacted with its value.' } }],
  detectors: ['example-token'], families: ['example:api-key'], assessment: 0, followUps: [0], twins: [], rows: [row(exact(blockRange)), row(exact(blockRange)), row({ spanOutcomes: ['EXACT'], actual: [{ start: blockRange[0] - 9, end: blockRange[1] + 1 }], leakedBytes: 0, collateralBytes: 10 }), null],
  group: 0, axis: 1, milestone: 2, scenarios: [0, 1], sha: '1e024712fd4e',
  ...over,
});

const twinRecord = (id: string, kind: string, mutation: string, content = twinContent): FixtureRecord => record({
  id, path: `cases/${id}.tf`, kind: 'must-not-flag', tier: 'T2', twinOf: 'example-provider-block', mutationKind: kind, mutation, content, expected: [], twins: [], followUps: [],
  rows: [row(quiet), row(quiet), row({ flagged: true, findings: 1, actual: [{ start: blockRange[0], end: blockRange[1] }] }), row(quiet)], sha: '9a7c3b1d5e20',
});

const positiveWithTwins = record({ twins: ['example-provider-block-alphabet-twin', 'example-provider-block-prefix-twin'] });
const alphabetTwin = twinRecord('example-provider-block-alphabet-twin', 'alphabet', "alphabet: one character in the middle of segment 2 replaced with '!'; length unchanged");
const prefixTwin = twinRecord('example-provider-block-prefix-twin', 'prefix', 'prefix: the documented prefix is replaced with another of the same length', block.replace('synth_', 'other_'));

const page = (rec: FixtureRecord, sh: SuiteShared = shared(), siblings: FixtureRecord[] = []) => resolveFixtureRecord(rec, sh, [rec, ...siblings]);

const meta = {
  title: 'Report/FixtureDetail',
  component: FixtureDetail,
  args: { fixture: fixtureDetail },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FixtureDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Hand-authored data: the whole page, redact-secret exact, one twin, three other scanners. */
export const Default: Story = {};

/** The same page from synthetic records through the resolver: two twins, each its own file and outcome. */
export const WithTwins: Story = { args: { fixture: page(positiveWithTwins, shared(), [alphabetTwin, prefixTwin]) } };

/** On a twin's own page the related file is the original, with the bytes that differ boxed. */
export const TheTwinItself: Story = { args: { fixture: page(alphabetTwin, shared(), [positiveWithTwins]) } };

const THREE = `a=${FAKE}\nb=${FAKE.replace('0123', '4567')}\nc=${FAKE.replace('0123', '8901')}\nnote ${FAKE.replace('0123', '2468')}\n`;
const [a1, a2] = at(THREE, FAKE);
const b = at(THREE, FAKE.replace('0123', '4567'));
const c = at(THREE, FAKE.replace('0123', '8901'));
const d = at(THREE, FAKE.replace('0123', '2468'));

/** Exact, partly exposed, missed and past the envelope on one file: every outcome kind in one page. */
export const EveryOutcome: Story = {
  args: {
    fixture: page(record({
      id: 'four-secrets', path: 'cases/four-secrets.env', content: THREE, twins: [], families: ['example:api-key'],
      expected: [{ start: a1, end: a2, role: 'secret' }, { start: b[0], end: b[1], role: 'secret' }, { start: c[0], end: c[1], role: 'secret' }, { start: d[0], end: d[1], role: 'secret', envelope: { start: d[0], end: d[1] + 1 } }, { start: 0, end: 2, role: 'companion' }],
      rows: [
        row({ spanOutcomes: ['EXACT', 'PARTIAL', 'MISS', 'OVERBROAD'], actual: [{ start: a1, end: a2 }, { start: b[0], end: b[0] + 12 }, { start: d[0] - 4, end: d[1] + 40 }, { start: 0, end: 1 }], leakedBytes: b[1] - b[0] - 12 + c[1] - c[0], collateralBytes: 44 }),
        row({ spanOutcomes: ['EXACT', 'EXACT', 'EXACT', 'EXACT'], actual: [[a1, a2], b, c, d].map(([start, end]) => ({ start, end })), leakedBytes: 0, collateralBytes: 0 }),
        row({ spanOutcomes: ['MISS', 'MISS', 'MISS', 'MISS'], actual: [] }),
        null,
      ],
    })),
  },
};

/** A policy fixture is information: the status is the info shape and the words say so. */
export const PolicyLeftReadable: Story = {
  args: { fixture: page(record({ id: 'policy-fixture', kind: 'policy', tier: 'T3', rows: [row(missed), row(exact(blockRange)), row(missed), null], action: 3 })) },
};

/** A control with nothing flagged: no spans table rows, a sentence instead. */
export const QuietControl: Story = {
  args: { fixture: page(record({ id: 'a-control', kind: 'must-not-flag', content: 'example_value=placeholder\n', expected: [], twins: [], rows: [row(quiet), row(quiet), row(quiet), row(quiet)] })) },
};

/** A control the product flagged: each reported range is a row and a solid bar on the output. */
export const FlaggedControl: Story = {
  args: { fixture: page(record({ id: 'a-control', kind: 'must-not-flag', content: 'example_value=placeholder\n', expected: [], twins: [], rows: [row({ flagged: true, findings: 2, actual: [{ start: 14, end: 25 }, { start: 0, end: 7 }] }), row(quiet), row(quiet), null] })) },
};

/** The product holds a row but reported nothing on a file that expects a secret. */
export const NoRangesReported: Story = {
  args: { fixture: page(record({ rows: [row(missed), row(missed), row(exact(blockRange)), null], twins: [] })) },
};

/** The run holds no row for these bytes. */
export const NotMeasured: Story = {
  args: { fixture: page(record({ rows: [null, null, null, null], twins: [] })) },
};

/** No run is published for this checkout: no scanners, no figures, the expectation stands alone. */
export const NoRun: Story = {
  args: { fixture: page(record({ rows: [], twins: [] }), shared({ scanners: [], run: undefined, runProblem: 'No benchmark run is published for this checkout.' })) },
};

/** The run's report for this suite was left out because it did not re-validate. */
export const ReportLeftOut: Story = {
  args: { fixture: page(record({ rows: [null, null, null, null], twins: [] }), shared({ runProblem: 'The report for these bytes is left out: its corpus hash does not match. The expectation stands on its own; lanes appear once a report re-validates against these bytes.' })) },
};

/** Characters nobody can see (BOM, zero-width, bidi, NUL, tab, carriage return, trailing space) are drawn as symbols and the file says so. */
const HIDDEN = `\ufeffkey=${FAKE}\u200b\u202e  \r\ntab\there\u0000nul\r\ntrailing   \r\n`;
const hiddenAt = at(HIDDEN, FAKE);
export const UnreadableBytes: Story = {
  args: { fixture: page(record({ id: 'hidden-characters', path: 'cases/hidden-characters.txt', content: HIDDEN, expected: [{ start: hiddenAt[0], end: hiddenAt[1], role: 'secret' }], twins: [], rows: [row(exact(hiddenAt)), row(exact(hiddenAt)), row(missed), null] })) },
};

const LONG_ID = 'a-very-long-fixture-id-with-no-natural-break-points-0123456789-0123456789-0123456789-0123456789';
const LONG = `value=${'0123456789'.repeat(40)}${FAKE}${'abcdefghij'.repeat(10)}\n`;
const longAt = at(LONG, FAKE);
/** A long id, an unbroken 500-character line and long reason text stay inside their blocks. */
export const LongValues: Story = {
  args: {
    fixture: page(
      record({ id: LONG_ID, path: `cases/${LONG_ID}.env`, content: LONG, expected: [{ start: longAt[0], end: longAt[1], role: 'secret' }], twins: [], rows: [row(exact(longAt)), row(exact(longAt)), row(missed), null] }),
      shared({ assessments: [{ reason: 'A very long reason, written by the corpus author, that keeps going without a natural break. '.repeat(5), sources: Array.from({ length: 7 }, (_, i) => `https://example.com/a/very/long/source/path/${i}`) }] }),
    ),
  },
};

const MANY = Array.from({ length: 10 }, (_, i) => ({ id: `peer-${i}`, name: `Peer scanner ${i + 1}`, version: `${i + 1}.0.0`, mode: 'Directory scan · default rules', status: 'complete', observed: ['2026-09-29'] }));
/** Ten other scanners: the disclosure holds a table of them and the lanes. */
export const ManyScanners: Story = {
  args: { fixture: page(record({ twins: [], rows: [row(exact(blockRange)), ...MANY.map((_, i) => (i % 3 === 0 ? row(missed) : row(exact(blockRange))))] }), shared({ scanners: [SCANNERS[0], ...MANY] })) },
};

const LONG_FILE = Array.from({ length: 120 }, (_, i) => (i === 80 ? `Authorization: Bearer ${FAKE}` : `INFO line ${i + 1} nothing to see here`)).join('\n') + '\n';
const lf = at(LONG_FILE, FAKE);
/** A 120-line file keeps the lines a mark touches, with one line of context, and counts the rest. */
export const LongFile: Story = {
  args: { fixture: page(record({ id: 'long-log', path: 'cases/long-log.log', content: LONG_FILE, expected: [{ start: lf[0], end: lf[1], role: 'secret' }], twins: [], rows: [row(exact(lf)), row(exact(lf)), row(missed), null] })) },
};

/** A fixture no family owns: the breadcrumb goes by suite, and the family row says why. */
export const NoFamily: Story = {
  args: { fixture: page(record({ families: [], unscoped: 3, twins: [] }), shared({ texts: ['#211 · example · sdk-config', 'sdk-config', 'beta.8', 'A generic credential shape that no provider owns.'] })) },
};

export const Phone: Story = {
  args: { fixture: page(positiveWithTwins, shared(), [alphabetTwin, prefixTwin]) },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

export const PhoneEveryOutcome: Story = { ...EveryOutcome, globals: { viewport: { value: 'mobile1', isRotated: false } } };
