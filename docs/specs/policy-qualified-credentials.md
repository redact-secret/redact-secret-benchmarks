# Policy-qualified T3 credentials

Issue: [#365](https://github.com/redact-secret/redact-secret-benchmarks/issues/365).
Decision: [Qualify bounded T3 credential policy without changing provenance](../decisions/2026-09-26-qualify-bounded-t3-credential-policy.md).

The machine contract is `benchmarks/support/policy-qualified-credentials.json`,
validated by `schemas/policy-qualified-credential-v1.json`. It covers exactly
Bearer, connection-string password, OTP seed, and unclassified assignment
literal.

`Stable · Policy qualified` means a T3 / `project-policy` family passed the
bounded context/value/span/action contract, independent benign and twin floors,
all exact/leak/collateral/action/critical-failure gates, public conformance, and
the protected holdout on a frozen candidate. It does not mean provider
documented, empirically issued, valid, live, or representative of production.

Bearer claims only the value in supported carrier contexts. Connection strings
claim the original undecoded password in enumerated URI/userinfo forms; Azure
`AccountKey` is excluded. OTP claims the first supported uppercase Base32
`secret` in HOTP/TOTP `otpauth` URIs. Assignment literals claim only supported
field names, operators, and direct values; `warn` and `redact` are distinct and
`block` or arbitrary assignments are not claimed. The JSON contract records
the complete exclusions, blind spots, and external-fact/project-policy split.

`eval:classify` records counts for all five span outcomes, exact misses, leaks,
overbreadth, collateral bytes, positive actions, control false alarms split by
action, unresolved actions, critical failures, holdout state, and typed failed
gates. An authorized frozen-candidate run may provide
`--policy-holdout-report=<aggregate.json>`; protected data is never read by the
default evaluator.
