---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: convex
families:
  - id: convex:deployment-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.convex.dev/cli/deploy-key-types
        - https://github.com/get-convex/convex-backend/tree/032e81e264a8b23b8d566d8f83f773d2bfbedb88
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#912
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/convex.md
      researchedAt: 2026-09-28
    blockedBy: "Hex-body keys only. The cloud eyJ2 body (Base64 alphabet, padding, length) is ISSUANCE-GATED (R4; still gated after the 2026-09-28 issuance research); needs a structure-only issuance check."
---

# Convex

Convex is a backend platform. A deploy key (`CONVEX_DEPLOY_KEY`) lets CI or an agent push functions and schema and run admin operations; an admin key (`CONVEX_SELF_HOSTED_ADMIN_KEY`, or the dashboard admin key) is full admin access to one deployment. Keys are sent as `Authorization: Convex <key>`. Provider documentation: [deploy key types](https://docs.convex.dev/cli/deploy-key-types).

## Families

### `convex:deployment-key` — Deployment, project and admin key (hex body)

The disposition for this candidate is a split: READY for hex-body keys, ISSUANCE-GATED for the cloud body. The taxonomy family is named for the hex body, so the family verdict is `ready` and the gated part is recorded in `blockedBy` and below.

- **Shape (READY part):** an optional type lead (`prod:` or `dev:` plus a cloud name matching a lowercase word-word-number pattern; `preview:` or `project:` plus team and project slugs), a name, one `|`, then a body beginning `01` and continuing in lowercase hex, 74 to 96 characters and always even. The untyped form (self-hosted, default instance name `convex-self-hosted`) is admin-key only. The span in the handoff covers the whole string including the public name part.
- **Shape (GATED part):** the current cloud deploy-key body starts `eyJ2` (a truncated docs example, prefix only under R4). The issuance research (frozen 2026-09-28) narrowed the structure to the Base64 of a JSON object tagged `v2`, but the length and exact Base64 flavour are not T1 because the issuer is closed source, and the maintainer left it gated.
- **Sources:** T1 for the type lead, separator and hex body from provider code in `get-convex/convex-backend` (key format, keybroker encryptor with version byte 1, nonce and tag, CLI regexes); the hex length band is derived from the generator (R1), not stated. The docs page shows truncated typed examples.
- **Issuance:** not attempted; structure-only check for the cloud body is the highest-value one named in the Tier B re-rank.
- **Collisions:** `CONVEX_DEPLOYMENT=dev:<name>` and `*.convex.cloud` URLs are public selectors with no `|`. The pre-0.16.0 bare legacy key has no anchor. The name-only `bearer-token` partial span was a generic defect, fixed under #918. #919 later made the exact names `CONVEX_DEPLOY_KEY` and `CONVEX_SELF_HOSTED_ADMIN_KEY` a contextual finding, so a gated `eyJ2` body under those names is redacted. A preview deployment key can also read `preview:<branch-name>|` with a name up to 40 characters (`:` and `|` mapped to `_`); that can fall outside the bounded class and is an accepted false negative ([issuance research](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/convex.md)).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); handoff and issuance research linked below.

## Candidates that are not families yet

- **Cloud `eyJ2` body.** Same taxonomy family in the split, gated; recorded above.
- **Team access and OAuth tokens, CLI device token, login access token.** Shape undocumented; `bearer-token` covers the header form.

## Open questions

1. What are the alphabet (standard or URL-safe Base64), padding and length of the cloud `eyJ2` body, and does scope change the length? Needs one issued key checked for structure only.
2. Team and project slug grammar for `preview:` and `project:` keys: no source states it; the handoff uses a bounded policy class (the issuance research also found a wider `preview:<branch-name>|` form, see Collisions).

## Research log

- redact-secret#860 — epic (open); [research table #48](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852387196); [Tier B re-rank](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871765611) (split verdict); [R9-R10 issuance research](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337) (cloud body still gated).
- redact-secret#912 — implementation issue for the hex-body detector (closed).
- [Issuance research for the cloud body](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/convex.md).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists the split, 2026-09-28.
