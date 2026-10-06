# Provider x credential-family taxonomy

Issue: [#502](https://github.com/redact-secret/redact-secret/issues/502), part of
[Epic A](https://github.com/redact-secret/redact-secret/issues/500). Data:
`benchmarks/support/taxonomy.json`, schema `schemas/taxonomy-v1.json`, typed
access `benchmarks/support/taxonomy.ts`.

## Why this exists

A detector name is the wrong unit for a support claim. `github-token` names
one registered detector, but GitHub alone issues classic PATs, OAuth access
tokens, GitHub App user-to-server tokens, GitHub App server-to-server tokens,
OAuth refresh tokens and fine-grained PATs — six distinct credential families,
of which the `github-token` detector's `ghp_|gho_|ghu_|ghs_|ghr_` pattern
matches five. Saying "GitHub tokens: stable" would silently claim the sixth
too. The unit this taxonomy fixes on is **provider x credential family**.

## Shape

```jsonc
{
  "schemaVersion": 1,
  "sourceNote": "...",
  "providers": [{ "id": "github", "name": "GitHub" }],
  "families": [
    {
      "id": "github:fine-grained-personal-access-token",
      "provider": "github",
      "name": "Fine-grained personal access token",
      "description": "...",
      "detectors": [],
      "supportStatus": "unsupported",
      "sources": ["https://docs.github.com/..."],
      "note": "why this family has no detector"
    }
  ]
}
```

- **`families[].detectors`** is many-to-many against `benchmarks/detectors.json`.
  A family with several entries (rare; none currently) is served by more than
  one detector. The one exception is a Beta.8 arrival family that the product
  types inside a shared detector (`scoredArrivalFamilies`,
  `scanners/families.mjs`): its taxonomy family maps to the arrival id, which
  `eval:classify` scores on its own contract
  ([`2026-09-24-score-arrival-families-by-finding-type.md`](../decisions/2026-09-24-score-arrival-families-by-finding-type.md), #730). A detector serving several families is common — `github-token`
  serves five, `stripe-token` serves four.
- **`families[].detectors: []`** is a family a provider offers that this
  project does not detect. This is deliberate and representable, not an
  omission: A8's `support-matrix.json` (#509) turns every such entry into an
  `unsupported` status by default. `supportStatus: "pending"` is the narrow
  exception for a reviewed but blocked contract whose final support
  disposition is unresolved; it still carries no evidence tier or profile
  measurement. A test enforces that every zero-detector family
  carries `sources` and/or a `note` — a detectorless disposition without a reason
  is a bug in the taxonomy, not a fact about the provider.
- **A compatibility aggregate is not split-family evidence.** Vercel's
  `vercel:access-token` row temporarily preserves the existing
  `vercel-token` detector and fixture routing while the runtime still reports
  five implementation branches through one finding type. The five modern
  semantic families are separate detectorless Pending rows until each has a
  complete positive contract and independently attributable behavior. The aggregate's
  T0 fixture cells must never be broadcast or copied into those rows (#858,
  [benchmark #373](https://github.com/redact-secret/redact-secret-benchmarks/issues/373)).
- **Beta.10 credential families (#384).** Thirteen zero-detector rows are measured
  arrival families whose contracts and corpora live in
  `benchmarks/lib/beta8/384a.ts`–`384e.ts` (see
  [beta8-evidence.md](beta8-evidence.md)): `anthropic:compliance-access-key`,
  `anthropic:admin-api-key`, `openai:admin-api-key`, the two `aws-bedrock:` keys,
  `elevenlabs:api-key`, `together:api-key`, `tavily:api-key` and the five
  keyword-gated `mistral:`, `cohere:`, `deepgram:`, `ai21:` and `exa:` rows. Three of
  them (the two Anthropic prefixes and the OpenAI admin key) sit inside detectors the
  product already ships or extends; their rows deliberately map no detector, so they
  never borrow the status of `anthropic:secret-api-key` or `openai:secret-api-key`.
  Two further rows, `mistral:realtime-client-token` and `voyage-ai:api-key`, record the
  research dispositions that stay `pending` with no corpus (redact-secret#780, #785).
- **Beta.11 #860 Tier A families (#434).** Eighteen zero-detector rows for seven new
  providers are measured arrival families whose contracts and corpora live in
  `benchmarks/lib/beta8/434a.ts`–`434g.ts` (see [beta8-evidence.md](beta8-evidence.md)):
  the seven `doppler:` token types, `trigger-dev:secret-api-key` and
  `:personal-access-token`, `e2b:api-key`, `posthog:personal-api-key` and
  `:project-secret-api-key`, `helicone:api-key` and `:write-api-key`, `firecrawl:api-key`,
  and `composio:project-api-key`, `:org-api-key` and `:user-api-key`. Every row is T1 and
  maps no detector until the product detectors (redact-secret#903–#909) are in the pinned
  registry; none carries a hand-edited status. The PostHog `phc_` project token and the
  Trigger.dev `pk_<env>_` public key are public by design and get no row.
- **Beta.11 #860 Tier B credential families (#436).** Six zero-detector rows are
  measured arrival families whose contracts and corpora live in
  `benchmarks/lib/beta8/436a.ts`–`436f.ts` (see [beta8-evidence.md](beta8-evidence.md)):
  `convex:deployment-key` (hex body only), `onepassword:service-account-token`,
  `inngest:signing-key`, `resend:api-key`, `apify:api-token` and `wandb:api-key`
  (`wandb_v1_` only). Each maps no detector until the product detector
  (redact-secret#912–#917) is in the pinned registry.
- **Beta.12 #860 issuance-research credential families (#464).** Six zero-detector rows are
  measured arrival families whose contracts and corpora live in
  `benchmarks/lib/beta8/464a.ts`–`464f.ts` (see [beta8-evidence.md](beta8-evidence.md)):
  `daytona:api-key`, `clickhouse-cloud:api-key`, `nvidia:ngc-api-key`, `browserbase:api-key`
  (`bb_live_` only), `cerebras:inference-api-key` and `runpod:api-key`. Each maps no detector
  until the product detector (redact-secret#970–#975) is in the pinned registry.
- **Beta.12 #1014 broad-discovery credential families (#528).** Fourteen zero-detector rows across ten
  providers are measured arrival families whose contracts and corpora live in
  `benchmarks/lib/beta8/528a.ts`–`528j.ts` (see [beta8-evidence.md](beta8-evidence.md)):
  `bitwarden:secrets-manager-access-token`, `polar:organization-access-token`, `polar:api-credential`,
  `sonarqube:user-token`, `sonarqube:analysis-token`, `rubygems:api-key`, `clojars:deploy-token`,
  `crates-io:api-token`, `crates-io:trusted-publishing-token`, `dynatrace:api-token`, `paddle:api-key`,
  `honeycomb:ingest-key` (the management key stays issuance-gated), `axiom:api-token` and
  `axiom:personal-token`. Each mapped no detector until the product detector (redact-secret#1019–#1035) was in
  the pinned registry; since the 4fb7882 re-pin each detector-id row maps to its detector and each sibling row
  (`polar:api-credential`, `sonarqube:analysis-token`, `crates-io:trusted-publishing-token`,
  `axiom:personal-token`) to its own scored arrival id. The #464 rows likewise map to their detectors since that pin.
- **Beta.12 first-measured variants (#1012, #528).** Contracts and corpora in `benchmarks/lib/beta8/1012a.ts`–`1012e.ts`
  (see [beta8-evidence.md](beta8-evidence.md)): `aws:iam-user-secret-access-key` maps to the registry detector
  `aws-secret-access-key` (redact-secret#1028); the new row `google:oauth-client-secret` maps to
  `google-oauth-client-secret` (redact-secret#1029), and `google:oauth2-credential` keeps the BLOCKED `ya29.` and
  `1//` tokens; `vercel:personal-access-token`, `vercel:app-access-token` and `vercel:app-refresh-token` map to their
  scored arrival ids (redact-secret#1036). `gitlab:routable-personal-access-token` and `aws:sts-temporary-access-key`
  are measured as unscored arrival families (their findings share the owning detector's finding type) and map no
  detector. `vercel:integration-token` and `vercel:api-key` stay pending (ruling Q-VC).
- **Beta.14 second-wave families (#583).** Nine rows across eight providers whose detectors are in the pinned registry
  (product main `3b1a5aa`): `square:access-token` and `square:oauth-application-secret` (contract and corpus in
  `benchmarks/lib/beta8/583a.ts`), and `xata:api-key`, `sourcegraph:access-token`, `unkey:root-key`,
  `buildkite:access-token`, `pydantic:logfire-token`, `mapbox:secret-access-token` and `fly:access-token`, whose benchmark
  contract and corpus are pending (`583p.ts`: a T3 placeholder that claims nothing). Each maps its detector, so none is a
  zero-detector row.
- **`families[].provider: null`** marks a family that is not provider-specific
  at all: `private-key`, `jwt`, `bearer-token`, `connection-string`,
  `otpauth-uri` and `generic-token` are structural or protocol-level formats
  (RFC 7468, RFC 7519, RFC 6750, RFC 3986, the otpauth URI convention, and
  project masking policy respectively), not credentials any one provider
  issues. Their family ids use the `generic:` prefix instead of a provider id.

## Counting fixtures per family

Decision: [`2026-09-30-count-a-fixture-in-every-family-it-is-related-to.md`](../decisions/2026-09-30-count-a-fixture-in-every-family-it-is-related-to.md)
(#560). A fixture's family relationships are `familyIds` in
`benchmarks/fixture-index.json`: none (a global fixture, with an
`unscopedReason`), one, or several. Every count that says "fixtures in a family"
follows one rule.

- **Family row.** A fixture is counted in **every** family it is related to.
  The count of a family is the number of fixtures whose `familyIds` include it.
- **Provider row.** A fixture is counted **once** per provider, however many of
  that provider's families it is related to. A provider count is the number of
  distinct fixtures related to any of its families.
- **Global fixtures.** A fixture with no family is in no family row and no
  provider row. It is stated as a footnote count ("135 fixtures are global").
  Families that no provider owns (`provider: null`) are listed as
  "Not provider-specific".
- **Zero is "No fixtures".** A family with no fixtures shows "No fixtures" and
  "Not measured", never zeros: no coverage is claimed.
- **Levels partition.** A fixture has exactly one evidence level (`T1`
  provider-documented, `T2` tool-corroborated, `T3` project policy, `T0`
  pending review), so a family's per-level counts add up to its all-levels
  count. A level control on the provider and family lists (and on a family's
  rows) recounts from the fixtures at that level with the same rule, so a family
  that has fixtures only at `T2` reads "No fixtures" at `T1`.
- **Outcome columns.** For redact-secret, in one run: *left readable* (some
  secret span `PARTIAL` or `MISS`), *too much* (some span `OVERBROAD`), *false
  alarms* (a control it flagged), *not measured* (no recorded row).

### How the existing report tree differs, and why both stay

The existing site's report tree (`src/pages/report-hierarchy.ts`) is a display
projection whose leaves must add up to the fixture total, so each fixture is one
leaf. It places a fixture with exactly one family in that family and puts every
fixture with several families, and every global one, into one shared bucket
("Global / multi-family"). The two views therefore agree exactly on every fixture
with exactly one family, and differ only by the multi-family fixtures:

| | Existing tree | This rule |
| --- | --- | --- |
| Fixture with one family | that family | that family |
| Fixture with several families | the shared bucket | each of its families |
| Fixture with none | the shared bucket | no row (footnote) |
| Family row count | its single-family fixtures | its single-family fixtures **plus** its multi-family fixtures |

On the current corpus 116 fixtures have several families and 135 have none; the
shared bucket holds those 251. The existing tree shows 158 families with rows, and
this rule shows 158 too (the same families have single-family fixtures), but 40
families differ, and three Mailgun families that have **only** multi-family
fixtures show no fixtures in the tree and 46 each under this rule.

The existing tree is not changed: it is published output, and its one-leaf-per-fixture
invariant (a leaf is never counted twice) is what a total-of-rows reconciliation
needs. The two are reconciled by `tests/family-counting.test.mjs`, which reads the
committed index and asserts, for every family, `family count = tree count + the
multi-family fixtures related to it`, that the tree's shared bucket is exactly the
multi-family plus global fixtures, and that no fixture is lost or counted twice in
the tree. When the tree is retired at cutover the rule above is the only one left.

## What's deliberately excluded

Some values that share a credential's lexical shape are not credential
families at all, and are left out rather than force-fit:

- **Identifiers, not secrets.** AWS's `AIDA` prefix names an IAM user's unique
  ID, not an access key (`benchmarks/lib/assessment.ts`, aws-access-key
  contract, re-checked 2026-09-20 per issue #36). Twilio's Account SID and API
  Key SID gate detection of the paired auth token / key secret but are not
  themselves secret.
- **Documented as safe to expose.** Stripe's `pk_` publishable key and
  Supabase's `sb_publishable_` key are both documented by their providers as
  intended for client-side exposure.

Excluding these keeps `unsupported` meaning "a real credential this project
does not catch," not "any string shaped like one of our patterns."

## Evidence discipline

Every family — detected or not — traces to something already reviewed in this
repository: a `providerSource`/`review` field in `benchmarks/lib/assessment.ts`'s
`contracts` map, an explicit variant guard in `classifyFixture` (the comment
"Variant support must not be inferred from a related family name"), or the
GitHub issue that requested this taxonomy. Nothing here is asserted from
general knowledge about a provider that this repository has not itself
reviewed; where the source is a lower-confidence inference (e.g. `npm`'s
pre-2021 legacy token, inferred from the changelog announcing its
replacement, or `vercel`'s single unconfirmed family, since its candidate
prefixes are corpus-authored rather than provider-documented) the family's
`note` says so plainly. Vercel is now the explicit exception to that stale
example: product #858 split five provider-named modern classes, while leaving
all five positive grammars T0 and the prior aggregate bounded as compatibility
history. Extending the taxonomy is a data change: add a
`families[]` entry with a `sources`/`note` trail, never assert a family
without one.

## Current counts

182 families total: 176 across 100 providers plus 6 non-provider-specific
formats; 161 carry at least one detector, 21 currently do not (counts as of 2026-10-05;
`benchmarks/support/taxonomy.json` is the source of truth). This is a taxonomy, not a
support claim — a family having a detector says nothing about that
detector's evidence tier (T0-T3, see `benchmarks/lib/assessment.ts`) or
whether it clears A2's (#503) `stable` bar. That classification is A3's job
(#504), reading this file rather than re-deriving family boundaries from
detector names.

## Consuming this from A2/A3

```ts
import { taxonomy, familiesForDetector, undetectedFamilies, familyById, familiesForProvider } from '../support/taxonomy.ts';
```

`familiesForDetector(id)` is what a per-detector evidence check (T1/T2/T0 from
`contracts`) should fan out across before a status is assigned per family
rather than per detector. `undetectedFamilies()` is the starting list for
`unsupported` entries in A8's matrix.
