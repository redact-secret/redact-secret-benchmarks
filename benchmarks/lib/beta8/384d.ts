import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { field } from '../contract-sources.ts';

// Issue #384, slice d: Beta.10 contracts for the Together AI and Tavily API keys (research
// redact-secret#783 and #786; product redact-secret#867). Owned by that issue only; see
// docs/specs/beta8-evidence.md.
//
// Both are T2 and pending hands-on corroboration. No Together page states a prefix, length or
// alphabet; Tavily's docs show the tvly- prefix only in placeholders and truncated samples. Neither
// family has a pinned trufflehog or gitleaks rule (trufflehog 3.97.4 has no Together or
// Tavily detector and gitleaks 8.30.1 no rule), so each contract is corroborated by non-pinned
// scanner rules plus maintainer-observed samples.
//
// Registry. redact-secret#867 (product PR #869, merge cfe2aec) added both as registry detectors,
// `together-ai-api-key` and `tavily-api-key`. The Together arrival id `together-api-key` was renamed
// to the detector id so the family graduates at that re-pin; the taxonomy id is unchanged.
//
// redact-secret#870 (merge 735797a) fixes the tvly-YOUR_API_KEY placeholder false alarm this module's
// docs-bearer-placeholder control exercised. With that gone, tavily-api-key clears the corroborated
// empirical route on the record already in benchmarks/support/empirical-observations.json (4 references,
// 4 owners, peer-scanner-rule/provider-example/independent-research) and the 40-fixture profile below.
export const issue = '384d';

const at = '2026-09-26';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

const TG_QUICKSTART = 'https://docs.together.ai/docs/quickstart';
const TG_KEYS = 'https://docs.together.ai/docs/api-keys-authentication';
const TG_PY = 'https://github.com/togethercomputer/together-python/blob/main/src/together/client.py';
const TG_BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/togetherai.go';
const TG_BLOG = 'https://andrewbaker.ninja/2026/08/20/running-sota-open-ai-models-in-opencode-without-paying-frontier-prices/';
const R783 = 'https://github.com/redact-secret/redact-secret/issues/783';
const TV_AUTH = 'https://docs.tavily.com/documentation/api-reference/introduction';
const TV_GENERATE = 'https://docs.tavily.com/documentation/enterprise/generate-keys';
const TV_KEYINFO = 'https://docs.tavily.com/documentation/enterprise/key-info';
const TV_CODE = 'https://github.com/tavily-ai/tavily-js/blob/main/src/client.ts';
const TV_NOSEYPARKER = 'https://github.com/praetorian-inc/noseyparker/blob/main/crates/noseyparker/data/default/builtin/rules/tavily.yml';
const TV_GITGUARDIAN = 'https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/tavily_api_key';
const R786 = 'https://github.com/redact-secret/redact-secret/issues/786';
const R867 = 'https://github.com/redact-secret/redact-secret/issues/867';

/** Both families graduated to registry detectors at the cfe2aec pin (redact-secret#867). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** No arrival contract remains in this module. */
export const contracts: Record<string, FormatContract> = {};

/** Contracts for this issue's families, registry detectors since redact-secret#867 (registry pinned at cfe2aec). */
export const registryContracts: Record<string, FormatContract> = {
  'together-ai-api-key': {
    tier: 'T2',
    pattern: '^tgp_v1_[A-Za-z0-9_-]{43}$',
    corroboration: [{ tool: 'betterleaks', label: 'togetherai-api-key: tgp_v1_[A-Za-z0-9_-]{43} (Kingfisher aliases it, so it is not independent)', url: TG_BETTERLEAKS }],
    references: [TG_QUICKSTART, TG_KEYS, TG_PY, TG_BLOG, R783, R867],
    review: 'Arrival evidence (#384, product redact-secret#867; research #783). T2 pending hands-on corroboration: no Together page, staff statement or SDK code states the tgp_v1_ prefix, a length or an alphabet. The shape rests on one scanner rule (betterleaks, with a negative test for a 32-character body and for tgp_v2_), a third-party blog that says keys look like tgp_v1_..., and a first-page GitHub code-search measurement in which the four full-length bodies were 43 base64url characters mixing upper case, lower case, digits, - and _. Neither pinned scanner has a Together rule. Together documents a second, deprecated legacy key population whose format is unknown, so legacy keys are not claimed and stay generic-token-only. Whether a tgp_v2_ exists is unknown, so no fixture asserts silence on it.',
    fields: [
      field({ field: 'prefix', claim: 'tgp_v1_', basis: 'tool', status: 'frozen', sources: [src(TG_BETTERLEAKS), src(TG_BLOG, 'community blog: keys look like tgp_v1_...'), src(R783, 'code-search measurement, maintainer observation')], note: 'No provider source; the versioned prefix is a tool rule plus observation.' }),
      field({ field: 'body', claim: '43 characters of [A-Za-z0-9_-] (50 in all)', basis: 'tool', status: 'frozen', sources: [src(TG_BETTERLEAKS), src(R783, 'four full-length samples, first page only')], note: 'One scanner lineage and n=4 observed bodies; entropy filter 3.0 in betterleaks.' }),
      field({ field: 'legacy-keys', claim: 'deprecated legacy project-less keys with an undocumented format', basis: 'provider-documentation', status: 'unresolved', sources: [src(TG_KEYS, 'legacy keys are deprecated and cannot be scoped or revoked, only regenerated')], note: 'A common belief of a 64-hex body was searched and found nowhere; it is not assumed.' }),
      field({ field: 'other-versions', claim: 'whether tgp_v2_ or another version exists', basis: 'research-hypothesis', status: 'unresolved', sources: [src(TG_BETTERLEAKS, 'tgp_v2_ appears only as a negative test'), src(R783)], note: 'No fixture asserts silence on a different version.' }),
      field({ field: 'transport', claim: 'TOGETHER_API_KEY environment variable, the api_key argument, Authorization: Bearer', basis: 'provider-documentation', status: 'frozen', sources: [src(TG_QUICKSTART), src(TG_PY, 'provider code: api_key, then TOGETHER_API_KEY; optional TOGETHER_BASE_URL')] }),
      field({ field: 'checksum', claim: 'no checksum or fixed inner segment is documented or observed', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R783)] }),
    ],
  },
  'tavily-api-key': {
    tier: 'T2',
    pattern: '^tvly-(?:dev-)?[A-Za-z0-9]{32}$',
    corroboration: [{ tool: 'noseyparker', label: 'np.tavily.1: \\b(tvly-[a-zA-Z0-9]{32})\\b (predates tvly-dev-, so it misses that form)', url: TV_NOSEYPARKER }, { tool: 'GitGuardian', label: 'Tavily API Key detector: prefixed, no length stated', url: TV_GITGUARDIAN }],
    references: [TV_AUTH, TV_GENERATE, TV_KEYINFO, TV_CODE, R786, R867],
    review: 'Arrival evidence (#384, product redact-secret#867; research #786). T2 pending hands-on corroboration: Tavily\'s docs show the tvly- prefix in a placeholder (tvly-YOUR_API_KEY) and tvly-dev- in truncated sample values, and state no length or alphabet. The 32-alphanumeric body rests on one scanner rule (noseyparker, which predates tvly-dev- and so cannot match that form) and three maintainer-observed samples from 2024-2025 (tvly- and tvly-dev-, each with a 32-character mixed-case alphanumeric body). GitGuardian confirms a prefixed detector without a length. Whether a tvly-prod- prefix exists and the width of production or enterprise keys are unresolved (a third-party integration doc says production keys begin with plain tvly-), so no fixture asserts silence on either. Neither pinned scanner has a Tavily rule.',
    fields: [
      field({ field: 'prefix', claim: 'tvly-', basis: 'provider-example', status: 'frozen', sources: [src(TV_AUTH, 'Authorization: Bearer tvly-YOUR_API_KEY (a placeholder)'), src(TV_KEYINFO)], note: 'A placeholder, not a stated format.' }),
      field({ field: 'dev-segment', claim: 'the optional dev- segment: tvly-dev- + body', basis: 'provider-example', status: 'frozen', sources: [src(TV_GENERATE, 'truncated sample keys tvly-dev-...')], note: 'Replaced or coexists with the bare form since 2025: undocumented. Positives carry both forms.' }),
      field({ field: 'body', claim: '32 alphanumeric characters after the last hyphen', basis: 'tool', status: 'frozen', sources: [src(TV_NOSEYPARKER), src(R786, 'three full-width samples in 2024-2025, maintainer observation')], note: 'One scanner rule and n=3 observed bodies; no provider statement.' }),
      field({ field: 'production-prefix', claim: 'whether tvly-prod- exists, and the width of production and enterprise expiring keys', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R786), src(TV_GENERATE, 'the {key_type}-{expiration}-#{index} form is the key name, not the secret')], note: 'No fixture asserts silence on tvly-prod- or on a longer body.' }),
      field({ field: 'transport', claim: 'Authorization: Bearer, the api_key JSON body field, the TAVILY_API_KEY environment variable and the remote-MCP tavilyApiKey query parameter', basis: 'provider-code', status: 'frozen', sources: [src(TV_CODE), src(TV_AUTH)] }),
      field({ field: 'non-secrets', claim: 'the tvly CLI name, the key-name field and search request_id values are not credentials', basis: 'provider-documentation', status: 'frozen', sources: [src(TV_GENERATE), src(R786)] }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'together-ai-api-key': 'arrival-24',
  // Product fix redact-secret#870 removes the tvly-YOUR_API_KEY placeholder false alarm; the family now clears the
  // corroborated empirical route (4 references, 4 owners, peer-scanner-rule/provider-example/independent-research) and the 40-fixture profile.
  'tavily-api-key': 'empirical-40',
};
