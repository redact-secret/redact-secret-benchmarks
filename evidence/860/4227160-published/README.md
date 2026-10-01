# Evidence: published 0.1.0-beta.12 (release source 4227160) measured in published mode

**Result:** published mode (`@redact-secret/core` 0.1.0-beta.12 from npm) reads **127 stable of 135** registered
families (documented 89, empirical 38; 7 provisional, 1 pending, 0 unsupported), against the beta.11 published reading
of 97 stable (`../bfc608c/`) and the `bfc608c` candidate reading of 127. The support matrix generated from it reads
**144 stable, 7 provisional, 5 pending and 17 unsupported of 173** taxonomy families (beta.11 published: 111 stable of
173). Classifying the three published npm tarballs as a candidate bound to `4227160` gives byte-identical `families`.
Every family status matches the `bfc608c` candidate classification ([`../bfc608c/README.md`](../bfc608c/README.md)),
and 30 families that read provisional against published beta.11 now read stable. This records a measurement. It makes
no `latest` dist-tag claim: `latest` still points at 0.1.0-beta.11.

## Files

| File | Mode | Run |
| --- | --- | --- |
| [`support-status-published.json`](support-status-published.json) | published npm package 0.1.0-beta.12 (`publishedPackage`, no `product`) | `f7c80ce2-0584-4280-8d12-b0fe2e5448a7` |
| [`support-matrix-published.json`](support-matrix-published.json) | the matrix generated from that file | |
| [`support-status-release-artifacts.json`](support-status-release-artifacts.json) | the three published npm tarballs, classified as a candidate bound to `4227160` (`product.declaredVersion` 0.1.0-beta.12) | `07d1bfa0-b7e4-43e3-b0d8-f9de06494d73` |
| [`support-matrix-release-artifacts.json`](support-matrix-release-artifacts.json) | the matrix generated from that file. **This is the file for core's `benchmarks/support-matrix.json`**: it names the version and the source commit, which core's site feed reads. | |

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` | `v0.1.0-beta.12` peels to `4227160c4dac402d7add53d3f8fe990f693912c1`. No file under `crates/` differs from `bfc608c` |
| npm tarballs (`npm pack` from the registry; integrity matches `npm view … dist.integrity`) | core `9011bbe659629c892ad1f1309a3ec1719621e5e782650543400871a120eebcbb`, node-darwin-arm64 `3b34840ba24c5e757c5c59c0cac3af47dbc5ca5492a3257598a6563216d75251`, wasm `efdc7d121b215dfc99dac1af4a67191ff9e3f4e586639ed59663262e150aab56` |
| Product release inventory | `docs/releases/0.1.0-beta.12/artifact-inventory.json` on product `main` lists the core and wasm tarball sha256 above, and `fc693c82…11cb` for `redact-secret.darwin-arm64.node`, which is the file inside the node tarball |
| `redact-secret-benchmarks` | `e8f73bfd7241845ef9fb75574a72b135aa777ba6` (branch `workbench/repin-beta12-published`, clean tree: reports record `dirty: false`) |
| Fixture index / taxonomy | `58f09c35…bdfbd` (5,950 fixtures) / `7a210894…44fc` |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1. The committed peer snapshots (gitleaks `bb703ebb…`, trufflehog `b94c76a8…`) were reused and validated; the input identity did not change |

## Not covered

- `latest` dist-tag: not moved, not measured.
- Ledger: no new triage. Published and `bfc608c` candidate readings agree, so no differential id changed owner.
- The 7 provisional families (bearer-token, connection-string, generic-token, okta-api-token, otpauth-uri,
  slack-app-level-token, together-ai-api-key) and pending `vercel-token` read as at `bfc608c`.

## Commands

At `e8f73bfd`, clean:

```sh
export PATH="$HOME/.local/opt/trufflehog-3.97.4:$PATH"   # trufflehog --version -> 3.97.4
npm pack @redact-secret/core@0.1.0-beta.12 @redact-secret/node-darwin-arm64@0.1.0-beta.12 @redact-secret/wasm@0.1.0-beta.12
npm run eval:classify -- --output=<dir>/support-status-published.json
npm run eval:classify -- --candidate-package=redact-secret-core-0.1.0-beta.12.tgz \
  --candidate-node-package=redact-secret-node-darwin-arm64-0.1.0-beta.12.tgz \
  --candidate-wasm-package=redact-secret-wasm-0.1.0-beta.12.tgz \
  --candidate-source-commit=4227160c4dac402d7add53d3f8fe990f693912c1 --output=<dir>/support-status-release-artifacts.json
npm run eval:matrix -- --input=<dir>/support-status-<mode>.json --output=<dir>/support-matrix-<mode>.json
```

Output goes outside the worktree: writing into it makes the report record `dirty: true`.
