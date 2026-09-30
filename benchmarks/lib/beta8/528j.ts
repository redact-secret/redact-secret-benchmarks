import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, R1014, RULINGS_R2_R8, B528, product, at, src, reason, GRADUATES, byFindingType, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './528-sources.ts';

// Issue #528, slice j: Beta.12 contracts for the Axiom API token (xaat-) and personal access token (xapt-) (#1014 rank
// 10, READY by R5; handoff docs/audits/evidence/1014/axiom.md; product redact-secret#1035). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1: the prefixes are axiom-go's IsAPIToken/IsPersonalToken runtime checks (R6); the 8-4-4-4-12 UUID layout and
// lowercase hex are one docs response example plus the SDK fixtures' layout (R5). The handoff recommends a
// structure-only issuance check (basic, advanced and personal tokens); it does not block the contract, and an uppercase
// or non-UUID body is an accepted false negative until it says otherwise.
export const issue = '528j';

const GO_TOKEN = 'https://github.com/axiomhq/axiom-go/blob/ae983c9447003f74f00e55a2ca64ea119b558fb8/internal/config/token.go#L7-L18';
const GO_TEST = 'https://github.com/axiomhq/axiom-go/blob/ae983c9447003f74f00e55a2ca64ea119b558fb8/axiom/client_test.go';
const DOCS = 'https://axiom.co/docs/llms-full.txt';
const HANDOFF = handoff('axiom.md');
const RESEARCH = researchTable('5900447540');
const REFS = [GO_TOKEN, GO_TEST, DOCS, HANDOFF, RESEARCH, HANDOFF_INDEX, R1014, RULINGS_R2_R8, product(1035), B528];
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'axiom-token', taxonomy: 'axiom:api-token', issue, reason: reason('axiom-token', 'axiom_api_token', 1035, GRADUATES) },
  { id: 'axiom-personal-token', taxonomy: 'axiom:personal-token', issue, reason: reason('axiom-token', 'axiom_personal_token', 1035, byFindingType('xapt-', 'axiom-token')) },
];

const shared = (prefix: string) => [
  field({ field: 'prefix', claim: prefix, basis: 'provider-code', status: 'frozen', sources: [src(GO_TOKEN, 'strings.HasPrefix; IsValidToken accepts only xaat- and xapt-'), src(DOCS), src(RULINGS_R2_R8, 'R6: a runtime startsWith check fixes the prefix')] }),
  field({ field: 'body', claim: 'a 36-byte UUID layout, 8-4-4-4-12 with -, lowercase hex; 41 in all', basis: 'provider-example', status: 'frozen', sources: [src(DOCS, 'one "token": "xaat-…" response example with a lowercase-hex UUID body'), src(GO_TEST, 'fixtures in the xa?t- + UUID layout (placeholder bytes)'), src(RULINGS_R2_R8, 'R5')], note: 'One real-shaped docs example; the handoff recommends a structure-only issuance check. An uppercase or non-UUID body is an accepted false negative, so an uppercase-hex twin is a one-property twin.' }),
  field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
  field({ field: 'placeholders', claim: 'xaat-your-api-token and x-filled docs placeholders do not follow the UUID layout', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'why an issuance check is still recommended; excluded shapes')], note: 'Benign controls.' }),
  field({ field: 'peer-lag', claim: 'no Axiom rule in trufflehog 3.97.4 or gitleaks 8.30.1: both lag on every positive', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no axiom detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no axiom rule')] }),
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'axiom-token': {
    tier: 'T1',
    pattern: `^xaat-${UUID}$`,
    providerSource: provider(GO_TOKEN, 'axiomhq/axiom-go internal/config/token.go (ae983c9, 2023-09-19): IsAPIToken is strings.HasPrefix(token, "xaat-"); the Axiom docs response example has a lowercase-hex UUID body and the SDK fixtures use the UUID layout; re-checked 2026-09-29', 'xaat- + a lowercase-hex UUID (8-4-4-4-12), 41 in all', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1035; #1014 handoff axiom.md, READY by R5). An API token is ingest-only or carries query and dataset-management rights; it is also the service-account password for Postgres-wire and Grafana access. T1: the prefix is the SDK runtime check (R6), the layout and lowercase hex a docs response example plus the SDK fixtures (R5). A bare UUID stays unclaimed; the prefix is load-bearing. Excluded: uppercase-hex bodies (not observed; accepted false negative), placeholders such as xaat-your-api-token, org ids and dataset names. Neither pinned peer has an Axiom rule.',
    fields: [...shared('xaat- (API token)'), field({ field: 'transport', claim: 'AXIOM_TOKEN; a Vector or Fluent Bit sink token field; Authorization: Bearer for OpenTelemetry export; the service-account password field', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'test axes')] })],
  },
  'axiom-personal-token': {
    tier: 'T1',
    pattern: `^xapt-${UUID}$`,
    providerSource: provider(GO_TOKEN, 'axiomhq/axiom-go internal/config/token.go (ae983c9): IsPersonalToken is strings.HasPrefix(token, "xapt-"); the docs state a personal access token "starts with xapt-"; the SDK fixtures use the same UUID layout for both kinds; re-checked 2026-09-29', 'xapt- + a lowercase-hex UUID (8-4-4-4-12), 41 in all', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1035; #1014 handoff axiom.md, READY by R5). A personal access token, used with an org id, has the user\'s full access to the Axiom console and API, including queries over every ingested log, so it is its own finding type. T1 on the prefix (R6, docs); the body layout is the shared SDK fixture layout and the xaat- docs example (R5), the weaker leg of this contract, which the recommended issuance check would settle. Neither pinned peer has an Axiom rule.',
    fields: [...shared('xapt- (personal access token)'), field({ field: 'transport', claim: 'AXIOM_TOKEN with AXIOM_ORG_ID; Authorization: Bearer with the x-axiom-org-id header', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'role and blast radius')] })],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'axiom-token': 'documented-24', 'axiom-personal-token': 'documented-24' };
