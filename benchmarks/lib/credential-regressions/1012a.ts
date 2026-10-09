import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { field } from '../contract-sources.ts';
import { research, RESEARCH_INDEX, R1012, RULINGS_R2_R8, B528, product, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './1012-sources.ts';

// Issue #1012, slice a: Beta.12 contract for the AWS IAM user secret access key (redact-secret#1012 READY-T2,
// context-constrained; research docs/audits/evidence/1012/aws-iam-user-secret-access-key.md; product redact-secret#1028,
// the new aws-secret-access-key detector). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T2, context-gated: exactly 40 [A-Za-z0-9/+] rests on an AWS docs example (R5), two AWS-owned scanner rules (git-secrets,
// ferret-scan; R2 is not applied, so they count as corroboration) and peer rules from four more owners. The value has no
// prefix, so no bare-value claim is made: AWS's own detectors (Macie, git-secrets, ferret-scan) require a key name or an
// adjacent access key id too. Positives score as project policy and their twins keep the value and change only the gate.
export const issue = '1012a';

const RESEARCH = research('aws-iam-user-secret-access-key.md');
const STS_KEY_INFO = 'https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html';
const IAM_ACCESS_KEY = 'https://docs.aws.amazon.com/IAM/latest/APIReference/API_AccessKey.html';
const MACIE = 'https://docs.aws.amazon.com/macie/latest/user/mdis-reference-credentials.html';
const GIT_SECRETS = 'https://github.com/awslabs/git-secrets/blob/7d6b970cbd3c216353cb22b383b70c150140662e/git-secrets#L242';
const FERRET = 'https://github.com/awslabs/ferret-scan/blob/c3b10fba90a5ed6178314ac646988546122afc60/internal/validators/secrets/validator.go#L1434-L1444';
const TH_AWS = 'https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/aws/common.go#L16';
const NOSEYPARKER = 'https://github.com/praetorian-inc/noseyparker/blob/2e6e7f36ce36619852532bbe698d8cb7a26d2da7/crates/noseyparker/data/default/builtin/rules/aws.yml#L30-L43';
const SCALIBR = 'https://github.com/google/osv-scalibr/blob/5ab8022c6d67ff99d91d9750f2456ed9549fe8cb/veles/secrets/awsaccesskey/detector.go#L25-L26';
const SUMMIT_ROUTE = 'https://summitroute.com/blog/2018/06/20/aws_security_credential_formats/';

export const AWS_SECRET_PATTERN = '^[A-Za-z0-9/+]{40}$';

/** No arrival family: aws-secret-access-key is a registry detector at the 4fb7882 pin (redact-secret#1028, product PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = {
  'aws-secret-access-key': {
    tier: 'T2', contextGated: true,
    pattern: AWS_SECRET_PATTERN,
    corroboration: [
      { tool: 'awslabs/git-secrets (AWS-authored, R2 not applied)', label: 'key-name-gated [A-Za-z0-9/\\+=]{40}', url: GIT_SECRETS },
      { tool: 'awslabs/ferret-scan (AWS-authored, R2 not applied)', label: '[A-Za-z0-9/+]{40} gated by an AWS secret key name or an AKIA/ASIA id on the same or an adjacent line', url: FERRET },
      { tool: 'trufflehog (HEAD)', label: '[A-Za-z0-9+/]{40} with boundaries, only paired with an access key id', url: TH_AWS },
      { tool: 'noseyparker', label: 'key-name-gated (?i)[a-z0-9/+=]{40}', url: NOSEYPARKER },
      { tool: 'osv-scalibr', label: '\\b[A-Za-z0-9+/]{40}\\b paired with an id within 10 KiB', url: SCALIBR },
    ],
    references: [STS_KEY_INFO, IAM_ACCESS_KEY, MACIE, GIT_SECRETS, FERRET, TH_AWS, NOSEYPARKER, SCALIBR, SUMMIT_ROUTE, RESEARCH, RESEARCH_INDEX, R1012, RULINGS_R2_R8, product(1028), B528],
    review: 'Context-gated registry family (#1012 READY-T2, context-constrained; product redact-secret#1028, a registry detector since the 4fb7882 pin). The secret half of a long-term IAM user access key: with its AKIA id it signs any API call the user may make. T2: exactly 40 [A-Za-z0-9/+] is the AWS docs example shape (R5) and the grammar of two AWS-owned scanner rules (git-secrets, ferret-scan; R2 would make them T1 but is not applied) and of peers from Truffle Security, Praetorian and Google; no AWS page states "40 characters" in prose. The value has no prefix, and AWS\'s own detectors require context (Macie: "Keyword required: Yes"), so the family is recognised only under an AWS secret key name (aws_secret_access_key, AWS_SECRET_ACCESS_KEY, SecretAccessKey, secret_access_key, aws_secret_key, "secret access key") or next to an AKIA access key id; its positives score as project policy and its context twins keep the value byte-for-byte and remove that gate. = inside the 40 is excluded (30 random bytes encode to 40 characters without padding; ferret-scan, trufflehog and veles agree). Excluded: a bare 40-character run, temporary (ASIA-paired) secrets (the only AWS example is 41 characters), and session tokens. No fixture asserts silence on a 40-character Base64 value beside the gate: the contract admits any such value there.',
    fields: [
      field({ field: 'value', claim: 'exactly 40 [A-Za-z0-9/+], no prefix, no checksum', basis: 'provider-example', status: 'frozen', sources: [src(STS_KEY_INFO, 'the example secret is 40 characters of [A-Za-z0-9/]'), src(GIT_SECRETS), src(FERRET), src(SUMMIT_ROUTE, 'Base64 of 30 random bytes')], note: 'T2: one provider example shape plus AWS-owned and peer rules; the IAM AccessKey API type states only "String".' }),
      field({ field: 'context', claim: 'an AWS secret key name on the value\'s own line, or an AKIA access key id on the same or an adjacent line', basis: 'provider-documentation', status: 'frozen', sources: [src(MACIE, 'AWS_CREDENTIALS: keyword required'), src(FERRET, 'key-name or adjacent-id gate')], note: 'That AWS requires context is T1 (Macie); the name list itself is T2.' }),
      field({ field: 'padding', claim: '= is not part of the 40 (30 bytes encode to 40 characters without padding)', basis: 'tool', status: 'frozen', sources: [src(FERRET), src(TH_AWS), src(SCALIBR)], note: 'git-secrets, betterleaks and noseyparker admit =; bounded out (contradiction 1 in the research record).' }),
      field({ field: 'temporary-secret', claim: 'a temporary (STS) secret may be 41 characters; not claimed', basis: 'provider-example', status: 'unresolved', sources: [src('https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html', 'the temporary example is 41 characters'), src(RESEARCH, 'contradiction 2')], note: 'Neither a positive nor a control: a 41-character value beside the gate is a length twin of the IAM-user shape only.' }),
      field({ field: 'peer-lag', claim: 'no secret-key rule in gitleaks 8.30.1; trufflehog 3.97.4 reports the secret only paired with an access key id, under its AWS label (mapped to aws-access-key)', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'aws-access-token only'), src(TRUFFLEHOG_DETECTORS, 'aws/access_keys pairs an id and a secret')] }),
    ],
  },
};

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {};

/** The Beta.8 profile each target this slice owns is authored toward: context-constrained, no bare-value claim. */
export const profiles: Record<string, FixtureProfile> = { 'aws-secret-access-key': 'context-48' };
