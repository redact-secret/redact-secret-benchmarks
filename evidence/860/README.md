# Evidence: redact-secret#860 — Tier A READY credential families measured at candidate feb7aea

**Result (candidate mode, feb7aea):** all 234 positives of the 18 #434 arrival families are EXACT and attributed to
their own new detector and finding type; 0 of 183 benign controls are flagged; no twin draws a finding from its own
family (every flagged twin is generic `contextual_secret`/`bearer_token` co-detection in a credential-named or header
context, plus one `oak_` twin that is correctly reported as a Composio org key). No stable claim: the families stay
unscored arrival families until the product detectors are merged and the registry is re-pinned. Whole-suite
classification: 64 stable of 86 registry families in both candidate mode (feb7aea) and published mode (0.1.0-beta.10),
with no family status changed by the candidate.

Benchmark side of [redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860) (product
[#903](https://github.com/redact-secret/redact-secret/issues/903)–[#909](https://github.com/redact-secret/redact-secret/issues/909)),
corpus and contracts from [redact-secret-benchmarks#434](https://github.com/redact-secret/redact-secret-benchmarks/issues/434)
(`benchmarks/lib/beta8/434a.ts`–`434g.ts`, [beta8-evidence.md](../../docs/specs/beta8-evidence.md#beta11-slices-434)).
No matched plaintext or example credential is retained here.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `feb7aea3041604ae121737a65c0cee32363d0977` (tip of the product branch with all seven detector commits, #903–#909; not yet merged to `main`), clean |
| `redact-secret-benchmarks` | `7113c259d314ace58f559bf29f436dbe0ba59b3b` (corpus and ledger), clean; lockfile `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Handoff contracts | `redact-secret` `270faf84dc12f6a4a4cf61fe3ffab7aadc4f7262` (`docs/audits/evidence/860/*.md`) |

Candidate artifacts (built by `npm run benchmark:candidate` at the product commit): core
`4c1a81b0a96e9d3343a696a7d2e60e9080ed95ccff20ec9acbe140619324aebf`, node darwin-arm64
`366c3a83965ac8b7f25c5d27cd2b588c29dd4c16ad6788cd90487341599f8479`, wasm
`6edefbaff8cd2927f36d65a94cdb52dbda160df89f95abbedbb8422f24fb2210` (declared version 0.1.0-beta.10).
Candidate run `bd065d22-5dec-425e-af0f-5f5e5af9f67f`: complete, full suite, 4,276 of 4,276 fixtures, corpus hash
`3c9b59a6c5b23a8f5600d1d34e1edaa099a0ae86cfc215b7417a05cc64a3e02c`
([`feb7aea/candidate-evidence-v1.json`](feb7aea/candidate-evidence-v1.json)). Candidate classification run
`b956effd-cbe8-4cfc-9049-51129701ccc0` ([`feb7aea/support-status.json`](feb7aea/support-status.json)). Published
classification run `c0029b1c-bb74-4b3a-9b7f-86224e49662a` (0.1.0-beta.10, the run the #434 ledger rows cite).

Pinned peers: trufflehog 3.97.4 (read-only binary first on `PATH`; the machine default had self-updated) and gitleaks
8.30.1.

## Per-family result (candidate feb7aea)

| Family (arrival id) | Positives EXACT | Controls flagged | Twins flagged (all co-detection) |
| --- | --- | --- | --- |
| `doppler-token` (`dp.st.`) | 18/18 | 0/10 | 9/15 |
| `doppler-personal-token`, `-cli-token`, `-service-account-identity-token`, `-scim-token`, `-audit-token` | 14/14 each | 0/10 each | 7/12 each |
| `doppler-service-account-token` | 14/14 | 0/10 | 8/13 |
| `trigger-dev-token` | 12/12 | 0/11 | 12/16 |
| `trigger-dev-personal-access-token` | 10/10 | 0/10 | 6/8 |
| `e2b-api-key` | 13/13 | 0/10 | 8/11 |
| `posthog-token`, `posthog-project-secret-api-key` | 11/11 each | 0/11 each | 8/11 each |
| `helicone-api-key` | 11/11 | 0/10 | 11/14 |
| `helicone-write-api-key` | 12/12 | 0/10 | 10/14 |
| `firecrawl-api-key` | 13/13 | 0/10 | 11/14 |
| `composio-api-key` | 13/13 | 0/10 | 11/14 (one is `oak_` reported as `composio_org_api_key`) |
| `composio-org-api-key`, `composio-user-api-key` | 13/13 each | 0/10 each | 7/10 each |

Attribution was checked by scanning every positive, control and flagged twin with the candidate core package: each
positive carries the handoff's detector id and finding type, and the 151 flagged twins carry 121
`generic-token/contextual_secret`, 29 `bearer-token/bearer_token` and 1 `composio-api-key/composio_org_api_key`.
Twin discrimination for these families is therefore an upper bound on co-detection, as for every arrival family
([beta8-evidence.md](../../docs/specs/beta8-evidence.md#scoring-a-mapped-arrival-family-730)). No product miss was found.

## Peer lag (pinned peers, published-mode snapshots at benchmarks 7113c25)

Own-family coverage of the #434 positives:

| Family | trufflehog 3.97.4 | gitleaks 8.30.1 |
| --- | --- | --- |
| `doppler-token` | 17/18 (misses the `dp.st.` value with an underscore environment segment in the chat context) | 0/18 |
| `doppler-personal-token` | 14/14 | 5/14 (only 43-byte bodies; 40 and 44 missed) |
| `doppler-cli-token`, `-service-account-token`, `-scim-token`, `-audit-token` | 14/14 each | 0/14 each |
| `doppler-service-account-identity-token` (`said`) | 0/14 | 0/14 |
| `posthog-token` (`phx_`) | 7/11 (misses the 42- and 49-byte bodies) | 0/11 |
| `posthog-project-secret-api-key` (`phs_`) | 0/11 | 0/11 |
| Trigger.dev, E2B, Helicone, Firecrawl, Composio | 0 (no rule) | 0 (no rule) |

## Commands

```sh
export PATH=<read-only dir with trufflehog 3.97.4>:$PATH   # gitleaks 8.30.1 also on PATH
# product worktree at feb7aea, clean:
npm run benchmark:candidate -- --benchmark-ref 7113c259d314ace58f559bf29f436dbe0ba59b3b \
  --benchmark-repo <benchmarks checkout> --output-dir <dir>
# benchmarks checkout at 7113c25:
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=feb7aea3041604ae121737a65c0cee32363d0977 --output=evidence/860/feb7aea/support-status.json
npm run eval:classify                                     # published mode, 0.1.0-beta.10
```

## Next step

Graduation (re-pin `benchmarks/detectors.json` to the merged product commit, move the seven detector-id families'
contracts to `registryContracts`, add the eleven sibling finding types to `arrivalFindingTypes`, give the detectors the
`detector-coverage` minimum) happens after the product PR merges, and re-triages the open #434 differential rows
against that commit. Nothing here is a support-status claim.
