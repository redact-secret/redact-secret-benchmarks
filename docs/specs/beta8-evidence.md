# Beta.8 evidence layout (#207–#212)

Issues [#207](https://github.com/redact-secret/redact-secret-benchmarks/issues/207)–[#212](https://github.com/redact-secret/redact-secret-benchmarks/issues/212)
add Beta.8 fixture evidence for 34 credential families. Research index:
[#215](https://github.com/redact-secret/redact-secret-benchmarks/issues/215).
This page describes where that evidence lives and the conventions it follows.
It adds no support status and no product behavior.

## One module and one corpus per issue

| Issue | Contracts and profiles | Fixtures | Category |
| --- | --- | --- | --- |
| #N | `benchmarks/lib/beta8/N.ts` | `fixtures/generated/beta8/N.mjs` | `beta8-N` |

An issue whose work runs in parallel slices uses a corpus key instead of the
bare number, for example #213's `213d` (`benchmarks/lib/beta8/213d.ts`,
`fixtures/generated/beta8/213d.mjs`, category `beta8-213d`). The module's
`issue` is then that key. One key per slice keeps each slice's source hash, and
so its ledger rows, independent of the others.

Each issue owns its two files. `benchmarks/lib/beta8/index.ts` and
`fixtures/generated/beta8/index.mjs` merge them. Because every issue gets its
own corpus, editing one issue's fixtures changes only that corpus's source
hash. Other corpora keep their differential ledger ids. A category is
registered in `benchmarks/categories.json` and
`corpora/development/manifest.json` together with its first fixture, since an
empty corpus is invalid.

## Registry detectors and arrival families

A fixture targets one of two kinds of family:

- **A registry detector** (`benchmarks/detectors.json`, which mirrors the
  product registry at the pinned `sourceRevision`). This applies when the
  taxonomy already maps the family to that detector, for example
  `supabase:secret-key` → `supabase-token`. The fixture carries
  `detectors: [id]`, and the detector's contract stays in
  `benchmarks/lib/assessment.ts`.
- **An arrival family.** This is a family the taxonomy maps to no detector
  (`detectors: []`), or a family the taxonomy does not list yet. The issue
  module declares it in `arrivalFamilies` with a `[a-z0-9-]+` id, its
  taxonomy id, and the reason no registry detector is targeted. Its contract
  goes in the module's `contracts`. Its fixtures carry `arrivalTargets: [id]`
  and are assigned `[]` in `fixture-detectors.json`, so the registry-keyed
  catalog and coverage pages never show them as product detectors.
  `loadCases` adds the arrival id to each case's `targets`, which lets the
  evaluation engine, `arrival:check`, and the review queue measure the family.
  `eval:classify` skips an arrival id, because a support status describes what
  the product claims, unless the family has a recorded finding-type mapping
  (below): then the product's findings carry the arrival id and the family is
  scored like a registry family
  ([`2026-09-24-score-arrival-families-by-finding-type.md`](../decisions/2026-09-24-score-arrival-families-by-finding-type.md), #730).

An arrival id never equals a registry id.

### Graduating an arrival family

When the product registry gains a detector for an arrival family, re-pinning
`benchmarks/detectors.json` makes the arrival id a registry id, and
`validateBeta8` then rejects it as an arrival family. Graduate it without
copying the contract:

- Remove it from the module's `arrivalFamilies` and move its contract from
  `contracts` to the module's `registryContracts`. `benchmarks/lib/assessment.ts`
  merges every module's `registryContracts` into the registry contracts, so
  the evidence stays with the issue that authored it.
- Map its taxonomy family to the detector id. The module's fixtures then carry
  `detectors: [id]` instead of `arrivalTargets` (`beta8Corpus` routes on
  `arrivalIds`), so `fixture-detectors.json` assigns them the detector.
- Give it the registry-wide `detector-coverage` minimum like any registered
  detector, and a `benchmarks/support/empirical-observations.json` record if
  its contract is T2.

The #208 (Replicate, Groq, xAI, OpenRouter) and #210 (LangSmith, Langfuse)
families graduated this way at the product pin dad7868 (redact-secret#727,
#728), and four #212 families (Perplexity, Fireworks AI, Pinecone `pcsk_`,
GitLab runner authentication token) at f2082ab (redact-secret#730).

The seven #434 detector-id families (`doppler-token`, `trigger-dev-token`, `e2b-api-key`, `posthog-token`,
`helicone-api-key`, `firecrawl-api-key`, `composio-api-key`) and the six #436 families graduated the same way when
the registry was re-pinned to product main `1127bf9` (redact-secret PR #938 added the detectors, #903–#909 and
#912–#917; PR #947 followed). Their eleven sibling types stay arrival families scored by finding type (below).

#259 skipped the arrival stage: redact-secret#773 had merged before its
evidence was authored, so the registry was pinned to 3144bb3 in the same
change, and `travisci-api-token`, `neon-api-key` and
`postman-collection-access-key` were authored directly as registry families
in 259.ts's `registryContracts`. The prefix-less Mailgun key triplet, which the
product reports inside the shared `mailgun-api-key` detector, is the #259
context-gated arrival family `mailgun-api-key-triplet`.

A family the product only types inside a shared detector stays an arrival
family, because its id is not a registry id: `slack-user-token` and
`slack-app-level-token` (inside `slack-token`), `stripe-webhook-signing-secret`
(inside `stripe-token`), `github-fine-grained-pat` (inside `github-token`),
`notion-integration-token` (inside `notion-token`), the context-gated
`pinecone-api-key-legacy` (inside `pinecone-api-key` since redact-secret#766)
and the context-gated `mailgun-api-key-triplet` (inside `mailgun-api-key`).

### Finding types inside a shared detector (#251)

When the product gives such a family its own finding type, the redact-secret
adapter labels the finding with the arrival id instead of the detector id
(`arrivalFindingTypes` in `scanners/families.mjs`). The table is built from
the family's recorded `reason` and the product's documented finding types,
never from scanner output:

| Shared detector | Finding type | Arrival family |
| --- | --- | --- |
| `github-token` | `github_fine_grained_personal_access_token` | `github-fine-grained-pat` |
| `stripe-token` | `stripe_webhook_signing_secret` | `stripe-webhook-signing-secret` |
| `slack-token` | `slack_app_level_token` | `slack-app-level-token` |
| `slack-token` | `slack_user_token` | `slack-user-token` |
| `doppler-token` | `doppler_personal_token`, `doppler_cli_token`, `doppler_service_account_token`, `doppler_service_account_identity_token`, `doppler_scim_token`, `doppler_audit_token` | the six Doppler sibling families (#434) |
| `trigger-dev-token` | `trigger_dev_personal_access_token` | `trigger-dev-personal-access-token` |
| `posthog-token` | `posthog_project_secret_api_key` | `posthog-project-secret-api-key` |
| `helicone-api-key` | `helicone_write_api_key` | `helicone-write-api-key` |
| `composio-api-key` | `composio_org_api_key`, `composio_user_api_key` | `composio-org-api-key`, `composio-user-api-key` |

A coarser type keeps the detector id. The published 0.1.0-beta.7 reports
`whsec_` as `stripe_credential` and `xoxp-`/`xapp-` as `slack_token`, so its
findings still read `stripe-token`/`slack-token` and still show up as a
classification disagreement. `notion-token`, `pinecone-api-key` and
`mailgun-api-key` give the arrival shape the same type as their registry shape,
so their findings keep the detector id too.

### Scoring a mapped arrival family (#730)

An arrival family with a row in the table above is scored like a registry
family ([`2026-09-24-score-arrival-families-by-finding-type.md`](../decisions/2026-09-24-score-arrival-families-by-finding-type.md)).
It amends the rule that arrival ids get no status:

- `eval:classify` classifies every registry id plus `scoredArrivalIds`
  (`benchmarks/lib/assessment.ts`, from `scoredArrivalFamilies` in
  `scanners/families.mjs`), each from its own contract, its own profile and the
  ledger rows that target it. No evidence is borrowed from the shared detector.
- The family's taxonomy entry maps to the arrival id (`github:fine-grained-personal-access-token`
  → `github-fine-grained-pat`, `stripe:webhook-signing-secret` →
  `stripe-webhook-signing-secret`, `slack:app-level-token` →
  `slack-app-level-token`, `slack:user-token` → `slack-user-token`), so the
  matrix shows the measured status, not `unsupported`.
- The tier rules are the registry's and follow the family's contract tier: T1
  can reach documented stable, T2 needs its own
  `benchmarks/support/empirical-observations.json` record to reach empirical
  stable, T3 stays provisional, T0 is pending.
- The id stays an arrival id: it is not in `benchmarks/detectors.json`, has no
  coverage page and no `detector-coverage` minimum, and graduates as above if
  the product registry gains a detector for it.
- Every other arrival family (`notion-integration-token`,
  `pinecone-api-key-legacy` and `mailgun-api-key-triplet`, whose owning
  detectors give them the same type as the registry shape) stays an unscored
  arrival id.

Twins are scoped to their declared family. When a product finding on an
arrival family's twin is attributed to a *different* known family (for
example `github-token` on a `github-fine-grained-pat` twin from a build that
does not type `github_pat_`), the twin records `coDetected` rather than a
false alarm. A finding the adapter labels with the twin's own arrival id is a
false alarm. For an arrival family that the product catches only through a
shared detector's coarser label (#211, parts of #212), twin discrimination is
therefore an upper bound: read it together with the co-detection count and the
open ledger rows, never on its own. `validateBeta8` and `tests/beta8.test.mjs`
enforce this.

## Beta.10 slices (#384)

The same layout carries the Beta.10 credential corpus
([#384](https://github.com/redact-secret/redact-secret-benchmarks/issues/384),
parent [#283](https://github.com/redact-secret/redact-secret-benchmarks/issues/283);
product [redact-secret#774](https://github.com/redact-secret/redact-secret/issues/774)).
The `beta8-` prefix is the shared per-issue corpus layout, not the milestone: the fixture
index labels these corpora `beta.10`. One corpus key per product issue keeps each slice's
source hash, and so its ledger rows, independent of the others.

| Key | Category | Families (arrival ids) | Product issue |
| --- | --- | --- | --- |
| `384a` | `beta8-384a` | `anthropic-api01-key`, `anthropic-admin01-key`, `openai-admin-api-key` | [#862](https://github.com/redact-secret/redact-secret/issues/862), [#863](https://github.com/redact-secret/redact-secret/issues/863) |
| `384b` | `beta8-384b` | `aws-bedrock-long-term-api-key`, `aws-bedrock-short-term-api-key` | [#864](https://github.com/redact-secret/redact-secret/issues/864) |
| `384c` | `beta8-384c` | `elevenlabs-api-key` | [#865](https://github.com/redact-secret/redact-secret/issues/865) |
| `384d` | `beta8-384d` | `together-ai-api-key`, `tavily-api-key` | [#867](https://github.com/redact-secret/redact-secret/issues/867) |
| `384e` | `beta8-384e` | `mistral-api-key`, `cohere-api-key`, `deepgram-api-key`, `ai21-api-key`, `exa-api-key` | [#868](https://github.com/redact-secret/redact-secret/issues/868) |

Nine of the thirteen graduated to registry detectors when the registry was re-pinned to product
`cfe2aec` (redact-secret PR #869: #862-#868): `aws-bedrock-long-term-api-key`,
`aws-bedrock-short-term-api-key`, `elevenlabs-api-key`, `tavily-api-key`, `mistral-api-key`,
`cohere-api-key`, `deepgram-api-key`, `ai21-api-key`, and Together, whose arrival id `together-api-key`
was renamed to the detector id `together-ai-api-key`. Their contracts moved to each module's
`registryContracts`. Four stay arrival families: `anthropic-api01-key`, `anthropic-admin01-key` and
`openai-admin-api-key`, because the product types them inside the shared `anthropic-token` and
`openai-token` detectors under one finding type per detector (`anthropic_api_key`, `openai_api_key`)
and so gives no per-family attribution, and `exa-api-key`, because the product registered no Exa
detector. They stay unscored until the product gives each its own finding type or detector. Conventions
specific to these slices:

- **Maintainer rulings of 2026-09-27 (redact-secret#778, #779, #788).** Bedrock long-term (`ABSK`
  prefix and standard Base64 with `={0,2}`), Bedrock short-term (`bedrock-api-key-`, the fixed
  133-character head, standard padded Base64) and ElevenLabs (`sk_` and the `_residency_[a-z0-9]+`
  suffix grammar) are T1 with a `providerSource` (`documented` route). Total lengths and the ElevenLabs
  48-hex body stay T2 and are asserted by no fixture: the three ElevenLabs body twins are recorded in
  `DISPUTED_PROPERTIES` and read unmeasured. The bullet below records the tiers as first authored.
- **Tier follows the evidence, not the candidate.** `anthropic-api01-key` and
  `anthropic-admin01-key` are T1 on the provider-documented prefix, with the body recorded as
  tool-corroborated or unspecified, as `anthropic-token` already does for `sk-ant-api03-`. The
  Bedrock and ElevenLabs contracts are T2 with a `candidateSource`: the AWS Security Blog pattern,
  the AWS token-generator code and the ElevenLabs SDK code are the candidate T1 sources, and a
  maintainer ruling records the promotion (a tier change plus a `providerSource`, no fixture
  edit). Together and Tavily are T2 pending hands-on corroboration.
- **Keyword-gated rows are context-gated arrival families** (`contextGated: true`): no
  bare-value claim, positives score as project policy, and every positive has a context twin
  that keeps the value byte-for-byte and removes the gate. `ai21-api-key` and `exa-api-key` carry
  a pending (T0) contract because no provider or scanner source states a shape; `exa-api-key`
  has no value grammar at all, so it measures the keyword gate and the SDK-call-argument forms
  only.
- **Disputed properties are not asserted.** Where the sources disagree or none decides (uppercase
  ElevenLabs hex, the Deepgram hex-versus-base36 alphabet, a Tavily `tvly-prod-` prefix, a
  Together `tgp_v2_`, a head-less Bedrock `ABSK` key, Anthropic `admin02`/`api02`/`oat01`), no
  fixture asserts silence; each is a recorded `unresolved` field on the contract.
- **A shape that only exists as another family's credential is a twin, never a control.** The
  Stripe-shaped `sk_live_` value beside an ElevenLabs context and an `sk-ant-api03-` value beside
  an `api01` context are prefix twins, scored as co-detection when another known family reports
  them; a benign control that another detector would flag is a benchmark bug.
- **Shared-detector reconciliation (done at the cfe2aec re-pin).** Four common-formats twins used
  `sk-ant-api01-` and `sk-ant-admin01-` as negatives of `sk-ant-api03-`
  (`anthropic-token-api03-{compliance,admin}-prefix-{plain,unicode-crlf}-twin`). With redact-secret#862 in
  the pinned registry they are re-scoped in `DISPUTED_PROPERTIES` (`anthropic-sibling-prefixes`), and three
  `beta8-384a` twins of `anthropic-token` on prefixes no source claims (underscore delimiters, another vendor
  stem, a missing hyphen) keep the documented twin floor met.
- **The detector-coverage minimum and ledger keys.** Each graduated detector carries the registry-wide
  `detector-coverage` minimum (`tests/detector-coverage.test.mjs`). A ledger id hashes the whole corpus
  file, so editing `detector-coverage`, `common-formats` or a `beta8-384*` corpus re-keys that category's
  rows; they were carried to their new ids mechanically, and rows on changed fixtures were triaged under the
  decided classes (`benchmarks/ledger-decisions.json`) or recorded open.

The corpus also adds one authored calibration row pair per family to
`corpora/development/shadow-scoring-authored.json` and lists the five categories as
development-evaluation in `tuning/shadow-scoring-development-v1.json`, as the calibration
partition requires for every family with a measurable positive.

## Beta.11 slices (#434)

The same layout carries the Beta.11 corpus for the seven READY #860 Tier A credential families
([#434](https://github.com/redact-secret/redact-secret-benchmarks/issues/434), counterpart of
[#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376); product
[redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860)). The fixture index
labels these corpora `beta.11`. One corpus key per product issue:

| Key | Category | Families (arrival ids) | Handoff | Product issue |
| --- | --- | --- | --- | --- |
| `434a` | `beta8-434a` | `doppler-token` (`dp.st.`), `doppler-personal-token`, `doppler-cli-token`, `doppler-service-account-token`, `doppler-service-account-identity-token`, `doppler-scim-token`, `doppler-audit-token` | [doppler.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/doppler.md) | [#903](https://github.com/redact-secret/redact-secret/issues/903) |
| `434b` | `beta8-434b` | `trigger-dev-token`, `trigger-dev-personal-access-token` | [trigger-dev.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/trigger-dev.md) | [#904](https://github.com/redact-secret/redact-secret/issues/904) |
| `434c` | `beta8-434c` | `e2b-api-key` | [e2b.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/e2b.md) | [#905](https://github.com/redact-secret/redact-secret/issues/905) |
| `434d` | `beta8-434d` | `posthog-token` (`phx_`), `posthog-project-secret-api-key` | [posthog.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/posthog.md) | [#906](https://github.com/redact-secret/redact-secret/issues/906) |
| `434e` | `beta8-434e` | `helicone-api-key` (`sk-`), `helicone-write-api-key` | [helicone.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/helicone.md) | [#907](https://github.com/redact-secret/redact-secret/issues/907) |
| `434f` | `beta8-434f` | `firecrawl-api-key` | [firecrawl.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/firecrawl.md) | [#908](https://github.com/redact-secret/redact-secret/issues/908) |
| `434g` | `beta8-434g` | `composio-api-key` (`ak_`), `composio-org-api-key`, `composio-user-api-key` | [composio.md](https://github.com/redact-secret/redact-secret/blob/270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262/docs/audits/evidence/860/composio.md) | [#909](https://github.com/redact-secret/redact-secret/issues/909) |

Conventions specific to these slices:

- **Independent of the product code.** Contracts and fixtures come from the frozen step-3 handoffs
  (product commit `270faf8`) and the provider sources they cite, never from the product detector
  branch. `benchmarks/lib/beta8/434-sources.ts` holds the shared citations.
- **Arrival ids follow the handoff's detector ids.** Each handoff names one new detector per
  provider. The family that detector's id describes (`doppler-token` for `dp.st.`,
  `trigger-dev-token` for the environment secret key, `posthog-token` for `phx_`,
  `helicone-api-key` for `sk-`, `composio-api-key` for `ak_`, and the three single-type families)
  takes it as its arrival id and graduates on the registry re-pin. The eleven sibling types
  share that detector under their own finding type, so after the re-pin they stay arrival
  families scored by finding type (the GitHub model above), once `arrivalFindingTypes` records
  the product's documented types.
- **All eighteen are T1** with a `providerSource` and a `documented-24` profile: the per-type
  Doppler regex page, provider generator and validator code and tests (ruling R1), and for
  Composio a dated provider-staff statement (ruling R3). Rulings R6 (a code comment is T2, so
  `uak_` + 20 is a length twin) and R8 (no alphabet narrowing from a third-party library, so
  Helicone's base32 is a generator hint only) are applied as the handoffs record them.
- **The nine index contexts.** Every family has a positive in each context of the handoff
  index probe (bare prose, `ENV=`, `export`, `Authorization: Bearer`, `X-API-Key`, JSON
  `"token"`, JSON `"api_key"`, an SDK keyword argument and a chat sentence;
  `fixtures/generated/beta8/434-shared.mjs`), plus the family-specific contexts its handoff
  lists.
- **Public siblings are controls; other credentials are twins.** The PostHog `phc_` project
  token, the Trigger.dev `pk_<env>_` public key, the `dp.st…` preview, `fc-` placeholders, CSS
  classes and snake_case `ak_` identifiers are benign controls, authored outside
  credential-named assignments so no generic detector would flag them. The retired `sk_e2b_`
  token, bkend.ai's `ak_` + 64 hex, the legacy bare Helicone `sk-` and `-cp-` keys, a `pk_`
  public key or `phc_` token in a secret's position, and `oak_`/`uak_`/`cak_` around an `ak_`
  body are twins, scored as co-detection when another known family reports them.
- **Accepted false positives are not authored.** An exact-width placeholder made only of
  alphabet bytes (for example Helicone's all-`x` key) is claimed by the contract, so it is
  neither a positive nor a benign control.

### Peer lag at the pinned peers

Recorded in each contract's `peer-lag` field and read from the pinned rule sources
(trufflehog 3.97.4, gitleaks 8.30.1); corroboration only, never used to narrow or widen a contract.
`scanners/families.mjs` maps trufflehog `Doppler` to `doppler-token`, trufflehog `PosthogApp`
to `posthog-token` and gitleaks `doppler-api-token` to `doppler-personal-token`.

| Family | trufflehog 3.97.4 | gitleaks 8.30.1 |
| --- | --- | --- |
| Doppler | `dp.(ct\|pt\|st[.segment]\|sa\|scim\|audit).` + 40–44: no `said` (GitHub secret scanning lists no `said` either) | `doppler-api-token`: `dp.pt.` + 43 only, case-insensitive |
| PostHog | `phx_` + 43–48 of `[a-zA-Z0-9_]`: misses 42- and 49-byte keys, admits `_`, no `phs_` | none |
| Trigger.dev, E2B, Helicone, Firecrawl, Composio | none (the staff-authored Composio PR #5322 is still open) | none |

### Graduation at the 1127bf9 re-pin

`benchmarks/detectors.json` is pinned to product main `1127bf9`, whose registry carries the thirteen #860 detectors.
Each slice module keeps its authored contracts in one object and splits them with `splitGraduated`
(`434-sources.ts`): the detector-id family's contract moves to `registryContracts`, the sibling types' contracts stay
in `contracts` with their arrival ids. The taxonomy row of every family maps to its own id (the registry detector, or
the scored arrival id), `scanners/families.mjs` lists the thirteen detector ids and the eleven sibling finding types,
and each detector has the registry-wide `detector-coverage` minimum. The peer mappings #434 recorded (trufflehog
`Doppler` and `PosthogApp`, gitleaks `doppler-api-token`) are unchanged; #436's deferred ones are added at graduation:
gitleaks `1password-service-account-token` → `onepassword-service-account-token`, trufflehog `Apify` →
`apify-api-token` and trufflehog `WeightsAndBiases` → `wandb-api-key` (its v1 legacy 40-hex key reports under the same
label, as ElevenLabs v1 does). The graduation changed the beta8-434/436 fixture objects (`detectors` instead of
`arrivalTargets`), so their ledger rows were carried to their new ids by structural identity, and the open
differential rows were re-triaged against candidate `1127bf9` under the established classes (see
`evidence/860/1127bf9/README.md`).

## Beta.11 Tier B slices (#436)

The same layout carries the #860 Tier B READY credential families
([#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436); product parent
[redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860)). The fixture index labels
these corpora `beta.11`. One corpus key per product issue, one family per key. Each contract is authored
from the step-3 handoff frozen at product `54fe385` and the provider sources it cites, never from product
detector code; `benchmarks/lib/beta8/436-sources.ts` carries the shared citations and
`fixtures/generated/beta8/436-shared.mjs` the shared contract guard and the nine re-rank probe contexts.

| Key | Category | Family (arrival id) | Handoff | Product issue |
| --- | --- | --- | --- | --- |
| `436a` | `beta8-436a` | `convex-deployment-key` | [convex.md](https://github.com/redact-secret/redact-secret/blob/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860/convex.md) | [#912](https://github.com/redact-secret/redact-secret/issues/912) |
| `436b` | `beta8-436b` | `onepassword-service-account-token` | [onepassword.md](https://github.com/redact-secret/redact-secret/blob/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860/onepassword.md) | [#913](https://github.com/redact-secret/redact-secret/issues/913) |
| `436c` | `beta8-436c` | `inngest-signing-key` | [inngest.md](https://github.com/redact-secret/redact-secret/blob/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860/inngest.md) | [#914](https://github.com/redact-secret/redact-secret/issues/914) |
| `436d` | `beta8-436d` | `resend-api-key` | [resend.md](https://github.com/redact-secret/redact-secret/blob/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860/resend.md) | [#915](https://github.com/redact-secret/redact-secret/issues/915) |
| `436e` | `beta8-436e` | `apify-api-token` | [apify.md](https://github.com/redact-secret/redact-secret/blob/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860/apify.md) | [#916](https://github.com/redact-secret/redact-secret/issues/916) |
| `436f` | `beta8-436f` | `wandb-api-key` | [wandb.md](https://github.com/redact-secret/redact-secret/blob/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860/wandb.md) | [#917](https://github.com/redact-secret/redact-secret/issues/917) |

All six are T1 families declared `documented-24`, authored as arrival families and registry detectors since the
`1127bf9` re-pin (graduated as above). Conventions specific to these slices:

- **Every positive in every probe context.** Each family has a positive in the nine contexts of the Tier B
  re-rank probe (bare prose, `ENV=`, `export`, Bearer, `X-API-Key`, JSON `"token"`, JSON `"api_key"`, an SDK
  keyword argument, a chat sentence) plus the handoff's own contexts (Compose, CI, MCP `env`, CLI, `.netrc`).
- **Policy is not provider fact.** A bound the handoff sets as project policy is not asserted where the
  provider's own rule disagrees or is silent: the Apify 128-byte cap (the provider linter is open-ended), the
  Resend mixed-case guard (a random one-case body), a Convex name or slug outside the bounded class and the
  Convex cloud `eyJ2` body (issuance-gated, ruling R4). The 1Password 250-byte floor is asserted, because the
  documented field set makes a shorter token impossible and the handoff decides it.
- **W&B length (orchestrator decision on redact-secret#917).** The docs say "about 86"; the product matches a
  bounded tolerant range around it. Positives carry totals 85, 86 and 87 (86 in most), and no fixture asserts
  silence on any length. A `wandb_v2_` value is not authored either way.
- **Spans.** Convex's span is the whole key, name included (the provider joins `{name}|{encrypted}` into
  one credential string). 1Password's span includes `=`/`==` padding. W&B's on-prem `local-` host label sits
  in an authored envelope, so a finding with or without it passes.
- **Lexical separability (#84).** A twin whose broken part leaves a contract-valid remainder is not authored:
  the Convex `prod;` and leading-glue twins (the untyped `<name>|01…` after the `;` or `:` still matches), and
  a trailing glue byte after a full-length 1Password body. The `+`, `/` and `=` 1Password twins sit early in
  the body instead.
- **Another family's credential is a twin, never a control:** the 1Password Connect JWT and the Resend
  `whsec_` webhook secret.

The corpus adds one authored calibration row pair per family to
`corpora/development/shadow-scoring-authored.json` and lists the six categories as development-evaluation
in `tuning/shadow-scoring-development-v1.json`.

## Beta.12 issuance-research slices (#464)

The same layout carries the six #860 issuance-research READY credential families
([#464](https://github.com/redact-secret/redact-secret-benchmarks/issues/464); product parent
[redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860), rulings
[R9 and R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337)). The fixture index
labels these corpora `beta.12`. One corpus key per product issue, one family per key. Each contract is authored from
the step-3 handoff and its issuance research frozen at product `8b6a5fd`, and the provider sources they cite, never
from product detector code; `benchmarks/lib/beta8/464-sources.ts` carries the shared citations and
`fixtures/generated/beta8/464-shared.mjs` the shared contract guard and the nine re-rank probe contexts.

| Key | Category | Family (arrival id) | Handoff | Product issue | Positives / twins / controls |
| --- | --- | --- | --- | --- | --- |
| `464a` | `beta8-464a` | `daytona-api-key` | [daytona.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/daytona.md) | [#970](https://github.com/redact-secret/redact-secret/issues/970) | 16 / 10 / 12 |
| `464b` | `beta8-464b` | `clickhouse-cloud-api-secret` | [clickhouse-cloud.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/clickhouse-cloud.md) | [#971](https://github.com/redact-secret/redact-secret/issues/971) | 16 / 10 / 11 |
| `464c` | `beta8-464c` | `nvidia-api-key` | [nvidia.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/nvidia.md) | [#972](https://github.com/redact-secret/redact-secret/issues/972) | 14 / 6 / 11 |
| `464d` | `beta8-464d` | `browserbase-api-key` | [browserbase.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/browserbase.md) | [#973](https://github.com/redact-secret/redact-secret/issues/973) | 13 / 7 / 11 |
| `464e` | `beta8-464e` | `cerebras-api-key` | [cerebras.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/cerebras.md) | [#975](https://github.com/redact-secret/redact-secret/issues/975) | 21 / 8 / 11 |
| `464f` | `beta8-464f` | `runpod-api-key` | [runpod.md](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/runpod.md) | [#974](https://github.com/redact-secret/redact-secret/issues/974) | 13 / 7 / 10 |

All six are T1 arrival families declared `documented-24` and unscored until the product detector with the same id is
in the pinned registry (then they graduate as the #434 and #436 families did). No detector code for these families
merges to product `main` before `0.1.0-beta.11` is released, so no candidate-mode measurement exists yet. No support
status moves and none is hand-edited. Conventions specific to these slices:

- **Policy is marked, never read as T1.** Each contract records what a provider source states (T1) and what the
  handoff sets as project policy, and every policy part is a `policy-*` field whose basis is `research-hypothesis`
  and whose claim starts `POLICY`: the 128-byte caps (NVIDIA, Browserbase, RunPod), the RunPod floor of 31 (ruling
  R10; the provider floor is 16), the Cerebras alphabet `[A-Za-z0-9_-]` (R10; the provider states only the length)
  and ClickHouse's at-least-one-uppercase guard. Daytona is dated instead: T1 as of v0.190.0 (2026-06-23) under R9.
- **Policy is not asserted against a provider rule.** No fixture asserts silence on a 129-byte run (the provider rules
  are open-ended), on a lowercase-only ClickHouse body (the staff regex admits it), or on a dot or plus in a Cerebras
  body (the validator accepts any 48 code units). Positives reach the caps (128) and include lowercase-only
  Cerebras bodies (the tool class) and `_`/`-` bodies. Every ClickHouse positive and twin body is mixed case, so the
  guard is never what a fixture measures. The one policy boundary asserted is RunPod's 30-byte twin, because the
  handoff decides the floor (as for the 1Password 250 floor); its mutation text says `POLICY`.
- **Every positive in every probe context.** Each family has a positive in the nine contexts of the Tier B re-rank
  probe plus the handoff's own contexts (Terraform, Basic auth, `X-BB-API-Key`, `docker login`, `runpodctl`, MCP `env`,
  SDK clients). Cerebras carries both prefixes (`csk-`, `csk_`) in every probe context.
- **Context confusion.** A ClickHouse key ID sits beside the secret (unmarked, only the secret expected); a real-shape
  Pinecone `pcsk_` key (built at run time) is a Cerebras control and a `pcsk_`/`pcsk-` leading-glue twin; `dtn_secret_`,
  `dtn_artifact_`, `bb_live_session_`, `bb_test_`, `rps_`, Redirect.pizza `rpa_` + 30, NVAPI SDK names and bare
  64-hex, `4b1d` digests and UUIDs are controls.
- **Not authored either way:** the legacy 84-character NGC key, bare `bb_test_` positives, Cerebras Management API keys,
  RunPod bodies of 16 to 30 other than the 30 boundary, ClickHouse `hashData` secrets and the key ID as a positive.
- **Lexical separability (#84).** A twin whose broken part leaves a contract-valid remainder is not authored: no
  trailing-glue twin for the NVIDIA and Cerebras bodies (their class contains `_` and `-`, so a trailing byte only
  lengthens the run), and no leading `-` twin for NVIDIA or Browserbase (the provider `\b` still matches after it).
- **Peer lag and overreach** is recorded per contract as a `peer-lag` field: trufflehog 3.97.4 `NVAPI` (exact 64) lags
  every other NVIDIA width, gitleaks 8.30.1 `clickhouse-cloud-api-secret-key` (`\b(4b1d[A-Za-z0-9]{38})\b`, entropy 3)
  agrees with the grammar but misses low-entropy bodies, and neither pinned peer has a Daytona, Browserbase, Cerebras
  or RunPod rule. betterleaks (unpinned, not measured here) uses `rpa_[A-Z0-9]{40}[A-Za-z0-9]{6}` for RunPod and
  `{60,70}` after `nvapi-`, and tool rules use `[a-z0-9]` for the Cerebras body, where the contract takes
  `[A-Za-z0-9_-]` by policy. The two mapped peer labels are in `scanners/families.mjs`.

The corpus adds one authored calibration row pair per family to
`corpora/development/shadow-scoring-authored.json` and lists the six categories as development-evaluation
in `tuning/shadow-scoring-development-v1.json`.

## Beta.11 family evidence (#379)

[#379](https://github.com/redact-secret/redact-secret-benchmarks/issues/379) (parent
[#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376)) adds category
`beta8-379` (`fixtures/generated/beta8/379.mjs`, no contract module: every family already has its
contract and profile). The fixture index labels it `beta.11`. It follows #377's frozen family/axis
ledger (`docs/reports/2026-09-28/beta-11-family-axis-ledger.json`) for fifteen existing families and
adds no family, contract, tier, status or floor. Conventions beyond the ones above:

- **Independence is checked, not claimed.** Every positive has a value and a value-masked skeleton
  that no earlier fixture of its family uses (`tests/beta11-family-evidence.test.mjs`), so
  `npm run audit:independence` counts it as a new sample.
- **Positives author the action.** Each positive sets `expectedAction: "redact"`, the ledger's
  stated action; a `warn` finding is detection, not sanitization.
- **Per-case rationale and ledger revisions live in the generator.** `RATIONALE` records each case's
  contract, axis, rationale, twin basis and seed provenance; `REVISIONS` records every departure
  from the ledger with its reason (sibling-family secrets as non-twin controls, values a
  context-gated contract admits beside its gate, twins that mutate no contract property or are not
  lexically separable, and one disputed property).

## Per-field provenance

`FormatContract.fields` records each structural claim (prefix, total length,
body alphabet, segment widths, checksum, and so on) with its own `basis`,
`status` and dated `sources`:

- `basis`: `provider-documentation`, `provider-example`, `provider-code`,
  `maintainer-observation`, `community`, `tool` or `research-hypothesis`.
  A field keeps the basis its evidence has. Provider code is not provider
  documentation, and a peer rule is not either.
- `status`: `frozen` means the contract depends on the claim. `provisional`
  means fixtures use it but new evidence may change it. `unresolved` means the
  claim is recorded and nothing relies on it.

Every arrival contract lists its fields. A T1 arrival contract needs at least
one frozen `provider-documentation` field. The contract's `tier` still applies
to the whole value, so a T1 prefix with a tool-corroborated body stays at the
tier its weakest frozen field supports.

`contextGated: true` marks a contract that makes no bare-value claim. Its
positives score as policy, and its twins may mutate the assignment context.
The registry's `CONTEXT_GATED` list gives the same treatment to existing
families.

## Fixture conventions

Author fixtures with `beta8Corpus(issue, tools)` from
`fixtures/generated/beta8/helpers.mjs`:

- `positive(target, axis, slug, parts)`: the id is `<target>-<slug>`, and
  `contextAxis` must be one of `POSITIVE_AXES` (`env`, `header`, `sdk-config`,
  `structured-file`, `prose`, `tool-output`, …). Serialization wrappers of one
  context count as one axis.
- `control(target, axis, slug, parts)`: the id ends in the control-axis suffix
  (`near-miss`, `public-id`, `encoded-value`, `reference`, `placeholder`,
  `prose`), and `benchmarks/lib/assessment.ts` classifies the control by that
  suffix.
- `twin(target, positiveSlug, slug, parts, mutation, mutationKind)`: the id
  ends in `-twin`. The fixture differs from its positive in exactly one
  documented property.

Values come from `synthetic()` seeds or from independent construction, such as
a checksum computed by code in the generator. They are never provider-issued,
scanner-reported or derived from a real credential. A positive whose value
fails its contract is classified T0 and unscored, and `tests/beta8.test.mjs`
rejects T0 fixtures in a Beta.8 corpus.

## Profiles

Each module's `profiles` declares the Beta.8 profile that each target it owns
is authored toward: `arrival-24`, `documented-24`, `empirical-40` or
`context-48`. A later issue may take over a target's declaration when it raises that target to a higher profile: #263 declares `empirical-40` for nine T2 registry families and `context-48` for travisci-api-token, adding its own corpus (`beta8-263`) instead of editing theirs, so their source hashes and ledger ids stay unchanged.

`npm run beta8:profiles` counts every fixture in every corpus
that targets a declared family and prints the remaining debt per cell: total,
positives, independent controls, twin pairs, context-twin pairs, positive axes
and control axes. The floors transcribe #206's draft. The report is advisory
and changes no status. #206 owns the versioned criteria and the fail-closed
gate.
