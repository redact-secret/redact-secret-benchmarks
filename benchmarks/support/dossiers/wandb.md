---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: wandb
families:
  - id: wandb:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.wandb.ai/support/models/articles/why-does-my-api-key-fail-with-must-be-40-characters
        - https://github.com/wandb/wandb/blob/98f93d636e523bf6e195a2a154f23ba8775623a9/wandb/sdk/lib/wbauth/validation.py#L26-L63
        - https://github.com/wandb/wandb/pull/10688
        - https://github.com/wandb/weave-claude-code/blob/8c4111adbafe7abf15312b3188eb69a0b7bf8f79/tests/config-set-masks-secrets.test.ts#L13
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#917
        - redact-secret/redact-secret-benchmarks#436
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/wandb.md
      researchedAt: 2026-09-28
    blockedBy: "The docs say \"about 86\" characters; every provider test uses exactly 86, but a confirming issuance is recommended (does not block the contract)."
---

# Weights & Biases

Weights & Biases (W&B) is an ML experiment tracking platform. An API key (`WANDB_API_KEY`, `~/.netrc` for `api.wandb.ai`, Basic `api:<key>`) reads and writes every project the user or service account can reach, including artifacts, run logs and Weave traces. This dossier covers the newer `wandb_v1_` key. The legacy 40-hex key is not a family.

## Families

### `wandb:api-key` — API key (wandb_v1_)

- **Shape:** prefix `wandb_v1_`, 86 characters in total (body 77), alphabet `[A-Za-z0-9_]`. Self-managed keys are `<host>-<key>`; the host label is outside the key.
- **Sources:** prefix T1 from a W&B-authored test constant (R5). Length T1 by example: the docs say "W&B now issues longer API keys (about 86 characters)", the SDK validator tests (wandb#10688) use 39, 40 and 86, and Weave fixtures use 86. Alphabet T1 from the SDK validator (`[\w-]+`, dash only for the on-prem host prefix) and its error text (R1). Scanner rules add an internal underscore split (27 then 49), which is T2 and not required by the handoff. Re-checked 2026-09-28.
- **Issuance:** not attempted; recommended because of the "about" in the docs.
- **Collisions:** the legacy 40-hex key is SHA-1 and git-SHA shaped with no anchor; generic context already redacts it under `WANDB_API_KEY=`. Internal client JWTs go to the JWT detector.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md). That contract uses a tolerant 64 to 96 band around the documented width by an orchestrator decision on #917, wider than the handoff's exact 86; the handoff verdict here is unchanged.

## Candidates that are not families yet

- **Legacy 40-hex key** (optionally `<host>-` + 40). No anchor; keyword-gated generic handling is a later possibility.
- **OIDC identity-token files** (`WANDB_IDENTITY_TOKEN_FILE`). A different credential.

## Open questions

1. Is a key issued today exactly 86 characters, or does the length vary ("about")? One issuance check would settle it.
2. Does a `wandb_v2_` or later version exist? None is documented.

## Research log

- redact-secret#860 — epic (open); [research table #37](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386967); [Tier B re-rank](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871765611) (READY); [ruling R1](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851), [ruling R5](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275).
- redact-secret#917 — implementation issue; set the tolerant length band (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret-benchmarks#436 — Beta.11 contracts and synthetic corpus for the #860 Tier B READY families; closed 2026-09-28. Corpus work only, no change to the research verdict.
