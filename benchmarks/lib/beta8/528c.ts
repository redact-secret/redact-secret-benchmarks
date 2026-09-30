import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, gl } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, RULING_QUESTIONS, R1014, RULINGS_R1_R3, B528, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, scoredReason, splitGraduated } from './528-sources.ts';

// Issue #528, slice c: Beta.12 contracts for the SonarQube Server user token (squ_) and analysis tokens (sqa_, sqp_)
// (#1014 rank 3, READY; handoff docs/audits/evidence/1014/sonarqube.md; product redact-secret#1021). Owned by this slice
// only; see docs/specs/beta8-evidence.md.
//
// T1 for every fact under R1: SONARQUBE_TOKEN_PREFIX "sq", the TokenType letter, _, and Hex.encodeHexString of 20
// SecureRandom bytes (lowercase). The user token takes the detector id as its arrival id; the two analysis prefixes
// share one finding type and one arrival family. sqb_ badge tokens are public by design (Q5) and are controls.
export const issue = '528c';

const GENERATOR = 'https://github.com/SonarSource/sonarqube/blob/9ec5e86425011f6c1ffa0eb2db08880e3b347271/server/sonar-webserver-auth/src/main/java/org/sonar/server/usertoken/TokenGeneratorImpl.java#L29-L46';
const TOKEN_TYPE = 'https://github.com/SonarSource/sonarqube/blob/9ec5e86425011f6c1ffa0eb2db08880e3b347271/server/sonar-db-dao/src/main/java/org/sonar/db/user/TokenType.java#L24-L27';
const HANDOFF = handoff('sonarqube.md');
const RESEARCH = researchTable('5900447016');
const TH_SONARCLOUD = 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/sonarcloud/v1/sonarcloud.go';
const REFS = [GENERATOR, TOKEN_TYPE, HANDOFF, RESEARCH, HANDOFF_INDEX, RULING_QUESTIONS, R1014, RULINGS_R1_R3, product(1021), B528];

/** Sibling types the product reports inside a shared detector under their own finding type: arrival families scored by finding type since the 4fb7882 re-pin. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'sonarqube-analysis-token', taxonomy: 'sonarqube:analysis-token', issue, reason: scoredReason('sonarqube-token', 'sonarqube_analysis_token', 1021) },
];

const shared = (prefixes: string) => [
  field({ field: 'prefix', claim: prefixes, basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'SONARQUBE_TOKEN_PREFIX = "sq" + tokenType.getIdentifier() + "_"'), src(TOKEN_TYPE, 'u user, a global analysis, b project badge, p project analysis')] }),
  field({ field: 'body', claim: 'exactly 40 lowercase hex [0-9a-f] (20 SecureRandom bytes, Hex.encodeHexString); 44 in all', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR)] }),
  field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
  field({ field: 'transport', claim: 'SONAR_TOKEN; sonar-scanner -Dsonar.token= (and the legacy -Dsonar.login=); sonar.token in sonar-project.properties; Gradle systemProp.sonar.token', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'test axes')] }),
  field({ field: 'excluded-siblings', claim: 'sqb_ + 40 hex project badge tokens are read-only and published in README badge URLs (Q5); unprefixed 40-hex legacy tokens (before 9.5) are SHA-1 shaped; SonarQube Cloud sqco_ is another product', basis: 'provider-code', status: 'frozen', sources: [src(TOKEN_TYPE, 'b project badge'), src(RULING_QUESTIONS, 'Q5'), src(HANDOFF, 'excluded shapes')], note: 'sqb_ in a badge URL and a bare 40-hex git SHA are benign controls; legacy tokens and sqco_ are authored neither way.' }),
  field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 sonar-api-token is keyword-gated on sonar.login/sonar.token-style names with an optional squ_|sqp_|sqa_ prefix before [a-z0-9=_-]{40}: it lags on bare prose, chat and JSON "token" and reads every prefix under one label (mapped to sonarqube-token, so an analysis-token finding reads as co-detection). trufflehog 3.97.4 SonarCloud v1 wants a word-bounded bare [0-9a-z]{40} near "sonar" (legacy tokens only; it cannot match inside squ_ + 40) and v2 reads sqco_ + 59, so it lags on every positive and stays unmapped', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'sonar-api-token'), src(TH_SONARCLOUD, 'SonarCloud v1'), src(TRUFFLEHOG_DETECTORS, 'sonarcloud/v2: sqco_')] }),
];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'sonarqube-token': {
    tier: 'T1',
    pattern: '^squ_[0-9a-f]{40}$',
    providerSource: provider(GENERATOR, 'SonarSource/sonarqube TokenGeneratorImpl.java (9ec5e86, last changed 2026-04-17) and TokenType.java: "sq" + type letter + "_" + Hex.encodeHexString(20 SecureRandom bytes); re-checked 2026-09-29', 'squ_ + exactly 40 lowercase hex, 44 in all; no checksum', at),
    corroboration: [{ ...gl, label: 'sonar-api-token (keyword-gated; (?:squ_|sqp_|sqa_)?[a-z0-9=_-]{40})' }],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1021; #1014 handoff sonarqube.md, READY). A user token acts as the user, including administration for an administrator. T1 on every fact under R1 from the provider\'s own generator and token-type enum. The 40-hex body without the prefix is SHA-1 shaped, so the prefix is load-bearing and unprefixed legacy tokens stay with generic context. Excluded: sqb_ badge tokens (public, Q5), legacy unprefixed tokens, SonarQube Cloud sqco_ and uppercase-hex bodies (never issued). gitleaks 8.30.1 sonar-api-token corroborates only in named contexts; trufflehog 3.97.4 has no rule that reaches a prefixed token.',
    fields: shared('squ_ (the user token type letter u)'),
  },
  'sonarqube-analysis-token': {
    tier: 'T1',
    pattern: '^sq[ap]_[0-9a-f]{40}$',
    providerSource: provider(GENERATOR, 'SonarSource/sonarqube TokenGeneratorImpl.java (9ec5e86) and TokenType.java: a global analysis (a) and a project analysis (p) token; re-checked 2026-09-29', 'sqa_ or sqp_ + exactly 40 lowercase hex, 44 in all; no checksum', at),
    corroboration: [{ ...gl, label: 'sonar-api-token (keyword-gated; (?:squ_|sqp_|sqa_)?[a-z0-9=_-]{40})' }],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1021; #1014 handoff sonarqube.md, READY). A global analysis token (sqa_) can submit analysis for any project; a project analysis token (sqp_) is limited to one project. Both share one finding type. T1 on every fact under R1. Excluded as for the user token; sqx_ (an unknown type letter) and sqb_ are outside the contract. The gitleaks label is mapped to the detector-id family sonarqube-token, so a gitleaks finding on an analysis token reads as co-detection.',
    fields: shared('sqa_ (global analysis) or sqp_ (project analysis)'),
  },
};

const split = splitGraduated(authored, ['sonarqube-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'sonarqube-token': 'documented-24', 'sonarqube-analysis-token': 'documented-24' };
