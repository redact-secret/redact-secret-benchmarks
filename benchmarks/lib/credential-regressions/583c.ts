import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th, gl } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX_583, REGISTRY_PIN, researchTable, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './583-sources.ts';

// Issue #583, slice c: Beta.14 contract for the Sourcegraph personal access token (`sgp_`) (#1014 rank 14, READY, T1 under
// R1 and R9 as of 2025-11-18; handoff docs/audits/evidence/1014/sourcegraph.md at the registry pin; product
// redact-secret#1103). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// The claim is the union of the two provider validators (the 2024 snapshot and the 2025-11 src-cli library): `sgp_`, an
// optional alphanumeric instance identifier ended by `_`, then exactly 40 hex of either case. What the handoff adds as
// detector policy (the 32-byte identifier cap) is a `policy-*` field and its edge is unclaimed. The `sgph_` prefix (accepted
// by both validators, no issuer known), the `sgd_` Cody Gateway token (one provider source) and the bare 40-hex legacy token
// are excluded; their twins are authored UNCLAIMED (benchmarks/evaluation/domains/credential/assessment.ts
// DISPUTED_PROPERTIES, scored T0). The detector has one finding type, so there is no arrival family.
export const issue = '583c';

const HANDOFF = handoff('sourcegraph.md', REGISTRY_PIN);
const GENERATOR = 'https://github.com/sourcegraph/sourcegraph-public-snapshot/blob/c864f15af264f0f456a6d8a83290b5c940715349/internal/accesstoken/personal_access_token.go#L13-L48';
const VALIDATOR_SNAPSHOT = 'https://github.com/sourcegraph/sourcegraph-public-snapshot/blob/c864f15af264f0f456a6d8a83290b5c940715349/lib/accesstoken/personal_access_token.go';
const SRC_CLI_VENDOR = 'https://github.com/sourcegraph/src-cli/commit/7cb402a6c3730d375ec167ab295d331d855fa5a4';
const CODY_TOKEN = 'https://github.com/sourcegraph/sourcegraph-public-snapshot/blob/c864f15af264f0f456a6d8a83290b5c940715349/internal/accesstoken/cody_access_token.go';
const ONEPASSWORD = 'https://github.com/1Password/shell-plugins/issues/233';
const GITLEAKS_1697 = 'https://github.com/gitleaks/gitleaks/issues/1697';
const RESEARCH = researchTable('5900447016');
const REFS = [GENERATOR, VALIDATOR_SNAPSHOT, SRC_CLI_VENDOR, ONEPASSWORD, HANDOFF, RESEARCH, HANDOFF_INDEX_583, R1014, RULINGS_R2_R8, product(1103), B583];

export const SOURCEGRAPH_TOKEN_PATTERN = '^sgp_(?:[A-Za-z0-9]{1,32}_)?[a-fA-F0-9]{40}$';

/** One finding type (sourcegraph_access_token), so no arrival family. */
export const arrivalFamilies: ArrivalFamily[] = [];

const authored: Record<string, FormatContract> = {
  'sourcegraph-token': {
    tier: 'T1',
    pattern: SOURCEGRAPH_TOKEN_PATTERN,
    providerSource: provider(VALIDATOR_SNAPSHOT, 'Sourcegraph personal access token generator and validators, observed 2026-09-30: the 2024-08 snapshot generator ("sgp_<instance-identifier>_<token>", 20 random bytes hex-encoded, identifier `local` or 16 hex) and the 2025-11-18 src-cli validator (identifier any alphanumeric run, 40 hex body)', 'sgp_ + optional alphanumeric instance identifier + _ + exactly 40 hex; no checksum', at),
    corroboration: [th('sourcegraph/sourcegraph', 'sourcegraph'), gl],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1103; #1014 handoff sourcegraph.md, READY, T1 under R1 and R9 as of 2025-11-18). A Sourcegraph personal access token (SRC_ACCESS_TOKEN, sent as Authorization: token by src and the editor extensions) acts as the user on an instance: code search and navigation over every repository the user can see, batch changes and, for a site administrator, instance administration. T1 from provider code: the generator (2024-08 snapshot, last changed 2024-05) emits sgp_<identifier>_<40 hex> with the identifier `local` or 16 hex, the snapshot validator accepts 16 hex or local, and the 2025-11-18 src-cli validator widens the identifier to any alphanumeric run without changing the 40-hex body. The contract claims the newer, wider union (every issued identifier is inside both) and, following the validators, accepts an upper-case hex body although the generator emits lower case. The 32-byte identifier cap is detector policy, not a provider statement, so identifiers longer than 32 are unclaimed. Excluded: the bare 40-hex legacy token (no distinctive shape, collides with git SHAs), sgph_ (both validators accept it, nothing says what issues it), sgd_ + 64 hex (Cody Gateway derived key, one provider source), slk_ and product-subscription tokens (scanner-only) and sgp_ placeholders in docs. The Sourcegraph server repository is no longer public, so a post-2025 generator change cannot be ruled out. Pinned peers: trufflehog 3.97.4 sourcegraph and gitleaks 8.30.1 sourcegraph-access-token read sgp_ with a 16-hex or local identifier plus a bare 40-hex fallback, so they lag on an alphanumeric identifier and over-read bare hex.',
    fields: [
      field({ field: 'prefix', claim: 'sgp_ (lower case, case-sensitive)', basis: 'provider-documentation', status: 'frozen', sources: [src(GENERATOR, '"Personal access tokens have the form: sgp_<instance-identifier>_<token>"'), src(VALIDATOR_SNAPSHOT, 'sgp_ prefix in the validator regex'), src(ONEPASSWORD, 'PR #49989 introduced the sgp_ prefix to make tokens identifiable as secrets')], note: 'R1 and R9: provider generator and validator code.' }),
      field({ field: 'body', claim: 'exactly 40 hexadecimal characters, either case (the generator emits lower case; both validators accept [a-fA-F0-9])', basis: 'provider-documentation', status: 'frozen', sources: [src(GENERATOR, '20 random bytes hex-encoded'), src(VALIDATOR_SNAPSHOT, '[a-fA-F0-9]{40}'), src(SRC_CLI_VENDOR, 'the vendored validator keeps [a-fA-F0-9]{40}')], note: 'The body is the same in both validator eras.' }),
      field({ field: 'alphabet', claim: 'body [a-fA-F0-9]; instance identifier [A-Za-z0-9]; separators _ only', basis: 'provider-documentation', status: 'frozen', sources: [src(VALIDATOR_SNAPSHOT), src(SRC_CLI_VENDOR, 'identifier (?:[a-zA-Z0-9]+_)?')] }),
      field({ field: 'instance-identifier', claim: 'optional; `local`, 16 hex (issued) or any alphanumeric run (2025-11 validator), ended by _ and, when present, preceded by the sgp_ prefix', basis: 'provider-documentation', status: 'frozen', sources: [src(GENERATOR, 'InstanceIdentifierLength = 16; local or the first 16 hex of an HMAC of the license key'), src(VALIDATOR_SNAPSHOT, '(?:[a-fA-F0-9]{16}_|local_)?'), src(SRC_CLI_VENDOR, '(?:[a-zA-Z0-9]+_)?')], note: 'The detector claims the wider 2025 grammar, a union of what the provider accepts (the Polar era-union precedent).' }),
      field({ field: 'policy-union-grammar', claim: 'POLICY, not T1: the claimed identifier grammar is the union of the 2024 snapshot and the 2025-11 validator, because the server repository is no longer public and a later generator change cannot be ruled out', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF, 'supported shape and tier rationale'), src(SRC_CLI_VENDOR, 'newer validator widens, does not contradict')], note: 'If the maintainer confirms issuance (checklist in the handoff), this field can be retired.' }),
      field({ field: 'policy-identifier-cap', claim: 'POLICY, not T1: an identifier run longer than 32 bytes is not claimed (a detector cap so a long sgp_<word>_ cannot consume a line), although the 2025 validator accepts any length', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF, 'implementation notes and accepted false negatives')], note: 'The width-33 edge is authored as an unclaimed twin (DISPUTED_PROPERTIES, T0): no fixture asserts silence or detection on it.' }),
      field({ field: 'policy-boundary', claim: 'POLICY, not T1: a token glued to an identifier byte on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'case', claim: 'the prefix is matched case-sensitively: SGP_ is not claimed; the body accepts both cases', basis: 'provider-documentation', status: 'frozen', sources: [src(VALIDATOR_SNAPSHOT, 'case-sensitive sgp_ against [a-fA-F0-9] body'), src(HANDOFF, 'test axes')] }),
      field({ field: 'transport', claim: 'SRC_ACCESS_TOKEN sent as Authorization: token <value> (not Bearer) by src and the editor extensions; pasted into MCP server env blocks and src login command lines', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius and test axes')] }),
      field({ field: 'excluded-shapes', claim: 'sgph_ + 40 hex, sgd_ + 64 hex (Cody Gateway), slk_ tokens and the bare 40-hex legacy token are not claimed', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes'), src(CODY_TOKEN, 'sgd_ derived token, one provider source'), src(VALIDATOR_SNAPSHOT, 'sgph_ accepted, issuer unknown')], note: 'sgph_ and sgd_ are authored as unclaimed twins (DISPUTED_PROPERTIES, T0); the bare 40-hex form is represented only by a git-SHA control in a git context.' }),
      field({ field: 'peer-lag', claim: 'both pinned peers have a Sourcegraph rule (trufflehog sourcegraph, gitleaks sourcegraph-access-token) reading a 16-hex or local identifier or a bare 40-hex: lag on an alphanumeric identifier and overreach on bare hex are measured, not assumed', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS), src(GITLEAKS_CONFIG), src(GITLEAKS_1697, 'masked sgp_ pattern only')] }),
    ],
  },
};

const split = splitRegistered(authored, ['sourcegraph-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1214). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only (none). */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'sourcegraph-token': 'documented-24' };
