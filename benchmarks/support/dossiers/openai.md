---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: openai
families:
  - id: openai:secret-api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://community.openai.com/t/1118492/2
        - https://github.com/openai/codex/blob/418199f6ade4f9018b1f0b455a685387a811ad2e/codex-rs/network-proxy/src/credential_broker/providers/openai.rs#L13-L23
      issues:
        - redact-secret/redact-secret#657
        - redact-secret/redact-secret#552
        - redact-secret/redact-secret#948
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/657/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: openai:admin-api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://developers.openai.com/api/docs/guides/admin-apis
        - https://github.com/openai/codex/blob/418199f6ade4f9018b1f0b455a685387a811ad2e/codex-rs/network-proxy/src/credential_broker/providers/openai.rs#L13-L23
        - https://github.com/trufflesecurity/trufflehog/blob/363923b901c911a9164f50b6c423f47c15372b1c/pkg/detectors/openaiadmin/openaiadmin.go#L26-L29
        - https://github.com/gitleaks/gitleaks/blob/83d9cd684c87d95d656c1458ef04895a7f1cbd8e/cmd/generate/config/rules/openai.go#L14
        - https://github.com/projectdiscovery/nuclei-templates/blob/02b06eb813310376e9a29543fd63a53f0dd3d4b3/http/exposures/tokens/openai/openai-admin-api-key.yaml#L23
        - https://github.com/ghostsecurity/poltergeist/blob/e071ca2d15f652c6e87e63a64716144a9383c3b2/pkg/rules/openai.yaml#L36
      issues:
        - redact-secret/redact-secret#777
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#863
        - redact-secret/redact-secret#882
        - redact-secret/redact-secret#1013
        - redact-secret/redact-secret-benchmarks#384
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/openai-admin-api-key.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# OpenAI

OpenAI issues API keys from the platform dashboard: user, project and
service-account secret keys, and organization Admin API keys (created by an
organization owner). All share the `sk-` namespace and are told apart by the
segment after it. OpenAI publishes no key grammar on its own domains, so both
families here are tool-corroborated (T2) at best. Provider documentation:
[Admin API overview](https://developers.openai.com/api/docs/guides/admin-apis).
Whether and how core detects a family is not recorded here.

## Families

### `openai:secret-api-key` — Secret API key

- **Shape:** prefixes `sk-proj-` (project), `sk-svcacct-` (service account)
  and legacy `sk-`, with the public watermark `T3BlbkFJ` between two segments.
  Namespaced keys measure 74/74 (164 or 167 characters in community reports);
  58/58 and a 20/20 early `sk-proj-` generation are older. Alphabet
  `[A-Za-z0-9_-]`, no checksum documented. `sk-None-` and `sk-service-` appear
  in community sources only and are in no contract.
- **Sources:** none reaches T1, so the verdict is `ready` at T2 (tool-corroborated
  contract), not T1. #657 records the T1 hunt as NOT FOUND, exhaustive as of
  2026-09-23: an OpenAI-staff post on community.openai.com names `sk-proj-`
  (forum class) and provider code in `openai/codex` names the prefixes and the
  watermark (code, not a provider document). Lengths and alphabet come from
  gitleaks 8.30.1 and public-code measurements.
- **Issuance:** not attempted. The #657 web-search pass lists structural
  checks for a project key, two service-account keys and an optional admin key.
- **Collisions:** `sk-ant-` (Anthropic) and `sk-or-` (OpenRouter) share the
  `sk-` start. OpenAI staff say `sk-proj-` keys "work just like the previous
  `sk-` keys". A bare vendor-prefixed value is a separate lower-confidence
  layer (#552 update, ADR 2026-09-21).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
  #552 records that the frozen contract deliberately excludes shapes such as
  marker-less 48-byte bodies. #948 later made an off-grammar value under a
  provider-named variable such as `OPENAI_API_KEY=` a generic finding.
- **Open caveat:** No provider-domain page states prefix, marker, length or alphabet, so T1 is unreachable; the shipped contract stays a tool-corroborated T2 shape. Needs issued keys (steps in the #657 web-search pass).

### `openai:admin-api-key` — Admin API key (sk-admin-)

- **Shape:** prefix `sk-admin-`, then 58 or 74 characters of `[A-Za-z0-9_-]`,
  the marker `T3BlbkFJ`, then 58 or 74 more. The three gitleaks admin vectors
  are all 58/58 (133 characters). A marker-less body of any length is
  unevidenced and out of contract, including the 124-character body in a
  trufflehog feature request, which equals 58 + 8 + 58.
- **Sources:** T2. Provider evidence is family-level only: the Admin API guide
  states scope (admin keys cannot call non-administration endpoints, env var
  `OPENAI_ADMIN_KEY`), and `openai/codex` names `sk-admin-` and the watermark.
  gitleaks 8.30.1 requires the marker on admin keys. trufflehog 3.97.4 does
  not exclude admin keys: PR #4689 (2026-02-11) moved them out of the generic
  `openai` detector into a dedicated `openaiadmin` detector that requires the
  marker and exactly 58/58 (an earlier reading of this dossier called it an
  exclusion; corrected by redact-secret#1013). nuclei-templates and poltergeist
  also match 58 + marker + 58. With `openai/codex` that is 5 references, 5
  owners and 2 non-summary classes for the 58/58 shape, recorded in
  `empirical-observations.json`. GitGuardian has a dedicated detector with no
  length stated.
- **Issuance:** not attempted. Organization owners create admin keys under
  organization settings; the checklist (prefix, two segment widths, marker
  offset, alphabet, shown once) is in the #777 research comment.
- **Collisions:** shares the `sk-` namespace and marker grammar with
  `sk-proj-` and `sk-svcacct-`. The admin key resource `id` is not the secret.
  Blogs conflate 164-character project widths and `{40,}` bounds with admin.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
  #863 reconciled the precision contract (previously `pending`, T0) with the
  detector. Product PR #882 gave admin keys their own finding type.
- **Open caveat:** No provider page states an admin-key length or alphabet, so T1 is unreachable. 58/58 rests on four peer owners; no source anywhere shows a 74/74 admin value, which gitleaks admits only through the width union it shares with `sk-proj-`/`sk-svcacct-`. As #1013 recommends, the benchmark claim is 58/58 only and no fixture asserts 74/74 either way (bounded in the ledger); the product keeps accepting 74/74.

## Candidates that are not families yet

- **`sk-None-`** (user keys, mid-2024) and **`sk-service-<name>-`**: community
  and public-code sources only; no provider source, so no grammar recorded.
- **Marker-less `sk-admin-` body:** a single unsourced request; not a shape
  until an issued key shows one.

## Open questions

1. **Admin widths and marker.** Does a real admin key carry the marker, and is
   it 58/58 only or also 74/74? One issued key settles it (#777 checklist).
2. **Provider evidence class.** Does a staff forum post or provider code on
   github.com count as T1? #657 follows the written bar (no) and leaves the
   decision to a maintainer; no ruling was found for OpenAI. The maintainer
   did accept provider SDK code as T1 for ElevenLabs on 2026-09-27
   ([#788](https://github.com/redact-secret/redact-secret/issues/788#issuecomment-5852853663)),
   following the Hugging Face precedent, while #863's evidence keeps admin at
   T2 because `openai/codex` is a credential-broker allow-list, not a
   grammar statement. Whether that distinction holds is a maintainer call.
3. **Older generations.** No contract covers 20/20 `sk-proj-` keys; whether
   they still exist in the wild is unmeasured.
4. **Trufflehog disagreement (resolved: a misreading).** trufflehog 3.97.4
   ships the dedicated `openaiadmin` detector (marker + 58/58); the generic
   `openai` detector skips `sk-admin-` because of that move. The benchmark
   maps the `OpenAIAdmin` label to this family in `scanners/families.mjs`.
   trufflehog#4698 (a marker-less 124-character request) is out of contract.
5. **Reddit.** Not readable in either research pass, so absence there is weak.

## Research log

- redact-secret#1013 — 2026-09-29 T1/T2 pass ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/openai-admin-api-key.md)): READY-T2 for
  58/58; trufflehog correction; 74/74 unobserved.
- redact-secret#657 — T1 provider-evidence search for the secret key; verdict
  NOT FOUND, exhaustive (2026-09-23); three passes stay in the issue comments.
- redact-secret#552 — root-cause synthesis for fixed-corpus misses; its
  `openai-token` conclusion was superseded by the 2026-09-21 vendor-prefixed
  policy layer.
- redact-secret#774 — Beta.10 epic; its close-out records the OpenAI admin
  disposition and the #882 type split.
- redact-secret#777 — admin key discovery; disposition: extend the existing
  family, T2, not T1.
- redact-secret#863 — contract reconciliation for `sk-admin-`, linked by
  permalink in the frontmatter.
- redact-secret#948 — generic fallback under provider-named variables such as
  `OPENAI_API_KEY=`.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract, corpus).
