import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, research, RERANK, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R9_R10, B464, product, at, src, reason, BETTERLEAKS, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './464-sources.ts';

// Issue #464, slice f: Beta.12 contract for the RunPod API key (#860, READY with an open-ended body by ruling R10;
// handoff docs/audits/evidence/860/runpod.md; product redact-secret#974). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1: the rpa_ prefix (the provider blog, 2024-11) and the [A-Za-z0-9] alphabet with a provider floor of 16 (a
// provider-authored scrubber, R2). POLICY, not T1: the floor of 31 (R10 raises the provider floor of 16 to the first
// width above Redirect.pizza's rpa_ + 30, another issuer's token) and the 128-byte cap. The contract pattern is the
// product's decided grammar, so the floor of 31 is asserted because the handoff decides it (as 1Password's 250 floor
// is), and the twin that asserts it says POLICY. The 46-byte body and the 40-upper-plus-6-mixed layout are tool and
// empirical facts, not part of the contract.
export const issue = '464f';

const SCRUB = 'https://github.com/runpod/runpod-mcp/blob/09a565a6adef8932f044dfa65243e7bc41cbdf2d/src/alp/scrub.ts#L36';
const BLOG = 'https://www.runpod.io/blog/scoped-api-keys-runpod';
const DOCS = 'https://docs.runpod.io/get-started/api-keys';
const DOCS_PR = 'https://github.com/runpod/docs/pull/456';
const HANDOFF = handoff('runpod.md');
const RESEARCH = research('runpod.md');

export const RUNPOD_PATTERN = '^rpa_[A-Za-z0-9]{31,}$';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'runpod-api-key', taxonomy: 'runpod:api-key', issue, reason: reason('runpod-api-key', 'runpod_api_key', 974, 'The detector id is also this family\'s arrival id, so it graduates when the registry is re-pinned.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'runpod-api-key': {
    tier: 'T1',
    pattern: RUNPOD_PATTERN,
    providerSource: provider(SCRUB, 'runpod/runpod-mcp src/alp/scrub.ts (added 2026-09-16, a provider-authored scrubber; R2): \\brpa_[A-Za-z0-9]{16,}\\b; the RunPod blog on scoped keys (2024-11): "Any new keys will be created with an rpa_ prefix"; re-checked 2026-09-28', 'rpa_ + [A-Za-z0-9], open-ended, provider floor 16; the contract floor 31 is policy under R10; no separator or checksum', at),
    corroboration: [{ tool: 'betterleaks (unpinned)', label: 'runpod.go: rpa_[A-Z0-9]{40}[A-Za-z0-9]{6} (tool-only, T2; the 46-byte layout is not part of the contract)', url: BETTERLEAKS }],
    references: [SCRUB, BLOG, DOCS, DOCS_PR, HANDOFF, RESEARCH, RERANK, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R9_R10, product(974), B464],
    review: 'Arrival evidence (#464, product redact-secret#974; #860 handoff runpod.md, READY with an open-ended body by ruling R10). T1: the prefix is the provider blog and the alphabet and provider floor of 16 are a provider-authored scrubber (R2). POLICY under R10, not T1: a floor of 16 would claim Redirect.pizza\'s rpa_ + 30 tokens, so project policy raises it to 31, the first width above that shape, and every RunPod width seen (46 empirical; a withdrawn 48-character docs example) is above it; the 128-byte upper bound is policy too (a bounded run for streaming; rejected whole, never truncated). The alphabet stays the provider\'s [A-Za-z0-9]. The contract pattern therefore carries the policy floor and the twin at 30 says POLICY; a body of 16-30 is an accepted false negative (none known), positives reach 128 and nothing asserts silence on 129. The 46-byte body and the 40-upper-plus-6-mixed layout are tool and empirical facts, so positives are authored with and without that layout. Excluded: Redirect.pizza rpa_ + 30 (another issuer), RunPod S3-compatible rps_ secrets and access keys (another credential), legacy unprefixed keys, and rpa_..., rpa_xxxx, rpa_your_key placeholders. A Redirect.pizza token of 31 or more bytes, if one exists, would read as RunPod: misattributed, still redacted.',
    fields: [
      field({ field: 'prefix', claim: 'rpa_', basis: 'provider-documentation', status: 'frozen', sources: [src(BLOG, '"Any new keys will be created with an rpa_ prefix" (2024-11)'), src(SCRUB, 'provider scrubber, R2')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9]', basis: 'provider-code', status: 'frozen', sources: [src(SCRUB, 'provider-authored scrubber, R2')] }),
      field({ field: 'provider-floor', claim: 'the provider scrubber\'s floor is 16 body bytes, open-ended', basis: 'provider-code', status: 'frozen', sources: [src(SCRUB, '{16,}'), src(RULINGS_R2_R8, 'R2')], note: 'T1, but the contract floor is higher: see policy-floor.' }),
      field({ field: 'policy-floor', claim: 'POLICY (R10), not T1: the contract floor is 31 body bytes, the first width above Redirect.pizza rpa_ + 30', basis: 'research-hypothesis', status: 'frozen', sources: [src(RULINGS_R9_R10, 'R10: policy fills a partly stated grammar, at least as wide as the provider class'), src(HANDOFF, 'supported shape: policy floor 31')], note: 'A policy boundary the handoff decides: the 30-byte twin asserts it and a 16-30 body is an accepted false negative. Every RunPod width seen is above it.' }),
      field({ field: 'policy-upper-bound', claim: 'POLICY, not T1: the product caps the run at 128 bytes; an over-cap run is rejected whole, never truncated', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'supported shape: project policy, the Apify precedent')], note: 'Not a provider fact, and the provider scrubber is open-ended: positives reach 128 and no fixture asserts silence on 129.' }),
      field({ field: 'observed-layout', claim: 'every observed body is 46 bytes: 40 uppercase-or-digit then 6 mixed alphanumerics', basis: 'tool', status: 'provisional', sources: [src(BETTERLEAKS, 'rpa_[A-Z0-9]{40}[A-Za-z0-9]{6}, unpinned'), src(DOCS_PR, 'a withdrawn 48-character docs example')], note: 'Not part of the contract; positives are authored in the 46-byte layout and outside it.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; a _ or - glued after the run rejects the match', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'the RUNPOD_API_KEY environment variable, sent as Authorization: Bearer; runpod.api_key = "..." and runpodctl config --apiKey', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)] }),
      field({ field: 'other-credentials', claim: 'S3-compatible rps_ secrets and access keys, and legacy unprefixed keys, are separate credentials with no researched shape', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Not this family; an rps_ value is a benign control, never a positive.' }),
      field({ field: 'peer-lag', claim: 'no RunPod rule in trufflehog 3.97.4 or gitleaks 8.30.1; betterleaks (unpinned, not measured here) uses rpa_[A-Z0-9]{40}[A-Za-z0-9]{6}, which is narrower than the contract (misses a lowercase or non-46 body) and would not match Redirect.pizza rpa_ + 30 either', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no runpod detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no runpod rule'), src(BETTERLEAKS, 'runpod.go, observed 2026-09-28; unpinned')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'runpod-api-key': 'documented-24' };
