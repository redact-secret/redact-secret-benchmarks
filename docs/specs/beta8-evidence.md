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
  `eval:classify` skips arrival ids because a support status describes a
  product detector.

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
(inside `stripe-token`), `github-fine-grained-pat`, `notion-integration-token`
and the context-gated `pinecone-api-key-legacy`.

Twins are scoped to their declared family. When a product finding on an
arrival family's twin is attributed to a *different* known family (for
example `github-token` on a `github-fine-grained-pat` twin), the twin records
`coDetected` rather than a false alarm. For an arrival family that the product
already catches through a shared detector (#211, parts of #212), twin
discrimination is therefore an upper bound: read it together with the
co-detection count and the open ledger rows, never on its own. `validateBeta8` and
`tests/beta8.test.mjs` enforce this.

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
`context-48`. `npm run beta8:profiles` counts every fixture in every corpus
that targets a declared family and prints the remaining debt per cell: total,
positives, independent controls, twin pairs, context-twin pairs, positive axes
and control axes. The floors transcribe #206's draft. The report is advisory
and changes no status. #206 owns the versioned criteria and the fail-closed
gate.
