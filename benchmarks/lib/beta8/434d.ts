import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, RULINGS_R1_R3, B434, product, at, src, reason } from './434-sources.ts';

// Issue #434, slice d: Beta.11 contracts for the PostHog personal API key (phx_) and project secret
// API key (phs_) (#860 Tier A, READY; handoff docs/audits/evidence/860/posthog.md; product
// redact-secret#906). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// The prefixes are provider-documented; the alphabet and algorithm are provider code and unit tests
// (ruling R1); the 42–49 band is derived from that algorithm across the three prefixed eras. The
// phc_ project token is public by design and is never claimed: it appears only as a benign control.
// The handoff routes both secrets to one new detector, posthog-token: the personal key takes the
// detector id as its arrival id, and phs_ is its own arrival family scored by finding type.
export const issue = '434d';

const UTILS = 'https://github.com/PostHog/posthog/blob/658715dd3b434e0a5ada471981d4053b70e72034/posthog/models/utils.py';
const UTILS_BASE62 = 'https://github.com/PostHog/posthog/blob/d610b45e4c72/posthog/models/utils.py';
const UTILS_130 = 'https://github.com/PostHog/posthog/blob/1.43.0/posthog/models/utils.py';
const PR_52495 = 'https://github.com/PostHog/posthog/pull/52495';
const DOCS_KEYS = 'https://posthog.com/docs/api/personal-api-keys';
const DOCS_API = 'https://posthog.com/docs/api';
const HANDOFF = handoff('posthog.md');
const TH_POSTHOG = th('posthog/posthog', 'PostHog: \\b(phx_[a-zA-Z0-9_]{43,48})\\b (no phs_; misses 42- and 49-byte bodies; admits _)');
const REFS = [DOCS_KEYS, DOCS_API, UTILS, UTILS_BASE62, UTILS_130, PR_52495, HANDOFF, HANDOFF_INDEX, R860, RULINGS_R1_R3, product(906), B434];

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'posthog-token', taxonomy: 'posthog:personal-api-key', issue,
    reason: reason('posthog-token', 'posthog_personal_api_key', 906, 'The detector id is also this family\'s arrival id, so the personal key graduates when the registry is re-pinned; the detector never claims phc_.') },
  { id: 'posthog-project-secret-api-key', taxonomy: 'posthog:project-secret-api-key', issue,
    reason: reason('posthog-token', 'posthog_project_secret_api_key', 906, 'phs_ shares the posthog-token detector, so after the re-pin it stays an arrival family scored by finding type.') },
];

const shared = (prefix: string, role: string, peer: string) => [
  field({ field: 'prefix', claim: prefix, basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_KEYS, role), src(UTILS)] }),
  field({ field: 'alphabet', claim: 'base57 [2-9A-HJ-NP-Za-km-z] since 2026-03-30; base62 [0-9A-Za-z] in the earlier prefixed eras; the contract is the union [0-9A-Za-z]', basis: 'provider-code', status: 'frozen', sources: [src(UTILS, 'BASE57 = base62 minus 0 1 O I l; test_uses_base57_alphabet'), src(UTILS_BASE62, 'base62'), src(RULINGS_R1_R3, 'R1')] }),
  field({ field: 'body', claim: '42–49 bytes: base57 era 48 or 49; 35-byte base62 era at most 48 (47 ≈ 88.6%); 32-byte base62 era at most 43 (42 ≈ 1.6%)', basis: 'provider-code', status: 'frozen', sources: [src(UTILS, 'generate_random_token(35), forced top bit; test_exact_length'), src(UTILS_BASE62), src(UTILS_130), src(PR_52495, 'base57 since 2026-03-30')], note: 'Per-length shares derived from the T1 algorithm. Shorter bodies (below 0.03% of any era) are an accepted false negative and are asserted by no fixture; 41 and 50 back length twins.' }),
  field({ field: 'separators', claim: 'none inside the body; no checksum', basis: 'provider-code', status: 'frozen', sources: [src(UTILS)] }),
  field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; a 50+ run is rejected, never truncated', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')] }),
  field({ field: 'project-token', claim: 'phc_ is the project token, public by design ("ok to be public"); never claimed', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_API), src(HANDOFF, 'decision: phc_ stays benign')], note: 'Benign controls outside credential-named assignments only: under a credential-named key generic detection redacts it today, which is generic-token\'s verdict, not this family\'s.' }),
  field({ field: 'deferred-prefixes', claim: 'pha_/phr_ OAuth tokens and phh_ are outside this handoff', basis: 'provider-code', status: 'unresolved', sources: [src(HANDOFF)], note: 'No fixture asserts either reading.' }),
  field({ field: 'peer-lag', claim: peer, basis: 'tool', status: 'frozen', sources: [src(TH_POSTHOG.url), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no posthog rule')], note: 'Corroboration only; never used to narrow or widen the contract.' }),
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'posthog-token': {
    tier: 'T1',
    pattern: '^phx_[0-9A-Za-z]{42,49}$',
    providerSource: provider(UTILS, 'PERSONAL_API_KEY_PREFIX = "phx_" and generate_random_token_personal() at 658715d (re-checked 2026-09-28); docs name phx_', 'the docs document the phx_ personal API key; provider code and unit tests (ruling R1) fix the base57/base62 alphabet and the algorithm from which the 42–49 band is derived', at),
    corroboration: [TH_POSTHOG],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#906; #860 handoff posthog.md, READY). A personal API key acts as the user across every organization and project the user can reach. The prefix is documented; the alphabet and algorithm are provider code and unit tests (R1); the 42–49 band is the union of the three prefixed eras (base57 48/49 since 2026-03-30, 35-byte base62 at most 48, 32-byte base62 at most 43) with the 42 floor keeping the 1.6% of 32-byte-era keys that render at 42. The phc_ project token is public and only ever a benign control. Peers lag: trufflehog 3.97.4 stops at 48 (missing the 2.9% of base57 keys at 49 and the 42-byte keys) and admits _, gitleaks 8.30.1 has no PostHog rule.',
    fields: shared('phx_', 'personal API key', 'trufflehog 3.97.4 reads phx_ + [a-zA-Z0-9_]{43,48}: it misses 49-byte base57 keys and 42-byte base62 keys and admits _; it has no phs_ alternative. gitleaks 8.30.1 has no PostHog rule'),
  },
  'posthog-project-secret-api-key': {
    tier: 'T1',
    pattern: '^phs_[0-9A-Za-z]{42,49}$',
    providerSource: provider(UTILS, 'phs_ project secret API key: same generator and body as phx_ at 658715d (re-checked 2026-09-28); docs name phs_ as a secret', 'the docs document phs_ as a project-scoped secret for feature-flag evaluation; provider code (ruling R1) gives it the phx_ generator and body', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#906; #860 handoff posthog.md, READY). The project secret API key is a project-scoped secret with the same generator and body as the personal key, so the contract is the same 42–49 [0-9A-Za-z] band after phs_. Neither pinned peer has a phs_ rule (trufflehog 3.97.4 claims phx_ only).',
    fields: shared('phs_', 'project secret API key', 'no rule in trufflehog 3.97.4 (phx_ only) or gitleaks 8.30.1'),
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'posthog-token': 'documented-24',
  'posthog-project-secret-api-key': 'documented-24',
};
