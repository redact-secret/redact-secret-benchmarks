---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: generic
families:
  - id: generic:private-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://www.rfc-editor.org/rfc/rfc7468
      issues:
        - redact-secret/redact-secret#107
        - redact-secret/redact-secret#163
        - redact-secret/redact-secret#650
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/650/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: generic:jwt
    research:
      verdict: ready
      tier: T1
      sources:
        - https://www.rfc-editor.org/rfc/rfc7519
      issues:
        - redact-secret/redact-secret#107
        - redact-secret/redact-secret#323
        - redact-secret/redact-secret#650
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/650/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: generic:bearer-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues:
        - redact-secret/redact-secret#857
        - redact-secret/redact-secret-benchmarks#365
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: generic:connection-string-password
    research:
      verdict: not-found
      tier: T3
      sources:
        - https://www.rfc-editor.org/rfc/rfc3986
      issues:
        - redact-secret/redact-secret#651
        - redact-secret/redact-secret#857
        - redact-secret/redact-secret-benchmarks#365
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/651/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: generic:otp-seed
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues:
        - redact-secret/redact-secret#857
        - redact-secret/redact-secret-benchmarks#365
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: generic:unclassified-assignment-literal
    research:
      verdict: not-found
      tier: T3
      sources:
        - https://www.rfc-editor.org/rfc/rfc6749.txt
      issues:
        - redact-secret/redact-secret#653
        - redact-secret/redact-secret#857
        - redact-secret/redact-secret-benchmarks#365
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/653/README.md
      researchedAt: 2026-09-23
    blockedBy: null
---

# Generic (provider-less families)

These six families have no issuing provider. Their only possible "provider" is a standard (RFC) or a project policy, so the T1 bar of "the provider or an RFC documents the lexical shape" applies to the RFCs. The two structural families that carry their identifying element inside the secret span (`private-key`, `jwt`) are T1 on RFCs; the other four are T3 project policy. See [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) for how core treats each.

## Families

### `generic:private-key` — PEM-encoded private key

- **Shape:** RFC 7468 textual encoding: a `-----BEGIN <label>-----` line, base64 body lines, a matching `-----END <label>-----` line. The BEGIN and END lines fall inside the secret span. JSON exports (GCP and Firebase service-account keys) embed the PEM as a string with literal `\n` escapes; that variant was already detected, as [redact-secret#163](https://github.com/redact-secret/redact-secret/issues/163) proved with two regression fixtures (PR #169).
- **Sources:** T1, RFC 7468 §2. The #650 record names it as one of the two accepted RFC-backed T1 contracts, with the reviewed control parsed as PKCS#8 offline; legacy PEM bodies in the corpus decode to public prose, so only the parseable Ed25519 control is a positive.
- **Issuance:** synthetic keys can be generated locally; no provider is involved.
- **Collisions:** PEM certificates and public keys share the envelope and are negatives; the label decides.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); acceptance is recorded in the [#650 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/650/README.md). No dedicated research issue carries the T1 judgement; [redact-secret#107](https://github.com/redact-secret/redact-secret/issues/107) covers grammar depth (labels, termination, line endings).

### `generic:jwt` — JSON Web Token

- **Shape:** RFC 7519 §3 compact serialization: URL-safe parts separated by `.`; header decodes to a JSON object (§7.2). Every segment is base64url, so `+` and `/` are out of grammar (re-checked 2026-09-20 in the benchmarks work). The span is the whole compact serialization.
- **Sources:** T1, RFC 7519. The reviewed control is signature-verified offline. TruffleHog skips HMAC JWTs, a policy difference, not a grammar one.
- **Issuance:** synthetic tokens can be generated locally.
- **Collisions:** ordinary dotted identifiers and missing-signature forms are negatives. Supabase legacy `anon` and `service_role` keys are JWTs too (see [redact-secret#472](https://github.com/redact-secret/redact-secret/issues/472#issuecomment-5749844717): resolved 2026-09-20 with a scoped exclusion that skips a legacy Supabase `anon` JWT only when the payload has `iss=supabase` and `role=anon`; `service_role` is still reported).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); [#650 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/650/README.md). False-positive controls were added in [redact-secret#323](https://github.com/redact-secret/redact-secret/issues/323).

### `generic:bearer-token` — Bearer credential

- **Shape:** RFC 6750 §2.1: scheme keyword `Bearer` (case-insensitive per RFC 9110), one or more spaces, then `b64token` = letters, digits and `-._~+/` followed by trailing `=` padding. The keyword sits outside the secret span. §5.2 leaves the token's contents unspecified and no RFC states a length; core's 16-byte floor (12 under an explicit `Authorization:` or `Proxy-Authorization:` header), cap of two `=` and HTAB acceptance are project policy.
- **Sources:** carrier grammar only (RFC 6750, RFC 9110 §11.1, RFC 6749 §5.1). The #650 issue closed as NOT FOUND, exhaustive: no identifying element lies inside the span. The evidence record reads the same RFC text as FOUND-partial (carrier grammar) and leaves the choice to the maintainer; the two readings differ and no ruling was found, so the verdict is left `unresearched` (recorded as a conflict). Benchmarks [#365](https://github.com/redact-secret/redact-secret-benchmarks/issues/365#issuecomment-5851264102) freezes the bounded contract with the floors, padding cap and free-text scope as project policy and the accepted decision `docs/decisions/2026-09-26-qualify-bounded-t3-credential-policy.md` names this family as one of four `T3` / `project-policy` families, and the support matrix reads it T3. That fixes the family's contract tier at T3 but does not itself say which of the two #650 readings the maintainer chose; see Open questions.
- **Collisions:** the value may be a JWT, a provider-prefixed key or an opaque string; providers' own families win when a prefix matches.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); [#650 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/650/README.md).

### `generic:connection-string-password` — Connection-string password

- **Shape:** RFC 3986 §3.2.1 userinfo: the password sits after the first `:` and before `@`. No RFC or vendor states a length or identifying element; §7.5 deprecates passwords in URIs. Vendors disagree on which characters need percent-encoding (MongoDB requires `$` encoded, MySQL Connector/J requires `( ) & =`, RabbitMQ forbids a raw `:`).
- **Sources:** RFC 3986, RFC 1738, RabbitMQ URI spec, MongoDB and PostgreSQL docs: delimiter and alphabet only. Verdict NOT FOUND, exhaustive (2026-09-23); T3.
- **Issuance:** not applicable.
- **Collisions:** providers that issue passwords with a fixed prefix (PlanetScale `pscale_pw_`, Neon `npg_`, Aiven and DigitalOcean `AVNS_`) are separate families.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); [#651 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/651/README.md). Password surfaces outside userinfo (`password=` parameters, Azure Storage `AccountKey=`) fall outside the family definition.

### `generic:otp-seed` — OTP seed

- **Shape:** `otpauth://TYPE/LABEL?PARAMETERS` with TYPE `hotp` or `totp` and a REQUIRED `secret` parameter in Base32 (alphabet `A-Z`, `2-7`, `=` padding). Core requires at least 16 characters and uppercase; the RFC 4226 §4 R6 floor is 128 bits and Google states no length.
- **Sources:** Google's Key Uri Format wiki (Google Code Archive copy) documents the envelope and Base32 secret; no RFC defines `otpauth`. The #652 issue status is FOUND, conditional on accepting Google as the provider of a generic seed; the record says read it as NOT FOUND if that attribution is rejected. The two readings differ and no ruling was found, so the verdict is left `unresearched` (recorded as a conflict). The #650 record lists `otpauth-uri` among the RFC-position contracts that "are T3 today", and [benchmarks#365](https://github.com/redact-secret/redact-secret-benchmarks/issues/365#issuecomment-5851264102) with the accepted decision `docs/decisions/2026-09-26-qualify-bounded-t3-credential-policy.md` keeps it T3 with the 16-character floor, case rule, padding rule and first-parameter behaviour as project choices; the support matrix reads it T3. That fixes the contract tier at T3 but does not itself say whether Google counts as the provider; see Open questions.
- **Issuance:** not applicable.
- **Collisions:** `apple-otpauth://` and `%3D` padding are recorded false-negative variants.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); [#652 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/652/README.md).

### `generic:unclassified-assignment-literal` — Unclassified assignment literal

- **Shape:** none. An arbitrary literal (8 to 4096 bytes in core) assigned to a sensitive-looking name such as `client_secret`; entropy only selects confidence. RFC 6749 allows any printable ASCII (`VSCHAR`), RFC 8265 any PRECIS freeform string.
- **Sources:** none possible; the family has no provider (`"provider": null`). Verdict NOT FOUND, exhaustive, for the scored span; masking policy (T3).
- **Issuance:** not applicable.
- **Collisions:** every provider family whose value sits in an assignment; a named provider detector wins.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); [#653 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/653/README.md); the ADRs it cites cover the warn-on-high-signal-names policy.

## Candidates that are not families yet

- **PlanetScale, Neon and Aiven passwords.** Fixed-prefix connection-string passwords; PlanetScale has a provider-domain prose statement and would be its own provider family.
- **Password parameters in connection strings** (PostgreSQL `password=`, Redis `password` query key, JDBC properties).
- **Azure Storage `AccountKey=`** parsed by the connection-string detector but outside the userinfo family definition.

## Open questions

1. Bearer: does the RFC 6750 carrier grammar count as T1 when the keyword sits outside the span? Two readings in one record; maintainer choice. The accepted T3 decision and benchmarks#365 hold the contract at T3 (and the matrix reads T3), which is consistent with recording `not-found` T3 like the connection-string and assignment families; no comment says so explicitly.
2. OTP seed: is Google the "provider" of a generic OTP seed? The same conditional applies, with the same T3 evidence and the same open choice.
3. OTP seed floor: core's 16 characters (80 bits) is below the RFC 4226 R6 128-bit MUST; lowercase and lowercase-scheme forms are false negatives no provider settles.
4. Connection-string minimum length: core accepts 1 character, most scanners require at least 3; neither is provider-backed.
5. Private key and JWT: no research issue records the T1 acceptance itself; it is stated in #650's second pass and in the benchmarks contract. Link a ruling if one exists.

## Research log

- [redact-secret#107](https://github.com/redact-secret/redact-secret/issues/107) — grammar depth for private-key and JWT (fixtures, boundaries); coverage work, closed 2026-09-10.
- [redact-secret#163](https://github.com/redact-secret/redact-secret/issues/163) — JSON-escaped PEM bodies (GCP and Firebase key exports); closed by PR #169, which added two regression fixtures and no detector change.
- [redact-secret#323](https://github.com/redact-secret/redact-secret/issues/323) — JWT and Bearer false-positive controls.
- [redact-secret#650](https://github.com/redact-secret/redact-secret/issues/650) — bearer T1 hunt: NOT FOUND, exhaustive; carrier grammar only; also states the RFC-backed T1 status of jwt and private-key.
- [redact-secret#651](https://github.com/redact-secret/redact-secret/issues/651) — connection-string password: NOT FOUND, exhaustive (2026-09-23).
- [redact-secret#652](https://github.com/redact-secret/redact-secret/issues/652) — OTP seed: found-partial, conditional on the provider attribution (2026-09-23).
- [redact-secret#653](https://github.com/redact-secret/redact-secret/issues/653) — unclassified assignment literal: NOT FOUND, exhaustive (2026-09-23).
- [redact-secret#857](https://github.com/redact-secret/redact-secret/issues/857) — Beta.10 hardening of the four supported-context generic families; its evidence record keeps all four at T3 project policy (bearer stays provisional after one protected-holdout failure). It rules on neither the RFC-carrier reading of #650 nor the provider attribution of #652.
- [redact-secret-benchmarks#365](https://github.com/redact-secret/redact-secret-benchmarks/issues/365) — 2026-09-26 baseline and frozen bounded contracts for the four T3 families (bearer, connection-string, OTP seed, assignment literal); closed 2026-09-27. Product counterpart [redact-secret#857](https://github.com/redact-secret/redact-secret/issues/857). The `policy-qualified` profile names all four as T3 / `project-policy`.
