# Evidence: Square contracts and corpus, second-wave registry pin 3b1a5aa (#583, #584)

**Result.** No status was set by hand and nothing here is a release claim. The Square contracts and the seven pending
second-wave contracts add nine scored families; **none reads `stable` in either mode**, so the stable count does not move.
Published mode (`@redact-secret/core` 0.1.0-beta.13, which contains none of the eight second-wave detectors): **127 stable of 144
scored families** (`eval:matrix` 144 of 182). Candidate mode (an unpublished build of product `main` at `3b1a5aa`): **127 of 144**
(144 of 182). The candidate build was made locally and is never published to npm.

No matched plaintext or example credential is retained here; every value is built at generation time from synthetic filler.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `3b1a5aa9935c57416a026a44f45501fd41ffeac8` (product `main` after redact-secret PR #1227; #1102 to #1105 landed in #1214), clean detached worktree |
| Candidate artifacts (`js:build`, node addon, `wasm:build`, `wasm:build:common`, `npm pack`; declared 0.1.0-beta.13, darwin-arm64) | core `3cf936c45937b99799d89f922738f2f1ba78d377e21dd4fa92c3cde125a3798c`, node `1ce5901db5340aebc92463acb248e55037fadc81c23968d948197a2ad59a7c95`, wasm `edf31c7148fbeed9d3ba4c34126d414b7ebcea7a07f9b94953879753979e790b` |
| `redact-secret-benchmarks` | `2566d7e2e4131bb5364230556b6e00c0eb9a6e44` (branch `feat/583-square-contract-corpus`), clean |
| Published package | `@redact-secret/core` 0.1.0-beta.13 (release source `66b492b`) |
| Pinned peers | trufflehog 3.97.4 (checked first on `PATH` in the run's shell: `trufflehog 3.97.4`), gitleaks 8.30.1 |
| Corpus | fixture index digest `6fc68fe094f1f96d6c3f57fc305d09d21a8b9a92bb55a2c2580a5c07b4c32d6e`, 6,089 fixtures |
| Classification | published `d0240c47-edb1-4683-bb6b-afbe4860e56a` ([`support-status-published.json`](support-status-published.json)); candidate `92d5cf8c-98c8-45bd-8d02-be9633ad4a1f` ([`support-status-candidate.json`](support-status-candidate.json)); matrices [`support-matrix-published.json`](support-matrix-published.json), [`support-matrix-candidate.json`](support-matrix-candidate.json) |

Commands (from the repository root, `trufflehog --version` printing 3.97.4 first):

```sh
npm run eval:classify -- --output=evidence/583/3b1a5aa/support-status-published.json
npm run eval:matrix -- --input=evidence/583/3b1a5aa/support-status-published.json --output=evidence/583/3b1a5aa/support-matrix-published.json
npm run eval:classify -- --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> \
  --candidate-source-commit=3b1a5aa9935c57416a026a44f45501fd41ffeac8 --output=evidence/583/3b1a5aa/support-status-candidate.json
npm run eval:matrix -- --input=evidence/583/3b1a5aa/support-status-candidate.json --output=evidence/583/3b1a5aa/support-matrix-candidate.json
```

## The nine new families

| Family | Contract | Published (beta.13) | Candidate (3b1a5aa) |
| --- | --- | --- | --- |
| `square-token` | T1 (R5, Q8 open) | provisional | provisional |
| `square-oauth-application-secret` | T1 (R5, Q8 open) | provisional | provisional |
| `xata-api-key`, `sourcegraph-token`, `unkey-root-key`, `buildkite-token`, `pydantic-logfire-token`, `mapbox-token`, `fly-token` | T3 pending placeholder (claims nothing) | provisional | provisional (`qualificationProfile: tier T3 has no eligible route`) |

The seven pending families read `provisional` in both modes because their contract asserts no format: "detector present in the
registry, benchmark contract/corpus pending (#583)". They are not supported; nothing here claims it.

### Why the Square families are not stable in candidate mode

The candidate reports every Square positive (29 of 29, byte-exact spans, typed `square-token` and
`square-oauth-application-secret`) and none of the asserted prefix, alphabet or boundary twins as a typed Square finding. What keeps
them `provisional` is **overreach on three placeholder controls**: the candidate redacts them as `generic-token` under the credential-named
variable (benign false alarms, and the 14 and 7 metamorphic failures are the same two and one controls over their variants):

- `beta8-583a--square-token-your-access-token-placeholder` (`SQUARE_ACCESS_TOKEN=EAAA-your-access-token`),
- `beta8-583a--square-token-angle-brackets-placeholder` (`export SQUARE_ACCESS_TOKEN="EAAA<your-production-access-token>"`),
- `beta8-583a--square-oauth-application-secret-angle-brackets-placeholder` (`client_secret: sandbox-sq0csb-<your-sandbox-application-secret>`).

The #1014 handoff lists these as benign, so they are recorded as open `differential-false-alarm-unconfirmed` rows, not relabelled to
policy (the placeholder floors are not the credential-named-neighbour policy of
[`2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md`](../../../docs/decisions/2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md)).
They are the next candidate for a promote-finding pass; this repository does not assert product output.

## Peer lag and overreach per contract (`beta8-583a`, the Square corpus only)

Counts are fixtures. "Exact" is a finding whose range equals the authored secret span. "Asserted twins" are the prefix, alphabet and
boundary twins (7 for `square-token`, 9 for the secret); the unclaimed-width twins (5 and 4, T0) are excluded. "Typed" counts findings the
adapter attributes to the contract's own family; "any" counts a finding of any family (generic and bearer co-detections included).

| Contract | Tool | Positives exact | Missed | Asserted twins flagged (any / typed) | Controls flagged (any / typed) |
| --- | --- | --- | --- | --- | --- |
| `square-token` (14 positives, 7 twins, 11 controls) | gitleaks 8.30.1 | 14 | 0 | 2 / 0 | 0 / 0 |
| | trufflehog 3.97.4 | 9 | 5 | 2 / 2 | 0 / 0 |
| | redact-secret published 0.1.0-beta.13 | 11 | 3 | 4 / 0 | 2 / 0 |
| | redact-secret candidate 3b1a5aa | 14 | 0 | 4 / 0 | 2 / 0 |
| `square-oauth-application-secret` (15, 9, 10) | gitleaks 8.30.1 | 10 | 5 | 3 / 0 | 0 / 0 |
| | trufflehog 3.97.4 | 0 | 14 (1 other range) | 0 / 0 | 0 / 0 |
| | redact-secret published 0.1.0-beta.13 | 12 | 3 | 6 / 0 | 1 / 0 |
| | redact-secret candidate 3b1a5aa | 15 | 0 | 6 / 0 | 1 / 0 |

- **Peer lag.** gitleaks `square-access-token` (EAAA or `sq0atp-` + 22 to 60, entropy 2) reads all 14 access-token positives; it has no
  `sq0csp-` rule in its default config, so the application secret is reached only through `generic-api-key` (10 of 15, the keyword-gated
  contexts). trufflehog `square` needs the word square near the value and misses the 5 contexts without it; `squareapp` does not read the
  claimed secrets in any context here (0 of 15 exact). The published product has no Square detector: it reads 11 and 12 positives
  through its contextual and header policies as `generic-token` or `bearer-token`, and misses the bare ones.
- **Peer overreach.** trufflehog `square` reads an `=` in the body and the first 64 characters of a 150-character run (2 typed twin findings);
  its `squareapp` reports the public `sq0idp-` application id in the ObtainToken request (a range disagreement, resolved). The "any" twin
  findings of the product are credential-named co-detections (`generic-token`, `bearer-token`), never a typed Square finding.
- **Unclaimed widths.** `EAAA` at 59 and 61, `EAAl` + 59, `EQAA` + 60, `sq0atp-` + 22, `sq0csp-` at 42 and 45 and `sandbox-sq0csb-` at 42
  and 44 are flagged by the product as `generic-token` or `bearer-token` and by gitleaks on its wider windows; they read T0 and no row
  asserts either way.

## Ledger and gates

300 review rows were added in two independent keyings (published 232, candidate 244, 176 shared): 141 mutation rows settle under the decided
operator classes; 13 pending-fixture rows under `differential.t0-pending-fixture`; 10 candidate rows under
`differential.peer-coarser-classification`; 88 `redact-secret-only` rows resolve as `range-matches-corpus`; 38 published
`differential-coverage-gap` rows stay open until a release carrying the detector is pinned; 6 `differential-false-alarm-unconfirmed` rows are the
placeholders above. `queue:check`, `ledger:decisions:check` and `ledger:provenance:check` pass.

Moved by this change and re-authorised by the owner: `authority:check` and the evaluation-evidence assertion in
`tests/axis-overlay.test.mjs`. Any contract, taxonomy or registry change moves the benchmark-owned policy revision, which
the authority file and `benchmarks/official-runs.json` pin; the owner re-authorised the policy revision on 2026-10-06 (see the decision record).
