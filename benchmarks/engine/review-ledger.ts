export type ReviewStatus = 'open' | 'resolved' | 'not-assertable';

export interface HistoricalAdjudication {
  decidedAt: string;
  evidenceUrl: string;
  note: string;
  runId?: string;
}

export interface ResolutionEvidence {
  kind: 'run-observation' | 'historical-adjudication';
  observedAt: string;
  evidenceUrl?: string;
}

export interface ReviewOccurrence {
  id: string;
  caseId: string;
  sourceSlug: string;
  variant: string;
  peer?: string;
  disagreement?: string;
}

export interface ReviewLedgerEntry {
  status: ReviewStatus;
  firstSeenRun: string;
  lastSeenRun?: string;
  lastSeenAt?: string;
  lastSeenEvidence?: Omit<ReviewOccurrence, 'id'>;
  resolvedRun?: string;
  resolutionEvidence?: ResolutionEvidence;
  historicalAdjudication?: HistoricalAdjudication;
  note: string;
}

export interface ReviewLedger {
  schemaVersion: 2;
  /** Present on a generated publication artifact, absent on the checked-in source ledger. */
  observationRun?: { runId: string; observedAt: string };
  entries: Record<string, ReviewLedgerEntry>;
}

const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const run = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200;
const https = (value: unknown) => typeof value === 'string' && /^https:\/\//.test(value);

/** Validate the versioned source/public ledger without inventing legacy observation provenance. */
export function reviewLedgerProblem(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Review ledger is missing';
  const ledger = value as Partial<ReviewLedger>;
  if (ledger.schemaVersion !== 2 || !ledger.entries || typeof ledger.entries !== 'object' || Array.isArray(ledger.entries)) return 'Unsupported review ledger version';
  if (ledger.observationRun && (!run(ledger.observationRun.runId) || !date(ledger.observationRun.observedAt))) return 'Invalid review ledger observation run';
  for (const [id, entry] of Object.entries(ledger.entries)) {
    if (!/^[a-f0-9]{64}$/.test(id) || !entry || !['open', 'resolved', 'not-assertable'].includes(entry.status) || !run(entry.firstSeenRun) || typeof entry.note !== 'string' || !entry.note.trim()) return `Invalid review ledger entry ${id.slice(0, 12)}`;
    if ((entry.lastSeenRun === undefined) !== (entry.lastSeenAt === undefined)) return `Incomplete last observation for ${id.slice(0, 12)}`;
    if (entry.lastSeenRun !== undefined && (!run(entry.lastSeenRun) || !date(entry.lastSeenAt))) return `Invalid last observation for ${id.slice(0, 12)}`;
    if (entry.lastSeenEvidence && (!entry.lastSeenRun || !entry.lastSeenEvidence.caseId || !/^[a-z0-9-]+--[a-z0-9-]+$/.test(entry.lastSeenEvidence.sourceSlug) || !entry.lastSeenEvidence.variant)) return `Invalid last observation evidence for ${id.slice(0, 12)}`;
    // Legacy v1 rows sometimes retained a resolvedRun after reopening. It is trace data only;
    // v2 resolution proof is the validated resolutionEvidence field and is forbidden while open.
    if (entry.status !== 'resolved' && entry.resolutionEvidence !== undefined) return `Unresolved entry carries resolution evidence ${id.slice(0, 12)}`;
    if (entry.resolvedRun !== undefined && !run(entry.resolvedRun)) return `Invalid resolved run for ${id.slice(0, 12)}`;
    if (entry.resolutionEvidence) {
      const evidence = entry.resolutionEvidence;
      if (!['run-observation', 'historical-adjudication'].includes(evidence.kind) || !date(evidence.observedAt)) return `Invalid resolution evidence for ${id.slice(0, 12)}`;
      if (evidence.kind === 'run-observation' && (!entry.resolvedRun || entry.resolvedRun !== entry.lastSeenRun || evidence.observedAt !== entry.lastSeenAt)) return `Resolved run was not observed for ${id.slice(0, 12)}`;
      if (evidence.kind === 'historical-adjudication' && !https(evidence.evidenceUrl)) return `Historical resolution lacks evidence for ${id.slice(0, 12)}`;
    }
    if (entry.historicalAdjudication) {
      const adjudication = entry.historicalAdjudication;
      if (!date(adjudication.decidedAt) || !https(adjudication.evidenceUrl) || !adjudication.note.trim() || (adjudication.runId !== undefined && !run(adjudication.runId))) return `Invalid historical adjudication for ${id.slice(0, 12)}`;
    }
  }
  return null;
}

/** Update only entries actually carried by the validated discovery run. */
export function observeReviewEntries(ledger: ReviewLedger, occurrences: Iterable<ReviewOccurrence>, runId: string, observedAt: string): ReviewLedger {
  const problem = reviewLedgerProblem(ledger);
  if (problem) throw new Error(problem);
  if (!run(runId) || !date(observedAt)) throw new Error('Invalid review observation provenance');
  const rows = [...occurrences];
  const observed = new Map(rows.map(({ id, ...evidence }) => [id, evidence]));
  if (observed.size !== rows.length) throw new Error('Duplicate review occurrence');
  for (const id of observed.keys()) if (!Object.hasOwn(ledger.entries, id)) throw new Error(`Observed review entry is absent from the ledger: ${id.slice(0, 12)}`);
  const entries = Object.fromEntries(Object.entries(ledger.entries).map(([id, entry]) => [id, observed.has(id) ? { ...entry, lastSeenRun: runId, lastSeenAt: observedAt, lastSeenEvidence: observed.get(id) } : entry]));
  return { schemaVersion: 2, observationRun: { runId, observedAt }, entries };
}

/** A previous publication may contribute last-seen data, but never decisions or text. */
export function carryReviewHistory(source: ReviewLedger, previous: ReviewLedger | null): ReviewLedger {
  if (!previous || reviewLedgerProblem(previous)) return source;
  const entries = Object.fromEntries(Object.entries(source.entries).map(([id, entry]) => {
    const old = previous.entries[id];
    if (!old?.lastSeenAt || (entry.lastSeenAt && Date.parse(entry.lastSeenAt) >= Date.parse(old.lastSeenAt))) return [id, entry];
    return [id, { ...entry, lastSeenRun: old.lastSeenRun, lastSeenAt: old.lastSeenAt, ...(old.lastSeenEvidence ? { lastSeenEvidence: old.lastSeenEvidence } : {}) }];
  }));
  return { ...source, entries };
}
