# Beta.8 #207: re-measure after #205 and #206

Issue [#207](https://github.com/redact-secret/redact-secret-benchmarks/issues/207)
was first measured in
[the first-run report](2026-09-24-beta8-207-first-run.md) (PR #238). Since
then, #240 added #205's safe observation records and #241 added #206's
fixture profiles and coverage-debt report. This page re-measures the twelve
#207 families on that tree. It records where each family stands and what
still blocks it. It is a measurement, not a product claim (`AGENTS.md`
boundary rule). It changes no fixture, expectation or contract, and the
corpus hash is unchanged.

## Run

- Benchmark: `develop` at `85dc5604892243111aa2230b4081e82e168c86b7`, clean
  tree, `npm ci`.
- Product: published `@redact-secret/core` **0.1.0-beta.7**, default
  detectors (**published mode**, not a candidate build).
- Peers: gitleaks 8.30.1, trufflehog **3.97.4** (Homebrew keg first on `PATH`,
  version printed in the same shell as each run), flare-redact 1.6.1.
- Corpus `beta8-207`: 348 fixtures, SHA-256
  `8b886af52072dcca835c672295e3d0daab273d3ed9421e41340f38720d3fc131`. It is
  unchanged since `faa02f0`, so no review-ledger remap was needed.
- Commands: `npm run eval:classify`, `npm run beta8:profiles`,
  `npm run profiles:check`, and
  `npm run eval -- --method=differential,twin,benign --detector=<the twelve>`
  (and `--method=metamorphic,mutation`). The ledger status of every
  review-queue id was read with the same seed and scanners as
  `npm run queue:check`.

`eval:classify` (published mode, trufflehog 3.97.4) gives **4 stable**
(documented 4, empirical 0), 52 provisional, 1 pending, 0 unsupported of 57
families. The stable four are `anthropic-token`,
`azure-devops-personal-access-token`, `datadog-application-key` and
`notion-token`. None of the twelve #207 families is stable. All twelve are
`provisional`.

## Per-family table (new #207 fixtures only)

"Flagged" means any finding, as in the first run. For twins this includes
sibling co-detection, which a scoped twin does not count as a failure.

| Family | Positives | redact-secret exact | gitleaks exact | trufflehog exact | Twins flagged (rs/gl/th) | Controls flagged (rs/gl/th) |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| supabase-token | 7 | 7 | 5 | 0 | 3 / 3 / 0 | 0 / 1 / 0 |
| atlassian-api-token | 10 | **0** (10 partial) | 10 | 5 | 0 / 1 / 1 | 1 / 0 / 0 |
| firebase-server-key | 10 | 10 | 0 | 0 | 0 / 0 / 0 | 0 / 1 / 0 |
| sentry-org-auth-token | 7 | 7 | 5 | 0 | 3 / 0 / 0 | 0 / 1 / 0 |
| sentry-user-auth-token | 7 | 7 | 7 | 7 | 1 / 7 / 1 | 0 / 2 / 0 |
| telegram-bot-token | 7 | 7 | 2 | 3 | 0 / 1 / 0 | 0 / 0 / 0 |
| discord-bot-token | 7 | 7 | 4 | 0 | 0 / 3 / 0 | 0 / 2 / 0 |
| twilio-auth-token | 11 | 11 | 8 | 0 | 1 / 2 / 0 | 1 / 2 / 0 |
| twilio-api-key-secret | 12 | 12 | 8 | 0 | 0 / 2 / 0 | 1 / 3 / 0 |
| heroku-api-key-legacy | 13 | 11 (2 missed) | 7 | 10 | 2 / 6 / 1 | 1 / 6 / 6 |
| confluent-cloud-api-secret-legacy | 11 | 11 | 5 | 0 | 2 / 7 / 0 | 1 / 3 / 0 |
| bearer-token | 10 | 10 | 2 | 0 | 0 / 0 / 0 | 1 / 1 / 0 |

Every redact-secret column matches the first run. Two gitleaks cells moved:
`supabase-token` positives went from 4 to 5 exact, and `discord-bot-token`
went from 0 to 4 exact positives, 3 flagged twins and 2 flagged controls. All
of the new gitleaks hits are `generic-api-key` matches (mapped to
`generic-token`). The corpus did not change, and this re-measure did not
trace the cause. The peer columns are comparison input, not truth.

Twins that fail in their own family are still only `supabase-token`'s three.
All 43 open ledger rows from the first run are still open. No row is missing:
`queue:check` passes.

## The two profile counters, reconciled

`npm run beta8:profiles` reports "debt none" for all twelve families.
`docs/generated/fixture-profile-coverage.md` (#206) reports positive/context
debt for six of them. Both are correct for what they count. They differ in
two ways:

1. **Positive definition.** The Beta.8 draft counter
   (`benchmarks/lib/beta8/profiles.ts`) counts every secret-bearing non-twin
   fixture as a positive. #206's counter (`measureFixtureCells` in
   `benchmarks/support/profiles.ts`) counts a positive that anchors a twin
   pair inside that pair, not as a positive/context case (its `unit`: "a
   positive/context case is a secret-bearing fixture with no twin"). For
   `atlassian-api-token` that is 13 positives − 8 twin anchors = 5.
2. **Target selection.** The draft counter measures each family against the
   profile #207 declared (`benchmarks/lib/beta8/207.ts`). #206 measures a
   family against the profile its contract claims (`fixtureProfile`), or
   `stable-documented` for a T1 contract with a provider source, and
   otherwise against `arrival-provisional`. No #207 contract declares
   `fixtureProfile`, so the eleven non-T1 families are measured against the
   24-fixture arrival cells, not empirical-40 or context-48.

Axis ids also differ. #206 uses the fixture `group` and the benign taxonomy.
The draft uses `contextAxis` and `controlAxis()`. For these twelve families
that changes no outcome.

**The #206 counter governs.** It is the versioned criteria that
`classifyFamilySupport` reads and that `profiles:check` enforces in CI. The
draft counter's own header says it is advisory and that #206 owns the gate.
Neither counter decides support status for these families today. The
arrival and documented profiles have `enforcement: reported`, and no #207
contract makes an explicit claim, so the debt is published without being
binding. What keeps the families provisional is `status-criteria.json`
(below).

| Family | #206 target (debt) | Debt against the intended #206 profile | Draft counter |
| --- | --- | --- | --- |
| supabase-token | stable-documented (positive/context 5/6) | same: 5/6 | none |
| atlassian-api-token | arrival-provisional (5/6) | stable-empirical: 5/10 | none |
| firebase-server-key | arrival-provisional (5/6) | stable-empirical: 5/10 | none |
| sentry-org-auth-token | arrival-provisional (none) | stable-empirical: none | none |
| sentry-user-auth-token | arrival-provisional (none) | stable-empirical: none | none |
| telegram-bot-token | arrival-provisional (none) | stable-empirical: none | none |
| discord-bot-token | arrival-provisional (none) | stable-empirical: none | none |
| twilio-auth-token | arrival-provisional (none) | context-constrained-empirical: none | none |
| twilio-api-key-secret | arrival-provisional (none) | context-constrained-empirical: none | none |
| heroku-api-key-legacy | arrival-provisional (3/6) | context-constrained-empirical: none | none |
| confluent-cloud-api-secret-legacy | arrival-provisional (1/6) | context-constrained-empirical: none | none |
| bearer-token (T3) | arrival-provisional (4/6) | none eligible (T3) | none |

A third counter matters once a context family is qualified.
`status.ts`'s `empirical.contextConstrained.minimumContextTwinPairs` (10)
reads `contextTwinPairs` from `benchmarks/support/evidence.ts`, which counts
only twins in the `context-edges` corpus. The ten context twins per family in
`beta8-207` (`mutationKind: 'context'`) therefore count as 0 there, even
though #206's cell counts them. It does not bind today because no context
family has chosen a mode. It will bind as soon as one does. It is a follow-up
for the evidence code, not a corpus change.

## Where each family stands

Observation debt is measured against #205's gate: at least 5
provider-issued observations, 2 pseudonymous subjects, 2 issuance dates and
2 corroboration classes, plus an explicit mode, uncertainty and supported
contexts. `benchmarks/support/empirical-observations.json` holds **no family
records**, so every T2 family has all of that debt.

| Family | Tier · route | Observation debt | Open ledger rows | Other classifier blockers | Product finding |
| --- | --- | --- | ---: | --- | --- |
| supabase-token | T1 · documented | none (T1) | 8 | 3 twin failures; 6 mutation (the same 3 twins) | [#742](https://github.com/redact-secret/redact-secret/issues/742) |
| atlassian-api-token | T2 · empirical | 0/5, 0/2, 0/2, 0/2 | 22 | 5 twin failures, 1 benign false alarm, 77 metamorphic, 56 mutation (all from the partial span and the account id) | [#741](https://github.com/redact-secret/redact-secret/issues/741), [#747](https://github.com/redact-secret/redact-secret/issues/747) |
| firebase-server-key | T2 · empirical | 0/5, 0/2, 0/2, 0/2 | 0 | none | none |
| sentry-org-auth-token | T2 · empirical | 0/5, 0/2, 0/2, 0/2 | 0 | none | none |
| sentry-user-auth-token | T2 · empirical | 0/5, 0/2, 0/2, 0/2 | 0 | none | none |
| telegram-bot-token | T2 · empirical | 0/5, 0/2, 0/2, 0/2 | 0 | none | none |
| discord-bot-token | T2 · empirical | 0/5, 0/2, 0/2, 0/2 | 0 | none | none |
| twilio-auth-token | T2 · context | 0/5, 0/2, 0/2, 0/2 | 2 | 1 benign false alarm; 7 metamorphic and 1 mutation (the same control) | [#744](https://github.com/redact-secret/redact-secret/issues/744) |
| twilio-api-key-secret | T2 · context | 0/5, 0/2, 0/2, 0/2 | 1 | 1 benign false alarm; 7 metamorphic and 1 mutation (the same control) | [#746](https://github.com/redact-secret/redact-secret/issues/746) |
| heroku-api-key-legacy | T2 · context | 0/5, 0/2, 0/2, 0/2; no new legacy key can be issued | 2 | 1 benign false alarm; 21 metamorphic and 3 mutation (the 2 misses and the URL control) | [#743](https://github.com/redact-secret/redact-secret/issues/743) |
| confluent-cloud-api-secret-legacy | T2 · context | 0/5, 0/2, 0/2, 0/2; no new legacy secret can be issued | 7 | 1 benign false alarm; 7 metamorphic and 1 mutation (the same control) | [#744](https://github.com/redact-secret/redact-secret/issues/744) |
| bearer-token | T3 · context | not applicable (T3 is not eligible for stable) | 1 | 1 benign false alarm; 7 metamorphic and 1 mutation (the same control) | [#745](https://github.com/redact-secret/redact-secret/issues/745) |

Every metamorphic and mutation hard failure above was traced to a fixture
that is already a product finding, re-run through the envelope transforms.
There is no independent robustness failure. Of the 43 open ledger rows, 35
are the product findings and are now linked to their known-gap records. The
other 8 are `classification-granularity-unasserted` rows (supabase 3,
confluent legacy 5): same byte range, different family label, and the corpus
asserts no label. They need a classification-policy decision, not a product
change. Until they are settled they count as unresolved differential
disagreements for those two families.

### Empirical-40 families: authored, not earned

- **atlassian-api-token: authored, not earned.** No observation records.
  Missing: 5 provider-issued API tokens from at least 2 Atlassian accounts,
  issued on at least 2 dates, 2 corroboration classes, a mode (shape),
  uncertainty (the length the docs call "varied", and the CRC32 tail, which
  is tool evidence) and supported contexts. Product findings #741 and #747
  block it as well.
- **firebase-server-key: authored, not earned.** No observation records.
  Missing: 5 legacy FCM server keys from at least 2 Firebase projects on at
  least 2 dates. New legacy server keys may no longer be issuable, so this
  may be reachable only with keys a maintainer already holds. Record that in
  the family uncertainty if so. Also missing: 2 corroboration classes, mode,
  uncertainty (140-character body vs Google's 175 total, and the late-2016
  162/167/183 bodies) and contexts. The #206 positive/context cell is also
  short (5 of 10 for stable-empirical).
- **sentry-org-auth-token: authored, not earned.** No observation records.
  Missing: 5 organization tokens (`sntrys_`) from at least 2 Sentry orgs on
  at least 2 dates, 2 corroboration classes, mode, uncertainty (RFC 0091 is
  the only source, standard vs url-safe base64, length 147–191) and contexts.
- **sentry-user-auth-token: authored, not earned.** No observation records.
  Missing: 5 user tokens (`sntryu_`) from at least 2 accounts on at least 2
  dates, 2 corroboration classes, mode, uncertainty (unprefixed legacy
  tokens) and contexts.
- **telegram-bot-token: authored, not earned.** No observation records.
  Missing: 5 bot tokens from at least 2 accounts (BotFather) on at least 2
  dates, 2 corroboration classes, mode, uncertainty (34 vs 35 secret width,
  the `AA` lead, id growth) and contexts.
- **discord-bot-token: authored, not earned.** No observation records.
  Missing: 5 bot tokens from at least 2 applications/accounts on at least 2
  dates, including at least one bot created after 2022-07-22 for the 26-char
  first segment, plus 2 corroboration classes, mode, uncertainty (59 vs
  68–72 total width) and contexts.

The five T2 context families (Twilio ×2, Heroku legacy, Confluent legacy)
face the same observation gate in `context-constrained` mode. Heroku and
Confluent legacy credentials cannot be newly issued. For them, pre-cutover
keys a maintainer already holds are the only route. If none exist, the
measured blocking reason is permanent and should be recorded as such.

## Product findings promoted

Every first-run finding reproduces on the published 0.1.0-beta.7 and in a
from-scratch minimal case. No open product issue covered any of them
(#702 is about provider-named assignments and `warn`; #468 and #714 are
closed fixes whose gaps these are). Each finding went through the
`promote-finding` skill to `promoted`. The records are in
`benchmarks/known-gaps.json`, with candidate `sourceCommit` `2b98027b…`
(the v0.1.0-beta.7 tag) and corpus hash `8b886af5…`.

| Known-gap record | Product issue | Kind | Fixtures | Proposed manifest record |
| --- | --- | --- | ---: | --- |
| `product-741` | [#741](https://github.com/redact-secret/redact-secret/issues/741) Atlassian `=`+8-hex tail left exposed | false negative | 10 | `benchmark-gap-207-atlassian-crc32-tail` |
| `product-742` | [#742](https://github.com/redact-secret/redact-secret/issues/742) Supabase layout twins flagged | false positive | 3 | `benchmark-gap-207-supabase-layout-twins` |
| `product-743-multi-line` | [#743](https://github.com/redact-secret/redact-secret/issues/743) Heroku legacy missed in multi-line `.netrc` and `heroku auth:token` output | false negative | 2 | `benchmark-gap-207-heroku-legacy-multi-line` |
| `product-743-url-path` | [#743](https://github.com/redact-secret/redact-secret/issues/743) Heroku app UUID in an API URL path | false positive | 1 | `benchmark-gap-207-heroku-legacy-url-path` |
| `product-744` | [#744](https://github.com/redact-secret/redact-secret/issues/744) md5 / sha256 digests on a provider line | false positive | 2 | `benchmark-gap-207-labelled-digest-controls` |
| `product-745` | [#745](https://github.com/redact-secret/redact-secret/issues/745) Bearer placeholder of 16+ characters | false positive | 1 | `benchmark-gap-207-bearer-long-placeholder` |
| `product-746` | [#746](https://github.com/redact-secret/redact-secret/issues/746) generic-token on Twilio SK/AC SIDs | false positive | 1 | `benchmark-gap-207-generic-twilio-sid` |
| `product-747` | [#747](https://github.com/redact-secret/redact-secret/issues/747) telegram-bot-token on an Atlassian account id | false positive | 1 | `benchmark-gap-207-telegram-atlassian-account-id` |

Notes that carry over into the issues:

- The minimal cases showed two things the first run did not. The Bearer
  false positive depends on length: placeholders under 16 characters are
  already clean. And `generic-token` flags an `AC` SID on its own after
  `credentials:`, not only the SK+AC pair.
- #743, #745 and #746 may be settled as policy decisions (same-line keyword
  gate, placeholder policy, high-signal names). Each issue says so, and asks
  that a policy outcome be recorded as `policy-decision`, not by changing the
  benchmark expectation.
- For #747, the benchmark's own `telegram-bot-token` contract
  (`^[0-9]{5,}:[A-Za-z0-9_-]{34,}$`) also admits the account id. Tightening
  it is benchmark follow-up. The contracts are frozen for this measurement.

Canonical fixtures are proposed in each issue and not authored. The product
repository's `resolve-issue` owns that step, and the product manifest record
does not exist yet.

## Scope amendment

The 348 added assignments are 28 above #207's 280–320 range. The reviewed
amendment is drafted as
[a proposed decision](../decisions/2026-09-24-amend-207-scope-to-348-assignments.md),
awaiting maintainer review. The count, from the corpus:

- baseline correction −4 (`bearer-token` started at 15, not 11);
- profile choice +24 net;
- positive-axis labelling +5 (discord);
- 11 fixtures authored above the floor minimum.

It recommends not trimming, because #206's counter already shows
positive/context debt for three of these families.

## Human-only checklist (#205 capture)

Only a maintainer can do this, on a local machine, with credentials they
issue themselves. Nothing here was run on a real credential, and no
observation record was written. The workflow is
`scripts/capture-empirical-observation.ts` (`npm run observations:capture`),
documented in `docs/specs/empirical-qualification.md`.

For each empirical-40 family (and optionally the Twilio pair):

1. Issue a credential in a provider account or project you control. Use a
   separate account or project for at least one of the five, and a
   different day for at least one.
2. In a local terminal that is not being recorded (no CI, no screen
   capture, no AI session), run for example:

   ```console
   npm run observations:capture -- \
     --provider=sentry --family=sentry-user-auth-token \
     --issued-at=YYYY-MM-DD --issuance-route=user-settings \
     --subject-kind=account --subject-id=subject-account-a \
     --prefix=sntryu_ --checksum-behavior=unknown \
     --revoked-after-observation=true
   ```

   Paste the credential only at the hidden prompt. The command refuses
   credential arguments and piped input.
3. Revoke the credential right after capture, where the provider allows it.
   Otherwise pass `--revoked-after-observation=false` and note that in the
   family uncertainty.
4. Review the single JSON observation it prints. It contains lengths,
   segment lengths, alphabet classes, separators and checksum behavior, and
   no value. Then add it to the family's record in
   `benchmarks/support/empirical-observations.json`.
5. Author the family record once: `mode` (`shape` for the six empirical-40
   families, `context-constrained` for Twilio), `supportsBareValues`,
   `uncertainty` (carry over the research caveats listed above),
   `supportedContexts`, and at least two `corroboration` classes with
   references (for example `peer-scanner` with the gitleaks or trufflehog
   rule, `independent-implementation`, `public-provider-sample` or
   `maintainer-reproduction`). Record any disagreement in `contradictions`.
   Never delete a dissenting observation.
6. Run `npm test`, then `npm run eval:classify` with trufflehog 3.97.4, and
   state the mode.

Known limits of the capture tool for these shapes (describe them in the
record; do not work around them by editing the value):

- It splits segments only on `-`, `_` and `.`. Telegram's and Firebase's `:`
  separator, and Atlassian's `=`, show up as `mixed-ascii`, not as
  separators.
- Base64url bodies (Atlassian, Discord, Telegram, Firebase) can contain `-`
  or `_`. Those split into extra segments, and two adjacent ones make the
  tool refuse with `empty-segment`. If that happens, skip that credential
  and issue another. Do not trim or alter it.
- `--prefix` must be known independently and shorter than the value:
  `ATATT` (Atlassian), `sntrys_` / `sntryu_` (Sentry), `AAAA` (Firebase).
  Telegram and Discord have no fixed prefix, so omit `--prefix`.

The other hands-on corroboration checklists from the first run still apply
and are still optional: #231, #643, #646, #649 and #658–#662.

## What is not done

- No product code was changed, and no product-repo PR was opened.
- No fixture, expectation, contract or profile claim was changed. Adding
  `fixtureProfile` claims to the #207 contracts would make #206 measure the
  intended profile. It is left to a follow-up because it changes contracts.
- The `context-edges`-only context-twin count in
  `benchmarks/support/evidence.ts` is recorded above, not changed.
