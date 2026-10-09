import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th } from '../contract-sources.ts';
import { handoff, RERANK, R860, RULINGS_R2_R8, B436, product, at, src, splitGraduated } from './436-sources.ts';

// Issue #436, slice e: Beta.11 contract for the Apify API token (#860 Tier B, READY with an open-ended
// body; handoff docs/audits/evidence/860/apify.md; product redact-secret#916). Owned by this slice only;
// see docs/specs/beta8-evidence.md.
//
// T1: the apify_api_ prefix is the provider's docs placeholder (ruling R4); the alphabet and the 20-byte
// floor are the provider-authored leak linter in apify/awesome-skills (ruling R2, authorship checked in
// the handoff). No provider source states an exact length or an upper bound: the 128-byte cap is the
// product's streaming policy, so no fixture asserts silence on a longer run (the provider's own rule
// would flag it). trufflehog's exact 36 is T2 and not used.
export const issue = '436e';

const LINT = 'https://github.com/apify/awesome-skills/blob/main/scripts/lint_references.py';
const LINT_COMMIT = 'https://github.com/apify/awesome-skills/commit/4ba9177da814';
const DOCS_API = 'https://docs.apify.com/api/v2';
const DOCS_INTEGRATIONS = 'https://docs.apify.com/platform/integrations/api';
const MCP_SERVER = 'https://github.com/apify/apify-mcp-server';
const HANDOFF = handoff('apify.md');

export const APIFY_PATTERN = '^apify_api_[A-Za-z0-9]{20,}$';

/** No arrival family remains: the family graduated to a registry detector at the 1127bf9 re-pin (redact-secret PR #938). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'apify-api-token': {
    tier: 'T1',
    pattern: APIFY_PATTERN,
    providerSource: provider(LINT, 'apify/awesome-skills lint_references.py TOKEN_RE = apify_api_[A-Za-z0-9]{20,} (added in 4ba9177 by an Apify collaborator, 2026-08-12; ruling R2) and the apify_api_... docs placeholders (ruling R4)', 'apify_api_ + at least 20 alphanumerics, open-ended; no separator or checksum', at),
    corroboration: [th('apify/apify', 'Apify: \\b(apify\\_api\\_[a-zA-Z-0-9]{36})\\b, exact 36 (T2, not used)')],
    references: [LINT, LINT_COMMIT, DOCS_API, DOCS_INTEGRATIONS, MCP_SERVER, HANDOFF, RERANK, R860, RULINGS_R2_R8, product(916), B436],
    review: 'Arrival evidence (#436, product redact-secret#916; #860 handoff apify.md, READY with an open-ended body). T1: the prefix is the provider\'s docs placeholder apify_api_... (R4), and the alphabet and the 20-byte floor are the provider-authored leak linter TOKEN_RE = apify_api_[A-Za-z0-9]{20,} (R2; the handoff checked the author and that it matches no public scanner rule). No provider source states an exact width: trufflehog\'s exact 36 is T2, and the product\'s 128-byte cap is streaming policy, so positives carry 20, 36 and 128 and nothing asserts silence on a longer run. Excluded: apify_ui_ Console tokens (prefix T1 under R6 but no shape), Actor-run, integration and webhook-dispatch tokens (no public shape), the unprefixed proxy password, placeholders whose _ or . breaks the run below 20, and APIFY_API_ identifiers (the prefix is case-sensitive).',
    fields: [
      field({ field: 'prefix', claim: 'apify_api_', basis: 'provider-example', status: 'frozen', sources: [src(DOCS_INTEGRATIONS, 'apify_api_... placeholders'), src(RULINGS_R2_R8, 'R4: a placeholder is T1 for its prefix')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9]', basis: 'provider-code', status: 'frozen', sources: [src(LINT, 'TOKEN_RE'), src(LINT_COMMIT, 'provider-authored, R2')] }),
      field({ field: 'floor', claim: 'at least 20 body characters, open-ended', basis: 'provider-code', status: 'frozen', sources: [src(LINT, '{20,}'), src(RULINGS_R2_R8, 'R2')] }),
      field({ field: 'upper-bound', claim: 'the product caps the run at 128 for streaming', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'project policy; the only observed width is 36')], note: 'Not a provider fact, and the provider\'s own rule would flag a longer run: positives reach 128, and no fixture asserts silence on 129.' }),
      field({ field: 'observed-width', claim: 'every observed token body is 36', basis: 'tool', status: 'provisional', sources: [src(th('apify/apify').url, 'exact 36')], note: 'Default positives carry 36; the 20 and 128 positives exercise the provider floor and the policy cap.' }),
      field({ field: 'console-token', claim: 'apify_ui_ Console tokens are a separate credential whose length and alphabet no source states', basis: 'provider-code', status: 'unresolved', sources: [src(MCP_SERVER, 'startsWith(UI_TOKEN_PREFIX), R6'), src(HANDOFF)], note: 'Only the short apify_ui_test identifier appears, as a control; no full Console token is authored either way.' }),
      field({ field: 'transport', claim: 'the APIFY_TOKEN environment variable, sent as Authorization: Bearer or a token query parameter', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_API)] }),
      field({ field: 'peer-lag', claim: 'trufflehog 3.97.4 has an apify detector (exact 36); gitleaks 8.30.1 has no Apify rule', basis: 'tool', status: 'frozen', sources: [src(th('apify/apify').url), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no apify rule')] }),
    ],
  },
};

const split = splitGraduated(authored, ['apify-api-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 1127bf9 re-pin (redact-secret PR #938). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'apify-api-token': 'documented-24' };
