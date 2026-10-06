---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: fly
families:
  - id: fly:access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/superfly/macaroon/blob/a0202e10fd947786884323dcbce46efbe8652171/format.go#L11-L60
        - https://github.com/superfly/flyctl/blob/fe73b7215a0ce2ed8e846d927446c1577cbcc217/agent/server/session.go#L685
        - https://docs.fly.io/security/tokens/
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1109
        - redact-secret/redact-secret-benchmarks#583
        - redact-secret/redact-secret-benchmarks#584
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/fly.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Fly.io

Fly.io is an application platform; access tokens are macaroons, sent as `FlyV1 fm2_…`. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/fly.md>.

## Families

### `fly:access-token` — Access token (fm1r_, fm1a_, fm2_ macaroon bundle)

- **Shape:** first member `fm1r_`, `fm1a_` or `fm2_` + at least 64 `[A-Za-z0-9+/_-]` then up to two `=`, optionally comma-joined with further members (`fm1r_`, `fm1a_`, `fm2_`, `fo1_`); no upper bound. The `FlyV1 ` scheme and its space are outside the span, which starts at `fm`.
- **Sources:** T1 by provider code (R1 `superfly/macaroon` `format.go`, R2 Fly's own flyctl redaction rule) for the prefixes, the comma bundle, the alphabet and the missing upper bound. The 64-character floor is derived (16-byte nonce + 32-byte HMAC-SHA256 tail = 48 decoded bytes), so it is T1 only if ruling Q7 is accepted (`policy-q7-floor`, provisional). The scanner floors disagree (gitleaks 100, trufflehog 500 with the scheme required, both T2) and are not used.
- **Unclaimed:** a standalone `fo1_` (no provider-stated length, ruling question Q9) and three or more `=` after a member; both are authored as unclaimed twins (T0), asserting neither detection nor silence.
- **Issuance:** not attempted; the handoff records no issuance gate. If Q7 is refused, the family waits on a structure-only check of one deploy token and one session bundle ([#584](https://github.com/redact-secret/redact-secret-benchmarks/issues/584)).
- **Collisions:** `fm2_hi`-style test fixtures, identifiers such as `fm2_config_path`, the bare `FlyV1` scheme, `FLY_API_TOKEN=${FLY_API_TOKEN}`, Base64 blobs after an identifier that ends in a glue byte.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector `fly-token`, finding type `fly_access_token`, redact-secret#1109, on `main` and unreleased). The benchmark contract is `fly-token` in `benchmarks/lib/beta8/583h.ts` with the seeded corpus `beta8-583h`.

## Candidates that are not families yet

- **Standalone `fo1_` token.** Length rests on gitleaks (43, T2) only; Q9 asks whether to claim it with a policy floor. Unclaimed until then.

## Open questions

1. Q7 (open): is a floor derived from provider wire-format code T1? Recommendation yes; a floor of 100 is the handoff's alternative. If refused, the body-63 twins are dropped and the family waits on the issuance check.
2. Q9 (open): claim a standalone `fo1_` with a policy floor?
3. How many `=` can a real member carry? The redaction rule allows any count; a whole-byte encoding has at most two.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1109 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts, corpus and arrival evidence for the second wave (slice 583h).
