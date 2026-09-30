---
decision_id: decision-accept-credential-named-and-typed-neighbour-redactions
status: accepted
scope: benchmarks
title: Accept credential-named and typed-neighbour redactions as policy, not false alarms
decided_at: 2026-09-30
---

# Accept credential-named and typed-neighbour redactions as policy, not false alarms

Status: **accepted** (maintainer direction, 2026-09-30, Beta.12 graduation, redact-secret-benchmarks#528).
Extends [`2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](2026-09-29-relabel-provider-named-near-miss-controls-under-948.md).

## Context

At product main `99c8c2b` four #464/#528 controls still read as benign false alarms. Each one's value is redacted,
and each redaction is either the security-first generic policy or a correct typed finding:

- `beta8-464a--daytona-api-key-runner-key-unprefixed-encoded-value`: `RUNNER_API_KEY=<64 hex>`. The name carries no
  provider, so the #948 decision does not cover it, but `API_KEY` is a high-signal credential name and 64 random hex
  under it meets the generic floors.
- `beta8-464e--cerebras-api-key-pinecone-hyphen-key-near-miss`: `Pinecone(api_key="pcsk-…")`, a credential-named
  keyword argument, not `<NAME>=`.
- `beta8-528b--polar-token-checkout-client-secret-public-id`: `checkout.open({ clientSecret: "polar_c_…" })`, a
  credential-named object member. Polar documents the checkout client secret as safe to expose.
- `beta8-464e--cerebras-api-key-pinecone-key-near-miss`: `PINECONE_API_KEY=pcsk_…`, a complete Pinecone key that the
  typed `pinecone-api-key` detector reports.

A fifth case is a positive, not a control: `beta8-464e--cerebras-api-key-pinecone-neighbour-dotenv` puts the same
kind of Pinecone key on the line above the Cerebras key, and the product reports both.

## Decision

The standing default is security-first. Redacting a benign-looking value under a credential name costs output fidelity
only, so the benchmark records it as accepted policy and does not ask for silence.

1. The three generic-token rows move from `must-not-flag`/T2 on their family to `policy`/T3 on `generic-token`, action
   `redact`, the value under the credential name being the authored secret span. The action is checked against the
   #948 generic floors (16+ bytes, entropy 3.0), never read from scanner output.
2. The Pinecone control moves to `policy`/T3 on `pinecone-api-key`, action `redact`; the build checks the value against
   the `pinecone-api-key` contract. The typed finding is expected.
3. The neighbouring Pinecone key on the Cerebras positive becomes an authored `companion` span: it may be redacted with
   the Cerebras key at no collateral cost, and it is never a Cerebras positive.

In every case the row no longer targets the Cerebras, Daytona or Polar family. Those families make no claim on these
values, so a finding on them is not attributed to their detectors. Ids are unchanged, as history. The rows share the
#948 list (`PROVIDER_NAMED_FALLBACK_948` in `benchmarks/evaluation/domains/credential/assessment.ts`), with an optional
`locator` for an input that is not `<NAME>=<value>`, `to` for a typed target and `basis` for the recorded rationale.
The build fails if an input does not match its locator, is not a spanless non-twin control of the recorded family, or
misses its floors or contract.

## What this gives up

These rows no longer measure silence on a public identifier (the Polar checkout client secret) or on a value under a
non-provider name. A product that stopped redacting them would read as a policy miss. The maintainer accepted that
under the security-first default.
