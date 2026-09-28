import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, RULINGS_R1_R3, B434, product, at, src, reason } from './434-sources.ts';

// Issue #434, slice f: Beta.11 contract for the Firecrawl API key (#860 Tier A, READY; handoff
// docs/audits/evidence/860/firecrawl.md; product redact-secret#908). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// The fc- prefix is provider-documented; the body is a dashless lowercase random UUIDv4 by the
// provider's server normalizer, schema default and validator (ruling R1), so the version (byte 12
// = 4) and variant (byte 16 in 8 9 a b) nibbles are part of the contract. The arrival id is the
// handoff's detector id, firecrawl-api-key.
export const issue = '434f';

const TREE = 'https://github.com/firecrawl/firecrawl/tree/f75a8d40b103129f56f947418bfa06a04a9ad5b0';
const PARSE = 'https://github.com/firecrawl/firecrawl/blob/f75a8d40b103129f56f947418bfa06a04a9ad5b0/apps/api/src/lib/parseApi.ts';
const SCHEMA = 'https://github.com/firecrawl/firecrawl/blob/f75a8d40b103129f56f947418bfa06a04a9ad5b0/apps/api/src/db/schema/public.ts#L68-L72';
const AUTH = 'https://github.com/firecrawl/firecrawl/blob/f75a8d40b103129f56f947418bfa06a04a9ad5b0/apps/api/src/controllers/auth.ts#L757-L795';
const SDK = 'https://github.com/firecrawl/firecrawl/blob/f75a8d40b103129f56f947418bfa06a04a9ad5b0/apps/js-sdk/firecrawl/src/v2/client.ts#L154';
const DOCS = 'https://docs.firecrawl.dev/api-reference/v2-introduction';
const HANDOFF = handoff('firecrawl.md');

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'firecrawl-api-key', taxonomy: 'firecrawl:api-key', issue, reason: reason('firecrawl-api-key', 'firecrawl_api_key', 908, 'The detector id is also this family\'s arrival id, so it graduates when the registry is re-pinned.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'firecrawl-api-key': {
    tier: 'T1',
    pattern: '^fc-[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$',
    providerSource: provider(PARSE, 'parseApi.ts strips fc- and re-inserts the 8-4-4-4-12 dashes (last changed 2026-05-15, re-checked 2026-09-28); api_keys.key is uuid().defaultRandom()', 'the docs and SDK document the fc- prefix; provider server code (ruling R1) makes the body a dashless lowercase random UUIDv4 (32 hex, version nibble 4, variant 8/9/a/b), 35 in all', at),
    corroboration: [],
    references: [DOCS, TREE, PARSE, SCHEMA, AUTH, SDK, HANDOFF, HANDOFF_INDEX, R860, RULINGS_R1_R3, product(908), B434],
    review: 'Arrival evidence (#434, product redact-secret#908; #860 handoff firecrawl.md, READY). A Firecrawl key spends the team\'s crawl and scrape credits and is common in agent web tools and MCP servers. The prefix is documented and checked by the SDK and MCP server; the body is a dashless Postgres random UUIDv4 by the server normalizer, schema default and validator (R1), so the version and variant nibbles are enforced, rejecting 63 of 64 arbitrary 32-hex runs (an fc- + MD5, say) at no cost for issued keys. Excluded: legacy bare dashed UUIDs (not attributable), fc- + a dashed UUID (not an issued form), another UUID version or variant, uppercase hex, fco_ and fcmcp_. Neither pinned peer has a Firecrawl rule.',
    fields: [
      field({ field: 'prefix', claim: 'fc-', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(SDK, "startsWith('fc-')")] }),
      field({ field: 'body', claim: 'exactly 32 lowercase hex: a dashless UUID', basis: 'provider-code', status: 'frozen', sources: [src(PARSE), src(SCHEMA, 'uuid("key").defaultRandom()'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'uuid-v4-nibbles', claim: 'body byte 12 is 4 and body byte 16 is one of 8 9 a b', basis: 'provider-code', status: 'frozen', sources: [src(SCHEMA, 'a Postgres random UUIDv4'), src(AUTH, 'UUID_RE')], note: 'The validator would accept versions 1–8; issued keys are v4, so other nibbles back twins.' }),
      field({ field: 'separators', claim: 'none after the prefix; no checksum', basis: 'provider-code', status: 'frozen', sources: [src(PARSE)] }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; CSS and calendar classes such as fc-daygrid-day are glued or fail the body', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')] }),
      field({ field: 'legacy-keys', claim: 'bare dashed UUID keys from before 2024-04-16 are still accepted by parseApi', basis: 'provider-code', status: 'frozen', sources: [src(PARSE, 'legacy passthrough')], note: 'Not attributable to Firecrawl: excluded, and never a benign control either (a dashed UUID is authored only as a request id).' }),
      field({ field: 'other-credentials', claim: 'fco_ OAuth access tokens and fcmcp_ MCP delegated credentials have no documented fixed grammar', basis: 'provider-code', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Not authored either way.' }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no firecrawl detector directory'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no firecrawl rule')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'firecrawl-api-key': 'documented-24' };
