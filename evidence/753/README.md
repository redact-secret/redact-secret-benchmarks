# Evidence: #753, Group D: independently qualify role, confidentiality and family modelling

**Result:** NOT MEASURED. No row of Group D (23 candidates) has an accepted product
contract yet, so nothing is frozen, nothing is run and no score exists. This page records
that state and what each next step needs; it asserts no product output.

## Why nothing is measured

- The research children ([#242](https://github.com/redact-secret/credential-evidence/issues/242), [#243](https://github.com/redact-secret/credential-evidence/issues/243), [#244](https://github.com/redact-secret/credential-evidence/issues/244)) are closed, but the per-row product contract or disposition
  is the product's decision: [redact-secret#1229](https://github.com/redact-secret/redact-secret/issues/1229) is open and
  `docs/audits/evidence/` of the product repository holds no Group D handoff.
- Acceptance requires expected cases authored independently of core and frozen before
  execution from the accepted contract. Current product output and peer output cannot set an
  expectation, so a case set written now would be a guess, not a qualification.
- Axes this track measures once contracts exist: masking and provider/role attribution separately; expected default/override actions from accepted core policy, never inferred from "public"/"read-only" or peer output. Unproven tool-only widths and opaque
  bare values are unassertable and contribute no pass or fail.
- Peer runs need TruffleHog 3.97.4 first on `PATH`; the host here reads 3.97.6, so no peer
  observation was taken (an unpinned run would re-key the ledger, see AGENTS.md).

## Inventory ledger

| Candidate | Product contract | Frozen cases | Baseline |
| --- | --- | --- | --- |
| `algolia:admin-api-key` | no accepted contract | not authored | not measured |
| `algolia:analytics-api-key` | no accepted contract | not authored | not measured |
| `algolia:monitoring-api-key` | no accepted contract | not authored | not measured |
| `algolia:search-only-api-key` | no accepted contract | not authored | not measured |
| `algolia:secured-api-key` | no accepted contract | not authored | not measured |
| `algolia:usage-api-key` | no accepted contract | not authored | not measured |
| `algolia:write-api-key` | no accepted contract | not authored | not measured |
| `contentful:delivery-api-access-token` | no accepted contract | not authored | not measured |
| `contentful:preview-api-access-token` | no accepted contract | not authored | not measured |
| `asana:service-account-token` | no accepted contract | not authored | not measured |
| `dropbox:app-auth-token` | no accepted contract | not authored | not measured |
| `elastic:cross-cluster-api-key` | no accepted contract | not authored | not measured |
| `elastic:serverless-project-api-key` | no accepted contract | not authored | not measured |
| `figma:cli-plan-access-token` | no accepted contract | not authored | not measured |
| `figma:plan-access-token` | no accepted contract | not authored | not measured |
| `hubspot:static-auth-access-token` | no accepted contract | not authored | not measured |
| `jfrog:pairing-token` | no accepted contract | not authored | not measured |
| `meta:instagram-app-secret` | no accepted contract | not authored | not measured |
| `canva:authorization-code` | no accepted contract | not authored | not measured |
| `meta:app-access-token` | no accepted contract | not authored | not measured |
| `x:oauth1-access-token` | no accepted contract | not authored | not measured |
| `zoom:build-platform-api-key` | no accepted contract | not authored | not measured |
| `zoom:webhook-secret-token` | no accepted contract | not authored | not measured |

Counts by state: 23 awaiting an accepted contract; 0 frozen; 0 measured; 0 handed off
as gaps (a gap needs an adopted contract and a reproduction).

## Next, per ready row (rows proceed individually)

1. The product records the row's contract or disposition on #1229 (including unresolved properties).
2. Author and freeze synthetic cases from it, independently of core; add them under `evidence/753/`.
3. Product-only baseline on the exact published pin and the exact candidate, with scanner,
   config, input and environment digests; with pinned TruffleHog only if a peer is wanted.
4. Hand each confirmed gap to #1229 with a reproduction; replay the exact candidate fix on the
   unchanged inputs and the Batch 1/2 and regression controls.

## Not claimed

No official pin, authority, ledger or support status changed; no workflow or official run was
dispatched; diagnostic outcomes never change those. Cross-track ties (Adobe subtype and
HubSpot static-auth between C and D; Dropbox legacy/current and JFrog eras between C and E)
are reused as shared source observations, not re-derived here.
