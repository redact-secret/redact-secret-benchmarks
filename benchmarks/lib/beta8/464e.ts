import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, research, RERANK, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R2_R8, RULINGS_R9_R10, B464, product, at, src, BETTERLEAKS, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, splitGraduated } from './464-sources.ts';

// Issue #464, slice e: Beta.12 contract for the Cerebras inference API key (#860, READY by ruling R10; handoff
// docs/audits/evidence/860/cerebras.md; product redact-secret#975). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1: the 48-byte body length (the provider VS Code extension's validator, R1) and the csk-/csk_ prefixes (a dated
// provider-staff statement, R3). POLICY under R10, not T1: the body alphabet [A-Za-z0-9_-], filled in because no
// provider source states it and the fill must be at least as wide as any provider-stated class. Tool rules say
// [a-z0-9]; R8 forbids narrowing from them, so lowercase-only bodies are positives and no fixture asserts silence
// on a byte outside the policy class.
export const issue = '464e';

const VALIDATOR = 'https://github.com/Cerebras/vscode-cerebras-chat/blob/e03602fa96f3ddfc8122ea2655bfa39424a5d157/src/provider.ts#L113';
const VALIDATOR_LATER = 'https://github.com/Cerebras/vscode-cerebras-chat/blob/9d0253c1e071dd4d4afaad92cf5a6958bbea80eb/src/provider.ts#L176';
const STAFF_1 = 'https://github.com/Cerebras/vscode-cerebras-chat/pull/8#discussion_r2453931915';
const STAFF_2 = 'https://github.com/Cerebras/vscode-cerebras-chat/pull/8#discussion_r2462008982';
const ISSUE_7 = 'https://github.com/Cerebras/vscode-cerebras-chat/issues/7';
const HANDOFF = handoff('cerebras.md');
const RESEARCH = research('cerebras.md');

export const CEREBRAS_PATTERN = '^csk[-_][A-Za-z0-9_-]{48}$';

/** No arrival family remains: the family graduated to a registry detector at the 4fb7882 re-pin (redact-secret PR #1037). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'cerebras-api-key': {
    tier: 'T1',
    pattern: CEREBRAS_PATTERN,
    providerSource: provider(VALIDATOR, 'Cerebras/vscode-cerebras-chat src/provider.ts (e03602f; the check was introduced on 2025-08-29 with csk- only and the 52 has stayed): a key that does not start csk_ or csk- or whose length is not 52 is rejected; a Cerebras staff member wrote on 2025-10-23 and 2025-10-24 that customers hold keys with both prefixes, csk_ was an unintentional recent change, new keys use csk-, and both should be accepted (R3); re-checked 2026-09-28', 'csk- or csk_ + exactly 48 body bytes (52 in all); the body alphabet is project policy under R10, not a provider fact', at),
    corroboration: [{ tool: 'betterleaks and other tool rules (unpinned)', label: 'csk- body [a-z0-9] (tool-only, T2; not adopted, R8)', url: BETTERLEAKS }],
    references: [VALIDATOR, VALIDATOR_LATER, STAFF_1, STAFF_2, ISSUE_7, HANDOFF, RESEARCH, RERANK, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R2_R8, RULINGS_R9_R10, product(975), B464],
    review: 'Arrival evidence (#464, product redact-secret#975; #860 handoff cerebras.md, READY by ruling R10). T1: the length comes from the provider VS Code extension validator, which rejects any key that does not start csk_ or csk- or is not 52 long (R1), and both prefixes are a dated provider-staff statement (R3, as of 2025-10; provider docs state "starts with csk-"). POLICY under R10, not T1: no provider source states the alphabet (the validator accepts any 48 code units) and the [a-z0-9] class is tool-only, so project policy fills it with [A-Za-z0-9_-], a superset of every class seen with no narrowing from third-party rules (R8). Positives therefore include lowercase-only bodies and bodies with _ and -, and no fixture asserts silence on a byte outside the policy class (a dot or plus in the body is not authored either way). The leading boundary is load-bearing: it excludes Pinecone pcsk_ / pcsk- (the byte before csk is p; Pinecone keeps pcsk_ with a 69- or 70-byte body, so no width overlaps). Excluded: Management API keys (shape unknown), csk-your-key-here style placeholders and other widths. The tool rules\' [a-z0-9] body is narrower than the policy class, so a tool that follows it lags on any uppercase, _ or - body.',
    fields: [
      field({ field: 'prefix', claim: 'csk- (current) or csk_ (the 2025-10 window, still accepted)', basis: 'provider-code', status: 'frozen', sources: [src(VALIDATOR, 'starts csk_ or csk-'), src(STAFF_1, 'staff statement, 2025-10-23'), src(STAFF_2, 'staff statement, 2025-10-24'), src(RULINGS_R1_R3, 'R1, R3')], note: 'The csk_ prefix is T1 as of 2025-10 (R3): a dated staff statement.' }),
      field({ field: 'body-length', claim: 'exactly 48 body bytes (52 in all)', basis: 'provider-code', status: 'frozen', sources: [src(VALIDATOR, 'length 52 minus the 4-byte prefix'), src(VALIDATOR_LATER, 'unchanged 13 months later'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'policy-alphabet', claim: 'POLICY (R10), not T1: the body alphabet is [A-Za-z0-9_-]', basis: 'research-hypothesis', status: 'unresolved', sources: [src(RULINGS_R9_R10, 'R10: project policy may fill a grammar the provider states only partly, never narrower than a provider-stated class'), src(HANDOFF, 'the policy class is a superset of every class seen'), src(RULINGS_R2_R8, 'R8: no narrowing from third-party rules')], note: 'The validator accepts any 48 code units and states no alphabet. Positives use lowercase-only bodies and bodies with _ and -; no fixture asserts silence on a byte outside the class, so a dot or plus twin is not authored.' }),
      field({ field: 'tool-alphabet', claim: 'tool rules use [a-z0-9] for the body', basis: 'tool', status: 'provisional', sources: [src(RESEARCH, 'tool-only'), src(BETTERLEAKS, 'unpinned')], note: 'Tool-only and narrower than the policy class; not adopted (R8).' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier before the prefix ([A-Za-z0-9_-]) is not claimed; this keeps Pinecone pcsk_ / pcsk- unclaimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes: the leading boundary is what rejects pcsk_')], note: 'Handoff boundary decision, not a provider statement. The body class already contains _ and -, so a trailing byte extends the run and no trailing-glue twin exists.' }),
      field({ field: 'transport', claim: 'the CEREBRAS_API_KEY environment variable, sent as Authorization: Bearer to api.cerebras.ai; Cerebras(api_key=...)', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius')] }),
      field({ field: 'management-key', claim: 'the Management API key for dedicated endpoints is a separate credential of unknown shape', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Not this family; nothing is authored for it.' }),
      field({ field: 'peer-lag', claim: 'no Cerebras rule in trufflehog 3.97.4 or gitleaks 8.30.1; unpinned tool rules use a [a-z0-9] body, narrower than the policy class', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no cerebras detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no cerebras rule'), src(RESEARCH, 'tool-only [a-z0-9]')] }),
    ],
  },
};

const split = splitGraduated(authored, ['cerebras-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1037). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'cerebras-api-key': 'documented-24' };
