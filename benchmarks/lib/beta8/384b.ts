import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { gl, provider, field } from '../contract-sources.ts';

// Issue #384, slice b: Beta.10 contracts for the Amazon Bedrock API keys (research
// redact-secret#778 long-term, #779 short-term; product redact-secret#864). Owned by that
// issue only; see docs/specs/beta8-evidence.md.
//
// Two arrival families, one per grammar: the long-term key is an opaque IAM service-specific
// credential (ABSK + standard Base64), the short-term key is a client-generated Base64
// pre-signed URL behind a fixed prefix (bedrock-api-key-). Whether the product reports them as
// one family with two shapes or two is redact-secret#864's spec decision; splitting them here
// costs nothing to merge later, and keeps each grammar's evidence from borrowing the other's.
//
// Tier. The AWS Security Blog (provider-authored, 2025-10-17) prints a scan pattern for each
// key, and AWS's own token generators (Python, JS, Java) fix the short-term prefix and the
// Base64 alphabet. Whether that is provider documentation for a T1 contract is a maintainer
// ruling that redact-secret#864 records; until it does, both contracts are T2, with the blog and
// the SDK code recorded as candidate sources. Promotion is a tier change plus a providerSource,
// and leaves every positive and twin unchanged.
export const issue = '384b';

const at = '2026-09-26';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

const AWS_BLOG = 'https://aws.amazon.com/blogs/security/securing-amazon-bedrock-api-keys-best-practices-for-implementation-and-management/';
const AWS_KEYS_REF = 'https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-reference.html';
const AWS_KEYS_USE = 'https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html';
const AWS_ALIAS = 'https://docs.aws.amazon.com/IAM/latest/APIReference/API_ServiceSpecificCredential.html';
const GEN_PY = 'https://github.com/aws/aws-bedrock-token-generator-python/blob/main/aws_bedrock_token_generator/token_generator.py';
const GEN_JS = 'https://github.com/aws/aws-bedrock-token-generator-js/blob/main/src/token.ts';
const GEN_JAVA = 'https://github.com/aws/aws-bedrock-token-generator-java/blob/main/src/main/java/software/amazon/bedrock/token/BedrockTokenGenerator.java';
const GIT_SECRETS_PR = 'https://github.com/awslabs/git-secrets/pull/264';
const GITLEAKS_PR = 'https://github.com/gitleaks/gitleaks/pull/1935';
const WIZ = 'https://www.wiz.io/blog/a-new-type-of-long-lived-key-on-aws-bedrock-api-keys';
const R778 = 'https://github.com/redact-secret/redact-secret/issues/778';
const R779 = 'https://github.com/redact-secret/redact-secret/issues/779';
const R864 = 'https://github.com/redact-secret/redact-secret/issues/864';

/**
 * The 133 standard-Base64 characters that follow `bedrock-api-key-` in every short-term key:
 * the encoding of the pre-signed URL's fixed head. Computed here from the head text, in
 * the order the AWS generators emit it (host, Action, X-Amz-Algorithm, X-Amz-Credential, then
 * the `=` that separates a name from its value), so the fixture generator and the contract
 * share one derivation and neither copies the blog's printed head. The 133rd character
 * encodes the top six bits of that `=`, which is fixed, so the head is stable.
 */
export const BEDROCK_SHORT_HEAD_TEXT = 'bedrock.amazonaws.com/?Action=CallWithBearerToken&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential';
export const BEDROCK_SHORT_HEAD = Buffer.from(`${BEDROCK_SHORT_HEAD_TEXT}=`, 'utf8').toString('base64').slice(0, 133);
/** The 18 Base64 characters that follow `ABSK` when the IAM user name starts `BedrockAPIKey-` (console-created keys). */
export const BEDROCK_LONG_HEAD = 'QmVkcm9ja0FQSUtleS';
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Families measured here that no registry detector targets. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'aws-bedrock-long-term-api-key', taxonomy: 'aws-bedrock:long-term-api-key', issue,
    reason: 'No registry detector covers the Bedrock long-term key (ABSK + standard Base64) at the pinned product revision: today it is caught only where a Bearer scheme or a generic key name happens to sit beside it, under a generic finding type. redact-secret#864 adds a dedicated detector; until that lands the family is measured as an unscored arrival family.' },
  { id: 'aws-bedrock-short-term-api-key', taxonomy: 'aws-bedrock:short-term-api-key', issue,
    reason: 'No registry detector covers the Bedrock short-term key (bedrock-api-key- + Base64 pre-signed URL) at the pinned product revision: the provider-documented AWS_BEARER_TOKEN_BEDROCK assignment and a bare token are both missed today. redact-secret#864 adds a dedicated detector; until that lands the family is measured as an unscored arrival family.' },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'aws-bedrock-long-term-api-key': {
    tier: 'T2',
    // Console-created keys carry the fixed BedrockAPIKey- head. The floor is the shared tolerance of git-secrets and gitleaks
    // (109 Base64 characters after ABSK, of which the 18-character head is part); no ceiling is asserted, as the blog's + is unbounded.
    pattern: `^ABSK${BEDROCK_LONG_HEAD}[A-Za-z0-9+/]{87,}={0,2}$`,
    candidateSource: provider(AWS_BLOG, 'AWS Security Blog detection pattern for long-term keys (ABSKQmVkcm9ja0FQSUtleS[A-Za-z0-9+/]+={0,2})', 'AWS\'s own security blog prints a scan pattern for the long-term key: the ABSK prefix, a fixed head that is the Base64 of BedrockAPIKey-, and a standard-Base64 body with up to two = pad characters. A provider blog is not a format specification, so whether it meets T1 is a maintainer ruling (redact-secret#864)', at),
    corroboration: [gl, { tool: 'awslabs/git-secrets', label: 'ABSK[A-Za-z0-9+/]{109,}=*', url: GIT_SECRETS_PR }, { tool: 'Wiz measurement', label: '132 characters, ABSK + Base64', url: WIZ }],
    references: [AWS_KEYS_REF, AWS_KEYS_USE, AWS_ALIAS, GITLEAKS_PR, R778, R864],
    review: 'Arrival evidence (#384, product redact-secret#864; research #778). T2 while the T1 ruling is open: the AWS Security Blog pattern is provider-authored (prefix, fixed head, standard Base64 with up to two = pads), and gitleaks 8.30.1 and awslabs/git-secrets agree on the ABSK prefix with a 109..269-character standard-Base64 tolerance, but no provider page states a length, and the blog is a scan pattern rather than a format specification. Wiz measured 132 characters for a console key; layout arithmetic gives 136 for a second key on the same IAM user, which the positives carry. The key decodes to BedrockAPIKey-<user>-at-<account>:<secret>, where the public alias is the part before the colon. The 18-character head holds only when the IAM user name starts BedrockAPIKey-; an ABSK-only key with another head is a T2 shape that this contract does not assert either way (no fixture asserts silence on a head-less ABSK value). No length, ceiling or checksum twin is authored: the widths are tool-corroborated ranges, not a provider statement.',
    fields: [
      field({ field: 'prefix', claim: 'ABSK', basis: 'provider-documentation', status: 'frozen', sources: [src(AWS_BLOG, 'detection pattern for long-term keys')], note: 'Provider blog, not a specification page: the maintainer ruling on T1 (redact-secret#864) decides whether it is provider documentation.' }),
      field({ field: 'console-head', claim: 'QmVkcm9ja0FQSUtleS (Base64 of BedrockAPIKey-) follows ABSK for console-created keys', basis: 'provider-documentation', status: 'provisional', sources: [src(AWS_BLOG), src(WIZ, 'decodes to BedrockAPIKey-<4 chars>[+1]-at-<12-digit account>:<secret>')], note: 'Holds only when the IAM user name starts BedrockAPIKey-. Positives carry it; nothing asserts silence on its absence.' }),
      field({ field: 'body-alphabet', claim: 'standard Base64 ([A-Za-z0-9+/], up to two trailing =)', basis: 'provider-documentation', status: 'frozen', sources: [src(AWS_BLOG), src(GIT_SECRETS_PR)], note: 'No source documents a URL-safe variant.' }),
      field({ field: 'total-length', claim: '132 characters for a console key, and 136 by layout arithmetic for a +1 secondary key; tools tolerate 113..273', basis: 'tool', status: 'provisional', sources: [src(WIZ, '132'), src(gl.url, '{109,269} after ABSK'), src(GIT_SECRETS_PR, '{109,}')], note: 'No length or ceiling twin is authored; positives use 132 and 136.' }),
      field({ field: 'decoded-structure', claim: 'BedrockAPIKey-<user>[+1]-at-<12-digit account>:<44 random bytes as Base64>', basis: 'maintainer-observation', status: 'provisional', sources: [src(WIZ), src(AWS_ALIAS, 'ServiceCredentialAlias is the public portion: the IAM user name plus a version and creation suffix')], note: 'Wiz notes the structure is subject to change; positives are built from this layout with a zero account and synthetic bytes.' }),
      field({ field: 'transport', claim: 'AWS_BEARER_TOKEN_BEDROCK environment variable or Authorization: Bearer', basis: 'provider-documentation', status: 'frozen', sources: [src(AWS_KEYS_USE)] }),
      field({ field: 'public-alias', claim: 'the decoded BedrockAPIKey-<user>-at-<account> alias is a public identifier', basis: 'provider-documentation', status: 'frozen', sources: [src(AWS_ALIAS)], note: 'Backs the alias controls; the secret part after the colon is never a control.' }),
    ],
  },
  'aws-bedrock-short-term-api-key': {
    tier: 'T2',
    // The provider blog's printed body class is malformed (research #779 row 7); the intended class is standard padded Base64,
    // which every AWS generator emits. The non-empty body is the blog's own +; its width is undocumented.
    pattern: `^bedrock-api-key-${escape(BEDROCK_SHORT_HEAD)}[A-Za-z0-9+/]+={0,2}$`,
    candidateSource: provider(GEN_PY, 'AUTH_PREFIX = "bedrock-api-key-" in AWS\'s Python, JS and Java token generators', 'AWS-authored generators (aws-bedrock-token-generator, Python, JS and Java) build the short-term key as bedrock-api-key- followed by the standard padded Base64 of a SigV4-presigned CallWithBearerToken URL plus &Version=1, and the AWS Security Blog prints the fixed 133-character Base64 head. Provider code and a provider blog are not a documentation page, so whether that meets T1 is a maintainer ruling (redact-secret#864)', at),
    corroboration: [gl, { tool: 'awslabs/git-secrets', label: 'bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29t', url: GIT_SECRETS_PR }],
    references: [AWS_KEYS_REF, AWS_KEYS_USE, AWS_BLOG, GEN_JS, GEN_JAVA, R779, R864],
    review: 'Arrival evidence (#384, product redact-secret#864; research #779). T2 while the T1 ruling is open: three AWS-authored token generators fix the bedrock-api-key- prefix, the &Version=1 suffix and standard padded Base64, and the AWS Security Blog prints a fixed 133-character head, but no AWS page documents the key as a format. gitleaks 8.30.1 and awslabs/git-secrets match only the prefix plus a 28-character head (the Base64 of bedrock.amazonaws.com), a weaker anchor than the blog\'s. The head is the Base64 of the fixed pre-signed URL head, so the generator derives it from that text. The body after the head has no documented width: about 500 characters without a session token, over 1000 with one. No length or ceiling twin is authored. The decoded pre-signed URL is a different lexical form of the same secret and a separate ruling; it is not authored.',
    fields: [
      field({ field: 'prefix', claim: 'bedrock-api-key-', basis: 'provider-code', status: 'frozen', sources: [src(GEN_PY, 'AUTH_PREFIX'), src(GEN_JS, 'AUTH_PREFIX'), src(GEN_JAVA, 'AUTH_PREFIX')] }),
      field({ field: 'fixed-head', claim: 'the 133 Base64 characters after the prefix encode bedrock.amazonaws.com/?Action=CallWithBearerToken&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential', basis: 'provider-code', status: 'frozen', sources: [src(AWS_BLOG, 'the blog regex prints the head'), src(GEN_PY, 'host, Action and signing parameters')], note: 'The weaker 28-character anchor used by gitleaks and git-secrets is a tool choice; the twins here differ from the positive within the first 28 characters of the head, so they hold under either anchor.' }),
      field({ field: 'body-alphabet', claim: 'standard padded Base64 ([A-Za-z0-9+/], up to two trailing =)', basis: 'provider-code', status: 'frozen', sources: [src(GEN_PY, 'base64.b64encode'), src(GEN_JS, 'toString("base64")'), src(GEN_JAVA, 'Base64.getEncoder()')], note: 'The blog\'s printed body class is malformed; no source documents a URL-safe variant.' }),
      field({ field: 'version-suffix', claim: 'the encoded payload ends with &Version=1', basis: 'provider-code', status: 'frozen', sources: [src(GEN_PY, 'TOKEN_VERSION'), src(GEN_JS, 'TOKEN_VERSION')] }),
      field({ field: 'total-length', claim: 'about 500 characters for a key presigned without a session token and over 1000 with one; no bound is documented', basis: 'community', status: 'unresolved', sources: [src(WIZ, 'over 1000 characters'), src(R779, 'reconstruction by construction, about 500 without a session token')], note: 'Positives carry three sizes; no length twin is authored.' }),
      field({ field: 'lifetime', claim: 'valid for the shorter of 12 hours and the generating session', basis: 'provider-documentation', status: 'frozen', sources: [src(AWS_KEYS_REF)] }),
      field({ field: 'transport', claim: 'AWS_BEARER_TOKEN_BEDROCK environment variable or Authorization: Bearer, shared with the long-term key', basis: 'provider-documentation', status: 'frozen', sources: [src(AWS_KEYS_USE)] }),
      field({ field: 'console-output', claim: 'whether a console-generated short-term key is byte-identical to the SDK output', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R779, 'hands-on checklist item')] }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'aws-bedrock-long-term-api-key': 'arrival-24',
  'aws-bedrock-short-term-api-key': 'arrival-24',
};

