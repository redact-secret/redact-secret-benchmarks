import type { Range, ExpectedRange, Outcome, RowScore, ScoredRow, Group } from '../types.ts';
// Measurement protocol v4: per-span outcome lattice over UTF-8 byte ranges.
// Pure integer interval arithmetic so the browser can re-verify every report
// row without fixture bytes. See docs/measurement-v4.md §2.3–§2.5.

export const OUTCOMES = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'];
export const KINDS = ['must-redact', 'must-not-flag', 'policy'];
export const TIERS = ['T0', 'T1', 'T2', 'T3'];

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;
const contains = (outer: Range, inner: Range) => outer.start <= inner.start && outer.end >= inner.end;
const same = (a: Range, b: Range) => a.start === b.start && a.end === b.end;

/** Merge ranges into a sorted list of disjoint intervals. */
export function union(ranges: Range[]) {
  const sorted = [...ranges].sort((a: Range, b: Range) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

/** Bytes of `ranges` that fall outside the union of `cover`. */
export function bytesOutside(ranges: Range[], cover: Range[]) {
  const kept = union(cover);
  let total = 0;
  for (const r of union(ranges)) {
    let cursor = r.start;
    for (const c of kept) {
      if (c.end <= cursor) continue;
      if (c.start >= r.end) break;
      if (c.start > cursor) total += c.start - cursor;
      cursor = Math.max(cursor, c.end);
    }
    if (cursor < r.end) total += r.end - cursor;
  }
  return total;
}

/** Outcome of one secret span against the deduplicated findings on its file. */
export function spanOutcome(span: ExpectedRange, findings: Range[]): Outcome {
  const envelope = span.envelope ?? span;
  if (findings.some(f => same(f, span))) return 'EXACT';
  const covering = findings.filter(f => contains(f, span));
  if (covering.length) return covering.some(f => contains(envelope, f)) ? 'COVERED' : 'OVERBROAD';
  return findings.some(f => overlaps(f, span)) ? 'PARTIAL' : 'MISS';
}

export const isLeaked = (outcome: string) => outcome === 'PARTIAL' || outcome === 'MISS';
/**
 * Leak-axis complement only: true for OVERBROAD, which does not leak the
 * secret. This is NOT an acceptability predicate — acceptable is EXACT or
 * COVERED (engine v1.1 §3). Leakage and overbreadth are separate axes (§2.4).
 */
export const isCovered = (outcome: string) => !isLeaked(outcome);

/**
 * Score one fixture row. `expected` carries role and optional envelope;
 * `actual` is the deduplicated list of findings on that file, each optionally
 * carrying which family produced it.
 *
 * Rows with no secret span are controls and only count findings. `scopeFamily`
 * is passed only for a twin (a control fixture with `twinOf` set): its
 * assertion is scoped to its own declared contract family, per
 * docs/evaluation-methods/02-negative-twin.md. A finding attributed to a
 * *different*, known family is not silence — it is legitimate co-detection by
 * another detector — so it is recorded on its own axis (`coDetected`) instead
 * of failing the twin. A finding with no attributed family is ambiguous, not
 * known-other, and still counts toward `flagged` (fails closed). A benign
 * control (no `scopeFamily`) keeps the unscoped, global reading: any finding
 * at all flags it.
 */
export function scoreRow(expected: ExpectedRange[], actual: (Range & { family?: string; action?: string })[], scopeFamily?: string): RowScore {
  const secrets = expected.filter(e => (e.role ?? 'secret') === 'secret');
  if (!secrets.length) {
    // #95: additive tally of the product policy action a finding carried, when the scanner
    // reports one. Never changes `flagged`/`findings` below (docs/decisions/2026-09-21-
    // add-untargeted-benign-corpus.md, Decision 3).
    const actionCounts = actual.reduce<Record<string, number>>((counts, a) => {
      if (a.action !== undefined) counts[a.action] = (counts[a.action] ?? 0) + 1;
      return counts;
    }, {});
    const withActions = <T extends RowScore>(score: T): T => (Object.keys(actionCounts).length ? { ...score, actionCounts } : score);
    if (scopeFamily) {
      const other = actual.filter(a => a.family !== undefined && a.family !== scopeFamily).length;
      return withActions({ flagged: other < actual.length, findings: actual.length, ...(other > 0 ? { coDetected: true } : {}) });
    }
    return withActions({ flagged: actual.length > 0, findings: actual.length });
  }
  const spanOutcomes = secrets.map(e => spanOutcome(e, actual));
  const leakedBytes = secrets.reduce((n, e, i) => n + (isLeaked(spanOutcomes[i]) ? bytesOutside([e], actual) : 0), 0);
  const acceptable = expected.map(e => e.envelope ?? e);
  return { spanOutcomes, leakedBytes, collateralBytes: bytesOutside(actual, acceptable) };
}

export const groupKey = (kind: string | undefined, tier: string | undefined) => (tier === 'T0' ? 'pending/T0' : `${kind}/${tier}`);

const rate = (n: number, d: number) => (d ? n / d : null);
const secretBytesOf = (row: ScoredRow) => row.expected.filter(e => (e.role ?? 'secret') === 'secret').reduce((n, e) => n + e.end - e.start, 0);

/**
 * The v1.0 scorer, kept frozen for the dual-scorer transition: published
 * groups come from `accountGroups` (./accounting.ts), which applies the v1.1
 * rules on top of these counts.
 *
 * Aggregate scored rows into `<kind>/<tier>` groups. Rows must carry
 * kind, tier, expected, actual and the scoreRow fields; `twinOf` names the
 * positive row (by `id`) a control is paired with. No cross-group totals.
 */
export function aggregateGroups(rows: ScoredRow[]) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const groups: Record<string, Group> = {};
  const positives = rows.filter(r => r.tier !== 'T0' && r.kind !== 'must-not-flag');
  const twinsFor = new Map<string, ScoredRow[]>();
  for (const twin of rows.filter(r => r.twinOf && r.tier !== 'T0')) {
    const positive = byId.get(twin.twinOf!);
    if (!positive || positive.kind === 'must-not-flag' || positive.tier === 'T0') continue;
    if (!twinsFor.has(positive.id)) twinsFor.set(positive.id, []);
    twinsFor.get(positive.id)!.push(twin);
  }
  for (const row of rows) {
    const key = groupKey(row.kind, row.tier);
    if (row.tier === 'T0') {
      groups[key] ??= { files: 0, scored: false };
      groups[key].files++;
      continue;
    }
    if (row.kind === 'must-not-flag') {
      const g = (groups[key] ??= { files: 0, flaggedFiles: 0, falseAlarmRate: null, findings: 0, meanFindingsPerFlagged: null, diagnostics: { exact: { fp: 0, tn: 0 }, comparable: false } });
      g.files++;
      g.findings! += row.findings!;
      if (row.flagged) g.flaggedFiles!++;
      g.diagnostics!.exact.fp += row.findings!;
      if (!row.flagged) g.diagnostics!.exact.tn!++;
      continue;
    }
    const g = (groups[key] ??= {
      files: 0, spans: 0, secretBytes: 0,
      outcomes: Object.fromEntries(OUTCOMES.map(o => [o, 0])),
      leakedSpans: 0, leakedSpanRate: null, leakedBytes: 0, leakedByteRate: null,
      collateralBytes: 0, collateralRatio: null,
      twins: { positives: 0, pairs: 0, discriminated: 0, coDetected: 0, rate: null },
      diagnostics: { exact: { tp: 0, fp: 0, fn: 0 }, comparable: false },
    });
    g.files++;
    g.spans! += row.spanOutcomes!.length;
    g.secretBytes! += secretBytesOf(row);
    for (const o of row.spanOutcomes!) { g.outcomes![o]++; if (isLeaked(o)) g.leakedSpans!++; }
    g.leakedBytes! += row.leakedBytes!;
    g.collateralBytes! += row.collateralBytes!;
    const secrets = row.expected.filter(e => (e.role ?? 'secret') === 'secret');
    const tp = row.spanOutcomes!.filter(o => o === 'EXACT').length;
    g.diagnostics!.exact.tp! += tp;
    g.diagnostics!.exact.fn! += secrets.length - tp;
    g.diagnostics!.exact.fp += row.actual.filter(a => !secrets.some(e => same(e, a))).length;
    g.twins!.positives++;
    for (const twin of twinsFor.get(row.id) ?? []) {
      g.twins!.pairs++;
      if (row.spanOutcomes!.every(isCovered) && !twin.flagged) g.twins!.discriminated++;
      if (twin.coDetected) g.twins!.coDetected++;
    }
  }
  for (const [key, g] of Object.entries(groups)) {
    if (key === 'pending/T0') continue;
    if (key.startsWith('must-not-flag/')) {
      g.falseAlarmRate = rate(g.flaggedFiles!, g.files);
      g.meanFindingsPerFlagged = rate(g.findings!, g.flaggedFiles!);
      continue;
    }
    g.leakedSpanRate = rate(g.leakedSpans!, g.spans!);
    g.leakedByteRate = rate(g.leakedBytes!, g.secretBytes!);
    g.collateralRatio = rate(g.collateralBytes!, g.secretBytes!);
    g.twins!.rate = rate(g.twins!.discriminated, g.twins!.pairs);
  }
  // The twin denominator is the positive population; the per-row increments must agree with it.
  const counted = Object.values(groups).reduce((n, g) => n + (g.twins?.positives ?? 0), 0);
  if (counted !== positives.length) throw new Error('Twin denominator does not agree with the positive population');
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

/** Compact, comparable encoding of one (fixture, scanner) result for baselines. */
export function encodeOutcome(row: ScoredRow | null | undefined) {
  if (!row) return null;
  if (row.spanOutcomes!) return row.spanOutcomes!.join(',');
  if (row.flagged != null) return row.flagged ? `flagged:${row.findings!}` : 'clean';
  return `observed:${row.actual?.length ?? 0}`;
}
