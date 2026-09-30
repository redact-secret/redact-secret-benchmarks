// Shared citations for the Beta.12 #464 slices (benchmarks/lib/beta8/464a.ts–464f.ts), the six #860
// issuance-research READY credential families: Daytona, ClickHouse Cloud, NVIDIA, Browserbase, Cerebras, RunPod.
//
// The contracts are authored from the step-3 handoffs of redact-secret#860, frozen in the product repository at
// 8b6a5fde52ecb4dfce13f09c7a947062d21483c7 (docs/audits/evidence/860/<family>.md, with the issuance research under
// issuance-research/), and from the provider sources those handoffs cite. They are not read from, or checked
// against, the product detector code (redact-secret#970–#975), so the corpus stays an independent measurement.
//
// Each contract separates what a provider source states (T1) from what the handoff sets as project policy: the
// 128-byte caps, the RunPod 31 floor and the Cerebras alphabet fill (ruling R10), and ClickHouse's uppercase guard.
// A policy part is recorded as a `policy-*` field whose basis is `research-hypothesis`, never as a provider fact.

import { splitGraduated as split434 } from './434-sources.ts';

export const HANDOFF_REVISION = '8b6a5fde52ecb4dfce13f09c7a947062d21483c7';
export const handoff = (file: string) => `https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/860/${file}`;
export const research = (file: string) => handoff(`issuance-research/${file}`);
export const HANDOFF_INDEX = handoff('README.md');
/** The Tier B re-rank: the nine-context probe of `main` and the shared contract rules (R1–R8). */
export const RERANK = handoff('tier-b-rerank.md');
export const R860 = 'https://github.com/redact-secret/redact-secret/issues/860';
/** Maintainer rulings R1 (provider generator/validator code and tests are T1) and R3 (a dated provider-staff statement is T1). */
export const RULINGS_R1_R3 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851';
/** Maintainer rulings R2 (a provider-authored leak rule is T1), R4 (a placeholder is T1 for its prefix only), R5, R6, R8 (no alphabet narrowing from a third-party rule). */
export const RULINGS_R2_R8 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275';
/** Maintainer rulings R9 (a provider generator counts as T1 as of its date until a newer provider source contradicts it) and R10 (project policy may fill a grammar the provider states only partly, never narrower than a provider-stated class). */
export const RULINGS_R9_R10 = 'https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337';
export const B464 = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/464';
export const product = (n: number) => `https://github.com/redact-secret/redact-secret/issues/${n}`;

export const at = '2026-09-29';
export const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

export const TRUFFLEHOG_DETECTORS = 'https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors';
export const GITLEAKS_CONFIG = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml';
export const BETTERLEAKS = 'https://github.com/betterleaks/betterleaks';

/** The shared reason for a #464 arrival family: no registry detector exists at the pinned product revision. */
export const reason = (detector: string, findingType: string, issue: number, note = '') =>
  `No registry detector covers this family at the pinned product revision. redact-secret#${issue} adds a new ${detector} detector that reports it as ${findingType} (handoff ${HANDOFF_REVISION.slice(0, 7)}; no detector code merges to main before 0.1.0-beta.11 is released); until that detector is in the pinned registry the family is measured as an unscored arrival family.${note ? ` ${note}` : ''}`;

/** The product main commit the registry is pinned to when these detector-id families graduate: redact-secret PR #1037 added the detectors (#970–#975), PR #1039 followed. */
export const REGISTRY_PIN = '4fb78827f1ddf5b3106f25130ca510a836ada186';

/** The reason for a sibling type that stays an arrival family after the re-pin, scored by its own finding type. */
export const scoredReason = (detector: string, findingType: string, issue: number, note = '') =>
  `The product types this family inside the shared ${detector} detector as ${findingType} since redact-secret#${issue} (registry pinned at ${REGISTRY_PIN.slice(0, 7)}), so it stays an arrival family scored by its finding type (scanners/families.mjs arrivalFindingTypes, docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md).${note ? ` ${note}` : ''}`;

type Contracts = Record<string, import('../../types.ts').FormatContract>;
/** Split a slice's authored contracts: `graduated` ids become registry contracts at the re-pin, the rest stay arrival contracts. */
export const splitGraduated = (authored: Contracts, graduated: string[]) =>
  split434(authored, graduated, `Graduated to a registry detector at the ${REGISTRY_PIN.slice(0, 7)} re-pin (redact-secret PR #1037).`);
