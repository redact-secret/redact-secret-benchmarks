import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, gl } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, R1014, RULINGS_R1_R3, B528, product, at, src, reason, GRADUATES, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './528-sources.ts';

// Issue #528, slice e: Beta.12 contract for the Clojars deploy token (#1014 rank 5, READY; handoff
// docs/audits/evidence/1014/clojars.md; product redact-secret#1025). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 for every fact under R1: generate-deploy-token returns "CLOJARS_" + the lowercase hex of 30 secure-random bytes,
// and the server's own shape check is #"^CLOJARS_[0-9a-f]{60}$". The prefix is case-sensitive.
export const issue = '528e';

const GENERATOR = 'https://github.com/clojars/clojars-web/blob/442eb895e7ab3449161848d8c368d4783c5f0067/src/clojars/db.clj#L799-L853';
const HANDOFF = handoff('clojars.md');
const RESEARCH = researchTable('5900447282');

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'clojars-deploy-token', taxonomy: 'clojars:deploy-token', issue, reason: reason('clojars-deploy-token', 'clojars_deploy_token', 1025, GRADUATES) },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'clojars-deploy-token': {
    tier: 'T1',
    pattern: '^CLOJARS_[0-9a-f]{60}$',
    providerSource: provider(GENERATOR, 'clojars/clojars-web src/clojars/db.clj (442eb89, last changed 2026-09-16): generate-deploy-token = (str "CLOJARS_" (hexadecimalize (generate-secure-token 30))), hexadecimalize formats %02X then lowercases, and is-deploy-token? is #"^CLOJARS_[0-9a-f]{60}$"; re-checked 2026-09-29', 'CLOJARS_ + exactly 60 lowercase hex, 68 in all; no checksum', at),
    corroboration: [{ tool: gl.tool, label: 'clojars-api-token: (?i)CLOJARS_[a-z0-9]{60} (case-insensitive and wider than hex)', url: gl.url }],
    references: [GENERATOR, HANDOFF, RESEARCH, HANDOFF_INDEX, R1014, RULINGS_R1_R3, product(1025), B528],
    review: 'Arrival evidence (#528, product redact-secret#1025; #1014 handoff clojars.md, READY). A deploy token is the password for deploying artifacts to Clojars (CLOJARS_PASSWORD, ~/.lein/credentials, Maven settings.xml), optionally scoped to a group or artifact; a leak is a supply-chain risk. T1 for every fact under R1: the generator and the server validator agree, so the contract is exactly the validator. The prefix is case-sensitive. Excluded: legacy account passwords (no shape), CLOJARS_USERNAME/CLOJARS_PASSWORD/CLOJARS_ENVIRONMENT names and uppercase-hex bodies (the validator rejects them). gitleaks 8.30.1 clojars-api-token is case-insensitive over [a-z0-9] with no boundary, so it overreaches on the lowercase-prefix, uppercase-hex, non-hex-letter, leading-glue and 61-byte twins; trufflehog 3.97.4 has no rule.',
    fields: [
      field({ field: 'prefix', claim: 'CLOJARS_ (uppercase, case-sensitive)', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'generate-deploy-token and is-deploy-token?')] }),
      field({ field: 'body', claim: 'exactly 60 lowercase hex [0-9a-f] (30 secure-random bytes); 68 in all', basis: 'provider-code', status: 'frozen', sources: [src(GENERATOR, 'hexadecimalize lowercases; the validator is [0-9a-f]{60}')] }),
      field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement; the validator itself is anchored.' }),
      field({ field: 'transport', claim: 'CLOJARS_PASSWORD in CI; a Leiningen :password entry; a Maven ~/.m2/settings.xml <password> element', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'test axes')] }),
      field({ field: 'env-names', claim: 'CLOJARS_USERNAME, CLOJARS_PASSWORD and CLOJARS_ENVIRONMENT are variable names, not tokens', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'Benign controls: they fail the 60-hex body.' }),
      field({ field: 'peer-lag', claim: 'gitleaks 8.30.1 clojars-api-token (?i)CLOJARS_[a-z0-9]{60} (entropy 2) has no boundary and is case-insensitive over [a-z0-9]: it reads every positive and overreaches on clojars_, uppercase-hex and non-hex-letter bodies, leading glue and a 61-byte body (it matches the first 60). Mapped to clojars-deploy-token. No Clojars rule in trufflehog 3.97.4', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_CONFIG, 'clojars-api-token'), src(TRUFFLEHOG_DETECTORS, 'no clojars detector directory at the pinned version')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'clojars-deploy-token': 'documented-24' };
