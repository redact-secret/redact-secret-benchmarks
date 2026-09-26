/**
 * Fixed-candidate rerun of a frozen adversarial pack (#140, lifecycle
 * decision-govern-benchmark-promotion "Fixed-candidate revalidation").
 *
 * `first-run.json` is immutable; a rerun never rewrites it. It scans the same
 * fixtures with a locally built candidate and scores each result with the
 * same `compareResult` the first run is read with, so the two are directly
 * comparable. Ranges and outcomes only: no fixture content, matched value or
 * raw scanner output.
 */
import { compareResult, type Outcome } from './adversarial-first-run.ts';
import type { FirstRunRecord, IntakeFixture } from './adversarial-intake.ts';

type Range = { start: number; end: number };

export interface RerunResult {
  fixtureId: string;
  action: IntakeFixture['action'];
  status: 'complete' | 'failed';
  findings: Range[];
  outcome: Outcome;
  /** The product's outcome in the frozen first run; `null` if it has no row there. */
  firstRunOutcome: Outcome | null;
}

/** An outcome that meets the fixture's expectation exactly. */
export const meetsExpectation = (outcome: Outcome): boolean => outcome === 'redacted' || outcome === 'clean';

export function rerunResult(
  fixture: IntakeFixture,
  scan: { status: 'complete' | 'failed'; findings: Range[] },
  firstRun: FirstRunRecord,
  productScanner = 'redact-secret',
): RerunResult {
  const baseline = firstRun.results.find(row => row.fixtureId === fixture.id && row.scanner === productScanner);
  return {
    fixtureId: fixture.id,
    action: fixture.action,
    status: scan.status,
    findings: scan.findings,
    outcome: compareResult(fixture, { fixtureId: fixture.id, scanner: productScanner, ...scan }),
    firstRunOutcome: baseline ? compareResult(fixture, baseline) : null,
  };
}

export interface RerunSummary {
  fixtures: number;
  scannerFailed: number;
  meetsExpectation: { firstRun: number; candidate: number };
  /** Fixtures that failed their expectation in the first run and meet it now. */
  fixedSinceFirstRun: string[];
  /** Fixtures that met their expectation in the first run and fail it now. */
  regressedSinceFirstRun: string[];
  outcomes: { firstRun: Record<Outcome, number>; candidate: Record<Outcome, number> };
}

const emptyCounts = (): Record<Outcome, number> =>
  ({ redacted: 0, overbroad: 0, partial: 0, missed: 0, clean: 0, flagged: 0, 'scanner-failed': 0 });

export function summarizeRerun(results: readonly RerunResult[]): RerunSummary {
  const summary: RerunSummary = {
    fixtures: results.length,
    scannerFailed: 0,
    meetsExpectation: { firstRun: 0, candidate: 0 },
    fixedSinceFirstRun: [],
    regressedSinceFirstRun: [],
    outcomes: { firstRun: emptyCounts(), candidate: emptyCounts() },
  };
  for (const row of results) {
    summary.outcomes.candidate[row.outcome] += 1;
    if (row.outcome === 'scanner-failed') summary.scannerFailed += 1;
    const now = meetsExpectation(row.outcome);
    if (now) summary.meetsExpectation.candidate += 1;
    if (row.firstRunOutcome === null) continue;
    summary.outcomes.firstRun[row.firstRunOutcome] += 1;
    const before = meetsExpectation(row.firstRunOutcome);
    if (before) summary.meetsExpectation.firstRun += 1;
    if (!before && now) summary.fixedSinceFirstRun.push(row.fixtureId);
    if (before && !now) summary.regressedSinceFirstRun.push(row.fixtureId);
  }
  return summary;
}
