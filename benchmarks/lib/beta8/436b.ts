import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, gl } from '../contract-sources.ts';
import { handoff, RERANK, R860, RULINGS_R2_R8, B436, product, at, src, reason } from './436-sources.ts';

// Issue #436, slice b: Beta.11 contract for the 1Password service-account token (#860 Tier B, READY;
// handoff docs/audits/evidence/860/onepassword.md; product redact-secret#913). Owned by this slice only;
// see docs/specs/beta8-evidence.md.
//
// T1 on provider documentation: 1Password's service-account security page states the ops_ prefix and
// that the rest is a serialized object, Base64 URL encoded; its one encoded example begins ops_eyJ
// (rulings R4/R5). The length is variable by construction (serialized account data). The 250-byte floor
// after ops_eyJ is project policy (a false-positive guard far below the 634-character example, and
// gitleaks' own floor). The alphabet is the provider's Base64url class, not the alphanumeric one every
// sample happens to show (ruling R8: no narrowing from absence).
export const issue = '436b';

const SECURITY = 'https://developer.1password.com/docs/service-accounts/security/';
const SERVICE_ACCOUNTS = 'https://developer.1password.com/docs/service-accounts/';
const CONNECT = 'https://developer.1password.com/docs/connect/';
const SECRET_REFS = 'https://developer.1password.com/docs/cli/secret-references/';
const HANDOFF = handoff('onepassword.md');

/** ops_eyJ + at least 250 Base64url bytes, optional = padding inside the span. */
export const ONEPASSWORD_PATTERN = '^ops_eyJ[A-Za-z0-9_-]{250,}={0,2}$';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'onepassword-service-account-token', taxonomy: 'onepassword:service-account-token', issue, reason: reason('onepassword-service-account-token', 'onepassword_service_account_token', 913) },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'onepassword-service-account-token': {
    tier: 'T1',
    pattern: ONEPASSWORD_PATTERN,
    providerSource: provider(SECURITY, 'developer.1password.com service-account security page: the ops_ prefix, chosen to help code analyzers, and a serialized object that is Base64 URL encoded (re-checked 2026-09-28; the one encoded example is 634 characters and begins ops_eyJ)', 'ops_ + Base64url of a JSON object (so the body leads eyJ); variable length; the floor of 250 Base64url bytes after ops_eyJ is project policy', at),
    corroboration: [{ tool: gl.tool, label: '1password-service-account-token: ops_eyJ[a-zA-Z0-9+/]{250,}={0,3} (standard Base64 class; the contract keeps the provider-stated Base64url class)', url: gl.url }],
    references: [SECURITY, SERVICE_ACCOUNTS, CONNECT, SECRET_REFS, HANDOFF, RERANK, R860, RULINGS_R2_R8, product(913), B436],
    review: 'Arrival evidence (#436, product redact-secret#913; #860 handoff onepassword.md, READY). T1 on provider documentation: the ops_ prefix and the Base64 URL encoding of a serialized object are stated on 1Password\'s service-account security page, whose single encoded example begins ops_eyJ (R4/R5 make that example T1 for the lead). The token carries the account\'s key material, so its length varies with the serialized fields; no fixed length exists, and the 250-byte floor after ops_eyJ is project policy that agrees with gitleaks. The alphabet is the provider\'s Base64url class, not the alphanumeric one every observed sample shows (R8). Positives carry 250, 630 and 866 bytes after the lead, a body with - and _, and = / == padding inside the span. Excluded: the Connect server token (a three-segment JWT, which the jwt detector keeps, so it is a twin, never a control), the account Secret Key (another family), op:// secret references, ops_ identifiers and placeholders, and a standard-Base64 + or / inside the body.',
    fields: [
      field({ field: 'prefix', claim: 'ops_', basis: 'provider-documentation', status: 'frozen', sources: [src(SECURITY, '"uses ops_ as the token prefix", to help code analyzers find accidental exposure')] }),
      field({ field: 'body-lead', claim: 'eyJ (Base64 of {"): the body is a serialized JSON object', basis: 'provider-documentation', status: 'frozen', sources: [src(SECURITY, 'serialized object, Base64 URL encoded; the example begins ops_eyJ'), src(RULINGS_R2_R8, 'R4/R5')] }),
      field({ field: 'alphabet', claim: 'Base64url [A-Za-z0-9_-], optional ={0,2} padding kept inside the span', basis: 'provider-documentation', status: 'frozen', sources: [src(SECURITY, '"Base64 URL encoded"'), src(RULINGS_R2_R8, 'R8: no narrowing from absence')], note: 'Every sample seen is alphanumeric after the prefix; the contract keeps the stated class. A standard-Base64 + or / is outside it.' }),
      field({ field: 'length', claim: 'variable by construction; one provider example of 634 characters, observed range 634–870', basis: 'provider-example', status: 'frozen', sources: [src(SECURITY, 'one encoded example, measured by script, no value retained'), src(HANDOFF)] }),
      field({ field: 'floor', claim: 'at least 250 Base64url bytes after ops_eyJ', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'project policy: far below the documented field set and equal to the gitleaks floor'), src(gl.url, 'gitleaks {250,}')], note: 'A policy floor, not a provider fact: the 249-byte twin is a policy boundary the handoff decides.' }),
      field({ field: 'connect-token', claim: 'the Connect server token (OP_CONNECT_TOKEN) is a standard three-segment JWT', basis: 'provider-documentation', status: 'frozen', sources: [src(CONNECT)], note: 'Another credential class the jwt detector keeps: a twin, never a benign control.' }),
      field({ field: 'secret-references', claim: 'op://vault/item/field strings are references, not secrets', basis: 'provider-documentation', status: 'frozen', sources: [src(SECRET_REFS)] }),
      field({ field: 'secret-key', claim: 'the account Secret Key (A3-…) is a separate credential with its own grammar', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Not this family; no fixture asserts it either way.' }),
      field({ field: 'transport', claim: 'the OP_SERVICE_ACCOUNT_TOKEN environment variable, read by the op CLI and the SDKs', basis: 'provider-documentation', status: 'frozen', sources: [src(SERVICE_ACCOUNTS)] }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 has a 1password-service-account-token rule (standard Base64 class); trufflehog 3.97.4 has no 1Password service-account detector', basis: 'tool', status: 'frozen', sources: [src(gl.url, '1password-service-account-token'), src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no service-account token detector')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'onepassword-service-account-token': 'documented-24' };
