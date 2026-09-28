// Shared citations for the Beta.11 #434 slices (benchmarks/lib/beta8/434a.ts–434g.ts).
//
// The contracts are authored from the step-3 handoffs of redact-secret#860, frozen in the product
// repository at 270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262 (docs/audits/evidence/860/<family>.md), and
// from the provider sources those handoffs cite. They are not read from, or checked against, the
// product detector code (redact-secret#903–#909), so the corpus stays an independent measurement.

export const HANDOFF_REVISION = '270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262';
export const handoff = (file: string) => `https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/860/${file}`;
export const HANDOFF_INDEX = handoff('README.md');
export const R860 = 'https://github.com/redact-secret/redact-secret/issues/860';
/** Maintainer rulings R1 (provider generator/validator code and tests are T1) and R3 (a dated provider-staff statement is T1). */
export const RULINGS_R1_R3 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851';
/** Maintainer rulings R2, R4–R8 (R6: a code comment is T2; R7: JWT-only credentials stay jwt; R8: no alphabet narrowing from a third-party library). */
export const RULINGS_R2_R8 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275';
export const B434 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/434';
export const product = (n: number) => `https://github.com/redact-secret/redact-secret/issues/${n}`;

export const at = '2026-09-28';
export const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

/** The product main commit the registry is pinned to when the #434/#436 detector-id families graduate: redact-secret PR #938 added the detectors (#903–#909, #912–#917), PR #947 followed. */
export const REGISTRY_PIN = '1127bf91323797be89b4413c8051f9a9a85da43b';

/** The reason for a sibling type that stays an arrival family after the re-pin, scored by its own finding type. */
export const scoredReason = (detector: string, findingType: string, issue: number, note = '') =>
  `The product types this family inside the shared ${detector} detector as ${findingType} since redact-secret#${issue} (registry pinned at ${REGISTRY_PIN.slice(0, 7)}), so it stays an arrival family scored by its finding type (scanners/families.mjs arrivalFindingTypes, docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md).${note ? ` ${note}` : ''}`;

type Contracts = Record<string, import('../../types.ts').FormatContract>;
/** Split a slice's authored contracts: `graduated` ids become registry contracts at the re-pin, the rest stay arrival contracts. */
export function splitGraduated(authored: Contracts, graduated: string[], note = `Graduated to a registry detector at the ${REGISTRY_PIN.slice(0, 7)} re-pin (redact-secret PR #938).`) {
  for (const id of graduated) if (!Object.hasOwn(authored, id)) throw new Error(`no authored contract for ${id}`);
  const registryContracts: Contracts = {}, contracts: Contracts = {};
  for (const [id, c] of Object.entries(authored))
    if (graduated.includes(id)) registryContracts[id] = { ...c, review: c.review ? `${c.review} ${note}` : note };
    else contracts[id] = c;
  return { registryContracts, contracts };
}
