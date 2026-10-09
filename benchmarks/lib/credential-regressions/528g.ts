import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, gl } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, R1014, RULINGS_R1_R3, RULINGS_R2_R8, B528, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './528-sources.ts';

// Issue #528, slice g: Beta.12 contract for Dynatrace access and platform tokens (#1014 rank 7, READY; handoff
// docs/audits/evidence/1014/dynatrace.md; product redact-secret#1032). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 for every fact: the Dynatrace docs state the three dot-separated components, the 24-character public portion,
// the 64-character secret portion and the prefix table (dt0s01..dt0s16; dt0c01 by the docs placeholder, R4); the
// uppercase base32 alphabet is the provider operator's generator (R1) and matches the docs' full-length example. The
// token identifier alone (prefix + public portion) is documented as safe to log, so it is a control. The whole token is
// the span, so redaction never keeps a half-token. The boundaries are handoff decisions.
export const issue = '528g';

const DOCS = 'https://docs.dynatrace.com/docs/dynatrace-api/basics/dynatrace-api-authentication';
const OPERATOR = 'https://github.com/Dynatrace/dynatrace-operator/blob/2a39d88a0ee1fbb61e2d22db02520b3dc92ffc80/pkg/util/dttoken/token.go#L14-L58';
const HANDOFF = handoff('dynatrace.md');
const RESEARCH = researchTable('5900447540');

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'dynatrace-token': {
    tier: 'T1',
    pattern: '^dt0[cs][0-9]{2}\\.[A-Z2-7]{24}\\.[A-Z2-7]{64}$',
    providerSource: provider(DOCS, 'Dynatrace docs "Token format" (updated 2026-08-04): three components separated by dots, a prefix that identifies the token type, a 24-character public portion and a 64-character secret portion; Dynatrace/dynatrace-operator pkg/util/dttoken/token.go (2a39d88, 2026-07-22): base32.StdEncoding truncated to each portion; re-checked 2026-09-29', 'dt0 + c|s + 2 digits + . + exactly 24 [A-Z2-7] + . + exactly 64 [A-Z2-7], 96 in all', at),
    corroboration: [{ tool: gl.tool, label: 'dynatrace-api-token: dt0c01\\.(?i)[a-z0-9]{24}\\.[a-z0-9]{64} (dt0c01 only, case-insensitive alphanumeric)', url: gl.url }],
    references: [DOCS, OPERATOR, HANDOFF, RESEARCH, HANDOFF_INDEX, R1014, RULINGS_R1_R3, RULINGS_R2_R8, product(1032), B528],
    review: 'Arrival evidence (#528, product redact-secret#1032; #1014 handoff dynatrace.md, READY). Access and platform tokens authenticate the environment and account APIs; depending on scopes a token reads monitoring data (which can include payloads and logs), changes configuration, ingests data or manages the account. T1 for every fact: the docs state the structure, both lengths and the prefix table (dt0s01, dt0s02, dt0s03, dt0s04, dt0s06, dt0s08, dt0s09, dt0s16; dt0c01 by the docs request placeholder, R4), and the base32 alphabet is the provider generator (R1) and the docs example. The contract admits dt0 + c|s + any two digits, as the handoff decides. Excluded: the token identifier alone (safe to log), portions with lowercase or 0, 1, 8, 9 (never generated), other Dynatrace secrets in other shapes and the docs placeholder dt0c01.abc123.… (fails both widths). gitleaks 8.30.1 reads dt0c01 only and is case-insensitive over [a-z0-9], so it lags on every dt0s token and overreaches on lowercase and 0/1/8/9 twins; trufflehog 3.97.4 has no Dynatrace rule.',
    fields: [
      field({ field: 'prefix', claim: 'dt0 + c or s + two digits (the docs table lists dt0s01..dt0s16; dt0c01 is the classic prefix in the docs request examples)', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, 'prefix table and request examples'), src(RULINGS_R2_R8, 'R4: a placeholder is T1 for its prefix')] }),
      field({ field: 'layout', claim: '<prefix>.<24-character public portion>.<64-character secret portion>; 96 in all', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, '"three components separated by dots"; 24 and 64'), src(OPERATOR, 'the same format comment')] }),
      field({ field: 'alphabet', claim: 'uppercase base32 [A-Z2-7] in both portions', basis: 'provider-code', status: 'frozen', sources: [src(OPERATOR, 'base32.StdEncoding'), src(DOCS, 'the full-length example uses only A-Z and 2-7'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'token-identifier', claim: 'the prefix plus public portion "can be safely displayed in the UI and can be used for logging purposes"', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)], note: 'A token identifier alone is a benign control; inside a full token it is part of the one span.' }),
      field({ field: 'boundary', claim: 'the byte before dt0 and the byte after the secret portion are not [A-Za-z0-9_.-]', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement. Read literally it would reject the URL-encoded OpenTelemetry header Authorization=Api-Token%20<token>, where the byte before dt0 is 0; that form is a documented transport, so it is authored as a positive and measures whether an implementation handles it. A .x glued after the token leaves a contract-valid token before the dot, so it is not authored as a twin (#84); the trailing-glue twin appends _x.' }),
      field({ field: 'transport', claim: 'Authorization: Api-Token <token> (the documented scheme); DT_API_TOKEN; a DynaKube secret apiToken; an OpenTelemetry exporter header Authorization=Api-Token%20<token>', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'test axes')] }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 dynatrace-api-token dt0c01\\.(?i)[a-z0-9]{24}\\.[a-z0-9]{64} (entropy 4, no boundary) reads dt0c01 only: it lags on every dt0s token and overreaches on lowercase and 0/1/8/9 bodies, leading glue and a 65-byte secret portion (it matches the first 64). Mapped to dynatrace-token. No Dynatrace rule in trufflehog 3.97.4', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'dynatrace-api-token'), src(TRUFFLEHOG_DETECTORS, 'no dynatrace detector directory at the pinned version')] }),
    ],
  },
};

const split = splitGraduated(authored, ['dynatrace-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'dynatrace-token': 'documented-24' };
