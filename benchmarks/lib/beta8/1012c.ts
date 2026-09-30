import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { research, RESEARCH_INDEX, R1012, RULINGS_R1_R3, RULINGS_R2_R8, RULINGS_R9_R10, B528, product, at, src, unscoredReason } from './1012-sources.ts';
import { base36Crc, GITLAB_ROUTABLE_CRC_WIDTH } from './212.ts';

// Issue #1012, slice c: Beta.12 contract for the routable GitLab personal access token (redact-secret#1012 READY-T1;
// research docs/audits/evidence/1012/gitlab-routable-personal-access-token.md; product redact-secret#1022, which extends
// gitlab-token with a routable glpat- branch under the unchanged gitlab_token finding type). Owned by this slice only;
// see docs/specs/beta8-evidence.md.
//
// T1 under R1 and R9: GitLab's generator, decoder, the personal-access-token model and the design document state every
// part: glpat- + an unpadded base64url payload of 27–300 + . + a 2-character base36 version + . + a 2-character base36
// payload length + a 7-character base36 CRC32 of everything before it. The length holder and the CRC are provider-owned
// offline checks the provider's own validator enforces, so `validate` enforces them: a value whose length holder or CRC
// does not verify is outside the contract (unlike the #528 checksums, which are policy and never reject).
//
// Modelling: the product reports the routable token under gitlab-token's own finding type gitlab_token, so a finding
// carries no evidence of its own and the family stays an unscored arrival family (not an arrivalFindingTypes row). It is
// not extra gitlab-token corpus either: the registry gitlab-token contract is the legacy 20-byte body, which a routable
// value does not satisfy.
export const issue = '1012c';

const RESEARCH = research('gitlab-routable-personal-access-token.md');
const GENERATOR = 'https://gitlab.com/gitlab-org/gitlab/-/blob/fa2faf332129a1fd9130b052f42b85f0fa346b65/lib/authn/token_field/generator/routable_token.rb#L7-L86';
const DECODER = 'https://gitlab.com/gitlab-org/gitlab/-/blob/fa2faf332129a1fd9130b052f42b85f0fa346b65/lib/authn/token_field/decoders/v1/routable_payload.rb#L24-L71';
const PAT_MODEL = 'https://gitlab.com/gitlab-org/gitlab/-/blob/fa2faf332129a1fd9130b052f42b85f0fa346b65/app/models/personal_access_token.rb#L22-L36';
const DESIGN = 'https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/routable_tokens/';
const GITLAB_RULES = 'https://gitlab.com/gitlab-org/security-products/secret-detection/secret-detection-rules/-/blob/cae5670b0d83aaea0ff37c085119e82ff394f283/rules/mit/gitlab/gitlab.toml#L27-L57';
const CLIENT_PATTERNS = 'https://gitlab.com/gitlab-org/gitlab/-/blob/fa2faf332129a1fd9130b052f42b85f0fa346b65/app/assets/javascripts/lib/utils/secret_detection_patterns.js#L5-L24';
const GL_GITLAB = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml';
const TH_V3 = 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/gitlab/v3/gitlab_v3.go';
const TH_ISSUE = 'https://github.com/trufflesecurity/trufflehog/issues/4551';

export const GITLAB_ROUTABLE_PAT_PATTERN = '^glpat-[A-Za-z0-9_-]{27,300}\\.[0-9a-z]{2}\\.[0-9a-z]{2}[0-9a-z]{7}$';

/** The provider's offline check: the base36 length holder equals the payload length and the last 7 characters are the base36 CRC32 of everything before them. */
export function gitlabRoutablePatValid(value: string): boolean {
  const m = /^glpat-([A-Za-z0-9_-]+)\.[0-9a-z]{2}\.([0-9a-z]{2})([0-9a-z]{7})$/.exec(value);
  if (!m) return false;
  const [, payload, length, crc] = m;
  return Number.parseInt(length, 36) === payload.length && base36Crc(value.slice(0, -GITLAB_ROUTABLE_CRC_WIDTH)) === crc;
}

export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'gitlab-routable-personal-access-token', taxonomy: 'gitlab:routable-personal-access-token', issue,
    reason: unscoredReason('gitlab-token', 'gitlab_token', 1022, 'The registry gitlab-token contract is the legacy 20-byte body, which a routable value does not satisfy, so the routable shape is measured here under its own contract.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'gitlab-routable-personal-access-token': {
    tier: 'T1',
    pattern: GITLAB_ROUTABLE_PAT_PATTERN,
    validate: gitlabRoutablePatValid,
    providerSource: provider(GENERATOR, 'gitlab-org/gitlab lib/authn/token_field/generator/routable_token.rb at fa2faf33 (version field since 2025-04-22, 8343330f): "#{prefix}#{base64_payload}.#{token_version}.#{base64_payload_length}" + Zlib.crc32(...).to_s(36).rjust(7, "0"); routable_payload.rb decodes and verifies it; personal_access_token.rb binds glpat- to the routable generator (routable_pat flag removed 2025-07-24, 36573efc); re-checked 2026-09-29', 'glpat- + unpadded base64url payload of 27–300 + . + 2 base36 version + . + 2 base36 payload length + 7 base36 CRC32 of every byte before it; 46–319 bytes', at),
    corroboration: [],
    references: [GENERATOR, DECODER, PAT_MODEL, DESIGN, GITLAB_RULES, CLIENT_PATTERNS, GL_GITLAB, TH_V3, TH_ISSUE, RESEARCH, RESEARCH_INDEX, R1012, RULINGS_R1_R3, RULINGS_R2_R8, RULINGS_R9_R10, product(1022), B528],
    review: 'Arrival evidence (#1012 READY-T1; product redact-secret#1022, which reports the routable token whole under gitlab-token\'s gitlab_token finding type). A GitLab personal access token authenticates as its user to the REST and GraphQL APIs, Git over HTTPS and the registry within its scopes; every new PAT has been routable since the routable_pat flag was removed on 2025-07-24. T1 under R1 and R9: GitLab\'s generator, its decoder, the model that binds glpat- to the generator and the design document state the prefix, the unpadded base64url payload of 27–300, both . separators, the 2-character base36 version (01 today), the 2-character base36 payload-length holder and the 7-character base36 CRC32 over every byte from g through the length holder; GitLab-authored rules agree. The length holder and the CRC are provider offline checks, so `validate` enforces them and a value that fails either is outside the contract (a checksum or length-holder twin). The current generator caps the payload at 235 characters; the design cap 300 is used. Excluded: the legacy glpat- + 20 shape (the gitlab-token contract), the unversioned 2024-11 to 2025-04 routable form, instance or admin-custom prefixes (the CRC covers the custom prefix), and other routable GitLab prefixes (glrt- is gitlab-runner-authentication-token). Pinned peers: gitleaks 8.30.1 has only the unversioned routable rule (gitlab-pat-routable) and its legacy gitlab-pat rule reads a 20-byte slice of the payload; trufflehog 3.97.4 gitlab/v3 reads the versioned form over [a-zA-Z0-9=_-]{27,300} with unescaped dots and checks neither the length holder nor the CRC. Both labels map to gitlab-token (scanners/families.mjs), so a peer finding reads as co-detection, never as this family.',
    fields: [
      field({ field: 'grammar', claim: '<prefix><base64-payload>.<token-version>.<base64-payload-length><crc32>; payload 27 to 300 bytes; version and CRC base36', basis: 'provider-documentation', status: 'frozen', sources: [src(DESIGN, 'routable tokens design document')] }),
      field({ field: 'prefix', claim: 'glpat-', basis: 'provider-code', status: 'frozen', sources: [src(PAT_MODEL, 'PERSONAL_TOKEN_PREFIX')] }),
      field({ field: 'payload', claim: 'unpadded base64url [A-Za-z0-9_-], 27 to 300 characters', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'urlsafe_encode64(padding: false); 16 random bytes + routing payload + one length byte'), src(DESIGN, 'minimum 27, maximum 300 bytes')], note: 'The current generator caps the payload at 235; the design-document cap is used.' }),
      field({ field: 'separators', claim: '. after the payload and after the version; none elsewhere', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR)] }),
      field({ field: 'version', claim: 'exactly 2 [0-9a-z] (base36, zero-padded; 01 today)', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'TOKEN_VERSION = 1, TOKEN_VERSION_LENGTH = 2')] }),
      field({ field: 'length-holder', claim: 'exactly 2 [0-9a-z]: base36 of the payload length', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR), src(DECODER, 'reads the payload length from the third field')] }),
      field({ field: 'checksum', claim: 'exactly 7 [0-9a-z]: base36 CRC32 (zlib) of every byte from g of glpat- through the length holder, zero-padded; enforced by `validate`', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'CRC_BYTES = 7'), src(DECODER, 'valid when the CRC of everything before the last 7 characters equals them')] }),
      field({ field: 'excluded-forms', claim: 'the legacy glpat- + 20, the unversioned routable form, instance/custom prefixes and glrt- are not this family', basis: 'provider-code', status: 'frozen', sources: [src(RESEARCH, 'excluded shapes'), src(CLIENT_PATTERNS, 'instance and admin-custom prefixes')], note: 'The legacy 20-byte glpat- value is a benign sibling control here (gitlab-token owns it).' }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 lags: gitlab-pat-routable reads only the unversioned form and gitlab-pat a 20-byte payload slice. trufflehog 3.97.4 gitlab/v3 overreaches: it reads the versioned form with unescaped dots and = in the payload and checks neither the length holder nor the CRC', basis: 'tool', status: 'frozen', sources: [src(GL_GITLAB, 'gitlab-pat, gitlab-pat-routable'), src(TH_V3, 'keyPat at v3.97.4'), src(TH_ISSUE)] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward: every field is T1 provider code. */
export const profiles: Record<string, FixtureProfile> = { 'gitlab-routable-personal-access-token': 'documented-24' };
