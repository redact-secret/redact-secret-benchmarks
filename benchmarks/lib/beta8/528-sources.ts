// Shared citations for the Beta.12 #528 slices (benchmarks/lib/beta8/528a.ts–528j.ts), the ten #1014 broad-discovery
// READY credential families: Bitwarden Secrets Manager, Polar, SonarQube, RubyGems.org, Clojars, crates.io, Dynatrace,
// Paddle, Honeycomb (ingest keys) and Axiom.
//
// The contracts are authored from the step-3 handoffs of redact-secret#1014, frozen in the product repository at
// 4f220ea000b58fa2e0e431ad88dea4eccb393fb0 (docs/audits/evidence/1014/<family>.md), and from the provider sources those
// handoffs cite. They are not read from, or checked against, the product detector code (redact-secret#1019–#1035), so
// the corpus stays an independent measurement.
//
// Each contract separates what a provider source states (T1) from what the handoff or a standing product decision sets
// as project policy. A policy part is a `policy-*` field whose basis is `research-hypothesis` and whose claim starts
// `POLICY`, never a provider fact. The one policy the ten share is the checksum rule: where a provider token carries an
// offline-checkable checksum (Polar polar_oat_, crates.io cio_tp_), the checksum corroborates only and never rejects a
// shape-valid match (ruling question Q1 in the handoff index is open; the security-first standing decision applies).

import { splitGraduated as split434 } from './434-sources.ts';

export const HANDOFF_REVISION = '4f220ea000b58fa2e0e431ad88dea4eccb393fb0';
export const handoff = (file: string) => `https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/1014/${file}`;
export const HANDOFF_INDEX = handoff('README.md');
/** The ruling questions Q1–Q6 the #1014 handoffs raise (Q1: checksum post-checks; Q5: documented-public siblings). */
export const RULING_QUESTIONS = `${HANDOFF_INDEX}#ruling-questions-for-the-maintainer`;
export const R1014 = 'https://github.com/redact-secret/redact-secret/issues/1014';
/** The #1014 step-1 research tables, one issue comment per batch of candidates. */
export const researchTable = (comment: string) => `${R1014}#issuecomment-${comment}`;
/** Maintainer rulings R1 (provider generator/validator code and tests are T1) and R3 (a dated provider-staff statement is T1). */
export const RULINGS_R1_R3 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851';
/** Maintainer rulings R2, R4 (a placeholder is T1 for its prefix only), R5 (a docs example plus SDK fixtures fix length and alphabet), R6 (a runtime startsWith check fixes the prefix), R8. */
export const RULINGS_R2_R8 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275';
/** Maintainer rulings R9 (provider code is T1 as of its date) and R10 (project policy may fill a partly stated grammar). */
export const RULINGS_R9_R10 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337';
export const B528 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/528';
export const product = (n: number) => `https://github.com/redact-secret/redact-secret/issues/${n}`;

export const at = '2026-09-29';
export const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

export const TRUFFLEHOG_DETECTORS = 'https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors';
export const GITLEAKS_CONFIG = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml';

/** The shared reason for a #528 arrival family: no registry detector exists at the pinned product revision. */
export const reason = (detector: string, findingType: string, issue: number, note = '') =>
  `No registry detector covers this family at the pinned product revision. redact-secret#${issue} adds a new ${detector} detector that reports it as ${findingType} (handoff ${HANDOFF_REVISION.slice(0, 7)}; the detector is on an unmerged product branch and in no released artifact); until that detector is in the pinned registry the family is measured as an unscored arrival family.${note ? ` ${note}` : ''}`;

export const GRADUATES = 'The detector id is also this family\'s arrival id, so it graduates when the registry is re-pinned.';
export const byFindingType = (prefix: string, detector: string) =>
  `${prefix} shares the ${detector} detector, so after the re-pin it stays an arrival family scored by finding type.`;

/** The product main commit the registry is pinned to when these detector-id families graduate: redact-secret PR #1039 added the detectors (#1019–#1035). */
export const REGISTRY_PIN = '4fb78827f1ddf5b3106f25130ca510a836ada186';

/** The reason for a sibling type that stays an arrival family after the re-pin, scored by its own finding type. */
export const scoredReason = (detector: string, findingType: string, issue: number, note = '') =>
  `The product types this family inside the shared ${detector} detector as ${findingType} since redact-secret#${issue} (registry pinned at ${REGISTRY_PIN.slice(0, 7)}), so it stays an arrival family scored by its finding type (scanners/families.mjs arrivalFindingTypes, docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md).${note ? ` ${note}` : ''}`;

type Contracts = Record<string, import('../../types.ts').FormatContract>;
/** Split a slice's authored contracts: `graduated` ids become registry contracts at the re-pin, the rest stay arrival contracts. */
export const splitGraduated = (authored: Contracts, graduated: string[]) =>
  split434(authored, graduated, `Graduated to a registry detector at the ${REGISTRY_PIN.slice(0, 7)} re-pin (redact-secret PR #1039).`);
