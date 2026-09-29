---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: pypi
families:
  - id: pypi:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.pypi.org/api/secrets/
        - https://pypi.org/help/#apitoken
      issues:
        - redact-secret/redact-secret-benchmarks#104
        - redact-secret/redact-secret-benchmarks#107
      evidence: null
      researchedAt: 2026-09-22
    blockedBy: null
---

# PyPI

PyPI issues API tokens for uploading packages. A token is the prefix `pypi-`
followed by a base64-serialized macaroon, and PyPI's own documentation publishes
the format for third-party secret scanners.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `pypi:api-token` — API token

- **Shape:** prefix `pypi-`, then a URL-safe base64 string (letters, digits, `-`,
  `_`) of at least 85 characters, with no upper bound because caveats can be
  added to the macaroon. Real tokens begin with the encoded macaroon header for
  the location `pypi.org`, which both pinned scanners key on. The extra
  character in trufflehog's pattern implies an identifier of 36 to 39 bytes,
  consistent with a UUID.
- **Sources:** T1. `docs.pypi.org/api/secrets` (fetched 2026-09-21) publishes
  the regex `pypi-[A-Za-z0-9-_]{85,}` and says the body is a PyMacaroon base64
  serialization. The PyPI help page confirms the `pypi-` prefix is part of the
  password value and that the identifier is meant to be inspectable. Scanner
  rules are narrower: trufflehog 3.97.4 requires the macaroon header plus 150 to
  157 further characters, and gitleaks 8.30.1 requires the header plus 50 to
  1000. Neither verifies the signature by default.
- **Issuance:** not attempted. Benchmarks#104 decided a structurally faithful
  synthetic token can be built without any PyPI signing key (nil-UUID
  identifier, a caveat that says it is a fixture, and a hash-filler
  signature), so no real token is needed for the positives.
- **Collisions:** the identifier inside the macaroon is meant to be readable and
  is not itself the secret. Twine and pip use the same `pypi-` value as a
  password, so it appears under `TWINE_PASSWORD`-style names.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None found.

## Open questions

1. **Header requirement.** The provider regex needs only `pypi-` plus 85
   characters; both tools also require the encoded header. Should a value without
   the header count as a token?
2. **Ceiling.** The provider says no ceiling; gitleaks caps at 1000.

## Research log

- redact-secret-benchmarks#104 (2026-09-21) — decided that a PyPI macaroon
  positive can be authored synthetically, and recorded the provider format from
  `docs.pypi.org/api/secrets` as the exact regex, with the pinned scanners'
  narrower rules alongside.
- redact-secret-benchmarks#107 (2026-09-22) — filled the evidence gap (twin pairs
  and benign axes) on that basis.
