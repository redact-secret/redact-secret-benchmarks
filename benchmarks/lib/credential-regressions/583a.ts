import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th, gl } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX_583, Q8, researchTable, R1014, RULINGS_R2_R8, B583, B584, product, at, src, scoredReason, splitRegistered, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './583-sources.ts';

// Issue #583, slice a: Beta.14 contracts for the Square access token (`EAAA`) and the Square OAuth application secret
// (`sq0csp-`, `sandbox-sq0csb-`) (#1014 rank 24, READY under R5 with the Q8 ruling question open; handoff
// docs/audits/evidence/1014/square.md; product redact-secret#1107). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 by example under R5 (docs examples plus, for sq0csp-, the provider's generated SDK fixture), with the one caveat the
// provider itself states: Square says "don't use token length for validation" and its own examples disagree (an `EAAl` + 59
// access token in the ObtainToken reference, `sq0csp-` at 43 in the walkthrough and 44 in the reference). The contract claims
// the stable widths (`EAAA` + 60; `sq0csp-` + 43 or 44; `sandbox-sq0csb-` + 43) and leaves every conflicting width UNCLAIMED:
// no fixture asserts silence on one (they are recorded in DISPUTED_PROPERTIES and read T0, the way #213 treats a provider-
// undecided property). That the claim stands at all is ruling Q8 (open): `policy-q8-exact-width` marks the dependency, and a
// refusal drops these families to issuance-gated (#584), never to a quiet T1.
export const issue = '583a';

const DOCS_TOKENS = 'https://developer.squareup.com/docs/oauth-api/receive-and-manage-tokens';
const OBTAIN = 'https://developer.squareup.com/reference/square/o-auth-api/obtain-token';
const WALKTHROUGH = 'https://developer.squareup.com/docs/oauth-api/walkthrough';
const SDK_WIRE = 'https://github.com/square/square-nodejs-sdk/blob/5e484507548ce8ffdc55752395a290ecc2d26771/tests/wire/oAuth.test.ts';
const HANDOFF = handoff('square.md');
const RESEARCH = researchTable('5900447820');
const GITLEAKS_RULE = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/cmd/generate/config/rules/square.go';
const TRUFFLEHOG_SQUARE = 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/square/square.go';
const TRUFFLEHOG_SQUAREAPP = 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/squareapp/squareapp.go';
const REFS = [DOCS_TOKENS, OBTAIN, WALKTHROUGH, SDK_WIRE, HANDOFF, RESEARCH, HANDOFF_INDEX_583, Q8, R1014, RULINGS_R2_R8, product(1107), B583, B584];

export const SQUARE_ACCESS_TOKEN_PATTERN = '^EAAA[A-Za-z0-9_-]{60}$';
export const SQUARE_OAUTH_SECRET_PATTERN = '^(?:sq0csp-[A-Za-z0-9_-]{43,44}|sandbox-sq0csb-[A-Za-z0-9_-]{43})$';

/** The OAuth application secret shares the detector `square-token` (finding type square_oauth_application_secret): an arrival family scored by finding type. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'square-oauth-application-secret', taxonomy: 'square:oauth-application-secret', issue, reason: scoredReason('square-token', 'square_oauth_application_secret', 1107) },
];

const shared = [
  field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed: a longer run, a Meta-style EAAA… Graph token, a lowercase digest and a Base64 blob are not Square tokens', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
  field({ field: 'case', claim: 'prefixes are matched case-sensitively', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes'), src('https://github.com/gitleaks/gitleaks/issues/1468', 'lowercase eaaa… Docker image digests matched a loose rule')], note: 'Handoff decision.' }),
  field({ field: 'transport', claim: 'SQUARE_ACCESS_TOKEN sent as Authorization: Bearer; new Client({ accessToken }); an MCP server env block; the OAuth client_secret in an ObtainToken body', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_TOKENS), src(OBTAIN), src(HANDOFF, 'role and blast radius')] }),
  field({ field: 'public-identifiers', claim: 'sq0idp-, sq0ids-, sq0idb- and sandbox-sq0idb- application ids (22 characters) are public by design (ruling question Q5)', basis: 'provider-documentation', status: 'frozen', sources: [src(WALKTHROUGH), src(OBTAIN), src(HANDOFF, 'excluded shapes')], note: 'Controls, never positives.' }),
  field({ field: 'jwt', claim: 'a JWT-format Square access token (eyJ…) is reported by the jwt detector and is never this family (R7)', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_TOKENS, 'transitioning to JWT (JSON Web Token) access tokens'), src(HANDOFF, 'overlap and output policy')], note: 'No fixture is authored for it: a jwt finding would be a co-detection, not evidence about this family.' }),
];

/** Every contract this slice authored; split at the registry boundary below. */
const authored: Record<string, FormatContract> = {
  'square-token': {
    tier: 'T1',
    pattern: SQUARE_ACCESS_TOKEN_PATTERN,
    providerSource: provider(DOCS_TOKENS, 'Square developer docs "Receive and manage seller OAuth tokens", observed 2026-09-30: the traditional access token example is 64 characters, EAAA + 60 over letters, digits and _; the page also says "don\'t use token length for validation"', 'EAAA + exactly 60 [A-Za-z0-9_-] (64 in all); no checksum', at),
    corroboration: [th('square/square', 'square'), gl],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1107; #1014 handoff square.md, READY under R5, Q8 open). A Square access token (SQUARE_ACCESS_TOKEN, sent as Authorization: Bearer) acts for a merchant or the developer account (payments, refunds, orders, customers, inventory) within its scopes; a personal access token from the Developer Console has the same shape. T1 by example under R5: the docs page that defines the token shows EAAA + 60 (64 in all), and four independent scanner or request sources use 60 after EAAA, but those are T2. The one caveat is the provider\'s own: it says not to validate token length and its ObtainToken reference shows an EAAl + 59 form (63 in all, a different prefix), so the contract claims the stable 60-character body and leaves every other width unclaimed. Excluded: JWT-format tokens (they stay with jwt, R7), EAAl + 59 and the EQAA + 60 refresh token (one provider example each, the same generated value, disagreeing with the 64-character example; they need the issuance check, #584), sq0atp- + 22 (scanner rules only) and any other length. The boundary and case rules are handoff decisions. Pinned peers: trufflehog 3.97.4 square reads EAAA + 60 over [a-zA-Z0-9\\-_+=] only beside the word square; gitleaks 8.30.1 square-access-token reads EAAA or sq0atp- + 22 to 60 over [\\w-] at entropy 2, a wider and keyword-assisted window.',
    fields: [
      field({ field: 'prefix', claim: 'EAAA', basis: 'provider-example', status: 'frozen', sources: [src(DOCS_TOKENS, 'traditional access token example'), src(HANDOFF, 'supported shape')], note: 'R4: a documented prefix is T1.' }),
      field({ field: 'body-length', claim: 'exactly 60 characters after EAAA (64 in all)', basis: 'provider-example', status: 'frozen', sources: [src(DOCS_TOKENS, '64-character example; the page also says not to use token length for validation'), src(TRUFFLEHOG_SQUARE, 'EAAA[a-zA-Z0-9\\-_+=]{60}')], note: 'R5, conditional on Q8: the provider disclaims length validation. Neighbouring widths are unclaimed, not refused.' }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9_-]', basis: 'provider-example', status: 'frozen', sources: [src(DOCS_TOKENS, 'example is letters, digits and _'), src(HANDOFF, 'supported shape')], note: 'The docs example shows letters, digits and _; the - is the handoff URL-safe union. trufflehog also admits + and =, which no Square page shows: those are an accepted false negative.' }),
      field({ field: 'policy-q8-exact-width', claim: 'POLICY, not T1: an exact-width grammar is supported although the provider disclaims length validation (ruling question Q8, open; recommendation yes)', basis: 'research-hypothesis', status: 'provisional', sources: [src(Q8, 'Q8: may R5 support an exact-width grammar when the provider disclaims length'), src(HANDOFF, 'tier rationale')], note: 'If Q8 is refused the claim becomes issuance-gated (#584) and the width fixtures stay unclaimed.' }),
      field({ field: 'conflicting-shapes', claim: 'EAAl + 59 (63 in all) and EQAA + 60 are the provider\'s own other examples; widths 59 and 61 after EAAA are unclaimed', basis: 'provider-example', status: 'unresolved', sources: [src(OBTAIN, 'access_token EAAl + 59, refresh_token EQAA + 60'), src(SDK_WIRE, 'the same generated values')], note: 'Authored as unclaimed controls (DISPUTED_PROPERTIES, T0): no fixture asserts silence or detection on them.' }),
      field({ field: 'legacy-personal-token', claim: 'sq0atp- + 22 appears only in scanner rules (gitleaks, Nosey Parker); no Square page shows it', basis: 'tool', status: 'unresolved', sources: [src(GITLEAKS_RULE, 'EAAA|sq0atp-'), src(HANDOFF, 'excluded shapes')], note: 'Unclaimed.' }),
      ...shared,
      field({ field: 'peer-lag', claim: 'both pinned peers have a Square access-token rule (trufflehog square needs the word square near the value; gitleaks square-access-token is keyword-assisted at entropy 2): lag is measured, not assumed', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_SQUARE), src(GITLEAKS_RULE), src(TRUFFLEHOG_DETECTORS), src(GITLEAKS_CONFIG)] }),
    ],
  },
  'square-oauth-application-secret': {
    tier: 'T1',
    pattern: SQUARE_OAUTH_SECRET_PATTERN,
    providerSource: provider(WALKTHROUGH, 'Square developer docs OAuth walkthrough and ObtainToken reference, observed 2026-09-30: client_secret sq0csp- + 43 (walkthrough) and + 44 (reference and generated SDK fixture); sandbox secret sandbox-sq0csb- + 43 (walkthrough)', 'sq0csp- + 43 or 44, or sandbox-sq0csb- + 43, over [A-Za-z0-9_-]; no checksum', at),
    corroboration: [th('squareapp/squareapp', 'squareapp')],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1107; #1014 handoff square.md, READY under R5, Q8 open). The OAuth application secret (client_secret) lets an integration exchange authorization codes and renew or revoke seller tokens, so a leak compromises every seller that authorized the application. T1 by example under R5: the walkthrough shows sq0csp- + 43 and sandbox-sq0csb- + 43, the ObtainToken reference and its generated SDK fixture show sq0csp- + 44 (two provider widths, so the production secret takes the union, the Polar era-union precedent) and the sandbox secret has one docs page. Excluded: sq0csp- of any other width, sandbox-sq0csb- + 44, the sq0cgb- authorization code (short-lived, single use), the sq0atp- personal token (scanner rules only) and every application id (sq0idp-, sq0ids-, sq0idb-, sandbox-sq0idb-: public by design, Q5). Widths outside 43/44 (production) and 43 (sandbox) are unclaimed, not refused. Pinned peers: gitleaks 8.30.1 has no sq0csp- rule in its default config (its square-secret rule exists only in the generator source), so it lags on every application secret; trufflehog 3.97.4 squareapp reads (sandbox-)sq0c?? + 40 to 50 and also the sq0i?? application ids over the same label, so it reaches both widths and over-reads public ids.',
    fields: [
      field({ field: 'prefix', claim: 'sq0csp- (production) or sandbox-sq0csb- (sandbox)', basis: 'provider-example', status: 'frozen', sources: [src(WALKTHROUGH, 'client_secret examples'), src(OBTAIN, 'client_secret example')], note: 'R4.' }),
      field({ field: 'body-length', claim: 'production: 43 or 44 characters after sq0csp-; sandbox: exactly 43 after sandbox-sq0csb-', basis: 'provider-example', status: 'frozen', sources: [src(WALKTHROUGH, '43 production, 43 sandbox'), src(OBTAIN, '44 production'), src(SDK_WIRE, 'the same 44-character value as the reference')], note: 'R5 for the production union (two provider pages, one generated fixture); the sandbox width rests on one docs page. Conditional on Q8.' }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9_-]', basis: 'provider-example', status: 'frozen', sources: [src(WALKTHROUGH), src(HANDOFF, 'supported shape')] }),
      field({ field: 'policy-q8-exact-width', claim: 'POLICY, not T1: an exact-width grammar is supported although the provider disclaims length validation and its own examples disagree on 43 vs 44 (ruling question Q8, open; recommendation yes)', basis: 'research-hypothesis', status: 'provisional', sources: [src(Q8, 'Q8'), src(HANDOFF, 'tier rationale')], note: 'The 43-or-44 union follows the Polar era-union precedent.' }),
      field({ field: 'conflicting-shapes', claim: 'sq0csp- at 42 or 45 and sandbox-sq0csb- at 42 or 44 are unclaimed; sq0atp- + 22 is scanner-only', basis: 'provider-example', status: 'unresolved', sources: [src(OBTAIN, 'sq0csp- + 44'), src(WALKTHROUGH, 'sq0csp- + 43, sandbox + 43'), src(HANDOFF, 'excluded shapes')], note: 'Authored as unclaimed controls (DISPUTED_PROPERTIES, T0).' }),
      ...shared,
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 has no sq0csp- rule in its default config (lag on every application secret); trufflehog squareapp reads 40 to 50 and also reports public sq0i?? application ids under the same label (overreach on the public-id controls)', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'no sq0csp- rule'), src(TRUFFLEHOG_SQUAREAPP, 'sq0c[a-z]{2}-… {40,50} and sq0i[a-z]{2}-… {22,43}')] }),
    ],
  },
};

const split = splitRegistered(authored, ['square-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1227). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'square-token': 'documented-24', 'square-oauth-application-secret': 'documented-24' };
