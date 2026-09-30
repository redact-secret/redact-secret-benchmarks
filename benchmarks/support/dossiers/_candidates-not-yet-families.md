# Research candidates that are not taxonomy families yet

Issue [#860](https://github.com/redact-secret/redact-secret/issues/860) researched 50 provider credential candidates, and its [final disposition](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) gives each one a disposition. The 31 candidates below have no provider dossier, because `dossiers:check` requires every dossier provider to exist in `taxonomy.json` and none of these does. The six READY rows (daytona, clickhouse-cloud, nvidia, browserbase, cerebras, runpod) were promoted to taxonomy families with their own dossiers by [benchmarks#464](https://github.com/redact-secret/redact-secret-benchmarks/issues/464) (Beta.12), with the product counterparts redact-secret#970 to #975, so they are no longer listed here. Adding one to the taxonomy is the promotion step, a family-intake change, and it is outside the scope of the dossier work. Until then the research stays in the linked core evidence. Several are not distinct families at all: 23 are `generic coverage sufficient`, two extend existing families and one is pending-unsupported. Only the distinct-family candidates could become taxonomy families, and their readiness is recorded per row (state as of 2026-09-28; issue #860 is still open).

| candidate | tier | disposition | readiness | reason / blocker | record |
| --- | --- | --- | --- | --- | --- |
| `fal:api-key` | C | extend existing family | n/a | no provider anchor; extended in Beta.11: #919 added the `FAL_KEY` name and the `Authorization: Key` scheme, and #918 fixed the Bearer span for `id:secret` | [fal-contextual-gap.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/fal-contextual-gap.md) |
| `modal:token-secret` | C | generic coverage sufficient | n/a | the `as-` prefix is too generic for bare detection; `MODAL_TOKEN_SECRET=` is covered by context | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `baseten:api-key` | A | distinct family | DATE-GATED | no `b10_` key exists before 2026-10-01 15:00 GMT | [baseten.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/baseten.md) |
| `sambanova:cloud-api-key` | C | generic coverage sufficient | n/a | unprefixed UUID, empirical only | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `deepinfra:api-token` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `qdrant:cloud-api-key` | C | generic coverage sufficient | n/a | documented only as a JWT (R7) | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `weaviate:cloud-api-key` | A | distinct family | ISSUANCE-GATED | WCD issuance of the OSS generator format not accepted as proven (researched 2026-09-28) | [weaviate.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/weaviate.md) |
| `upstash:redis-rest-token` | C | generic coverage sufficient | n/a | no literal prefix (R4); the read-only sibling has no lexical marker | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `cartesia:api-key` | B | distinct family | ISSUANCE-GATED | `.` separator and segment lengths come from a comment only; drift suspected | [issuance-research/cartesia.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/cartesia.md) |
| `stability-ai:api-key` | C | generic coverage sufficient | n/a | `sk-` + 48, identical to legacy OpenAI; existing `sk-` handling (R4) | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `assemblyai:api-key` | C | generic coverage sufficient | n/a | unprefixed 32 hex | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `nebius:ai-studio-api-key` | C | generic coverage sufficient | n/a | documented only as a JWT (R7, R4) | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `hyperbolic:api-key` | C | generic coverage sufficient | n/a | empirically an HS256 JWT with no provider statement; generic JWT coverage applies (R7) | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `novita:api-key` | C | generic coverage sufficient | n/a | `sk_` prefix is shared | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `luma:api-key` | C | pending-unsupported | n/a | `luma-` / `luma-api-` prefixes T1 by R4; no length; identifier collision with `luma-api-key` | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `reka:api-key` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `hume:api-key` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `speechmatics:api-key` | C | generic coverage sufficient | n/a | 31 alphanumerics by one example (R5); unprefixed | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `gladia:api-key` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `lambda-cloud:api-key` | C | generic coverage sufficient | n/a | `secret_` prefix is shared with Notion legacy | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `infisical:machine-identity-token` | C | generic coverage sufficient | n/a | JWT (R7); the legacy `st.` service token is a retained lead | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `arcade:api-key` | B | distinct family (`arc_proj_` only) | ISSUANCE-GATED | sub-prefix, length and alphabet unknown (placeholders only); bare `arc_` is shared by at least 3 issuers and not selected | [issuance-research/arcade.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/arcade.md) |
| `portkey:api-key` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `braintrust:api-key` | C | generic coverage sufficient | n/a | `sk-` + 40 or more is T1 (R2) but has no signal independent of legacy OpenAI; `bt-st-` is an open lead | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `mongodb-atlas:programmatic-api-key` | C | generic coverage sufficient | n/a | unprefixed UUID; `mdb_sa_sk_` is a retained sibling lead | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `planetscale:service-token` | B | distinct family | ISSUANCE-GATED | today's suffix length and alphabet; the 2022 staff range was not accepted | [issuance-research/planetscale.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/planetscale.md) |
| `aiven:authentication-token` | C | generic coverage sufficient | n/a | no prefix; Base64 alphabet only | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `turso:database-auth-token` | C | generic coverage sufficient | n/a | documented only as a JWT (R7) | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `redis-cloud:api-key` | C | generic coverage sufficient | n/a | `A`/`S` + 50 by CLI help example (R5); a one-letter lead cannot anchor | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `algolia:admin-api-key` | C | generic coverage sufficient | n/a | 32 lowercase hex, but Admin and Search-only keys are lexically identical | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `clerk:secret-key` | C | extend existing family | n/a | redacted today under the wrong family (`stripe_credential`); separating it needs an issued body length and context; tracked in #957 (open, Beta.12) | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |

## Candidates that map to taxonomy families

The other 13 of the 50 candidates are taxonomy families and have a dossier in this folder.

| candidate | dossier |
| --- | --- |
| `resend:api-key` | [`resend.md`](resend.md) |
| `firecrawl:api-key` | [`firecrawl.md`](firecrawl.md) |
| `e2b:api-key` | [`e2b.md`](e2b.md) |
| `apify:api-token` | [`apify.md`](apify.md) |
| `trigger-dev:secret-api-key` | [`trigger-dev.md`](trigger-dev.md) (also `trigger-dev:personal-access-token`) |
| `composio:api-key` | [`composio.md`](composio.md) (three families: `composio:project-api-key`, `composio:org-api-key`, `composio:user-api-key`) |
| `helicone:api-key` | [`helicone.md`](helicone.md) (also `helicone:write-api-key`) |
| `wandb:api-key` | [`wandb.md`](wandb.md) |
| `posthog:personal-api-key` | [`posthog.md`](posthog.md) (also `posthog:project-secret-api-key`) |
| `onepassword:service-account-token` | [`onepassword.md`](onepassword.md) |
| `doppler:service-token` | [`doppler.md`](doppler.md) (seven `doppler:*` families) |
| `convex:deployment-key` | [`convex.md`](convex.md) (hex body ready; cloud body gated) |
| `inngest:signing-key` | [`inngest.md`](inngest.md) |

## Issue #1014 candidates (Beta.12 broad discovery, second 50)

Issue [#1014](https://github.com/redact-secret/redact-secret/issues/1014) researched 50 more provider credential candidates. Its [frozen record](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md) (merge commit `3785817`, 2026-09-30) ranks all 50, gives each a step-4 disposition, and holds twenty step-3 handoffs, plus the open rulings Q1 to Q10 restated below. It changes no detector, fixture, support status or release, and no key was issued for any of it.

- **10 have a dossier.** Ten providers were already taxonomy families when #1014 was researched, and their dossiers carry the research: see [Candidates that map to taxonomy families (#1014)](#candidates-that-map-to-taxonomy-families-1014).
- **40 have none.** None of these 40 providers is in `taxonomy.json`, and `dossiers:check` requires every dossier provider to exist there, so each is recorded below in the dossier's shape and vocabulary. Promotion to a taxonomy family is a family-intake change outside the scope of this file.
- **Wave order here follows the step-4 gate**, not the rank: A handoff-ready (11 candidates, one of them merged into another), B ruling- or policy-gated (8), C T2 families (8), D evidence- or issuance-blocked, deferred or generic (13).
- **Reading the record lines.** `verdict` and `tier` use the [dossier vocabulary](README.md#research-verdicts). The vocabulary has no value for "evidence complete, waiting on a maintainer ruling", so a ruling-gated row shows `ready` (or the nearest evidence verdict) and names the ruling in `gate`; `blockedBy`-style text is written only where the dossier schema would accept it. `researchedAt` is 2026-09-30 for every row (the step-4 disposition date).
- **Product implementation issues are not opened yet** (step 5 of #1014), so no row cites an implementation issue; a row gains one when the maintainer files it.

Open rulings the rows refer to (full text in the record, recommendations in brackets): **Q1** checksums stay lexical and only ever turn a match into a non-match [keep lexical]; **Q2** Microsoft `security-utilities` code counts as R2 provider-authored; **Q3** a policy tail alphabet for DataStax (R10); **Q4** a provider that disclaims a grammar (Asana); **Q5** documented-public siblings stay unclaimed; **Q6** SDK README examples and a single docs example as R5 (Stytch, Mercury); **Q7** a derived or narrowing floor for open-ended segments [yes]; **Q8** R5 when the provider disclaims length validation (Square) [yes]; **Q9** Mapbox `tk.` and standalone Fly `fo1_` stay unclaimed [yes]; **Q10** Unkey customer-prefixed version 1 keys as a separate type [yes].

### Wave A: handoff-ready (step-3 records exist)

Shapes are grammar in words; every body is built at run time in the record's tests, never copied.

| candidate | verdict | tier | step-4 disposition | gate | record |
| --- | --- | --- | --- | --- | --- |
| `xata:api-key` | ready | T1 | HANDOFF READY | Q1 (CRC32 stays lexical) | [xata.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/xata.md) |
| `sourcegraph:access-token` | ready | T1 (as of 2025-11-18, R9) | HANDOFF READY | optional issuance check | [sourcegraph.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/sourcegraph.md) |
| `unkey:root-key` | ready | T1 | HANDOFF READY | Q10 (customer-prefixed keys only), Q1 | [unkey.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/unkey.md) |
| `buildkite:user-access-token` | ready | T1 (R2) | HANDOFF READY | none | [buildkite.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/buildkite.md) |
| `pydantic:logfire-token` (AI Gateway key merged in) | ready | T1 | HANDOFF READY | Q7 (non-blocking) | [pydantic-logfire.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/pydantic-logfire.md) |
| `mapbox:secret-access-token` | ready | T1 | HANDOFF READY, conditional | Q7; Q9 for `tk.` | [mapbox.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/mapbox.md) |
| `fly:access-token` | ready | T1 | HANDOFF READY, conditional | Q7; Q9 for `fo1_` | [fly.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/fly.md) |
| `square:access-token` | ready | T1 (R5) | HANDOFF READY | Q8; issuance check recommended | [square.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/square.md) |
| `ory:network-api-key` (session and OAuth2 siblings) | ready | T1 | HANDOFF READY for siblings | none for siblings | [ory.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/ory.md) |
| `ory:network-api-key` (admin keys `ory_pat_`, `ory_apikey_`, `ory_wak_`) | issuance-gated | T2 | BLOCKED | body length and alphabet of the admin keys: one project key and one workspace key, structure only | [ory.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/ory.md) |
| `mercury:api-token` | issuance-gated | T2 | BLOCKED | body width has one provider example and no bound: Q6 (extended) or a structure-only issuance check of a Read Only and a Read and Write token | [mercury.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/mercury.md) |

#### `xata:api-key`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `xau_` (user key) or `xao_` (organization key) + a base62 body of 32 to 36 characters from `[0-9A-Za-z]`: 20 random bytes plus their little-endian CRC32 encoded with the provider's bit-packed base62, so the width is derived, with 99.9% of keys at 32 to 34. Total 36 to 40. Classic-platform keys (before 2026) have no source and stay generic.
- **Sources:** T1 under R1 and R9: the provider's open-source generator and validator ([`key.go`](https://github.com/xataio/xata/blob/fc4ac97f62a3830c4e4202b08a3ca51855970113/internal/api/key/key.go#L19-L57)), plus a test fixture and the CLI mask that agree with the derivation. No scanner or partner rule exists.
- **Issuance:** optional, structure only (one user and one organization key); not a precondition.
- **Collisions:** `xau_` is 4 bytes, so an identifier-start boundary is load-bearing; placeholders such as `xau_test` fail the width. The bit-packed base62 is not standard base62, which matters for any checksum post-check.
- **Current contract in core:** no detector on `main` (handoff route: new detector `xata-api-key`, types `xata_user_api_key` and `xata_organization_api_key`); [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) has no row yet.
- **Open questions:** Q1 (CRC32 as an optional reject-only post-check; the recommendation is to keep it lexical).
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/xata.md); [step-1 table, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540).

#### `sourcegraph:access-token`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `sgp_` + an optional instance identifier (16 hex or `local` from the generator; any alphanumeric run in the 2025 validator) + `_` + exactly 40 hex; a bare `sgp_` + 40 hex is also valid. The validators accept upper-case hex, the generator emits lower case.
- **Sources:** T1 under R1 with R9 dating: the provider's generator and validator in the archived public snapshot ([`personal_access_token.go`](https://github.com/sourcegraph/sourcegraph-public-snapshot/blob/c864f15af264f0f456a6d8a83290b5c940715349/internal/accesstoken/personal_access_token.go#L13-L48), 2024-08) and the validator vendored into `src-cli` on 2025-11-18, which widens the identifier and keeps the body. Scanner rules (gitleaks, trufflehog, noseyparker) and the GitHub partner list corroborate at T2.
- **Issuance:** optional (one revoked token from a current instance, to see whether `sgph_` is issued); the server repository is private, so a post-2025 generator change cannot be ruled out.
- **Collisions:** the scanners' bare 40-hex alternative collides with git SHAs and is deliberately not used. `sgd_` (Cody Gateway), `sgph_` and `slk_` are excluded until a provider source states what issues them.
- **Current contract in core:** no detector on `main` (route: new detector `sourcegraph-token`, type `sourcegraph_access_token`); no row in `detector-families.md` yet.
- **Open questions:** whether `sgph_` is issued, and whether to extend to `sgd_` later.
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/sourcegraph.md); [step-1 table, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016).

#### `unkey:root-key`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null` (the customer-prefixed part waits on Q10); issues `redact-secret/redact-secret#1014`.
- **Shape:** two current root-key grammars. Version 1: `unkey_` + 8 base58 + the literal marker `unkeyv1` + 42 base58 (63 in all; the last 6 are a CRC-32C in base58). Dashboard form: `unkey_3Z` + 22 base58 (30 in all; the lead is fixed by the encoded bytes). Base58 is the Bitcoin alphabet, so `0`, `O`, `I`, `l` and `_` never occur in a random part.
- **Sources:** T1 under R1 and R9: the provider's RFC 0017 (which states the format and a scanning regex), the version 1 generator and a handler test asserting the exact shape; the dashboard form from the generator code with width and lead derived exactly. The step-1 single window `unkey_` + 21 to 24 base58 is superseded. betterleaks' `{20,32}` rule is looser and is not used.
- **Issuance:** optional, structure only (one dashboard root key and one created through the v2 API).
- **Collisions:** `unkey_`-prefixed identifiers such as `unkey_root_key`; `UNKEY_ROOT_KEY=` is not recognized as a credential name by today's contextual detection (measured on `main` 2026-09-29), which a dedicated detector closes.
- **Current contract in core:** no detector on `main` (route: new detector `unkey-root-key`, type `unkey_root_key`); no row in `detector-families.md` yet.
- **Open questions:** Q10 (claim customer-prefixed version 1 keys, anchored on `unkeyv1`, as `unkey_api_key`); Q1 (CRC-32C stays lexical); root keys from before the current generators have no source.
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/unkey.md); [step-1 table, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282).

#### `buildkite:user-access-token`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** one of 15 prefixes (`bkua_`, `bkur_`, `bktx_`, `bkaa_`, `bkar_`, `bkct_`, `bkcqt_`, `bkaj_`, `bkjat_`, `bkpt_`, `bkrt_`, `bktr_`, `bkat_`, `bkpat_`, `bkps_`) + an open-ended body from `[A-Za-z0-9_.-]`, floor 24 and cap 2048 (the provider's own redaction constants); the job tokens (`bkaj_`, `bkjat_`) are JWTs, so the prefixed form must win over `jwt`. The provider says its shortest real bodies are 38 bytes or more; the 24 floor also catches truncated values.
- **Sources:** T1 under R2: the provider-authored redaction rule in `buildkite/agent` ([`redact.go`](https://github.com/buildkite/agent/blob/4b52e509c730797c2a97487972fdf99477fd07e6/internal/redact/redact.go#L30-L69), merged 2026-09-29), cross-checked with the provider's token docs; made-up provider test fixtures show the segment layouts. trufflehog's `bkua_` + 40 hex is T2 and is not a limit on the contract.
- **Issuance:** optional, structure only (one API token and one agent token).
- **Collisions:** snake_case identifiers beginning with a listed prefix and 24 or more body bytes are the accepted false positive; legacy unprefixed 40-hex tokens and legacy agent tokens stay generic.
- **Current contract in core:** no detector on `main` (route: new detector `buildkite-token`, finding types per role, collapsible); no row in `detector-families.md` yet.
- **Open questions:** the floor, 24 against 38, is a one-constant policy choice (recommended 24), not a ruling.
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/buildkite.md); [step-1 table, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016). Buildkite was first named as a follow-up in the #523 CI ranking.

#### `pydantic:logfire-token`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `pylf_v` + digits + `_` + a lowercase region (`us`, `eu`, staging and other regions seen) + `_` + an optional organization UUID + `_` + `[A-Za-z0-9]` body, floor 20 by policy (every fixture and the one third-party rule use 44). One namespace covers Logfire write tokens, read tokens, API keys and the AI Gateway key; no text feature tells the roles apart, so the AI Gateway candidate is a role of this family, not another.
- **Sources:** T1 under R1 and R2: two provider SDK parsers ([logfire `auth.py`](https://github.com/pydantic/logfire/blob/a413dc789002d35cbc3b1a281e0d936c0930762e/logfire-sdk/logfire/_internal/auth.py#L36-L41), [pydantic-ai `gateway.py`](https://github.com/pydantic/pydantic-ai/blob/b2e37b94a275084716c820065e8c912809daed7c/pydantic_ai_slim/pydantic_ai/providers/gateway.py#L407-L418)) and the provider's own scrubber pattern on the prefix. The 44 width is T2 (fixtures, one scanner rule).
- **Issuance:** optional, structure only (one write token, one v2 API key, one gateway key).
- **Collisions:** none; `pylf_` is unique. Docs placeholders and the dashboard's masked form fall below the floor. Legacy tokens without the prefix have no distinctive shape.
- **Current contract in core:** no detector on `main` (route: new detector `pydantic-logfire-token`, one type `pydantic_logfire_token`); no row in `detector-families.md` yet.
- **Open questions:** Q7 (a narrowing policy floor of 20; non-blocking).
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/pydantic-logfire.md); [step-1 table, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812).

#### `mapbox:secret-access-token`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null` (conditional on Q7); issues `redact-secret/redact-secret#1014`.
- **Shape:** `sk.` + a base64url JSON payload that starts `eyJ` (floor 20 characters, open-ended upward) + `.` + exactly 22 base64url characters. The header is `sk`, not a JWT header.
- **Sources:** T1: Mapbox's token docs (three dot-separated parts, header `pk`/`sk`/`tk`) and the provider's [`parse-mapbox-token`](https://github.com/mapbox/parse-mapbox-token/blob/015a6b470fdb489a2635a4889c9f5b1d545a512c/index.js) code; the 22-character signature by R5 (one docs example plus provider fixtures). The payload width has no provider bound (a Drupal tracker shows it growing), so the 20 floor is derived, which is Q7.
- **Issuance:** optional, structure only (one secret token).
- **Collisions:** `pk.` tokens are public by design and must never be redacted (Q5); `tk.` tokens expire within an hour and stay unclaimed (Q9); `jwt` does not claim this header, so the contract must claim the whole span without double reporting.
- **Current contract in core:** no detector on `main` (route: new detector `mapbox-token`, type `mapbox_secret_access_token`); no row in `detector-families.md` yet.
- **Open questions:** Q7 (derived floor); Q9 (`tk.`); Q5 (`pk.` stays unclaimed).
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/mapbox.md); [step-1 table, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812).

#### `fly:access-token`

- **Record:** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null` (conditional on Q7); issues `redact-secret/redact-secret#1014`.
- **Shape:** the whole comma-joined bundle that starts at the first `fm1r_`, `fm1a_` or `fm2_` member, each body from standard Base64 plus URL-safe characters with optional `=` padding and a 64-character floor, optionally followed by an `fo1_` member. The `FlyV1 ` scheme and its space stay outside the span.
- **Sources:** T1: the provider's wire-format code ([`format.go`](https://github.com/superfly/macaroon/blob/a0202e10fd947786884323dcbce46efbe8652171/format.go#L11-L60)) and Fly's own log redaction rule in `flyctl` (R2), which has no upper bound. The 64 floor is derived from the smallest decodable macaroon (48 bytes), not stated, which is Q7. Community reports measure deploy tokens of several hundred characters.
- **Issuance:** optional, structure only (one deploy token and one session bundle); it would replace the derived floor with an observed minimum.
- **Collisions:** a standalone `fo1_` token has no provider-stated length and stays generic (Q9); `FLY_API_TOKEN=FlyV1 fm2_...` unquoted is missed by today's context detection (measured on `main` 2026-09-29); `fm2_`-prefixed identifiers shorter than the floor are benign.
- **Current contract in core:** no detector on `main` (route: new detector `fly-token`, type `fly_access_token`); no row in `detector-families.md` yet.
- **Open questions:** Q7 (floor); Q9 (`fo1_`); a floor of 100 would also miss no token seen.
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/fly.md); [step-1 table, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016).

#### `square:access-token`

- **Record:** verdict `ready`, tier T1 (R5), researchedAt 2026-09-30, blockedBy `null` (Q8 and the issuance check pending); issues `redact-secret/redact-secret#1014`.
- **Shape:** traditional access token `EAAA` + exactly 60 `[A-Za-z0-9_-]` (64 in all); production OAuth application secret `sq0csp-` + 43 or 44 `[A-Za-z0-9_-]`; sandbox secret `sandbox-sq0csb-` + 43. JWT-format access tokens stay with `jwt` (R7).
- **Sources:** T1 by R5: Square's docs examples and the provider's generated SDK fixtures, corroborated by trufflehog, gitleaks and a Veles request at T2. The provider says not to validate token length, and its own examples disagree (`EAAl` + 59, 43 against 44), so the conflicting shapes are left unclaimed.
- **Issuance:** recommended, structure only (production and sandbox access token, refresh token, OAuth application secret).
- **Collisions:** Meta `EAA` Graph tokens (far longer, so the boundary rejects them), lowercase Docker digests, almost-constant Base64 blobs; `sq0idp-` and the other application ids are public (Q5). The family shrinks as Square moves to JWTs.
- **Current contract in core:** no detector on `main` (route: new detector `square-token`, types `square_access_token` and `square_oauth_application_secret`); no row in `detector-families.md` yet.
- **Open questions:** Q8 (R5 when the provider disclaims length; recommended yes); Q5.
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/square.md); [step-1 table, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820).

#### `ory:network-api-key`

- **Record (siblings):** verdict `ready`, tier T1, researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Record (admin keys):** verdict `issuance-gated`, tier T2, researchedAt 2026-09-30, blockedBy `no source gives the body length or alphabet of ory_pat_, ory_apikey_ or ory_wak_; one project key and one workspace key checked for structure only`.
- **Shape (siblings):** `ory_st_` (Kratos session token) + exactly 32 `[A-Za-z0-9]`; `ory_at_`, `ory_rt_`, `ory_ac_` (Hydra OAuth2 tokens) + a key of at least 43 `[A-Za-z0-9_-]` + `.` + exactly 43 `[A-Za-z0-9_-]` (a two-segment token, so not a JWT). **Admin keys:** prefix only.
- **Sources:** T1 under R1 and R9 for the siblings: the Kratos generator and the `randx` alphabet, the fosite HMAC strategy (alphabet, separator, signature width, 43 floor), and Ory's docs and changelog for the prefixes. The admin keys have the prefix from docs and the provider's Terraform README (placeholders only) and no body; Ory Talos is another product with a different layout and is not used to fill the gap.
- **Issuance:** required only for the admin keys, structure only.
- **Collisions:** `ory_kratos_session` and similar cookie names fail every body grammar; JWT access tokens carry no prefix and stay with `jwt`; enterprise projects can set a custom OAuth2 prefix (accepted false negative); `ory_lo_` logout tokens are left out of the first contract.
- **Current contract in core:** no detector on `main` (route: new detector `ory-token`, types `ory_session_token` and `ory_oauth2_token`, siblings only); no row in `detector-families.md` yet.
- **Open questions:** the admin-key body (no ruling covers a policy floor for Ory).
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/ory.md); [step-1 table, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540).

#### `mercury:api-token`

- **Record:** verdict `issuance-gated`, tier T2, researchedAt 2026-09-30, blockedBy `body width rests on one provider example with no bound; Q6 (extended) or one Read Only and one Read and Write token checked for structure only`; issues `redact-secret/redact-secret#1014`.
- **Shape:** optional `secret-token:` scheme + `mercury_production_` (sandbox is scanner-only) + a 3 to 6 letter type tag (`wma` documented, `rma` inferred) + `_` + about 45 alphanumerics + the literal reversed suffix `_yrucrem`. The body width is one docs example repeated in the provider's OpenAPI text; third-party sightings of 46 contradict an exact 45.
- **Sources:** T1 for the prefix and suffix by R4 (docs example); the body is T2 (scanner rules look derived from one source). No provider SDK fixtures exist, so R5 is not met.
- **Issuance:** the way to unblock it without a ruling: one Read Only and one Read and Write token, structure only.
- **Collisions:** `bearer-token` already redacts the documented `secret-token:` form (RFC 8959 scheme), so a detector would add the bare form and attribution, and must not double report.
- **Current contract in core:** no provider detector on `main`; the `secret-token:` form is redacted through `bearer-token`.
- **Open questions:** Q6 extended to a single provider example repeated in the provider's own API description; the sandbox environment word and the Read Only and Custom tags have no provider source.
- **Research log:** [handoff](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/mercury.md); [step-1 table, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820).
