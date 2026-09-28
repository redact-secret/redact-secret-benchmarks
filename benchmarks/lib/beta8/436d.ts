import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, RERANK, R860, RULINGS_R2_R8, B436, product, at, src, reason } from './436-sources.ts';

// Issue #436, slice d: Beta.11 contract for the Resend API key (#860 Tier B, READY; handoff
// docs/audits/evidence/860/resend.md; product redact-secret#915). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1: the re_ prefix is enforced by the provider CLI and stated in its README; the 8 + _ + 24 layout is
// the provider's create-API-key response example plus three distinct provider-authored SDK fixture
// values (ruling R5, the #655 example-shape precedent). The alphabet is the alphanumeric superset of
// what the examples show (no narrowing to base58 from three samples). The product's mixed-case guard
// is a false-positive policy, not a provider fact: no fixture asserts silence on a random one-case body.
export const issue = '436d';

const CLI = 'https://github.com/resend/resend-cli#authentication';
const CREATE_KEY = 'https://resend.com/docs/api-reference/api-keys/create-api-key';
const DOCS_AUTH = 'https://resend.com/docs/api-reference/introduction#authentication';
const HANDOFF = handoff('resend.md');

export const RESEND_PATTERN = '^re_[A-Za-z0-9]{8}_[A-Za-z0-9]{24}$';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'resend-api-key', taxonomy: 'resend:api-key', issue, reason: reason('resend-api-key', 'resend_api_key', 915) },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'resend-api-key': {
    tier: 'T1',
    pattern: RESEND_PATTERN,
    providerSource: provider(CREATE_KEY, 'resend-cli login rejects a key that does not start with re_; the create-API-key response example is re_ + 8 + _ + 24 (re-checked 2026-09-28: 36 characters, no 0/O/I/l)', 're_ + 8 alphanumerics + _ + 24 alphanumerics, 36 in all; full_access and sending_access keys share the shape', at),
    corroboration: [],
    references: [CLI, CREATE_KEY, DOCS_AUTH, HANDOFF, RERANK, R860, RULINGS_R2_R8, product(915), B436],
    review: 'Arrival evidence (#436, product redact-secret#915; #860 handoff resend.md, READY). T1: the provider CLI enforces the re_ prefix (code and README); the 8/_/24 layout is the docs response example and three distinct provider-authored SDK fixture values, which ruling R5 weighs like a docs example. The alphabet is taken as the alphanumeric superset: the samples are base58-consistent, but three samples show what is present, not what is excluded. re_ is short and ends many identifiers (are_, pre_, score_), so the leading boundary matters; the product adds a mixed-case guard (at least one upper- and one lower-case letter in the body) as false-positive policy. That guard is not a provider fact, so the corpus asserts silence only on word-built identifiers of the same layout, never on a random one-case body. Excluded: re_ + GUID mock keys, the 36-lowercase Go webhook placeholder, placeholders and masks, key object UUIDs, and whsec_ webhook signing secrets (another credential class: a twin, never a control).',
    fields: [
      field({ field: 'prefix', claim: 're_', basis: 'provider-code', status: 'frozen', sources: [src(CLI, '"Your key must start with re_"')] }),
      field({ field: 'layout', claim: 're_ + 8 + _ + 24 (36 in all); the _ at offset 11 is the only one after the prefix', basis: 'provider-example', status: 'frozen', sources: [src(CREATE_KEY, 'response example, measured by script, no value retained'), src(HANDOFF, 'the same shape in three distinct SDK fixture values'), src(RULINGS_R2_R8, 'R5')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9] in both segments', basis: 'provider-example', status: 'provisional', sources: [src(CREATE_KEY), src(HANDOFF, 'a trufflehog rule newer than the pinned 3.97.4 uses base58, a narrower class')], note: 'Every provider example is alphanumeric and base58-consistent; the contract keeps the alphanumeric superset, so a key with 0, O, I or l is not a false negative.' }),
      field({ field: 'mixed-case-guard', claim: 'the product requires at least one upper- and one lower-case letter in the 32 body bytes', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'the short-prefix guard; false-negative cost about 6e-8')], note: 'Project false-positive policy, not a provider fact. Positives are mixed case; no fixture asserts silence on a random one-case body, and the one-case controls are word-built identifiers.' }),
      field({ field: 'transport', claim: 'the RESEND_API_KEY environment variable, sent as Authorization: Bearer', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_AUTH)] }),
      field({ field: 'webhook-secret', claim: 'whsec_ webhook signing secrets use the Svix scheme', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'Another credential class: a prefix twin, never a benign control.' }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no resend detector directory at the pinned version'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no resend rule')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'resend-api-key': 'documented-24' };
