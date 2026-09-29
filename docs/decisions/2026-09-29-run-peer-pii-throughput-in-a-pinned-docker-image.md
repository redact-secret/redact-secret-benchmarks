---
decision_id: decision-run-peer-pii-throughput-in-a-pinned-docker-image
status: proposed
scope: benchmarks
title: Run the peer PII runtime-throughput snapshot in a pinned Docker image, and refuse emulated or lagging snapshots
decided_at: 2026-09-29
---

# Run the peer PII runtime-throughput snapshot in a pinned Docker image, and refuse emulated or lagging snapshots

## Context

[#513](https://github.com/redact-secret/redact-secret-benchmarks/issues/513): the
[#429](https://github.com/redact-secret/redact-secret-benchmarks/issues/429) snapshot was a hand-run with an addon built
from whatever checkout the operator had. The report named only `version: 0.1.0-beta.10`, so nobody could tell which
product commit it described once the pin moved, and a rerun on macOS arm64 would change the hardware basis.

## Decision

1. **A `Dockerfile` builds the addon from a product commit SHA.** Base image `node:22.22.2-bookworm` pinned by index
   digest, `linux/amd64`, Rust 1.90.0 (above the product's 1.88 MSRV; `RUSTUP_TOOLCHAIN` overrides the product's floating
   `stable`), dependencies by `npm ci`. Only a 40-hex SHA is accepted, and the build fails if the checked-out `HEAD`
   differs.
2. **The ref defaults to the pin.** `scripts/run-peer-pii-runtime-throughput-docker.sh` reads
   `benchmarks/pin-manifest.json` `pins.redactSecretRevision`. The measurement refuses to write `evidence/429/` when
   `REDACT_SECRET_REF` differs from it, so the snapshot cannot silently lag the pin. The check runs before measuring.
3. **Emulation is recorded and blocks the committed snapshot.** The wrapper reads the Docker daemon architecture; a
   non-amd64 host sets `emulated: true`. Emulated runs work for smoke checks anywhere else but cannot write
   `evidence/429/`. The committed snapshot must come from a native amd64 host.
4. **Variance is bounded and disclosed, not removed.** `--cpus` is fixed (default 4) and recorded as `runner.cpuLimit`
   with `runner.cpuModel`. Noisy neighbours remain; the framing stays informational-only, no verdict, no ranking
   (Boundary rule).
5. **Report `schemaVersion: 2` requires the identity.** `runner.{cpuModel, cpuLimit, emulated, imageDigest}` and
   `tools[redact-secret].provenance.commit`. The image digest is the image ID (`sha256:<64 hex>`): a running container
   cannot read its own registry digest, and the image ID is content-addressed. `schemaVersion: 1` stays valid only for the
   existing frozen snapshot until it is regenerated.

## Consequences

- The plan's `implementationFreeze` hashes are not recomputed: the validator checks their shape, not the file bytes, and
  re-freezing would change `contentCommitment` for a plan whose measured content did not change.
- The base image digest and Rust version are bumped by editing the `Dockerfile`; that changes the image ID recorded in
  the next report.
- Not done here: a `workflow_dispatch` job on an `ubuntu` runner, and reusing the image for the performance and PII
  profile-cost reruns.
- `evidence/429/peer-pii-runtime-throughput.json` still needs regenerating from a native amd64 host at the pin.
