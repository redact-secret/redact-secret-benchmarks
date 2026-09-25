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
  `unsupported` status. A test enforces that every zero-detector family
  carries `sources` and/or a `note` — an unsupported claim without a reason
  is a bug in the taxonomy, not a fact about the provider.
- **`families[].provider: null`** marks a family that is not provider-specific
  at all: `private-key`, `jwt`, `bearer-token`, `connection-string`,
  `otpauth-uri` and `generic-token` are structural or protocol-level formats
  (RFC 7468, RFC 7519, RFC 6750, RFC 3986, the otpauth URI convention, and
  project masking policy respectively), not credentials any one provider
  issues. Their family ids use the `generic:` prefix instead of a provider id.

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
`note` says so plainly. Extending the taxonomy is a data change: add a
`families[]` entry with a `sources`/`note` trail, never assert a family
without one.

## Current counts

79 families across 34 providers plus 6 non-provider-specific formats; 63
carry at least one detector, 16 currently do not (counts as of 2026-09-21;
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
