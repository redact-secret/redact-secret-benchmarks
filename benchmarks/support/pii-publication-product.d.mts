import type { PiiCandidateComparison } from '../evaluation/domains/pii/candidate-comparison.mjs';

export type PiiPublicationProductBinding =
  | { state: 'absent' | 'invalid' | 'other-product'; reason: string }
  | { state: 'matched'; sourceCommit: string; coreSha256: string; packageTreeSha256: string;
      engineCommit: string; protocol: { id: string; revision: number };
      populationDigests: Record<string, string>; supportClaims: false; qualified: false };

export function bindPiiPublicationProduct(comparison: PiiCandidateComparison, plan: unknown, receipt: unknown,
  product: { sourceCommit: string; coreSha256: string | null } | null): PiiPublicationProductBinding;
export function loadPiiPublicationProductBinding(root: string,
  product: { sourceCommit: string; coreSha256: string | null } | null): Promise<PiiPublicationProductBinding>;
