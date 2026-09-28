import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R2_R8, B434, product, at, src, reason } from './434-sources.ts';

// Issue #434, slice g: Beta.11 contracts for the Composio project (ak_), org (oak_) and user (uak_)
// API keys (#860 Tier A, READY; handoff docs/audits/evidence/860/composio.md; product
// redact-secret#909). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// The prefixes are provider-documented. Lengths and the nanoid alphabet come from a dated provider
// staff statement (2026-09-17, T1 under ruling R3), with the alphabet also in the provider's CLI
// redaction regexes (R2) and the ak_ + 20 width in its OpenAPI example. Ruling R6 makes the CLI code
// comment showing uak_ + 20 a T2 source that cannot override the stated 43. The handoff's one design
// choice, the ak_ mixed-case guard (at least one upper- and one lower-case letter in the body), is
// part of the ak_ contract: it removes snake_case and kebab-case identifiers at a ~6e-5 false-negative
// cost. The project key takes the handoff's detector id, composio-api-key, as its arrival id; oak_
// and uak_ are their own arrival families scored by finding type.
export const issue = '434g';

const STAFF_TH = 'https://github.com/trufflesecurity/trufflehog/issues/5321';
const STAFF_GL = 'https://github.com/gitleaks/gitleaks/issues/2276';
const TH_PR = 'https://github.com/trufflesecurity/trufflehog/pull/5322';
const OPENAPI = 'https://github.com/ComposioHQ/composio/blob/34484551843e575e79cca244d9fca3e4459f59e9/docs/public/openapi.json';
const CLI_REDACT = 'https://github.com/ComposioHQ/composio/blob/34484551843e575e79cca244d9fca3e4459f59e9/ts/packages/cli/src/analytics/dispatch.ts#L426-L427';
const CLI_COMMENT = 'https://github.com/ComposioHQ/composio/blob/34484551843e575e79cca244d9fca3e4459f59e9/ts/packages/cli/src/commands/login.cmd.ts#L801';
const SDK_CONST = 'https://github.com/ComposioHQ/composio/blob/34484551843e575e79cca244d9fca3e4459f59e9/ts/packages/core/src/utils/sdk.ts#L23';
const DOCS_AUTH = 'https://docs.composio.dev/reference/authenticating-to-composio';
const HANDOFF = handoff('composio.md');
const REFS = [DOCS_AUTH, STAFF_TH, STAFF_GL, TH_PR, OPENAPI, CLI_REDACT, SDK_CONST, CLI_COMMENT, HANDOFF, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R2_R8, product(909), B434];

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'composio-api-key', taxonomy: 'composio:project-api-key', issue,
    reason: reason('composio-api-key', 'composio_project_api_key', 909, 'The detector id is also this family\'s arrival id, so the project key graduates when the registry is re-pinned.') },
  { id: 'composio-org-api-key', taxonomy: 'composio:org-api-key', issue,
    reason: reason('composio-api-key', 'composio_org_api_key', 909, 'oak_ shares the composio-api-key detector, so after the re-pin it stays an arrival family scored by finding type.') },
  { id: 'composio-user-api-key', taxonomy: 'composio:user-api-key', issue,
    reason: reason('composio-api-key', 'composio_user_api_key', 909, 'uak_ shares the composio-api-key detector, so after the re-pin it stays an arrival family scored by finding type.') },
];

const shared = (prefix: string, width: number, header: string) => [
  field({ field: 'prefix', claim: prefix, basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_AUTH, `${header} header`), src(SDK_CONST)] }),
  field({ field: 'body', claim: `exactly ${width} characters`, basis: 'maintainer-observation', status: 'frozen', sources: [src(STAFF_TH, 'Composio Head of Security, 2026-09-17: ak_+20, oak_+20, uak_+43'), src(STAFF_GL), src(RULINGS_R1_R3, 'R3: a dated provider-staff statement is T1')], note: 'A provider-staff statement, recorded under the nearest basis; T1 by ruling R3 until a newer provider source contradicts it (none did at the 2026-09-28 re-check).' }),
  field({ field: 'alphabet', claim: 'URL-safe nanoid [A-Za-z0-9_-]; a body may start or end with _ or -', basis: 'provider-code', status: 'frozen', sources: [src(STAFF_TH), src(CLI_REDACT, '\\buak_[A-Za-z0-9_-]+, \\bak_[A-Za-z0-9_-]+'), src(RULINGS_R2_R8, 'R2')] }),
  field({ field: 'separators', claim: 'none; no checksum', basis: 'maintainer-observation', status: 'frozen', sources: [src(STAFF_TH)] }),
  field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; this keeps ak_ inside oak_/uak_/cak_ from reading as a project key', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'separability')] }),
  field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1; the staff-authored trufflehog PR #5322 (20/20/43 over [A-Za-z0-9_-]) is still open', basis: 'tool', status: 'frozen', sources: [src(TH_PR, 'open, updated 2026-09-28'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no composio rule')] }),
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'composio-api-key': {
    tier: 'T1',
    pattern: '^ak_(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])[A-Za-z0-9_-]{20}$',
    providerSource: provider(STAFF_TH, 'provider staff statement of 2026-09-17 (ak_ + 20 nanoid) and the provider OpenAPI example (ak_ + 20)', 'a dated statement by Composio\'s Head of Security (ruling R3) and the provider OpenAPI example fix ak_ + exactly 20 [A-Za-z0-9_-]; the docs name the prefix and the x-api-key header', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#909; #860 handoff composio.md, READY). The project key has full access to one project and its connected third-party accounts. T1 on every fact: documented prefix, a dated provider-staff statement (R3) for the width and alphabet, the OpenAPI example for the width and the CLI redaction regex for the alphabet (R2). The short ak_ prefix with a _/- alphabet would match snake_case and kebab-case identifiers, so the contract carries the handoff\'s mixed-case guard (at least one upper- and one lower-case letter; ~6e-5 of random bodies fail it, an accepted false negative), and all-lower/all-upper bodies back twins. A mixed-case 20-byte identifier after ak_ remains an accepted false positive. bkend.ai\'s ak_ + 64 hex is another provider\'s credential and a twin, not a control. Neither pinned peer has a Composio rule.',
    fields: [
      ...shared('ak_', 20, 'x-api-key'),
      field({ field: 'openapi-example', claim: 'ak_ + 20 in the provider OpenAPI example', basis: 'provider-example', status: 'frozen', sources: [src(OPENAPI)] }),
      field({ field: 'mixed-case-guard', claim: 'the body has at least one uppercase and at least one lowercase letter', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'the ak_ short-prefix guard'), src(product(909), 'adopted')], note: 'A precision choice, not a provider fact: P(no uppercase) = P(no lowercase) ≈ 3.0e-5 for a uniform body. A digit requirement was rejected (P(no digit) ≈ 3.3%).' }),
      field({ field: 'other-provider', claim: 'bkend.ai issues ak_ + 64 hex', basis: 'community', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'Another provider\'s credential: a length twin, never a benign control.' }),
      field({ field: 'unshaped-siblings', claim: 'ck_ consumer keys and cak_ agent keys have no known length or alphabet', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Only their obvious placeholders (ck_..., ck_test_dummy, cak_e2e_agent) are benign controls; no key-shaped ck_ or cak_ value is authored.' }),
    ],
  },
  'composio-org-api-key': {
    tier: 'T1',
    pattern: '^oak_[A-Za-z0-9_-]{20}$',
    providerSource: provider(STAFF_TH, 'provider staff statement of 2026-09-17 (oak_ + 20 nanoid)', 'a dated statement by Composio\'s Head of Security (ruling R3) fixes oak_ + exactly 20 [A-Za-z0-9_-]; the docs name the prefix and the x-org-api-key header', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#909; #860 handoff composio.md, READY). The organization key (x-org-api-key, COMPOSIO_ORG_API_KEY). T1: documented prefix, dated provider-staff statement (R3) for the 20-byte nanoid body. The oak_ prefix is distinctive enough without the ak_ guard, so an all-lowercase body is in contract. Neither pinned peer has a Composio rule.',
    fields: shared('oak_', 20, 'x-org-api-key'),
  },
  'composio-user-api-key': {
    tier: 'T1',
    pattern: '^uak_[A-Za-z0-9_-]{43}$',
    providerSource: provider(STAFF_TH, 'provider staff statement of 2026-09-17 (uak_ + 43 nanoid); the SDK constant names uak_', 'a dated statement by Composio\'s Head of Security (ruling R3) fixes uak_ + exactly 43 [A-Za-z0-9_-]; a CLI code comment showing uak_ + 20 is T2 under ruling R6 and does not override it', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#909; #860 handoff composio.md, READY under R6). The user key is issued by composio login (x-user-api-key, COMPOSIO_USER_API_KEY). T1 for 43: the dated staff statement (R3); the CLI code comment showing uak_ + 20 is T2 (R6), so a 20-byte uak_ is outside the contract and a length twin. The optional issuance check would confirm or contradict the width; a contradiction changes the contract through a follow-up, never by widening. Neither pinned peer has a Composio rule.',
    fields: [
      ...shared('uak_', 43, 'x-user-api-key'),
      field({ field: 'code-comment-width', claim: 'a CLI code comment shows uak_ + 20', basis: 'provider-code', status: 'unresolved', sources: [src(CLI_COMMENT), src(RULINGS_R2_R8, 'R6: a code comment is T2')], note: 'Cannot override the T1 43. uak_ + 20 backs a length twin; the issuance check (handoff checklist) is the confirmation.' }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'composio-api-key': 'documented-24',
  'composio-org-api-key': 'documented-24',
  'composio-user-api-key': 'documented-24',
};
