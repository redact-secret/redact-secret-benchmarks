/**
 * Action-split accounting for the untargeted `real-world-shapes` corpus (#95, #378).
 *
 * Pure functions over a `bench` category report. File-level unit: one control is
 * one file; it is `flagged` when the scanner returned any finding. A flagged file
 * is `gating` when at least one finding carried `redact` or `block`, `warnOnly`
 * when every finding carried a non-gating action (`warn`/`allow`), and
 * `actionUnknown` when the scanner reports no action (the peers). This mirrors the
 * Workbench method page (src/pages/workbench/method.ts) and
 * docs/decisions/2026-09-21-add-untargeted-benign-corpus.md Decision 3; it never
 * redefines `falseAlarmRate`. Offsets, families and actions only — no matched text.
 */

export const GATING_ACTIONS: ReadonlySet<string> = new Set(['redact', 'block']);

interface Finding { start: number; end: number; family?: string; action?: string }
interface Row { id: string; group: string; kind?: string; flagged?: boolean; findings?: number; actionCounts?: Record<string, number>; actual?: Finding[] }
interface ScannerResult { id: string; version?: string | null; mode?: string; status?: string; rows?: Row[] }
export interface CategoryReport { runId?: string; revision?: string; dirty?: boolean | null; corpusHash?: string; lockHash?: string; fixtureCount?: number; candidate?: { sourceCommit: string; packageName?: string; declaredVersion?: string }; scanners: ScannerResult[] }
export interface FrozenManifest { id: string; digest: string; fixtures: { id: string }[] }

export interface SubsetSplit {
  controls: number; clean: number; flagged: number; gating: number; warnOnly: number; actionUnknown: number;
  findingsByAction: Record<string, number>;
  flaggedFixtures: { id: string; group: string; findings: number; actionCounts: Record<string, number> | null; families: string[] }[];
}

export function splitRows(rows: Row[]): SubsetSplit {
  const out: SubsetSplit = { controls: 0, clean: 0, flagged: 0, gating: 0, warnOnly: 0, actionUnknown: 0, findingsByAction: {}, flaggedFixtures: [] };
  for (const row of rows) {
    out.controls++;
    if (!row.flagged) { out.clean++; continue; }
    out.flagged++;
    const actions = row.actionCounts && Object.keys(row.actionCounts).length ? row.actionCounts : null;
    if (!actions) out.actionUnknown++;
    else if (Object.keys(actions).some(a => GATING_ACTIONS.has(a))) out.gating++;
    else out.warnOnly++;
    for (const [a, n] of Object.entries(actions ?? {})) out.findingsByAction[a] = (out.findingsByAction[a] ?? 0) + n;
    out.flaggedFixtures.push({ id: row.id, group: row.group, findings: row.findings ?? row.actual?.length ?? 0, actionCounts: actions,
      families: [...new Set((row.actual ?? []).map(f => f.family ?? 'unattributed'))].sort() });
  }
  return out;
}

export function summarizeActionSplit(report: CategoryReport, frozen: FrozenManifest) {
  const frozenIds = new Set(frozen.fixtures.map(f => f.id));
  return {
    label: report.candidate ? `candidate ${report.candidate.sourceCommit.slice(0, 12)}` : 'published',
    mode: report.candidate ? 'candidate' : 'published',
    identity: { runId: report.runId ?? null, benchmarkRevision: report.revision ?? null, benchmarkDirty: report.dirty ?? null,
      corpusHash: report.corpusHash ?? null, lockHash: report.lockHash ?? null, fixtureCount: report.fixtureCount ?? null, candidate: report.candidate ?? null },
    scanners: report.scanners.filter(s => Array.isArray(s.rows)).map(s => {
      const rows = s.rows!.filter(r => r.kind === 'must-not-flag');
      return { id: s.id, version: s.version ?? null, mode: s.mode ?? null, status: s.status ?? null,
        subsets: { frozen: splitRows(rows.filter(r => frozenIds.has(r.id))), added: splitRows(rows.filter(r => !frozenIds.has(r.id))), full: splitRows(rows) } };
    }),
  };
}

type Summary = ReturnType<typeof summarizeActionSplit>;
const classOf = (f: SubsetSplit['flaggedFixtures'][number] | undefined) => !f ? 'clean' : !f.actionCounts ? 'flagged-action-unknown' : Object.keys(f.actionCounts).some(a => GATING_ACTIONS.has(a)) ? 'gating' : 'warn-only';
const rank: Record<string, number> = { clean: 0, 'warn-only': 1, 'flagged-action-unknown': 1, gating: 2 };

/** Per-fixture movement between the baseline and the candidate for the same scanner id: regressions and improvements by action class. */
export function compareActionSplit(baseline: Summary, candidate: Summary) {
  return candidate.scanners.flatMap(c => {
    const b = baseline.scanners.find(s => s.id === c.id);
    if (!b) return [];
    const before = new Map(b.subsets.full.flaggedFixtures.map(f => [f.id, f])), after = new Map(c.subsets.full.flaggedFixtures.map(f => [f.id, f]));
    const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
    const moves = ids.map(id => ({ id, before: classOf(before.get(id)), after: classOf(after.get(id)) })).filter(m => m.before !== m.after);
    return [{ scanner: c.id, regressions: moves.filter(m => rank[m.after] > rank[m.before]), improvements: moves.filter(m => rank[m.after] < rank[m.before]),
      reclassified: moves.filter(m => rank[m.after] === rank[m.before]) }];
  });
}
