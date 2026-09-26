/**
 * Freezing and reading an adversarial pack's first run (#140, contract #139).
 *
 * `first-run.json` stores ranges only. A scanner may report overlapping or
 * duplicate spans, but the first-run schema needs them ascending and
 * non-overlapping, so `normalizeFindings` merges them. That loses no coverage:
 * the merged ranges cover exactly the bytes the scanner reported.
 *
 * `compareResult` scores one fixture × scanner result against the submitted
 * expectation. It works on byte coverage only, never on matched values.
 */
import type { FirstRunRecord, IntakeFixture } from './adversarial-intake.ts';

type Range = { start: number; end: number };

/** Sorted, de-duplicated, overlap-merged ranges; touching ranges stay separate. */
export function normalizeFindings(findings: readonly Range[]): Range[] {
  const sorted = [...findings].filter(f => f.start < f.end).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const { start, end } of sorted) {
    const last = merged.at(-1);
    if (last && start < last.end) last.end = Math.max(last.end, end);
    else merged.push({ start, end });
  }
  return merged;
}

export type Outcome =
  | 'redacted'      // must-redact: every expected byte covered, nothing outside expected ranges
  | 'overbroad'     // must-redact: every expected byte covered, plus bytes outside them
  | 'partial'       // must-redact: some but not all expected bytes covered
  | 'missed'        // must-redact: no expected byte covered
  | 'clean'         // must-not-flag: no finding
  | 'flagged'       // must-not-flag: at least one finding
  | 'scanner-failed';

const covered = (ranges: readonly Range[], start: number, end: number) =>
  ranges.reduce((sum, r) => sum + Math.max(0, Math.min(end, r.end) - Math.max(start, r.start)), 0);

export function compareResult(fixture: Pick<IntakeFixture, 'action' | 'expected'>, result: FirstRunRecord['results'][number]): Outcome {
  if (result.status === 'failed') return 'scanner-failed';
  const findings = normalizeFindings(result.findings);
  if (fixture.action === 'must-not-flag') return findings.length ? 'flagged' : 'clean';
  const expectedBytes = fixture.expected.reduce((sum, r) => sum + r.end - r.start, 0);
  const hit = fixture.expected.reduce((sum, r) => sum + covered(findings, r.start, r.end), 0);
  if (hit === 0) return 'missed';
  if (hit < expectedBytes) return 'partial';
  const findingBytes = findings.reduce((sum, r) => sum + r.end - r.start, 0);
  return findingBytes > expectedBytes ? 'overbroad' : 'redacted';
}

/** Outcome counts per scanner, in first-run scanner order. */
export function outcomeTable(fixtures: readonly IntakeFixture[], run: FirstRunRecord): Map<string, Record<Outcome, number>> {
  const byId = new Map(fixtures.map(f => [f.id, f]));
  const table = new Map<string, Record<Outcome, number>>();
  for (const scanner of run.scanners) {
    table.set(scanner.name, { redacted: 0, overbroad: 0, partial: 0, missed: 0, clean: 0, flagged: 0, 'scanner-failed': 0 });
  }
  for (const result of run.results) {
    const fixture = byId.get(result.fixtureId);
    const row = table.get(result.scanner);
    if (fixture && row) row[compareResult(fixture, result)] += 1;
  }
  return table;
}
