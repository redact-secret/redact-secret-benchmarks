import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th } from '../contract-sources.ts';
import { handoff, RERANK, R860, RULINGS_R1_R3, RULINGS_R2_R8, B436, product, at, src, reason } from './436-sources.ts';

// Issue #436, slice f: Beta.11 contract for the Weights & Biases wandb_v1_ API key (#860 Tier B, READY
// for wandb_v1_ only; handoff docs/audits/evidence/860/wandb.md; product redact-secret#917). Owned by
// this slice only; see docs/specs/beta8-evidence.md.
//
// T1: the wandb_v1_ prefix is a W&B-authored test constant (ruling R5); the [A-Za-z0-9_] alphabet is the
// provider SDK validator and its error text (ruling R1). The length is documented only as "about 86";
// every provider test fixture of a new key is exactly 86. Orchestrator decision on redact-secret#917:
// the product matches a bounded tolerant range around 86, not an exact 77-byte body, until an issuance
// check. So positives carry totals 85, 86 and 87, and no fixture asserts silence on any length: a
// length the benchmark cannot prove is neither a positive nor a twin. The legacy 40-hex key stays with
// generic context and is not this family.
export const issue = '436f';

const WEAVE_CC = 'https://github.com/wandb/weave-claude-code/blob/8c4111adbafe7abf15312b3188eb69a0b7bf8f79/tests/config-set-masks-secrets.test.ts#L13';
const DOCS_LENGTH = 'https://docs.wandb.ai/support/models/articles/why-does-my-api-key-fail-with-must-be-40-characters';
const VALIDATION = 'https://github.com/wandb/wandb/blob/98f93d636e523bf6e195a2a154f23ba8775623a9/wandb/sdk/lib/wbauth/validation.py#L26-L63';
const PR_10688 = 'https://github.com/wandb/wandb/pull/10688';
const DOCS_ENV = 'https://docs.wandb.ai/guides/track/environment-variables/';
const HANDOFF = handoff('wandb.md');
const R917 = product(917);

/** wandb_v1_ + a 76–78-byte [A-Za-z0-9_] body: the authored positives' totals 85–87, around the documented "about 86". */
export const WANDB_PATTERN = '^wandb_v1_[A-Za-z0-9_]{76,78}$';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'wandb-api-key', taxonomy: 'wandb:api-key', issue, reason: reason('wandb-api-key', 'wandb_api_key', 917, 'Only the wandb_v1_ key is in scope; the legacy 40-hex key stays with generic context.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'wandb-api-key': {
    tier: 'T1',
    pattern: WANDB_PATTERN,
    providerSource: provider(VALIDATION, 'wandb SDK validation.py at 98f93d6 ([\\w-]+, 40+; "may only contain the letters A-Z, digits and underscores"), the wandb_v1_ weave-claude-code test constant (R5), #10688 test keys of 86, docs "about 86 characters" (re-checked 2026-09-28)', 'wandb_v1_ + [A-Za-z0-9_] to about 86 in all; every provider test fixture of a new key is exactly 86; no separator is required', at),
    corroboration: [th('weightsandbiases/v2/weightsandbiases', 'Weights & Biases v2 (feature-gated, off by default): \\b(wandb_v1_[A-Za-z0-9]{27}_[A-Za-z0-9]{49})\\b')],
    references: [WEAVE_CC, DOCS_LENGTH, VALIDATION, PR_10688, DOCS_ENV, HANDOFF, RERANK, R860, RULINGS_R1_R3, RULINGS_R2_R8, R917, B436],
    review: 'Arrival evidence (#436, product redact-secret#917; #860 handoff wandb.md, READY for wandb_v1_). T1: the prefix is a W&B-authored test constant (R5), the [A-Za-z0-9_] alphabet is the SDK validator and its error text (R1), and the docs say new keys are "about 86 characters", which every provider test fixture of a new key (wandb#10688, Weave #5732) makes exactly 86. By the orchestrator decision on redact-secret#917 the product matches a bounded tolerant range around 86 until an issuance check, so positives carry totals 85, 86 and 87 and no fixture asserts silence on any length. The 27/_/49 split is scanner-only (T2) and not required: positives carry it and a body without an inner _. On-prem keys are <host>-<key>; the host label is public and is authored as an envelope around the key, so a finding with or without it passes. Excluded: the legacy 40-hex key (generic context), client JWTs (jwt), OIDC identity-token files, wandb_v1_ placeholders, and a future wandb_v2_ (unknown, so never asserted).',
    fields: [
      field({ field: 'prefix', claim: 'wandb_v1_', basis: 'provider-code', status: 'frozen', sources: [src(WEAVE_CC, 'W&B-authored test constant, 44 characters, placeholder-grade: prefix only'), src(RULINGS_R2_R8, 'R5')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9_]; a - is only the on-prem <host>- separator', basis: 'provider-code', status: 'frozen', sources: [src(VALIDATION, 'fullmatch [\\w-]+ and the letters/digits/underscores error text'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'total-length', claim: 'about 86; exactly 86 in every provider test fixture of a new key', basis: 'provider-documentation', status: 'provisional', sources: [src(DOCS_LENGTH, '"about 86 characters"'), src(PR_10688, 'validator tests with keys of 39, 40 and 86'), src(R917, 'orchestrator decision: a bounded tolerant range around 86')], note: 'Positives carry 85, 86 and 87 (86 in most). No length twin is authored: the tolerant range is the product\'s, and the benchmark cannot prove any length is not a key.' }),
      field({ field: 'inner-split', claim: 'an _ after 27 body characters (the Key ID)', basis: 'tool', status: 'unresolved', sources: [src(th('weightsandbiases/v2/weightsandbiases').url, '27/_/49'), src(HANDOFF, 'scanner-only, not required')], note: 'Positives carry both a split body and one with no inner _; neither is asserted as a negative.' }),
      field({ field: 'host-prefix', claim: 'self-managed keys are <host>-<key>; the host label is public', basis: 'provider-code', status: 'frozen', sources: [src(VALIDATION, 'dashes are allowed only because <host>- is split off'), src(HANDOFF, 'local- + 86 in the Weave fixtures')], note: 'Authored as an envelope: the secret span is the wandb_v1_ key.' }),
      field({ field: 'other-versions', claim: 'whether a wandb_v2_ or another version exists', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'a future wandb_v2_ is an accepted false negative')], note: 'No fixture asserts silence on another version.' }),
      field({ field: 'legacy-key', claim: 'the legacy key is 40 lowercase hex (optionally <host>- + 40), with no anchor', basis: 'provider-code', status: 'frozen', sources: [src(VALIDATION, '40+'), src(th('weightsandbiases/v1/weightsandbiases').url, 'keyword-gated [0-9a-f]{40}')], note: 'Not this family. A bare 40-hex git SHA is a control; a legacy key under WANDB_API_KEY= is not authored either way.' }),
      field({ field: 'transport', claim: 'the WANDB_API_KEY environment variable, ~/.netrc for api.wandb.ai, sent as Basic api:<key>', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_ENV)] }),
      field({ field: 'peer-lag', claim: 'trufflehog 3.97.4 registers only the keyword-gated legacy v1 rule by default (v2 is feature-gated); gitleaks 8.30.1 has no W&B rule', basis: 'tool', status: 'frozen', sources: [src(th('weightsandbiases/v1/weightsandbiases').url), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no wandb rule')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'wandb-api-key': 'documented-24' };
