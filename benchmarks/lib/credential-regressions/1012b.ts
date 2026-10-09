import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { field } from '../contract-sources.ts';
import { research, RESEARCH_INDEX, R1012, RULINGS_R2_R8, B528, product, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './1012-sources.ts';

// Issue #1012, slice b: Beta.12 contract for the Google OAuth client secret (redact-secret#1012 READY-T2; research
// docs/audits/evidence/1012/google-oauth2-credential.md, the GOCSPX- part; product redact-secret#1029, the new
// google-oauth-client-secret detector). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T2: GOCSPX- + exactly 28 [A-Za-z0-9_-] is the grammar of three dated rules from three owners and two classes: Google's
// own osv-scalibr rule (narrowed to exactly 28 by a Google engineer on 2025-12-03; R2 is not applied, so it counts as
// corroboration), noseyparker and CredSweeper. Google documents no format. The ya29. access token and the 1// refresh
// token are BLOCKED in the research record and are not members of this family.
export const issue = '1012b';

const RESEARCH = research('google-oauth2-credential.md');
const SCALIBR = 'https://github.com/google/osv-scalibr/blob/5ab8022c6d67ff99d91d9750f2456ed9549fe8cb/veles/secrets/gcpoauth2client/detector.go#L51-L58';
const NOSEYPARKER = 'https://github.com/praetorian-inc/noseyparker/blob/2e6e7f36ce36619852532bbe698d8cb7a26d2da7/crates/noseyparker/data/default/builtin/rules/google.yml#L17-L29';
const CREDSWEEPER = 'https://github.com/Samsung/CredSweeper/blob/f21ab2f2553eea288a72273b9658cd297ab1d11f/credsweeper/rules/config.yaml#L463-L475';
const WORKSPACE_CLI = 'https://github.com/googleworkspace/cli/blob/a3768d0e82ad83cca2da97724e46bea4ff0e6dbd/crates/google-workspace-cli/src/oauth_config.rs#L26';
const OAUTH_DOCS = 'https://developers.google.com/identity/protocols/oauth2';
const CONSOLE_HELP = 'https://support.google.com/cloud/answer/15549257';

export const GOOGLE_OAUTH_CLIENT_SECRET_PATTERN = '^GOCSPX-[A-Za-z0-9_-]{28}$';

/** No arrival family: google-oauth-client-secret is a registry detector at the 4fb7882 pin (redact-secret#1029, product PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = {
  'google-oauth-client-secret': {
    tier: 'T2',
    pattern: GOOGLE_OAUTH_CLIENT_SECRET_PATTERN,
    corroboration: [
      { tool: 'google/osv-scalibr (Google-authored, R2 not applied)', label: 'gcpoauth2client: \\bGOCSPX-[a-zA-Z0-9_-]{28} (exactly 28 since 2025-12-03)', url: SCALIBR },
      { tool: 'noseyparker', label: '\\b(GOCSPX-[a-zA-Z0-9_-]{28})(?:[^a-zA-Z0-9_-]|$)', url: NOSEYPARKER },
      { tool: 'CredSweeper', label: 'GOCSPX-[0-9A-Za-z_-]{28}(?![0-9A-Za-z_-])', url: CREDSWEEPER },
    ],
    references: [SCALIBR, NOSEYPARKER, CREDSWEEPER, WORKSPACE_CLI, OAUTH_DOCS, CONSOLE_HELP, RESEARCH, RESEARCH_INDEX, R1012, RULINGS_R2_R8, product(1029), B528],
    review: 'Registry family (#1012 READY-T2; product redact-secret#1029, a registry detector since the 4fb7882 pin). The client secret of a Google OAuth client: with the public client id it completes authorization-code exchanges and refreshes tokens as that client. Installed-app secrets are treated by Google as non-confidential and web-app secrets as confidential; both share the prefix and the redaction default. T2: three dated references from three owners in two classes (Google\'s own osv-scalibr rule, provider-authored code, narrowed to exactly 28 in Google\'s commit; noseyparker; CredSweeper) state GOCSPX- + exactly 28 [A-Za-z0-9_-]; R2 would make the Google rule T1 but is not applied. Google publishes no format, and since mid-2025 the console shows only the last four characters. Google-owned repositories that commit installed-app secrets of the same width are issued values and are not counted. Excluded: unprefixed pre-GOCSPX secrets (context only), the public client id (<digits>-<id>.apps.googleusercontent.com), and the ya29. access and 1// refresh tokens, which are BLOCKED in the research record.',
    fields: [
      field({ field: 'prefix', claim: 'GOCSPX-', basis: 'tool', status: 'frozen', sources: [src(SCALIBR), src(NOSEYPARKER), src(CREDSWEEPER), src(WORKSPACE_CLI, 'GOCSPX-... placeholder (R4, prefix only)')], note: 'T2; T1 only if R2 is applied to the Google-authored rule.' }),
      field({ field: 'body', claim: 'exactly 28 [A-Za-z0-9_-] (35 in all)', basis: 'tool', status: 'frozen', sources: [src(SCALIBR, 'narrowed from {10,40} to exactly 28 on 2025-12-03'), src(NOSEYPARKER), src(CREDSWEEPER)] }),
      field({ field: 'boundary', claim: 'not [A-Za-z0-9_-] on either side', basis: 'tool', status: 'frozen', sources: [src(NOSEYPARKER), src(CREDSWEEPER)] }),
      field({ field: 'public-client-id', claim: 'the OAuth client id (<digits>-<id>.apps.googleusercontent.com) is public, never this family', basis: 'provider-documentation', status: 'frozen', sources: [src(OAUTH_DOCS), src(RESEARCH, 'excluded shapes')] }),
      field({ field: 'sibling-tokens', claim: 'ya29. access tokens and 1// refresh tokens are separate credentials whose grammar is BLOCKED', basis: 'provider-example', status: 'unresolved', sources: [src(RESEARCH, 'ya29. and 1// exact missing evidence')], note: 'Not claimed; neither a positive nor a control.' }),
      field({ field: 'peer-lag', claim: 'no GOCSPX- rule in gitleaks 8.30.1; trufflehog 3.97.4 googleoauth2 reads access tokens, not client secrets', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'no GOCSPX rule'), src(TRUFFLEHOG_DETECTORS, 'googleoauth2 access-token detector')] }),
    ],
  },
};

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {};

/** The Beta.8 profile each target this slice owns is authored toward: T2 with no empirical record, so arrival-24. */
export const profiles: Record<string, FixtureProfile> = { 'google-oauth-client-secret': 'arrival-24' };
