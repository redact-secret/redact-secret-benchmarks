import { splitGraduated as split434 } from './434-sources.ts';
import { researchTable, RULINGS_R1_R3, RULINGS_R2_R8, R1014, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './528-sources.ts';

// Shared citations for the Beta.12 #583 slices: the benchmarks side of the #1014 second wave (Xata, Sourcegraph, Unkey,
// Buildkite, Pydantic Logfire, Square, Mapbox, Fly, Ory siblings). Square (583a) and the seven other registered detectors
// (583b to 583h) carry a contract and a corpus; 583p is empty and records any registered detector still without a slice.
//
// The Square contract is authored from the step-3 handoff docs/audits/evidence/1014/square.md, frozen in the product
// repository at SQUARE_HANDOFF_REVISION, and from the provider pages it cites. It is not read from, or checked against, the
// product detector code (redact-secret#1107), so the corpus stays an independent measurement.
export { researchTable, RULINGS_R1_R3, RULINGS_R2_R8, R1014, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG };

/** The date the handoff counted the provider pages (every example width was counted from the fetched page). */
export const at = '2026-09-30';
export const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

/** The last product commit that changed the Square handoff record. */
export const SQUARE_HANDOFF_REVISION = 'fa955d28eed59c70a9c4380ed130d1b82d439cd9';
/** Product main when the registry was re-pinned to carry the #1106–#1109 and #1102–#1105 detectors (core PR #1214 and #1227). */
export const REGISTRY_PIN = '3b1a5aa9935c57416a026a44f45501fd41ffeac8';
export const handoff = (file: string, revision = SQUARE_HANDOFF_REVISION) =>
  `https://github.com/redact-secret/redact-secret/blob/${revision}/docs/audits/evidence/1014/${file}`;
/** The #1014 roll-up, where the Q8 ruling question (R5 when a provider disclaims length) is asked. */
export const HANDOFF_INDEX_583 = handoff('README.md', REGISTRY_PIN);
export const Q8 = `${HANDOFF_INDEX_583}#ruling-questions-for-the-maintainer`;
export const B583 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/583';
export const B584 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/584';
export const product = (n: number) => `https://github.com/redact-secret/redact-secret/issues/${n}`;

type Contracts = Record<string, import('../../types.ts').FormatContract>;
/** Split a slice's authored contracts: `graduated` ids are registry detectors at the re-pin, the rest stay arrival contracts. */
export const splitRegistered = (authored: Contracts, graduated: string[]) =>
  split434(authored, graduated, `A registry detector at the ${REGISTRY_PIN.slice(0, 7)} re-pin (redact-secret PR #1227); no published artifact contains it.`);

/** The reason for a sibling type that is an arrival family scored by its own finding type inside a shared detector. */
export const scoredReason = (detector: string, findingType: string, issue: number, note = '') =>
  `The product types this family inside the shared ${detector} detector as ${findingType} since redact-secret#${issue} (registry pinned at ${REGISTRY_PIN.slice(0, 7)}), so it is an arrival family scored by its finding type (scanners/families.mjs arrivalFindingTypes, docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md).${note ? ` ${note}` : ''}`;
