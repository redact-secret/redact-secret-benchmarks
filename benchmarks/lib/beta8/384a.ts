import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, gl, provider, field } from '../contract-sources.ts';

// Issue #384, slice a: Beta.10 contracts for the Anthropic sk-ant-api01- and
// sk-ant-admin01- prefixes (research redact-secret#776, #775; product
// redact-secret#862) and the OpenAI sk-admin- reconciliation (research
// #777; product #863). Owned by that issue only; see docs/specs/beta8-evidence.md.
//
// All three are arrival families: the product extends the existing shared detectors
// (anthropic-token, openai-token) rather than registering new ones, so a taxonomy
// family that mapped to the registry detector id would still not distinguish
// per-family status. Product PR #882 (redact-secret#774) has since given each of
// these three prefixes its own finding type (anthropic_enterprise_api_key,
// anthropic_admin_api_key, openai_admin_api_key), so each is now scored by finding
// type via scanners/families.mjs's arrivalFindingTypes (docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md)
// while remaining an arrival id with its own contract, profile and ledger rows
// (docs/specs/beta8-evidence.md, "Finding types inside a shared detector").
//
// The anthropic-token and openai-token registry contracts are not edited: they still claim
// only sk-ant-api03- and the sk-proj-/sk-svcacct- widths. Four existing common-formats twins
// (anthropic-token-api03-{compliance,admin}-prefix-{plain,unicode-crlf}-twin) use sk-ant-api01- and
// sk-ant-admin01- as negatives of api03; once redact-secret#862 lands they read as keys, so they
// must be re-scoped in the same change that re-pins the registry (docs/reports/2026-09-27/beta-10-credential-corpus-handoff.md).
export const issue = '384a';

const at = '2026-09-26';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

const ANT_ADMIN_KEYS = 'https://platform.claude.com/docs/en/manage-claude/admin-api-keys';
const ANT_ADMIN_API = 'https://platform.claude.com/docs/en/manage-claude/admin-api';
const ANT_COMPLIANCE = 'https://platform.claude.com/docs/en/manage-claude/compliance-api-access';
const ANT_AUTH = 'https://platform.claude.com/docs/en/manage-claude/authentication';
const R775 = 'https://github.com/redact-secret/redact-secret/issues/775';
const R776 = 'https://github.com/redact-secret/redact-secret/issues/776';
const R777 = 'https://github.com/redact-secret/redact-secret/issues/777';
const TH_ANTHROPIC_PR = 'https://github.com/trufflesecurity/trufflehog/pull/3969';
const BETTERLEAKS_ANTHROPIC = 'https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/anthropic.go';
const OPENAI_CODEX = 'https://github.com/openai/codex/blob/418199f6ade4f9018b1f0b455a685387a811ad2e/codex-rs/network-proxy/src/credential_broker/providers/openai.rs#L13-L23';
const TH_OPENAI_ISSUE = 'https://github.com/trufflesecurity/trufflehog/issues/4698';

/** Families measured here that no registry detector targets. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'anthropic-api01-key', taxonomy: 'anthropic:compliance-access-key', issue,
    reason: 'redact-secret#862 extends anthropic-token with the sk-ant-api01- prefix. Product PR #882 (redact-secret#774) splits it out of the shared anthropic_api_key type into its own anthropic_enterprise_api_key finding type. The registry anthropic-token contract still claims sk-ant-api03- only, so sk-ant-api01- is measured as its own arrival family — scored by finding type (scanners/families.mjs arrivalFindingTypes) rather than by a distinct registry detector id.' },
  { id: 'anthropic-admin01-key', taxonomy: 'anthropic:admin-api-key', issue,
    reason: 'redact-secret#862 extends anthropic-token with the sk-ant-admin01- prefix. Product PR #882 (redact-secret#774) splits it out of the shared anthropic_api_key type into its own anthropic_admin_api_key finding type. The registry anthropic-token contract still claims sk-ant-api03- only, so sk-ant-admin01- is measured as its own arrival family — scored by finding type (scanners/families.mjs arrivalFindingTypes) rather than by a distinct registry detector id.' },
  { id: 'openai-admin-api-key', taxonomy: 'openai:admin-api-key', issue,
    reason: 'openai-token already recognises sk-admin-, and the registry openai-token contract claims the sk-proj-/sk-svcacct- widths only (redact-secret#863). Product PR #882 (redact-secret#774) splits sk-admin- out of the shared openai_api_key type into its own openai_admin_api_key finding type, so it is measured as its own arrival family — scored by finding type (scanners/families.mjs arrivalFindingTypes) rather than by a distinct registry detector id.' },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'anthropic-api01-key': {
    tier: 'T1',
    // The provider states no body for this key. The floor is the api03 rule already shipped (redact-secret#862 keeps the
    // >= 20 byte [A-Za-z0-9_-] run) and is recorded as an assumption; every positive carries the 93 + AA shape, and no
    // fixture asserts silence on a shorter or longer body, or on a body without the AA tail.
    pattern: '^sk-ant-api01-[A-Za-z0-9_-]{20,}$',
    providerSource: provider(ANT_COMPLIANCE, 'Key type table: Compliance Access Key (sk-ant-api01-...)', 'the provider documents sk-ant-api01- as the prefix of a Claude Enterprise key and quotes "sk-ant-api01- is a Compliance Access Key"; it states no body length, alphabet or tail', at),
    corroboration: [],
    references: [ANT_ADMIN_KEYS, ANT_AUTH, R776, 'https://github.com/redact-secret/redact-secret/issues/862'],
    review: 'Arrival evidence (#384, product redact-secret#862; research #776). T1 on the prefix only: two provider pages document sk-ant-api01- (compliance-api-access, admin-api-keys). The body is undocumented and no scanner rule exists for this prefix, so nothing here asserts a length, alphabet or AA tail: positives borrow the api03 93-character + AA shape, which the product accepts as a subset of its >= 20 byte run, and no twin is authored on the body. The prefix is the general Claude Enterprise organization key for any scope set; "Compliance" describes the scopes chosen at creation, which the value does not show, so a finding must not claim it. sk-ant-api03- and sk-ant-admin01- are different provider classes and back prefix twins.',
    fields: [
      field({ field: 'prefix', claim: 'sk-ant-api01-', basis: 'provider-documentation', status: 'frozen', sources: [src(ANT_COMPLIANCE, '"sk-ant-api01- is a Compliance Access Key"'), src(ANT_ADMIN_KEYS, 'table: Claude Enterprise organization key prefix')] }),
      field({ field: 'scope-of-prefix', claim: 'the prefix is the Enterprise organization key for any scope set (compliance, analytics, spend limits, members), not a compliance-only credential', basis: 'provider-documentation', status: 'frozen', sources: [src(ANT_ADMIN_KEYS), src(R776, 'research finding 6')] }),
      field({ field: 'body', claim: 'an opaque URL-safe run; the product floor is 20 bytes of [A-Za-z0-9_-] (assumption, not evidence)', basis: 'research-hypothesis', status: 'provisional', sources: [src(R776, 'no provider, tool or observation states a length for api01')],
        note: 'No length, alphabet or AA-tail twin is authored. Positives use the api03/admin01 93-character + AA shape only as a subset of the floor.' }),
      field({ field: 'aa-tail', claim: 'whether api01 keys end in AA as api03 and admin01 rules assume', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R776, 'hands-on checklist item')], note: 'Not claimed either way.' }),
      field({ field: 'header', claim: 'sent as x-api-key; the authentication page now recommends Authorization: Bearer for API keys', basis: 'provider-documentation', status: 'frozen', sources: [src(ANT_AUTH), src(ANT_ADMIN_API)] }),
      field({ field: 'sibling-classes', claim: 'sk-ant-api03- (Claude API key) and sk-ant-admin01- (Admin API key) are different provider classes; sk-ant-oat01-/sk-ant-ort01- (OAuth) and other versions have no provider source', basis: 'provider-documentation', status: 'unresolved', sources: [src(ANT_ADMIN_KEYS), src('https://github.com/gitleaks/gitleaks/issues/2158', 'community request for oat01/ort01; no provider source')],
        note: 'Only api03 and admin01 back prefix twins. No fixture asserts silence on api02, api04, oat01, ort01 or an unversioned prefix.' }),
      field({ field: 'encoded-form', claim: 'whether a Base64-encoded copy is in family scope', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R776)], note: 'No Base64 fixture is authored.' }),
    ],
  },
  'anthropic-admin01-key': {
    tier: 'T1',
    pattern: '^sk-ant-admin01-[A-Za-z0-9_-]{93}AA$',
    providerSource: provider(ANT_ADMIN_KEYS, 'Key prefix table: sk-ant-admin01-... (Console Admin API key)', 'the provider documents sk-ant-admin01- as the Admin API key prefix, created by organization admins and shown once; the 93-character body and AA tail are tool-corroborated', at),
    corroboration: [th('anthropic/anthropic', 'Anthropic: \\b(sk-ant-(?:admin01|api03)-[\\w\\-]{93}AA)\\b'), gl, { tool: 'betterleaks', label: 'anthropic-admin-api-key (a gitleaks fork, not independent of gitleaks)', url: BETTERLEAKS_ANTHROPIC }],
    references: [ANT_ADMIN_API, ANT_AUTH, TH_ANTHROPIC_PR, R775, 'https://github.com/redact-secret/redact-secret/issues/862', 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns'],
    review: 'Arrival evidence (#384, product redact-secret#862; research #775). The same T1-prefix, tool-corroborated-body split the registry anthropic-token contract records for sk-ant-api03-: two provider pages document sk-ant-admin01-, and the 93-character body plus a literal AA tail comes from three scanner rules (trufflehog 3.97.4, gitleaks, and betterleaks, which is a gitleaks fork and adds no independent corroboration). No length, alphabet or tail twin is authored on that tool-only field, and the product keeps a deliberate >= 20 byte superset. Admin keys are full-access credentials of the Console organization; the API also accepts OAuth org:admin bearer tokens and other key shapes, so an sk-ant-admin01- match is not the only admin credential. sk-ant-api03- and sk-ant-api01- are different provider classes and back prefix twins.',
    fields: [
      field({ field: 'prefix', claim: 'sk-ant-admin01-', basis: 'provider-documentation', status: 'frozen', sources: [src(ANT_ADMIN_KEYS, '"starting with sk-ant-admin01-"'), src(ANT_ADMIN_API, 'written sk-ant-admin... without the version digit')] }),
      field({ field: 'body', claim: '93 characters of [A-Za-z0-9_-] then a literal AA tail (110 in all)', basis: 'tool', status: 'provisional',
        sources: [src('https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/anthropic/anthropic.go'), src(gl.url, 'anthropic-admin-api-key'), src(BETTERLEAKS_ANTHROPIC, 'gitleaks lineage')],
        note: 'No provider page states a length, alphabet or tail. The product accepts a >= 20 byte superset, so no length, alphabet or tail twin is authored.' }),
      field({ field: 'header', claim: 'sent as x-api-key (the Admin API page); Bearer appears for the OAuth org:admin token', basis: 'provider-documentation', status: 'frozen', sources: [src(ANT_ADMIN_API), src(ANT_AUTH)] }),
      field({ field: 'version', claim: 'admin01 is the only documented version; admin02 and an unversioned sk-ant-admin- have no source', basis: 'provider-documentation', status: 'unresolved', sources: [src(ANT_ADMIN_KEYS), src(ANT_ADMIN_API, 'the unversioned spelling appears here')], note: 'No fixture asserts silence on admin02 or on the unversioned spelling.' }),
      field({ field: 'sibling-classes', claim: 'sk-ant-api03- (Claude API key) and sk-ant-api01- (Enterprise organization key) are different classes', basis: 'provider-documentation', status: 'frozen', sources: [src(ANT_ADMIN_KEYS), src(ANT_COMPLIANCE)], note: 'Real secrets of other classes: used only as scoped prefix twins, never as benign controls.' }),
      field({ field: 'encoded-form', claim: 'GitHub does not support Base64 detection for anthropic_admin_api_key', basis: 'tool', status: 'unresolved', sources: [src('https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns')], note: 'A GitHub capability, not a format fact. No Base64 fixture is authored.' }),
    ],
  },
  'openai-admin-api-key': {
    tier: 'T2',
    pattern: '^sk-admin-(?:[A-Za-z0-9_-]{58}T3BlbkFJ[A-Za-z0-9_-]{58}|[A-Za-z0-9_-]{74}T3BlbkFJ[A-Za-z0-9_-]{74})$',
    corroboration: [th('openai/openai'), gl, { tool: 'trufflehog issue 4698 (admin-key request)', label: 'marker-less 124-character body', url: TH_OPENAI_ISSUE }],
    references: [R777, 'https://github.com/redact-secret/redact-secret/issues/863', 'https://platform.openai.com/docs/api-reference/admin-api-keys'],
    review: 'Arrival evidence (#384, product redact-secret#863; research #777). T2: no OpenAI documentation states a length or alphabet for sk-admin- keys. Gitleaks corroborates the marker-bearing 58 + T3BlbkFJ + 58 shape with three test vectors, and openai/codex fixes the prefix set and the T3BlbkFJ watermark for the OpenAI family. The product decision recorded in redact-secret#863 contracts sk-admin- under the same marker-gated 58/74-byte grammar as sk-proj- and sk-svcacct-, so the contract admits 58/58 and 74/74 and no mixed width. A marker-less sk-admin- body (the 124-character trufflehog request) is out of contract: no source shows such a key, so it is authored as a negative twin, and the product accepts a false negative for it when bare or in unquoted env, YAML or tool-call text.',
    fields: [
      field({ field: 'prefix', claim: 'sk-admin-', basis: 'provider-code', status: 'frozen', sources: [src(OPENAI_CODEX, 'the OpenAI credential broker names the prefix set and the T3BlbkFJ watermark'), src(R777)], note: 'Provider code, not a provider documentation page; the reference example in the API reference is illustrative only.' }),
      field({ field: 'marker', claim: 'T3BlbkFJ between two body segments', basis: 'tool', status: 'frozen', sources: [src(gl.url, 'three admin test vectors'), src(th('openai/openai').url)] }),
      field({ field: 'segment-widths', claim: '58/58 (133 characters in all) and 74/74, the widths the product shares with sk-proj- and sk-svcacct-', basis: 'tool', status: 'frozen', sources: [src(gl.url, '58 + marker + 58'), src(R777, 'proj/svcacct measure 74/74 (redact-secret#657); no source measures a 74/74 admin key')],
        note: 'One byte short on either side of either width reads as a non-key. A mixed 58/74 width is accepted by the shipped detector but is not authored either way.' }),
      field({ field: 'body-alphabet', claim: '[A-Za-z0-9_-]', basis: 'tool', status: 'provisional', sources: [src(gl.url), src(R777)] }),
      field({ field: 'marker-less-body', claim: 'a 124-character [A-Za-z0-9_-] body without the marker', basis: 'tool', status: 'unresolved', sources: [src(TH_OPENAI_ISSUE, 'request text; numerically equal to 58 + 8 + 58')],
        note: 'Out of contract by the product decision in #863. It is a negative twin, never a positive; Bearer and quoted-assignment contexts still redact it through the generic layers, which co-detection records.' }),
      field({ field: 'blog-widths', claim: 'a {40,} floor and 164-character totals from two blog pages', basis: 'community', status: 'unresolved', sources: [src(R777, 'rows 10-11, contradicted by the gitleaks vectors')], note: 'Not used.' }),
      field({ field: 'public-key-id', claim: 'the admin key resource id (key_...) and the redacted_value display are public identifiers', basis: 'provider-documentation', status: 'provisional', sources: [src(R777, 'hands-on checklist item; shape recorded, not observed')], note: 'Backs the public-id controls; no shape is claimed beyond the prefix key_.' }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'anthropic-api01-key': 'documented-24',
  'anthropic-admin01-key': 'documented-24',
  'openai-admin-api-key': 'arrival-24',
};
