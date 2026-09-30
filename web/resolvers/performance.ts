/**
 * `/comparison/performance`: redact-secret next to one other library, every text the runtime comparison timed for
 * both, resolved to block props. Pure.
 *
 * Boundary rule: every value shown is one a committed, validated report recorded. There is no ratio, no ordering by
 * time, no "faster". Only times from the same run are set side by side (each setting is its own run, and the other
 * library is timed again in it). A time that was not recorded resolves to a stated "Not measured", never a zero.
 * The noise is the recorded spread: the same library's calls on the same text in the same run, and the same peer's
 * medians across the runs.
 */
import type { PerformancePairProps } from '../components/comparison/PerformancePair';
import type {
  MissingGroup, OwnRunRow, PairSideInfo, PerformanceCase, PerformanceCell, PerformanceGroup, TrackMark, TrackTick,
} from '../components/comparison/performance-types';
import type { OwnPerformance } from '../services/performance';
import type { ComparisonRun, ComparisonSetting, ComparisonWorkload, PeerRuntime, RuntimeComparison, RuntimeTool } from '../services/runtime';
import { activeFamilies, kibibytes, megabytesPerSecond, milliseconds, toolName } from './comparison';
import { count, int, isoDate } from './format';

export type Peer = 'flare-redact' | 'openredaction';
export const PEERS: Peer[] = ['flare-redact', 'openredaction'];
export const SETTING_IDS = ['default', 'pii-global', 'pii-global-us'] as const;
export type SettingId = (typeof SETTING_IDS)[number];
/** The setting the page opens on: the one that turns on the most, the closest like-for-like job with libraries that run their defaults. */
export const DEFAULT_PEER: Peer = 'flare-redact';
export const DEFAULT_SETTING: SettingId = 'pii-global-us';

export const peerOf = (value: string | null): Peer => (value === 'openredaction' ? 'openredaction' : DEFAULT_PEER);
export const settingOf = (value: string | null): SettingId => (SETTING_IDS.find(id => id === value) ?? DEFAULT_SETTING);

const PERFORMANCE = '/comparison/performance/';
const COMPARISON = '/comparison/';
const RUNTIME = '/comparison/runtime/';
const US = 'redact-secret';

export const performanceHref = (peer: Peer, setting: SettingId): string => `${PERFORMANCE}?with=${peer}&setting=${setting}`;

export interface PerformancePanel {
  /** `flare-redact-pii-global-us`: one panel per pair and setting. */
  key: string;
  peer: Peer;
  setting: SettingId;
  props: PerformancePairProps;
}

// ---- Numbers ----------------------------------------------------------------------------------

/** A time in milliseconds, always with its unit: "3.8 ms", "1,775 ms". */
export const timeText = (ms: number): string => `${milliseconds(ms)} ms`;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** The shared log axis: decades from the one holding the smallest recorded time to the one holding the largest. */
export interface Axis { lo: number; hi: number }
export function axisFor(runs: ComparisonRun[]): Axis {
  const times = runs.flatMap(r => r.observations.flatMap(o => [o.medianMs, o.minMs, o.maxMs].filter((t): t is number => t !== undefined && t > 0)));
  if (!times.length) return { lo: 0, hi: 4 };
  const lo = Math.floor(Math.log10(Math.min(...times)));
  const hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(...times))));
  return { lo, hi };
}
export const positionOn = (axis: Axis, ms: number): number => round4(Math.min(1, Math.max(0, (Math.log10(ms) - axis.lo) / (axis.hi - axis.lo))));
const tickLabel = (decade: number): string => { const ms = 10 ** decade; return ms >= 1000 ? `${int(ms / 1000)} s` : ms < 1 ? `${ms} ms` : `${int(ms)} ms`; };
export const ticksFor = (axis: Axis): TrackTick[] => Array.from({ length: axis.hi - axis.lo + 1 }, (_, i) => ({ position: positionOn(axis, 10 ** (axis.lo + i)), label: tickLabel(axis.lo + i) }));

// ---- Noise ------------------------------------------------------------------------------------

const measuredRuns = (cmp: RuntimeComparison): ComparisonRun[] => cmp.settings.flatMap(s => (s.run.state === 'measured' ? [s.run] : []));
const observation = (run: ComparisonRun | undefined, tool: string, workload: string) => run?.observations.find(o => o.tool === tool && o.workload === workload);

/** How far the same library's median on the same text moved between the runs: (longest - shortest) / shortest. `undefined` with fewer than two runs. */
export function runToRunSpread(cmp: RuntimeComparison, tool: string, workload: string): number | undefined {
  const times = measuredRuns(cmp).map(r => observation(r, tool, workload)?.medianMs).filter((t): t is number => t !== undefined && t > 0);
  return times.length < 2 ? undefined : (Math.max(...times) - Math.min(...times)) / Math.min(...times);
}

/** The text where `tool`'s median moved most between the runs. */
export function noisiest(cmp: RuntimeComparison, tool: string): { spread: number; workload: string } | undefined {
  let worst: { spread: number; workload: string } | undefined;
  for (const w of cmp.workloads) {
    const spread = runToRunSpread(cmp, tool, w.id);
    if (spread !== undefined && (!worst || spread > worst.spread)) worst = { spread, workload: w.id };
  }
  return worst;
}

const percentText = (fraction: number): string => `${Math.round(fraction * 100)}%`;

// ---- Cells and rows ---------------------------------------------------------------------------

function hiddenText(run: ComparisonRun, tool: string, workload: ComparisonWorkload): string | undefined {
  const lines = run.outcomes[`${tool}/${workload.id}`];
  if (!lines) return undefined;
  const total = workload.lines.reduce((n, l) => n + l.values.length, 0);
  const hidden = lines.reduce((n, l) => n + l.valuesHidden, 0);
  const off = tool === US ? workload.lines.reduce((n, l) => n + l.values.filter(v => v.family !== undefined && !run.families.includes(v.family)).length, 0) : 0;
  return `Hid ${int(hidden)} of ${int(total)} values${hidden === 0 && off === total ? ': this setting has none of them switched on' : ''}`;
}

function cellFor(run: ComparisonRun, tool: string, workload: ComparisonWorkload): PerformanceCell {
  const o = observation(run, tool, workload.id);
  if (!o) return { state: 'not-measured', reason: 'This run has no time for this text.' };
  const runs = o.samples ?? run.samplesPerCell;
  return {
    state: 'timed',
    time: timeText(o.medianMs),
    speed: `${megabytesPerSecond(o.medianBytesPerSecond)} MB/s · ${count(runs, 'run')}`,
    spread: o.minMs !== undefined && o.maxMs !== undefined ? `${milliseconds(o.minMs)} to ${timeText(o.maxMs)}` : 'spread not recorded',
    did: hiddenText(run, tool, workload) ?? 'What it did is not recorded',
  };
}

function markFor(run: ComparisonRun, axis: Axis, side: 'a' | 'b', tool: string, workload: string): TrackMark[] {
  const o = observation(run, tool, workload);
  if (!o) return [];
  const range = o.minMs !== undefined && o.maxMs !== undefined ? ([positionOn(axis, o.minMs), positionOn(axis, o.maxMs)] as [number, number]) : undefined;
  return [{ side, position: positionOn(axis, o.medianMs), label: `${toolName(tool)} ${timeText(o.medianMs)}`, ...(range ? { range } : {}) }];
}

const repeatText = (cmp: RuntimeComparison, w: ComparisonWorkload): string =>
  cmp.lineCount % w.lines.length === 0 ? `each line repeated ${int(cmp.lineCount / w.lines.length)} times` : `${int(cmp.lineCount)} lines`;

/** Why two recorded times are not read as different, or `undefined` when they are apart by more than the noise. */
export function nearText(cmp: RuntimeComparison, run: ComparisonRun, peer: Peer, workload: string): string | undefined {
  const a = observation(run, US, workload), b = observation(run, peer, workload);
  if (!a || !b || a.minMs === undefined || a.maxMs === undefined || b.minMs === undefined || b.maxMs === undefined) return undefined;
  if (a.minMs <= b.maxMs && b.minMs <= a.maxMs) return 'The two ranges overlap: these times are not read as different.';
  const spread = runToRunSpread(cmp, peer, workload);
  const apart = Math.abs(a.medianMs - b.medianMs) / Math.min(a.medianMs, b.medianMs);
  if (spread !== undefined && apart <= spread)
    return `The two times are closer than ${toolName(peer)} moved between runs on this text (${percentText(spread)}): not read as different.`;
  return undefined;
}

function groupsFor(cmp: RuntimeComparison, run: ComparisonRun, axis: Axis, peer: Peer): PerformanceGroup[] {
  const parts: { id: string; domain: ComparisonWorkload['domain']; title: string; description: string }[] = [
    { id: 'pii', domain: 'pii', title: 'Text with personal data', description: 'Made-up emails, card numbers, bank accounts, phone numbers and IP addresses, in three kinds of text.' },
    { id: 'credentials', domain: 'credentials', title: 'Text with credentials', description: 'Made-up API keys and tokens in the places people paste them. Every line carries a secret, so each call finds and replaces thousands of them: these times are for text that dense.' },
  ];
  const groups = parts.map(part => ({ part, workloads: cmp.workloads.filter(w => w.domain === part.domain) })).filter(g => g.workloads.length);
  return groups.map(({ part, workloads }, index): PerformanceGroup => ({
    id: `perf-${part.id}`,
    position: `${index + 1} / ${groups.length}`,
    title: part.title,
    description: part.description,
    cases: workloads.map((w): PerformanceCase => {
      const size = observation(run, US, w.id)?.workloadBytes ?? observation(run, peer, w.id)?.workloadBytes;
      const near = nearText(cmp, run, peer, w.id);
      return {
        id: w.id,
        label: w.question,
        note: w.description,
        detail: [w.id, size !== undefined ? kibibytes(size) : '', repeatText(cmp, w)].filter(Boolean).join(' · '),
        a: cellFor(run, US, w),
        b: cellFor(run, peer, w),
        marks: [...markFor(run, axis, 'a', US, w.id), ...markFor(run, axis, 'b', peer, w.id)],
        ...(near ? { near } : {}),
      };
    }),
  }));
}

function spanText(run: ComparisonRun, tool: string, workloads: ComparisonWorkload[]): string {
  const medians = workloads.flatMap(w => { const o = observation(run, tool, w.id); return o ? [o.medianMs] : []; });
  return medians.length ? `${milliseconds(Math.min(...medians))} to ${timeText(Math.max(...medians))} across ${count(medians.length, 'text')}` : '';
}

// ---- The sides, the text and the gaps ----------------------------------------------------------

const buildChip = (t: RuntimeTool | undefined): string | undefined => (t?.buildKind === 'local-source-build' ? 'local build · unreleased' : t?.buildKind ? 'npm' : undefined);
const callText = (t: RuntimeTool | undefined): string => (t ? `Package ${t.package}. Timed call: ${t.call}(), ${t.async ? 'asynchronous, returns a Promise' : 'synchronous'}.` : 'Not in the plan.');

function sideInfo(tool: RuntimeTool | undefined, name: string, setting: string, extra: string): PairSideInfo {
  const chip = buildChip(tool);
  return { name, version: tool?.version ?? 'version not recorded', ...(chip ? { chip } : {}), setting, lines: [callText(tool), extra] };
}

const GAPS: { id: string; title: string; description: string; reason: string }[] = [
  { id: 'size', title: 'How big is the text?', description: 'The same kind of text at 64 KiB, 256 KiB and 10 MiB.', reason: 'No committed run times both libraries at more than one size of the same text. Tracked in #571.' },
  { id: 'shape', title: 'What does the text look like?', description: 'One long line, hex ids, source code, CLI tables, invisible characters, personal data at the end of a long line.', reason: 'No committed run times both libraries on these shapes. Tracked in #571.' },
  { id: 'hard', title: 'Text built to slow scanners down', description: 'Patterns that once made a scanner re-read the same bytes many times, each one long line or one open assignment.', reason: 'The product times these for redact-secret alone. No committed run times the other libraries on them. Tracked in #571.' },
  { id: 'density', title: 'How many secrets does it hold?', description: 'The same mixed text with none, one and eight secrets per KiB.', reason: 'No committed run varies the number of secrets in one text for both libraries. Tracked in #571.' },
  { id: 'pieces', title: 'Does it arrive whole or in pieces?', description: 'The same text handed over at once, or streamed in 4 KiB or 64 KiB pieces.', reason: 'redact-secret’s own time in 4 KiB pieces is in the table above. No committed run times both libraries in pieces. Tracked in #571.' },
];

function ownRows(own: OwnPerformance): OwnRunRow[] {
  if (own.state !== 'measured') return [];
  return own.rows.filter(r => r.surface === 'node').map(r => ({
    id: `${r.surface}-${r.profileId}`,
    profile: r.profileId,
    fed: r.dispatch,
    median: timeText(r.processingMedianMs),
    spread: `${milliseconds(r.processingMinMs)} to ${timeText(r.processingMaxMs)}`,
    p95: timeText(r.processingP95Ms),
    speed: `${megabytesPerSecond(r.throughputMedianBytesPerSecond)} MB/s`,
    runs: count(r.samples, 'run'),
  }));
}

const ownSource = (own: OwnPerformance): string => {
  if (own.state !== 'measured') return '';
  const node = own.rows.find(r => r.surface === 'node');
  const machine = own.runner ? `, ${own.runner.cpuModel}, ${count(own.runner.logicalCpus, 'CPU')}` : '';
  return `Accepted run of product commit ${own.sourceCommit.slice(0, 12)}: ${count(own.repetitions, 'repetition')}${machine}${node?.runtime ? `, ${node.runtime}` : ''}${node?.resolvedArtifact ? `, served by the ${node.resolvedArtifact === 'wasm' ? 'WebAssembly fallback' : 'N-API add-on'}` : ''}.`;
};

const runText = (run: ComparisonRun): string => `${run.runner.platform} ${run.runner.arch} · Node ${run.runner.node} · ${run.runner.cpuModel} · ${count(run.runner.cpuLimit, 'CPU')}`;

// ---- The panels ----------------------------------------------------------------------------------

function panelFor(runtime: PeerRuntime, own: OwnPerformance, peer: Peer, settingId: SettingId): PerformancePairProps {
  const cmp = runtime.comparison;
  const setting: ComparisonSetting | undefined = cmp?.settings.find(s => s.id === settingId);
  const run = setting?.run.state === 'measured' ? setting.run : undefined;
  const peerName = toolName(peer);
  const usTool = runtime.tools.find(t => t.id === US);
  const peerTool = runtime.tools.find(t => t.id === peer);
  const settingLabel = setting?.label ?? settingId;
  const axis = axisFor(cmp ? measuredRuns(cmp) : []);
  const ticks = ticksFor(axis);

  const turnsOn = run ? (run.families.length ? `Turns on: ${activeFamilies(`families=${run.families.join(',')}`).join(', ')}.` : 'Turns on no PII family.') : 'What it turns on is not recorded for this setting.';
  const sides: [PairSideInfo, PairSideInfo] = [
    sideInfo(usTool, US, `Setting: ${settingLabel}${setting?.sub ? ` (${setting.sub})` : ''}`, turnsOn),
    sideInfo(peerTool, peerName, 'Setting: defaults', 'No options passed: the library runs as installed.'),
  ];

  const worst = cmp ? noisiest(cmp, peer) : undefined;
  const noise = worst
    ? `Between the runs, the same ${peerName} call on the same text moved by up to ${percentText(worst.spread)} (most on ${worst.workload}). Within a run, a library's timed calls span a range, the thin line. Where the two ranges overlap, or the two times are closer than that run-to-run movement on the same text, the row says so and the times are not read as different.`
    : 'Only one run is committed, so how far a time moves between runs is not measured. No difference is read from these times.';
  const first = {
    title: 'Read this first',
    items: [
      'The libraries do different jobs on the same text: each finds and replaces what its own rules look for. So every time comes with what the call did, how many of the text’s values it hid.',
      `Only times from one run are set side by side. ${peerName} is timed again in every run, so its numbers move a little when you switch the redact-secret setting. Times from different runs, machines or CPUs are not comparable, and neither are these and the Performance page’s.`,
      noise,
      'Times are absolute and recorded, not graded. Nothing here is a ranking.',
    ],
  };

  const picker: PerformancePairProps['picker'] = {
    controls: [
      { label: 'Compare with', items: PEERS.map(p => ({ label: toolName(p), href: performanceHref(p, settingId) })), currentHref: performanceHref(peer, settingId) },
      { label: 'redact-secret setting', items: SETTING_IDS.map(id => ({ label: cmp?.settings.find(s => s.id === id)?.label ?? id, href: performanceHref(peer, id) })), currentHref: performanceHref(peer, settingId) },
    ],
    legend: [{ side: 'a', label: `${US} · ${settingLabel}` }, { side: 'b', label: `${peerName} · defaults` }],
    legendNote: 'Thin line: shortest to longest timed call',
  };

  const ownRowsList = ownRows(own);
  const ownProps: PerformancePairProps['own'] = {
    title: 'redact-secret on its own',
    description: 'The throughput the Performance page records for the Node surface, whole and in 4 KiB pieces.',
    apart: 'This is another run, on another machine, with another protocol than the pair above, so it is not set beside those times and is not drawn on the same axis. Read it on its own.',
    rows: ownRowsList,
    other: { name: peerName, reason: 'no run of this kind is recorded. Its row of this table is not measured. Tracked in #571.' },
    source: ownSource(own),
    ...(own.state !== 'measured' ? { empty: own.reason } : !ownRowsList.length ? { empty: 'The accepted run records no Node rows.' } : {}),
  };

  const gaps: PerformancePairProps['gaps'] = {
    title: 'Not measured for this pair',
    description: 'Questions a pair page can answer once a run times both libraries on them. Each is a dashed “Not measured”, never a zero.',
    groups: GAPS.map((g): MissingGroup => ({ ...g })),
  };

  const method: string[] = run
    ? [
        `Run of ${isoDate(run.generatedAt)}: ${runText(run)}.`,
        `Each time is the middle of ${int(run.samplesPerCell)} timed calls after ${int(runtime.warmupSamples)} warm-up calls. The thin line runs from the shortest to the longest call. Calls took turns, one library after another, in one process.`,
        ...run.methodologyNotes,
        usTool?.buildKind === 'local-source-build' ? `${US} is a local build of the pinned product commit, unreleased; the published package was not timed. Tracked in #572.` : '',
        'The texts are generated from the committed plan and are never published; only their kind and size are shown. Every value in them is made up.',
      ].filter(Boolean)
    : ['No run is committed for this setting, so there is no run to describe.'];

  const base = {
    breadcrumb: [{ label: 'Comparison', href: COMPARISON }, { label: 'Performance' }],
    eyebrow: 'Comparison · One pair at a time',
    title: 'How long does it take? It depends on the text.',
    lede: `redact-secret and ${peerName} ran the same texts in the same run. The time changes with the text, so every text is shown, on one shared scale. Times are recorded, not graded. Not a ranking.`,
    related: { href: RUNTIME, label: 'All three libraries at once →' },
    picker, sides, first, own: ownProps, gaps,
    method: { title: 'How this was measured', items: method },
  };

  if (!cmp || !setting || !run)
    return { ...base, empty: { title: 'Not measured yet', text: setting?.run.state === 'invalid' || setting?.run.state === 'not-published' ? setting.run.reason : 'No runtime comparison is committed, so this pair has no shared measurement.' } };
  if (!peerTool || !cmp.workloads.some(w => observation(run, peer, w.id)))
    return { ...base, empty: { title: 'Not measured yet', text: `${peerName} has no time in the ${settingLabel} run, so this pair has no shared measurement.` } };

  const both = cmp.workloads.filter(w => observation(run, US, w.id) && observation(run, peer, w.id));
  if (!both.length) return { ...base, empty: { title: 'Not measured yet', text: `redact-secret and ${peerName} share no timed text in the ${settingLabel} run.` } };
  const plain = (side: 'a' | 'b', tool: string): TrackMark[] => both.flatMap(w => markFor(run, axis, side, tool, w.id).map(({ position, label }) => ({ side, position, label })));
  const overview: NonNullable<PerformancePairProps['measured']>['overview'] = {
    title: 'Every text, one scale',
    note: 'Each mark is one text, at its usual time. The wider a row spreads, the more that library’s time depends on the text.',
    ticks,
    rows: [
      { side: 'a', name: US, span: spanText(run, US, both), marks: plain('a', US) },
      { side: 'b', name: peerName, span: spanText(run, peer, both), marks: plain('b', peer) },
    ],
  };
  return { ...base, measured: { ticks, overview, groups: groupsFor({ ...cmp, workloads: both }, run, axis, peer) } };
}

export function resolvePerformancePanels(runtime: PeerRuntime, own: OwnPerformance): PerformancePanel[] {
  return PEERS.flatMap(peer => SETTING_IDS.map(setting => ({ key: `${peer}-${setting}`, peer, setting, props: panelFor(runtime, own, peer, setting) })));
}
