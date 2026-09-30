# Research candidates that are not taxonomy families yet

Issue [#860](https://github.com/redact-secret/redact-secret/issues/860) researched 50 provider credential candidates, and its [final disposition](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) gives each one a disposition. The 31 candidates below have no provider dossier, because `dossiers:check` requires every dossier provider to exist in `taxonomy.json` and none of these does. The six READY rows (daytona, clickhouse-cloud, nvidia, browserbase, cerebras, runpod) were promoted to taxonomy families with their own dossiers by [benchmarks#464](https://github.com/redact-secret/redact-secret-benchmarks/issues/464) (Beta.12), with the product counterparts redact-secret#970 to #975, so they are no longer listed here. Adding one to the taxonomy is the promotion step, a family-intake change, and it is outside the scope of the dossier work. Until then the research stays in the linked core evidence. Several are not distinct families at all: 23 are `generic coverage sufficient`, two extend existing families and one is pending-unsupported. Only the distinct-family candidates could become taxonomy families, and their readiness is recorded per row (state as of 2026-09-28; issue #860 is still open; the five gated rows `baseten`, `weaviate`, `cartesia`, `arcade` and `planetscale` were re-researched under [#1012](https://github.com/redact-secret/redact-secret/issues/1012) on 2026-09-29, verdicts unchanged: BLOCKED, and date-gated for Baseten).

The 40 candidates of issue [#1014](https://github.com/redact-secret/redact-secret/issues/1014) that are not families yet are recorded in [the #1014 section](#issue-1014-candidates-beta12-broad-discovery-second-50) below, in the dossier vocabulary.

| candidate | tier | disposition | readiness | reason / blocker | record |
| --- | --- | --- | --- | --- | --- |
| `fal:api-key` | C | extend existing family | n/a | no provider anchor; extended in Beta.11: #919 added the `FAL_KEY` name and the `Authorization: Key` scheme, and #918 fixed the Bearer span for `id:secret` | [fal-contextual-gap.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/fal-contextual-gap.md) |
| `modal:token-secret` | C | generic coverage sufficient | n/a | the `as-` prefix is too generic for bare detection; `MODAL_TOKEN_SECRET=` is covered by context | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `baseten:api-key` | A | distinct family | DATE-GATED | no `b10_` key exists before 2026-10-01 15:00 GMT; docs re-checked 2026-09-29 (regex, cutoff sentence and placeholders unchanged), post-date structure checklist prepared, no ruling made | [baseten.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/baseten.md); 2026-09-29 re-research: [1012/baseten.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/baseten.md) |
| `sambanova:cloud-api-key` | C | generic coverage sufficient | n/a | unprefixed UUID, empirical only | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `deepinfra:api-token` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `qdrant:cloud-api-key` | C | generic coverage sufficient | n/a | documented only as a JWT (R7) | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `weaviate:cloud-api-key` | A | distinct family | ISSUANCE-GATED | WCD issuance of the OSS generator format not accepted as proven (researched 2026-09-28); #1012 found the provider notebook that printed two 88-character keys uses `connect_to_local`, so it gives no WCD link, and no provider source connects console-issued keys to the open-source generator | [weaviate.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/weaviate.md); 2026-09-29 re-research: [1012/weaviate.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/weaviate.md) |
| `upstash:redis-rest-token` | C | generic coverage sufficient | n/a | no literal prefix (R4); the read-only sibling has no lexical marker | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `cartesia:api-key` | B | distinct family | ISSUANCE-GATED | `.` separator and segment lengths come from a comment only; drift suspected; #1012 found four peer and third-party rules for an undotted `sk_car_` + 20 body that contradict the provider's dotted test fixtures, plus one staff statement, so the shape is still unsettled | [issuance-research/cartesia.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/cartesia.md); 2026-09-29 re-research: [1012/cartesia.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/cartesia.md) |
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
| `arcade:api-key` | B | distinct family (`arc_proj_` only) | ISSUANCE-GATED | sub-prefix, length and alphabet unknown (placeholders only); bare `arc_` is shared by at least 3 issuers and not selected; #1012 added one placeholder and a docs statement that read-only project keys exist, no new T1 fact | [issuance-research/arcade.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/arcade.md); 2026-09-29 re-research: [1012/arcade.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/arcade.md) |
| `portkey:api-key` | C | generic coverage sufficient | n/a | no format | [disposition.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) |
| `braintrust:api-key` | C | generic coverage sufficient | n/a | `sk-` + 40 or more is T1 (R2) but has no signal independent of legacy OpenAI; `bt-st-` is an open lead | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `mongodb-atlas:programmatic-api-key` | C | generic coverage sufficient | n/a | unprefixed UUID; `mdb_sa_sk_` is a retained sibling lead | [tier-b-rerank.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/tier-b-rerank.md) |
| `planetscale:service-token` | B | distinct family | ISSUANCE-GATED | today's suffix length and alphabet; the 2022 staff range was not accepted; #1012 found third-party evidence widening the doubt about a fixed 43 (Kingfisher 32 to 64) and a 2021 provider fixture with no prefix, but no provider source on today's length | [issuance-research/planetscale.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/planetscale.md); 2026-09-29 re-research: [1012/planetscale.md](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/planetscale.md) |
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

### Wave B: ruling- or policy-gated (no step-3 record yet)

Each row has a step-1 research section (linked by comment) and a step-4 disposition. A step-3 handoff is the next action once the gate clears. Shapes are schematic.

| candidate | verdict | tier | step-4 disposition | gate | research |
| --- | --- | --- | --- | --- | --- |
| `azure:storage-account-key` | ready | T1 (if Q2) | BLOCKED | Q2 | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `azure:ai-services-key` | ready | T1 (if Q2) | BLOCKED | Q2; route is extending the existing CASK scanner, not a new family | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `datastax:astra-db-application-token` | issuance-gated | T2 (T1 if Q3) | BLOCKED | Q3; else issuance of the 64-byte tail | [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540) |
| `tailscale:api-key` | issuance-gated | T2 | BLOCKED | policy: is a floor-only grammar acceptable; else issuance of the secret length | [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016) |
| `circleci:personal-access-token` | ready | T2 | BLOCKED | policy: alphabet `[A-Za-z0-9]` for the 40-byte segment; `CCIPRJ_` layout unconfirmed | [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016) |
| `onesignal:rich-auth-token` | ready | T2 (T1 if R2 authorship holds) | BLOCKED | R2 authorship check of the provider-org scanning rule | [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540) |
| `stytch:project-secret` | ready | T2 (T1 if Q6) | BLOCKED | Q6 | [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540) |
| `asana:personal-access-token` | not-found | T2 | BLOCKED | Q4: the provider documents the format as opaque | [step-1, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282) |

#### `azure:storage-account-key`

- **Record:** verdict `ready`, tier T1 provided Q2 is ruled yes (T2 otherwise), researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** 88 standard-Base64 characters: 76 + the literal signature `+ASt` + 5 + one of `A`, `Q`, `g`, `w` + `==`, with a Marvin32 checksum embedded. The legacy 86-character + `==` form has no signature and stays in context.
- **Sources:** provider-authored scanner code in Microsoft's [`security-utilities`](https://github.com/microsoft/security-utilities/blob/638ad20eb4d446319a31e9c0ed293d087b4ffa55/src/Microsoft.Security.Utilities.Core/PreciselyClassifiedSecurityKeys/Azure64ByteIdentifiableKey.cs) (R2 if Q2 is yes) and a Microsoft Learn page that documents the 88-character length and the checksum but not `+ASt` ([Purview SIT](https://learn.microsoft.com/en-us/purview/sit-defn-azure-storage-account-access-key)). GitHub's partner list has the type with a validity check. trufflehog, betterleaks and noseyparker are contextual and do not anchor on `+ASt`.
- **Issuance:** not attempted; the gate is a ruling, not a sample.
- **Collisions:** overlaps the `connection-string` (`azure`) detector inside `AccountKey=`, so one finding must win; a standalone run matching the signature and tail has a very low benign rate.
- **Current contract in core:** no detector on `main`; the embedded form is covered by `connection-string` only.
- **Open questions:** Q2 (Microsoft `security-utilities` as R2); Q1 (whether a failed Marvin32 check ever rejects).
- **Research log:** [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `azure:ai-services-key`

- **Record:** verdict `ready`, tier T1 provided Q2 is ruled yes (T2 otherwise), researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** 84 base62 characters of Microsoft's identifiable legacy key layout: 52 + the literal `JQQJ99` + 1 + one of `A` to `L` + 12 + `AAA` and a service character + the literal provider signature `ACOG` + 4 checksum characters. One family covers AI Services, Azure OpenAI and Cognitive Services keys. The legacy 32-hex key is indistinct and stays generic.
- **Sources:** provider-authored scanner code in [`security-utilities`](https://github.com/microsoft/security-utilities/blob/638ad20eb4d446319a31e9c0ed293d087b4ffa55/src/Microsoft.Security.Utilities.Core/PreciselyClassifiedSecurityKeys/LegacyCommonAnnotatedSecurityAccessKey.cs#L13-L21) (2025-05-14, R2 if Q2 is yes); no Learn page states the 84-character grammar (Purview documents only the 32-hex legacy form). GitHub's partner list has three Azure key types.
- **Issuance:** not attempted; the gate is a ruling.
- **Collisions:** the same layout as the existing `azure-devops-personal-access-token` scanner (whose provider signature is `AZDO`); the two signatures are disjoint, so the natural route is to extend that scanner with `ACOG`, not add a family.
- **Current contract in core:** no `ACOG` detector on `main`; the Azure DevOps CASK scanner exists.
- **Open questions:** Q2; Q1 (lexical or checksum-checked).
- **Research log:** [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `datastax:astra-db-application-token`

- **Record:** verdict `issuance-gated`, tier T2 (T1 with a policy tail if Q3 is yes), researchedAt 2026-09-30, blockedBy `the alphabet of the 64-byte tail has no provider source; Q3 (policy alphabet) or one token checked for structure only`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `AstraCS:` + 24 letters + `:` + 64 characters, 97 in all. The tail is commonly reported as hex but no provider source fixes its alphabet.
- **Sources:** T1 for the prefix and the exact lengths: the provider's [`astra-cli` validator](https://github.com/datastax/astra-cli/blob/3d746a51c08c07696c8198ea65fb667625677564/src/main/java/com/dtsx/astra/cli/core/models/AstraToken.java#L27-L41) (2026-08) and its token docs; the middle alphabet by docs example.
- **Issuance:** the fallback if Q3 is refused: one token, structure only.
- **Collisions:** none; the prefix plus colon structure is unique.
- **Current contract in core:** no detector on `main`.
- **Open questions:** Q3 (R10 extended to Astra with a policy alphabet `[A-Za-z0-9]`, at least as wide as hex).
- **Research log:** [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `tailscale:api-key`

- **Record:** verdict `issuance-gated`, tier T2, researchedAt 2026-09-30, blockedBy `the secret length is T2 (placeholders only); accept a floor-only grammar by policy or check one key for structure only`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `tskey-` + a type (`api`, `auth`, `client`, `scim`, `webhook`) + `-` + a key id + `-` + a secret, all alphanumeric segments. Docs examples show a 12-character id and a 32-character secret, but the secret is placeholder-filled.
- **Sources:** prefix and type set T1 ([Tailscale KB 1277](https://tailscale.com/kb/1277/key-prefixes); the CLI's `HasPrefix` check and a redaction pattern in [`tailscale`](https://github.com/tailscale/tailscale/blob/a00fd3273b3865ec587d0c4b36ab5debf358545e/cmd/tailscale/cli/cli.go#L606-L631)); segment lengths T2.
- **Issuance:** the fallback if a floor-only grammar is refused: one key, structure only.
- **Collisions:** placeholders such as `tskey-auth-xxxx` and test strings are common, so a minimum secret length or an entropy floor is needed.
- **Current contract in core:** no detector on `main`.
- **Open questions:** whether a floor-only grammar is acceptable; the minimum secret length.
- **Research log:** [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `circleci:personal-access-token`

- **Record:** verdict `ready`, tier T2, researchedAt 2026-09-30, blockedBy `null` (a policy alphabet decision comes first); issues `redact-secret/redact-secret#1014`.
- **Shape:** `CCIPAT_` + 22 alphanumerics + `_` + 40 characters (70 in all); `CCIPRJ_` project tokens presumably share the layout (no source). Legacy unprefixed 40-hex tokens stay generic.
- **Sources:** prefix and segment lengths T1 from the provider's CLI placeholder, which sets its own input limit ([`circleci-cli`](https://github.com/CircleCI-Public/circleci-cli/blob/acf7852dad47f1e9af5310f6b11a8e05588d3550/internal/ui/token.go#L35-L51)); the 40-byte segment's alphabet is hex only in trufflehog (T2). The GitHub partner list has four CircleCI types.
- **Issuance:** not required for T2.
- **Collisions:** none; both prefixes are distinctive. A lowercase `ccipat_` form in the provider's OAuth docs may be a separate token.
- **Current contract in core:** no detector on `main`.
- **Open questions:** policy ruling on `[A-Za-z0-9]` for the 40-byte segment (keeps T1 length); whether `CCIPRJ_` shares the layout.
- **Research log:** [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016); first named as a follow-up in the #523 CI ranking; [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `onesignal:rich-auth-token`

- **Record:** verdict `ready`, tier T2 until authorship is verified (T1 under R2 if it holds), researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `os_v2_app_` (app key) or `os_v2_org_` (organization key) + a lowercase alphanumeric body with a floor of 20 and no published length. Legacy UUID REST keys stay generic.
- **Sources:** a provider-organization scanning rule in [`onesignal-agent-plugin`](https://github.com/OneSignal/onesignal-agent-plugin/blob/75c08e9ee30e055765c0a475c3dd39769cbde543/scripts/scan_secrets.py#L29) (2026-08-13; staff authorship inferred from the org repository, not verified) and the provider's key docs (app prefix only; the organization steps appear to contain a copy error).
- **Issuance:** not required for the floor-only grammar.
- **Collisions:** none; `os_v2_app_` is distinctive.
- **Current contract in core:** no detector on `main`.
- **Open questions:** whether the rule's author is OneSignal staff (clean R2); the exact body length.
- **Research log:** [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `stytch:project-secret`

- **Record:** verdict `ready`, tier T2 (T1 if Q6 is yes), researchedAt 2026-09-30, blockedBy `null`; issues `redact-secret/redact-secret#1014`.
- **Shape:** `secret-live-` or `secret-test-` + 36 base64url-like characters ending in `=` (48 in all). `public-token-*` and `project-*` are not secrets and stay unclaimed (Q5).
- **Sources:** prefix, length and alphabet by one example repeated in three provider SDK READMEs ([stytch-node](https://github.com/stytchauth/stytch-node/blob/a59868d7e970b44fb96e61bf38d3ddd884d4238a/README.md#L67)); no docs response example or server generator was found. trufflehog's rule is consistent (T2).
- **Issuance:** not attempted.
- **Collisions:** `secret-test-` appears in generic test strings, so the exact body shape must be required; whether the trailing `=` is always present is open.
- **Current contract in core:** no detector on `main`.
- **Open questions:** Q6 (SDK README examples as R5).
- **Research log:** [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `asana:personal-access-token`

- **Record:** verdict `not-found`, tier T2, researchedAt 2026-09-30, blockedBy `null` (pending Q4); issues `redact-secret/redact-secret#1014`.
- **Shape:** by era: a legacy `0/` or `1/` form, and since October 2023 `2/` + a digit user id + `/` + a digit token id + `:` + 32 hex. No provider source states the grammar.
- **Sources:** the provider's docs say tokens are opaque and formats may change without notice ([Asana docs](https://developers.asana.com/docs/personal-access-token), 2026-01-22), and staff withheld the new grammar; the shape is from trufflehog's rule, a forum and the GitHub partner list (T2).
- **Issuance:** not attempted.
- **Collisions:** a digit-slash-digit prefix is ordinary text (dates, paths), so only the anchored `:` + 32-hex tail is safe.
- **Current contract in core:** no detector on `main`; contextual detection and generic coverage apply.
- **Open questions:** Q4 (refuse, or allow at T2 with a context keyword when the provider disclaims a grammar).
- **Research log:** [step-1, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282); [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

### Wave C: T2 families (eligible now, no handoff yet)

Step 4 found each of these eligible for a distinct T2 family under the Together and Tavily precedent in [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md): the prefix is provider-documented and distinctive, but length or alphabet comes from scanner rules only. A T2 handoff is the next action and needs no ruling. Shapes are schematic.

| candidate | verdict | tier | step-4 disposition | gate | research |
| --- | --- | --- | --- | --- | --- |
| `zuplo:consumer-api-key` | ready | T2 | T2 FAMILY | Q1 (CRC32) | [step-1, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282) |
| `flutterwave:secret-key` | ready | T2 | T2 FAMILY | policy alphabet for the 32-byte segment | [step-1, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820) |
| `shippo:api-token` | ready | T2 | T2 FAMILY | none | [step-1, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820) |
| `duffel:access-token` | ready | T2 | T2 FAMILY | none | [step-1, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820) |
| `brevo:api-key` | ready | T2 | T2 FAMILY | none | [step-1, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820) |
| `mailersend:api-token` | ready | T2 | T2 FAMILY | floor by policy; `mssp.` prose collision | [step-1, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820) |
| `airtable:personal-access-token` | ready | T2 | T2 FAMILY | secret half required | [step-1, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282) |
| `contentful:personal-access-token` | ready | T2 | T2 FAMILY | 43 against 46 eras to settle | [step-1, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282) |

All eight records below share: researchedAt 2026-09-30, blockedBy `null`, issues `redact-secret/redact-secret#1014`, issuance not attempted, no detector on `main`, research log = the step-1 comment linked in the table plus the [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `zuplo:consumer-api-key`

- **Shape:** `zpka_` + a 32-character lowercase alphanumeric body + `_` + 8 lowercase hex (a CRC32 of the body by one scanner's validation); the provider documents only the three-part structure.
- **Sources:** prefix and structure T1 by R4 ([Zuplo docs](https://zuplo.com/docs/concepts/api-keys) and a masked placeholder in a [provider README](https://github.com/zuplo/zuplo/blob/4e8c0553e3cc79dffc03f68804774ee6c3f1dcd5/examples/basic-api-gateway/README.md#L59)); lengths, alphabet and the CRC32 are T2 (betterleaks, Kingfisher, GitHub partner list). One provider demo string has a 33-character body, which may be a typo.
- **Collisions:** none.
- **Open questions:** Q1 (verify the CRC32 as a reject-only post-check); a T1 length would need Zuplo's closed-source generator.

#### `flutterwave:secret-key`

- **Shape:** `FLWSECK-` (live) or `FLWSECK_TEST-` (test) + 32 characters (lowercase hex by scanners) + a literal `-X` suffix. The public `FLWPUBK` sibling is excluded, and the derived encryption key (`FLWSECK` + 12) is optional.
- **Sources:** prefix T1 by R4 and R6 ([Flutterwave docs placeholders](https://developer.flutterwave.com/docs/authentication) and [Node SDK code](https://github.com/Flutterwave/Node-v3/blob/537f9f4455f922a879e4f088cf0f596621c3517c/lib/security.js#L11)); the 32 width is consistent across docs and SDK placeholders; the alphabet is scanner-only (T2).
- **Collisions:** none; `FLWPUBK` is public (Q5).
- **Open questions:** a policy alphabet for the 32-byte segment (the hex alphabet has no provider source).

#### `shippo:api-token`

- **Shape:** `shippo_live_` or `shippo_test_` + 40 lowercase hex by scanners.
- **Sources:** prefix T1 ([Shippo docs](https://docs.goshippo.com/docs/guides_general/authentication/) and an SDK `startsWith("shippo_")` hook under R6); length and alphabet T2 (trufflehog, gitleaks); provider fixtures use short stubs.
- **Collisions:** none.
- **Open questions:** a provider source for the 40-hex body.

#### `duffel:access-token`

- **Shape:** `duffel_test_` or `duffel_live_` + 43 characters from `[A-Za-z0-9_-]` by scanners.
- **Sources:** the test prefix is T1 ([Duffel docs](https://duffel.com/docs/api/overview/test-mode)); `duffel_live_`, the length and the alphabet are T2 (trufflehog, gitleaks, GitHub partner list). The provider SDKs carry no token examples.
- **Collisions:** none; the vendor prefix is distinctive.
- **Open questions:** a provider source for the 43 length.

#### `brevo:api-key`

- **Shape:** `xkeysib-` + 64 lowercase hex + `-` + 16 alphanumerics by scanners (trufflehog uses a looser 81-character class); the SMTP sibling `xsmtpsib-` has no public regex.
- **Sources:** prefix T1 by R4 (a masked docs response example and SDK fixtures, [Brevo API reference](https://developers.brevo.com/reference/create-an-api-key-for-a-sub-account)); the structure is scanner-only (T2); the `xsmtpsib-` prefix is T2 (partner list).
- **Collisions:** none.
- **Open questions:** a provider source for the 64-and-16 layout and for the SMTP key shape.

#### `mailersend:api-token`

- **Shape:** `mlsn.` + an alphanumeric body of unknown length (betterleaks 30 to 100; 64 hex is commonly seen). A sibling `mssp.` appears in a provider-authored rule and is probably the SMTP password.
- **Sources:** prefix T1 by R2 and R4 (a provider-authored `git secrets` rule in [`mailersend-nodejs`](https://github.com/mailersend/mailersend-nodejs/blob/410d24d084cf0e07fdfcf4eb152c98cb01bbf663/lefthook.yml#L11-L12), 2026-09-17, and the CLI README); no provider source gives a length.
- **Collisions:** `mssp.` collides with MSSP prose, so it needs a long body and a confirmed role.
- **Open questions:** the body length and alphabet; whether `mssp.` is the SMTP password.

#### `airtable:personal-access-token`

- **Shape:** `pat` + 14 alphanumerics (the token id, 17 in all, a non-secret identifier) + `.` + 64 lowercase hex. The secret half must be required.
- **Sources:** the id half is T1 by R5 ([Airtable docs](https://airtable.com/developers/web/guides/personal-access-tokens) and the provider's API description, whose id grammar is three letters + 14); the 64-hex secret half is scanner-only (T2), and Airtable says to treat tokens as opaque, variable-length strings.
- **Collisions:** a bare `pat` + 14 id is public.
- **Open questions:** whether to accept a longer secret half given the variable-length caveat.

#### `contentful:personal-access-token`

- **Shape:** `CFPAT-` + 43 characters from `[A-Za-z0-9_-]` by scanners; a 2017 provider fixture has 46 lowercase characters. A `cfw-` web-token sibling exists in the docs.
- **Sources:** prefix T1 by R4 (Contentful's [audit-log docs](https://www.contentful.com/developers/docs/tutorials/general/audit-logs/) spell it `cfpat-`; the CLI docs use the uppercase form); current length and alphabet T2 (trufflehog, GitHub partner list), contradicted for the older era by the [provider fixture](https://github.com/contentful/contentful-management.py/blob/a2aa04a6c8b3556d450c1c799ebb2c1ba30ad422/fixtures/pat/create.yaml).
- **Collisions:** none for `CFPAT-`.
- **Open questions:** 43 against 46 eras; whether a current `cfw-` token deserves a sibling family.

### Wave D: evidence- or issuance-blocked, deferred or generic

Thirteen candidates have no dedicated family now. For the evidence- and issuance-blocked ones the prefix is usually provider-attested but no provider source states a body length, so a detector would need an arbitrary floor. Their unblocking step is one provider source for the length, or one issued-and-revoked key checked for structure only (the model is benchmarks#526, and a benchmarks issue for these is drafted in step 5 but not filed). Shapes are schematic.

| candidate | verdict | tier | step-4 disposition | gate | research |
| --- | --- | --- | --- | --- | --- |
| `hubspot:private-app-access-token` | date-gated | T2 | DEFERRED | the format is being replaced by Service Keys; revisit after the migration | [step-1, #21 to #30](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447282) |
| `elastic:cloud-api-key` | issuance-gated | T2 | BLOCKED (evidence) | a T1 length for `essu_` | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `llamaindex:llama-cloud-api-key` | issuance-gated | T2 | BLOCKED (evidence) | a T1 length | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `figma:personal-access-token` | issuance-gated | T2 | BLOCKED (evidence) | a T1 length | [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016) |
| `harness:personal-access-token` | issuance-gated | T2 | BLOCKED (evidence) | segment lengths | [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016) |
| `jina:api-key` | issuance-gated | T2 | BLOCKED (evidence) | a T1 length | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `kaggle:api-token` | issuance-gated | T2 | BLOCKED (issuance) | one issued token, structure only | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `devcycle:server-sdk-key` | issuance-gated | T2 | BLOCKED (issuance) | one issued key, structure only | [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540) |
| `mixedbread:api-key` | issuance-gated | T3 | BLOCKED (issuance) | one issued key, structure only | [step-1, #01 to #10](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900446812) |
| `dbt-cloud:service-token` | issuance-gated | T3 | BLOCKED (issuance) | one issued token per prefix (`dbtc_`, `dbtu_`), structure only | [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016) |
| `launchdarkly:access-token` | rejected | T2 | DEFERRED | `api-` and `sdk-` + UUID collide with resource ids; context-gated coverage only, not a family | [step-1, #31 to #40](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447540) |
| `octopus-deploy:api-key` | rejected | T2 | DEFERRED | `API-` collides with ticket keys and gateway names; context-gated at best | [step-1, #11 to #20](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447016) |
| `gocardless:access-token` | rejected | T2 | GENERIC | `live_` and `sandbox_` are generic words; no family | [step-1, #41 to #50](https://github.com/redact-secret/redact-secret/issues/1014#issuecomment-5900447820) |

All thirteen records below share: researchedAt 2026-09-30, issues `redact-secret/redact-secret#1014`, issuance not attempted, no detector on `main` (generic and contextual coverage apply), research log = the step-1 comment linked in the table plus the [step-4 disposition](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md#step-4-disposition-of-all-50-candidates).

#### `hubspot:private-app-access-token`

- **Record:** verdict `date-gated`, tier T2, blockedBy `legacy private-app token format is being replaced by Service Keys; revisit once the migration lands and the new credential shape is published`.
- **Shape:** `pat-` + a data-centre code (`na1`, `eu1`; others such as `na2`, `na3`, `ap1` appear in HubSpot's CLI host list) + `-` + a UUID-shaped body (8-4-4-4-12 hex). The Service Key replacement has no known format.
- **Sources:** a HubSpot community-manager statement that the `pat-` format is being replaced ([HubSpot Community](https://community.hubspot.com/t/private-app-access-token-format-change/151661), prefix only, staff statement under R3); trufflehog and the GitHub partner list (T2).
- **Collisions:** `pat-` can sit inside `glpat-` without a boundary, so a boundary anchor is required.
- **Open questions:** which region codes exist beyond `na1` and `eu1`; what the Service Key looks like.

#### `elastic:cloud-api-key`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the body length of essu_ keys; a provider source or one key checked for structure only`.
- **Shape:** `essu_` + a Base64 body (Veles says 92 plus optional padding; betterleaks says 60 to 200 URL-safe characters). Kibana treats every credential that starts `essu_` as an Elastic Cloud UIAM credential, API keys and Bearer access tokens alike, with an `essu_dev_` mock variant. Elasticsearch stack API keys are unprefixed Base64 of `id:api_key` and stay generic.
- **Sources:** prefix T1 by R6 ([Kibana `uiam/utils.ts`](https://github.com/elastic/kibana/blob/f65836545184f238efa7827b37c57dc3c80a6412/src/core/packages/security/server/src/uiam/utils.ts#L12-L20), 2026-09-17); length and alphabet from third-party scanners that disagree (T2).
- **Collisions:** `essu_` is unique; redacting every `essu_`-prefixed credential is safe.
- **Open questions:** an Elastic doc or code path that states the `essu_` body length.

#### `llamaindex:llama-cloud-api-key`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the length or alphabet after llx-; a provider source or one key checked for structure only`.
- **Shape:** `llx-` + a body of about 48 alphanumerics (CredSweeper fixes 48; betterleaks allows 44 to 52). Provider material shows only the placeholder.
- **Sources:** prefix T1 by R4 ([llama_cloud_services README](https://github.com/run-llama/llama_cloud_services/blob/f385e96ab82ddb88330277c34394546398c8bed0/py/llama_parse/README.md#L54), 2026-03-24); length and alphabet T2 (betterleaks, CredSweeper).
- **Collisions:** a short 4-byte prefix.
- **Open questions:** a T1 length.

#### `figma:personal-access-token`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the length or alphabet after figd_; a provider source or one token checked for structure only`.
- **Shape:** `figd_` + about 40 characters from `[A-Za-z0-9_-]`; a plan token `figp_` is a separate shape (40 to 54). The legacy token is UUID-like and unprefixed.
- **Sources:** the prefix as a test placeholder in provider code ([`figma/code-connect`](https://github.com/figma/code-connect/blob/204e84ada6500dbcfbf637f60c4d86d9e3928eee/cli/src/connect/__test__/e2e/test_wizard_e2e.ts#L44), 2025-09-04, R4); Figma's developer docs state no format; length from trufflehog (T2).
- **Collisions:** the legacy UUID-like form collides with UUIDs.
- **Open questions:** a T1 length; whether `figp_` is Figma's documented plan access token.

#### `harness:personal-access-token`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the segment lengths; a provider source or one token checked for structure only`.
- **Shape:** `pat.` or `sat.` + three dot-joined segments (account id, token id, secret), each from `[A-Za-z0-9_-]` by the provider's parser; scanners claim 22, 24 and 20 characters, with a hex middle segment in trufflehog.
- **Sources:** T1 for the prefixes and the segment structure ([`harness/cli` `auth.go`](https://github.com/harness/cli/blob/cfb36aa58bc9010a6396f909aca142f2b4f8ba03/pkg/auth/auth.go#L288-L327), 2026-09-04); lengths T2 (gitleaks, trufflehog); docs show truncated placeholders.
- **Collisions:** `pat.` and `sat.` also appear in code as property paths, so the unbounded grammar is too loose to stand alone.
- **Open questions:** the account id, token id and secret lengths.

#### `jina:api-key`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the length or alphabet after jina_; a provider source or one key checked for structure only`.
- **Shape:** `jina_` + 60 alphanumerics by one third-party rule (noseyparker); provider material shows only a placeholder.
- **Sources:** prefix provider-attested by R4 ([`jina-ai/MCP` README](https://github.com/jina-ai/MCP/blob/5d6eb191a75d8e67b6e01ce427f0cc5c05c800aa/README.md#L8)); length and alphabet T2. The provider's own pages are script-rendered and could not be read.
- **Collisions:** identifiers such as `jina_client` if the body floor were small.
- **Open questions:** a dashboard or docs example showing the full key length.

#### `kaggle:api-token`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the length of KGAT_ tokens; one issued token checked for structure only`.
- **Shape:** `KGAT_` + hex of unknown length (provider placeholder only); a community report says not every new-format token starts `KGAT_`. The legacy `kaggle.json` key is 32 hex with no prefix and stays generic.
- **Sources:** the placeholder in provider docs ([Kaggle/kaggle-skills](https://github.com/Kaggle/kaggle-skills/blob/fd71736386a6000af54e4b925f7458e80f9bc412/kaggle-standardized-agent-exam/SKILL.md#L71), 2026-04-27); no length or alphabet source from any class.
- **Collisions:** `KGAT_` is unique and uppercase.
- **Open questions:** length, alphabet, and whether other new-format tokens have a different prefix.

#### `devcycle:server-sdk-key`

- **Record:** verdict `issuance-gated`, tier T2, blockedBy `no provider source states the body after dvc_server_; one issued key checked for structure only`.
- **Shape:** `dvc_server_` + a body of unknown shape (SDK tests use synthetic UUIDs); legacy keys start `server` without `dvc_`. `dvc_client_` and `dvc_mobile_` keys are client-embedded and stay unclaimed (Q5).
- **Sources:** prefix T1 by R6 (provider SDK checks, for example [`js-sdks` `paramUtils.ts`](https://github.com/DevCycleHQ/js-sdks/blob/ffc52abae48312daf80dd5d462571e8704f0e27a/sdk/js-cloud-server/src/utils/paramUtils.ts#L42-L44)); the GitHub partner list has three DevCycle types without a published regex.
- **Collisions:** low for `dvc_server_`; `DEVCYCLE_SERVER_SDK_KEY=` is not recognized as a credential name by today's contextual detection (measured on `main` 2026-09-29).
- **Open questions:** whether the real body is a UUID or a hash with a version suffix.

#### `mixedbread:api-key`

- **Record:** verdict `issuance-gated`, tier T3, blockedBy `only the mxb_ prefix is known; one issued key checked for structure only`.
- **Shape:** `mxb_` + an unknown body; every provider fixture is a placeholder.
- **Sources:** prefix by R6 (a runtime `startsWith` check in the provider CLI, [`openbread` `config.ts`](https://github.com/mixedbread-ai/openbread/blob/c7925f2cff0da9662bca8dac09d5b8ae8d75dcf2/packages/cli/src/utils/config.ts#L58), 2026-02-19); no length or alphabet source.
- **Collisions:** `mxb_`-prefixed identifiers such as `mxb_client`.
- **Open questions:** length and alphabet.

#### `dbt-cloud:service-token`

- **Record:** verdict `issuance-gated`, tier T3, blockedBy `only the dbtc_ and dbtu_ prefixes are known; one issued token per prefix checked for structure only`.
- **Shape:** `dbtc_` (service token) or `dbtu_` (user personal access token) + an unknown body.
- **Sources:** prefix by R6 (the provider's own credential classifier, [`dbt-platform-auth` `credential.rs`](https://github.com/dbt-labs/dbt/blob/d07f4e28e0c31e3661c8e74e3bdab63bea5292ad/crates/dbt-platform-auth/src/credential.rs#L58-L61), 2026-06-01); docs and tests use short placeholders only.
- **Collisions:** none, but without a length rule a placeholder would match.
- **Open questions:** length and alphabet per prefix.

#### `launchdarkly:access-token`

- **Record:** verdict `rejected` (deliberately not pursued as a family), tier T2, blockedBy `null`.
- **Shape:** `api-` (access token) or `sdk-` (server SDK key) + a lowercase UUID; `mob-` mobile keys are documented as not secret and the client-side id is public (Q5).
- **Sources:** prefix by the provider's CLI heuristic ([`ld-find-code-refs`](https://github.com/launchdarkly/ld-find-code-refs/blob/b757d6722832011678b1a38812798a97fe7fc603/options/options.go#L285-L288), R6); the UUID body is trufflehog-only (T2).
- **Collisions:** high: `api-` and `sdk-` + UUID occur in resource ids and test data.
- **Open questions:** a provider fixture or docs response with a full-length token; until then context-gated coverage only.

#### `octopus-deploy:api-key`

- **Record:** verdict `rejected` (deliberately not pursued as a family), tier T2, blockedBy `null`.
- **Shape:** `API-` + uppercase alphanumerics; scanners disagree on length (26 against 29 to 34) and provider placeholders use 8, 13, 26 and 29.
- **Sources:** prefix by R6 (a runtime `StartsWith("API-")` check in [`OctopusTentacle`](https://github.com/OctopusDeploy/OctopusTentacle/blob/d9b3b3402c6bf7f796e8afd711366a0ab815cbcc/source/Octopus.Manager.Tentacle/TentacleConfiguration/SetupWizard/SetupTentacleWizardModel.cs#L845), 2026-05-26); length contested (T2).
- **Collisions:** high: `API-GATEWAY`, ticket keys such as `API-1234`, header and constant names.
- **Open questions:** the true length (a self-hosted trial key would settle it); context-gated at best.

#### `gocardless:access-token`

- **Record:** verdict `rejected` (generic coverage is sufficient), tier T2, blockedBy `null`.
- **Shape:** `live_` or `sandbox_` + 40 characters from `[A-Za-z0-9_=-]` by scanners.
- **Sources:** a GoCardless staff statement that sandbox tokens begin `sandbox_` ([gocardless-pro-php#54](https://github.com/gocardless/gocardless-pro-php/issues/54#issuecomment-454874930), 2019-01-16, R3); length and alphabet from scanners that also require a `gocardless` keyword (T2).
- **Collisions:** high: `live_` and `sandbox_` are generic words.
- **Open questions:** a provider source for the length; a family would also need `gocardless` context.

### Candidates that map to taxonomy families (#1014)

The other 10 of the 50 candidates (ranks 1 to 10 of the #1014 roll-up) are taxonomy families with a dossier in this folder. Their detectors merged to `main` in redact-secret#1039 (unreleased), and each dossier was refreshed against the frozen record at `3785817`.

| candidate | dossier |
| --- | --- |
| `bitwarden:secrets-manager-access-token` | [`bitwarden.md`](bitwarden.md) |
| `polar:organization-access-token` | [`polar.md`](polar.md) (also `polar:api-credential`) |
| `sonarqube:token` | [`sonarqube.md`](sonarqube.md) (`sonarqube:user-token`, `sonarqube:analysis-token`) |
| `rubygems:api-key` | [`rubygems.md`](rubygems.md) |
| `clojars:deploy-token` | [`clojars.md`](clojars.md) |
| `crates-io:api-token` | [`crates-io.md`](crates-io.md) (also `crates-io:trusted-publishing-token`) |
| `dynatrace:api-token` | [`dynatrace.md`](dynatrace.md) |
| `paddle:api-key` | [`paddle.md`](paddle.md) |
| `honeycomb:api-key` | [`honeycomb.md`](honeycomb.md) (`honeycomb:ingest-key`; the management key stays issuance-gated) |
| `axiom:api-token` | [`axiom.md`](axiom.md) (also `axiom:personal-token`) |
