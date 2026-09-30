import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, gl, th } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, R1014, RULINGS_R1_R3, B528, product, at, src, GITLEAKS_CONFIG, splitGraduated } from './528-sources.ts';

// Issue #528, slice d: Beta.12 contract for the RubyGems.org API key (#1014 rank 4, READY; handoff
// docs/audits/evidence/1014/rubygems.md; product redact-secret#1023). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 for all three facts under R1: generate_rubygems_key returns "rubygems_#{SecureRandom.hex(24)}", and
// SecureRandom.hex emits lowercase hex. OIDC-exchanged short-lived keys come from the same generator and are covered.
export const issue = '528d';

const GENERATOR = 'https://github.com/rubygems/rubygems.org/blob/d4cfcc961d08cb5f661f2e5dc0081736233b97ec/app/controllers/concerns/api_keyable.rb#L19-L21';
const HANDOFF = handoff('rubygems.md');
const RESEARCH = researchTable('5900447282');

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'rubygems-api-key': {
    tier: 'T1',
    pattern: '^rubygems_[0-9a-f]{48}$',
    providerSource: provider(GENERATOR, 'rubygems/rubygems.org app/controllers/concerns/api_keyable.rb (d4cfcc9, last changed 2026-03-03): generate_rubygems_key returns "rubygems_#{SecureRandom.hex(24)}"; re-checked 2026-09-29', 'rubygems_ + exactly 48 lowercase hex (24 random bytes), 57 in all; no checksum', at),
    corroboration: [{ tool: gl.tool, label: 'rubygems-api-token: \\b(rubygems_[a-f0-9]{48}) + a trailing delimiter', url: gl.url }, th('rubygems/rubygems', 'RubyGems: \\b(rubygems_[a-zA0-9]{48})\\b (a class typo: a-z, A and 0-9)')],
    references: [GENERATOR, HANDOFF, RESEARCH, HANDOFF_INDEX, R1014, RULINGS_R1_R3, product(1023), B528],
    review: 'Arrival evidence (#528, product redact-secret#1023; #1014 handoff rubygems.md, READY). A key can push and yank gems and manage owners within its scopes, so a leak is a supply-chain risk for every gem the account owns. T1 for the prefix, the 48-byte length and the lowercase-hex alphabet under R1, from the provider\'s own generator; OIDC-exchanged keys share it. RubyGems sends the key in Authorization without a scheme. Excluded: legacy unprefixed keys (no shape; generic context covers GEM_HOST_API_KEY= and :rubygems_api_key:), rubygems_version and rubygems_mfa_required metadata keys (they fail the body) and uppercased copies. gitleaks 8.30.1 agrees with the grammar but also requires a trailing delimiter; trufflehog 3.97.4 reads a wider class (any lowercase letter and A), so it overreaches on a non-hex letter twin.',
    fields: [
      field({ field: 'prefix', claim: 'rubygems_', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR)] }),
      field({ field: 'body', claim: 'exactly 48 lowercase hex [0-9a-f] (SecureRandom.hex(24)); 57 in all', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR)] }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'GEM_HOST_API_KEY; the :rubygems_api_key: line of ~/.gem/credentials; Authorization with the bare key (no scheme)', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'test axes')] }),
      field({ field: 'metadata-keys', claim: 'rubygems_version and rubygems_mfa_required are gemspec metadata keys, not credentials', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'Benign controls: they fail the 48-hex body.' }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 rubygems-api-token is \\b(rubygems_[a-f0-9]{48}) followed by a quote, backtick, whitespace, ; or end: it agrees with the grammar and lags only where the key is followed by another byte. trufflehog 3.97.4 RubyGems is \\b(rubygems_[a-zA0-9]{48})\\b, whose class admits any lowercase letter and A, so it overreaches on a non-hex body. Both labels map to rubygems-api-key', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'rubygems-api-token'), src('https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/rubygems/rubygems.go', 'RubyGems')] }),
    ],
  },
};

const split = splitGraduated(authored, ['rubygems-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'rubygems-api-key': 'documented-24' };
