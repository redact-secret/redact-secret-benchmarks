import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th } from '../contract-sources.ts';
import { handoff, research, RERANK, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R9_R10, B464, product, at, src, reason, BETTERLEAKS, GITLEAKS_CONFIG } from './464-sources.ts';

// Issue #464, slice c: Beta.12 contract for the NVIDIA NGC / build.nvidia.com API key (#860, READY with an
// open-ended body under the existing rulings; handoff docs/audits/evidence/860/nvidia.md; product
// redact-secret#972). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 (R1, R2, R6): the nvapi- prefix, the [A-Za-z0-9_-] alphabet and the floor of 60 come from provider-owned
// sources; no provider source states an exact width. The 128-byte cap is POLICY (the Apify precedent: a bounded run for
// streaming), so the contract pattern is the provider's open-ended grammar and no fixture asserts silence on a
// longer run. trufflehog's exact 64 and betterleaks' {60,70} are tool-only and sit inside the grammar.
export const issue = '464c';

const HELIX = 'https://github.com/NVIDIA-NeMo/nemo-helix/blob/689f7852611b0151cee2748ca2b68e8e163e3b65/plugins/nemo-agents/src/nemo_agents_plugin/skills/agents-secure/resources/pii_scan.py#L229-L232';
const SKILL_EVALUATOR = 'https://github.com/NVIDIA/SkillEvaluator/blob/a2636b2f886235f974ed4329029f923a12d0328b/src/skillevaluator/validators/secrets.py#L57-L60';
const NEMOCLAW = 'https://github.com/NVIDIA/NemoClaw/blob/6721c275ba9c30ea99c404872379110dfba5a99a/src/lib/validation.ts#L255-L271';
const NOOA = 'https://github.com/NVIDIA-NeMo/labs-OO-Agents/blob/3374ceae9f1ba13ddbaceca752d8886d1d9dff3b/src/nooa/tracing/_secret_scrubber.py#L118';
const HANDOFF = handoff('nvidia.md');
const RESEARCH = research('nvidia.md');

export const NVIDIA_PATTERN = '^nvapi-[A-Za-z0-9_-]{60,}$';

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'nvidia-api-key', taxonomy: 'nvidia:ngc-api-key', issue, reason: reason('nvidia-api-key', 'nvidia_api_key', 972, 'The detector id is also this family\'s arrival id, so it graduates when the registry is re-pinned. trufflehog 3.97.4 registers an NVAPI detector, so its findings are mapped to this family.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'nvidia-api-key': {
    tier: 'T1',
    pattern: NVIDIA_PATTERN,
    providerSource: provider(HELIX, 'NVIDIA-NeMo/nemo-helix pii_scan.py (added 2026-05-21): \\bnvapi-[A-Za-z0-9_\\-]{60,}\\b, a provider-authored rule (R2); NVIDIA/SkillEvaluator secrets.py nvapi-[A-Za-z0-9_-]{40,}; the ngcsdk constant SCOPED_KEY_PREFIX = "nvapi-" with an executing startswith (R1, R6); re-checked 2026-09-28', 'nvapi- + at least 60 [A-Za-z0-9_-], open-ended; NGC Personal, NGC Service and build.nvidia.com keys share the prefix; no separator or checksum', at),
    corroboration: [th('nvapi/nvapi', 'NVAPI: \\b(nvapi-[a-zA-Z0-9_-]{64})\\b, exact 64 (tool-only, T2)'), { tool: 'betterleaks (unpinned)', label: 'nvapi- + {60,70} (tool-only, T2)', url: BETTERLEAKS }],
    references: [HELIX, SKILL_EVALUATOR, NEMOCLAW, NOOA, HANDOFF, RESEARCH, RERANK, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R9_R10, product(972), B464],
    review: 'Arrival evidence (#464, product redact-secret#972; #860 handoff nvidia.md, READY with an open-ended body). T1: the prefix is NVIDIA docs ("typically start with nvapi-") and the ngcsdk constant with an executing startswith (R1, R6); the alphabet and the floor of 60 are a provider-authored secret-scanning rule in an NVIDIA-owned organization (R2; the handoff checked that it is not a verbatim copy of a public scanner rule), and a second NVIDIA rule uses a lower floor of 40 with the same class. No provider source states an exact width. POLICY, not T1: the 128-byte upper bound (a bounded run for streaming; an over-cap run is rejected whole, never truncated), so positives reach 128 and nothing asserts silence on 129. The peers disagree with the provider grammar in both directions: trufflehog 3.97.4 NVAPI is an exact 64 and so lags on 60-63 and 65-128 while agreeing at 64, and betterleaks is {60,70} (unpinned, T2). Excluded: the legacy prefixless 84-character NGC key (the $oauthtoken registry password; generic context only), nvapi- + fewer than 60 bytes (NVAPI SDK and crate names, short fixtures), nvapi-... and nvapi-xxxx placeholders, and bodies containing a dot (only one looser NVIDIA rule admits it; the trailing boundary rejects the run rather than truncating it).',
    fields: [
      field({ field: 'prefix', claim: 'nvapi-', basis: 'provider-code', status: 'frozen', sources: [src(RESEARCH, 'ngcsdk SCOPED_KEY_PREFIX = "nvapi-", executing startswith (R1, R6)'), src(HANDOFF, 'NVIDIA docs: "typically start with nvapi-"')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9_-]', basis: 'provider-code', status: 'frozen', sources: [src(HELIX, 'provider-authored rule, R2'), src(SKILL_EVALUATOR, 'the same class, floor 40')] }),
      field({ field: 'floor', claim: 'at least 60 body bytes, open-ended', basis: 'provider-code', status: 'frozen', sources: [src(HELIX, '{60,}'), src(RULINGS_R2_R8, 'R2')], note: 'Provider-authored (R2), not the tool width: the SkillEvaluator rule\'s lower 40 is below it and contradicts nothing.' }),
      field({ field: 'policy-upper-bound', claim: 'POLICY, not T1: the product caps the run at 128 bytes; an over-cap run is rejected whole, never truncated', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'supported shape: project policy, the Apify precedent; the tool-verified width is 64')], note: 'Not a provider fact, and the provider rule is open-ended: positives reach 128 and no fixture asserts silence on 129.' }),
      field({ field: 'observed-width', claim: 'the tool-verified width is 64', basis: 'tool', status: 'provisional', sources: [src(th('nvapi/nvapi').url, 'exact 64')], note: 'Default positives carry 64; the 60, 70 and 128 positives exercise the provider floor and the policy cap.' }),
      field({ field: 'dot-in-body', claim: 'a body containing . is not claimed: only one looser NVIDIA redaction rule admits it', basis: 'provider-code', status: 'provisional', sources: [src(RESEARCH, 'the alphabet table'), src(NOOA, 'the looser redaction superset')], note: 'The dot twin puts the dot early so no run reaches the 60 floor, so it holds under the provider rule too.' }),
      field({ field: 'legacy-ngc-key', claim: 'the legacy NGC key is 84 non-space characters with no prefix, used as the $oauthtoken registry password; its structure is tool-inferred', basis: 'tool', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Context-anchored only; generic context covers NGC_API_KEY=. Nothing is authored for it either way.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier before the prefix ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement. The body class already contains _ and -, so a trailing byte extends the run and no trailing-glue twin exists.' }),
      field({ field: 'transport', claim: 'NVIDIA_API_KEY and NGC_API_KEY, sent as Authorization: Bearer to integrate.api.nvidia.com; ChatNVIDIA(api_key=...)', basis: 'provider-documentation', status: 'frozen', sources: [src(NEMOCLAW, 'validation of the scoped key'), src(HANDOFF, 'test axes')] }),
      field({ field: 'peer-lag', claim: 'trufflehog 3.97.4 NVAPI is an exact 64 (lags the 60-63 and 65-128 positives); gitleaks 8.30.1 has no NVIDIA rule; betterleaks (unpinned, not measured here) uses {60,70}', basis: 'tool', status: 'frozen', sources: [src(th('nvapi/nvapi').url, 'exact 64'), src(GITLEAKS_CONFIG, 'no nvapi rule'), src(BETTERLEAKS, 'observed 2026-09-28 in the handoff research; unpinned')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'nvidia-api-key': 'documented-24' };
