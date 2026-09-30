import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { field } from '../contract-sources.ts';
import { VERCEL_RECORD, VERCEL_INDEX, R1013, RULINGS_R2_R8, B528, product, src, scoredReason, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './1012-sources.ts';

// Issue #1012, slice e: Beta.12 contracts for the three READY Vercel token classes (redact-secret#1013 record
// docs/audits/evidence/1013/vercel.md: vcp_ READY-T2, vca_ and vcr_ READY-T2 thin; product redact-secret#1036, which
// splits vercel-token per class and types vcp_/vca_/vcr_ + exactly 56 [A-Za-z0-9] as their own finding types). Owned by
// this slice only; see docs/specs/beta8-evidence.md.
//
// T2 each: <marker>_ + exactly 56 [A-Za-z0-9] (60 in all). The markers are T1 (the Vercel changelog and docs); the body
// rests on one provider example per class plus peer rules. No Vercel code generates or validates a length, alphabet or
// checksum. The 50 + 6 base62 CRC-32 tail is provider-backed on one vca_ value only and the CLI vcp_ example fails it, so
// it is recorded unresolved, never enforced: positives carry both a matching and a mismatching tail. vci_ and vck_ stay
// STILL-BLOCKED (ruling Q-VC) and the aggregate vercel:access-token is not a family.
//
// Modelling: the product reports each class under its own finding type inside the shared vercel-token detector, so each
// is an arrival family scored by finding type (scanners/families.mjs arrivalFindingTypes).
export const issue = '1012e';

const CHANGELOG = 'https://vercel.com/changelog/new-token-formats-and-secret-scanning';
const APP_TOKENS = 'https://vercel.com/docs/sign-in-with-vercel/tokens';
const CLI_OPTIONS = 'https://vercel.com/docs/cli/global-options';
const ACCESS_TOKENS = 'https://vercel.com/docs/accounts/access-tokens';
const OPENAPI = 'https://openapi.vercel.sh';
const AUTH_SERVER = 'https://vercel.com/docs/sign-in-with-vercel/authorization-server-api';
const TURBO = 'https://github.com/vercel/turborepo/blob/07ee4185589823c984ea9f28d1f8480b60d6374f/crates/turborepo-auth/src/auth/mod.rs#L361';
const AZDO_MASK = 'https://github.com/vercel/vercel-azure-devops-extension/blob/24183cd1671cdb451e22a20634c2bb19e3478870/vercel-deployment-task-source/src/index.ts#L37-L38';
const KINGFISHER = 'https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L46-L299';
const BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L46-L212';
const CREDSWEEPER = 'https://github.com/Samsung/CredSweeper/blob/1aa60465c4ec064357ead06f5b4da7c3adbce7a8/credsweeper/rules/config.yaml#L1995-L2007';
const TH_VERCEL = 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/vercel/vercel.go';

export const vercelPattern = (marker: string) => `^${marker}_[A-Za-z0-9]{56}$`;

interface VercelClass { id: string; marker: string; taxonomy: string; findingType: string; role: string; example: string; exampleNote: string; thin: boolean }
export const VERCEL_CLASSES: VercelClass[] = [
  { id: 'vercel-personal-access-token', marker: 'vcp', taxonomy: 'vercel:personal-access-token', findingType: 'vercel_personal_access_token', role: 'personal access token (acts as the user, account-wide within its scope)', example: CLI_OPTIONS, exampleNote: 'CLI --token/VERCEL_TOKEN example: one vcp_ + 56 alphanumeric value, hand-written (fails the checksum)', thin: false },
  { id: 'vercel-app-access-token', marker: 'vca', taxonomy: 'vercel:app-access-token', findingType: 'vercel_app_access_token', role: 'Vercel App (Sign in with Vercel) access token', example: APP_TOKENS, exampleNote: 'Sign in with Vercel tokens page: vca_ + 56 [A-Za-z0-9], checksum-valid (present 2025-11-28)', thin: true },
  { id: 'vercel-app-refresh-token', marker: 'vcr', taxonomy: 'vercel:app-refresh-token', findingType: 'vercel_app_refresh_token', role: 'Vercel App refresh token', example: APP_TOKENS, exampleNote: 'Sign in with Vercel tokens page: vcr_ + the vca_ example body (no independent vcr_ body)', thin: true },
];

export const arrivalFamilies: ArrivalFamily[] = VERCEL_CLASSES.map(c => ({
  id: c.id, taxonomy: c.taxonomy, issue, reason: scoredReason('vercel-token', c.findingType, 1036),
}));

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = Object.fromEntries(VERCEL_CLASSES.map(c => [c.id, {
  tier: 'T2',
  pattern: vercelPattern(c.marker),
  corroboration: [
    { tool: 'kingfisher', label: `vc[pikar]_ + 50 [A-Za-z0-9_-] + 6 [A-Za-z0-9] (Base62 CRC-32 tail)${c.thin ? '; its vca_/vcr_ examples copy the Vercel docs value' : ''}`, url: KINGFISHER },
    { tool: 'betterleaks', label: 'vc[pikar]_ + 56 [A-Za-z0-9_-] (derived from kingfisher)', url: BETTERLEAKS },
    ...(c.marker === 'vcp' ? [{ tool: 'CredSweeper', label: 'vcp_ + exactly 56 [0-9A-Za-z] (samples fail the checksum, so independent of kingfisher)', url: CREDSWEEPER }] : []),
  ],
  references: [CHANGELOG, c.example, ACCESS_TOKENS, OPENAPI, AUTH_SERVER, TURBO, AZDO_MASK, KINGFISHER, BETTERLEAKS, CREDSWEEPER, VERCEL_RECORD, VERCEL_INDEX, R1013, RULINGS_R2_R8, product(1036), B528],
  review: `Scored arrival family (#1013 ${c.thin ? 'READY-T2, thin' : 'READY-T2'}; product redact-secret#1036, which types it as ${c.findingType} inside vercel-token). The ${c.role}. The ${c.marker}_ marker is T1 (Vercel changelog and docs); the body is T2: ${c.exampleNote}, plus ${c.marker === 'vcp' ? 'three peer owners (kingfisher, betterleaks, CredSweeper)' : 'two peer owners (kingfisher, betterleaks), both of which copy the provider value'}. No Vercel code generates or validates a length, alphabet or checksum; Vercel code only discriminates by prefix. The body alphabet leaves _ and - out (every provider example and CredSweeper; the kingfisher/betterleaks rules and Vercel's own masking regexes admit them, maskers are not validators), bounded by the record, not settled. The 50 + 6 base62 CRC-32 tail is provider-backed on one vca_ value and the OpenAPI "token checksum suffix" only, and the CLI vcp_ example fails it, so it is recorded unresolved and never enforced: positives carry a matching and a mismatching tail. Excluded: the legacy unprefixed 24-character token, the masked filler, vci_ and vck_ (STILL-BLOCKED, ruling Q-VC) and the vercel:access-token compatibility aggregate.`,
  fields: [
    field({ field: 'prefix', claim: `${c.marker}_`, basis: 'provider-documentation', status: 'frozen', sources: [src(CHANGELOG, `marker stem ${c.marker}`), src(c.marker === 'vcp' ? ACCESS_TOKENS : AUTH_SERVER, `${c.marker}_ with the underscore`), src(OPENAPI, 'tokenPrefix enum')] }),
    field({ field: 'body', claim: 'exactly 56 [A-Za-z0-9] (60 in all)', basis: 'provider-example', status: 'frozen', sources: [src(c.example, c.exampleNote), src(KINGFISHER), ...(c.marker === 'vcp' ? [src(CREDSWEEPER)] : [])], note: `T2${c.thin ? ' (thin: one provider value, copied by both peers)' : ''}.` }),
    field({ field: 'alphabet-bound', claim: '_ and - are not in the body', basis: 'provider-example', status: 'provisional', sources: [src(c.example), src(AZDO_MASK, 'the masker admits _ and -, with no length'), src(KINGFISHER, 'admits _ and - in the first 50')], note: 'Bounded by the record (every provider example is alphanumeric); a body with _ or - is an alphabet twin.' }),
    field({ field: 'checksum', claim: 'the last 6 characters may be base62 (0-9A-Za-z) of the CRC-32 of the 50 before them', basis: 'provider-example', status: 'unresolved', sources: [src(APP_TOKENS, 'the vca_ example passes it'), src(OPENAPI, 'tokenSuffix: "The token checksum suffix."'), src(CLI_OPTIONS, 'the vcp_ example fails it')], note: 'Not enforced and never a twin: positives carry a matching and a mismatching tail.' }),
    field({ field: 'sibling-classes', claim: 'vci_ and vck_ are other Vercel classes, STILL-BLOCKED on the body (Q-VC); the legacy unprefixed 24-character token is excluded', basis: 'provider-documentation', status: 'frozen', sources: [src(VERCEL_RECORD, 'verdict table'), src(CHANGELOG)], note: 'Neither a positive nor a control.' }),
    field({ field: 'peer-lag', claim: 'no prefixed Vercel rule in gitleaks 8.30.1; trufflehog 3.97.4 reads only the legacy unprefixed 24-character contextual token', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'no vercel rule'), src(TH_VERCEL, 'legacy 24-character pattern'), src(TRUFFLEHOG_DETECTORS)] }),
  ],
} satisfies FormatContract]));

/** The Beta.8 profile each target this slice owns is authored toward: T2 with no empirical record, so arrival-24. */
export const profiles: Record<string, FixtureProfile> = Object.fromEntries(VERCEL_CLASSES.map(c => [c.id, 'arrival-24' as FixtureProfile]));
