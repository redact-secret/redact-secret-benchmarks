---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: mapbox
families:
  - id: mapbox:secret-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/mapbox/parse-mapbox-token/blob/015a6b470fdb489a2635a4889c9f5b1d545a512c/index.js
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1108
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/mapbox.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Mapbox

Mapbox is a maps platform; `sk.` secret tokens carry account scopes (public `pk.` tokens are not secrets). Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/mapbox.md>.

## Families

### `mapbox:secret-access-token` — see the taxonomy row

- **Shape:** `sk.` + a base64url JSON payload (`eyJ` lead) + `.` + a 22-character base64url signature.
- **Shape:** `sk.` + `eyJ` + 20 or more `[A-Za-z0-9_-]` + `.` + exactly 22 `[A-Za-z0-9_-]`.
- **Sources:** T1 for the prefix, three-part structure and alphabet (Mapbox "Tokens" docs and the provider parser `parse-mapbox-token`, R1) and the 22-character signature (R5: one docs example plus provider fixtures). The payload has no stated floor or bound; the `eyJ` + 20 floor is derived from provider code, so it is policy under ruling Q7 (open), never T1. Scanner rules (trufflehog `mapbox`, noseyparker) disagree and are T2; gitleaks 8.30.1 has no Mapbox rule.
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** public `pk.` tokens (public by design, Q5); `tk.` temporary tokens (unclaimed, Q9); a three-part JWT with an `eyJ` header belongs to `jwt` (R7), and a Mapbox `sk.` token has a non-JWT header, so `jwt` does not claim it. The corpus holds a JWT with Mapbox-shaped claims as the no-double-report control.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1108, unreleased). The benchmark contract and corpus are `benchmarks/lib/beta8/583g.ts` and `fixtures/generated/beta8/583g.mjs`; a payload of `eyJ` + 19 and the `tk.` token are authored as unclaimed (T0) shapes.

## Candidates that are not families yet

- **`tk.` temporary token.** Expires within an hour and embeds its scopes in the payload; unclaimed pending the maintainer (Q9).

## Open questions

1. Q7 (open): may a payload floor derived from provider code serve as the T1 floor? If refused, the claim narrows to payloads showing the documented `u` + `a` object (`eyJ1Ijoi`).
2. Q9: is the `tk.` temporary token in scope?

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1108 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; the Mapbox slice (583g) authors the contract and seeded corpus.
