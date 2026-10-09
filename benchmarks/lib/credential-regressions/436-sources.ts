// Shared citations for the Beta.11 #436 slices (benchmarks/lib/credential-regressions/436a.ts–436f.ts), the #860 Tier B
// READY credential families.
//
// The contracts are authored from the step-3 handoffs of redact-secret#860, frozen in the product
// repository at 54fe385f718c884d7e3dde6b9756e2d70999ca91 (docs/audits/evidence/860/<family>.md), and
// from the provider sources those handoffs cite. They are not read from, or checked against, the
// product detector code (redact-secret#912–#917), so the corpus stays an independent measurement.

export const HANDOFF_REVISION = '54fe385f718c884d7e3dde6b9756e2d70999ca91';
export const handoff = (file: string) => `https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/860/${file}`;
/** The Tier B re-rank: the nine-context probe of `main` and the shared contract rules. */
export const RERANK = handoff('tier-b-rerank.md');
export const R860 = 'https://github.com/redact-secret/redact-secret/issues/860';
/** Maintainer rulings R1 (provider generator/validator code and tests are T1) and R3 (a dated provider-staff statement is T1). */
export const RULINGS_R1_R3 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851';
/** Maintainer rulings R2 (a provider-authored leak rule is T1), R4 (a truncated example or placeholder is T1 for its prefix only), R5 (a provider test fixture weighs like a docs example), R6 (a code comment is T2; a runtime startsWith is T1), R8 (no alphabet narrowing from absence). */
export const RULINGS_R2_R8 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275';
export const B436 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/436';
export const product = (n: number) => `https://github.com/redact-secret/redact-secret/issues/${n}`;

export const at = '2026-09-28';
export const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

export { REGISTRY_PIN, splitGraduated } from './434-sources.ts';
