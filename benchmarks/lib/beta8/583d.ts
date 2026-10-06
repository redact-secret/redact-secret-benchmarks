import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX_583, researchTable, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered, REGISTRY_PIN, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './583-sources.ts';

// Issue #583, slice d: Beta.14 contract for the Unkey root key (detector `unkey-root-key`, finding type `unkey_root_key`;
// #1014 rank 15, READY for the two current root-key grammars; handoff docs/audits/evidence/1014/unkey.md; product
// redact-secret#1104). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 by provider design document and generator code (R1, R9): version 1 (`unkey_` + 8 + `unkeyv1` + 42 base58, the last six
// the CRC-32C) and the dashboard `3Z` form (`unkey_3Z` + 22 base58). The contract is the lexical grammar. The checksum is a
// real CRC-32C the corpus computes, but whether a post-check may reject a mismatching key is ruling Q1 (open): a checksum-
// mismatch twin is therefore UNCLAIMED (DISPUTED_PROPERTIES, T0), never asserted either way. Customer-prefixed version 1
// keys (Q10), the Go 21/22 form and pre-2023 keys are excluded and authored as unclaimed shapes only.
export const issue = '583d';

const RFC = 'https://github.com/unkeyed/unkey/blob/20378e892035dad8ca3590765651cd25c964f78e/docs/engineering/architecture/rfcs/0017-api-key-plaintext-format.mdx';
const GENERATOR = 'https://github.com/unkeyed/unkey/blob/20378e892035dad8ca3590765651cd25c964f78e/internal/services/keys/create_v1.go';
const ROOT_HANDLER = 'https://github.com/unkeyed/unkey/blob/20378e892035dad8ca3590765651cd25c964f78e/svc/api/routes/v2_root_keys_create_key/handler.go';
const DASHBOARD = 'https://github.com/unkeyed/unkey/blob/6c9bc65125dd2c8b5038ac80a11e173767dc9e52/web/apps/dashboard/lib/trpc/routers/key/createRootKey.ts#L56-L59';
const TS_V1 = 'https://github.com/unkeyed/unkey/blob/6c9bc65125dd2c8b5038ac80a11e173767dc9e52/web/internal/keys/src/v1.ts#L1-L80';
const HANDOFF = handoff('unkey.md', REGISTRY_PIN);
const RESEARCH = researchTable('5900447282');
const REFS = [RFC, GENERATOR, ROOT_HANDLER, DASHBOARD, TS_V1, HANDOFF, RESEARCH, HANDOFF_INDEX_583, R1014, RULINGS_R2_R8, product(1104), B583];

const B58 = '[1-9A-HJ-NP-Za-km-z]';
export const UNKEY_ROOT_KEY_PATTERN = `^unkey_(?:${B58}{8}unkeyv1${B58}{42}|3Z${B58}{22})$`;

/** Every contract this slice authored; split at the registry boundary below. */
const authored: Record<string, FormatContract> = {
  'unkey-root-key': {
    tier: 'T1',
    pattern: UNKEY_ROOT_KEY_PATTERN,
    providerSource: provider(RFC, 'Unkey RFC 0017 "API key plaintext format" (merged 2026-08-28) and the generator create_v1.go, observed 2026-09-30: {prefix}_{random[8]}unkeyv1{random[36]}{checksum[6]}, random from the Bitcoin base58 alphabet, checksum CRC-32C; root keys issue with prefix unkey (handler test asserts ^unkey_[base58]{8}unkeyv1[base58]{42}$). The dashboard root key is unkey_ + 24 base58 beginning 3Z (generator code, width and lead derived)', 'unkey_ + 8 base58 + unkeyv1 + 42 base58 (63 in all; the last 6 are the CRC-32C), or unkey_3Z + 22 base58 (30 in all); no other width', at),
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1104; #1014 handoff unkey.md, READY for the two current root-key grammars). An Unkey root key authorizes the management API for a workspace (create, update and delete keys, read key metadata, manage permissions and APIs), so a leak lets an attacker mint or revoke the victim\'s product keys. T1: the version 1 grammar is stated by the provider\'s own design document (including a GitHub regex) and produced by its generator, and a handler test asserts the exact root-key shape (two independent provider artifacts, R1 and R9); the dashboard form is T1 by R1 and R9 from generator code, the width and the 3Z lead derived exactly (the leading two bytes are fixed). The version 1 checksum is a CRC-32C over the whole key before the checksum, big-endian, base58, left-padded with 1 to 6; the corpus computes it for every positive. The claim is the lexical grammar: whether a checksum post-check may reject a key (ruling Q1, open) is policy, so the checksum-mismatch twin is unclaimed. Excluded: customer-prefixed version 1 keys (<prefix>_…unkeyv1…, ruling Q10 open; they stay unclaimed), the deprecated Go CreateKey form (unkey_ + 21 or 22 base58, called for root keys only by the development seed), root keys older than the current generators, key_ and api_ identifiers and the betterleaks unkey_ + 20 to 32 window. Pinned peers: gitleaks 8.30.1 and trufflehog 3.97.4 have no Unkey rule, so lag is expected on every positive.',
    fields: [
      field({ field: 'prefix', claim: 'unkey_ (lowercase, case-sensitive)', basis: 'provider-documentation', status: 'frozen', sources: [src(RFC, 'root keys use prefix unkey'), src(ROOT_HANDLER, 'Prefix: "unkey"'), src(HANDOFF, 'supported shape')], note: 'R4.' }),
      field({ field: 'version-1-shape', claim: 'unkey_ + 8 base58 + unkeyv1 + 42 base58 (63 in all); the marker sits at offset 8 of the body', basis: 'provider-documentation', status: 'frozen', sources: [src(RFC, '{prefix}_{random[8]}unkeyv1{random[36]}{checksum[6]} and the GitHub regex'), src(GENERATOR, 'keyV1RandomHead = 8, marker unkeyv1'), src(ROOT_HANDLER, 'test asserts ^unkey_[base58]{8}unkeyv1[base58]{42}$')], note: 'Two independent provider artifacts: R1 and R9.' }),
      field({ field: 'alphabet', claim: 'Bitcoin base58 [1-9A-HJ-NP-Za-km-z] in every random part: 0, O, I, l and _ are not base58', basis: 'provider-documentation', status: 'frozen', sources: [src(RFC, 'random characters from the Bitcoin base58 alphabet'), src(GENERATOR, 'base58 alphabet')] }),
      field({ field: 'checksum', claim: 'the last 6 characters are the CRC-32C (Castagnoli) of the whole key before them, big-endian, base58, left-padded with 1 to 6', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'keyV1ChecksumLength = 6; CRC-32C of the unsigned key'), src(RFC, 'Fixed-width Base58 CRC-32C')], note: 'The corpus computes it for every positive. Verified against the provider known-vector test by the handoff.' }),
      field({ field: 'policy-q1-checksum-post-check', claim: 'POLICY, not T1: a checksum post-check may reject a lexically valid version 1 key whose CRC-32C does not verify (ruling Q1, open); the lexical grammar is the contract meanwhile', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF_INDEX_583, 'Q1 checksum post-checks'), src(HANDOFF, 'overlap and output policy')], note: 'The checksum-mismatch twin is unclaimed (DISPUTED_PROPERTIES, T0): it asserts neither detection nor silence.' }),
      field({ field: 'dashboard-form', claim: 'unkey_3Z + exactly 22 base58 (30 in all); no checksum', basis: 'provider-code', status: 'frozen', sources: [src(DASHBOARD, 'newKey({ prefix: "unkey", byteLength: 16 })'), src(TS_V1, 'encodes [0x01, 0x10, 16 random bytes] as base58'), src(HANDOFF, 'supported shape: derivation, 300,000 samples all length 24 and a 3Z lead')], note: 'R1 and R9; the width and the 3Z lead are derived, not stated.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'customer-prefixed-v1', claim: '<customer prefix 1-16>_<8>unkeyv1<42> keys are customer-product credentials with a customer-chosen prefix, not root keys', basis: 'provider-documentation', status: 'unresolved', sources: [src(RFC, 'one plaintext format for all Unkey-generated API keys'), src(HANDOFF, 'excluded shapes; ruling Q10')], note: 'Q10 open. Authored as an unclaimed twin (DISPUTED_PROPERTIES, T0).' }),
      field({ field: 'older-and-go-forms', claim: 'the deprecated Go CreateKey form (unkey_ + 21 or 22 base58) and root keys older than 2023-11 have no cited grammar', basis: 'provider-code', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes and what is missing')], note: 'Unclaimed until an issued-key or dated-source check.' }),
      field({ field: 'transport', claim: 'UNKEY_ROOT_KEY in .env, Authorization: Bearer to the management API, new Unkey({ rootKey })', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius; test axes')] }),
      field({ field: 'public-identifiers', claim: 'key_ and api_ identifiers and unkey_<word> names (unkey_root_key, unkey_mutations) are not root keys', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes; benign')], note: 'Controls, never positives.' }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 and trufflehog 3.97.4 have no Unkey rule (betterleaks unkey_ + 20 to 32 misses the 57-character version 1 body and accepts non-base58 characters): lag is measured, not assumed', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS), src(GITLEAKS_CONFIG), src(HANDOFF, 'discovery')] }),
    ],
  },
};

const split = splitRegistered(authored, ['unkey-root-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1214). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** No arrival family: `unkey_api_key` (customer-prefixed keys) waits on ruling Q10. */
export const arrivalFamilies: ArrivalFamily[] = [];
export const contracts: Record<string, FormatContract> = split.contracts;

export const profiles: Record<string, FixtureProfile> = { 'unkey-root-key': 'documented-24' };
