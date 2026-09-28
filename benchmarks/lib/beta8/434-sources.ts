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

/** The shared reason for a #434 arrival family: no registry detector exists at the pinned product revision. */
export const reason = (detector: string, findingType: string, issue: number, note = '') =>
  `No registry detector covers this family at the pinned product revision. redact-secret#${issue} adds a new ${detector} detector that reports it as ${findingType} (handoff ${HANDOFF_REVISION.slice(0, 7)}); until that detector is in the pinned registry the family is measured as an unscored arrival family.${note ? ` ${note}` : ''}`;
