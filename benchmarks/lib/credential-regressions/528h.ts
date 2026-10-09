import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, RULING_QUESTIONS, R1014, B528, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './528-sources.ts';

// Issue #528, slice h: Beta.12 contract for the Paddle Billing API key (#1014 rank 8, READY; handoff
// docs/audits/evidence/1014/paddle.md; product redact-secret#1033). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 for every part: the provider docs publish the regex ^pdl_(live|sdbx)_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$
// and state the total length (69, five underscores). Live and sandbox keys are one family. The apikey_ + 26 key id
// inside a key is part of the one span and is never claimed alone (a documented non-secret identifier).
export const issue = '528h';

const DOCS = 'https://developer.paddle.com/api-reference/about/api-keys';
const SDK_MOCK = 'https://github.com/PaddleHQ/paddle-node-sdk/blob/651261beddfc65ba5f861729dca17044cbeffb5f/src/__tests__/mocks/notifications/api-key-created.mock.ts';
const HANDOFF = handoff('paddle.md');
const RESEARCH = researchTable('5900447820');

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1039). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'paddle-api-key': {
    tier: 'T1',
    pattern: '^pdl_(?:live|sdbx)_apikey_[a-z0-9]{26}_[A-Za-z0-9]{22}_[A-Za-z0-9]{3}$',
    providerSource: provider(DOCS, 'Paddle docs "API keys" (observed 2026-09-29): "They\'re 69 characters in length and always contain five underscores. You can use regex to match API keys: ^pdl_(live|sdbx)_apikey_[a-z\\d]{26}_[a-zA-Z\\d]{22}_[a-zA-Z\\d]{3}$"; "API keys are case-sensitive"; keys created before 2025-05-06 are legacy 50-character lowercase alphanumeric strings', 'pdl_live_apikey_ or pdl_sdbx_apikey_ + 26 [a-z0-9] + _ + 22 [A-Za-z0-9] + _ + 3 [A-Za-z0-9], 69 in all', at),
    corroboration: [],
    references: [DOCS, SDK_MOCK, HANDOFF, RESEARCH, HANDOFF_INDEX, RULING_QUESTIONS, R1014, product(1033), B528],
    review: 'Arrival evidence (#528, product redact-secret#1033; #1014 handoff paddle.md, READY). A Paddle Billing API key is a server-side credential for a merchant-of-record account; with full permissions it reads and changes customers, subscriptions, transactions, prices and adjustments (refunds and credits). Sandbox keys act on the sandbox only and are the same family (a committed sandbox key is still a policy violation). T1 for every part: the provider docs publish the full regex and the total length, and the Node SDK mocks carry a masked key and an apikey_ id in the same layout. Excluded: legacy keys (50 [a-z0-9], no prefix; generic context covers PADDLE_API_KEY=), the apikey_ + 26 key id alone (a non-secret identifier returned by the API and in webhooks, Q5), Paddle.js client-side tokens and Paddle Classic vendor auth codes. Neither pinned peer has a Paddle rule.',
    fields: [
      field({ field: 'prefix', claim: 'pdl_live_apikey_ or pdl_sdbx_apikey_ (case-sensitive)', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, 'the documented regex; "API keys are case-sensitive"')] }),
      field({ field: 'id-segment', claim: 'exactly 26 [a-z0-9]', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, 'the documented regex'), src(SDK_MOCK, 'the apikey_ id layout')] }),
      field({ field: 'secret-segment', claim: '_ + exactly 22 [A-Za-z0-9]', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, 'the documented regex')] }),
      field({ field: 'suffix', claim: '_ + exactly 3 [A-Za-z0-9]; 69 in all with five underscores', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS, '"69 characters in length and always contain five underscores"')] }),
      field({ field: 'key-id', claim: 'apikey_ + 26 is the key id, returned by the API and in webhook payloads; it is not a secret', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(SDK_MOCK), src(RULING_QUESTIONS, 'Q5: Paddle apikey_ ids stay unclaimed')], note: 'A bare key id is a benign control.' }),
      field({ field: 'legacy-keys', claim: 'keys created before 2025-05-06 are 50 lowercase alphanumerics with no prefix and no secret-scanning support', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)], note: 'Not this family; a legacy-shaped value is authored only outside a named context, as an encoded-value control.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision; the documented regex is anchored.' }),
      field({ field: 'transport', claim: 'PADDLE_API_KEY sent as Authorization: Bearer; the Paddle SDK constructor argument', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'test axes')] }),
      field({ field: 'peer-lag', claim: 'no Paddle rule in trufflehog 3.97.4 or gitleaks 8.30.1: both lag on every positive. betterleaks (unpinned, not measured here) copies the documented regex', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no paddle detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no paddle rule'), src(HANDOFF, 'tier rationale')] }),
    ],
  },
};

const split = splitGraduated(authored, ['paddle-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'paddle-api-key': 'documented-24' };
