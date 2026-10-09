import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX_583, researchTable, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered, REGISTRY_PIN, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './583-sources.ts';

// Issue #583, slice b: Beta.14 contract for the Xata API key (`xau_` user key, `xao_` organization key; #1014 rank 11, READY
// under R1 and R9; handoff docs/audits/evidence/1014/xata.md; product redact-secret#1102). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 from provider code (R1, dated per R9): the open-sourced xataio/xata generator and validator fix the prefix, the
// alphabet and the 40-character length cap. The exact body width is derived from the generator's encoder (24 bytes through
// jxskiss/base62's bit-packed encoding), not stated, so the width window is a derivation the handoff reproduces and this
// slice re-checked against the encoder source. Two things are policy and stay out of T1: the 32 to 36 window's upper end
// (the validator cap, an inclusion decision) and the CRC32 (ruling question Q1: the lexical grammar is the contract, a
// post-check that can only reject is deferred). The CRC-mismatch twins therefore stay unclaimed (DISPUTED_PROPERTIES, T0).
// Both finding types (xata_user_api_key, xata_organization_api_key) share one grammar apart from the prefix letter, so the
// registry contract covers both prefixes and no second arrival family is warranted: a second family would repeat the same
// width, alphabet and checksum claims and the taxonomy carries a single row (`xata:api-key`) for the detector.
export const issue = '583b';

const KEY_GO = 'https://github.com/xataio/xata/blob/fc4ac97f62a3830c4e4202b08a3ca51855970113/internal/api/key/key.go#L19-L57';
const KEY_TEST = 'https://github.com/xataio/xata/blob/fc4ac97f62a3830c4e4202b08a3ca51855970113/internal/api/key/key_test.go#L31-L40';
const CLI_INIT = 'https://github.com/xataio/client-ts/blob/394dad90297568bd990b15f673de82605dcfa46d/packages/cli/src/commands/init/index.ts#L468';
const BASE62_ENCODER = 'https://github.com/jxskiss/base62/blob/master/base62.go';
const HANDOFF = handoff('xata.md', REGISTRY_PIN);
const RESEARCH = researchTable('5900447540');
const REFS = [KEY_GO, KEY_TEST, CLI_INIT, BASE62_ENCODER, HANDOFF, RESEARCH, HANDOFF_INDEX_583, R1014, RULINGS_R2_R8, product(1102), B583];
/** The jxskiss/base62 encoder was read on the authoring day, not on the handoff's date. */
const encoderSrc = (note: string) => ({ url: BASE62_ENCODER, observedAt: '2026-10-06', note });

export const XATA_PATTERN = '^xa[uo]_[A-Za-z0-9]{32,36}$';

/** Both finding types are scored inside the one registry detector, so there is no arrival family. */
export const arrivalFamilies: ArrivalFamily[] = [];

const authored: Record<string, FormatContract> = {
  'xata-api-key': {
    tier: 'T1',
    pattern: XATA_PATTERN,
    providerSource: provider(KEY_GO, 'xataio/xata internal/api/key/key.go at fc4ac97 (generator and IsValid; unchanged at tip 9be334c on 2026-09-30), plus the jxskiss/base62 encoder it calls', 'xau_ (user) or xao_ (organization) + the bit-packed base62 of 20 random bytes and their little-endian CRC32 over [0-9A-Za-z]: 32 to 36 characters, 36 to 40 in all', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1102; #1014 handoff xata.md, READY under R1 and R9). A Xata user API key (XATA_API_KEY, sent as Authorization: Bearer) acts as that user across every organization, project and database the user reaches (branches, connection data, key management); an organization key is scoped to one organization. T1 from provider code: the open-sourced xataio/xata generator reads 20 random bytes, appends their little-endian CRC32 (IEEE) and encodes the 24 bytes with jxskiss/base62 over 0-9a-zA-Z behind xau_ or xao_; its validator requires at most 40 characters in all, exactly one underscore, an xau or xao prefix, a successful base62 decode and a matching CRC32, and the same check gates every use of a key in the auth, RPC and limits paths. The encoder emits a 6-bit group as 5 bits when the group\'s low five bits are 11110 or 11111, so a 24-byte input encodes to 32 characters (no 5-bit group) or more, 33 in 86% of keys and 32 in 13%; the handoff counted 13.1/86.6/0.34 percent at 32/33/34 over two million trials, and two provider artifacts agree (the test fixture\'s 33-character body and the CLI\'s xau_ + 33-character mask). The contract takes the validator-accepted window 32 to 36 (total 36 to 40). Excluded: a body shorter than 32 or longer than 36 (below the derived minimum or past the validator cap), Xata classic-platform keys of the pre-2026 era (no provider source states their grammar), placeholders such as xau_test and xau_some_key, database connection strings and branch ids, and the HMAC-SHA256 HashKey lookup value. The CRC32 is offline-verifiable but is not part of the contract (ruling question Q1: a post-check that can only reject is deferred), so a key with a mismatched checksum is unclaimed, neither expected nor refused. Pinned peers: the handoff found no Xata rule in gitleaks, Nosey Parker, trufflehog, betterleaks or osv-scalibr (and the Kingfisher changelog names one that is absent from its tree), so no peer reads this grammar.',
    fields: [
      field({ field: 'prefix', claim: 'xau_ (user key) or xao_ (organization key)', basis: 'provider-code', status: 'frozen', sources: [src(KEY_GO, 'UserKeyPrefix xau, OrganizationKeyPrefix xao, joined to the body by one underscore'), src(HANDOFF, 'supported shape')], note: 'R1 and R9. The validator only tests that the part before the underscore starts with xau or xao; the contract claims the generated xau_ and xao_ forms.' }),
      field({ field: 'alphabet', claim: '[0-9A-Za-z] (base62, no _ or - in the body)', basis: 'provider-code', status: 'frozen', sources: [src(KEY_GO, 'encoder alphabet 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'), src(KEY_GO, 'the validator splits on _ and requires exactly two parts')], note: 'A second underscore fails IsValid; a hyphen is outside the alphabet.' }),
      field({ field: 'body-length', claim: '32 to 36 characters after the prefix (36 to 40 in all)', basis: 'provider-code', status: 'frozen', sources: [src(KEY_GO, 'MaxLength 40; 20 random bytes plus a 4-byte CRC32'), encoderSrc('encodeV2 emits a 5-bit group when the 6-bit group matches 0x1E; 24 bytes give at least 32 characters'), src(KEY_TEST, 'the valid known key has a 33-character body'), src(CLI_INIT, 'prints XATA_API_KEY=xau_ followed by 33 mask characters')], note: 'R1 and R9: derived from the generator\'s encoder rather than stated. The body 31 and 37 twins sit below the derived minimum and past the validator cap.' }),
      field({ field: 'policy-width-window', claim: 'POLICY, not T1: the window is 32 to 36 although 99.9% of keys have a body of 32 to 34; widths 35 and 36 occur with probability about 4e-8 and 1e-14 for a random key but are accepted by the validator, so the contract keeps them', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF, 'supported shape: in practice 99.9% of keys have a body of 32 to 34; the window 35 to 36 costs nothing in false positives'), src(KEY_GO, 'MaxLength 40')], note: 'An inclusion decision. The 35 and 36 positives cannot be real keys (no generated key reaches them in practice), so they are lexical-only values without a valid checksum.' }),
      field({ field: 'policy-q1-checksum', claim: 'POLICY, not T1: whether a post-check may reject a lexically valid value whose CRC32 does not verify (ruling question Q1, open). The checksum is the little-endian CRC32 (IEEE) of the 20 random bytes, in the 4 bytes before the base62 encoding; it needs the non-standard bit-packed base62 decode, not big-integer base62', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF, 'overlap and output policy: checksum (ruling Q1)'), src(KEY_GO, 'IsValid compares crc32.ChecksumIEEE of the decoded key with the stored value')], note: 'Authored as unclaimed twins (DISPUTED_PROPERTIES, T0): no fixture asserts detection or silence on a value with a wrong checksum. Every positive of 32 to 34 characters carries a valid checksum anyway.' }),
      field({ field: 'conflicting-shapes', claim: 'Xata classic-platform keys (pre-2026) have no provider-stated grammar and are not assumed to equal this one; widths 31 and 37 are asserted outside the contract, the CRC32 is not', basis: 'provider-code', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes: classic platform keys, SDK placeholders')], note: 'Unclaimed: no fixture is authored for a classic key.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; the 4-byte prefix makes an identifier-start anchor load-bearing (xau_ inside maxau_… or a longer identifier must not match)', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'case', claim: 'prefixes are matched case-sensitively (XAU_ is not a key)', basis: 'provider-code', status: 'frozen', sources: [src(KEY_GO, 'the validator tests strings.HasPrefix with lowercase xau and xao')] }),
      field({ field: 'transport', claim: 'XATA_API_KEY sent as Authorization: Bearer; written to .env by the Xata CLI; an MCP server env block', basis: 'provider-code', status: 'frozen', sources: [src(CLI_INIT, 'the CLI prints XATA_API_KEY='), src(HANDOFF, 'role and blast radius')] }),
      field({ field: 'peer-lag', claim: 'no pinned peer reads this grammar: the handoff found no Xata rule in gitleaks b58d3f1, trufflehog 19f011a, Nosey Parker 2e6e7f3, betterleaks or osv-scalibr, all newer than the pinned gitleaks 8.30.1 and trufflehog 3.97.4; lag is measured, not assumed', basis: 'tool', status: 'provisional', sources: [src(HANDOFF, 'discovery: third-party scanner rule sets'), src(TRUFFLEHOG_DETECTORS), src(GITLEAKS_CONFIG)], note: 'An inference from newer tips to the pinned versions; the run measures it.' }),
    ],
  },
};

const split = splitRegistered(authored, ['xata-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1227). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only (none: both finding types belong to the registry detector). */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'xata-api-key': 'documented-24' };
