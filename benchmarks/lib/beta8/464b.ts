import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, gl } from '../contract-sources.ts';
import { handoff, research, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R9_R10, B464, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './464-sources.ts';

// Issue #464, slice b: Beta.12 contract for the ClickHouse Cloud API key secret (#860, READY under the existing
// rulings; handoff docs/audits/evidence/860/clickhouse-cloud.md; product redact-secret#971). Owned by this slice
// only; see docs/specs/beta8-evidence.md.
//
// T1 as of 2025-04-16 (ruling R3, a dated provider-staff statement plus the staff-authored regex R2): 4b1d + 38
// [A-Za-z0-9]. The product's at-least-one-uppercase guard on the body is false-positive policy, NOT a provider fact:
// the staff regex admits an all-lowercase body, so no fixture asserts silence on one, and every positive is mixed case
// so the guard is never what a positive measures. The key ID (the Basic-auth username) is not claimed.
export const issue = '464b';

const GITLEAKS_PR = 'https://github.com/gitleaks/gitleaks/pull/1826';
const TERRAFORM_EXAMPLES = 'https://github.com/ClickHouse/terraform-provider-clickhouse/blob/cfa09c82da2856dc163ddf1529ea7ef7a3e76fe7/examples/provider/provider.tf#L16';
const TERRAFORM_TEST = 'https://github.com/ClickHouse/terraform-provider-clickhouse/blob/cfa09c82da2856dc163ddf1529ea7ef7a3e76fe7/internal/api/client_test.go#L20';
const API_DOCS = 'https://api.clickhouse.cloud/v1';
const HANDOFF = handoff('clickhouse-cloud.md');
const RESEARCH = research('clickhouse-cloud.md');

export const CLICKHOUSE_PATTERN = '^4b1d[A-Za-z0-9]{38}$';

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1037). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'clickhouse-cloud-api-secret': {
    tier: 'T1',
    pattern: CLICKHOUSE_PATTERN,
    providerSource: provider(GITLEAKS_PR, 'gitleaks PR #1826 (merged 2025-04-16), authored by a ClickHouse employee: "we specifically choose a prefix (4b1d...)" and the rule 4b1d[A-Za-z0-9]{38}; 4b1d + 38 mixed-case alphanumeric examples in the provider-owned Terraform provider since 2023-05; a 42-byte unit-test fixture from 2024-07 (re-checked 2026-09-28)', '4b1d + exactly 38 [A-Za-z0-9] (42 in all); no separator or checksum; T1 as of 2025-04-16 (R3), which sets aside the older 2023 39-byte knowledge-base example', at),
    corroboration: [{ tool: gl.tool, label: 'clickhouse-cloud-api-secret-key', url: gl.url }],
    references: [GITLEAKS_PR, TERRAFORM_EXAMPLES, TERRAFORM_TEST, API_DOCS, HANDOFF, RESEARCH, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R9_R10, product(971), B464],
    review: 'Arrival evidence (#464, product redact-secret#971; #860 handoff clickhouse-cloud.md, READY). T1 as of 2025-04-16: a ClickHouse employee stated the 4b1d prefix in gitleaks PR #1826 (R3) and authored the rule 4b1d[A-Za-z0-9]{38} (R2), and the provider-owned Terraform examples and a 2024 unit-test fixture carry 42-byte 4b1d values. One provider knowledge-base example is 39 bytes (2023-09-02); R3 date order sets it aside, so a 39-byte total is a twin, not a positive. POLICY, not T1: the product requires at least one uppercase letter in the body (removes hex digests and lowercase ids that start 4b1d; false-negative cost about 1e-9), and the staff regex does not, so every positive is mixed case and no fixture asserts silence on a lowercase body. The leading boundary matters because 4b1d is valid hex: a longer hex or base64 run containing 4b1d must not match mid-run. Excluded: the key ID (no prefix, 17 or 20 alphanumerics, unresolved), UUIDs containing -4b1d-, 40- and 64-hex digests starting 4b1d, secrets supplied through the API\'s hashData (caller-chosen shape) and placeholders such as mykeysecret.',
    fields: [
      field({ field: 'prefix', claim: '4b1d', basis: 'provider-documentation', status: 'frozen', sources: [src(GITLEAKS_PR, 'staff statement, merged 2025-04-16'), src(RULINGS_R1_R3, 'R3: dated staff statement'), src(TERRAFORM_EXAMPLES, '4b1d example values since 2023-05')], note: 'T1 as of 2025-04-16. Provider staff wrote it in a third-party repository; the authorship, not the venue, is what R3 weighs.' }),
      field({ field: 'body-length', claim: 'exactly 38 after the prefix (42 in all)', basis: 'provider-documentation', status: 'frozen', sources: [src(GITLEAKS_PR, 'staff-authored regex {38}'), src(TERRAFORM_EXAMPLES, 'provider example, 42 bytes'), src(TERRAFORM_TEST, 'a 2024 unit-test fixture, 42 bytes'), src(RULINGS_R9_R10, 'the maintainer accepted this on 2026-09-28')], note: 'A single 2023 knowledge-base example is 39 bytes total; it is older, so R3 date order sets it aside.' }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9], mixed case', basis: 'provider-documentation', status: 'frozen', sources: [src(GITLEAKS_PR, 'staff-authored regex'), src(TERRAFORM_EXAMPLES, 'mixed-case examples')] }),
      field({ field: 'policy-uppercase-guard', claim: 'POLICY, not T1: the product requires at least one uppercase letter in the 38 body bytes', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'implementation notes: project policy; P(no uppercase in 38 random alphanumerics) about 1e-9')], note: 'False-positive policy that removes lowercase and hex digests starting 4b1d. The staff regex admits an all-lowercase body, so no fixture asserts silence on one; every positive is mixed case and every twin keeps a mixed-case body.' }),
      field({ field: 'separators', claim: 'none; no checksum', basis: 'provider-documentation', status: 'frozen', sources: [src(GITLEAKS_PR)] }),
      field({ field: 'boundary', claim: 'a key glued to an alphanumeric, _ or - on either side is not claimed; 4b1d is valid hex, so mid-run occurrences must not match', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'key-id', claim: 'the key ID (Basic-auth username) has no marker: 17 or 20 alphanumerics, unresolved', basis: 'provider-documentation', status: 'unresolved', sources: [src(RESEARCH), src(API_DOCS)], note: 'Not claimed; it appears only as an unmarked companion of a positive and as a public-id control.' }),
      field({ field: 'hashdata-secrets', claim: 'the API accepts a caller-supplied pre-hashed secret (hashData), so such a secret has no fixed shape', basis: 'provider-documentation', status: 'frozen', sources: [src(RESEARCH)], note: 'An accepted false negative; nothing is authored either way.' }),
      field({ field: 'transport', claim: 'CLICKHOUSE_CLOUD_API_KEY / CLICKHOUSE_CLOUD_API_SECRET, the Terraform token_secret and HTTP Basic auth (key ID : secret)', basis: 'provider-documentation', status: 'frozen', sources: [src(API_DOCS), src(TERRAFORM_EXAMPLES)] }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 has clickhouse-cloud-api-secret-key, \\b(4b1d[A-Za-z0-9]{38})\\b with entropy 3 and no case guard: it agrees with the T1 grammar, misses a low-entropy body under its entropy floor, and \\b lets a glued - through; trufflehog 3.97.4 has no ClickHouse Cloud rule', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'clickhouse-cloud-api-secret-key'), src(TRUFFLEHOG_DETECTORS, 'no clickhouse detector directory at the pinned version')] }),
    ],
  },
};

const split = splitGraduated(authored, ['clickhouse-cloud-api-secret']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1037). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'clickhouse-cloud-api-secret': 'documented-24' };
