# Beta.10 credential corpus handoff (#384)

Issue [#384](https://github.com/redact-secret/redact-secret-benchmarks/issues/384), parent
[#283](https://github.com/redact-secret/redact-secret-benchmarks/issues/283). Product
counterparts [redact-secret#862](https://github.com/redact-secret/redact-secret/issues/862)
(Anthropic), [#863](https://github.com/redact-secret/redact-secret/issues/863) (OpenAI admin),
[#864](https://github.com/redact-secret/redact-secret/issues/864) (Bedrock),
[#865](https://github.com/redact-secret/redact-secret/issues/865) (ElevenLabs),
[#867](https://github.com/redact-secret/redact-secret/issues/867) (Together, Tavily) and
[#868](https://github.com/redact-secret/redact-secret/issues/868) (keyword-gated rows); research
[#775](https://github.com/redact-secret/redact-secret/issues/775)-[#779](https://github.com/redact-secret/redact-secret/issues/779)
and [#781](https://github.com/redact-secret/redact-secret/issues/781)-[#789](https://github.com/redact-secret/redact-secret/issues/789).
Layout and conventions: [`docs/specs/beta8-evidence.md`](../../specs/beta8-evidence.md#beta10-slices-384).

This record measures and records; it asserts no product output and moves no support status. Every
value is independently authored from a public `synthetic` seed (or built from synthetic bytes),
never issued, provider-example or scanner-derived, and the finished credential shapes exist only in
the gitignored generated corpus (`npm run fixtures:generate` writes `fixtures/generated/beta8-384a.json`
to `beta8-384e.json`). The only committed literals are the 26 static calibration rows in
`corpora/development/shadow-scoring-authored.json`, written with the existing first-character `\u`
escape so no detector shape appears in the Git blob.

## Inputs

- Benchmark base: `develop` at `45931d0` (the repository's integration branch; `main` trails it by 45 commits and lacks the Beta.10 substrate).
- Product contract baseline: `91167e4`. Registry pin (`benchmarks/detectors.json`): `0af4cb83b571baa86d27a678a351ece2ebc1f3cb`, unchanged.
- Peers for every measurement here: gitleaks 8.30.1, trufflehog 3.97.4 (provisioned from `scanners/peer-checksums.json`; the machine's own trufflehog self-updated to 3.97.6 and was not used). Redact Secret: published `@redact-secret/core` 0.1.0-beta.9. Mode: published.
- The product branches `feat/862-anthropic-prefixes` (`f31a2c5`) and `feat/863-openai-admin-contract` (`7dca677`) were read for their decisions: shared `anthropic_api_key` type with a `>= 20` byte `[A-Za-z0-9_-]` body superset; OpenAI `sk-admin-` contracted at T2 under the 58/74 grammar, marker-less bodies out of contract.

## Dispositions

| Research | Candidate | Disposition here | Where it lives |
| --- | --- | --- | --- |
| #775 | `anthropic:admin-api-key` | Distinct arrival family `anthropic-admin01-key`, T1 prefix | `384a` |
| #776 | `anthropic:compliance-access-key` | Distinct arrival family `anthropic-api01-key`, T1 prefix, body unspecified | `384a` |
| #777 | `openai:admin-api-key` | Distinct arrival family `openai-admin-api-key`, T2 | `384a` |
| #778 | `aws-bedrock:long-term-api-key` | Arrival family `aws-bedrock-long-term-api-key`, T2, T1 candidate | `384b` |
| #779 | `aws-bedrock:short-term-api-key` | Arrival family `aws-bedrock-short-term-api-key`, T2, T1 candidate | `384b` |
| #788 | `elevenlabs:api-key` | Arrival family `elevenlabs-api-key`, T2, T1 candidate | `384c` |
| #783 | `together:api-key` | Arrival family `together-api-key`, T2 pending corroboration | `384d` |
| #786 | `tavily:api-key` | Arrival family `tavily-api-key`, T2 pending corroboration | `384d` |
| #781 | `mistral:api-key` | Context-gated arrival family, T2 | `384e` |
| #782 | `cohere:api-key` | Context-gated arrival family, T2 | `384e` |
| #789 | `deepgram:api-key` | Context-gated arrival family, T2 | `384e` |
| #784 | `ai21:api-key` | Context-gated arrival family, T0 (no scanner rule, one observation) | `384e` |
| #787 | `exa:api-key` | Context-gated arrival family, T0, no value grammar | `384e` |
| #780 | `mistral:realtime-client-token` | Pending, no corpus: taxonomy row only | `benchmarks/support/taxonomy.json` |
| #785 | `voyage-ai:api-key` | Pending, no corpus: taxonomy row only | `benchmarks/support/taxonomy.json` |

The five "generic sufficient" rows (#781, #782, #784, #787, #789) were first recorded as negative
dispositions and then, on maintainer direction extending #384, given keyword-gated corpora. Their
contracts do not fabricate a grammar: a value is a positive only beside a provider name, host or SDK
constructor, and a bare 32- or 40-character run is never one. #780 and #785 stay pending because no
issued-key evidence states a body; their taxonomy rows carry `supportStatus: pending`, the sources and
the reason, which is this repository's durable place for a blocked contract (no fixture, no detector
count). Together and Tavily stay T2 until the hands-on issuance checklists in #783 and #786 are done.

## Contracts and shapes

The tier column is the contract tier. `T1 cand.` means the candidate T1 source is recorded on the
contract (`candidateSource`) and promotion is a maintainer ruling, a tier change and a `providerSource`,
with no fixture edit.

| Family (arrival id) | Tier | Supported shape | Excluded or unasserted |
| --- | --- | --- | --- |
| `anthropic-api01-key` | T1 (prefix) | `sk-ant-api01-` + `[A-Za-z0-9_-]{20,}` (floor is the shipped api03 rule, recorded as an assumption); positives carry 93 + `AA` | Body length, alphabet and `AA` tail (no source); `api02`, `api04`, `oat01`, `ort01`, unversioned prefix; Base64 copies. The finding must not claim "compliance": the prefix is the general Enterprise organization key |
| `anthropic-admin01-key` | T1 (prefix), T2 body | `sk-ant-admin01-` + 93 `[A-Za-z0-9_-]` + `AA` | Length, alphabet and tail twins (tool-only, and the product keeps a `>= 20` superset); `admin02`; unversioned `sk-ant-admin-`; Base64 copies; the OAuth `org:admin` bearer token |
| `openai-admin-api-key` | T2 | `sk-admin-` + `T3BlbkFJ` between two 58 or two 74 `[A-Za-z0-9_-]` segments | Marker-less body of any length (out of contract, #863): authored as a negative twin only; mixed 58/74 (shipped, not asserted); Base64 copies |
| `aws-bedrock-long-term-api-key` | T2, T1 cand. | `ABSK` + `QmVkcm9ja0FQSUtleS` + standard Base64 (`={0,2}`); 132 characters, or 136 for a `+1` secondary key | Head-less `ABSK` keys; any length or ceiling twin (tools tolerate 113..273); URL-safe alphabet; short-term keys, the public IAM alias, access-key ids |
| `aws-bedrock-short-term-api-key` | T2, T1 cand. | `bedrock-api-key-` + the fixed 133-character head + standard padded Base64, three sizes (about 500, 1000 and 1600 characters) | Length or ceiling twins; the decoded pre-signed URL (separate ruling); URL-safe alphabet; `aws-external-anthropic-api-key-` |
| `elevenlabs-api-key` | T2, T1 cand. | `sk_` + 48 lowercase hex; optional `_residency_<[a-z0-9]+>` authored as an envelope | Uppercase hex (tools disagree); legacy bare 32-hex; empty-region suffix; Pollinations `sk_` + 32 |
| `together-api-key` | T2 | `tgp_v1_` + 43 `[A-Za-z0-9_-]` | Legacy keys, `tgp_v2_` |
| `tavily-api-key` | T2 | `tvly-` or `tvly-dev-` + 32 alphanumerics | `tvly-prod-`, production or enterprise body widths |
| `mistral-api-key` | T2, gated | 32 alphanumerics beside a Mistral name, host or constructor | Bare value; Codestral key; `rt_` realtime token; uppercase-only twin |
| `cohere-api-key` | T2, gated | 40 alphanumerics beside a cohere or `CO_API_KEY` name, host or constructor | Bare value; `co-` prefix (one blog, contradicted) |
| `deepgram-api-key` | T2, gated | 40 lowercase hex beside a Deepgram name, host or constructor; `Authorization: Token` | Bare value; alphabet or case twins (hex versus base36 disputed); 32-hex docs placeholder; the `/auth/grant` JWT; `api_key_id` as a control |
| `ai21-api-key` | T0, gated | 32 alphanumerics beside an AI21 name, host or constructor (one ten-sample observation) | Everything a scanner or provider would have to state |
| `exa-api-key` | T0, gated, no grammar | UUID-shaped carrier value beside an Exa name, host or constructor (measures the gate) | Any prefix, length or alphabet; a bare UUID as a positive; `exa-` prefix |

## Fixtures

Slug format `<category>--<fixture id>`; `path` is `cases/<fixture id>.<ext>`; a positive's secret span is the
credential value only (byte offsets, exclusive end). Counts are positives, twins and independent controls; every
family meets its declared profile with no debt (`npm run beta8:profiles`).

| Family | Category | Profile | Pos | Twin | Ctl | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `anthropic-api01-key` | `beta8-384a` | documented-24 | 9 | 6 | 9 | prefix twins `api03`, `admin01`; delimiter, case, leading-embedded and body-only twins |
| `anthropic-admin01-key` | `beta8-384a` | documented-24 | 9 | 6 | 9 | prefix twins `api03`, `api01`; same four structural twins |
| `openai-admin-api-key` | `beta8-384a` | arrival-24 | 9 | 8 | 10 | 58/58 and 74/74 positives; one-byte-short twins on each side of each width; marker-less 124-byte twin |
| `aws-bedrock-long-term-api-key` | `beta8-384b` | arrival-24 | 10 | 6 | 11 | wrong and lower-case prefix, URL-safe and leading `=` body, embedded, short prefix twins |
| `aws-bedrock-short-term-api-key` | `beta8-384b` | arrival-24 | 10 | 6 | 10 | head one character off, plural and capitalized prefix, URL-safe body, head-only, embedded twins |
| `elevenlabs-api-key` | `beta8-384c` | arrival-24 | 10 | 7 | 10 | residency positive; 47/49 hex, non-hex, Stripe-shaped `sk_live_`, `ak_`, embedded, missing-underscore twins |
| `together-api-key` | `beta8-384d` | arrival-24 | 9 | 6 | 10 | 42/44 body, upper-case and hyphen prefix, dot in body, embedded twins |
| `tavily-api-key` | `beta8-384d` | arrival-24 | 9 | 6 | 10 | dev and bare forms; 31/33 body, `TVLY-`, `tvly_`, underscore in body, embedded twins |
| `mistral-api-key` | `beta8-384e` | context-48 | 12 | 14 | 22 | 12 context twins plus 31/33 length twins |
| `cohere-api-key` | `beta8-384e` | context-48 | 12 | 14 | 22 | 12 context twins plus 39/41 length twins |
| `deepgram-api-key` | `beta8-384e` | context-48 | 12 | 14 | 22 | includes `Authorization: Token`, JSON header, WebSocket subprotocol and `createClient` carriers |
| `ai21-api-key` | `beta8-384e` | arrival-24 | 8 | 10 | 10 | 8 context twins plus 31/33 length twins |
| `exa-api-key` | `beta8-384e` | arrival-24 | 8 | 8 | 14 | SDK-call forms; `EXA_KEY_ID`, `EXA_API_KEY_ID`, `EXA_TEAM_ID`, request-id twins |

Positive fixture ids (drop the family prefix to get the suffix used below; the full id is `<family>-<suffix>`):

- `anthropic-api01-key` (`beta8-384a`): `dotenv`, `export`, `curl-x-api-key`, `json-config`, `python-sdk`, `compose-env`, `tool-call`, `job-log`, `pasted-key`
- `anthropic-admin01-key` (`beta8-384a`): `dotenv`, `export`, `curl-x-api-key`, `json-config`, `python-sdk`, `compose-env`, `tool-call`, `job-log`, `pasted-key`
- `openai-admin-api-key` (`beta8-384a`): `dotenv`, `export-74`, `curl-bearer`, `json-config`, `compose-env`, `python-sdk`, `ts-client`, `tool-call`, `usage-log`
- `aws-bedrock-long-term-api-key` (`beta8-384b`): `dotenv`, `export-136`, `curl-bearer`, `python-environ`, `openai-sdk`, `actions-env`, `agent-settings`, `tool-call`, `proxy-log`, `pasted-key`
- `aws-bedrock-short-term-api-key` (`beta8-384b`): `dotenv`, `export-with-session`, `curl-bearer`, `python-environ`, `openai-sdk-mantle`, `actions-env`, `agent-settings`, `tool-call`, `proxy-log`, `pasted-key`
- `elevenlabs-api-key` (`beta8-384c`): `pasted-key`, `dotenv`, `export-xi-api-key`, `yaml-config`, `curl-xi-api-key`, `python-single-line`, `python-multi-line`, `js-client`, `tool-call`, `residency-suffix`
- `together-api-key` (`beta8-384d`): `dotenv`, `export`, `curl-bearer`, `python-together`, `python-environ`, `openai-sdk-base-url`, `json-config`, `tool-call`, `router-log`
- `tavily-api-key` (`beta8-384d`): `dotenv-dev`, `export-bare`, `curl-bearer`, `python-client`, `js-client`, `json-body`, `remote-mcp-query`, `mcp-client-env`, `tool-call`
- `mistral-api-key` (`beta8-384e`): `dotenv`, `dotenv-alt`, `export`, `compose-env`, `python-ctor`, `langchain-kwarg`, `ts-ctor`, `curl-header`, `litellm-yaml`, `json-config`, `tool-call`, `proxy-log`
- `cohere-api-key` (`beta8-384e`): `dotenv`, `dotenv-alt`, `export`, `compose-env`, `python-ctor`, `langchain-kwarg`, `ts-ctor`, `curl-header`, `litellm-yaml`, `json-config`, `tool-call`, `proxy-log`
- `deepgram-api-key` (`beta8-384e`): `dotenv`, `dotenv-alt`, `export`, `compose-env`, `python-ctor`, `create-client`, `ts-ctor`, `curl-header`, `json-header-token`, `websocket-subprotocol`, `tool-call`, `proxy-log`
- `ai21-api-key` (`beta8-384e`): `dotenv`, `export`, `python-ctor`, `langchain-kwarg`, `ts-ctor`, `curl-header`, `json-config`, `tool-call`
- `exa-api-key` (`beta8-384e`): `dotenv`, `export`, `python-kwarg`, `python-positional`, `langchain-kwarg`, `js-positional`, `hosted-mcp-query`, `curl-x-api-key`

Independent benign axes are placeholders (the providers' own placeholder spellings where documented, such as
`tvly-YOUR_API_KEY`, `sk-admin-...`, `<your-bedrock-api-key>`), references (`${VAR}`, `os.environ[...]`, Actions
secrets), public identifiers (key ids, resource ids, request ids, model ids, IAM aliases and ARNs, project and team ids),
near misses (prefix only, truncated head or body, bare value with no gate, value embedded in a longer run), encoded values
(digests, unrelated Base64, `hashed_xi_api_key`) and prose. A shape that is another family's credential (Stripe
`sk_live_`, the sibling Anthropic classes) is a twin, never a control, because a benign control is flagged by any
finding and a co-detection is only excused on a twin.

## Published beta.9 baseline (redact-secret only, exact-span outcomes)

Measured with `npm run bench -- --strict --refresh-peer-snapshots` against the corpus above. These are baseline
observations for the product PRs to move, not expectations; the arrival families are unscored, so no status reads them.

| Family | Positives found exactly | Twins flagged (any family) | Controls flagged |
| --- | --- | --- | --- |
| `anthropic-api01-key` | 2 of 9 | 2 of 6 | 0 of 9 |
| `anthropic-admin01-key` | 3 of 9 | 3 of 6 | 1 of 9 |
| `openai-admin-api-key` | 9 of 9 | 3 of 8 | 0 of 10 |
| `aws-bedrock-long-term-api-key` | 2 of 10 | 1 of 6 | 0 of 11 |
| `aws-bedrock-short-term-api-key` | 2 of 10 | 1 of 6 | 0 of 10 |
| `elevenlabs-api-key` | 7 of 10 (1 covered, 2 missed) | 7 of 7 | 0 of 10 |
| `together-api-key` | 5 of 9 | 4 of 6 | 0 of 10 |
| `tavily-api-key` | 8 of 9 | 5 of 6 | 1 of 10 |
| `mistral-api-key` | 9 of 12 | 5 of 14 | 2 of 22 |
| `cohere-api-key` | 8 of 12 | 4 of 14 | 2 of 22 |
| `deepgram-api-key` | 5 of 12 | 2 of 14 | 2 of 22 |
| `ai21-api-key` | 6 of 8 | 3 of 10 | 1 of 10 |
| `exa-api-key` | 4 of 8 | 1 of 8 | 1 of 14 |

Every flagged twin is another known family's finding, which the scoring records as co-detection, not as a false alarm:
38 are generic-layer findings (`generic-token`, `bearer-token`) on the unchanged assignment or header, two are
`anthropic-token` on the `api03` prefix twins and one is `stripe-token` on the Stripe-shaped twin. The flagged controls are documentation
placeholders that a generic layer redacts by assignment name; the corpus asserts silence there because the product
issues do (#868), and the ledger rows record the disagreement without adjudicating it.

## What the product PRs need to know

1. **Consuming the fixtures.** Run `npm run fixtures:generate`, then read `fixtures/generated/beta8-384{a..e}.json`
   (`fixtures[].content`, `expected[]` with `start`/`end`/`role`/`envelope`, `twinOf`, `mutation`, `mutationKind`). A
   product regression copies a minimal case, never the matrix (`docs/decisions/2026-09-18-govern-benchmark-promotion.md`).
2. **Anthropic (#862).** Positives carry 93 + `AA`; nothing asserts a length, alphabet or tail, so the `>= 20` byte
   superset passes. The prefix twins (`api03`, and the sibling class) are scored as co-detection when `anthropic-token`
   reports them, since the shared type gives no per-family attribution. **Four existing common-formats twins now break**:
   `anthropic-token-api03-{compliance,admin}-prefix-{plain,unicode-crlf}-twin` use `sk-ant-api01-` and `sk-ant-admin01-` as
   negatives of `api03`. They must be re-scoped in the same benchmark change that re-pins the registry to the merged product
   commit (`DISPUTED_PROPERTIES` in `benchmarks/lib/assessment.ts`); they are left as written until then so no published
   status moves.
3. **OpenAI (#863).** The corpus matches the decision: marker-bearing 58/58 and 74/74 are positives, the marker-less
   124-byte body is a negative twin. The published beta.9 already reports all nine positives exactly, so #863 changes no
   measured behavior on them.
4. **Bedrock (#864).** The short-term head is derived in `benchmarks/lib/beta8/384b.ts` from the fixed pre-signed URL
   head text; the AWS blog's printed body class is malformed and the intended class is used. One family or two is the
   product's decision; the arrival ids can merge without changing a fixture. Nothing asserts silence on a head-less
   `ABSK` key.
5. **ElevenLabs (#865).** The secret span is the 51-character base; the residency positive carries the
   `_residency_eu` suffix inside an authored envelope, so both a base-only finding and a base-plus-suffix finding pass and
   the suffix decision stays the product's. The Stripe-shaped twin is `sk_live_` + 32 alphanumerics generated at build time.
6. **Together and Tavily (#867).** Both are T2 with no pinned scanner rule; positives cover `tvly-` and `tvly-dev-`.
7. **Keyword-gated rows (#868).** Every positive has a context twin that keeps the value byte-for-byte. The call-argument
   forms (`Mistral(api_key="..")`, `cohere.ClientV2(..)`, `AI21Client(..)`, `Exa("..")`, `DeepgramClient(..)`,
   `Authorization: Token ..`) are positives; identifier-named siblings (`MISTRAL_KEY_ID`, `EXA_KEY_ID`, `EXA_TEAM_ID`,
   `CO_ORG_ID`, `DEEPGRAM_PROJECT_ID`) are twins. Coordinate with #866: a generic call-argument fix will also report these
   spans, which the scoring reads as co-detection.
8. **Finding types.** No `arrivalFindingTypes` mapping is authored: a mapping is added against measured product output
   (`scanners/families.mjs`), and only where the product gives a family its own finding type.
9. **After the product PRs merge:** re-pin `benchmarks/detectors.json`, graduate any family that became a registry
   detector (`docs/specs/beta8-evidence.md`), re-scope the four twins above, re-triage the 216 open differential ledger rows,
   and re-measure in candidate mode with the pinned trufflehog 3.97.4.

## Validation

`fixtures:check`, `fixture-index:check`, `arrival:check` (90 families, all seven evidence kinds), `profiles:check`,
`pins:manifest:check`, `decisions:validate`, `ledger:decisions:check`, `ledger:provenance:check`, `queue:check`,
`typecheck`, `adversarial:check`, `tuning:check`, `scorer-promotion:check`, `support:check:ui`, `build` and the unit tests
(including `tests/beta10-corpus.test.mjs`) pass. `eval:classify` in published mode reads 61 stable, 12 provisional, 1 pending
of 74 families, identical per family to `develop` at `45931d0`: the corpus moves no status.

## Open questions

- Maintainer T1 rulings: AWS Security Blog pattern plus AWS generator code (Bedrock long- and short-term), ElevenLabs SDK code.
- Whether the product reports the two Bedrock keys as one family or two (#864), and whether the ElevenLabs finding includes the residency suffix (#865).
- Hands-on issuance for Together, Tavily, ElevenLabs residency keys, Bedrock, Anthropic `api01` and `admin01`, and OpenAI admin keys would settle the recorded `unresolved` fields.
- Whether the arrival ids should receive finding-type mappings once the product PRs land.
