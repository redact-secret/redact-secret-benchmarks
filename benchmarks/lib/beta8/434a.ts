import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, gl, provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, B434, product, at, src, scoredReason, splitGraduated } from './434-sources.ts';

// Issue #434, slice a: Beta.11 contracts for the seven Doppler token types (#860 Tier A, READY;
// handoff docs/audits/evidence/860/doppler.md; product redact-secret#903). Owned by this slice only;
// see docs/specs/beta8-evidence.md.
//
// One provider page (docs.doppler.com/reference/auth-token-formats) states a regex per type, so
// every structural fact is T1 provider documentation. The handoff routes all seven to one new
// detector, doppler-token, with one finding type per dp.<type>. role. The service token (dp.st.)
// takes the detector id as its arrival id, as github-token does for the classic PAT; the six
// sibling types are their own arrival families, scored by finding type once the product types
// them (scanners/families.mjs arrivalFindingTypes, docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md).
export const issue = '434a';

const DOCS = 'https://docs.doppler.com/reference/auth-token-formats';
const HANDOFF = handoff('doppler.md');
const TH_DOPPLER = th('doppler/doppler', 'Doppler: \\b(dp\\.(?:ct|pt|st(?:\\.[a-z0-9\\-_]{2,35})?|sa|scim|audit)\\.[a-zA-Z0-9]{40,44})\\b (no said)');
const GL_DOPPLER = { ...gl, label: 'doppler-api-token: dp\\.pt\\.(?i)[a-z0-9]{43} (personal token only, one width)' };
const GH_PATTERNS = 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns';

interface DopplerType { id: string; code: string; taxonomy: string; findingType: string; role: string }
export const DOPPLER_TYPES: DopplerType[] = [
  { id: 'doppler-token', code: 'st', taxonomy: 'doppler:service-token', findingType: 'doppler_service_token', role: 'service token (reads one config)' },
  { id: 'doppler-personal-token', code: 'pt', taxonomy: 'doppler:personal-token', findingType: 'doppler_personal_token', role: 'personal token (user-wide)' },
  { id: 'doppler-cli-token', code: 'ct', taxonomy: 'doppler:cli-token', findingType: 'doppler_cli_token', role: 'CLI token (user-wide)' },
  { id: 'doppler-service-account-token', code: 'sa', taxonomy: 'doppler:service-account-token', findingType: 'doppler_service_account_token', role: 'service account token' },
  { id: 'doppler-service-account-identity-token', code: 'said', taxonomy: 'doppler:service-account-identity-token', findingType: 'doppler_service_account_identity_token', role: 'short-lived service account identity token minted by OIDC exchange' },
  { id: 'doppler-scim-token', code: 'scim', taxonomy: 'doppler:scim-token', findingType: 'doppler_scim_token', role: 'SCIM token' },
  { id: 'doppler-audit-token', code: 'audit', taxonomy: 'doppler:audit-token', findingType: 'doppler_audit_token', role: 'audit token' },
];

/** The anchored contract pattern of one dp.<type>. token. Only dp.st. carries the optional environment segment. */
export const dopplerPattern = (code: string) =>
  code === 'st' ? '^dp\\.st\\.(?:[a-z0-9_-]{2,35}\\.)?[A-Za-z0-9]{40,44}$' : `^dp\\.${code}\\.[A-Za-z0-9]{40,44}$`;

/** Sibling types the product reports inside a shared detector under their own finding type: arrival families scored by finding type since the 1127bf9 re-pin. */
export const arrivalFamilies: ArrivalFamily[] = DOPPLER_TYPES.filter(t => t.code !== 'st').map(t => ({
  id: t.id, taxonomy: t.taxonomy, issue,
  reason: scoredReason('doppler-token', t.findingType, 903),
}));

const lag = (code: string) => {
  const notes = [];
  if (code === 'said') notes.push('trufflehog 3.97.4 has no said alternative, and GitHub secret scanning lists no said pattern');
  if (code !== 'pt') notes.push('gitleaks 8.30.1 covers dp.pt. only');
  else notes.push('gitleaks 8.30.1 covers only a 43-byte body (and matches it case-insensitively), not the documented 40–44 band');
  return notes.join('; ');
};

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = Object.fromEntries(DOPPLER_TYPES.map(t => [t.id, {
  tier: 'T1',
  pattern: dopplerPattern(t.code),
  providerSource: provider(DOCS, `auth-token-formats regex for dp.${t.code}. (page dateModified 2025-05-29, re-checked 2026-09-28)`, `the provider states the dp.${t.code}. prefix, ${t.code === 'st' ? 'the optional [a-z0-9_-]{2,35} environment segment, ' : ''}a 40–44 byte [A-Za-z0-9] body and the . separators as a regex; no checksum is documented`, at),
  corroboration: [TH_DOPPLER, GL_DOPPLER],
  references: [DOCS, HANDOFF, HANDOFF_INDEX, R860, product(903), B434, GH_PATTERNS],
  review: `Arrival evidence (#434, product redact-secret#903; #860 handoff doppler.md, READY). T1 on every field: one Doppler page states the regex for each of the seven dp.<type>. roles, and this family is the ${t.role}. ${t.code === 'st' ? 'The optional environment segment ([a-z0-9_-]{2,35} then .) belongs to dp.st. only; a segment outside that grammar is not claimed, and the dp.st… display preview (a Unicode ellipsis plus the last six body bytes) is a benign control. ' : ''}All documentation examples have a 43-byte body; the contract keeps the documented 40–44 band. Scanner rules lag the page and are corroboration only (${lag(t.code)}). No fixture asserts a body width outside 40–44 as a key, and no future type is asserted either way.`,
  fields: [
    field({ field: 'prefix', claim: `dp.${t.code}.`, basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, `regex for the ${t.role}`), src(HANDOFF)] }),
    ...(t.code === 'st' ? [field({ field: 'environment-segment', claim: 'an optional [a-z0-9_-]{2,35} segment then . (dp.st. only)', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'docs examples use the environment slug')] })] : []),
    field({ field: 'body', claim: '40–44 bytes of [A-Za-z0-9]; no _ or - inside the body', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)], note: 'Every documentation example and the one empirical observation in the research table have 43; the band stays as documented.' }),
    field({ field: 'separators', claim: '. after dp, after the type and after the optional segment; none inside the body', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)] }),
    field({ field: 'checksum', claim: 'none documented', basis: 'provider-documentation', status: 'unresolved', sources: [src(DOCS)], note: 'No fixture relies on a checksum either way.' }),
    field({ field: 'boundary', claim: 'a value glued to an identifier on either side ([A-Za-z0-9_-] after the body, [A-Za-z0-9_.-] before dp) is not a key; a following . is sentence punctuation', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes and accepted false negatives')], note: 'The handoff\'s precision choice, shared by every prefixed family; backs the glue twins.' }),
    ...(t.code === 'sa' || t.code === 'said' ? [field({ field: 'sibling-precedence', claim: 'dp.said. is its own type, never dp.sa. plus a body beginning id.', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'sibling precedence')] })] : []),
    field({ field: 'peer-lag', claim: lag(t.code), basis: 'tool', status: 'frozen', sources: [src(TH_DOPPLER.url), src(gl.url, 'doppler-api-token'), src(GH_PATTERNS)], note: 'Corroboration only; never used to narrow or widen the documented grammar.' }),
    field({ field: 'non-secrets', claim: 'the dp.st… preview, service-token slugs and token names are not credentials', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')] }),
  ],
} satisfies FormatContract]));

const split = splitGraduated(authored, ['doppler-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 1127bf9 re-pin (redact-secret PR #938). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward: every field is T1 provider documentation. */
export const profiles: Record<string, FixtureProfile> = Object.fromEntries(DOPPLER_TYPES.map(t => [t.id, 'documented-24' as FixtureProfile]));
