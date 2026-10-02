# Threat model: benchmark measurement and publication pipeline

**Status:** current for the local eval commands, the candidate-execution
adapters (`scanners/candidate.mjs`), the known-gaps promotion ledger, the
external adversarial intake, the holdout/blind custodian isolation, and the
`publish-site.yml` CI pipeline. Follows the [Boundary rule](../../AGENTS.md):
this repository measures and records scanner behavior; it never certifies
product security. This document is about *this repository's own* attack
surface — the code and CI that run other people's builds, hold synthetic
credential material, and publish results — not about the quality of any
scanner's detection.

This document names the assets, attackers, data flows, trust boundaries, and
residual risk per surface. A control is only "protects against" a class when
a corresponding check exists in the code or CI cited beside it.

## Assets

| Asset | Where it exists | Why it matters |
| --- | --- | --- |
| Synthetic/holdout fixture bytes | `corpora/`, `adversarial/packs/`, `holdout/generated/`, `redact-secret-blind-fixture/` (sibling dir, outside every repo) | Must never be a real, live, or provider-issued credential ([`2026-09-22-define-external-adversarial-intake.md`](../decisions/2026-09-22-define-external-adversarial-intake.md)); holdout/blind bytes must never reach a scanner author or a commit ([`holdout/README.md`](../../holdout/README.md)). |
| `benchmarks/known-gaps.json` ledger | Tracked in Git, one JSON file | Authoritative promotion record. A live credential, or a state transition made to look reviewed when it wasn't, is a real-world leak or a false ground-truth claim, not just a bug. |
| CI publish credentials | GitHub Actions secrets/vars: `BENCHMARKS_DISPATCH_APP_PRIVATE_KEY`, `PUBLISHER_ROLE_ARN` (AWS OIDC) | The GitHub App token can read `redact-secret/redact-secret` Actions artifacts and contents; the AWS role can write the public S3 bucket and invalidate CloudFront. Either one misused publishes attacker content or exfiltrates product-repo artifacts. |
| The candidate-execution process | `scanners/candidate.mjs` (`installCandidate`/`loadCandidate`), invoked by `eval:candidate`, `benchmark:candidate`, staging publish | Dynamically `import()`s and runs `dist/index.js` from a built `@redact-secret/core` tarball inside this repo's own Node process — by design, not a sandbox escape. Whatever that code can do, it does with this process's ambient access (filesystem, environment, network if unblocked). |
| `workflow_dispatch` inputs (`product_sha`, `qualification_run_id`, `product_ref`) | `.github/workflows/publish-site.yml` | Explicitly documented in the workflow as untrusted; only staging consumes them, and only after validation. |
| Published site content | `public/results/*.json`, S3 bucket, CloudFront | The only externally visible output. Must carry aggregates and metadata only — never matched plaintext, never an unqualified independence claim. |
| Peer scanner binaries | `trufflehog`, `gitleaks`, resolved via `PATH`, pinned in `qualification/suite-v1.json` / `peer-checksums.json` | Self-updating binaries; an unpinned or substituted binary silently re-keys every classification ledger entry ([#180](../../AGENTS.md)) or, if swapped for a malicious binary on `PATH`, executes attacker code during evaluation. |
| Adversarial pack provenance | `adversarial/packs/<id>/intake.json`, `schemas/adversarial-intake-v1.json` | External submitters attest non-liveness and construction; the attestation, not a validator, is the control ([decision](../decisions/2026-09-22-define-external-adversarial-intake.md)). |

## Attacker capabilities considered

1. **A compromised or malicious `redact-secret` product commit.** Its built
   `@redact-secret/core` package is what `installCandidate`/`loadCandidate`
   installs and `import()`s directly into this process for `eval:candidate`,
   `benchmark:candidate`, and the staging publish job. This is the sharpest
   trust boundary in the repository: candidate code runs with this process's
   full ambient access, not a sandbox.
2. **An external adversarial-pack submitter.** Can author fixtures and an
   `intake.json` claiming synthetic, non-inspected construction while actually
   submitting live, revoked, or real-derived material, or fixtures crafted to
   game a scorer once accepted.
3. **A `workflow_dispatch` caller with repo write access.** Can supply
   `product_sha`, `qualification_run_id`, `product_ref` to the staging publish
   job. Treated as untrusted input even from a trusted principal, per the
   workflow's own comments.
4. **A careless contributor or reviewer.** Pastes a real finding's plaintext
   into an issue, a `known-gaps.json` record, or a commit message; promotes a
   record without independently authored expectation evidence; grants a
   protected/holdout path to a scanner-tuning session.
5. **A compromised or substituted peer-scanner binary.** `trufflehog`/`gitleaks`
   resolved from `PATH` at eval time; self-updates, or a different binary
   entirely, change results without changing this repository's code.
6. **A compromised npm dependency of this repository.** `npm ci` in CI runs
   with the same job's CI credentials in scope during later steps (AWS OIDC
   role, GitHub App token) unless steps are ordered to minimize exposure.
7. **Anyone who can read the custodian/holdout material.** Out of scope to
   fully prevent (documented as `organisationalIndependence: false`); the
   control is procedural separation and immutability, not confidentiality
   from every possible reader.

## Surfaces

### Candidate execution (`scanners/candidate.mjs`, `eval:candidate`, `benchmark:candidate`)

- **Data flow:** a product tarball (`core`, `node`, `wasm`) → `installCandidate`
  writes a throwaway `package.json` and runs `npm install --ignore-scripts
  --no-audit --no-fund --package-lock=false` in a fresh temp dir → `loadCandidate`
  `import()`s `node_modules/@redact-secret/core/dist/index.js` directly into
  this process → `module.scan(text, options)` runs against corpus fixtures.
- **Trust boundary:** the Node process running the eval command. There is no
  process, container, or VM isolation between candidate code and the rest of
  this repository's environment.
- **Protects against:** arbitrary npm lifecycle scripts from the *installer's*
  own manifest (`--ignore-scripts`); accidental identity confusion (the
  installed package name/version is asserted before use); a stale/leftover
  install (temp dir removed on both success and failure paths).
- **Does not protect against:** the imported module itself executing arbitrary
  code — `--ignore-scripts` stops npm lifecycle hooks, not the JS the module
  runs when `initialize()`/`scan()` are called. A malicious `core` build can
  read this process's filesystem and environment, and reach the network unless
  something outside this code blocks it. This is accepted, not mitigated: the
  whole point of `eval:candidate` is to run the product's real code.
- **Requirements on the deployment:** never run `eval:candidate` /
  `benchmark:candidate` against a commit whose provenance you have not
  checked. The staging CI job only ever measures a commit that already passed
  the product repository's own `artifact-qualification` run, fetched with a
  read-only, `redact-secret`-scoped GitHub App token, and verifies the packed
  tarball bytes match the qualified artifact before running it
  (`scripts/qualified-candidate.mjs verify`).
- **Alternative if residual risk is unacceptable:** run candidate measurement
  in an isolated, network-restricted runner with no access to publish
  credentials; do not add candidate execution to any job that also holds the
  AWS publisher role or the GitHub App private key in the same step context.

### CI publish pipeline (`.github/workflows/publish-site.yml`)

- **Data flow:** push to `develop`/`main`, or `workflow_dispatch` → (staging
  only) mint a scoped GitHub App token → resolve and verify a qualified
  product commit → measure the corpus → build the site → assume an AWS OIDC
  role → sync to S3 → invalidate CloudFront.
- **Trust boundary:** the GitHub Actions job. `permissions: {}` at the
  workflow level with per-job grants (`contents: read`, `id-token: write`)
  is the intended default-deny baseline.
- **Protects against:** production ever measuring an arbitrary product commit
  (the workflow refuses `product_sha`/`qualification_run_id`/`product_ref` for
  `TARGET == production`, failing the run rather than silently ignoring them);
  a `product_sha` that isn't 40 hex; publishing a broken qualification run
  (`eval:qualify` failure without a written report fails the job); publishing
  mismatched candidate tarball bytes (`qualified-candidate.mjs verify`).
  publishing the Next export (`/next/`) without a qualification view built from the
  canonical RunArtifacts: they come from a release asset and are accepted only if every
  file hashes to the `byteDigest` in `benchmarks/official-runs.json`, so a replaced asset
  fails closed (`official-run-archive.mjs fetch`; `WEB_REQUIRE_QUALIFICATION=1`). The
  Next install and build run before AWS credentials are configured, and the export is
  moved under `dist/next` only, so it cannot overwrite an existing key.
- **Does not protect against:** a compromised `npm ci` dependency running
  during a step that executes after AWS credentials are already exported to
  the job environment; a compromised action pinned by tag rather than SHA
  (all third-party actions here are SHA-pinned, which is the mitigation — a
  future edit that reintroduces a tag ref regresses this).
- **Alternative if residual risk is unacceptable:** split candidate-measuring
  steps and publish-credential steps into separate jobs with an artifact
  handoff, so a compromised eval dependency never runs in a job that also
  holds `PUBLISHER_ROLE_ARN` or the GitHub App private key.

### Promotion ledger (`benchmarks/known-gaps.json`, `promote-finding` skill)

- **Data flow:** an evaluation run observes a discrepancy → `observed` record
  → independently authored expectation review → `reviewed` → a product issue
  and proposed synthetic reproducer → `promoted` → product-side fix and gate
  evidence → `fixed` → `verified`.
- **Trust boundary:** whoever can commit to this repository and open issues
  against `redact-secret/redact-secret`.
- **Protects against:** forward-only lifecycle transitions enforced by
  `validateKnownGaps` (`benchmarks/lib/promotion.ts`); promotion without an
  independently-authored expectation (review evidence must predate or be
  independent of the scanner run); an observation whose `corpusHash` no
  longer matches the checked-in corpus (stale, not reproducible).
- **Does not protect against:** a reviewer pasting matched plaintext into a
  `known-gaps.json` note, an issue body, or a commit message — this is a
  human-process control (`promote-finding`'s Safety rules), not a schema
  constraint the validator enforces byte-for-byte.
- **Residual risk:** an active or provider-issued credential submitted as
  benchmark input reaches `observed` before a human notices. Promotion review
  rejects it at the `reviewed` step, but the raw value may already exist in
  benchmark evidence storage from the observing run.
- **Alternative:** route anything that might still be live to the private
  reporting path before it ever becomes a `known-gaps.json` record (see
  `promote-finding`'s Safety rules); never wait for the promotion review step
  to catch it.

### External adversarial intake (`adversarial/`, `schemas/adversarial-intake-v1.json`)

- **Data flow:** external author writes fixtures + `intake.json` → safety
  review → `frozen-first-run.json` (immutable, hash-pinned) → `accepted`.
- **Trust boundary:** the submitter, until a maintainer completes safety
  review.
- **Protects against:** a pack whose author consulted scanner output before
  committing expected ranges (digest committed at submission, checked against
  the frozen first run); a frozen first run silently changing
  (`adversarial:check` fails CI on drift from `origin/main`); a material
  maintainer edit being miscredited as still externally authored (it loses
  `externally-authored` status and reports as maintainer regression instead).
- **Does not protect against:** a submitter successfully disguising real,
  revoked, or real-derived credential material as synthetic construction — the
  decision record is explicit that "a validator cannot prove a value was never
  real"; the declaration plus human safety review is the only control.
- **Alternative if residual risk is unacceptable:** treat every accepted pack's
  credential-shaped bytes as suspect until a maintainer with format expertise
  has reviewed the specific construction, not just the intake record's
  attestation field.

### Holdout and blind custodian isolation (`holdout/`, `redact-secret-blind-fixture/`)

- **Data flow:** protected fixtures live outside every Git repository (holdout:
  an ignored directory inside a checkout; blind: a sibling directory, mode
  0700, refused if it is or is inside a `.git`) → frozen candidate identity →
  one run → aggregate-only release.
- **Trust boundary:** whoever has filesystem access to the custodian's machine
  or session. The decision record states this plainly:
  `organisationalIndependence: false` — one operator can read the private
  directory.
- **Protects against:** raw fixtures, expected ranges, or per-fixture results
  reaching product-implementing sessions or the published site
  (`schemas/blind-aggregate-v1.json` is a field whitelist); a corpus, freeze,
  or ledger file being tracked or published (`blind:check-public` fails CI on
  this); a second attempt at a spent candidate identity within an epoch; an
  old-epoch fixture being reused after disclosure.
- **Does not protect against:** the custodian session itself being compromised
  or sharing blind spots with the product-implementing sessions it is meant to
  be independent from.
- **Alternative:** none available with a single-operator project; documented
  as a residual risk rather than mitigated.

### Publication (`public/results/*.json`, the deployed site)

- **Data flow:** local/CI eval output → `eval:publish*` scripts validate
  against schemas → synced to S3 → served via CloudFront.
- **Trust boundary:** anyone on the public internet reading the site.
- **Protects against:** publishing an incomplete or unvalidated bundle (the
  PII population artifact is only published after both referenced credential
  artifacts pass their validators; the v2 domain index is uploaded last, after
  everything it references); an unnegated independence claim reaching the
  rendered site (`adversarial:check` rejects it).
- **Does not protect against:** a bug in an `eval:publish*` script that
  includes a raw finding value in an otherwise-schema-valid field the
  validator doesn't specifically check for plaintext shape.

## Residual risks accepted

| Risk | Why accepted | Mitigation available to the operator |
| --- | --- | --- |
| Candidate product code runs with full process ambient access, no sandbox | Measuring real detector behavior requires running the real code; a sandbox that changed behavior would invalidate the measurement | Only run `eval:candidate`/`benchmark:candidate` against commits with checked provenance; never share a job context with publish credentials |
| A submitter can disguise real credential material as a synthetic adversarial fixture | No validator can prove non-liveness; only human review + attestation | Treat credential-shaped bytes in any accepted external pack as reviewer-verified, not validator-verified |
| One operator can read holdout/blind material | No second human custodian exists for this project | State `organisationalIndependence: false` in every report; never claim independent evaluation |
| A live credential can reach `observed` in `known-gaps.json` before a human reviews it | The lifecycle's automated gate is at `reviewed`, not `observed` | Route anything possibly-live to the private security path before any promotion step |
| A self-updating peer scanner silently changes classification results | The binaries are third-party and not vendored | Pin and verify the version before any claim-producing run (`assertPinnedPeers`); never report a number from an unpinned peer |
| A compromised action pinned by tag instead of SHA | Not applicable today — every third-party action here is SHA-pinned | Keep new workflow edits to SHA-pinned actions; treat a tag-pinned action as a regression to fix, not accept |
