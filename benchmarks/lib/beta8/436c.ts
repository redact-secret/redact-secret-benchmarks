import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, RERANK, R860, RULINGS_R1_R3, RULINGS_R2_R8, B436, product, at, src, reason } from './436-sources.ts';

// Issue #436, slice c: Beta.11 contract for the Inngest signing key (#860 Tier B, READY; handoff
// docs/audits/evidence/860/inngest.md; product redact-secret#914). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1: the three environment prefixes are provider code constants (ruling R1); the self-hosting docs
// state an even-length hex key generated with `openssl rand -hex 32`; the exact 64-character body rests
// on that command plus the provider SDK test fixtures (ruling R5). One family covers the raw key, the
// rotation fallback and the hashed wire form (signkey-<env>- + SHA-256 hex), which share one shape.
export const issue = '436c';

const STRATEGY = 'https://github.com/inngest/inngest/blob/dabb03f9e093672aaef2ee77eb7accdf0cd00ca3/pkg/authn/signing_key_strategy.go#L15-L25';
const SELF_HOSTING = 'https://www.inngest.com/docs/self-hosting';
const JS_HELPERS = 'https://github.com/inngest/inngest-js/blob/197812b/packages/inngest/src/test/helpers.ts';
const HANDOFF = handoff('inngest.md');

export const INNGEST_PATTERN = '^signkey-(?:prod|test|branch)-[0-9a-f]{64}$';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'inngest-signing-key', taxonomy: 'inngest:signing-key', issue, reason: reason('inngest-signing-key', 'inngest_signing_key', 914, 'Today a prefixed key under INNGEST_SIGNING_KEY= is only warned (medium), because signing_key is an ambiguous generic name.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'inngest-signing-key': {
    tier: 'T1',
    pattern: INNGEST_PATTERN,
    providerSource: provider(STRATEGY, 'inngest/inngest dabb03f: SigningKeyPrefixTest/Branch/Prod constants; self-hosting docs "a valid hexadecimal string with an even number of characters", openssl rand -hex 32 (re-checked 2026-09-28)', 'signkey-prod-, signkey-test- or signkey-branch- + exactly 64 lowercase hex (77 or 79 in all); no checksum', at),
    corroboration: [],
    references: [STRATEGY, SELF_HOSTING, JS_HELPERS, HANDOFF, RERANK, R860, RULINGS_R1_R3, RULINGS_R2_R8, product(914), B436],
    review: 'Arrival evidence (#436, product redact-secret#914; #860 handoff inngest.md, READY). T1: the three environment prefixes are provider code constants (R1); the docs state an even-length hex key and generate it with openssl rand -hex 32 (64 lowercase hex), and every realistic provider SDK fixture is signkey-test- or signkey-prod- + 64 lowercase hex (R5). One family covers the raw key, INNGEST_SIGNING_KEY_FALLBACK and the hashed wire form sent as Bearer, which are lexically identical and each authenticates. Excluded: other environment labels (the SDKs\' \\w+ admits them, but only three are constants), the self-hosted bare-hex key (unattributable without the prefix), event keys (no shape), an uppercase-hex body (the decoder accepts it, the generator never emits it) and the docs and SDK placeholders. Neither pinned peer has an Inngest rule.',
    fields: [
      field({ field: 'prefix', claim: 'signkey-prod-, signkey-test- or signkey-branch-', basis: 'provider-code', status: 'frozen', sources: [src(STRATEGY, 'SigningKeyPrefixTest/Branch/Prod'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'body-alphabet', claim: 'lowercase hex [0-9a-f]; an even number of characters', basis: 'provider-documentation', status: 'frozen', sources: [src(SELF_HOSTING, '"a valid hexadecimal string with an even number of characters"; openssl rand -hex 32')] }),
      field({ field: 'body-length', claim: 'exactly 64 (77 in all for prod/test, 79 for branch)', basis: 'provider-example', status: 'frozen', sources: [src(SELF_HOSTING, 'openssl rand -hex 32'), src(JS_HELPERS, 'three signkey-test- fixtures of 64 lowercase hex'), src(RULINGS_R2_R8, 'R5')] }),
      field({ field: 'wire-form', claim: 'the SDK sends signkey-<env>- + SHA-256 hex of the key bytes as Bearer; it is accepted as the API credential and has the same shape', basis: 'provider-code', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius')] }),
      field({ field: 'other-labels', claim: 'a signkey-<label>- other than prod, test and branch', basis: 'provider-code', status: 'frozen', sources: [src(STRATEGY, 'only three constants'), src(HANDOFF, 'a future label is an accepted false negative')], note: 'The twin on signkey-preview- records that exclusion.' }),
      field({ field: 'uppercase-hex', claim: 'the decoder accepts an uppercase-hex body the generator and fixtures never produce', basis: 'provider-code', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'The contract follows the issued grammar; the uppercase twin records the accepted false negative.' }),
      field({ field: 'transport', claim: 'INNGEST_SIGNING_KEY and INNGEST_SIGNING_KEY_FALLBACK environment variables, the signingKey client option and Authorization: Bearer', basis: 'provider-documentation', status: 'frozen', sources: [src(SELF_HOSTING)] }),
      field({ field: 'event-key', claim: 'INNGEST_EVENT_KEY has no documented shape; self-hosted event keys are arbitrary strings', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Not this family; only a literal non-key sentinel appears as a control.' }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no inngest detector directory'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no inngest rule')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'inngest-signing-key': 'documented-24' };
