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
