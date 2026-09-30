import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { field } from '../contract-sources.ts';
import { research, RESEARCH_INDEX, R1012, RULINGS_R2_R8, B528, product, src, unscoredReason, TRUFFLEHOG_DETECTORS } from './1012-sources.ts';

// Issue #1012, slice d: Beta.12 contract for the AWS STS temporary access key id, ASIA (redact-secret#1012 READY-T2;
// research docs/audits/evidence/1012/aws-sts-temporary-access-key.md; product redact-secret#1027, which records the ASIA
// contract beside AKIA inside aws-access-key under the unchanged aws_access_key_id finding type). Owned by this slice
// only; see docs/specs/beta8-evidence.md.
//
// T2: the ASIA prefix is T1 (AWS's IAM identifier-prefix table); the 16-character [A-Z0-9] body rests on an AWS docs
// example (R5), two AWS-owned scanner rules (R2 not applied) and four peer owners. The id is an identifier, "unique only
// in combination with the secret access key and the session token", so a bare id scores as project policy, as the
// registry aws-access-key's bare AKIA id does; this contract fixes the grammar only.
//
// Modelling: the product reports ASIA under aws-access-key's own finding type aws_access_key_id, so a finding carries
// no evidence of its own and the family stays an unscored arrival family (not an arrivalFindingTypes row). It is not
// extra aws-access-key corpus: the registry contract is AKIA-only.
export const issue = '1012d';

const RESEARCH = research('aws-sts-temporary-access-key.md');
const PREFIXES = 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes';
const KEY_INFO = 'https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html';
const ASSUME_ROLE = 'https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html';
const GIT_SECRETS = 'https://github.com/awslabs/git-secrets/blob/7d6b970cbd3c216353cb22b383b70c150140662e/git-secrets#L239';
const FERRET = 'https://github.com/awslabs/ferret-scan/blob/c3b10fba90a5ed6178314ac646988546122afc60/internal/validators/secrets/validator.go#L1444';
const TH_SESSION = 'https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/aws/session_keys/sessionkey.go#L74-L75';
const GL_AWS = 'https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/cmd/generate/config/rules/aws.go#L15-L24';
const NOSEYPARKER = 'https://github.com/praetorian-inc/noseyparker/blob/2e6e7f36ce36619852532bbe698d8cb7a26d2da7/crates/noseyparker/data/default/builtin/rules/aws.yml#L3-L6';
const SCALIBR = 'https://github.com/google/osv-scalibr/blob/5ab8022c6d67ff99d91d9750f2456ed9549fe8cb/veles/secrets/awsaccesskey/detector.go#L25-L26';
const GL_PINNED = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml';

export const AWS_ASIA_PATTERN = '^ASIA[A-Z0-9]{16}$';

export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'aws-sts-temporary-access-key', taxonomy: 'aws:sts-temporary-access-key', issue,
    reason: unscoredReason('aws-access-key', 'aws_access_key_id', 1027, 'The registry aws-access-key contract is AKIA-only, so the ASIA shape is measured here under its own contract.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'aws-sts-temporary-access-key': {
    tier: 'T2',
    pattern: AWS_ASIA_PATTERN,
    corroboration: [
      { tool: 'awslabs/ferret-scan (AWS-authored, R2 not applied)', label: '\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b', url: FERRET },
      { tool: 'awslabs/git-secrets (AWS-merged)', label: '(A3T[A-Z0-9]|AKIA|…|ASIA)[A-Z0-9]{16}', url: GIT_SECRETS },
      { tool: 'trufflehog (HEAD)', label: 'session_keys: \\b((?:ASIA)[A-Z0-9]{16})\\b with a session token', url: TH_SESSION },
      { tool: 'gitleaks (generator source)', label: '(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}', url: GL_AWS },
      { tool: 'noseyparker', label: 'AWS id prefix set + [A-Z0-9]{16}', url: NOSEYPARKER },
      { tool: 'osv-scalibr', label: '\\b(AKIA[A-Z0-9]{16}|ASIA[A-Z0-9]{16})\\b', url: SCALIBR },
    ],
    references: [PREFIXES, KEY_INFO, ASSUME_ROLE, GIT_SECRETS, FERRET, TH_SESSION, GL_AWS, NOSEYPARKER, SCALIBR, RESEARCH, RESEARCH_INDEX, R1012, RULINGS_R2_R8, product(1027), B528],
    review: 'Arrival evidence (#1012 READY-T2; product redact-secret#1027, which claims ASIA inside aws-access-key under aws_access_key_id). A temporary (AWS STS) access key id: an identifier AWS says is "unique only in combination with the secret access key and the session token", so a bare id scores as project policy and this contract fixes its grammar only. The ASIA prefix is T1 (the IAM identifier-prefix table and GetAccessKeyInfo). The 16-character [A-Z0-9] body is T2: the AWS AssumeRole example (R5), AWS-owned ferret-scan (R2 not applied) and AWS-merged git-secrets, and peers from Truffle Security, gitleaks, Praetorian and Google. Contradictions bounded by the research record: [A-Z0-9] vs [A-Z2-7] (the wider class is kept; R8 forbids narrowing from a third-party rule) and 16–128 (API) vs exactly 20 (every example and rule; 20 is claimed). Excluded: ids of 17–128 characters or with lowercase, ABIA and ACCA and resource ids (AIDA, AROA, …), and the session token. The AWS docs EXAMPLE ids are authored neither way.',
    fields: [
      field({ field: 'prefix', claim: 'ASIA', basis: 'provider-documentation', status: 'frozen', sources: [src(PREFIXES, 'ASIA: temporary (AWS STS) access key IDs'), src(KEY_INFO, 'access key IDs beginning with ASIA are temporary credentials')] }),
      field({ field: 'body', claim: 'exactly 16 [A-Z0-9] (20 in all)', basis: 'provider-example', status: 'frozen', sources: [src(ASSUME_ROLE, 'a 20-character uppercase-and-digit example'), src(FERRET), src(GIT_SECRETS), src(SCALIBR)], note: 'T2: the example plus AWS-owned and peer rules; the API allows 16–128 [\\w], which no example or rule uses.' }),
      field({ field: 'alphabet', claim: '[A-Z0-9], the wider of the two classes rules use', basis: 'tool', status: 'provisional', sources: [src(FERRET, '[0-9A-Z]'), src(GL_AWS, '[A-Z2-7], "current AWS tokens cannot contain [0,1,8,9]"')], note: 'Bounded, not settled: no AWS source states which bytes are issued. Positives mix ids with and without 0, 1, 8, 9.' }),
      field({ field: 'boundary', claim: 'not [A-Za-z0-9] on either side', basis: 'research-hypothesis', status: 'frozen', sources: [src(RESEARCH, 'supported shape: boundary is a product rule (policy)')], note: 'A research-record boundary decision, not a provider statement.' }),
      field({ field: 'companion', claim: 'usable only with its secret access key and session token; a bare id is scored as project policy', basis: 'provider-documentation', status: 'frozen', sources: [src(PREFIXES, 'unique only in combination with the secret access key and the session token')] }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 aws-access-token reads ASIA + [A-Z2-7]{16}, so it misses an id with 0, 1, 8 or 9; trufflehog 3.97.4 reads ASIA ids only paired with a secret and a session token. Both labels map to aws-access-key', basis: 'tool', status: 'frozen', sources: [src(GL_PINNED, 'aws-access-token'), src(TRUFFLEHOG_DETECTORS, 'aws/session_keys')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward: T2 with no empirical record, so arrival-24. */
export const profiles: Record<string, FixtureProfile> = { 'aws-sts-temporary-access-key': 'arrival-24' };
