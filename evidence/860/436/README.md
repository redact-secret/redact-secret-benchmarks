# Evidence: redact-secret#860 Tier B (#912–#917) measured at candidate 2a27c76

**Result:** candidate mode, product `2a27c76`: all 78 Tier B positives (13 per family × 6) are reported by the family's own new detector with an exact span, and no twin is reported by the family's own detector. 7 of 56 independent controls are flagged, all by `generic-token` or `bearer-token` on handoff-listed placeholders or references. No status claim: the six families stay unscored arrival families until the registry is re-pinned to the merged product, and the stable gate (core conformance plus the arrival gate) has not been run for them. Candidate mode 64 stable of 86 families; published mode (0.1.0-beta.10) 64 stable of 86; identical per family.

Benchmark side of [redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860) Tier B
([#912](https://github.com/redact-secret/redact-secret/issues/912)–[#917](https://github.com/redact-secret/redact-secret/issues/917)),
[redact-secret-benchmarks#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436), per
[`evidence/README.md`](../../README.md). Corpus and contracts:
[`docs/reports/2026-09-28/beta-11-tier-b-corpus-handoff.md`](../../../docs/reports/2026-09-28/beta-11-tier-b-corpus-handoff.md).
No matched plaintext or example credential is retained here.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `2a27c76b4952c3f2fa86e42ecd6128bb4615f095` (branch `beta11/860-tier-b-families`, the #917 commit on top of #912–#916, #911, #918, #919), clean |
| `redact-secret-benchmarks` | `1f9d3ca7ebf522da77f861be048712d837708e02` (branch `beta11/436-tier-b-family-corpus`), clean |

Candidate artifacts (built by the product's `npm run benchmark:candidate`, 0.1.0-beta.10 declared version):
core `4c1a81b0a96e9d3343a696a7d2e60e9080ed95ccff20ec9acbe140619324aebf`, node darwin-arm64
`39fee59591ce8ce835211d99e714d1f51780c8884161dbd60a8c8649ebdbb9c4`, wasm
`bd2aca5d0baf104d3df38b72f87ea04ebb372b69893199cbda65aaaa264ff520` (the core and wasm hashes reproduced across two builds; the node addon did not, and both builds gave identical per-fixture results). Benchmark lockfile
`14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939`, corpus hash
`a557a58af723ddeaa2524fd217aa2523c0ee34ce1e1f2b60fd811c4324e08f9f`, fixture index digest
`e1d3c9888d2d4c4329c8cbfac5eb31d663653c05fb62669da7f79016144512e2` (3,824 fixtures).

Candidate run `d427a1ae-4857-4e15-854d-5a100fbb79cb`: complete, full suite, 3,824 of 3,824 fixtures
([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`). Candidate classification run
`ef3e7a34-e720-4ed3-b3b7-cb41deb4e3e4`.

Pinned scanners: trufflehog 3.97.4 and gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`;
the machine's Homebrew trufflehog self-updated past the pin and was not used). Peer observations are the validated snapshots
committed at `1f9d3ca`.

## Per-family result (candidate mode, 2a27c76)

Attribution comes from scanning each generated fixture with the candidate package and reading each finding's detector id.

| Family | Positives exact, own detector | Twins: own detector / other family / none | Controls flagged |
| --- | --- | --- | --- |
| `convex-deployment-key` | 13 / 13 | 0 / 6 / 4 | 3 / 10 (`generic-token`, high) |
| `onepassword-service-account-token` | 13 / 13 | 0 / 6 / 3 | 0 / 9 |
| `inngest-signing-key` | 13 / 13 | 0 / 6 / 3 | 2 / 10 (`bearer-token` high, `generic-token` medium) |
| `resend-api-key` | 13 / 13 | 0 / 8 / 3 | 2 / 9 (`generic-token`, medium) |
| `apify-api-token` | 13 / 13 | 0 / 4 / 3 | 0 / 10 |
| `wandb-api-key` | 13 / 13 | 0 / 3 / 3 | 0 / 8 |

W&B positives at 85, 86 and 87 characters are all reported exactly, so the tolerant length range decided on #917 covers
the authored range. The W&B on-prem positive is reported on the `wandb_v1_` key without the `local-` label (inside the
authored envelope).

### Findings for the product (not edited away)

1. **Convex placeholders under `CONVEX_*_KEY` names (new since 0.1.0-beta.10).** `generic-token` reports high, redact
   findings on three handoff-listed benign controls: `CONVEX_SELF_HOSTED_ADMIN_KEY=prod:your-deployment-name|your-admin-key`,
   `CONVEX_DEPLOY_KEY='prod:adjective-animal-123|super-secret-key'` and the partial reference
   `CONVEX_DEPLOY_KEY=prod:<name>|${CONVEX_BODY}`. The published 0.1.0-beta.10 flagged none of them; the change that makes
   `generic-token` recognize `CONVEX_*_KEY` names (redact-secret#919) exposes the docs placeholders and the partial
   reference to the generic layer.
2. **Inngest placeholders (also in 0.1.0-beta.10).** `Authorization: Bearer signkey-prod-<YOUR-SIGNING-KEY>` gives a
   `bearer_token` finding over the 13-byte `signkey-prod-` lead, and `signingKey: "signkey-test-12345"` gives a medium
   `contextual_secret`. Both are handoff-listed benign placeholders.
3. **Resend placeholders (also in 0.1.0-beta.10).** `RESEND_API_KEY=re_123456789` and `resend.api_key = "re_yourkey"`
   give medium `contextual_secret` findings.

## Classification

Candidate mode (`eval:classify` with the three candidate tarballs, product `2a27c76`) reads 64 stable, 20 provisional,
2 pending of 86 families (documented 39, empirical 25). Published mode (0.1.0-beta.10) reads the same, identical per
family, on this branch and on `develop` at `80a168b` (the only later `develop` change, `d09a25a`, touches workflows and `evidence/829`). The six Tier B families are not in either count: they are arrival
ids, unscored until graduation. So no stable claim is made here. A stable claim needs the product's core-conformance
gate on the merged commit, a registry re-pin that graduates the ids, and the arrival gate (`arrival:check`) and
classification on that pin.

## Commands

```sh
# benchmarks worktree at 1f9d3ca
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog 3.97.4, gitleaks 8.30.1
# product worktree at 2a27c76 (clean)
npm run benchmark:candidate -- --benchmark-ref 1f9d3ca7ebf522da77f861be048712d837708e02 \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree, candidate mode
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=2a27c76b4952c3f2fa86e42ecd6128bb4615f095 --output=<dir>/support-status.json
```
