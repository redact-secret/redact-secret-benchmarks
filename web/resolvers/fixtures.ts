/**
 * One fixture as the fixture page shows it (#559): the exact bytes with what was
 * expected and what each scanner covered drawn under them, the expected spans, each
 * scanner's reported ranges, and why the expectation holds. Pure: the fixture, the
 * catalog entry and the run's rows in, block props out.
 *
 * Everything here is a value the corpus or the run recorded. Ranges are UTF-8 byte
 * offsets, [start, end). The lane marks follow the run's own outcomes: a finding is
 * a bar, hatched where the row's outcome for the span it touches is `PARTIAL`, and a
 * `MISS` is an empty frame where the secret is. Nothing is re-scored, and matched
 * values of a scanner's raw output are never read (a row holds ranges only).
 */
import type { BuiltFixture, CatalogFixture, CatalogSuite } from '../services/catalog';
import type { RowResult, RunScanner } from '../services/run';
import type {
  ByteLineData, ByteSegment, ExpectedSpanRow, FixtureDetailData, FixtureFactData, LanePiece, ReportedRangesRow, StatusLabel,
} from '../components/report/types';
import { KIND_TITLE, TIER_TITLE } from './families';
import { familyHref } from './families';
import { fixtureHref, suiteHref } from './rows';
import { count, int } from './format';

interface Range { start: number; end: number }
interface Span extends Range { role?: 'secret' | 'companion'; envelope?: Range & { reason?: string }; note?: string }

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
export function segment<T extends Range>(bytes: Uint8Array, from: number, to: number, ranges: T[]): { text: string; marks: T[] }[] {
  const cuts = [...new Set([from, to, ...ranges.flatMap(r => [r.start, r.end]).filter(offset => offset > from && offset < to)])].sort((a, b) => a - b);
  return cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1];
    return { text: decoder.decode(bytes.slice(start, end)), marks: ranges.filter(r => r.start < end && r.end > start) };
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

const SPAN_WORD: Record<string, string> = { EXACT: 'Exact', COVERED: 'Within range', OVERBROAD: 'Too much', PARTIAL: 'Partly exposed', MISS: 'Missed' };

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
  return [{ status: 'not-measured', label: `Unscored · ${count(row.actual?.length ?? 0, 'range')}` }];
}

const rangesText = (items: Range[] | undefined): string => (items && items.length ? items.map(r => `[${r.start}, ${r.end})`).join(' · ') : 'none reported');
const describeSpans = (spans: Range[]): string => spans.map(s => `${s.start}–${s.end}`).join(', ') || 'none';

// ---- The compact record a suite page ships, and the way back to the detail ----------------------------

const OUTCOME_LETTER: Record<string, string> = { EXACT: 'E', COVERED: 'C', OVERBROAD: 'O', PARTIAL: 'P', MISS: 'M' };
const LETTER_OUTCOME: Record<string, NonNullable<RowResult['spanOutcomes']>[number]> = { E: 'EXACT', C: 'COVERED', O: 'OVERBROAD', P: 'PARTIAL', M: 'MISS' };

/**
 * One recorded row as a short string: `outcomes|flagged|ranges|leaked|collateral|findings`, where outcomes
 * is a letter per span (E exact, C covered, O overbroad, P partial, M miss), `=` for none or `-` when the row
 * has no span outcomes, flagged is `1`, `0` or `-`, and ranges is `start-end` pairs joined by commas. A
 * suite page ships five of these per fixture.
 */
export function packRow(row: RowResult): string {
  return [
    row.spanOutcomes ? row.spanOutcomes.map(o => OUTCOME_LETTER[o]).join('') || '=' : '-',
    row.flagged == null ? '-' : row.flagged ? '1' : '0',
    (row.actual ?? []).map(r => `${r.start}-${r.end}`).join(','),
    row.leakedBytes ?? '', row.collateralBytes ?? '', row.findings ?? '',
  ].join('|');
}

export function unpackRow(text: string): RowResult {
  const [outcomes, flagged, ranges, leaked, collateral, findings] = text.split('|');
  return {
    ...(outcomes !== '-' ? { spanOutcomes: outcomes === '=' ? [] : [...outcomes].map(letter => LETTER_OUTCOME[letter]) } : {}),
    ...(flagged !== '-' ? { flagged: flagged === '1' } : {}),
    actual: ranges ? ranges.split(',').map(pair => { const [start, end] = pair.split('-'); return { start: Number(start), end: Number(end) }; }) : [],
    ...(leaked !== '' ? { leakedBytes: Number(leaked) } : {}),
    ...(collateral !== '' ? { collateralBytes: Number(collateral) } : {}),
    ...(findings !== '' ? { findings: Number(findings) } : {}),
  };
}

/**
 * A suite page ships one compact record per fixture and builds the detail of the one a
 * reader opens in the browser (`resolveFixtureRecord`), so a suite of 1,300 fixtures does not
 * carry 1,300 drawn lanes. Shared text (an assessment's reason and sources, a scanner's mode
 * line, a detector's title) is held once in `SuiteShared` and referred to by index or id.
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
}

export interface SuiteShared {
  category: string;
  suite: { title: string; reviewStatus: string };
  scanners: { id: string; name: string; version: string | null; mode: string; status: string }[];
  assessments: { reason?: string; sources: string[] }[];
  followUps: { number: number; url: string; milestone: string }[];
  detectorTitles: Record<string, string>;
  familyNames: Record<string, string>;
  runProblem?: string;
}

/** What `data/fixtures/<suite>/records.json` holds: the records and the shared text they refer to. */
export interface SuiteRecordsFile { records: FixtureRecord[]; shared: SuiteShared }

/** Shape guard for a loaded records file: the parts `resolveFixtureRecord` reads exist. */
export const isSuiteRecordsFile = (value: unknown): value is SuiteRecordsFile => {
  const v = value as Partial<SuiteRecordsFile> | null;
  return !!v && Array.isArray(v.records) && !!v.shared && Array.isArray(v.shared.scanners) && Array.isArray(v.shared.assessments) && typeof v.shared.category === 'string';
};

export interface SuiteBuild {
  suite: CatalogSuite;
  fixtures: CatalogFixture[];
  bytes: Map<string, BuiltFixture>;
  /** The run's scanners in run order. Empty when there is no usable run. */
  scanners: Pick<RunScanner, 'id' | 'name' | 'version' | 'mode' | 'status' | 'rows'>[];
  runProblem?: string;
  /** Findings, each with the fixtures it rests on and its milestone label. */
  findings: { number: number; url: string; milestone: string; fixtures: string[] }[];
  detectorTitles: Map<string, string>;
  familyNames: Map<string, string>;
}

/** The compact records of one suite, and the shared text they refer to. */
export function buildSuiteRecords(input: SuiteBuild): { records: FixtureRecord[]; shared: SuiteShared } {
  const assessments: SuiteShared['assessments'] = [];
  const assessmentIndex = new Map<string, number>();
  const followUps: SuiteShared['followUps'] = input.findings.map(({ number, url, milestone }) => ({ number, url, milestone }));
  const twinsOf = new Map<string, string[]>();
  for (const f of input.fixtures) {
    const positive = input.bytes.get(f.slug)?.twinOf;
    if (positive) (twinsOf.get(positive) ?? twinsOf.set(positive, []).get(positive)!).push(f.id);
  }
  const detectorTitles: Record<string, string> = {};
  const familyNames: Record<string, string> = {};

  const records = input.fixtures.map((entry): FixtureRecord => {
    const built = input.bytes.get(entry.slug)!;
    const key = JSON.stringify([built.assessment.reason ?? '', built.assessment.sources ?? []]);
    let index = assessmentIndex.get(key);
    if (index === undefined) {
      index = assessments.length;
      assessments.push({ ...(built.assessment.reason ? { reason: built.assessment.reason } : {}), sources: built.assessment.sources ?? [] });
      assessmentIndex.set(key, index);
    }
    for (const id of entry.detectors) detectorTitles[id] = input.detectorTitles.get(id) ?? id;
    for (const id of entry.familyIds) familyNames[id] = input.familyNames.get(id) ?? id;
    const twinOf = built.twinOf;
    return {
      id: entry.id, path: built.path, kind: entry.kind, tier: entry.tier,
      ...(built.assessment.contract ? { contract: built.assessment.contract } : {}),
      ...(twinOf ? { twinOf } : {}),
      ...(built.mutation ? { mutation: built.mutation } : {}), ...(built.mutationKind ? { mutationKind: built.mutationKind } : {}),
      ...(built.issue ? { issue: built.issue } : {}),
      content: built.content, expected: built.expected as Span[],
      detectors: entry.detectors, families: entry.familyIds,
      assessment: index,
      followUps: input.findings.flatMap((finding, i) => (finding.fixtures.includes(entry.slug) ? [i] : [])),
      twins: twinsOf.get(entry.id) ?? [],
      rows: input.scanners.map(s => { const row = s.rows?.get(entry.slug); return row ? packRow(row) : null; }),
    };
  });
  return {
    records,
    shared: {
      category: input.suite.id,
      suite: { title: input.suite.title, reviewStatus: input.suite.reviewStatus },
      scanners: input.scanners.map(s => ({ id: s.id, name: s.name, version: s.version, mode: s.mode, status: s.status })),
      assessments, followUps, detectorTitles, familyNames,
      ...(input.runProblem ? { runProblem: input.runProblem } : {}),
    },
  };
}

/** Rebuild what the fixture page shows from a compact record. Pure, and cheap enough to run for one fixture in the browser. */
export function resolveFixtureRecord(record: FixtureRecord, shared: SuiteShared): FixtureDetailData {
  const assessment = shared.assessments[record.assessment] ?? { sources: [] };
  const slug = `${shared.category}--${record.id}`;
  const scanners = shared.scanners.map((s, i) => {
    const row = record.rows[i];
    const held = new Map<string, RowResult>();
    if (row) held.set(slug, unpackRow(row));
    return { id: s.id, name: s.name, version: s.version, mode: s.mode, status: s.status, rows: held };
  });
  return resolveFixtureDetail({
    fixture: {
      id: record.id, slug, category: shared.category, group: '', path: record.path, content: record.content, expected: record.expected,
      ...(record.twinOf ? { twinOf: record.twinOf } : {}),
      detectors: record.detectors, ...(record.issue ? { issue: record.issue } : {}),
      ...(record.mutation ? { mutation: record.mutation } : {}), ...(record.mutationKind ? { mutationKind: record.mutationKind } : {}),
      assessment: { kind: record.kind as BuiltFixture['assessment']['kind'], tier: record.tier as BuiltFixture['assessment']['tier'], ...(record.contract ? { contract: record.contract } : {}), ...(assessment.reason ? { reason: assessment.reason } : {}), sources: assessment.sources },
    },
    entry: { slug, category: shared.category, id: record.id, group: '', kind: record.kind as CatalogFixture['kind'], tier: record.tier as CatalogFixture['tier'], familyIds: record.families, detectors: record.detectors },
    suite: { id: shared.category, title: shared.suite.title, description: '', reviewStatus: shared.suite.reviewStatus },
    scanners,
    ...(shared.runProblem ? { runProblem: shared.runProblem } : {}),
    detectors: record.detectors.map(id => ({ id, title: shared.detectorTitles[id] ?? id })),
    families: record.families.map(id => ({ id, name: shared.familyNames[id] ?? id })),
    twins: record.twins.map(id => ({ slug: `${shared.category}--${id}`, category: shared.category, id, group: '', kind: 'must-not-flag', tier: record.tier as CatalogFixture['tier'], familyIds: [], detectors: [] })),
    followUps: record.followUps.map(i => shared.followUps[i]).filter(Boolean),
  });
}

export interface FixtureInput {
  /** The bytes, expected spans and assessment as the corpus holds them. */
  fixture: BuiltFixture;
  entry: CatalogFixture;
  suite: CatalogSuite;
  /** The run's scanners in run order, with their rows. Empty when there is no usable run. */
  scanners: Pick<RunScanner, 'id' | 'name' | 'version' | 'mode' | 'status' | 'rows'>[];
  /** Why the run has nothing for this suite, when it does not. */
  runProblem?: string;
  detectors: { id: string; title: string }[];
  families: { id: string; name: string }[];
  /** The negative twins authored from this fixture. */
  twins: CatalogFixture[];
  /** Findings that rest on this fixture: milestone label, issue number and url. */
  followUps: { number: number; url: string; milestone: string }[];
}

export function resolveFixtureDetail(input: FixtureInput): FixtureDetailData {
  const { fixture: f, entry, suite } = input;
  const bytes = encoder.encode(f.content);
  const spans = f.expected as Span[];
  const secrets = spans.filter(s => (s.role ?? 'secret') === 'secret');
  const envelopes = spans.flatMap(s => (s.envelope ? [s.envelope] : []));
  const a = f.assessment;

  // A scanner gets a lane only when the run recorded a row for it: a scanner with none is listed as not measured below.
  const lanes = input.scanners.flatMap(s => {
    const row = s.rows?.get(f.slug);
    return row ? [{ scanner: s, row, marks: laneMarks(secrets, row.spanOutcomes, row.actual ?? []) }] : [];
  });

  const lines = byteLines(bytes);
  const active = new Set(lines.filter(line => spans.some(s => touches(line, s)) || envelopes.some(r => touches(line, r)) || lanes.some(l => l.marks.some(m => touches(line, m)))).map(l => l.index));
  if (!active.size && lines.length) active.add(0);

  const describe = (marks: Mark[], line: Range): string =>
    marks.filter(m => touches(line, m)).map(m => `${m.shape === 'outline' ? 'missed' : m.shape === 'hatch' ? 'partly covered' : 'covered'} bytes ${m.start}–${m.end}`).join('; ') || 'nothing covered';

  const lineData: ByteLineData[] = lines.map(line => {
    const marks = [
      ...spans.map(s => ({ start: s.start, end: s.end, kind: s.role === 'companion' ? 'companion' : 'secret' })),
      ...envelopes.map(r => ({ start: r.start, end: r.end, kind: 'envelope' })),
    ];
    const segments: ByteSegment[] = segment(bytes, line.start, line.end, marks).map(piece => ({
      text: piece.text,
      ...(piece.marks.some(m => m.kind === 'secret') ? { role: 'secret' as const } : piece.marks.some(m => m.kind === 'companion') ? { role: 'companion' as const } : {}),
      ...(piece.marks.some(m => m.kind === 'envelope') ? { envelope: true } : {}),
    }));
    return {
      number: line.index + 1,
      segments,
      lanes: active.has(line.index) ? lanes.map(l => ({
        label: `${l.scanner.name}, line ${line.index + 1}: ${describe(l.marks, line)}`,
        pieces: segment(bytes, line.start, line.end, l.marks).map((piece): LanePiece => {
          const shape = PRIORITY.find(s => piece.marks.some(m => m.shape === s));
          return { text: piece.text, ...(shape ? { shape } : {}) };
        }),
      })) : [],
    };
  });

  const caption = secrets.length
    ? `Secret bytes ${describeSpans(secrets)}.${spans.filter(s => s.envelope).map(s => ` Envelope ${s.envelope!.start}–${s.envelope!.end}: ${(s.envelope!.reason ?? 'a finding may extend this far at no cost').replace(/\.\s*$/, '')}.`).join('')} All values are synthetic test data.`
    : `No authored secret spans.${a.kind === 'must-not-flag' ? ' Any finding on this file is a false alarm.' : ''} All values are synthetic test data.`;

  const expected: ExpectedSpanRow[] = spans.map(s => ({
    range: `[${s.start}, ${s.end})`,
    role: s.role ?? 'secret',
    value: decoder.decode(bytes.slice(s.start, s.end)),
    ...(s.envelope ? { envelope: { range: `[${s.envelope.start}, ${s.envelope.end})`, ...(s.envelope.reason ? { reason: s.envelope.reason } : {}) } } : {}),
    ...(s.note ? { note: s.note } : {}),
  }));

  const reported: ReportedRangesRow[] = input.scanners.map(s => {
    const row = s.rows?.get(f.slug);
    return {
      scanner: s.name,
      detail: `${s.version ?? 'version unavailable'} · ${s.mode}`,
      outcome: verdictsOf(a.kind, row, s.status),
      ...(row ? { code: row.spanOutcomes ? row.spanOutcomes.join(' · ') : row.flagged != null ? (row.flagged ? 'FLAGGED' : 'QUIET') : 'UNSCORED' } : { code: s.status === 'complete' ? 'No row is recorded for these bytes in this run.' : `The scanner did not complete (${s.status}).` }),
      ranges: row ? rangesText(row.actual) : '—',
      ...(row?.spanOutcomes ? { bytes: `leaked ${row.leakedBytes ?? 0} · outside envelope ${row.collateralBytes ?? 0}` } : {}),
    };
  });

  const facts: FixtureFactData[] = [
    { term: 'Kind', value: KIND_TITLE[a.kind] ?? a.kind },
    { term: 'Evidence', value: `${a.tier} · ${TIER_TITLE[a.tier] ?? a.tier}${a.tier === 'T0' ? ' (unscored)' : ''}` },
    ...(a.contract ? [{ term: 'Contract', value: a.contract }] : []),
    ...(f.twinOf ? [{ term: 'Twin of', value: f.twinOf, href: fixtureHref({ category: f.category, id: f.twinOf }) }] : []),
    ...(f.mutation ? [{ term: 'Mutation', value: `${f.mutationKind ?? 'mutation'}: ${f.mutation}` }] : []),
    ...(input.twins.length ? [{ term: 'Negative twins', links: input.twins.map(t => ({ label: t.id, href: fixtureHref(t) })) }] : []),
    ...(a.reason ? [{ term: 'Reason', value: a.reason }] : []),
    ...(input.followUps.length || f.issue ? [{ term: 'Issues', links: [
      ...(f.issue ? [{ label: `Issue #${f.issue}`, href: `https://github.com/redact-secret/redact-secret/issues/${f.issue}` }] : []),
      ...input.followUps.map(i => ({ label: `${i.milestone} #${i.number}`, href: i.url })),
    ] }] : []),
    { term: 'Review', value: `${a.tier === 'T0' ? 'Pending review: excluded from comparative scores.' : 'Authored from construction and evidence, never from scanner output.'}${suite.reviewStatus ? ` ${suite.reviewStatus}.` : ''}` },
  ];

  return {
    id: f.id,
    suite: suite.title,
    suiteHref: suiteHref(f.category),
    kind: KIND_TITLE[a.kind] ?? a.kind,
    evidence: `${a.tier} · ${TIER_TITLE[a.tier] ?? a.tier}`,
    path: f.path,
    size: `${int(bytes.length)} UTF-8 bytes, [start, end)`,
    detectors: input.detectors.map(d => ({ id: d.id, title: d.title, href: `/report/detectors/${d.id}/` })),
    families: input.families.map(fam => ({ id: fam.id, name: fam.name, href: familyHref(fam.id) })),
    scanners: lanes.map(l => ({ id: l.scanner.id, name: l.scanner.name, verdict: verdictsOf(a.kind, l.row, l.scanner.status) })),
    lines: lineData,
    caption,
    expected,
    reported,
    facts,
    sources: (a.sources ?? []).map((href, i) => ({ href, label: `Evidence ${i + 1}` })),
    command: `npm run bench -- --category=${f.category}`,
    escaped: JSON.stringify(f.content).replace(/﻿/g, '\\uFEFF'),
    ...(input.runProblem ? { runProblem: input.runProblem } : {}),
  };
}
