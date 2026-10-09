import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, R1014, RULINGS_R1_R3, B528, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './528-sources.ts';

// Issue #528, slice a: Beta.12 contract for the Bitwarden Secrets Manager access token (#1014 rank 1, READY; handoff
// docs/audits/evidence/1014/bitwarden.md; product redact-secret#1019). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 for every part under R1: the provider SDK parser fixes the layout (version 0, UUID, client secret, key that
// decodes to 16 bytes), the server generator fixes the 30-character alphanumeric client secret, and the provider docs
// example agrees on every segment length. The trailing == is T1 by the generator (it always pads); an unpadded key is
// accepted by the parser but never issued, so it is outside the contract. The boundaries are handoff decisions.
export const issue = '528a';

const PARSER = 'https://github.com/bitwarden/sdk-internal/blob/824c1cf06636daa2778d53435cdbf354ab58eff2/crates/bitwarden-core/src/auth/access_token.rs#L47-L85';
const SERVER = 'https://github.com/bitwarden/server/blob/bb3a9daf9883353fa942a17ba5d8c2b1f642960b/bitwarden_license/src/Commercial.Core/SecretsManager/Commands/AccessTokens/CreateAccessTokenCommand.cs#L14-L29';
const RANDOM = 'https://github.com/bitwarden/server/blob/de7104b7134f51de34cb081c192ecb172020d508/src/Core/Utilities/CoreHelpers.cs#L205-L209';
const DOCS = 'https://bitwarden.com/help/access-tokens/';
const HANDOFF = handoff('bitwarden.md');
const RESEARCH = researchTable('5900447282');

const UUID = '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}';
export const BITWARDEN_PATTERN = `^0\\.${UUID}\\.[A-Za-z0-9]{30}:[A-Za-z0-9+/]{22}==$`;

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'bitwarden-secrets-manager-access-token': {
    tier: 'T1',
    pattern: BITWARDEN_PATTERN,
    providerSource: provider(PARSER, 'bitwarden/sdk-internal access_token.rs (824c1cf, last changed 2025-09-30): split once on :, the first part on . into exactly three parts, version "0", a UUID, and a Base64 key that decodes to 16 bytes; bitwarden/server CreateAccessTokenCommand (bb3a9da): SecureRandomString(30) with upper, lower and numeric; re-checked 2026-09-29', '0. + UUID + . + exactly 30 [A-Za-z0-9] + : + 22 standard Base64 + == (94 in all); no checksum', at),
    corroboration: [],
    references: [PARSER, SERVER, RANDOM, DOCS, HANDOFF, RESEARCH, HANDOFF_INDEX, R1014, RULINGS_R1_R3, product(1019), B528],
    review: 'Arrival evidence (#528, product redact-secret#1019; #1014 handoff bitwarden.md, READY). The token authenticates a machine account and carries both the client secret and the key that decrypts its secrets, so a leak exposes every secret the account can read. T1 on every part under R1: the provider SDK parser (version 0, UUID, key decoding to 16 bytes), the server generator (30 alphanumerics) and the docs example (segment lengths 1, 36, 30, 24 with ==). The UUID is written lowercase by the server and the parser also accepts uppercase, so the contract accepts both cases. Excluded: an unpadded key (parser-accepted, never issued), any other version, 0.<uuid> or 0.<uuid>.<secret> without the key, and Password Manager user./organization. API keys (no token grammar). The leading boundary (no [A-Za-z0-9._-] before 0) and trailing boundary (no [A-Za-z0-9+/=] after ==) are handoff decisions that keep 10.<uuid> and v0.<uuid> unclaimed. Neither pinned peer has a Bitwarden rule.',
    fields: [
      field({ field: 'version', claim: 'the literal 0 followed by .', basis: 'provider-code', status: 'frozen', sources: [src(PARSER, 'version must be "0"'), src(DOCS, 'docs example')], note: 'A future version is a grammar change to re-research, never a widening.' }),
      field({ field: 'token-id', claim: 'a UUID, 8-4-4-4-12 hex with -; lowercase as issued, uppercase accepted by the parser', basis: 'provider-code', status: 'frozen', sources: [src(PARSER, 'Uuid parse'), src(DOCS, 'docs example')] }),
      field({ field: 'client-secret', claim: 'exactly 30 [A-Za-z0-9]', basis: 'provider-code', status: 'frozen', sources: [src(SERVER, '_clientSecretMaxLength = 30; SecureRandomString(30)'), src(RANDOM, 'upper, lower, numeric; special = false')] }),
      field({ field: 'encryption-key', claim: 'a 16-byte key as standard Base64: 22 [A-Za-z0-9+/] then ==', basis: 'provider-code', status: 'frozen', sources: [src(PARSER, 'decodes to 16 bytes; the test comment says the key is generated padded'), src(DOCS, '24 characters ending ==')], note: 'Canonical Base64 of 16 bytes ends its 22nd character in one of A, Q, g, w; the contract keeps the handoff class, and positives are canonical encodings.' }),
      field({ field: 'unpadded-key', claim: 'the parser also accepts the key without ==, but the generator always pads', basis: 'provider-code', status: 'frozen', sources: [src(PARSER, 'padding ignored on decode'), src(HANDOFF, 'excluded shapes')], note: 'Outside the issued grammar: an unpadded twin is a one-property twin, and an unpadded copy is an accepted false negative.' }),
      field({ field: 'boundary', claim: 'the byte before 0 is not [A-Za-z0-9._-] (so 10.<uuid> and v0.<uuid> are not claimed) and the byte after == is not [A-Za-z0-9+/=]', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'the BWS_ACCESS_TOKEN environment variable, the bws CLI --access-token flag, SDK clients and CI integrations', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'test axes')] }),
      field({ field: 'other-credentials', claim: 'Password Manager personal and organization API keys (user./organization. + UUID client id, 30-character client secret) have no distinctive token grammar', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'Not this family; a user. client id alone is a benign control.' }),
      field({ field: 'peer-lag', claim: 'no Bitwarden rule in trufflehog 3.97.4 or gitleaks 8.30.1: both lag on every positive', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no bitwarden detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no bitwarden rule')] }),
    ],
  },
};

const split = splitGraduated(authored, ['bitwarden-secrets-manager-access-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'bitwarden-secrets-manager-access-token': 'documented-24' };
