# Extend negative twins to the assignment context, and publish un-probeable families

Date: 2026-09-20 · Status: accepted

## Context

Measurement protocol v4 §2.5 defines a negative twin as a control that mutates
exactly one structural property of a positive's **value**: prefix namespace,
body length, alphabet, boundary character, or public-vs-secret prefix.
[Issue #36](https://github.com/redact-secret/redact-secret-benchmarks/issues/36)
found that 22 of the 42 product detector families had no twin anywhere in the
corpus, and that the twin rate said nothing about them because it divides by
authored pairs.

Two of those families, `generic-token` and `connection-string`, have a value
with no grammar. An arbitrary literal in a sensitive field, or an arbitrary URI
password, has no length, alphabet or prefix to violate. "Mutate one structural
property of the value" is not expressible for them, and shortening or
perturbing the value until the product stops matching would measure the
implementation, not a format (#29's rule, restated in #33).

## Decision

1. **A twin may mutate the assignment context instead of the value**, only for
   a family whose contract is T3 and whose value has no grammar. The twin keeps
   the value byte-for-byte and changes exactly one property of what surrounds
   it: the field name, the delimiter, or the quoting. It declares
   `mutationKind: "context"`. `classifyControl` rejects a context twin on any
   family that is not T3, so a family with a contracted value grammar cannot
   use the context to dodge a value mutation. The engine's `authored.twin`
   operator enforces the inverse of its usual integrity rule for these twins:
   the value must survive byte-for-byte and the single contiguous edit must
   land wholly outside the secret span.
2. **A context twin is a `must-not-flag/T3` control.** The positive's
   expectation is project masking policy, so the twin's silence is the same
   policy read from the other side: the policy's scope is a literal in a
   sensitive field or a URI password subcomponent, and the twin is outside that
   scope. It is never reported as provider-evidenced and never mixed with T1 or
   T2 controls.
3. **The mutated property still needs a citation.** A contract whose tier
   carries no `providerSource` records `twinSource` with the same shape
   (`url`, `observedAt`, `formatVersion`, `covers`). For `connection-string`
   that is RFC 3986 §3.2.1: without the `:` delimiter the userinfo has no
   password subcomponent. For `generic-token` no external specification exists;
   its `twinSource` is this decision, and the twin's field name (`build_id`)
   is chosen from ordinary usage, never from the product's keyword list.
4. **A family with nothing documented to mutate is recorded un-probeable**, as
   #33 did in prose for the length/alphabet axis of four families. The record
   is now structured: `unprobeable: { reason, observedAt }` on the contract.
   `validateContracts()` requires the reason and the date, and rejects a
   contract that is both un-probeable and cites a twin source.
5. **The published twin figure has three separate lines per family**:
   discriminated, not discriminated, un-probeable
   (`benchmarks/lib/twin-probe.ts`, shown on `/coverage`). An un-probeable
   family has no pairs and is never counted in any twin rate. A family with
   neither a twin nor a record is reported as `unrecorded`, and a test keeps
   that count at zero.

## Outcome for the 22 families

Observed 2026-09-20. No mutation below was derived from scanner output.

| Family | Outcome | Mutation and source |
| --- | --- | --- |
| `aws-access-key` | twin | `prefix`: `AIDA` is the IAM-user unique-ID prefix, not an access key (AWS IAM unique-ID prefix table). The ID/secret pair in `common-formats` stays untwinned: any single mutation leaves its other credential component intact |
| `generic-token` | twin | `context`: field name `build_id`, value, delimiter and quoting unchanged (this decision) |
| `connection-string` | twin | `context`: userinfo `:` delimiter removed, value unchanged (RFC 3986 §3.2.1) |
| `otpauth-uri` | twin | `alphabet`: one character outside RFC 3548 Base32 (Key URI format, `secret` parameter) |
| `bearer-token` | twin | `alphabet`: one character outside the `b64token` ABNF (RFC 6750 §2.1) |
| `pypi-token` | twin | `prefix`: `pypx-` vs the documented `pypi-` (pypi.org/help) |
| `new-relic-license-key` | twin | `length`: 39 vs the documented 40-character hexadecimal string |
| `azure-devops-personal-access-token` | twin | `length`: 83 vs the documented 84 characters |
| `vercel-token`, `supabase-token` | un-probeable | Positives are T0 pending, so no pair can be scored. Supabase documents `sb_publishable_` as safe to expose; that public-prefix twin is deferred until the positive leaves T0 |
| `discord-bot-token`, `telegram-bot-token`, `grafana-service-account-token` | un-probeable | The provider shows one example token and states no grammar. An example is not a grammar |
| `datadog-api-key`, `datadog-application-key`, `twilio-auth-token`, `twilio-api-key-secret`, `new-relic-user-api-key`, `sentry-org-auth-token`, `sentry-user-auth-token`, `grafana-cloud-access-policy-token`, `microsoft-entra-client-secret` | un-probeable | The provider page states no prefix, length or alphabet |

The exact reason and date for each un-probeable family live on its contract in
`benchmarks/lib/assessment.ts` and are rendered on `/coverage`.

## Consequences

- The observed provider statements for New Relic license keys and Azure DevOps
  PATs back a length twin only. Their positives stay T3; a tier upgrade is a
  separate review.
- A flagged new twin is a finding. It goes through `promote-finding`
  (`benchmarks/known-gaps.json`), never straight to a product issue.
- Un-probeable is a dated observation, not a permanent verdict. When a provider
  publishes a grammar, the record is replaced by a twin and its source.
