// Shared citations for the Beta.12 #1012 slices (benchmarks/lib/beta8/1012a.ts–1012e.ts): the credential variants the
// product first ships at 4fb7882 without a benchmarks contract (redact-secret#1012 READY-T1/T2 research and the #1013
// Vercel record): the AWS IAM secret access key, the Google OAuth client secret, the routable GitLab personal access
// token, the AWS STS temporary access key id (ASIA) and the three READY Vercel token classes (vcp_, vca_, vcr_).
//
// The contracts are authored from the research records frozen in the product repository at
// 4fb78827f1ddf5b3106f25130ca510a836ada186 (docs/audits/evidence/1012/<family>.md and docs/audits/evidence/1013/vercel.md)
// and from the provider sources those records cite. They are not read from, or checked against, the product detector
// code (redact-secret#1022, #1027, #1028, #1029, #1036), so the corpus stays an independent measurement.
//
// Each contract separates what a provider source states (T1) from peer and example corroboration (T2) and from what the
// research record sets as project policy. A policy part is a `policy-*` field whose basis is `research-hypothesis` and
// whose claim starts `POLICY`, never a provider fact.

export const EVIDENCE_REVISION = '4fb78827f1ddf5b3106f25130ca510a836ada186';
export const evidence = (file: string) => `https://github.com/redact-secret/redact-secret/blob/${EVIDENCE_REVISION}/docs/audits/evidence/${file}`;
export const research = (file: string) => evidence(`1012/${file}`);
export const RESEARCH_INDEX = research('README.md');
export const VERCEL_RECORD = evidence('1013/vercel.md');
export const VERCEL_INDEX = evidence('1013/README.md');
export const R1012 = 'https://github.com/redact-secret/redact-secret/issues/1012';
export const R1013 = 'https://github.com/redact-secret/redact-secret/issues/1013';
/** Maintainer rulings R1 (provider generator/validator code is T1) and R3 (a dated provider-staff statement is T1). */
export const RULINGS_R1_R3 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851';
/** Maintainer rulings R2 (a provider-authored scanner rule may be T1; not applied here), R4, R5 (a provider example fixes an example shape), R8 (never narrow from a third-party rule). */
export const RULINGS_R2_R8 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275';
/** Maintainer ruling R9 (provider code is T1 as of its date). */
export const RULINGS_R9_R10 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337';
export const B528 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/528';
export const product = (n: number) => `https://github.com/redact-secret/redact-secret/issues/${n}`;

export const at = '2026-09-29';
export const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

export const TRUFFLEHOG_DETECTORS = 'https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors';
export const GITLEAKS_CONFIG = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml';

/** The product main commit these contracts are first measured against: redact-secret PR #1039 (merge 4fb7882). */
export const REGISTRY_PIN = EVIDENCE_REVISION;

/** Why an unmapped arrival family stays unscored: the product reports it under the owning detector's own finding type. */
export const unscoredReason = (detector: string, findingType: string, issue: number, note = '') =>
  `The product claims this family inside the ${detector} detector under that detector's own finding type ${findingType} since redact-secret#${issue} (registry pinned at ${REGISTRY_PIN.slice(0, 7)}), so its findings carry the detector id and no evidence of their own: it stays an unscored arrival family (docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md, point 4).${note ? ` ${note}` : ''}`;

/** The reason for a family the product types inside a shared detector under its own finding type, scored by that type. */
export const scoredReason = (detector: string, findingType: string, issue: number, note = '') =>
  `The product types this family inside the shared ${detector} detector as ${findingType} since redact-secret#${issue} (registry pinned at ${REGISTRY_PIN.slice(0, 7)}), so it is an arrival family scored by its finding type (scanners/families.mjs arrivalFindingTypes, docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md).${note ? ` ${note}` : ''}`;
