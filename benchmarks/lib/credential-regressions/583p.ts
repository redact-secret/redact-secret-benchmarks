import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';

// Registry intake only. Full reviewed contracts and dedicated corpora remain follow-up work.
export const issue = '583p';
const revision = '5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf';
const observedAt = '2026-10-08';
const pending = (id: string, source: string, productIssue: number, followup: string): FormatContract => {
  const status = `detector present in the registry, reviewed benchmark contract/corpus pending (${followup})`;
  const references = [source, `https://github.com/redact-secret/redact-secret/issues/${productIssue}`];
  return {
    tier: 'T3', contextGated: true, references,
    candidateSource: provider(source, 'Adopted upstream research handoff; registry intake only', 'no reviewed benchmark grammar yet', observedAt),
    review: `${status}. Core ${revision} registers ${id}, but the published beta.14 package does not contain it. Synthetic coverage records project policy only; it makes no provider-format or support claim.`,
    unprobeable: { reason: `${status}: no reviewed benchmark grammar is asserted or mutated by this intake`, observedAt },
    fields: [field({ field: 'status', claim: status, basis: 'research-hypothesis', status: 'unresolved', sources: [{ url: source, observedAt }], note: 'Registry presence is separate from reviewed corpus coverage and measured support.' })],
  };
};
export const arrivalFamilies: ArrivalFamily[] = [];
export const contracts: Record<string, FormatContract> = {};
export const profiles: Record<string, FixtureProfile> = {};
export const registryContracts: Record<string, FormatContract> = {
  'ory-token': pending('ory-token', 'https://github.com/redact-secret/redact-secret/blob/5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf/docs/audits/evidence/1110/README.md', 1110, '#827'),
  'baseten-api-key': pending('baseten-api-key', 'https://github.com/redact-secret/redact-secret/blob/5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf/docs/audits/evidence/1111/README.md', 1111, 'core #1111 independent benchmark intake'),
};
