import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, gl, provider, field } from '../contract-sources.ts';

// Issue #259. Owned by that issue only; see docs/specs/beta8-evidence.md.
// Arrival evidence for the families product PR redact-secret#773 adds:
// travisci-api-token (redact-secret#523), neon-api-key (#524),
// postman-collection-access-key (#700), and the prefix-less Mailgun key triplet
// that mailgun-api-key now also reports (#701). redact-secret#773 merged before
// this evidence was authored, so benchmarks/detectors.json is pinned to its
// merge, product main 3144bb3, in the same change: the three new detectors are
// authored directly as registry families (`registryContracts`), skipping the
// arrival stage. The triplet stays an arrival family, because the product
// types it inside the shared mailgun-api-key detector.
export const issue = 259;

const at = '2026-09-24';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

const TRAVIS_AUTH = 'https://developer.travis-ci.com/authentication';
const TRAVIS_TRIGGER = 'https://docs.travis-ci.com/user/triggering-builds/';
const NEON_CHANGELOG = 'https://neon.com/docs/changelog/2025-01-31';
const NEON_CHANGELOG_SRC = 'https://github.com/neondatabase/website/blob/main/content/changelog/2025-01-31.md';
const NEON_API_KEYS = 'https://neon.com/docs/manage/api-keys';
const NEON_BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/6cf4f1a29160b68be7c6390599b9b773234e5a43/cmd/generate/config/rules/neon.go';
const NEON_MASKGO = 'https://github.com/koki-develop/mask-go/blob/3ff232051d4d224314b400d9e973c5a8c7d405d5/builtin_neon_api_key.go';
const GH_PATTERNS = 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns';
const PM_SHARING = 'https://learning.postman.com/docs/collaborating-in-postman/sharing/';
const PM_AUTH = 'https://learning.postman.com/docs/developer/postman-api/authentication/';
const PM_CAK_API = 'https://learning.postman.com/api-docs/api-reference/collection-access-keys/get-collection-access-keys';
const PM_GITLAB = 'https://gitlab.com/gitlab-org/security-products/secret-detection/secret-detection-rules/-/blob/e1c7e83815a7e55cc1514dd59d4e56459e39cbfb/rules/mit/postman/postman.toml';
const MG_TH_ISSUE = 'https://github.com/trufflesecurity/trufflehog/issues/3870';
const MG_GO_ISSUE = 'https://github.com/mailgun/mailgun-go/issues/72';
const MG_DISCOURSE_1 = 'https://meta.discourse.org/t/current-mailgun-api-key-does-not-work/93661';
const MG_DISCOURSE_2 = 'https://meta.discourse.org/t/mailgun-secret-api-key-rejected/61852';
const MG_KEYS = 'https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/keys/post-v1-keys';
const MG_RESEARCH = 'https://github.com/redact-secret/redact-secret/issues/582#issuecomment-5800612791';

/** Families measured here that no registry detector targets. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'mailgun-api-key-triplet', taxonomy: 'mailgun:legacy-signing-key-triplet', issue,
    reason: 'The registry mailgun-api-key contract covers key- + 32 bytes only. redact-secret#773 (redact-secret#701) makes the product detector also report the prefix-less 32-8-8 lowercase-hex triplet under the same mailgun_api_key type, inside the shared detector, so the triplet is measured as its own context-gated arrival family rather than a registry id.' },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'mailgun-api-key-triplet': {
    tier: 'T2', contextGated: true,
    pattern: '^[0-9a-f]{32}-[0-9a-f]{8}-[0-9a-f]{8}$',
    corroboration: [gl, th('mailgun/mailgun')],
    twinSource: provider(MG_KEYS, 'Mailgun key objects with an 8-8 hex id', 'Mailgun\'s Keys API documents keys as objects with a separate id (shown 8-8 hex) and states no secret shape. Context twins keep the triplet byte-for-byte and rename the Mailgun key to a Mailgun identifier name (key id, domain, message id), or move the Mailgun keyword off the line', at),
    references: [MG_TH_ISSUE, MG_GO_ISSUE, MG_DISCOURSE_1, MG_DISCOURSE_2, MG_RESEARCH],
    review: 'Context-gated arrival family (#259, product redact-secret#701). Three sources describe a prefix-less <32 hex>-<8 hex>-<8 hex> value as Mailgun\'s newer private API key: a Mailgun-repository contributor (mailgun-go#72, 2019), customer reports (Discourse, 2018) and trufflehog#3870 (2025). Both pinned peers match the shape: gitleaks 8.30.1 mailgun-signing-key (keyword-gated, [a-h0-9]) and trufflehog 3.97.4 mailgun (its "Hex MailGun Token" pattern, chunk-keyword-gated). Mailgun documents no shape for any key, so no issued key is known and the contract is recorded uncertainty. Before this issue, the benchmark taxonomy listed the triplet as an unsupported legacy signing key; this issue corrects that reason. The triplet is recognised only beside a same-line mailgun keyword and scores as policy. Its twins keep the triplet and change only the context. The alphabet is lowercase hex, the intersection of both peers, so an uppercase triplet is a near-miss control rather than a twin.',
    fields: [
      field({ field: 'shape', claim: '32 lowercase hex, -, 8 lowercase hex, -, 8 lowercase hex', basis: 'tool', status: 'frozen', sources: [src(gl.url, 'mailgun-signing-key'), src(th('mailgun/mailgun').url, 'Hex MailGun Token')] }),
      field({ field: 'role', claim: 'the newer private API key (not only a legacy signing key)', basis: 'community', status: 'provisional', sources: [src(MG_GO_ISSUE, 'Mailgun-repository contributor, 2019'), src(MG_DISCOURSE_1, 'customer report, 2018'), src(MG_DISCOURSE_2), src(MG_TH_ISSUE, '2025')], note: 'No issued key observed; recorded uncertainty (redact-secret#701).' }),
      field({ field: 'context', claim: 'same-line mailgun keyword', basis: 'tool', status: 'frozen', sources: [src(gl.url), src(th('mailgun/mailgun').url)] }),
      field({ field: 'key id', claim: 'Mailgun key objects carry a separate 8-8 hex id', basis: 'provider-documentation', status: 'provisional', sources: [src(MG_KEYS)] }),
    ],
  },
};

/**
 * Contracts for the three families redact-secret#773 registered (each key is a benchmarks/detectors.json id
 * at the 3144bb3 pin). Merged into the registry contracts by benchmarks/lib/assessment.ts, never duplicated there.
 */
export const registryContracts: Record<string, FormatContract> = {
  'travisci-api-token': {
    tier: 'T2', contextGated: true,
    pattern: '^(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{22}$',
    corroboration: [gl, th('travisci/travisci')],
    twinSource: provider(TRAVIS_AUTH, 'Authorization: token header, token from travis token', 'the provider documents the API token as generated by the travis CLI (travis token, travis token --pro) and sent in an Authorization: token header to api.travis-ci.org / api.travis-ci.com; the example is masked (xxxxxxxxxxxx) and no length or alphabet is stated. Context twins keep the token and remove the same-line Travis context, or rename the key to a Travis identifier name', at),
    references: [TRAVIS_TRIGGER],
    review: 'Registry detector travisci-api-token since redact-secret#523 (#773, registry pinned at 3144bb3); authored under #259 directly as a context-gated registry contract. Travis CI states no token shape. Both pinned peers corroborate a 22-character alphanumeric token gated on a travis keyword: gitleaks 8.30.1 travisci-access-token (a case-insensitive travis keyword before an assignment operator, then [a-z0-9]{22} under (?i)) and trufflehog 3.97.4 travisci (a travis prefix within its keyword window, then \\b[a-zA-Z0-9_]{22}\\b). The contract freezes their intersection, [A-Za-z0-9]{22}, recognised only beside a same-line travis keyword, so positives score as policy. It also requires at least one letter and one digit, matching the product grammar; about 2% of uniformly random 22-character tokens have no digit and fall outside that claim. The underscore trufflehog admits is not claimed, and the underscore twin records that peer difference. Travis build, job and repository ids are numeric and commit SHAs are 40 hex characters, so they are public-id controls. .travis.yml secure: values are RSA ciphertext and are encoded-value controls.',
    fields: [
      field({ field: 'transport', claim: 'API token generated by travis token and sent in an Authorization: token header', basis: 'provider-documentation', status: 'frozen', sources: [src(TRAVIS_AUTH), src(TRAVIS_TRIGGER)] }),
      field({ field: 'length', claim: 'exactly 22 characters', basis: 'tool', status: 'frozen', sources: [src(gl.url, 'travisci-access-token'), src(th('travisci/travisci').url)] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9], the intersection of gitleaks (?i)[a-z0-9] and trufflehog [a-zA-Z0-9_]', basis: 'tool', status: 'provisional', sources: [src(gl.url), src(th('travisci/travisci').url)], note: 'trufflehog also admits _; not claimed.' }),
      field({ field: 'mixed letters and digits', claim: 'a token contains at least one letter and one digit', basis: 'research-hypothesis', status: 'provisional', sources: [src('https://github.com/redact-secret/redact-secret/pull/773', 'product precision guard (redact-secret#523)')], note: 'A precision guard, not a provider fact: about 2% of random tokens have no digit.' }),
      field({ field: 'context', claim: 'same-line travis keyword', basis: 'tool', status: 'frozen', sources: [src(gl.url), src(th('travisci/travisci').url)] }),
    ],
  },
  'neon-api-key': {
    tier: 'T2',
    pattern: '^napi_[A-Za-z0-9]{64,}$',
    corroboration: [{ tool: 'betterleaks', label: 'neon-api-key', url: NEON_BETTERLEAKS }, { tool: 'mask-go', label: 'neon-api-key', url: NEON_MASKGO }],
    twinSource: provider(NEON_CHANGELOG, 'napi_ prefix (2025-01-31 changelog)', 'Neon states that newly created API keys are prefixed with napi_ so that secret scanning can rely on an identifiable marker, and that existing unprefixed keys stay valid. It states no body length or alphabet. Twins mutate the prefix, its delimiter, the body length floor or the body alphabet', at),
    references: [NEON_CHANGELOG_SRC, NEON_API_KEYS, GH_PATTERNS],
    review: 'Registry detector neon-api-key since redact-secret#524 (#773, registry pinned at 3144bb3); authored under #259 directly as a registry contract. The napi_ prefix is provider-documented (Neon changelog 2025-01-31, source neondatabase/website content/changelog/2025-01-31.md). The body is not: Neon calls a key "a randomly-generated 64-bit token", and its one written example (napi_examplekey...) is a word and two ordered runs, not a shape. The 64-character [A-Za-z0-9] body floor is corroborated by betterleaks neon-api-key (exactly 64, entropy-gated) and mask-go (64 as a floor). The tier is therefore T2: a T1 prefix with a tool-corroborated body stays at the weakest frozen field. The body is read as a floor, so no fixture asserts silence on a longer body. GitHub secret scanning lists neon_api_key as a partner pattern without publishing the expression. Neither pinned peer (gitleaks 8.30.1, trufflehog 3.97.4) has a Neon rule, so a peer miss is expected. Legacy unprefixed keys are not claimed and are not controls. A Neon connection URI password is a separate credential that the connection-string family already covers, and it is never a control here. Node-API identifiers (napi_create_string_utf8, NAPI_VERSION) are near-miss controls.',
    fields: [
      field({ field: 'prefix', claim: 'napi_', basis: 'provider-documentation', status: 'frozen', sources: [src(NEON_CHANGELOG), src(NEON_CHANGELOG_SRC)] }),
      field({ field: 'body length', claim: 'at least 64 characters', basis: 'tool', status: 'frozen', sources: [src(NEON_BETTERLEAKS, 'exactly 64'), src(NEON_MASKGO, '64 as a floor')], note: 'Neon says "64-bit token", which fits no string length; not used.' }),
      field({ field: 'body alphabet', claim: '[A-Za-z0-9]', basis: 'tool', status: 'frozen', sources: [src(NEON_BETTERLEAKS), src(NEON_MASKGO)] }),
      field({ field: 'legacy keys', claim: 'keys issued before the prefix stay valid and carry no marker', basis: 'provider-documentation', status: 'unresolved', sources: [src(NEON_CHANGELOG)], note: 'Not claimed; never a control.' }),
    ],
  },
  'postman-collection-access-key': {
    tier: 'T2',
    pattern: '^PMAT-[A-Z0-9]{26}$',
    corroboration: [{ tool: 'GitLab secret-detection-rules', label: 'PostmanCollectionAccessKey', url: PM_GITLAB }],
    twinSource: provider(PM_CAK_API, 'masked PMAT- collection access key', 'Postman documents the collection access key as a read-only credential for one collection\'s JSON (Share via API), valid for 60 days of inactivity, and renders it masked as PMAT- followed by asterisks and four trailing characters (26 in all). It states no alphabet. Twins mutate the prefix, its delimiter or the body length', at),
    references: [PM_SHARING, PM_AUTH, GH_PATTERNS],
    review: 'Registry detector postman-collection-access-key since redact-secret#700 (#773, registry pinned at 3144bb3); authored under #259 directly as a registry contract. Postman documents the collection access key (Share via API: "Generate New Key to create a read-only collection access key. This key expires after 60 days of inactivity") and tells users to remove sensitive data before sharing one. Its API reference renders the key masked as PMAT- + asterisks + 4 characters, a 26-character body by count (provider example, not a grammar statement). GitLab\'s secret-detection rule PostmanCollectionAccessKey matches \\bPMAT-[A-Z0-9]{26}\\b and gates validation on a postman or pstmn.io context; its examples are ULID-shaped, which is recorded as unresolved; GitHub secret scanning lists postman_collection_key as a partner pattern without publishing the expression. The contract freezes GitLab\'s uppercase alphanumeric body. The product (redact-secret#700) also accepts lowercase, a looser reading. No lowercase twin is authored, because the case is stated by one tool only. Neither pinned peer has a PMAT- rule. The PMAK- API key is a different, secret credential and is never a control. The prefix twin swaps PMAT- for PMAK- with the same 26-character body, which fits neither contract.',
    fields: [
      field({ field: 'credential', claim: 'read-only collection access key, 60-day inactivity expiry, shared via the collection JSON URL', basis: 'provider-documentation', status: 'frozen', sources: [src(PM_SHARING), src(PM_AUTH)] }),
      field({ field: 'prefix', claim: 'PMAT-', basis: 'provider-example', status: 'frozen', sources: [src(PM_CAK_API, 'masked display')] }),
      field({ field: 'body length', claim: 'exactly 26 characters', basis: 'tool', status: 'frozen', sources: [src(PM_GITLAB)], note: 'The provider\'s masked display (asterisks + 4) counts to 26, which agrees but is not a statement.' }),
      field({ field: 'body alphabet', claim: '[A-Z0-9]', basis: 'tool', status: 'provisional', sources: [src(PM_GITLAB)], note: 'One tool only; the product accepts lowercase too. No case twin.' }),
      field({ field: 'ULID body', claim: 'the body may be a ULID (26 Crockford base32 characters with a timestamp prefix): every example in GitLab\'s rule has that shape', basis: 'tool', status: 'unresolved', sources: [src(PM_GITLAB, 'rule examples; not copied into any fixture')], note: 'Not claimed. Positives use the rule\'s wider [A-Z0-9]{26}; no fixture asserts silence on a non-ULID body.' }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'travisci-api-token': 'arrival-24',
  'neon-api-key': 'arrival-24',
  'postman-collection-access-key': 'arrival-24',
  'mailgun-api-key-triplet': 'context-48',
};
