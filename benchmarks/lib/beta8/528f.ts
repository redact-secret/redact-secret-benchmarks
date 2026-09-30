import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, RULING_QUESTIONS, R1014, RULINGS_R1_R3, B528, product, at, src, reason, GRADUATES, byFindingType, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './528-sources.ts';

// Issue #528, slice f: Beta.12 contracts for the crates.io API token (cio) and trusted-publishing token (cio_tp_)
// (#1014 rank 6, READY; handoff docs/audits/evidence/1014/crates-io.md; product redact-secret#1031). Owned by this slice
// only; see docs/specs/beta8-evidence.md.
//
// T1 for every fact under R1: TOKEN_PREFIX "cio" + 32 rand::distr::Alphanumeric, and the trusted-publishing PREFIX
// "cio_tp_" + 31 alphanumerics + one check character from A-Za-z0-9. cio is a three-letter trigram, so the exact body and
// both identifier boundaries carry the precision (handoff decision). POLICY, not T1: the cio_tp_ check character
// corroborates only and never rejects a shape-valid match (Q1 open; security-first standing decision).
export const issue = '528f';

const TOKEN = 'https://github.com/rust-lang/crates.io/blob/7b2475e26337856ab054844c9078bb23c11b2f19/crates/crates_io_database/src/utils/token.rs#L10-L91';
const TRUSTPUB = 'https://github.com/rust-lang/crates.io/blob/f937ab051067e793ed647c7b587a5419db85949b/crates/crates_io_trustpub/src/access_token.rs#L21-L102';
const HANDOFF = handoff('crates-io.md');
const RESEARCH = researchTable('5900447282');
const REFS = [TOKEN, TRUSTPUB, HANDOFF, RESEARCH, HANDOFF_INDEX, RULING_QUESTIONS, R1014, RULINGS_R1_R3, product(1031), B528];

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'crates-io-token', taxonomy: 'crates-io:api-token', issue, reason: reason('crates-io-token', 'crates_io_api_token', 1031, GRADUATES) },
  { id: 'crates-io-trusted-publishing-token', taxonomy: 'crates-io:trusted-publishing-token', issue, reason: reason('crates-io-token', 'crates_io_trusted_publishing_token', 1031, byFindingType('cio_tp_', 'crates-io-token')) },
];

const shared = [
  field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; cio + 32 inside a longer alphanumeric run is never truncated', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'short prefix; implementation notes')], note: 'Handoff boundary decision, not a provider statement. It is load-bearing for the three-letter cio prefix.' }),
  field({ field: 'transport', claim: 'CARGO_REGISTRY_TOKEN; [registry] token in ~/.cargo/credentials.toml; cargo publish --token; a trusted-publishing token minted in CI and exported for cargo publish', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius; test axes')] }),
  field({ field: 'peer-lag', claim: 'no crates.io rule in trufflehog 3.97.4 or gitleaks 8.30.1: both lag on every positive. noseyparker (not pinned here) has \\bcio[a-zA-Z0-9]{32}\\b and no cio_tp_ rule', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no crates.io detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no crates.io rule'), src(HANDOFF, 'tier rationale')] }),
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'crates-io-token': {
    tier: 'T1',
    pattern: '^cio[A-Za-z0-9]{32}$',
    providerSource: provider(TOKEN, 'rust-lang/crates.io crates/crates_io_database/src/utils/token.rs (7b2475e, 2025-12-01): TOKEN_PREFIX = "cio", TOKEN_LENGTH = 32, rand::distr::Alphanumeric; HashedToken::parse rejects any token without the prefix; re-checked 2026-09-29', 'cio + exactly 32 [A-Za-z0-9], 35 in all; no separator or checksum', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1031; #1014 handoff crates-io.md, READY). An API token publishes, yanks and changes owners of crates within its scopes. T1 for every fact under R1 from the provider server code; unprefixed pre-cio tokens are no longer accepted. cio is a trigram, so the exact 32-byte body and both identifier boundaries (handoff decision) keep it precise: a random standalone 35-byte alphanumeric value that starts with cio (about 1 in 238,000) is the accepted false positive. The body excludes _, so a cio_tp_ token never reads as an API token. Excluded: words and identifiers that start with cio (ciound, cio_config) and cio + 32 inside a longer run. Neither pinned peer has a crates.io rule.',
    fields: [
      field({ field: 'prefix', claim: 'cio', basis: 'provider-code', status: 'frozen', sources: [src(TOKEN, 'TOKEN_PREFIX')] }),
      field({ field: 'body', claim: 'exactly 32 [A-Za-z0-9] (rand::distr::Alphanumeric); 35 in all', basis: 'provider-code', status: 'frozen', sources: [src(TOKEN, 'TOKEN_LENGTH = 32, Alphanumeric')] }),
      ...shared,
    ],
  },
  'crates-io-trusted-publishing-token': {
    tier: 'T1',
    pattern: '^cio_tp_[A-Za-z0-9]{32}$',
    providerSource: provider(TRUSTPUB, 'rust-lang/crates.io crates/crates_io_trustpub/src/access_token.rs (f937ab0, 2026-06-24): PREFIX = "cio_tp_", RAW_LENGTH = 31 alphanumerics, then one check character from A-Za-z0-9 (XOR of the raw bytes, modulo 62); the parser requires exactly 32 characters after the prefix; re-checked 2026-09-29', 'cio_tp_ + exactly 32 [A-Za-z0-9] (31 + 1 check character), 39 in all', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1031; #1014 handoff crates-io.md, READY). A trusted-publishing token is minted from a CI OIDC exchange and can publish for its short lifetime. T1 for every fact under R1. POLICY, not T1: the check character is corroboration only; a shape-valid token whose last character is not the check character is still claimed (ruling Q1 open; security-first standing decision), so positives carry a matching and a mismatching check character and nothing asserts silence on a check failure. No pinned peer (and no scanner the handoff found) covers cio_tp_.',
    fields: [
      field({ field: 'prefix', claim: 'cio_tp_', basis: 'provider-code', status: 'frozen', sources: [src(TRUSTPUB, 'PREFIX')] }),
      field({ field: 'body', claim: 'exactly 32 [A-Za-z0-9]: 31 random alphanumerics and one check character; 39 in all', basis: 'provider-code', status: 'frozen', sources: [src(TRUSTPUB, 'RAW_LENGTH = 31 + 1')] }),
      field({ field: 'checksum', claim: 'the 32nd body character is a check character from A-Za-z0-9: the XOR of the 31 raw bytes, modulo 62', basis: 'provider-code', status: 'frozen', sources: [src(TRUSTPUB)], note: 'The corpus computes it as the handoff describes it (A-Za-z0-9 index order); nothing depends on the order because the check never rejects.' }),
      field({ field: 'policy-checksum', claim: 'POLICY, not T1: the check character is corroboration only and never rejects a shape-valid match', basis: 'research-hypothesis', status: 'frozen', sources: [src(RULING_QUESTIONS, 'Q1: checksum post-checks, open'), src(HANDOFF, 'overlap and output policy: optional under Q1')], note: 'Positives carry both a matching and a mismatching check character.' }),
      ...shared,
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'crates-io-token': 'documented-24', 'crates-io-trusted-publishing-token': 'documented-24' };
