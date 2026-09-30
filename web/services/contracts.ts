/**
 * The format evidence behind each detector: its evidence tier and the sources the
 * contract cites, from `benchmarks/lib/assessment.ts` (the same `contracts` the
 * existing detector page reads). The web shows these as recorded; nothing is
 * derived. A detector with no contract has no entry, and its page says so.
 */
import { contracts } from '../../benchmarks/lib/assessment';
import { once } from './repo';

export interface ContractSource { href: string; label: string; note?: string }

export interface DetectorContract {
  /** `T1`, `T2`, ... as the contract records it. */
  tier?: string;
  sources: ContractSource[];
  review?: string;
  companion?: string;
  /** Why no negative twin can be authored, when the contract says so. */
  unprobeable?: { reason: string; observedAt: string };
}

interface Cited { url: string; formatVersion: string; observedAt: string; covers: string }
interface Raw {
  tier?: string;
  providerSource?: Cited;
  candidateSource?: { url: string };
  corroboration?: { url: string; tool: string }[];
  references?: string[];
  twinSource?: Cited;
  review?: string;
  companion?: string;
  unprobeable?: { reason: string; observedAt: string };
}

const citedNote = (s: Cited): string => `${s.formatVersion} · observed ${s.observedAt} · ${s.covers}`;

export function loadDetectorContracts(): Promise<Map<string, DetectorContract>> {
  return once('detector-contracts', async () => {
    const out = new Map<string, DetectorContract>();
    for (const [id, value] of Object.entries(contracts as unknown as Record<string, Raw>)) {
      const sources: ContractSource[] = [
        ...(value.providerSource ? [{ href: value.providerSource.url, label: 'Provider documentation', note: citedNote(value.providerSource) }] : []),
        ...(value.candidateSource ? [{ href: value.candidateSource.url, label: 'Provider, prefix only' }] : []),
        ...(value.corroboration ?? []).map(s => ({ href: s.url, label: s.tool })),
        ...(value.references ?? []).map((href, i) => ({ href, label: `Reference ${i + 1}` })),
        ...(value.twinSource ? [{ href: value.twinSource.url, label: 'Twin source', note: citedNote(value.twinSource) }] : []),
      ];
      out.set(id, {
        ...(value.tier ? { tier: value.tier } : {}),
        sources,
        ...(value.review ? { review: value.review } : {}),
        ...(value.companion ? { companion: value.companion } : {}),
        ...(value.unprobeable ? { unprobeable: value.unprobeable } : {}),
      });
    }
    return out;
  });
}
