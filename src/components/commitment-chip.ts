import { escapeHtml } from './html';

/**
 * CommitmentChip: a SHA-256 commitment the page recomputed before rendering.
 * It is a precondition, not a status, so it takes no status colour: a neutral
 * border and a check when it matched. A commitment with nothing to bind reads
 * as absent (dashed), never as a pass. A mismatch never reaches this chip; the
 * whole page is replaced by an empty state instead.
 */
export interface CommitmentChipInput { label: string; commitment: string | null; note?: string }

const short = (hash: string) => `${hash.slice(0, 4)}…${hash.slice(-4)}`;

export function commitmentChip({ label, commitment, note }: CommitmentChipInput): string {
  if (commitment !== null && !/^[a-f0-9]{64}$/.test(commitment)) throw new Error('CommitmentChip shows only a SHA-256 hex commitment');
  if (commitment === null)
    return `<span class="commit absent"><b>${escapeHtml(label)}</b> <span>${escapeHtml(note ?? 'Not measured')}</span></span>`;
  return `<span class="commit" title="${escapeHtml(commitment)}"><b>${escapeHtml(label)}</b> <code>${short(commitment)}</code> <span>✓ ${escapeHtml(note ?? 'Recomputed')}</span></span>`;
}
