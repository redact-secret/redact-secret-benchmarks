import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th, gl } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX_583, REGISTRY_PIN, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './583-sources.ts';

// Issue #583, slice g: Beta.14 contract for the Mapbox secret access token (`sk.`) (#1014 rank 19, READY conditional on ruling
// Q7; handoff docs/audits/evidence/1014/mapbox.md; product redact-secret#1108). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// Mapbox's token page documents the three dot-separated base64url parts and the literal `sk` header; the provider's own parser
// (`parse-mapbox-token`, R1) shows the payload is a base64 JSON object, and the one docs example plus the provider fixtures show
// a 22-character signature (R5). The payload has no provider-stated floor or bound (a Drupal module tracker shows it growing), so
// the contract's `eyJ` + 20 floor is DERIVED from provider code: whether that may serve as T1 is ruling Q7 (open), recorded in
// `policy-q7-payload-floor` and never as T1. Narrower or wider payloads below the floor, and the temporary `tk.` token (Q9), are
// UNCLAIMED (DISPUTED_PROPERTIES, scored T0). `pk.` tokens are public by design and a JWT-format token is the jwt detector's (R7).
export const issue = '583g';

const TOKENS = 'https://docs.mapbox.com/api/accounts/tokens/';
const PARSER = 'https://github.com/mapbox/parse-mapbox-token/blob/015a6b470fdb489a2635a4889c9f5b1d545a512c/index.js';
const TRUFFLEHOG_MAPBOX = 'https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/mapbox/mapbox.go';
const DRUPAL = 'https://www.drupal.org/project/mapbox/issues/3302050';
const PK_DISCUSSION = 'https://github.com/orgs/community/discussions/198585';
const HANDOFF = handoff('mapbox.md', REGISTRY_PIN);
const Q7 = `${HANDOFF_INDEX_583}#ruling-questions-for-the-maintainer`;
const REFS = [TOKENS, PARSER, DRUPAL, PK_DISCUSSION, HANDOFF, HANDOFF_INDEX_583, Q7, R1014, RULINGS_R2_R8, product(1108), B583];

export const MAPBOX_SECRET_TOKEN_PATTERN = '^sk\\.eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{22}$';

export const arrivalFamilies: ArrivalFamily[] = [];

const authored: Record<string, FormatContract> = {
  'mapbox-token': {
    tier: 'T1',
    pattern: MAPBOX_SECRET_TOKEN_PATTERN,
    providerSource: provider(TOKENS, 'Mapbox "Tokens" docs page and the provider parser parse-mapbox-token, observed 2026-09-30: a token is three dot-separated parts, the header is the literal pk, sk or tk, the payload is a base64url JSON object, the signature is 22 base64url characters in the one docs example and the provider fixtures', 'sk. + eyJ + 20 or more [A-Za-z0-9_-] + . + exactly 22 [A-Za-z0-9_-]; no checksum', at),
    corroboration: [th('mapbox/mapbox', 'mapbox'), gl],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1108; #1014 handoff mapbox.md, READY conditional on Q7). A Mapbox secret access token (sk.) is for server-side use and can carry secret scopes (uploads, tilesets, styles, datasets, token management, account reads) plus billable API use; it is typically pasted into MAPBOX_SECRET_TOKEN or MAPBOX_DOWNLOADS_TOKEN env vars, gradle.properties or .netrc downloads credentials and scripts. T1 for the prefix, the three-part structure and the alphabet (docs and the provider parser, R1), and for the 22-character signature by R5 (one docs example plus provider fixtures agree). The payload has no stated bound or floor, so its eyJ + 20 lower bound is derived from the documented two-claim JSON object (23 characters is the smallest such object), not stated by Mapbox: that is ruling Q7 (policy). Excluded: pk. tokens (public by design, ruling question Q5), tk. temporary tokens (expire within an hour, richer payload, Q9), payloads that do not lead eyJ, signatures of any other width, and JWT-format tokens (an eyJ header is the jwt detector\'s, R7; a Mapbox header is sk, so jwt does not claim this token and the family never claims a three-part JWT). Pinned peers: trufflehog 3.97.4 mapbox reads sk. + 80 to 240 over [a-zA-Z0-9.-] beside the word mapbox (it misses a short token and the 22-character tail); gitleaks 8.30.1 has no Mapbox rule in its default config.',
    fields: [
      field({ field: 'prefix', claim: 'sk.', basis: 'provider-documentation', status: 'frozen', sources: [src(TOKENS, 'the header is the literal pk, sk or tk'), src(PARSER, 'token.split(".") and the usage part'), src(HANDOFF, 'supported shape')], note: 'R1 and R4: a documented prefix from provider code and docs is T1.' }),
      field({ field: 'structure', claim: 'three dot-separated base64url parts: header, payload, signature', basis: 'provider-documentation', status: 'frozen', sources: [src(TOKENS, 'each token is a string delimited by dots into three parts'), src(PARSER, 'split and JSON.parse of the second part')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9_-] in the payload and the signature', basis: 'provider-documentation', status: 'frozen', sources: [src(TOKENS, 'the payload is a base64-URL-encoded JSON object'), src(HANDOFF, 'supported shape')], note: 'R8: the alphabet is not narrowed from a third-party library.' }),
      field({ field: 'payload-lead', claim: 'the payload leads eyJ (the base64url of the JSON opener {")', basis: 'provider-code', status: 'frozen', sources: [src(PARSER, 'JSON.parse of the decoded payload: u, a, exp, iat, scopes, client, ll, iu'), src(HANDOFF, 'supported shape')], note: 'R1. A payload that does not lead eyJ is an accepted false negative.' }),
      field({ field: 'signature-length', claim: 'exactly 22 characters after the second dot', basis: 'provider-example', status: 'frozen', sources: [src(TOKENS, 'the one docs example, counted by hand: 22 base64url characters (16 bytes)'), src(PARSER, 'its tests use 22-character third segments'), src(HANDOFF, 'tier rationale')], note: 'R5: one docs example plus provider fixtures agree. Third-party ranges (20 to 30) are looser and not used.' }),
      field({ field: 'policy-q7-payload-floor', claim: 'POLICY, not T1: a payload floor of eyJ + 20 characters, derived from the documented two-claim JSON object and provider code, serves as the contract lower bound (ruling question Q7, open)', basis: 'research-hypothesis', status: 'provisional', sources: [src(Q7, 'Q7: may a floor derived from provider code or wire format serve as the T1 floor'), src(HANDOFF, 'what depends on Q7')], note: 'If Q7 is refused the family stays READY only for values showing a documented u + a payload (eyJ1Ijoi), a narrower claim. The 22-character signature tail is the real anchor, so the floor has little false-positive effect.' }),
      field({ field: 'payload-upper-bound', claim: 'none: the payload grows with the account and token contents and the provider states no bound', basis: 'provider-documentation', status: 'frozen', sources: [src(DRUPAL, 'access tokens at 98 characters in 2022 and "increased in size further" by 2024-08'), src(HANDOFF, 'supported shape')], note: 'No fixture asserts a maximum.' }),
      field({ field: 'unclaimed-shapes', claim: 'a payload of eyJ + 19 or fewer (below the derived floor) and the tk. temporary token are unclaimed', basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'what depends on Q7'), src(TOKENS, 'tk tokens embed their metadata in the payload and expire')], note: 'Authored as unclaimed controls (DISPUTED_PROPERTIES, T0): no fixture asserts silence or detection on them (Q7, Q9).' }),
      field({ field: 'boundary', claim: 'a token glued to an identifier-continuation byte before the sk or after the 22nd signature byte is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'case', claim: 'the prefix is matched case-sensitively (SK. is not a Mapbox token)', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'near-miss twins')], note: 'Handoff decision.' }),
      field({ field: 'transport', claim: 'MAPBOX_SECRET_TOKEN or MAPBOX_ACCESS_TOKEN env vars; mapboxgl.accessToken and SDK accessToken options; the tilesets CLI; the access_token query parameter of the API; MAPBOX_DOWNLOADS_TOKEN in gradle.properties and .netrc downloads credentials', basis: 'provider-documentation', status: 'frozen', sources: [src(TOKENS), src(HANDOFF, 'role and blast radius')] }),
      field({ field: 'public-identifiers', claim: 'pk. tokens are public by design ("all public access tokens start with pk") and must never be redacted (ruling question Q5)', basis: 'provider-documentation', status: 'frozen', sources: [src(PK_DISCUSSION, 'forum discussion quoting the provider rule'), src(TOKENS), src(HANDOFF, 'excluded shapes')], note: 'Controls and a prefix twin, never positives.' }),
      field({ field: 'jwt', claim: 'a three-part JWT (eyJ header) is reported by the jwt detector and never by this family; a Mapbox sk. token has a non-JWT header, so jwt does not claim it either (R7, no double report)', basis: 'provider-documentation', status: 'frozen', sources: [src(TOKENS, 'the header is the literal pk, sk or tk'), src(HANDOFF, 'overlap and output policy')], note: 'Authored as an encoded-value control: a JWT with Mapbox-shaped claims.' }),
      field({ field: 'peer-lag', claim: 'trufflehog mapbox needs the word mapbox near an sk. value of 80 to 240 characters; gitleaks 8.30.1 has no Mapbox rule: lag is measured, not assumed', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_MAPBOX, 'sk\\.[a-zA-Z-0-9\\.]{80,240}'), src(TRUFFLEHOG_DETECTORS), src(GITLEAKS_CONFIG, 'no mapbox rule')] }),
    ],
  },
};

const split = splitRegistered(authored, ['mapbox-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1227). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'mapbox-token': 'documented-24' };
