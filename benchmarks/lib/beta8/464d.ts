import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, research, RERANK, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R9_R10, B464, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './464-sources.ts';

// Issue #464, slice d: Beta.12 contract for the Browserbase API key, bb_live_ only (#860, READY with an open-ended
// body under the existing rulings; handoff docs/audits/evidence/860/browserbase.md; product redact-secret#973).
// Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 (R2, R4): the bb_live_ prefix is the docs placeholder plus a provider redaction regex; the [A-Za-z0-9] alphabet
// and the floor of 20 are the provider's own CI hygiene gate. The 128-byte cap is POLICY (the Apify precedent), so
// the contract pattern is the provider's open-ended grammar and no fixture asserts silence on a longer run.
// bb_test_ keys stay ISSUANCE-GATED: nothing here claims them, and a bb_test_ value is a control.
export const issue = '464d';

const VERIFY = 'https://github.com/browserbase/cookbook/blob/eff9eca8e61e16ea1635e9e75e043c7a765c5f88/scripts/verify.py#L383';
const IMPORT_SOURCES = 'https://github.com/browserbase/cookbook/blob/eff9eca8e61e16ea1635e9e75e043c7a765c5f88/scripts/import_sources.py#L22-L31';
const STAGEHAND_REDACT = 'https://github.com/browserbase/stagehand/blob/ad2bf12ea7abd95bb1d6f3a59600842a0954fffb/packages/integrations/core/src/harness/redact.ts#L12';
const HANDOFF = handoff('browserbase.md');
const RESEARCH = research('browserbase.md');

export const BROWSERBASE_PATTERN = '^bb_live_[A-Za-z0-9]{20,}$';

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1037). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'browserbase-api-key': {
    tier: 'T1',
    pattern: BROWSERBASE_PATTERN,
    providerSource: provider(VERIFY, 'browserbase/cookbook scripts/verify.py CI gate (2026-09-25, a public Browserbase-organization member; R2): (?<!\\w)bb_live_[A-Za-z0-9]{20,}(?!\\w); the same author\'s import_sources.py filter uses the same body inside [A-Za-z0-9_-] boundaries; docs placeholders bb_live_... (R4); re-checked 2026-09-28', 'bb_live_ + at least 20 [A-Za-z0-9], open-ended; no separator or checksum; bb_test_ is not part of the family', at),
    corroboration: [],
    references: [VERIFY, IMPORT_SOURCES, STAGEHAND_REDACT, HANDOFF, RESEARCH, RERANK, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R9_R10, product(973), B464],
    review: 'Arrival evidence (#464, product redact-secret#973; #860 handoff browserbase.md, READY for bb_live_ with an open-ended body). T1: the bb_live_ prefix is the docs placeholder (R4) and a provider redaction regex bb_(live|test)_ in browserbase/stagehand (R2); the alphabet and the floor of 20 are a provider CI gate whose author is a public Browserbase-organization member (R2), and no public scanner has a Browserbase rule, so it is not a vendored rule. The stagehand redactor admits _ and - after four alphanumerics while the CI gate is alphanumeric only; both are provider-authored, and the contract takes the alphanumeric class, which keeps bb_live_session_ style identifiers out. POLICY, not T1: the 128-byte upper bound (a bounded run for streaming; rejected whole, never truncated), so positives reach 128 and nothing asserts silence on 129. Excluded: bb_test_ keys (issuance-gated: only a floor-5 regex and a T2 comment), bb_live_session_ and other snake_case identifiers, bb_live_... and bb_live_your_api_key_here placeholders, bb_<timestamp> cookie names and project-ID UUIDs. Neither pinned peer has a Browserbase rule.',
    fields: [
      field({ field: 'prefix', claim: 'bb_live_', basis: 'provider-example', status: 'frozen', sources: [src(HANDOFF, 'docs placeholders bb_live_... (R4)'), src(STAGEHAND_REDACT, 'provider redaction regex bb_(live|test)_ (R2)'), src(RULINGS_R2_R8, 'R4: a placeholder is T1 for its prefix')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9]', basis: 'provider-code', status: 'frozen', sources: [src(VERIFY, 'provider CI gate, R2'), src(IMPORT_SOURCES, 'the same body class')], note: 'The stagehand redactor also admits _ and - after four alphanumerics; the contract keeps the gate\'s alphanumeric class.' }),
      field({ field: 'floor', claim: 'at least 20 body bytes, open-ended', basis: 'provider-code', status: 'frozen', sources: [src(VERIFY, '{20,}'), src(RULINGS_R2_R8, 'R2')] }),
      field({ field: 'policy-upper-bound', claim: 'POLICY, not T1: the product caps the run at 128 bytes; an over-cap run is rejected whole, never truncated', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'supported shape: project policy, the Apify precedent; no width is observed')], note: 'Not a provider fact, and the provider gate is open-ended: positives reach 128 and no fixture asserts silence on 129.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; a _ or - glued after the run rejects the match', basis: 'research-hypothesis', status: 'frozen', sources: [src(VERIFY, '(?!\\w) rejects a glued _ but not a glued -'), src(IMPORT_SOURCES, '[A-Za-z0-9_-] boundaries reject both'), src(HANDOFF, 'implementation notes')], note: 'The two provider rules agree on _ and disagree on -; the handoff decides both, so this is a handoff boundary decision, not a provider statement.' }),
      field({ field: 'bb-test', claim: 'bb_test_ keys are issuance-gated: only a floor-5 regex and a T2 comment', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes'), src(RESEARCH)], note: 'Never a positive; a bb_test_ value of any length is a benign control.' }),
      field({ field: 'transport', claim: 'the BROWSERBASE_API_KEY environment variable, sent as the X-BB-API-Key header; Browserbase(api_key=...) and new Stagehand({ apiKey })', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius')] }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no browserbase detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no browserbase rule')] }),
    ],
  },
};

const split = splitGraduated(authored, ['browserbase-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1037). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'browserbase-api-key': 'documented-24' };
