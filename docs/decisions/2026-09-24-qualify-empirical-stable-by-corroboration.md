---
decision_id: decision-qualify-empirical-stable-by-corroboration
status: accepted
scope: benchmarks
title: Qualify T2 families as empirically stable through independent corroboration
decided_at: 2026-09-24
---

# Qualify T2 families as empirically stable through independent corroboration

Status: accepted, on maintainer direction of 2026-09-24. Amends
[Qualify T2 families empirically without changing their provenance](2026-09-24-qualify-t2-empirically.md)
([#177](https://github.com/redact-secret/redact-secret-benchmarks/issues/177)).
The #205 observation workflow is unchanged.

## Context

#177 changed the evaluation criteria so that a family could reach stable
without a maintainer issuing real credentials one by one. The intended lever
was more and better fixtures. As implemented, #177 and #205 required at least
five provider-issued observations from two accounts on two dates before any
T2 family could be `Stable · Empirically qualified`. No T2 family has an
observation. Two legacy families (Heroku, Confluent) can no longer be issued,
and the #213 portfolio estimated about 70 maintainer-issued credentials for the
17 registry T2 families. The observation gate had become the ceiling on
support status, which is the ceiling #177 set out to remove.

Most of those families already carry the evidence a reviewer would accept: a
pinned peer rule, the provider's own code or a provider example, and a dated
research pass (#215) that lists sources and caveats.

## Decision

A T2 family qualifies for the empirical profile through either of two routes.
Every other empirical gate applies to both routes.

**Corroborated route (new, required unless observed).** The family's record in
`benchmarks/support/empirical-observations.json` carries:

- at least **3 corroboration references**, each a verified, dated URL that
  corroborates the shape the contract freezes (a rule for a sibling shape
  does not count);
- from at least **3 distinct owners** (a scanner vendor, the provider, a third
  party, this project's research);
- in at least **2 corroboration classes other than a summary class**. The
  classes are `peer-scanner-rule`, `provider-owned-code`, `provider-example`,
  `independent-implementation` and `independent-research`.
  `independent-research` is a summary class: it counts as a reference and as an
  owner, never as a class.

Every `peer-scanner-rule`, `provider-owned-code` and
`independent-implementation` reference on GitHub must be pinned to a tag or
commit. The validator rejects a branch URL, so the cited code cannot change
after it is cited. Documentation pages are dated by `observedAt` instead.

**Observed route (#205, unchanged, optional).** Five structural-only
provider-issued observations across two pseudonymous subjects and two issuance
dates, plus two corroboration classes (summary class excluded). Observations,
when present, are validated exactly as #205 defines: schema, `rawValueRetained:
false`, pseudonymous subjects, family match, fixed diagnostics. A partial
observation set neither qualifies a family nor blocks it.

**Gates common to both routes, unchanged:**

- the 40-fixture `stable-empirical` profile, or the 48-fixture
  `context-constrained-empirical` profile with no bare-value claim;
- zero twin, benign, mutation, metamorphic and differential failures;
- explicit `uncertainty` and `supportedContexts`.

**Contradictions.** Each one is recorded, never deleted, with one of three
statuses:

- `unresolved` blocks either route.
- `bounded` means the contract deliberately excludes the disputed shape and
  says how in `bound`.
- `settled` means a provider-owned source in the family's own corroboration
  list (`provider-owned-code` or `provider-example`, named in `settledBy`)
  decides the question and the contract follows it. A tool rule, blog, forum
  reply or unmerged proposal can never settle a contradiction.

Examples of how this plays out:

- Atlassian's 2022 "opaque" staff statement against its 2025 "you can rely on
  ATAT" answer is bounded: the contract anchors only ATAT, and the 2022 post
  predates the format change.
- The Firebase 162–183-character generation is bounded: the contract freezes
  140, and no fixture asserts silence on the longer bodies.
- The Sentry base64url claims are settled by Sentry's own generator.
- A peer-versus-peer dispute on which fixtures take a side, with no provider
  source that decides it, stays unresolved. The Okta `=` byte and the
  Databricks rotation suffix are examples.

**Implicit profile claim.** A T2 family with an empirical record now
implicitly claims the profile its mode names (`shape` claims
`stable-empirical`, `context-constrained` claims
`context-constrained-empirical`). Both profiles are `enforced`, so the #206
cells bind on either route. They no longer apply only when a contract claims
them explicitly. The two profiles' `gates.enforced` flips to true, because the
classifier now enforces the #177 and #205 gates.

**Machine-readable basis.** `evidenceBasis` is derived from the records:
`empirically-observed` only when the observation bar is met, and
`independently-corroborated` otherwise. A basis the records cannot carry is a
classification reason, and the support matrix refuses it as masquerading. The
tier stays T2 on both routes. The UI shows `Stable · Empirically qualified`,
names the basis beside the machine value, and lists corroboration and
observations separately. Documented and empirical stable counts stay split.
T3 and T0 cannot enter either empirical route, whatever the fixture volume or
corroboration.

**Context-twin count (separate fix).** `evidence.ts` counts context twins only
in the `context-edges` corpus, which holds no context-kind twin, so no
context-constrained family can clear `minimumContextTwinPairs` on either
route. That is corrected separately, by counting `mutationKind: 'context'`
(commit `4a807f1`, #213), and this decision depends on it.

## Why this is safe

- Provenance is never relabelled. A corroborated family reads T2,
  `independently-corroborated`, `empirical`. It is never T1, and it never
  reads `empirically-observed` without observations.
- The corroborated route requires more than one voice. Three owners in two
  non-summary classes means scanner rules alone never qualify. Peer rules copy
  one another (#215 found tool shapes "possibly copied from one source"), so
  one reference must come from the provider or from an independent
  implementation.
- Every behavioral gate and fixture cell is unchanged, and the #206 cells now
  bind T2 families that previously escaped them by not claiming a profile.
- No credential material enters the repository. The records hold URLs, owners,
  dates and prose. A test checks that no record contains a substring matching
  its family's contract pattern.

## What it gives up

- **The shape is not checked against the live issuer.** A provider can change
  its format without any corroborating source noticing. The observed route
  remains the stronger basis. Its result stays visible as a separate label,
  and the observed-route shortfall is still reported when neither route
  qualifies.
- **The research is on record, not re-derived.** `observedAt` records when a
  reference was re-read (2026-09-24 for every record here). A later change in
  a cited page is caught only by the next review.
- **Owner distinctness is a proxy for independence.** Several
  `independent-implementation` references share one lineage; for example, the
  Firebase regexes all trace to one 2020 write-up. Each record's
  `uncertainty` says so where the research found it.
- **`settled` is a judgement.** It admits a provider forum answer as a
  `provider-example`, as with Atlassian. A reviewer can reclassify it as
  `unresolved`, which blocks the family, without any code change.

## Consequences

The 17 registry T2 families all have a corroboration record, built from
existing research only and re-verified on 2026-09-24:

- the contracts' own sources;
- benchmarks #231–#235;
- redact-secret #642–#662 and #694–#701;
- the research-pass comments those issues link to.

`eval:classify` was run in published mode (`@redact-secret/core`
0.1.0-beta.7, trufflehog 3.97.4). Four T2 families are now stable through the
corroborated route: `discord-bot-token`, `sentry-org-auth-token`,
`sentry-user-auth-token` and `telegram-bot-token`. The other 13 stay
provisional, and each one's reasons name what remains:

| What remains | Families |
| --- | --- |
| A #206 fixture cell only | `firebase-server-key` (5/10 positive/context cases) |
| Product findings only (#741–#747) | `twilio-auth-token`, `twilio-api-key-secret`, `heroku-api-key-legacy`, `confluent-cloud-api-secret-legacy` |
| Product findings (#741, #747) and fixture cells | `atlassian-api-token` |
| Fixture cells under the context-constrained profile | `datadog-application-key-legacy` |
| Unresolved contradictions and fixture cells | `openai-token`, `databricks-personal-access-token`, `mailchimp-api-key`, `mailgun-api-key`, `okta-api-token` |
| One non-summary class, unresolved contradictions and fixture cells | `postman-api-key` |
