/**
 * Synthetic story data for the performance pair blocks, shaped like what the resolver produces
 * (see ./performance-types.ts). Times are invented for the stories; none is a real measurement,
 * a real credential or a real person. Stories import this; components never do.
 */
import type {
  MissingGroup, OwnRunRow, PairSideInfo, PerformanceCase, PerformanceCell, PerformanceGroup, PickerControl, TrackMark, TrackTick,
} from './performance-types';

const LO = 0;
const HI = 4;
const at = (ms: number): number => Math.round(((Math.log10(ms) - LO) / (HI - LO)) * 10000) / 10000;
const fmt = (ms: number): string => (ms < 100 ? ms.toFixed(1) : Math.round(ms).toLocaleString('en-US'));

export const ticks: TrackTick[] = [1, 10, 100, 1000, 10000].map(ms => ({ position: at(ms), label: ms >= 1000 ? `${ms / 1000} s` : `${ms} ms` }));

export const sideA = 'redact-secret';
export const sideB = 'flare-redact';

export const timed = (median: number, min: number, max: number, did: string, mbs = '17.1', runs = 12): PerformanceCell => ({
  state: 'timed', time: `${fmt(median)} ms`, speed: `${mbs} MB/s · ${runs} runs`, spread: `${fmt(min)} to ${fmt(max)} ms`, did,
});
export const notMeasured = (reason: string): PerformanceCell => ({ state: 'not-measured', reason });

const mark = (side: 'a' | 'b', median: number, min?: number, max?: number): TrackMark => ({
  side, position: at(median), label: `${side === 'a' ? sideA : sideB} ${fmt(median)} ms`,
  ...(min !== undefined && max !== undefined ? { range: [at(min), at(max)] as [number, number] } : {}),
});

export const picker: { controls: PickerControl[]; legend: { side: 'a' | 'b'; label: string }[]; legendNote: string } = {
  controls: [
    {
      label: 'Compare with',
      items: [{ label: 'flare-redact', href: '/comparison/performance/?with=flare-redact&setting=pii-global-us' }, { label: 'OpenRedaction', href: '/comparison/performance/?with=openredaction&setting=pii-global-us' }],
      currentHref: '/comparison/performance/?with=flare-redact&setting=pii-global-us',
    },
    {
      label: 'redact-secret setting',
      items: [
        { label: 'Default', href: '/comparison/performance/?with=flare-redact&setting=default' },
        { label: 'PII', href: '/comparison/performance/?with=flare-redact&setting=pii-global' },
        { label: 'PII + US', href: '/comparison/performance/?with=flare-redact&setting=pii-global-us' },
      ],
      currentHref: '/comparison/performance/?with=flare-redact&setting=pii-global-us',
    },
  ],
  legend: [{ side: 'a', label: 'redact-secret · PII + US' }, { side: 'b', label: 'flare-redact · defaults' }],
  legendNote: 'Thin line: shortest to longest timed call',
};

export const sides: [PairSideInfo, PairSideInfo] = [
  {
    name: 'redact-secret', version: '0.1.0-beta.11', chip: 'local build · unreleased', setting: 'Setting: PII + US (adds pii:us)',
    lines: ['Package @redact-secret/core. Timed call: scanAndRedact(), synchronous.', 'Turns on: email, iban, network address, payment card, phone.'],
  },
  {
    name: 'flare-redact', version: '1.6.1', chip: 'npm', setting: 'Setting: defaults',
    lines: ['Package flare-redact. Timed call: redact(), synchronous.', 'No options passed: the library runs as installed.'],
  },
];

export const longSides: [PairSideInfo, PairSideInfo] = [
  { ...sides[0], name: 'redact-secret-with-a-very-long-package-name', version: '0.1.0-beta.11+build.20260930.abcdef0123456789', lines: [...sides[0].lines, 'A long line that keeps going to show that the two sides wrap instead of pushing the page wider than the screen does.'] },
  sides[1],
];

export const cases: PerformanceCase[] = [
  {
    id: 'real-looking-values', label: 'Does it catch real sensitive values?', note: 'Made-up emails, card numbers, bank accounts and phone numbers that look like the real thing.',
    detail: 'real-looking-values · 128.0 KiB · each line repeated 512 times',
    a: timed(365.4, 365, 367, 'Hid 8 of 8 values', '0.4'), b: timed(8.3, 8.1, 16.1, 'Hid 4 of 8 values', '15.8'),
    marks: [mark('b', 8.3, 8.1, 16.1), mark('a', 365.4, 365, 367)],
  },
  {
    id: 'validator-heavy', label: 'Does it redact fake values?', note: 'Values made for examples and testing, plus look-alikes that fail a basic check.',
    detail: 'validator-heavy · 92.5 KiB · each line repeated 512 times',
    a: timed(75.3, 75.2, 76.5, 'Hid 3 of 8 values', '1.3'), b: timed(3.9, 3.9, 4.6, 'Hid 1 of 8 values', '24.3'),
    marks: [mark('b', 3.9, 3.9, 4.6), mark('a', 75.3, 75.2, 76.5)],
  },
  {
    id: 'multilingual-context', label: 'Does it understand context?', note: 'The same fake values next to English and Korean labels.',
    detail: 'multilingual-context · 147.0 KiB · each line repeated 512 times',
    a: timed(20.3, 11, 40, 'Hid 6 of 8 values', '7.4'), b: timed(18.9, 15, 30, 'Hid 6 of 8 values', '8.0'),
    marks: [mark('b', 18.9, 15, 30), mark('a', 20.3, 11, 40)],
    near: 'The two ranges overlap: these times are not read as different.',
  },
];

export const group: PerformanceGroup = { id: 'perf-pii', position: '1 / 2', title: 'Text with personal data', description: 'Made-up emails, card numbers, bank accounts, phone numbers and IP addresses, in three kinds of text.', cases };

/** Worst case: a long text, a time in seconds, a range that spans a decade, one side not measured. */
export const worstGroup: PerformanceGroup = {
  id: 'perf-credentials', position: '2 / 2', title: 'Text with credentials', description: 'Every line carries a secret, so each call finds and replaces thousands of them: these times are for text that dense.',
  cases: [
    {
      id: 'credentials-real', label: 'Does it catch real secrets?', note: 'Made-up API keys and tokens in a .env file, a command line and an HTTP header.',
      detail: 'credentials-real · 287.5 KiB · each line repeated 512 times',
      a: timed(797.1, 796.4, 798.7, 'Hid 8 of 8 values', '0.4'), b: timed(1773, 443, 9100, 'Hid 8 of 8 values', '0.2'),
      marks: [mark('b', 1773, 443, 9100), mark('a', 797.1, 796.4, 798.7)],
    },
    {
      id: 'credentials-fake', label: 'Does it redact fake secrets?', note: 'Placeholders like YOUR_TOKEN_HERE and look-alikes that are too short.',
      detail: 'credentials-fake · 164.0 KiB · each line repeated 512 times',
      a: timed(68.3, 68.1, 69.3, 'Hid 2 of 8 values', '2.5'), b: notMeasured('This run has no time for this text.'),
      marks: [mark('a', 68.3, 68.1, 69.3)],
    },
  ],
};

export const overviewRows = {
  a: { side: 'a' as const, name: 'redact-secret', span: '20.3 ms to 797 ms across 6 texts', marks: [mark('a', 365.4), mark('a', 75.3), mark('a', 20.3), mark('a', 797.1), mark('a', 68.3), mark('a', 595.4)] },
  b: { side: 'b' as const, name: 'flare-redact', span: '3.9 ms to 14.0 ms across 6 texts', marks: [mark('b', 8.3), mark('b', 3.9), mark('b', 7.8), mark('b', 14), mark('b', 6.3), mark('b', 9.4)] },
};

export const ownRows: OwnRunRow[] = [
  { id: 'node-scale-logs-small-whole', profile: 'scale-logs-small-whole', fed: 'One-shot scan', median: '2.2 ms', spread: '2.1 to 2.3 ms', p95: '2.3 ms', speed: '29.5 MB/s', runs: '5 runs' },
  { id: 'node-scale-logs-medium-fixed4096', profile: 'scale-logs-medium-fixed4096', fed: 'Chunked incremental (4 KiB)', median: '15.8 ms', spread: '15.1 to 16.6 ms', p95: '16.6 ms', speed: '16.6 MB/s', runs: '5 runs' },
];

export const own = {
  title: 'redact-secret on its own',
  description: 'The throughput the Performance page records for the Node surface, whole and in 4 KiB pieces.',
  apart: 'This is another run, on another machine, with another protocol than the pair above, so it is not set beside those times and is not drawn on the same axis. Read it on its own.',
  rows: ownRows,
  other: { name: 'flare-redact', reason: 'no run of this kind is recorded. Its row of this table is not measured. Tracked in #571.' },
  source: 'Accepted run of product commit da69ebf50908: 5 repetitions, a 4-CPU linux machine, node-22, served by the N-API add-on.',
};

export const missingGroups: MissingGroup[] = [
  { id: 'size', title: 'How big is the text?', description: 'The same kind of text at 64 KiB, 256 KiB and 10 MiB.', reason: 'No committed run times both libraries at more than one size of the same text. Tracked in #571.' },
  { id: 'shape', title: 'What does the text look like?', description: 'One long line, hex ids, source code, CLI tables, invisible characters.', reason: 'No committed run times both libraries on these shapes. Tracked in #571.' },
  { id: 'pieces', title: 'Does it arrive whole or in pieces?', description: 'The same text handed over at once, or streamed in 4 KiB or 64 KiB pieces.', reason: 'redact-secret’s own time in 4 KiB pieces is in the table above. No committed run times both libraries in pieces. Tracked in #571.' },
];

export const first = {
  title: 'Read this first',
  items: [
    'The libraries do different jobs on the same text: each finds and replaces what its own rules look for. So every time comes with what the call did, how many of the text’s values it hid.',
    'Only times from one run are set side by side. flare-redact is timed again in every run, so its numbers move a little when you switch the redact-secret setting. Times from different runs, machines or CPUs are not comparable.',
    'Between the runs, the same flare-redact call on the same text moved by up to 12% (most on real-looking-values). Where the two ranges overlap, or the two times are closer than that, the row says so and the times are not read as different.',
    'Times are absolute and recorded, not graded. Nothing here is a ranking.',
  ],
};

export const method = {
  title: 'How this was measured',
  items: [
    'Run of 2026-09-30: linux x64 · Node v22.22.2 · AMD EPYC 7763 64-Core Processor · 4 CPUs.',
    'Each time is the middle of 12 timed calls after 2 warm-up calls. The thin line runs from the shortest to the longest call.',
    'redact-secret is a local build of the pinned product commit, unreleased; the published package was not timed. Tracked in #572.',
    'The texts are generated from the committed plan and are never published; only their kind and size are shown. Every value in them is made up.',
  ],
};
