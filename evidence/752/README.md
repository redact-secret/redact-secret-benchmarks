# Evidence: #752, Group C: independently qualify format-conflict resolution

**Result:** NOT MEASURED. No row of Group C (11 candidates) has an accepted product
contract yet, so nothing is frozen, nothing is run and no score exists. This page records
that state and what each next step needs; it asserts no product output.

## Why nothing is measured

- The research children ([#239](https://github.com/redact-secret/credential-evidence/issues/239), [#240](https://github.com/redact-secret/credential-evidence/issues/240), [#241](https://github.com/redact-secret/credential-evidence/issues/241)) are closed, but the per-row product contract or disposition
  is the product's decision: [redact-secret#1228](https://github.com/redact-secret/redact-secret/issues/1228) is open and
  `docs/audits/evidence/` of the product repository holds no Group C handoff.
- Acceptance requires expected cases authored independently of core and frozen before
  execution from the accepted contract. Current product output and peer output cannot set an
  expectation, so a case set written now would be a guess, not a qualification.
- Axes this track measures once contracts exist: prefix, separator, length/alphabet, context removal and benign collision, only for adopted properties; bare and contextual coverage as separate claims. Unproven tool-only widths and opaque
  bare values are unassertable and contribute no pass or fail.
- Peer runs need TruffleHog 3.97.4 first on `PATH`; the host here reads 3.97.6, so no peer
  observation was taken (an unpinned run would re-key the ledger, see AGENTS.md).

## Inventory ledger

| Candidate | Product contract | Frozen cases | Baseline |
| --- | --- | --- | --- |
| `adobe:enterprise-web-app-client-secret` | no accepted contract | not authored | not measured |
| `adobe:oauth-server-to-server-client-secret` | no accepted contract | not authored | not measured |
| `adobe:oauth-web-app-client-secret` | no accepted contract | not authored | not measured |
| `airtable:personal-access-token` | no accepted contract | not authored | not measured |
| `dropbox:access-token` | no accepted contract | not authored | not measured |
| `hubspot:private-app-access-token` | no accepted contract | not authored | not measured |
| `contentful:cma-personal-access-token` | no accepted contract | not authored | not measured |
| `jfrog:reference-token` | no accepted contract | not authored | not measured |
| `meta:app-secret` | no accepted contract | not authored | not measured |
| `salesforce:oauth-refresh-token` | no accepted contract | not authored | not measured |
| `x:oauth1-consumer-secret` | no accepted contract | not authored | not measured |

Counts by state: 11 awaiting an accepted contract; 0 frozen; 0 measured; 0 handed off
as gaps (a gap needs an adopted contract and a reproduction).

## Next, per ready row (rows proceed individually)

1. The product records the row's contract or disposition on #1228 (including unresolved properties).
2. Author and freeze synthetic cases from it, independently of core; add them under `evidence/752/`.
3. Product-only baseline on the exact published pin and the exact candidate, with scanner,
   config, input and environment digests; with pinned TruffleHog only if a peer is wanted.
4. Hand each confirmed gap to #1228 with a reproduction; replay the exact candidate fix on the
   unchanged inputs and the Batch 1/2 and regression controls.

## Not claimed

No official pin, authority, ledger or support status changed; no workflow or official run was
dispatched; diagnostic outcomes never change those. Cross-track ties (Adobe subtype and
HubSpot static-auth between C and D; Dropbox legacy/current and JFrog eras between C and E)
are reused as shared source observations, not re-derived here.
