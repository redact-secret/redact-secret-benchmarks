/**
 * One fixture as the fixture page shows it (#559, #588): what redact-secret recorded on it, the exact
 * bytes as an input (what was expected) and an output (what was reported), each span's outcome, the
 * near-twin it is held against, why the expectation holds, and the other scanners. Pure: a suite's
 * compact records and the text they share in, block props out.
 *
 * Everything here is a value the corpus or the run recorded. Ranges are UTF-8 byte offsets,
 * [start, end). The marks follow the run's own outcomes: a reported range is a bar, hatched where the
 * row's outcome for the span it touches is `PARTIAL`; secret bytes no range covers are a dashed frame.
 * Nothing is re-scored, and matched values of a scanner's raw output are never read (a row holds ranges
 * only). A value the corpus does not hold is stated as "Not recorded", never filled in. An authored title and description
 * (#593) are shown only as their owner recorded them, with who that is: credential-evidence's case record for a public case, this
 * repository's overlay for a product-owned fixture (docs/specs/fixture-metadata.md); otherwise the page says none is recorded.
 */
import type { BuiltFixture, CatalogFixture, CatalogSuite } from '../services/catalog';
import type { RowResult, RunScanner } from '../services/run';
import type { ByteLineData, ByteSegment, LanePiece, StatusLabel } from '../components/report/types';
import type {
  FileMarkKind, FileRowData, FileSegment, FixtureDetailData, FixtureFactData, FixtureFileData, FixtureKeyItem, FixturePeerRow,
  FixtureSpanRow, FixtureTwinData, FixtureVerdictData,
} from '../components/report/fixtureTypes';
import { KIND_TITLE, NOT_PROVIDER_SPECIFIC, TIER_TITLE, familyHref } from './families';
import { fixtureHref, suiteHref } from './rows';
import { count, int } from './format';

interface Range { start: number; end: number }
interface Span extends Range { role?: 'secret' | 'companion'; envelope?: Range & { reason?: string }; note?: string }

const PRODUCT_ID = 'redact-secret';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });

/** Source lines as byte ranges; a line keeps its own terminator. */
export function byteLines(bytes: Uint8Array): (Range & { index: number })[] {
  const lines: (Range & { index: number })[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x0a) { lines.push({ index: lines.length, start, end: i + 1 }); start = i + 1; }
  if (start < bytes.length || lines.length === 0) lines.push({ index: lines.length, start, end: bytes.length });
  return lines;
}

/** Cut [from, to) at every range boundary and say which ranges cover each piece. */
export function segment<T extends Range>(bytes: Uint8Array, from: number, to: number, ranges: T[]): { text: string; start: number; end: number; marks: T[] }[] {
  const cuts = [...new Set([from, to, ...ranges.flatMap(r => [r.start, r.end]).filter(offset => offset > from && offset < to)])].sort((a, b) => a - b);
  return cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1];
    return { text: decoder.decode(bytes.slice(start, end)), start, end, marks: ranges.filter(r => r.start < end && r.end > start) };
  });
}

const overlaps = (a: Range, b: Range): boolean => a.start < b.end && b.start < a.end;
const touches = (line: Range, r: Range): boolean => r.start < line.end && r.end > line.start;

type Shape = 'fill' | 'hatch' | 'outline';
interface Mark extends Range { shape: Shape }
const PRIORITY: Shape[] = ['fill', 'hatch', 'outline'];

/** Findings become bars (hatched where they touch a partly exposed secret); a missed secret becomes an empty frame. */
function laneMarks(secrets: Range[], outcomes: string[] | undefined, findings: Range[]): Mark[] {
  const partial = secrets.filter((_, i) => outcomes?.[i] === 'PARTIAL');
  return [
    ...findings.map(f => ({ start: f.start, end: f.end, shape: (partial.some(s => overlaps(s, f)) ? 'hatch' : 'fill') as Shape })),
    ...secrets.filter((_, i) => outcomes?.[i] === 'MISS').map(s => ({ start: s.start, end: s.end, shape: 'outline' as Shape })),
  ];
}

/** How many ranges a row reports: the ranges themselves when the run holds them, otherwise the count the source recorded. */
const reportedCount = (row: RowResult): number => row.actual?.length ?? row.observed ?? 0;

const SPAN_WORD: Record<string, string> = { EXACT: 'Exact', COVERED: 'Within range', OVERBROAD: 'Too much', PARTIAL: 'Partly exposed', MISS: 'Missed' };
/** What each outcome word means, in the ledger's terms (src/pages/how-to-read.ts). */
const SPAN_NOTE: Record<string, string> = {
  EXACT: 'A reported range equals the span: same start, same end',
  COVERED: 'One reported range contains it and stays inside the envelope',
  OVERBROAD: 'One reported range contains it and reaches past the envelope',
  PARTIAL: 'Reported ranges overlap it but none contains it',
  MISS: 'No reported range overlaps it',
};

/** One word and a status per secret span, or Quiet/Flagged for a control. A policy row is information, never failure. */
export function verdictsOf(kind: string, row: RowResult | undefined, scannerStatus?: string): StatusLabel[] {
  if (!row) return [scannerStatus === 'unstable' ? { status: 'unstable', label: 'Unstable' } : { status: 'not-measured', label: 'Not measured' }];
  const policy = kind === 'policy';
  if (row.spanOutcomes) {
    return row.spanOutcomes.map(o => ({
      status: policy ? 'info' : o === 'PARTIAL' || o === 'MISS' ? 'fail' : o === 'OVERBROAD' ? 'review' : 'pass',
      label: SPAN_WORD[o] ?? o,
    }));
  }
  if (row.flagged != null) return [row.flagged ? { status: policy ? 'info' : 'fail', label: `Flagged${row.findings && row.findings > 1 ? ` ×${row.findings}` : ''}` } : { status: 'pass', label: 'Quiet' }];
  return [{ status: 'not-measured', label: `Unscored · ${count(reportedCount(row), 'range')}` }];
}

const rangeText = (r: Range): string => `${int(r.start)}–${int(r.end)}`;
const sizeText = (r: Range): string => count(r.end - r.start, 'byte');
const rangesText = (items: Range[] | undefined): string => (items && items.length ? items.map(r => `[${r.start}, ${r.end})`).join(' · ') : 'none reported');
const describeSpans = (spans: Range[]): string => spans.map(s => `${s.start}–${s.end}`).join(', ') || 'none';

// ---- The compact record a suite page ships, and the way back to the detail ----------------------------

const OUTCOME_LETTER: Record<string, string> = { EXACT: 'E', COVERED: 'C', OVERBROAD: 'O', PARTIAL: 'P', MISS: 'M' };
const LETTER_OUTCOME: Record<string, NonNullable<RowResult['spanOutcomes']>[number]> = { E: 'EXACT', C: 'COVERED', O: 'OVERBROAD', P: 'PARTIAL', M: 'MISS' };

/**
 * One recorded row as a short string: `outcomes|flagged|ranges|leaked|collateral|findings`, where outcomes
 * is a letter per span (E exact, C covered, O overbroad, P partial, M miss), `=` for none or `-` when the row
 * has no span outcomes, flagged is `1`, `0` or `-`, and ranges is `start-end` pairs joined by commas. A row
 * from a source that records how many ranges were reported but not where (the qualification view) has no
 * ranges and a seventh field, the count. A suite page ships five of these per fixture.
 */
export function packRow(row: RowResult): string {
  return [
    row.spanOutcomes ? row.spanOutcomes.map(o => OUTCOME_LETTER[o]).join('') || '=' : '-',
    row.flagged == null ? '-' : row.flagged ? '1' : '0',
    (row.actual ?? []).map(r => `${r.start}-${r.end}${['redact', 'warn', 'block', 'allow'].includes(r.action ?? '') ? `:${r.action}` : ''}`).join(','),
    row.leakedBytes ?? '', row.collateralBytes ?? '', row.findings ?? '', ...(row.actual === undefined && row.observed !== undefined ? [row.observed] : []),
  ].join('|');
}

export function unpackRow(text: string): RowResult {
  const [outcomes, flagged, ranges, leaked, collateral, findings, observed] = text.split('|');
  return {
    ...(outcomes !== '-' ? { spanOutcomes: outcomes === '=' ? [] : [...outcomes].map(letter => LETTER_OUTCOME[letter]) } : {}),
    ...(flagged !== '-' ? { flagged: flagged === '1' } : {}),
    ...(observed !== undefined && observed !== '' ? { observed: Number(observed) } : { actual: ranges ? ranges.split(',').map(pair => { const [range, action] = pair.split(':'); const [start, end] = range.split('-'); return { start: Number(start), end: Number(end), ...(['redact', 'warn', 'block', 'allow'].includes(action) ? { action: action as 'redact' | 'warn' | 'block' | 'allow' } : {}) }; }) : [] }),
    ...(leaked !== '' ? { leakedBytes: Number(leaked) } : {}),
    ...(collateral !== '' ? { collateralBytes: Number(collateral) } : {}),
    ...(findings !== '' ? { findings: Number(findings) } : {}),
  };
}

/**
 * A suite page ships one compact record per fixture and builds the detail of the one a
 * reader opens in the browser (`resolveFixtureRecord`), so a suite of 1,300 fixtures does not
 * carry 1,300 drawn views. Shared text (an assessment's reason and sources, a scanner's mode
 * line, a detector's title, a group label) is held once in `SuiteShared` and referred to by index or id.
 * Plain JSON: nothing here is derived from more than the corpus and the run recorded.
 */
export interface FixtureRecord {
  id: string;
  path: string;
  kind: string;
  tier: string;
  contract?: string;
  twinOf?: string;
  mutation?: string;
  mutationKind?: string;
  issue?: number;
  content: string;
  /** True when the source records no bytes for the fixture (the qualification view): `content` is empty and the page says so. */
  noContent?: true;
  bytesNote?: string;
  scenarioAbout?: number;
  scenarioAboutBy?: number;
  expected: Span[];
  detectors: string[];
  families: string[];
  /** Index into `SuiteShared.assessments`. */
  assessment: number;
  /** Indexes into `SuiteShared.followUps`. */
  followUps: number[];
  /** Ids of the negative twins authored from this fixture. */
  twins: string[];
  /** One entry per `SuiteShared.scanners`: what the scanner recorded (`packRow`), or `null` when it holds no row. */
  rows: (string | null)[];
  /** Indexes into `SuiteShared.texts`: the corpus's group label, where in a file the fixture sits (`sdk-config`), the action a policy fixture expects, why no family owns it, the milestone that added it and the release the index records with it (#595). */
  group?: number;
  axis?: number;
  action?: number;
  unscoped?: number;
  milestone?: number;
  release?: number;
  /** Indexes into `SuiteShared.scenarios`. */
  scenarios: number[];
  /** Indexes into `SuiteShared.texts`: the authored title and one-sentence description (#593), and who authored them. Absent when neither owner records one. */
  title?: number;
  about?: number;
  aboutBy?: number;
  /** The first 12 hex digits of the sha256 of the file's UTF-8 bytes. */
  sha: string;
}

export interface SuiteShared {
  category: string;
  suite: { title: string; reviewStatus: string };
  scanners: { id: string; name: string; version: string | null; mode: string; status: string; observed: string[] }[];
  assessments: { reason?: string; reasonBy?: string; sources: string[] }[];
  followUps: { number: number; url: string; milestone: string }[];
  detectorTitles: Record<string, string>;
  familyNames: Record<string, string>;
  /** The provider each family belongs to, by family id. */
  providerNames: Record<string, string>;
  scenarios: { id: string; title: string }[];
  /** Strings the records refer to by index, so a label held by 300 fixtures is shipped once. */
  texts: string[];
  /** The run the rows come from: its date and which build of the product it measured. */
  run?: { date: string; mode: 'published' | 'candidate'; commit?: string };
  runProblem?: string;
  /** Why the owner's titles are not shown for this build (a projection of another snapshot): said beside "What it tests" (#593). */
  textProblem?: string;
  /**
   * SHA256 of the records and shared metadata, excluding this identity field. The fixture page refuses a file of another suite or another
   * build (#595), so a cached file of an earlier deploy is never drawn under this page's rows.
   */
  identity?: string;
  /**
   * Why a historical row lacks a scanner rule/action (#595). Recorded allowlisted actions travel with ranges;
   * these unavailable defaults never supply an action from expected spans or a detector name.
   */
  reported?: { rule: 'unavailable'; action: 'unavailable'; reason: string };
}

/** What `data/fixtures/<suite>/records.json` holds: the records and the shared text they refer to. */
export interface SuiteRecordsFile { records: FixtureRecord[]; shared: SuiteShared }

/**
 * A records file is this page's own (#595): the suite it names, the number of records the page was built with, and the build identity the page
 * carries. A file of another suite or build is refused, never drawn under this page's rows. Pure; the client island calls it on the parsed file.
 */
export const isRecordsOfBuild = (value: unknown, expected: { suite: string; fixtureCount: number; identity?: string }): value is SuiteRecordsFile =>
  isSuiteRecordsFile(value) && value.shared.category === expected.suite && value.records.length === expected.fixtureCount
  && (expected.identity === undefined || value.shared.identity === expected.identity) && !!value.shared.suite && typeof value.shared.suite.title === 'string'
  && ['detectorTitles', 'familyNames', 'providerNames'].every(k => !!value.shared[k as 'familyNames'] && typeof value.shared[k as 'familyNames'] === 'object')
  && Array.isArray(value.shared.followUps)
  && value.shared.assessments.every(a => !!a && Array.isArray(a.sources))
  && value.shared.scanners.every(s => !!s && typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.observed))
  && value.shared.texts.every(t => typeof t === 'string')
  && value.records.every(r => r !== null && typeof r === 'object' && typeof r.id === 'string'
    && typeof r.path === 'string' && typeof r.content === 'string' && typeof r.kind === 'string' && typeof r.tier === 'string'
    && Array.isArray(r.expected) && r.expected.every(e => !!e && Number.isSafeInteger(e.start) && Number.isSafeInteger(e.end) && e.start >= 0 && e.end > e.start)
    && ['detectors', 'families', 'twins'].every(k => Array.isArray(r[k as 'detectors']) && r[k as 'detectors'].every(v => typeof v === 'string'))
    && Number.isSafeInteger(r.assessment) && r.assessment >= 0 && r.assessment < value.shared.assessments.length
    && Array.isArray(r.rows) && r.rows.length === value.shared.scanners.length && r.rows.every(v => v === null || typeof v === 'string')
    && Array.isArray(r.scenarios) && r.scenarios.every(i => Number.isSafeInteger(i) && i >= 0 && i < value.shared.scenarios.length)
    && Array.isArray(r.followUps) && r.followUps.every(i => Number.isSafeInteger(i) && i >= 0 && i < value.shared.followUps.length)
    && ['group', 'axis', 'action', 'unscoped', 'milestone', 'release', 'title', 'about', 'aboutBy'].every(k => { const i = r[k as 'title']; return i === undefined || (Number.isSafeInteger(i) && i >= 0 && i < value.shared.texts.length); }))
  && new Set(value.records.map(r => r.id)).size === value.records.length;

/** Shape guard for a loaded records file: the parts `resolveFixtureRecord` reads exist. */
export const isSuiteRecordsFile = (value: unknown): value is SuiteRecordsFile => {
  const v = value as Partial<SuiteRecordsFile> | null;
  return !!v && Array.isArray(v.records) && !!v.shared && Array.isArray(v.shared.scanners) && Array.isArray(v.shared.assessments) && Array.isArray(v.shared.texts) && Array.isArray(v.shared.scenarios) && typeof v.shared.category === 'string';
};

export interface SuiteBuild {
  suite: CatalogSuite;
  fixtures: CatalogFixture[];
  bytes: Map<string, BuiltFixture>;
  /** sha256 of each fixture's bytes, by slug. */
  hashes: Map<string, string>;
  /** The run's scanners in run order. Empty when there is no usable run. */
  scanners: (Pick<RunScanner, 'id' | 'name' | 'version' | 'mode' | 'status' | 'rows'> & { observations?: { observedAt: string }[] })[];
  run?: SuiteShared['run'];
  runProblem?: string;
  textProblem?: string;
  identity?: string;
  reported?: SuiteShared['reported'];
  /** Findings, each with the fixtures it rests on and its milestone label. */
  findings: { number: number; url: string; milestone: string; fixtures: string[] }[];
  detectorTitles: Map<string, string>;
  familyNames: Map<string, string>;
  providerNames: Map<string, string>;
  scenarioTitles: Map<string, string>;
}

const dateOf = (value: string): string => /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? '';

/** The compact records of one suite, and the shared text they refer to. */
export function buildSuiteRecords(input: SuiteBuild): { records: FixtureRecord[]; shared: SuiteShared } {
  const assessments: SuiteShared['assessments'] = [];
  const assessmentIndex = new Map<string, number>();
  const texts: string[] = [];
  const textIndex = new Map<string, number>();
  const text = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    let index = textIndex.get(value);
    if (index === undefined) { index = texts.length; texts.push(value); textIndex.set(value, index); }
    return index;
  };
  const scenarios: SuiteShared['scenarios'] = [];
  const scenarioIndex = new Map<string, number>();
  const followUps: SuiteShared['followUps'] = input.findings.map(({ number, url, milestone }) => ({ number, url, milestone }));
  const twinsOf = new Map<string, string[]>();
  for (const f of input.fixtures) {
    const positive = input.bytes.get(f.slug)?.twinOf;
    if (positive) (twinsOf.get(positive) ?? twinsOf.set(positive, []).get(positive)!).push(f.id);
  }
  const detectorTitles: Record<string, string> = {};
  const familyNames: Record<string, string> = {};
  const providerNames: Record<string, string> = {};

  const records = input.fixtures.map((entry): FixtureRecord => {
    const built = input.bytes.get(entry.slug)!;
    const key = JSON.stringify([built.assessment.reason ?? '', built.assessment.reasonBy ?? '', built.assessment.sources ?? []]);
    let index = assessmentIndex.get(key);
    if (index === undefined) {
      index = assessments.length;
      assessments.push({ ...(built.assessment.reason ? { reason: built.assessment.reason } : {}), ...(built.assessment.reasonBy ? { reasonBy: built.assessment.reasonBy } : {}), sources: built.assessment.sources ?? [] });
      assessmentIndex.set(key, index);
    }
    for (const id of entry.detectors) detectorTitles[id] = input.detectorTitles.get(id) ?? id;
    for (const id of entry.familyIds) {
      familyNames[id] = input.familyNames.get(id) ?? id;
      providerNames[id] = input.providerNames.get(id) ?? NOT_PROVIDER_SPECIFIC.name;
    }
    const twinOf = built.twinOf;
    const scenarioIds = (entry.scenarioIds ?? []).map(id => {
      let at = scenarioIndex.get(id);
      if (at === undefined) { at = scenarios.length; scenarios.push({ id, title: input.scenarioTitles.get(id) ?? id }); scenarioIndex.set(id, at); }
      return at;
    });
    const group = text(built.group), axis = text(built.contextAxis), action = text(built.expectedAction), unscoped = text(entry.unscopedReason), milestone = text(entry.milestone), release = text(entry.release);
    // A title is shown only with its description and its author: a half-recorded pair is not recorded.
    const authored = built.title && built.description && built.describedBy ? { title: text(built.title)!, about: text(built.description)!, aboutBy: text(built.describedBy)! } : {};
    return {
      id: entry.id, path: built.path, kind: entry.kind, tier: entry.tier,
      ...(built.assessment.contract ? { contract: built.assessment.contract } : {}),
      ...(twinOf ? { twinOf } : {}),
      ...(built.mutation ? { mutation: built.mutation } : {}), ...(built.mutationKind ? { mutationKind: built.mutationKind } : {}),
      ...(built.issue ? { issue: built.issue } : {}),
      content: built.content, ...(built.contentRecorded === false ? { noContent: true as const } : {}), expected: built.expected as Span[],
      ...(built.contentProblem ? { bytesNote: built.contentProblem } : {}),
      ...(built.scenarioDescription ? { scenarioAbout: text(built.scenarioDescription), scenarioAboutBy: text(built.scenarioDescribedBy) } : {}),
      detectors: entry.detectors, families: entry.familyIds,
      assessment: index,
      followUps: input.findings.flatMap((finding, i) => (finding.fixtures.includes(entry.slug) ? [i] : [])),
      twins: twinsOf.get(entry.id) ?? [],
      rows: input.scanners.map(s => { const row = s.rows?.get(entry.slug); return row ? packRow(row) : null; }),
      ...(group !== undefined ? { group } : {}), ...(axis !== undefined ? { axis } : {}), ...(action !== undefined ? { action } : {}),
      ...(unscoped !== undefined ? { unscoped } : {}), ...(milestone !== undefined ? { milestone } : {}), ...(release !== undefined ? { release } : {}),
      scenarios: scenarioIds,
      ...authored,
      sha: (input.hashes.get(entry.slug) ?? '').slice(0, 12),
    };
  });
  return {
    records,
    shared: {
      category: input.suite.id,
      suite: { title: input.suite.title, reviewStatus: input.suite.reviewStatus },
      scanners: input.scanners.map(s => ({ id: s.id, name: s.name, version: s.version, mode: s.mode, status: s.status, observed: [...new Set((s.observations ?? []).map(o => dateOf(o.observedAt)).filter(Boolean))].sort() })),
      assessments, followUps, detectorTitles, familyNames, providerNames, scenarios, texts,
      ...(input.run ? { run: input.run } : {}),
      ...(input.runProblem ? { runProblem: input.runProblem } : {}),
      ...(input.textProblem ? { textProblem: input.textProblem } : {}),
      ...(input.identity ? { identity: input.identity } : {}),
      ...(input.reported ? { reported: input.reported } : {}),
    },
  };
}

// ---- The file views --------------------------------------------------------------------------------------

/** Characters the file view draws as symbols and tells the reader about. Kept equal to `symbolOf` in components/report/FixtureText.tsx. */
const HIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00a0\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu;
const hex = (char: string): string => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

/** "145 bytes · LF · UTF-8": size, line endings and encoding, read from the bytes. */
function fileFacts(bytes: Uint8Array): string {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d) { if (bytes[i + 1] === 0x0a) { crlf++; i++; } else cr++; }
    else if (bytes[i] === 0x0a) lf++;
  }
  const kinds = [crlf && 'CRLF', lf && 'LF', cr && 'CR'].filter(Boolean) as string[];
  const endings = kinds.length === 0 ? 'no line ending' : kinds.length === 1 ? kinds[0] : 'mixed line endings';
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return `${count(bytes.length, 'byte')} · ${endings} · UTF-8${bom ? ' with BOM' : ''}`;
}

/** What the reader should know about characters they cannot see in the file, or undefined when there are none. */
function hiddenNotice(content: string): string | undefined {
  const found = content.match(HIDDEN) ?? [];
  // A lone surrogate or U+FFFD is not valid text: UTF-8 stores each as the replacement character.
  const invalid = (content.match(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]|�/g) ?? []).length;
  if (!found.length && !invalid) return undefined;
  const parts: string[] = [];
  if (found.length) parts.push(`${count(found.length, 'character')} that ${found.length === 1 ? 'is' : 'are'} not normally visible (${[...new Set(found.map(hex))].join(', ')}), drawn as symbols`);
  if (invalid) parts.push(`${count(invalid, 'character')} that ${invalid === 1 ? 'is' : 'are'} not valid text (a lone surrogate or U+FFFD), stored as the replacement character`);
  return `This file holds ${parts.join(' and ')}. The bytes are exact; the symbols are only how they are drawn.`;
}

const WINDOW_ABOVE = 30;
const CONTEXT = 1;

interface MarkRange extends Range { kind: string; label?: string; title?: string }

/** The numbered lines of a file, cut into segments at every mark's edge. A long file keeps the lines a mark touches and counts the rest. */
function fileRows(bytes: Uint8Array, marks: MarkRange[], pick: (marks: MarkRange[], piece: Range) => Pick<FileSegment, 'mark' | 'label' | 'title'> & { envelope?: boolean }): FileRowData[] {
  const lines = byteLines(bytes);
  const keep = new Set<number>();
  if (lines.length <= WINDOW_ABOVE) lines.forEach(l => keep.add(l.index));
  else {
    for (const line of lines) if (marks.some(m => touches(line, m))) for (let i = Math.max(0, line.index - CONTEXT); i <= Math.min(lines.length - 1, line.index + CONTEXT); i++) keep.add(i);
    if (!keep.size) for (let i = 0; i < 10; i++) keep.add(i);
  }
  const rows: FileRowData[] = [];
  let hidden = 0;
  for (const line of lines) {
    if (!keep.has(line.index)) { hidden++; continue; }
    if (hidden) { rows.push({ gap: hidden }); hidden = 0; }
    const segments: FileSegment[] = [];
    for (const piece of segment(bytes, line.start, line.end, marks)) {
      const text = piece.text.replace(/\n$/, '');
      if (!text) continue;
      segments.push({ text, ...pick(piece.marks, piece) });
    }
    rows.push({ number: line.index + 1, segments });
  }
  if (hidden) rows.push({ gap: hidden });
  return rows;
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** What differs between two files: the byte ranges of `other` that are not the bytes of `base` at the same place. One range per run of changed bytes. */
export function changedRanges(base: Uint8Array, other: Uint8Array): Range[] {
  if (base.length === other.length) {
    const ranges: Range[] = [];
    for (let i = 0; i < other.length; i++) {
      if (base[i] === other[i]) continue;
      const last = ranges[ranges.length - 1];
      if (last && last.end === i) last.end = i + 1; else ranges.push({ start: i, end: i + 1 });
    }
    return ranges;
  }
  let head = 0;
  while (head < base.length && head < other.length && base[head] === other[head]) head++;
  let tail = 0;
  while (tail < base.length - head && tail < other.length - head && base[base.length - 1 - tail] === other[other.length - 1 - tail]) tail++;
  return [{ start: head, end: other.length - tail }];
}

function changedText(ranges: Range[], baseLength: number, otherLength: number): string {
  const lengths = baseLength === otherLength ? '' : ` · length ${int(baseLength)} → ${int(otherLength)}`;
  if (!ranges.length) return 'no byte differs';
  const total = ranges.reduce((n, r) => n + (r.end - r.start), 0);
  if (ranges.length === 1) {
    const r = ranges[0];
    if (r.end === r.start) return `${count(baseLength - otherLength, 'byte')} removed at ${int(r.start)}${lengths}`;
    return `${r.end - r.start === 1 ? `byte ${int(r.start)}` : `bytes ${int(r.start)}–${int(r.end)}`} changed${lengths}`;
  }
  return `${count(total, 'byte')} changed in ${ranges.length} places${lengths}`;
}

// ---- The detail --------------------------------------------------------------------------------------------

const KIND_EYEBROW: Record<string, string> = { 'must-redact': 'must redact', 'must-not-flag': 'must not flag', policy: 'project policy' };
const REASON_TERM: Record<string, string> = { 'must-redact': 'Why it must be redacted', 'must-not-flag': 'Why it must stay quiet', policy: 'Why this policy applies' };
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "github.com/gitleaks/gitleaks": where a source link points, from the link itself. */
function sourceLabel(href: string): string {
  try {
    const url = new URL(href);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.split('/').filter(Boolean).slice(0, 2).map(part => `/${decodeURIComponent(part)}`).join('')}`;
  } catch { return href; }
}

/** A data URL holding the exact bytes, or undefined when the text cannot be encoded as UTF-8. */
function downloadOf(content: string, path: string): { href: string; filename: string } | undefined {
  try {
    return { href: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`, filename: path.split('/').pop() || 'fixture.txt' };
  } catch { return undefined; }
}

function verdictOf(shared: SuiteShared, kind: string, tier: string, row: RowResult | undefined, scannerStatus: string | undefined): FixtureVerdictData {
  const product = shared.scanners.find(s => s.id === PRODUCT_ID);
  const run = shared.run;
  const who = run?.mode === 'candidate' ? `${PRODUCT_ID} candidate${run.commit ? ` main ${run.commit.slice(0, 7)}` : ''}` : `${PRODUCT_ID}${product?.version ? ` ${product.version}` : ''}`;
  const when = run ? `${run.mode} run ${run.date}` : 'no run recorded';
  const policy = kind === 'policy';
  if (!row) {
    const reason = shared.runProblem ?? (product && scannerStatus && scannerStatus !== 'complete' ? `${PRODUCT_ID} did not complete in this run (${scannerStatus}).` : product ? 'The run holds no row for these bytes.' : 'No benchmark run is published for this checkout.');
    return { who, run: when, headline: { status: 'not-measured', label: 'Not measured' }, explanation: reason, figures: [] };
  }
  const bytesReported = (row.actual ?? []).reduce((n, r) => n + (r.end - r.start), 0);
  if (row.spanOutcomes) {
    const outcomes = row.spanOutcomes;
    const total = outcomes.length;
    const n = (...words: string[]) => outcomes.filter(o => words.includes(o)).length;
    const leaked = n('PARTIAL', 'MISS'), over = n('OVERBROAD'), exact = n('EXACT'), covered = total - leaked;
    const label = total === 0 ? 'No secret span scored'
      : leaked === total ? 'Left readable' : leaked > 0 ? 'Some left readable' : over > 0 ? 'Redacted past the envelope' : exact === total ? 'Redacted exactly' : 'Redacted';
    const status: StatusLabel['status'] = policy ? 'info' : leaked > 0 ? 'fail' : over > 0 ? 'review' : 'pass';
    const parts = [[exact, 'exact'], [n('COVERED'), 'covered inside the envelope'], [over, 'covered past the envelope'], [n('PARTIAL'), 'partly covered'], [n('MISS'), 'not covered']].filter(([c]) => (c as number) > 0).map(([c, w]) => `${c} ${w}`);
    const explanation = total === 0 ? 'The corpus authored no secret span to score on this file.'
      : exact === total ? (total === 1 ? 'It reported one range that starts and ends on the same bytes as the expected secret.' : `Each of the ${total} expected secrets has a reported range that starts and ends on the same bytes.`)
      : `Of ${count(total, 'expected secret span')}: ${parts.join(', ')}.${policy ? ' This is a project-policy fixture: the outcome is recorded as information.' : ''}`;
    return {
      who, run: when, headline: { status, label }, explanation,
      figures: [
        { label: 'Secret spans covered', value: int(covered), of: `of ${int(total)}` },
        { label: 'Bytes left readable', value: int(row.leakedBytes ?? 0) },
        { label: 'Bytes redacted outside the envelope', value: int(row.collateralBytes ?? 0) },
      ],
    };
  }
  if (row.flagged != null) {
    const findings = row.findings ?? reportedCount(row);
    return {
      who, run: when,
      headline: row.flagged ? { status: policy ? 'info' : 'fail', label: 'Flagged' } : { status: 'pass', label: 'Quiet' },
      explanation: row.flagged ? `It reported ${count(findings, 'range')} on a file that holds no expected secret.` : 'It reported no range on this file, which holds no expected secret.',
      figures: [
        { label: 'Secret spans expected', value: '0' },
        { label: 'Ranges reported', value: int(findings) },
        ...(row.actual ? [{ label: 'Bytes in reported ranges', value: int(bytesReported) }] : []),
      ],
    };
  }
  return {
    who, run: when,
    headline: { status: 'not-measured', label: 'Unscored' },
    explanation: `It reported ${count(reportedCount(row), 'range')}. ${tier === 'T0' ? 'This fixture is pending review and excluded from comparative scores.' : 'The run records no outcome for this fixture.'}`,
    figures: [{ label: 'Ranges reported', value: int(reportedCount(row)) }, ...(row.actual ? [{ label: 'Bytes in reported ranges', value: int(bytesReported) }] : [])],
  };
}

/** The product's outcome words on a related fixture, with a line saying what it reported. */
function relatedOutcome(shared: SuiteShared, sibling: FixtureRecord, productIndex: number): { outcome: StatusLabel[]; note: string } {
  const packed = productIndex >= 0 ? sibling.rows[productIndex] : null;
  const row = packed ? unpackRow(packed) : undefined;
  const product = shared.scanners[productIndex];
  const outcome = verdictsOf(sibling.kind, row, product?.status);
  if (!row) return { outcome, note: `${PRODUCT_ID} holds no row for it` };
  if (row.flagged != null) return { outcome, note: row.flagged ? `${PRODUCT_ID} reported ${count(row.findings ?? reportedCount(row), 'range')}` : `${PRODUCT_ID} flagged nothing` };
  if (row.spanOutcomes) return { outcome, note: `${PRODUCT_ID}: ${count(row.spanOutcomes.length, 'secret span')}` };
  return { outcome, note: `${PRODUCT_ID} reported ${count(reportedCount(row), 'range')}` };
}

/** Rebuild what the fixture page shows from a compact record. Pure, and cheap enough to run for one fixture in the browser. */
export function resolveFixtureRecord(record: FixtureRecord, shared: SuiteShared, siblings: FixtureRecord[] = []): FixtureDetailData {
  const bytes = encoder.encode(record.content);
  // A source that records no bytes (the qualification view) gets the facts and outcomes only, never a stand-in file.
  const hasBytes = !record.noContent;
  const spans = record.expected;
  const secrets = spans.filter(s => (s.role ?? 'secret') === 'secret');
  const envelopes = spans.flatMap(s => (s.envelope ? [s.envelope] : []));
  const assessment = shared.assessments[record.assessment] ?? { sources: [] };
  const text = (index: number | undefined): string | undefined => (index === undefined ? undefined : shared.texts[index]);
  const slug = `${shared.category}--${record.id}`;
  const productIndex = shared.scanners.findIndex(s => s.id === PRODUCT_ID);
  const rowOf = (rec: FixtureRecord, i: number): RowResult | undefined => (rec.rows[i] ? unpackRow(rec.rows[i]!) : undefined);
  const productRow = productIndex >= 0 ? rowOf(record, productIndex) : undefined;
  const findings = productRow?.actual ?? [];
  const kindWord = KIND_TITLE[record.kind] ?? record.kind;
  const evidence = `${record.tier} · ${TIER_TITLE[record.tier] ?? record.tier}`;
  const facts = fileFacts(bytes);
  const notice = hasBytes ? hiddenNotice(record.content) : undefined;

  // ---- The input: what the corpus expects ----
  const inputMarks: MarkRange[] = [
    ...spans.map(s => ({ start: s.start, end: s.end, kind: s.role === 'companion' ? 'companion' : 'expected' })),
    ...envelopes.map(r => ({ start: r.start, end: r.end, kind: 'envelope' })),
  ];
  const input: FixtureFileData | undefined = !hasBytes ? undefined : {
    label: 'Input file', title: record.path, facts,
    ...(secrets.length ? { note: secrets.length === 1 ? `expected bytes ${rangeText(secrets[0])}` : `${secrets.length} expected spans` } : {}),
    rows: fileRows(bytes, inputMarks, marks => {
      const secret = marks.find(m => m.kind === 'expected');
      return {
        ...(secret ? { mark: 'expected' as const, title: `Expected secret, bytes ${secret.start} to ${secret.end}` } : marks.some(m => m.kind === 'companion') ? { mark: 'companion' as const, title: 'Companion text of an expected secret' } : {}),
        ...(marks.some(m => m.kind === 'envelope') ? { envelope: true } : {}),
      };
    }),
    ...(notice ? { notice } : {}),
  };

  // ---- The output: the product's reported ranges drawn over the input ----
  const outcomes = productRow?.spanOutcomes;
  const partialSecrets = secrets.filter((_, i) => outcomes?.[i] === 'PARTIAL');
  const outputMarks: MarkRange[] = [];
  for (const f of findings) outputMarks.push({ ...f, kind: partialSecrets.some(s => overlaps(s, f)) ? 'partial' : spans.some(s => overlaps(s, f)) ? 'redacted' : 'extra' });
  secrets.forEach((s, i) => {
    if (outcomes?.[i] !== 'PARTIAL' && outcomes?.[i] !== 'MISS') return;
    // The secret's bytes no reported range covers.
    let open: Range[] = [{ start: s.start, end: s.end }];
    for (const f of findings) open = open.flatMap(r => (overlaps(r, f) ? [{ start: r.start, end: Math.min(r.end, f.start) }, { start: Math.max(r.start, f.end), end: r.end }].filter(x => x.end > x.start) : [r]));
    for (const r of open) outputMarks.push({ ...r, kind: 'exposed' });
  });
  const output: FixtureFileData | undefined = productRow?.actual !== undefined && hasBytes ? {
    label: 'Output with the reported ranges drawn over the input',
    title: findings.length ? `${count(findings.length, 'range')} reported` : 'no range reported',
    facts,
    ...(findings.length === 1 ? { note: `bytes ${rangeText(findings[0])}` } : {}),
    rows: fileRows(bytes, outputMarks, (marks, piece) => {
      const finding = marks.find(m => m.kind === 'partial') ?? marks.find(m => m.kind === 'redacted') ?? marks.find(m => m.kind === 'extra');
      if (finding) {
        const size = count(piece.end - piece.start, 'byte');
        const label = finding.kind === 'partial' ? `redacted, a secret is partly exposed, ${size}` : finding.kind === 'extra' ? `redacted outside the expected spans, ${size}` : `redacted, ${size}`;
        return { mark: finding.kind as FileMarkKind, label, title: `Reported range, bytes ${finding.start} to ${finding.end}` };
      }
      return marks.some(m => m.kind === 'exposed') ? { mark: 'exposed' as const, title: 'Secret bytes no reported range covers' } : {};
    }),
    ...(notice ? { notice } : {}),
  } : undefined;
  const product = shared.scanners[productIndex];
  const outputNote = productRow ? 'This run records the scanner’s outcomes but not its reported offsets. The output cannot be drawn over the input.'
    : shared.runProblem ?? (product && product.status !== 'complete' ? `${PRODUCT_ID} did not complete in this run (${product.status}).` : product ? 'The run holds no row for these bytes.' : 'No benchmark run is published for this checkout.');

  const shapes = new Set(outputMarks.map(m => m.kind));
  const key: FixtureKeyItem[] = [
    ...(secrets.length ? [{ mark: 'expected' as const, label: 'Expected secret' }] : []),
    ...(envelopes.length ? [{ mark: 'envelope' as const, label: 'Envelope: may be redacted at no cost' }] : []),
    ...(spans.some(s => s.role === 'companion') ? [{ mark: 'companion' as const, label: 'Companion text' }] : []),
    ...(shapes.has('redacted') || shapes.has('extra') ? [{ mark: 'redacted' as const, label: 'Reported by redact-secret' }] : []),
    ...(shapes.has('partial') ? [{ mark: 'partial' as const, label: 'Reported, a secret partly exposed' }] : []),
    ...(shapes.has('exposed') ? [{ mark: 'exposed' as const, label: 'Secret bytes left readable' }] : []),
  ];

  // ---- Spans: expected beside reported, with the outcome the run recorded ----
  const spanRows: FixtureSpanRow[] = [];
  let secretNo = 0, companionNo = 0;
  const usedFindings = new Set<number>();
  for (const s of spans) {
    const isSecret = (s.role ?? 'secret') === 'secret';
    const label = isSecret ? `Secret ${++secretNo}` : `Companion ${++companionNo}`;
    const outcome = isSecret ? outcomes?.[secretNo - 1] : undefined;
    const reported = findings.flatMap((f, i) => (overlaps(s, f) ? (usedFindings.add(i), [{ range: rangeText(f), size: sizeText(f) }]) : []));
    spanRows.push({
      label, role: `role: ${s.role ?? 'secret'}`,
      expected: { range: rangeText(s), size: sizeText(s), ...(s.envelope ? { envelope: `${rangeText(s.envelope)}${s.envelope.reason ? `: ${s.envelope.reason.replace(/\.\s*$/, '')}` : ''}` } : {}) },
      reported,
      reportedNote: productRow ? (productRow?.actual !== undefined ? 'none reported' : 'offsets not recorded') : 'not measured',
      ...(isSecret
        ? (outcome ? { outcome: verdictsOf(record.kind, { spanOutcomes: [outcome] })[0], outcomeNote: SPAN_NOTE[outcome] } : productRow ? { outcomeNote: 'no outcome recorded' } : { outcome: { status: 'not-measured' as const, label: 'Not measured' } })
        : { outcomeNote: 'context, not scored' }),
    });
  }
  const outside = findings.flatMap((f, i) => (usedFindings.has(i) ? [] : [{ range: rangeText(f), size: sizeText(f) }]));
  if (spans.length && outside.length) {
    spanRows.push({ label: 'Outside the expected spans', role: 'reported where nothing is expected', reported: outside, reportedNote: '', outcomeNote: productRow?.collateralBytes != null ? `${count(productRow.collateralBytes, 'byte')} outside the envelope in this row` : undefined });
  }
  if (!spans.length) {
    findings.forEach((f, i) => spanRows.push({
      label: `Reported range ${i + 1}`, role: 'no secret expected', reported: [{ range: rangeText(f), size: sizeText(f) }], reportedNote: '',
      outcome: verdictsOf(record.kind, { flagged: true })[0], outcomeNote: 'a finding on a file with no expected secret',
    }));
  }
  const spansLede = secrets.length
    ? 'Offsets are UTF-8 bytes, [start, end). An envelope is the widest range a finding may reach at no cost: authored with a reason, hashed with the corpus and never widened in response to a scanner.'
    : `No secret is expected in this file.${record.kind === 'must-not-flag' ? ' Any reported range is a false alarm.' : ''} Offsets are UTF-8 bytes, [start, end).`;

  // ---- The twins: the files that differ by one authored mutation ----
  const byId = new Map(siblings.map(s => [s.id, s]));
  const twinItems: FixtureTwinData[] = [];
  const related: { label: string; record: FixtureRecord }[] = [];
  if (record.twinOf) {
    const original = byId.get(record.twinOf);
    if (original) {
      const ob = encoder.encode(original.content);
      const bothBytes = hasBytes && !original.noContent;
      const diff = bothBytes ? changedRanges(bytes, ob) : [];
      const o = relatedOutcome(shared, original, productIndex);
      related.push({ label: original.id, record: original });
      twinItems.push({
        id: original.id, href: fixtureHref({ category: shared.category, id: original.id }), title: 'The original',
        description: `${original.id} is the file this one was made from.${record.mutation ? ` What was changed: ${record.mutation}` : ''}`,
        changed: bothBytes ? changedText(diff, bytes.length, ob.length) : 'Byte differences unavailable in this view',
        ...(bothBytes ? { file: {
          label: 'The original, changed lines', title: original.path, facts: fileFacts(ob), note: changedText(diff, bytes.length, ob.length),
          rows: fileRows(ob, diff.map(r => ({ ...r, kind: 'changed' })), marks => (marks.length ? { mark: 'changed' as const, title: 'A byte this twin differs by' } : {})),
        } } : {}),
        outcome: o.outcome, outcomeNote: o.note, linkLabel: 'Open the original',
      });
    }
  }
  for (const id of record.twins) {
    const twin = byId.get(id);
    if (!twin) continue;
    const tb = encoder.encode(twin.content);
    const bothBytes = hasBytes && !twin.noContent;
    const diff = bothBytes ? changedRanges(bytes, tb) : [];
    const o = relatedOutcome(shared, twin, productIndex);
    related.push({ label: twin.id, record: twin });
    twinItems.push({
      id: twin.id, href: fixtureHref({ category: shared.category, id: twin.id }),
      title: twin.mutationKind ? `${capital(twin.mutationKind)} twin` : twin.id,
      description: twin.mutation ?? 'The corpus records no description of what was changed.',
      changed: bothBytes ? changedText(diff, bytes.length, tb.length) : 'Byte differences unavailable in this view',
      ...(bothBytes ? { file: {
        label: `${twin.id}, changed lines`, title: twin.path, facts: fileFacts(tb), note: changedText(diff, bytes.length, tb.length),
        rows: fileRows(tb, diff.map(r => ({ ...r, kind: 'changed' })), marks => (marks.length ? { mark: 'changed' as const, title: 'A byte that differs from this fixture' } : {})),
      } } : {}),
      outcome: o.outcome, outcomeNote: o.note, linkLabel: 'Open the twin',
    });
  }
  const twins = twinItems.length ? {
    heading: record.twinOf ? 'Its original' : twinItems.length === 1 ? 'Its near-twin' : 'Its near-twins',
    lede: record.twinOf
      ? 'The file this one was made from, with the bytes that differ boxed. The corpus expects nothing to be flagged on a twin; a scanner that redacts the original and stays quiet on this file tells the two apart.'
      : 'The same file with one authored mutation. The corpus expects nothing to be flagged on a twin; a scanner that redacts this fixture and stays quiet on the twin tells the two apart.',
    items: twinItems,
  } : undefined;

  // ---- Why this fixture exists ----
  const group = text(record.group);
  const axis = text(record.axis);
  const action = text(record.action);
  const milestone = text(record.milestone);
  const release = text(record.release);
  const title = text(record.title);
  const about = title ? text(record.about) : undefined;
  const scenarioAbout = text(record.scenarioAbout);
  const scenarioTitles = record.scenarios.map(i => shared.scenarios[i]?.title).filter(Boolean) as string[];
  // The old site read the issue from the group label ("#211 · …") when the fixture names none.
  const issueNumber = record.issue ?? (Number(/#(\d+)/.exec(group ?? '')?.[1]) || undefined);
  const issues = [
    ...(issueNumber ? [{ label: `Issue #${issueNumber}`, href: `https://github.com/redact-secret/redact-secret/issues/${issueNumber}`, external: true }] : []),
    ...record.followUps.map(i => shared.followUps[i]).filter(Boolean).map(i => ({ label: `${i.milestone} #${i.number}`, href: i.url, external: true })),
  ];
  const factList: FixtureFactData[] = [
    about
      ? { term: 'What it tests', value: about, ...(text(record.aboutBy) ? { note: text(record.aboutBy) } : {}) }
      : scenarioAbout ? { term: 'What it tests (scenario)', value: scenarioAbout, note: text(record.scenarioAboutBy) }
      : { term: 'What it tests', notRecorded: true, note: `${group ? `The corpus records a group label, “${group}”, and no description.` : 'The corpus records no description of this fixture.'}${shared.textProblem ? ` ${shared.textProblem}` : ''}` },
    assessment.reason ? { term: REASON_TERM[record.kind] ?? 'Reason', value: assessment.reason, ...(assessment.reasonBy ? { note: assessment.reasonBy } : {}) } : { term: REASON_TERM[record.kind] ?? 'Reason', notRecorded: true },
    ...(record.contract ? [{ term: 'Contract', value: record.contract, mono: true }] : []),
    { term: 'Evidence level', value: evidence, ...(record.tier === 'T0' ? { note: 'Pending review: excluded from comparative scores.' } : {}) },
    record.families.length
      ? { term: record.families.length === 1 ? 'Family' : 'Families', links: record.families.map(id => ({ label: shared.familyNames[id] ?? id, href: familyHref(id) })) }
      : { term: 'Family', value: 'None', note: text(record.unscoped) ?? 'No family relationship is recorded for this fixture.' },
    ...(record.detectors.length ? [{ term: record.detectors.length === 1 ? 'Detector' : 'Detectors', links: record.detectors.map(id => ({ label: shared.detectorTitles[id] ?? id, href: `/report/detectors/${id}/` })) }] : []),
    ...(scenarioTitles.length ? [{ term: 'Scenarios', value: scenarioTitles.join(' · ') }] : []),
    ...(axis ? [{ term: 'Context axis', value: axis, mono: true }] : []),
    ...(action ? [{ term: 'Expected action', value: action, mono: true, note: 'What the corpus expects a scanner to do. Not what a scanner did.' }] : []),
    // Recorded actions are per reported range; a scanner rule is never inferred from family attribution.
    ...(productRow && reportedCount(productRow) > 0 && shared.reported
      ? [{ term: 'Scanner rule', notRecorded: true as const, note: 'No scanner rule identifier is recorded. Family attribution is not a scanner rule.' },
          ...(findings.length ? findings.map((f, i) => ({ term: `Reported range ${i + 1} action`, ...(f.action ? { value: f.action, mono: true } : { notRecorded: true as const }), note: `Bytes ${rangeText(f)}${f.action ? ' · recorded by the scanner' : ' · no action recorded'}` }))
            : [{ term: 'Reported action', notRecorded: true as const, note: shared.reported.reason }])]
      : []),
    {
      term: 'Added',
      // The old site showed the release beside the milestone ("beta.8 · 0.1.0-beta.8"): the index's own `provenance.release`, never derived from the milestone.
      value: `${milestone ? `${capital(milestone)} · ` : ''}${release ? `${release} · ` : ''}suite ${shared.suite.title}`,
      note: `Suite ${shared.category}${milestone ? (release ? '' : ' · no release recorded for this milestone') : (release ? ' · no milestone recorded' : ' · no milestone or release recorded')}`,
    },
    ...(issues.length ? [{ term: 'Issues', links: issues }] : []),
    { term: 'Review', value: record.tier === 'T0' ? 'Pending review: excluded from comparative scores.' : `Authored from construction and evidence, never from scanner output.${shared.suite.reviewStatus ? ` ${shared.suite.reviewStatus}.` : ''}` },
    { term: 'File', value: record.path, mono: true, note: hasBytes ? `${count(bytes.length, 'byte')}${record.sha ? ` · sha256 ${record.sha}…` : ''}` : record.bytesNote ?? 'The bytes are not recorded by this pipeline.' },
  ];

  // ---- The other scanners ----
  const others = shared.scanners.map((s, i) => ({ s, i })).filter(({ s }) => s.id !== PRODUCT_ID);
  const relatedHeading = record.twinOf ? 'Its original' : twinItems.length === 1 ? 'Its twin' : twinItems.length > 1 ? 'Its twins' : undefined;
  const peerRows: FixturePeerRow[] = others.map(({ s, i }) => {
    const row = rowOf(record, i);
    return {
      id: s.id, name: `${s.name}${s.version ? ` ${s.version}` : ''}`,
      detail: `${s.observed.length ? `Results from ${s.observed.join(', ')} · ` : ''}${s.version ? '' : 'version unavailable · '}${s.mode}`,
      fixture: verdictsOf(record.kind, row, s.status),
      ranges: row ? (row.actual !== undefined ? rangesText(row.actual) : `${count(reportedCount(row), 'range')}, offsets not recorded`) : '—',
      ...(related.length ? { related: related.map(r => ({ label: r.label, outcome: verdictsOf(r.record.kind, rowOf(r.record, i), s.status) })) } : {}),
    };
  });
  const laneScanners = !hasBytes ? [] : shared.scanners.flatMap((s, i) => { const row = rowOf(record, i); return row?.actual !== undefined ? [{ s, i, row, marks: laneMarks(secrets, row.spanOutcomes, row.actual) }] : []; });
  const lines = byteLines(bytes);
  const active = new Set(lines.filter(line => spans.some(s => touches(line, s)) || envelopes.some(r => touches(line, r)) || laneScanners.some(l => l.marks.some(m => touches(line, m)))).map(l => l.index));
  if (!active.size && lines.length) active.add(0);
  const describe = (marks: Mark[], line: Range): string => marks.filter(m => touches(line, m)).map(m => `${m.shape === 'outline' ? 'missed' : m.shape === 'hatch' ? 'partly covered' : 'covered'} bytes ${m.start}–${m.end}`).join('; ') || 'nothing covered';
  const laneLines: ByteLineData[] = lines.filter(line => lines.length <= WINDOW_ABOVE || [...active].some(a => Math.abs(a - line.index) <= CONTEXT)).map(line => {
    const marks = [...spans.map(s => ({ start: s.start, end: s.end, kind: s.role === 'companion' ? 'companion' : 'secret' })), ...envelopes.map(r => ({ start: r.start, end: r.end, kind: 'envelope' }))];
    const segments: ByteSegment[] = segment(bytes, line.start, line.end, marks).map(piece => ({
      text: piece.text,
      ...(piece.marks.some(m => m.kind === 'secret') ? { role: 'secret' as const } : piece.marks.some(m => m.kind === 'companion') ? { role: 'companion' as const } : {}),
      ...(piece.marks.some(m => m.kind === 'envelope') ? { envelope: true } : {}),
    }));
    return {
      number: line.index + 1,
      segments,
      lanes: active.has(line.index) ? laneScanners.map(l => ({
        label: `${l.s.name}, line ${line.index + 1}: ${describe(l.marks, line)}`,
        pieces: segment(bytes, line.start, line.end, l.marks).map((piece): LanePiece => {
          const shape = PRIORITY.find(sh => piece.marks.some(m => m.shape === sh));
          return { text: piece.text, ...(shape ? { shape } : {}) };
        }),
      })) : [],
    };
  });
  const lanesCaption = secrets.length
    ? `Secret bytes ${describeSpans(secrets)}.${spans.filter(s => s.envelope).map(s => ` Envelope ${s.envelope!.start}–${s.envelope!.end}: ${(s.envelope!.reason ?? 'a finding may extend this far at no cost').replace(/\.\s*$/, '')}.`).join('')} All values are synthetic test data.`
    : `No authored secret spans.${record.kind === 'must-not-flag' ? ' Any finding on this file is a false alarm.' : ''} All values are synthetic test data.`;
  const peers = others.length ? {
    summary: `Same input, ${count(others.length, 'other scanner')}`,
    ...(relatedHeading ? { relatedHeading } : {}),
    rows: peerRows,
    ...(laneScanners.length ? { lanes: { lines: laneLines, scanners: laneScanners.map(l => ({ id: l.s.id, name: l.s.name, verdict: verdictsOf(record.kind, l.row, l.s.status) })), caption: lanesCaption } } : {}),
  } : undefined;

  // ---- The head ----
  const provider = record.families.length ? shared.providerNames[record.families[0]] ?? NOT_PROVIDER_SPECIFIC.name : undefined;
  const crumbs = record.families.length
    ? [{ label: 'Report', href: '/report/' }, { label: 'Providers', href: '/report/providers/' }, { label: provider!, href: `/report/providers/?q=${encodeURIComponent(provider!)}` }, { label: shared.familyNames[record.families[0]] ?? record.families[0], href: familyHref(record.families[0]) }, { label: record.id }]
    : [{ label: 'Report', href: '/report/' }, { label: 'Credential Corpus', href: '/report/corpus/' }, { label: shared.suite.title, href: suiteHref(shared.category) }, { label: record.id }];

  return {
    id: record.id,
    head: {
      eyebrow: `Fixture · ${KIND_EYEBROW[record.kind] ?? record.kind}`,
      // The authored title when its owner records one; otherwise the id, which is never dressed up as a title.
      title: title && about ? title : record.id,
      slug,
      tags: [
        { label: kindWord },
        { label: evidence },
        ...(axis ? [{ label: axis, mono: true }] : []),
        { label: 'Synthetic value', dashed: true },
      ],
    },
    crumbs,
    suiteHref: suiteHref(shared.category),
    verdict: verdictOf(shared, record.kind, record.tier, productRow, product?.status),
    ...(input ? { input } : { bytesNote: record.bytesNote ?? 'This fixture comes from the qualification view, which records each case’s expected spans and each scanner’s outcome for it but not the file’s bytes. They are not drawn, and none is made up.' }),
    ...(output ? { output } : { outputNote }),
    key: hasBytes ? key : [],
    spans: spanRows,
    spansLede,
    ...(twins ? { twins } : {}),
    whyHeading: 'Why this fixture exists',
    facts: factList,
    sources: assessment.sources.map(href => ({ href, label: sourceLabel(href) })),
    ...(hasBytes ? { escaped: JSON.stringify(record.content).replace(/\ufeff/g, '\\uFEFF') } : {}),
    command: hasBytes ? `npm run bench -- --category=${shared.category}` : 'npm run qualification:view -- --artifacts <dir>',
    actions: { ...(hasBytes && downloadOf(record.content, record.path) ? { download: downloadOf(record.content, record.path)! } : {}), ...(hasBytes ? {} : { bytesNotRecorded: true }), corpusHref: suiteHref(shared.category) },
    ...(peers ? { peers } : {}),
    ...(shared.runProblem ? { runProblem: shared.runProblem } : {}),
  };
}
