/**
 * Maintainer-accepted PII profile-cost tradeoffs (benchmarks #428).
 *
 * The #143 ledger (`benchmarks/accepted-regressions.json`) accepts one #143 budget trigger for one candidate commit.
 * The #286 profile-cost cells (PII on against PII off in the same artifact, per surface, profile, workload and metric)
 * and the profile-cost size rows that have no #143 trigger are not #143 triggers, so that ledger cannot name them.
 * `benchmarks/accepted-pii-profile-cost.json` is the sibling ledger for them, with the same conventions: one entry
 * per candidate commit, the original measurement retained for every accepted cell and row, a rationale, a linked
 * detection or safety benefit, and who decided when. An entry also binds the exact official runs it was decided on
 * (plan commitment, candidate and size run ids and report commitments), so it never covers another run or commit.
 *
 * The frozen #428 report is never rescored with this ledger: its `profile-cost` gate keeps the measured `not-met`.
 * `b11ProfileCostAcceptance` reads that gate and this ledger and says whether every failing cell and open size row
 * is covered. The protected-partition route (`beta11-protected.ts`) then treats `profile-cost` as met by accepted
 * tradeoff. Anything uncovered, including a cell the entry lists as excluded, leaves the gate not-met.
 */
import ledgerData from '../../../accepted-pii-profile-cost.json' with { type: 'json' };
import { hash } from '../../substrate/hash.ts';

export interface PiiProfileCostAcceptedCell {
  readonly key: string; readonly metric: string; readonly verdict: 'regression' | 'invalid-measurement';
  readonly measured: Readonly<Record<string, number>>;
}
export interface PiiProfileCostAcceptedSizeRow { readonly key: string; readonly deltaBytes: number }
export interface PiiProfileCostExcludedCell { readonly key: string; readonly metric: string; readonly reason: string }
export interface PiiProfileCostAcceptance {
  readonly id: string;
  readonly candidate: { readonly sourceCommit: string };
  readonly plan: { readonly id: 'pii-profile-cost-v2'; readonly contentCommitment: string };
  readonly runs: {
    readonly candidate: { readonly runId: string; readonly reportCommitment: string };
    readonly size: { readonly runId: string; readonly reportCommitment: string };
    readonly notUsed: readonly string[];
  };
  readonly cells: readonly PiiProfileCostAcceptedCell[];
  readonly sizeRows: readonly PiiProfileCostAcceptedSizeRow[];
  readonly excluded: readonly PiiProfileCostExcludedCell[];
  readonly rationale: string;
  readonly benefit: { readonly kind: 'detection' | 'safety'; readonly summary: string; readonly links: readonly string[] };
  readonly decidedAt: string;
  readonly decidedBy: string;
}

export const piiProfileCostAcceptances: readonly PiiProfileCostAcceptance[] = Object.freeze(structuredClone(ledgerData as unknown) as PiiProfileCostAcceptance[]);

const SHA = /^[0-9a-f]{40}$/, DIGEST = /^[0-9a-f]{64}$/, DATE = /^\d{4}-\d{2}-\d{2}$/, RUN = /^\d+$/;
const BENEFIT_LINK = /^https:\/\/github\.com\/redact-secret\/[A-Za-z0-9_.-]+\/(issues|pull)\/\d+$/;
const cellId = (row: { key: string; metric: string }) => `${row.key}/${row.metric}`;

/** Schema problems of the ledger, in the #143 `ledgerProblems` style. Empty means valid. */
export function piiProfileCostAcceptanceProblems(ledger: readonly PiiProfileCostAcceptance[] = piiProfileCostAcceptances): string[] {
  const problems: string[] = [];
  const ids = new Set<string>(), commits = new Set<string>();
  for (const entry of ledger as any[]) {
    const at = `accepted-pii-profile-cost ${entry?.id ?? '(no id)'}`;
    if (!entry?.id || ids.has(entry.id)) problems.push(`${at}: id missing or repeated`);
    ids.add(entry?.id);
    if (!SHA.test(entry?.candidate?.sourceCommit ?? '')) problems.push(`${at}: candidate.sourceCommit must be a 40-hex commit`);
    else if (commits.has(entry.candidate.sourceCommit)) problems.push(`${at}: one entry per candidate commit`);
    commits.add(entry?.candidate?.sourceCommit);
    if (entry?.plan?.id !== 'pii-profile-cost-v2' || !DIGEST.test(entry?.plan?.contentCommitment ?? '')) problems.push(`${at}: plan must name pii-profile-cost-v2 and its content commitment`);
    for (const run of ['candidate', 'size'] as const)
      if (!RUN.test(entry?.runs?.[run]?.runId ?? '') || !DIGEST.test(entry?.runs?.[run]?.reportCommitment ?? '')) problems.push(`${at}: runs.${run} must bind a run id and its report commitment`);
    if (!Array.isArray(entry?.runs?.notUsed) || !entry.runs.notUsed.every((id: unknown) => typeof id === 'string' && RUN.test(id))) problems.push(`${at}: runs.notUsed must list run ids`);
    const cells = Array.isArray(entry?.cells) ? entry.cells : [];
    if (!cells.length && !(entry?.sizeRows ?? []).length) problems.push(`${at}: accepts nothing`);
    const seen = new Set<string>();
    for (const cell of cells) {
      if (typeof cell?.key !== 'string' || typeof cell?.metric !== 'string' || !['regression', 'invalid-measurement'].includes(cell?.verdict) ||
          !cell?.measured || typeof cell.measured !== 'object' || !Object.values(cell.measured).length ||
          !Object.values(cell.measured).every(value => typeof value === 'number' && Number.isFinite(value)))
        problems.push(`${at}: cell ${cell?.key ?? '?'}/${cell?.metric ?? '?'} must keep key, metric, verdict and its original measurement`);
      else if (seen.has(cellId(cell))) problems.push(`${at}: cell ${cellId(cell)} repeated`);
      else seen.add(cellId(cell));
    }
    const sizeSeen = new Set<string>();
    for (const row of entry?.sizeRows ?? []) {
      if (typeof row?.key !== 'string' || !Number.isInteger(row?.deltaBytes)) problems.push(`${at}: size row ${row?.key ?? '?'} must keep key and deltaBytes`);
      else if (sizeSeen.has(row.key)) problems.push(`${at}: size row ${row.key} repeated`);
      else sizeSeen.add(row.key);
    }
    for (const row of entry?.excluded ?? []) {
      if (typeof row?.key !== 'string' || typeof row?.metric !== 'string' || typeof row?.reason !== 'string' || row.reason.length < 20)
        problems.push(`${at}: excluded cell ${row?.key ?? '?'} must name key, metric and a reason`);
      else if (seen.has(cellId(row))) problems.push(`${at}: cell ${cellId(row)} is both accepted and excluded`);
    }
    if (!Array.isArray(entry?.excluded)) problems.push(`${at}: excluded must be a list (empty when nothing is excluded)`);
    if (typeof entry?.rationale !== 'string' || entry.rationale.trim().length < 40) problems.push(`${at}: rationale must explain the tradeoff (40 characters or more)`);
    if (!['detection', 'safety'].includes(entry?.benefit?.kind) || !entry?.benefit?.summary) problems.push(`${at}: benefit must name a detection or safety gain`);
    if (!Array.isArray(entry?.benefit?.links) || !entry.benefit.links.length || !entry.benefit.links.every((link: string) => BENEFIT_LINK.test(link)))
      problems.push(`${at}: benefit.links must link at least one redact-secret issue or pull request`);
    if (!DATE.test(entry?.decidedAt ?? '') || !entry?.decidedBy) problems.push(`${at}: decidedAt and decidedBy are required`);
  }
  return problems;
}

/** The failing measured cells and open size rows of an official profile-cost binding, as the ledger names them. */
export function piiProfileCostOpenItems(profileCost: { candidate: any; size: any }, profileCostGate: any) {
  const cells = (profileCost.candidate.evaluation as any[]).filter(row => row.verdict === 'regression' || row.verdict === 'invalid-measurement');
  const sizeRows = ((profileCostGate?.evidence?.sizeRows ?? []) as any[]).filter(row => !row.acceptedBy);
  return { cells, sizeRows };
}

const measuredOf = (row: any): Record<string, number> => Object.fromEntries(Object.entries(row as Record<string, unknown>)
  .filter((entry): entry is [string, number] => !['key', 'metric', 'verdict', 'reasonCode'].includes(entry[0]) && typeof entry[1] === 'number'));

/** Build the ledger's `cells` and `sizeRows` from an official binding (used to author an entry; never to decide one). */
export function piiProfileCostAcceptanceItems(profileCost: { candidate: any; size: any }, profileCostGate: any, excluded: readonly PiiProfileCostExcludedCell[] = []) {
  const skip = new Set(excluded.map(cellId));
  const open = piiProfileCostOpenItems(profileCost, profileCostGate);
  return {
    cells: open.cells.filter(row => !skip.has(cellId(row))).map(row => ({ key: row.key, metric: row.metric, verdict: row.verdict, measured: measuredOf(row) })),
    sizeRows: open.sizeRows.map(row => ({ key: row.key, deltaBytes: row.deltaBytes })),
  };
}

/**
 * Whether a maintainer acceptance covers the whole `profile-cost` gate of one #428 report. `status` is `accepted`
 * only when an entry for exactly this commit binds exactly these official reports and names every failing cell (with
 * its original verdict and measurement) and every open size row; `none` when the gate is not `not-met` or no entry
 * exists; otherwise `not-covered` with what is missing.
 */
export function b11ProfileCostAcceptance(input: { report: any; profileCost: { runs: any; candidate: any; size: any } | null;
  ledger?: readonly PiiProfileCostAcceptance[] }) {
  const ledger = input.ledger ?? piiProfileCostAcceptances;
  const sourceCommit = input.report?.candidate?.sourceCommit as string;
  const gates = (input.report?.families ?? []).map((row: any) => row.gates.find((gate: any) => gate.id === 'profile-cost'));
  const gate = gates[0];
  if (!gate || gates.some((other: any) => JSON.stringify(other) !== JSON.stringify(gate))) throw new Error('profile-cost gate is not one shared gate');
  const base = { sourceCommit, reportCommitment: input.report.artifactCommitment as string };
  if (gate.status !== 'not-met') return { ...base, status: 'none' as const, reason: `profile-cost is ${gate.status}` };
  const entry = ledger.find(row => row.candidate.sourceCommit === sourceCommit);
  if (!entry) return { ...base, status: 'none' as const, reason: 'no accepted-pii-profile-cost entry for this commit' };
  const problems = piiProfileCostAcceptanceProblems([entry]);
  const missing: string[] = [];
  const profileCost = input.profileCost;
  if (!profileCost) missing.push('official profile-cost evidence is not bound next to the freeze');
  else {
    const { candidate, size } = profileCost;
    if (candidate.sourceCommit !== sourceCommit || size.comparison?.sourceCommit !== sourceCommit) missing.push('profile-cost reports bind another commit');
    if (entry.plan.contentCommitment !== candidate.planCommitment || entry.plan.contentCommitment !== size.planCommitment) missing.push('plan commitment differs');
    if (entry.runs.candidate.runId !== String(candidate.runId) || entry.runs.candidate.reportCommitment !== candidate.artifactCommitment) missing.push('candidate run differs');
    if (entry.runs.size.reportCommitment !== size.artifactCommitment || !(profileCost.runs?.runs ?? []).some((row: any) => row.phase === 'size' && row.runId === entry.runs.size.runId))
      missing.push('size run differs');
    const open = piiProfileCostOpenItems(profileCost, gate);
    const accepted = new Map(entry.cells.map(row => [cellId(row), row]));
    for (const row of open.cells) {
      const listed = accepted.get(cellId(row));
      if (!listed) missing.push(`cell ${cellId(row)} (${row.verdict})`);
      else if (listed.verdict !== row.verdict || JSON.stringify(listed.measured) !== JSON.stringify(measuredOf(row))) missing.push(`cell ${cellId(row)} measurement differs`);
    }
    const acceptedRows = new Map(entry.sizeRows.map(row => [row.key, row]));
    for (const row of open.sizeRows) {
      const listed = acceptedRows.get(row.key);
      if (!listed) missing.push(`size row ${row.key}`);
      else if (listed.deltaBytes !== row.deltaBytes) missing.push(`size row ${row.key} measurement differs`);
    }
  }
  const status = !problems.length && !missing.length ? 'accepted' as const : 'not-covered' as const;
  return { ...base, status, acceptedBy: entry.id, entryCommitment: hash(JSON.stringify(entry)),
    accepted: { cells: entry.cells.length, sizeRows: entry.sizeRows.length }, excluded: entry.excluded.map(row => ({ cell: cellId(row), reason: row.reason })),
    uncovered: [...problems, ...missing] };
}
