export interface ReviewStateLedger {
  entries: Record<string, { status: 'open' | 'resolved' | 'not-assertable'; firstSeenRun: string }>;
}

/** Reduce a queue against an immutable ledger without interpreting why an entry exists. */
export function reviewState(queue: { id: string }[], ledger: ReviewStateLedger) {
  const state = { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null as string | null };
  const field = { open: 'open', resolved: 'resolved', 'not-assertable': 'notAssertable' } as const;
  for (const { id } of queue) {
    const row = Object.hasOwn(ledger.entries, id) ? ledger.entries[id] : undefined;
    state[row ? field[row.status] : 'unknown']++;
    if (row?.status === 'open' && (state.oldestOpenRun === null || row.firstSeenRun < state.oldestOpenRun)) state.oldestOpenRun = row.firstSeenRun;
  }
  return state;
}
