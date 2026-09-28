# Beta.11 A: fixture independence baseline and family selection

**Result:** frozen before any Beta.11 family fixture was authored. Published
`0.1.0-beta.9` reads 61 stable / 23 provisional / 2 pending of 86 families
(published mode); candidate `redact-secret@9ab0fa0` reads 64 / 20 / 2 (candidate
mode), both with TruffleHog 3.97.4 and Gitleaks 8.30.1. The 1,424 registered
positives carry 976 distinct secret values; 857 raw positive axes are 778
once axes that only re-wrap one value are merged. Fifteen families are
selected for #379, with a 230-file ledger. No status, expectation, envelope,
tier or profile floor changed.

Issue: [#377](https://github.com/redact-secret/redact-secret-benchmarks/issues/377)
(epic [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376);
product research [redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860)).
Ledger consumed by [#379](https://github.com/redact-secret/redact-secret-benchmarks/issues/379).

Files in this directory:

- [`beta-11-family-axis-ledger.json`](beta-11-family-axis-ledger.json): the frozen selection, per-family positive/benign/twin axes, reserve and exclusions. This is the input for #379.
- [`beta-11-fixture-independence-audit.json`](beta-11-fixture-independence-audit.json): full output of `npm run audit:independence` (clusters, twin audit, format overlaps, per-family independence, both modes' per-family state and failure summaries). It holds ids, counts and truncated SHA-256 cluster keys, never fixture content.
- [`beta-11-candidate-evidence-9ab0fa0.json`](beta-11-candidate-evidence-9ab0fa0.json): the validated `candidate-evidence-v1` from `benchmark:candidate`.

## Pinned inputs

| Input | Identity |
| --- | --- |
| Benchmarks revision measured | `0a73b7db198c628dde74fb815d3029eb6c0acf42` (`origin/develop`, clean) for `bench`, `eval:classify` and `benchmark:candidate`. The audit JSON was written at `2b4b70cf886b4a325f4f66a595b01b29b0337eeb`, which differs only by the audit tooling (no fixture, generator or contract change). |
| Fixture semantic index | schema 1, 3,533 fixtures, SHA-256 `c295bd99b0850d8b34b3b618258e6891e8f72811b858d18c65fecfe81123aa7e`; taxonomy `b1032d4d4991599d6fccb82599d4e3f7280e7254496982e2a48f103e40ec49c8` |
| Candidate corpus hash (measurement-v4) | `fbc432625be7203ae36138c36fb30cab7a194b60510e6996a4d5898a70c09af4`; lockfile `97692c4cd77c448583d28ea071290d574a7cbf71ef6962853e490732f4af5aec` |
| Fixture profiles | `benchmarks/support/fixture-profiles.json` profiles version 1 at the revision above |
| Published product | `@redact-secret/core` `0.1.0-beta.9` (the `qualification/suite-v1.json` pin) |
| Candidate product | `redact-secret` `9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7` (`origin/main`, clean), declared `0.1.0-beta.10`. Tarball SHA-256: core `4c1a81b0a96e9d3343a696a7d2e60e9080ed95ccff20ec9acbe140619324aebf`, node (darwin-arm64) `be2c9816f54dc15b480711f2059c61962a0ec60414ea7db529981d6e1cbece47`, wasm `5508eec4473b30aba98c967b8fd31c677280db9dd506e680e206bdef085fea0c`. `benchmark:candidate` run `84d15c23-26da-4edc-b2a6-92e7525b381a`, complete, 3,533/3,533 fixtures, `eval:validate` passed. |
| Peers | Gitleaks `8.30.1`, TruffleHog `3.97.4`, from `npm run peers:provision` (read-only `.peer-bin`, archive digests checked against `scanners/peer-checksums.json`). The Homebrew `3.97.4` Cellar binary had self-updated and printed `3.97.9`; it was never used. Classification reused the checked-in peer snapshots (gitleaks `1d88959d…`, trufflehog `516361420c…`, input `76f52455…`). |
| Runs | `eval:classify` published: redact-secret run `9a1147b2-7e26-41d9-b709-6dedbe49175b`; candidate: `5014ffb4-ccaa-4901-a949-a905ec2f15a9`. `bench` published `2026-09-28T13:44:32.462Z-97efd4`; candidate `2026-09-28T13:44:39.151Z-78c55d`. `support-status.json` SHA-256: published `91baeb5e…9e`, candidate `d6445544…52`. |

## Reproduce

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH" && trufflehog --version --no-update   # 3.97.4
# product checkout at 9ab0fa02…, clean:
npm run benchmark:candidate -- --benchmark-repo <benchmarks clone> \
  --benchmark-ref 0a73b7db198c628dde74fb815d3029eb6c0acf42 --output-dir <out>
# benchmarks checkout at 0a73b7db…, clean (A = <out>/artifacts):
npm run eval:classify -- --output=<pub>/support-status.json
npm run bench && cp public/results/*.json <pub>/results/
npm run eval:classify -- --output=<cand>/support-status.json --candidate-package=$A/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=$A/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz --candidate-wasm-package=$A/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7
npm run bench -- <the same four --candidate-* flags> && cp public/results/*.json <cand>/results/
npm run audit:independence -- --out=beta-11-fixture-independence-audit.json --markdown=family-table.md \
  --published-status=<pub>/support-status.json --published-results=<pub>/results \
  --candidate-status=<cand>/support-status.json --candidate-results=<cand>/results
```

#379 reruns the last command after its fixtures land; the corpus half needs no
scanner at all.

## Before state

Per kind × tier from the `bench` rows (spans for `must-redact`/`policy`, files
for `must-not-flag`; no cross-group total). Co-detection is a must-not-flag file
where another family's finding fired; it is recorded, not scored as a false
alarm for the family (`benchmarks/lib/lattice.ts`).

| Group | Published beta.9 | Candidate 9ab0fa0 |
| --- | --- | --- |
| must-redact / T1 | 40 of 563 spans leaked; 0 collateral bytes | 0 of 563 leaked; 0 collateral |
| must-redact / T2 | 16 of 450 leaked; 0 collateral | 0 of 450 leaked; 0 collateral |
| policy / T3 | 20 of 424 leaked; 0 collateral | 4 of 424 leaked; 0 collateral |
| must-not-flag / T1 | 0 of 9 flagged | 0 of 9 flagged |
| must-not-flag / T2 | 1 of 1,211 flagged; 132 co-detected | 1 of 1,211 flagged; 154 co-detected |
| must-not-flag / T3 | 10 of 834 flagged; 21 co-detected | 2 of 834 flagged; 26 co-detected |

Action split, distinct fixtures (the audit's `failureTotals`):

| Failure | Published | Candidate |
| --- | --- | --- |
| must-redact span leaked | 56 fixtures, 44 family-axes | 0 |
| policy span leaked | 20 fixtures, 12 family-axes | 4 fixtures, 4 family-axes (deepgram ×2, exa ×2) |
| must-redact span covered only by `warn` | 12 fixtures, 10 family-axes | 12 fixtures, 10 family-axes (new-relic-license-key 7, mailchimp 2, mailgun 2, okta 1) |
| policy span covered only by `warn` | 39 fixtures, 28 family-axes | 44 fixtures, 32 family-axes |
| must-not-flag false alarm, `redact` | 11 fixtures, 8 family-axes | 3 fixtures, 3 family-axes (anthropic-admin01 placeholder, ai21 near-miss, exa placeholder) |
| must-not-flag co-detection, `redact` / `warn` | 146 / 7 fixtures | 173 / 7 fixtures |

A `warn` is detection, not sanitization (#376): the 12 must-redact fixtures
above are detected but left readable under the default action. No fixture
authors `expectedAction: warn` outside `policy-qualified-credentials`, so no
warn-only row here is an authored expectation.

### Strengths

- Candidate main leaks no `must-redact` span at T1 or T2 and adds no collateral byte anywhere; the published 56 leaks (anthropic api01/admin01, AWS Bedrock long/short, together, tavily, elevenlabs) are all fixed on main.
- 37 documented and 24 empirical families are stable in published mode (39 / 25 in candidate mode), most with zero twin, metamorphic, mutation and differential blockers in both modes.
- In `eval:classify`, twin failures fall from 41 pairs (published) to 2 (candidate, both deepgram) and benign-method false alarms from 10 to 2; in `bench`, flagged benign files fall from 11 to 3.

### Gaps

- **Output action.** 12 must-redact fixtures and 44 policy fixtures are only warned on candidate main, unchanged or worse than beta.9. New Relic license key is the only T1 family with must-redact warn-only rows (7 fixtures on 5 axes).
- **Candidate regressions visible in candidate mode.** anthropic-token reads stable (published) but provisional (candidate) on 6 new differential disagreements; anthropic-api01 (2 → 19), openai-admin (7 → 16) differential rows grow. Co-detection on family negatives grows from 146 to 173 fixtures. These are review-ledger items or product behavior, not fixture gaps.
- **Profile debt on candidate:** anthropic-admin01 and anthropic-api01 positives 3/6, openai-admin positives 2/6, ai21 3/6, cohere/deepgram/mistral `positiveCases` 0/1 under the context-constrained-empirical profile, connection-string control axes 3/4, otpauth-uri three cells, vercel five cells.
- **Known gaps** open in the lifecycle and touching measured families: product-553 (bearer/sendgrid, policy-decision), product-739 (confluent current generation, policy-decision), product-820 (connection-string URL userinfo, verified; fixtures sit in `beta9-external-inputs`, outside this corpus).
- `exa-api-key` is an arrival target outside the 86 scored families; it shows 2 policy leaks and a placeholder false alarm on candidate. Recorded, not selected (no scored contract).

The full per-family table (86 rows, both modes) is in the appendix.

## Fixture identity and independence

Unique axes are reported beside raw counts. Definitions are in
`benchmarks/lib/fixture-independence.ts` and tested in
`tests/fixture-independence.test.mjs`.

| Measure | Raw | Unique |
| --- | ---: | ---: |
| Positives (must-redact + policy, family-attributed) | 1,424 | 976 distinct secret values; ≤948 independent in value *and* skeleton |
| Positive axes | 857 | 778 after merging axes joined by one value (133 same-value reuses across axes) |
| Non-twin benign controls | 1,143 | 971 distinct skeletons |
| Twins audited | 832 | 54 flagged by the heuristic, 9 confirmed multi-property on review (below) |
| Failing rows, candidate (all types) | 243 family-attributed rows | 148 (family, failure type, axis) cells |

**Duplicated bytes.** 23 clusters, 50 fixtures, are byte-identical under
different ids. 15 are reference controls repeated between a Beta.8 corpus and
`detector-coverage` or between sibling families (both Bedrock keys, both
Pinecone keys, both Sentry tokens, both Datadog application keys); 6 are
`milestone-6-closed` guards identical to `reference-syntax` cases; one is a
placeholder shared by the two Bedrock families. The last pairs a twin with a
benign control: `sendgrid-regressions--base62-bare-twin` equals
`sendgrid-regressions--short-secret`, so one file is counted as both a twin
and a benign control.

**Same value counted as distinct axes.** 184 clusters (639 positives) share a
secret value; 5 cross families (connection-string/generic-token and
bearer/generic/sendgrid). Within families, the `context-edges` and
`token-contexts` wrappers re-use one value per family: github-token has 24
such reuses (22 raw axes, 10 independent), sendgrid-token 21 (9 → 4), and
datadog-api-key, datadog-application-key-legacy, discord, grafana ×2,
microsoft-entra, new-relic-user, sentry ×2, telegram, twilio ×2 have 7 each.

**Common templates and seeds.** 199 skeleton clusters cover 1,717 fixtures;
118 span several families. The largest are generator wrappers:
`detector-coverage` bare/quoted/unicode-crlf (one skeleton per wrapper across
every family, 228 fixtures in the largest), and the #384e context-gated
generator, whose benign and twin sets for deepgram, cohere, mistral and ai21
are the same templates with the provider name swapped. Swapped-value
templates are regression evidence, not independent samples.

**Positives written from scanner rules.** 333 positives in 18 families cite
only peer-scanner rule sources (TruffleHog, Gitleaks, Nosey Parker,
secretlint) and have no provider source: atlassian, confluent-legacy,
databricks, datadog-app-legacy, discord, heroku-legacy, mailchimp, mailgun,
okta, openai-token, perplexity, postman, sentry ×2, telegram, twilio ×2,
vercel. Separately, 162 family-attributed positives are `detector-coverage`
shape positives generated from a width/alphabet table. These are T2 by construction; they cannot show a gap
the peer rules share.

**Twins that change more than one property.** The heuristic flags 54 of 832
twins (edits outside the value, several separate value edits, or length plus
content). Reviewed one by one:

- 45 are one property expressed more than once or recomputed by design: consistent renames repeated in a file (cohere/mistral model, deepgram SDK factory, slack dotted sections, anthropic underscore delimiters, langfuse hyphens, private-key→certificate header/footer); checksum recomputation (3 Confluent); the Entra length construction (14); Azure DevOps signature offset; and 16 connection-string context twins that delete the `user:password` delimiter, which is the one property the contract's twin source names.
- **9 change several independent properties:** `beta8-384a--openai-admin-api-key-short-{first,second}-segment-twin` shorten one segment *and* replace the other segment's bytes; `common-formats--jwt-eddsa-alphabet-{plain,unicode-crlf}-twin` change the alphabet and add a trailing newline; `common-formats--private-key-ed25519-{plain,unicode-crlf}-twin` swap header, DER body and trailing newline; `policy-qualified-credentials--bearer-token-authorization-header-twin` changes length and content; `beta8-207--bearer-token-{curl,har-entry}-context-twin` rename the header and drop the `Bearer` scheme.

**Benign assertions overlapping a valid issued format.** 212 must-not-flag
fixtures contain an isolated match of some frozen contract pattern (validator
applied). None is exempt; none is a scored own-contract collision (lexical
separability already forbids that).

- 84 are own-contract matches in context-gated families (cohere, deepgram, mistral, travisci; ai21 at T0): by design the value alone is not the signal, so these controls and context twins carry a contract-valid value.
- 114 are cross-family matches of those same permissive patterns (40 hex, 40 alphanumerics, 22 alphanumerics) inside other families' negatives: the public-ID collision surface for context-gated keys.
- **14 place a valid format of a sibling non-gated family inside a family-scoped negative:** anthropic admin01/api01/api03 prefix twins (8), Confluent current-generation twins inside the legacy family (2), an Elevenlabs twin carrying a Stripe-shaped secret (1), an Atlassian account id matching the Telegram bot token pattern (1), and `milestone-6-closed--issue-254-id-{bare,env}` carrying an AWS access key id (2). They are coherent only under family scoping (the other family's finding is `coDetected`, not a false alarm) and must never enter an untargeted benign denominator such as #378's.

**Unique failure axes.** Candidate mode's 243 family-attributed failing rows
reduce to 148 (family, failure type, axis) cells; 180 of the rows are
co-detections. Published mode's 291 rows reduce to 190 cells. Per family, the table in the appendix
prints `Nf/Max` (distinct fixtures / distinct axes).

## Risk ranking

Criteria are reported side by side; there is no weighted score. Ordering rule:
(1) a fixture-level failure on candidate main outranks one seen only on the
published package; (2) within that, `must-redact` before `policy`, then leak,
warn-only, false alarm; (3) then the number of distinct failing axes; (4)
families without a fixture-level failure are ranked by independence debt,
public-ID collision and runtime exposure together, stated per family.
Differential and mutation review items never raise a rank on their own: they
are review-ledger work.

| Rank | Family | Tier | Observed failure (mode) | Ambiguous context | Public-ID collision | Output-action risk | Runtime exposure |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `new-relic-license-key` | T1 | MR warn-only 7f/5ax (both) | low | account/app ids; NRAK- sibling | high (T1 MR only warned) | high |
| 2 | `mailchimp-api-key` | T2 | MR warn-only 2f/2ax (both); differential 4 | medium | list/audience ids, MD5 subscriber hash | high | medium |
| 3 | `deepgram-api-key` | T2 ctx | policy leak 2ax + warn-only 2ax (cand); 7 leaks, 7 twin failures (pub) | high | request/project ids | high | high |
| 4 | `heroku-api-key-legacy` | T2 ctx | policy warn-only 6f/5ax (both) | high | app/release/client UUIDs | medium | medium |
| 5 | `confluent-cloud-api-secret-legacy` | T2 ctx | policy warn-only 6f/4ax (both); co-detected twins 10 | high | key id; current-generation sibling | medium | medium-high |
| 6 | `twilio-auth-token` | T2 ctx | policy warn-only 3f/3ax (both) | high | Account/Messaging SIDs, MD5 | medium | high |
| 7 | `anthropic-admin01-key` | T1 | false alarm on placeholder (both); 6 MR leaks (pub) | low | sibling prefixes (api01/api03) | low | high |
| 8 | `cohere-api-key` | T2 ctx | policy warn-only 1 (cand); leaks 3ax + 2 FA (pub) | high | model/request/dataset ids | medium | high |
| 9 | `anthropic-api01-key` | T1 | 7 MR leaks on 7 axes (pub only) | low | sibling prefixes | — | high |
| 10 | `aws-bedrock-long-term-api-key` | T1 | 11 MR leaks on 9 axes (pub only) | low | IAM alias; short-term sibling | — | very high |
| 11 | `together-ai-api-key` | T2 | 9 MR leaks on 6 axes (pub only) | low | legacy keys | — | high |
| 12 | `openai-admin-api-key` | T2 | none; profile positives 2/6; differential 16 (cand) | low | key ids, org/project ids, sk-proj- | — | very high |
| 13 | `connection-string` | T3 | none; control axes 3/4 | high | user/host/db, generic-token value reuse | envelope policy | very high |
| 14 | `stripe-token` | T1 | none; 25 positives ≤7 independent | low | pk_ publishable, acct_, whsec_ | — | very high |
| 15 | `github-token` | T1 | none; 22 axes → 10 independent | low | App/installation ids, github_pat_ | — | highest |

## Frozen selection and axis ledger

The ledger in [`beta-11-family-axis-ledger.json`](beta-11-family-axis-ledger.json)
names, for each selected family, the new positive contexts (with the expected
action), the non-twin benign controls (with their confusion axis), and the
one-property twins (each with its basis: provider, tool-undisputed or
context). Every item is specific to that family's existing coverage; axes the
family already has are not repeated with a swapped value.

| Family | New positives | New benign | New twins | Focus |
| --- | ---: | ---: | ---: | --- |
| `new-relic-license-key` | 6 | 6 | 4 | redact action in the contexts that only warn; first EU-form and CI positives |
| `mailchimp-api-key` | 5 | 6 | 2 | a second Basic-auth template, URL userinfo, dc-suffix twins |
| `deepgram-api-key` | 6 | 6 | 5 | new skeletons outside the shared #384e generator; header/log action |
| `heroku-api-key-legacy` | 5 | 7 | 4 | UUID sibling controls; warn-only log/prose/url axes |
| `confluent-cloud-api-secret-legacy` | 5 | 6 | 4 | key-id pairing, Kafka client configs |
| `twilio-auth-token` | 6 | 6 | 4 | independent values on log/prose; SID and MD5 collisions |
| `anthropic-admin01-key` | 6 | 7 | 3 | positives debt 3/6; placeholder axis that false-alarms |
| `cohere-api-key` | 5 | 6 | 4 | new skeletons; log action |
| `anthropic-api01-key` | 6 | 6 | 2 | positives debt 3/6; open body upper bound |
| `aws-bedrock-long-term-api-key` | 5 | 5 | 3 | regression guard on the published leak axes |
| `together-ai-api-key` | 4 | 5 | 2 | regression guard; OpenAI-compatible client contexts |
| `openai-admin-api-key` | 6 | 6 | 3 | positives debt 2/6; twins that keep the other segment byte-identical |
| `connection-string` | 6 | 8 | 5 | control-axis debt 3/4; more schemes; twin kinds beyond the delimiter |
| `stripe-token` | 6 | 8 | 4 | authored contexts beyond shape wrappers; pk_/acct_/whsec_ controls |
| `github-token` | 4 | 8 | 4 | independent values per axis; benign breadth (8 today) |
| **Total** | **81** | **96** | **53** | **230 files** |

The epic's planning figure was about 390 files (6 positives, 8 benign and 6
two-file twin pairs per family). The audit lowers it: twins pair with the new
positives (one file each), families whose gap is output action need fewer
contexts, and twins were dropped wherever the mutated property is neither
provider-backed nor undisputed
([decision](../../decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md)).

### Reserve and exclusions

Reserve, in order, if a selected family runs out of genuine axes:
travisci-api-token, mailgun-api-key, mistral-api-key, okta-api-token,
private-key (reasons in the ledger).

Excluded, with reasons recorded in the ledger:

- **beta.10 debt, not duplicated:** slack-user-token (#369), slack-app-level-token (#370), github-fine-grained-pat (#371), stripe-webhook-signing-secret (#372) closed their profile debt; what remains is mutation/differential review (9/3, 3/1, 5/3, 0/2 unresolved on candidate). vercel-token (#373) is blocked on product contract redact-secret#858. Where these families matter here, they appear only as sibling-attribution controls inside github-token and stripe-token.
- **No scored contract:** ai21-api-key and vercel-token (T0); exa-api-key (arrival target only).
- **Review work, not fixtures:** anthropic-token (6 candidate differential disagreements, no fixture failure).
- **Duplicate generator and failure axes:** aws-bedrock-short-term-api-key (covered through the long-term family).
- **Fixed on candidate, lower exposure:** tavily-api-key, elevenlabs-api-key.
- **Product gaps first:** generic-token (four verified open gaps; untargeted benign belongs to #378).
- **Independence debt without failure:** sendgrid-token (recorded for a later cycle).

## What this record does not change

No fixture, expectation, envelope, tier, contract, support status, profile
floor, review-ledger entry or known-gap record changed. The only code added is
the audit (`benchmarks/lib/fixture-independence.ts`,
`scripts/audit-fixture-independence.mjs`, `npm run audit:independence`) and
its tests. No value in this record or its JSON is a credential or derived from
one: only fixture ids, counts, digests and truncated SHA-256 cluster keys.

## Appendix: per-family before state

`Nf/Max` = distinct fixtures / distinct axes. MR = must-redact, pol = policy,
MNF = must-not-flag. Positives: raw / independent upper bound (min of distinct
values and distinct skeletons) / raw axes → independent axes. Blockers are
metamorphic critical / mutation unresolved / differential unresolved from
`eval:classify`. "context-constrained (n)" lists how many supported contexts
the family's empirical record states; the contexts themselves are in the
audit JSON and the support matrix.

| Family | Tier | Status pub → cand | Profile target · candidate debt | Positives raw / ≤indep. / axes → indep. axes | Benign raw / axes | Twins raw (audit-flagged) | Failures, published | Failures, candidate | Twin fail. pub → cand | Metamorphic / mutation / differential, pub → cand | Supported contexts | Open known gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ai21-api-key` | T0 | pending → pending | arrival-provisional · positiveCases 3/6 | 11 / 9 / 8 → 8 | 15 / 5 | 10 (0) | co-detection MNF·redact 3f/2ax; false-alarm MNF·redact 2f/2ax; leak pol 2f/1ax | co-detection MNF·redact 5f/2ax; false-alarm MNF·redact 1f/1ax | 3 → 0 | 36/6/5 → 15/1/1 | bare-value contract | — |
| `anthropic-admin01-key` | T1 | provisional → provisional | stable-documented · positiveCases 3/6 | 9 / 9 / 9 → 9 | 9 / 6 | 6 (1) | co-detection MNF·redact 3f/2ax; false-alarm MNF·redact 1f/1ax; leak MR 6f/6ax | co-detection MNF·redact 5f/2ax; false-alarm MNF·redact 1f/1ax | 4 → 0 | 49/11/21 → 7/1/17 | bare-value contract | — |
| `anthropic-api01-key` | T1 | provisional → provisional | stable-documented · positiveCases 3/6 | 9 / 9 / 9 → 9 | 9 / 6 | 6 (1) | co-detection MNF·redact 2f/2ax; leak MR 7f/7ax | co-detection MNF·redact 4f/2ax | 5 → 0 | 49/60/2 → 0/0/19 | bare-value contract | — |
| `anthropic-token` | T1 | stable → provisional | stable-documented · none | 12 / 9 / 6 → 6 | 8 / 5 | 10 (1) | co-detection MNF·redact 2f/1ax | co-detection MNF·redact 3f/1ax | 0 → 0 | 0/0/0 → 0/0/6 | bare-value contract | — |
| `atlassian-api-token` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 14 → 14 | 19 / 6 | 8 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `aws-access-key` | T1 | stable → stable | stable-documented · none | 12 / 8 / 6 → 6 | 8 / 5 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `aws-bedrock-long-term-api-key` | T1 | provisional → stable | stable-documented · none | 13 / 11 / 11 → 11 | 16 / 6 | 6 (0) | co-detection MNF·redact 1f/1ax; leak MR 11f/9ax | co-detection MNF·redact 2f/2ax | 5 → 0 | 83/56/12 → 0/0/0 | bare-value contract | — |
| `aws-bedrock-short-term-api-key` | T1 | provisional → stable | stable-documented · none | 13 / 11 / 11 → 11 | 15 / 6 | 6 (0) | co-detection MNF·redact 1f/1ax; leak MR 11f/9ax | co-detection MNF·redact 2f/2ax | 5 → 0 | 83/52/13 → 0/0/0 | bare-value contract | — |
| `azure-devops-personal-access-token` | T1 | provisional → provisional | stable-documented · none | 12 / 10 / 10 → 10 | 8 / 5 | 9 (1) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 1f/1ax | 0 → 0 | 0/0/2 → 0/0/2 | bare-value contract | — |
| `bearer-token` | T3 | provisional → provisional | arrival-provisional · positiveCases 5/6 | 19 / 14 / 14 → 14 | 19 / 6 | 14 (3) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | product-553 (policy-decision) |
| `cloudflare-token` | T1 | stable → stable | stable-documented · none | 8 / 5 / 5 → 5 | 10 / 5 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `cohere-api-key` | T2 | provisional → provisional | context-constrained-empirical · positiveCases 0/1 | 15 / 13 / 10 → 10 | 26 / 6 | 17 (1) | co-detection MNF·redact 7f/2ax; false-alarm MNF·redact 2f/1ax; leak pol 4f/3ax | co-detection MNF·redact 8f/2ax; warn-only pol·warn 1f/1ax | 4 → 0 | 42/10/20 → 0/0/3 | context-constrained (2) | — |
| `confluent-cloud-api-secret` | T1 | stable → stable | stable-documented · none | 13 / 11 / 11 → 11 | 8 / 5 | 10 (1) | co-detection MNF·redact 3f/2ax | co-detection MNF·redact 3f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | product-739 (policy-decision) |
| `confluent-cloud-api-secret-legacy` | T2 | provisional → provisional | context-constrained-empirical · none | 14 / 12 / 12 → 12 | 19 / 6 | 15 (2) | co-detection MNF·redact 10f/2ax; warn-only pol·warn 6f/4ax | co-detection MNF·redact 10f/2ax; warn-only pol·warn 6f/4ax | 0 → 0 | 0/0/4 → 0/0/4 | context-constrained (7) | — |
| `connection-string` | T3 | provisional → provisional | arrival-provisional · controlAxes 3/4 | 26 / 12 / 6 → 6 | 16 / 3 | 16 (16) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `databricks-personal-access-token` | T2 | stable → stable | stable-empirical · none | 20 / 16 / 14 → 14 | 15 / 6 | 12 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `datadog-api-key` | T1 | stable → stable | stable-documented · none | 17 / 8 / 13 → 8 | 8 / 6 | 11 (0) | warn-only pol·warn 1f/1ax | warn-only pol·warn 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `datadog-application-key` | T1 | stable → stable | stable-documented · none | 12 / 10 / 10 → 10 | 8 / 6 | 9 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `datadog-application-key-legacy` | T2 | stable → stable | context-constrained-empirical · none | 22 / 13 / 18 → 13 | 14 / 6 | 16 (0) | warn-only pol·warn 2f/2ax | warn-only pol·warn 2f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | context-constrained (4) | — |
| `deepgram-api-key` | T2 | provisional → provisional | context-constrained-empirical · positiveCases 0/1 | 15 / 13 / 9 → 9 | 26 / 6 | 17 (1) | co-detection MNF·redact 5f/1ax; false-alarm MNF·redact 2f/1ax; leak pol 7f/4ax | co-detection MNF·redact 6f/2ax; leak pol 2f/2ax; warn-only pol·warn 3f/2ax | 7 → 2 | 63/16/24 → 14/4/6 | context-constrained (2) | — |
| `digitalocean-token` | T1 | stable → stable | stable-documented · none | 21 / 9 / 5 → 5 | 10 / 4 | 8 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `discord-bot-token` | T2 | stable → stable | stable-empirical · none | 24 / 11 / 14 → 9 | 15 / 6 | 8 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `docker-token` | T1 | stable → stable | stable-documented · none | 16 / 7 / 5 → 5 | 8 / 4 | 16 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `elevenlabs-api-key` | T1 | provisional → stable | stable-documented · none | 13 / 11 / 9 → 9 | 15 / 6 | 10 (0) | co-detection MNF·redact 7f/2ax; leak MR 5f/3ax | co-detection MNF·redact 7f/2ax | 1 → 0 | 41/6/9 → 0/0/0 | bare-value contract | — |
| `firebase-server-key` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 13 → 13 | 19 / 6 | 8 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `fireworks-ai-api-key` | T1 | stable → stable | stable-documented · none | 11 / 9 / 8 → 8 | 16 / 6 | 5 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 2f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `generic-token` | T3 | provisional → provisional | arrival-provisional · none | 46 / 27 / 14 → 12 | 76 / 4 | 10 (0) | warn-only pol·warn 4f/2ax | warn-only pol·warn 4f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `github-fine-grained-pat` | T2 | provisional → provisional | arrival-provisional · none | 11 / 11 / 11 → 11 | 9 / 6 | 5 (0) | co-detection MNF·redact 2f/2ax | co-detection MNF·redact 2f/2ax | 0 → 0 | 0/5/3 → 0/5/3 | bare-value contract | — |
| `github-token` | T1 | stable → stable | stable-documented · none | 67 / 29 / 22 → 10 | 8 / 5 | 42 (0) | co-detection MNF·redact 9f/1ax | co-detection MNF·redact 9f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `gitlab-runner-authentication-token` | T2 | stable → stable | stable-empirical · none | 19 / 17 / 12 → 12 | 16 / 6 | 8 (0) | co-detection MNF·redact 3f/2ax | co-detection MNF·redact 3f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `gitlab-token` | T1 | stable → stable | stable-documented · none | 11 / 8 / 6 → 6 | 8 / 5 | 7 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `google-api-key` | T1 | stable → stable | stable-documented · none | 12 / 10 / 10 → 10 | 8 / 5 | 9 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `grafana-cloud-access-policy-token` | T1 | stable → stable | stable-documented · none | 17 / 8 / 13 → 8 | 8 / 6 | 11 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `grafana-service-account-token` | T1 | stable → stable | stable-documented · none | 17 / 8 / 13 → 8 | 8 / 6 | 11 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `groq-api-key` | T2 | stable → stable | stable-empirical · none | 19 / 17 / 12 → 12 | 14 / 6 | 8 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 3f/3ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `heroku-api-key` | T1 | stable → stable | stable-documented · none | 12 / 10 / 10 → 10 | 8 / 5 | 9 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `heroku-api-key-legacy` | T2 | stable → stable | context-constrained-empirical · none | 16 / 14 / 13 → 13 | 20 / 6 | 13 (0) | co-detection MNF·redact 2f/1ax; warn-only pol·warn 6f/5ax | co-detection MNF·redact 2f/1ax; warn-only pol·warn 6f/5ax | 0 → 0 | 0/0/0 → 0/0/0 | context-constrained (6) | — |
| `huggingface-token` | T1 | stable → stable | stable-documented · none | 11 / 8 / 8 → 8 | 8 / 4 | 7 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `jwt` | T1 | stable → stable | stable-documented · none | 11 / 8 / 8 → 8 | 8 / 6 | 7 (2) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `langfuse-secret-key` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 14 → 14 | 16 / 6 | 8 (1) | co-detection MNF·redact 2f/2ax | co-detection MNF·redact 3f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `langsmith-api-key` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 12 → 12 | 16 / 6 | 8 (0) | co-detection MNF·redact 5f/4ax | co-detection MNF·redact 5f/4ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `linear-token` | T1 | stable → stable | stable-documented · none | 11 / 6 / 5 → 5 | 11 / 4 | 5 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `mailchimp-api-key` | T2 | provisional → provisional | stable-empirical · none | 19 / 15 / 14 → 14 | 14 / 6 | 12 (0) | co-detection MNF·redact 5f/2ax; warn-only MR·warn 2f/2ax | co-detection MNF·redact 5f/2ax; warn-only MR·warn 2f/2ax | 0 → 0 | 0/0/4 → 0/0/4 | shape | — |
| `mailgun-api-key` | T2 | stable → stable | stable-empirical · none | 16 / 12 / 11 → 11 | 16 / 6 | 11 (0) | warn-only MR·warn 2f/2ax | warn-only MR·warn 2f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `microsoft-entra-client-secret` | T1 | stable → stable | stable-documented · none | 20 / 9 / 13 → 8 | 8 / 4 | 17 (14) | co-detection MNF·redact 7f/1ax | co-detection MNF·redact 7f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `mistral-api-key` | T2 | provisional → provisional | context-constrained-empirical · positiveCases 0/1 | 15 / 13 / 10 → 10 | 26 / 6 | 17 (1) | co-detection MNF·redact 8f/2ax; false-alarm MNF·redact 2f/1ax; leak pol 3f/2ax | co-detection MNF·redact 9f/2ax; warn-only pol·warn 1f/1ax | 3 → 0 | 35/8/10 → 0/0/3 | context-constrained (2) | — |
| `neon-api-key` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 11 → 11 | 16 / 6 | 8 (0) | co-detection MNF·redact 2f/2ax | co-detection MNF·redact 2f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `netlify-token` | T1 | stable → stable | stable-documented · none | 10 / 5 / 5 → 5 | 8 / 6 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `new-relic-license-key` | T1 | stable → stable | stable-documented · none | 12 / 8 / 7 → 7 | 8 / 6 | 9 (0) | warn-only MR·warn 7f/5ax; warn-only pol·warn 3f/1ax | warn-only MR·warn 7f/5ax; warn-only pol·warn 3f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `new-relic-user-api-key` | T1 | stable → stable | stable-documented · none | 17 / 8 / 13 → 8 | 8 / 6 | 11 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `notion-token` | T1 | stable → stable | stable-documented · none | 12 / 10 / 10 → 10 | 8 / 5 | 9 (0) | co-detection MNF·redact 1f/1ax; co-detection MNF·warn 1f/1ax | co-detection MNF·redact 1f/1ax; co-detection MNF·warn 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `npm-token` | T1 | stable → stable | stable-documented · none | 10 / 7 / 5 → 5 | 8 / 5 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `okta-api-token` | T2 | provisional → provisional | stable-empirical · none | 16 / 11 / 11 → 11 | 15 / 6 | 9 (0) | warn-only MR·warn 1f/1ax | warn-only MR·warn 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `openai-admin-api-key` | T2 | provisional → provisional | arrival-provisional · positiveCases 2/6 | 9 / 9 / 9 → 9 | 10 / 6 | 8 (2) | co-detection MNF·redact 3f/3ax | co-detection MNF·redact 4f/3ax | 0 → 0 | 0/0/7 → 0/0/16 | bare-value contract | — |
| `openai-token` | T2 | stable → stable | stable-empirical · none | 22 / 11 / 9 → 9 | 15 / 6 | 10 (0) | co-detection MNF·redact 3f/2ax | co-detection MNF·redact 3f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `openrouter-api-key` | T1 | stable → stable | stable-documented · none | 12 / 10 / 9 → 9 | 14 / 6 | 6 (0) | co-detection MNF·redact 3f/3ax | co-detection MNF·redact 3f/3ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `otpauth-uri` | T3 | provisional → provisional | arrival-provisional · positiveCases 2/6, positiveContextAxes 1/4, controlAxes 3/4 | 9 / 5 / 4 → 4 | 8 / 3 | 7 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `perplexity-api-key` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 12 → 12 | 15 / 6 | 8 (0) | co-detection MNF·redact 3f/3ax; co-detection MNF·warn 1f/1ax | co-detection MNF·redact 5f/4ax; co-detection MNF·warn 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `pinecone-api-key` | T2 | stable → stable | stable-empirical · none | 18 / 15 / 12 → 12 | 16 / 6 | 8 (0) | co-detection MNF·redact 2f/2ax | co-detection MNF·redact 4f/3ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `postman-api-key` | T2 | stable → stable | stable-empirical · none | 14 / 12 / 12 → 12 | 17 / 6 | 9 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `postman-collection-access-key` | T2 | stable → stable | stable-empirical · none | 18 / 16 / 11 → 11 | 16 / 6 | 8 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `private-key` | T1 | stable → stable | stable-documented · none | 23 / 7 / 5 → 5 | 8 / 6 | 5 (5) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `pulumi-access-token` | T1 | stable → stable | stable-documented · none | 12 / 6 / 4 → 4 | 8 / 5 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `pypi-token` | T1 | stable → stable | stable-documented · none | 9 / 7 / 7 → 7 | 8 / 6 | 9 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `replicate-api-token` | T1 | stable → stable | stable-documented · none | 12 / 10 / 8 → 8 | 14 / 6 | 6 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 3f/3ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `sendgrid-token` | T1 | stable → stable | stable-documented · none | 38 / 8 / 9 → 4 | 12 / 4 | 18 (0) | co-detection MNF·redact 2f/1ax | co-detection MNF·redact 2f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | product-553 (policy-decision) |
| `sentry-org-auth-token` | T2 | stable → stable | stable-empirical · none | 18 / 9 / 14 → 9 | 14 / 6 | 8 (0) | co-detection MNF·warn 3f/2ax | co-detection MNF·warn 3f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `sentry-user-auth-token` | T2 | stable → stable | stable-empirical · none | 18 / 9 / 14 → 9 | 14 / 6 | 8 (0) | co-detection MNF·redact 1f/1ax | co-detection MNF·redact 1f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `shopify-token` | T1 | stable → stable | stable-documented · none | 13 / 7 / 5 → 5 | 8 / 6 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `slack-app-level-token` | T2 | provisional → provisional | arrival-provisional · none | 11 / 11 / 10 → 10 | 9 / 5 | 5 (0) | co-detection MNF·redact 2f/2ax | co-detection MNF·redact 3f/2ax | 0 → 0 | 0/3/1 → 0/3/1 | bare-value contract | — |
| `slack-token` | T1 | stable → stable | stable-documented · none | 28 / 7 / 5 → 5 | 13 / 4 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `slack-user-token` | T1 | provisional → provisional | stable-documented · none | 11 / 11 / 9 → 9 | 11 / 6 | 5 (1) | co-detection MNF·redact 2f/1ax | co-detection MNF·redact 2f/1ax | 0 → 0 | 0/9/3 → 0/9/3 | bare-value contract | — |
| `stripe-token` | T1 | stable → stable | stable-documented · none | 25 / 7 / 5 → 5 | 8 / 6 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `stripe-webhook-signing-secret` | T1 | provisional → provisional | stable-documented · none | 11 / 11 / 9 → 9 | 10 / 6 | 5 (0) | co-detection MNF·redact 2f/2ax | co-detection MNF·redact 2f/2ax | 0 → 0 | 0/0/2 → 0/0/2 | bare-value contract | — |
| `supabase-management-token` | T1 | stable → stable | stable-documented · none | 12 / 8 / 7 → 7 | 8 / 6 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `supabase-token` | T1 | stable → stable | stable-documented · none | 11 / 9 / 9 → 9 | 14 / 6 | 5 (0) | co-detection MNF·redact 2f/1ax | co-detection MNF·redact 2f/1ax | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `tavily-api-key` | T2 | provisional → stable | stable-empirical · none | 18 / 16 / 13 → 13 | 19 / 6 | 8 (0) | co-detection MNF·redact 7f/4ax; false-alarm MNF·redact 1f/1ax; leak MR 7f/4ax | co-detection MNF·redact 8f/4ax | 1 → 0 | 62/23/2 → 0/0/0 | shape | — |
| `telegram-bot-token` | T2 | stable → stable | stable-empirical · none | 18 / 9 / 14 → 9 | 15 / 5 | 8 (0) | co-detection MNF·redact 3f/2ax | co-detection MNF·redact 3f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
| `terraform-cloud-token` | T1 | stable → stable | stable-documented · none | 12 / 6 / 4 → 4 | 8 / 5 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `together-ai-api-key` | T2 | provisional → provisional | stable-empirical · none | 18 / 16 / 13 → 13 | 19 / 6 | 8 (0) | co-detection MNF·redact 5f/3ax; leak MR 9f/6ax | co-detection MNF·redact 6f/4ax | 3 → 0 | 69/30/2 → 0/0/0 | shape | — |
| `travisci-api-token` | T2 | stable → stable | context-constrained-empirical · none | 19 / 17 / 9 → 9 | 16 / 6 | 13 (0) | co-detection MNF·redact 1f/1ax; warn-only pol·warn 8f/4ax | co-detection MNF·redact 1f/1ax; warn-only pol·warn 8f/4ax | 0 → 0 | 0/0/0 → 0/0/0 | context-constrained (4) | — |
| `twilio-api-key-secret` | T2 | stable → stable | context-constrained-empirical · none | 23 / 14 / 18 → 13 | 16 / 6 | 10 (0) | co-detection MNF·redact 1f/1ax; warn-only pol·warn 2f/2ax | co-detection MNF·redact 1f/1ax; warn-only pol·warn 2f/2ax | 0 → 0 | 0/0/0 → 0/0/0 | context-constrained (2) | — |
| `twilio-auth-token` | T2 | stable → stable | context-constrained-empirical · none | 22 / 13 / 18 → 13 | 17 / 6 | 10 (0) | co-detection MNF·warn 1f/1ax; warn-only pol·warn 3f/3ax | co-detection MNF·warn 1f/1ax; warn-only pol·warn 3f/3ax | 0 → 0 | 0/0/0 → 0/0/0 | context-constrained (2) | — |
| `vault-token` | T1 | stable → stable | stable-documented · none | 14 / 7 / 5 → 5 | 8 / 6 | 6 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `vercel-token` | T0 | pending → pending | arrival-provisional · totalFixtures 20/24, benignControls 5/8, twinPairs 0/5, positiveContextAxes 1/4, controlAxes 3/4 | 15 / 3 / 1 → 1 | 5 / 3 | 0 (0) | — | — | 0 → 0 | 0/0/0 → 0/0/0 | bare-value contract | — |
| `xai-api-key` | T2 | stable → stable | stable-empirical · none | 19 / 17 / 11 → 11 | 14 / 6 | 8 (0) | co-detection MNF·redact 5f/3ax | co-detection MNF·redact 5f/3ax | 0 → 0 | 0/0/0 → 0/0/0 | shape | — |
