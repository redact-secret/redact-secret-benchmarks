import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, research, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R9_R10, B464, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './464-sources.ts';

// Issue #464, slice a: Beta.12 contract for the Daytona API key (#860, READY by ruling R9; handoff
// docs/audits/evidence/860/daytona.md; product redact-secret#970). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 as of v0.190.0 (2026-06-23) under R1 and R9: the prefix, the 32-random-byte length and the lowercase-hex
// encoding come from the provider's own generator. Core development moved to a private codebase after that
// release, so the contract is dated, not current: a newer provider source that contradicts it re-opens it.
export const issue = '464a';

const GENERATOR = 'https://github.com/daytonaio/daytona/blob/01c502bb1f1ff8f2885d0cd490e043736083dca8/apps/api/src/common/utils/api-key.ts#L8-L18';
const INLINE_FORM = 'https://github.com/daytonaio/daytona/blob/5271af9f13fd/apps/api/src/api-key/api-key.service.ts#L27';
const DOCS = 'https://www.daytona.io/docs/llms-full.txt';
const HANDOFF = handoff('daytona.md');
const RESEARCH = research('daytona.md');

export const DAYTONA_PATTERN = '^dtn_[0-9a-f]{64}$';

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1037). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'daytona-api-key': {
    tier: 'T1',
    pattern: DAYTONA_PATTERN,
    providerSource: provider(GENERATOR, 'daytonaio/daytona v0.190.0 (01c502b): generateApiKeyValue() = dtn_ + crypto.randomBytes(32).toString(\'hex\'); the same inline form since 5271af9 (2025-04-28); re-checked 2026-09-28 (no newer provider source)', 'dtn_ + exactly 64 lowercase hex (32 random bytes), 68 in all; no separator or checksum; T1 as of v0.190.0 (2026-06-23) under R9', at),
    corroboration: [],
    references: [GENERATOR, INLINE_FORM, DOCS, HANDOFF, RESEARCH, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R9_R10, product(970), B464],
    review: 'Arrival evidence (#464, product redact-secret#970; #860 handoff daytona.md, READY by ruling R9). T1 as of v0.190.0 (2026-06-23): the provider generator returns dtn_ + 32 random bytes hex-encoded, and the same inline form has existed since 2025-04-28 (R1). Core development moved to a private codebase in June 2026, so nothing public shows the live cloud still issues the shape; R9 extends R3\'s date rule to provider code, so the contract stands as of that date until a newer provider source contradicts it. Every later public source (the daytona/clients OpenAPI and CLI, helm-charts scripts, SDK 0.218.0, the docs dump) is prefix-only and none contradicts it. Without the prefix the body is SHA-256 shaped, so the prefix is load-bearing. The same generator mints region proxy, SSH-gateway and runner keys, which are lexically identical. Excluded: dtn_secret_ Secrets-feature placeholders, dtn_artifact_ stdout markers, unprefixed self-provisioned runner keys (openssl rand -hex 32), legacy self-hosted base64-UUID keys, caller-supplied values, DAYTONA_JWT_TOKEN (jwt keeps it) and dtn_*** or short OpenAPI placeholders.',
    fields: [
      field({ field: 'prefix', claim: 'dtn_', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'generateApiKeyValue'), src(DOCS, 'DAYTONA_API_KEY=dtn_*** (prefix only)')] }),
      field({ field: 'body', claim: 'exactly 64 lowercase hex [0-9a-f] (32 random bytes); 68 in all', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'randomBytes(32).toString(hex)'), src(INLINE_FORM, 'the same inline form since 2025-04-28'), src(RULINGS_R9_R10, 'R9: T1 as of the generator date')], note: 'Dated: T1 as of v0.190.0 (2026-06-23), not a claim about the live cloud. A post-v0.190.0 format change is an accepted false negative.' }),
      field({ field: 'separators', claim: 'none; no checksum', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR)] }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; this keeps dtn_secret_ and dtn_artifact_ identifiers unclaimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'the DAYTONA_API_KEY environment variable, sent as Authorization: Bearer; Daytona(DaytonaConfig(api_key=...)) and the Terraform provider variable', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'test axes')] }),
      field({ field: 'self-provisioned-runner-key', claim: 'a self-provisioned runner key is unprefixed 64 hex (openssl rand -hex 32), lexically a SHA-256', basis: 'research-hypothesis', status: 'frozen', sources: [src(RESEARCH, 'excluded shapes')], note: 'No prefix, not attributable: a bare 64-hex value is an encoded-value control, never a positive.' }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no daytona detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no daytona rule')] }),
    ],
  },
};

const split = splitGraduated(authored, ['daytona-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1037). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'daytona-api-key': 'documented-24' };
