# Adapter evidence map: what the detector results do and do not show

Issue: [#394](https://github.com/redact-secret/redact-secret-benchmarks/issues/394),
part of [redact-secret-adapters#41](https://github.com/redact-secret/redact-secret-adapters/issues/41).

This page separates two kinds of evidence a reader can confuse: detector-family
accuracy (measured here) and host-adapter boundary qualification (mostly
recorded in the adapters repository). It records where each lives. It asserts
nothing about the product; see the [boundary rule](../../AGENTS.md#boundary-rule).

## What the detector results establish, and what they do not

The scanner comparison (`npm run eval`, the [support status](support-status.md)
of each family) answers one question: given authored synthetic files, which byte
ranges does a scanner report?

| It establishes | It does not establish |
| --- | --- |
| Whether a detector family reports, misses or over-reports a synthetic case, with the tier and evidence basis behind the case | That `@redact-secret/adapter-pino`, `-otel`, `-ai-context`, `-mcp` or the Python `redact-secret-adapters` package is installed, placed or configured correctly in a host |
| Peer scanner behavior on the same cases, at pinned versions | That an adapter covers every field a host writes (log message, attributes, span events, headers, tool results) |
| Throughput and cost of the scanners themselves | That redacted bytes are what reaches a destination (a file, a transport, an exporter, a model context) |
| | That an empty finding list means an input is secret-free |

A detector score, a `stable` family count or a scanner comparison is therefore
not an integration score. Nothing in this repository ranks adapters, and
adapters are not combined into one number with scanners.

## Where each adapter boundary is qualified

The adapters repository records what each package is qualified against in
[`compatibility.json`](https://github.com/redact-secret/redact-secret-adapters/blob/main/compatibility.json)
(schema `redact-secret-adapters/compatibility-v1`): the declared host and core
ranges, the exact endpoint versions CI installs from the registry on every push,
and the real-host tests that qualify each package (`qualifiedBy`).
`npm run compat:check` there fails when that record, the package manifests and
CI disagree, and `scripts/check-published-combination.mjs` and
`scripts/smoke-test-npm-packages.mjs` check installed consumers. Those checks
are that repository's claim, not this one's.

| Boundary | Qualified in the adapters repository | Measured in this repository |
| --- | --- | --- |
| Pino (`@redact-secret/adapter-pino`) | [`packages/adapter-pino/test/`](https://github.com/redact-secret/redact-secret-adapters/tree/main/packages/adapter-pino/test): real Pino `hooks.logMethod` and `hooks.streamWrite`, `pino.destination`, `pino.transport` worker threads, throwing and backpressured destinations | nothing |
| OpenTelemetry JS (`@redact-secret/adapter-otel`) | [`packages/adapter-otel/test/`](https://github.com/redact-secret/redact-secret-adapters/tree/main/packages/adapter-otel/test): Simple and Batch span processors, span names, attributes, events, links, failing exporters, flush and shutdown | nothing |
| Python logging and OTel (`redact-secret-adapters`) | [`python/tests/`](https://github.com/redact-secret/redact-secret-adapters/tree/main/python/tests): `logging.Filter` placement with several handlers, `QueueHandler`, OTel span processors | nothing |
| Shared adapter core (`@redact-secret/adapter`) | [`packages/adapter/test/`](https://github.com/redact-secret/redact-secret-adapters/tree/main/packages/adapter/test) | nothing |
| AI context (`@redact-secret/adapter-ai-context`) | [`packages/adapter-ai-context/test/`](https://github.com/redact-secret/redact-secret-adapters/tree/main/packages/adapter-ai-context/test): the core's conformance fixture replayed on the real core | nothing beyond the MCP consumer below, which includes it as a dependency |
| MCP (`@redact-secret/adapter-mcp`) | [`packages/adapter-mcp/test/`](https://github.com/redact-secret/redact-secret-adapters/tree/main/packages/adapter-mcp/test): the core's conformance fixtures on real SDK clients and servers | black-box qualification of `tools/call` and `resources/read`: [spec](mcp-qualification.md), `npm run mcp:qualify`, evidence under [`evidence/612/`](https://github.com/redact-secret/redact-secret-benchmarks/blob/65ffe7dcb3e7124e7f66cff96cab814f0365f69a/evidence/612/README.md) and [`evidence/843/`](https://github.com/redact-secret/redact-secret-benchmarks/blob/65ffe7dcb3e7124e7f66cff96cab814f0365f69a/evidence/843/README.md) |

Two independent kinds of MCP evidence exist and answer different questions. The
adapters repository qualifies conformance to the contract. This repository runs
the same adapter as a black box in a clean consumer and asks whether synthetic
plaintext stays out of the host's five sinks under adversarial workloads, and
what that costs; it is not the adapters' conformance suite and does not own the
compatibility matrix ([spec](mcp-qualification.md#what-it-answers)). No other
adapter boundary is measured here.

## Provenance of the measured evidence

Read a result together with its identity, never as "the adapter" in general.

| Run | Core | Adapters | Status of the packages |
| --- | --- | --- | --- |
| [`evidence/843/public-release-2026.09.26/`](https://github.com/redact-secret/redact-secret-benchmarks/blob/65ffe7dcb3e7124e7f66cff96cab814f0365f69a/evidence/843/public-release-2026.09.26/README.md) | `0.1.0-beta.8` (prerelease), tarball sha256 recorded | redact-secret-adapters `be3f2ad`: `adapter@0.1.2`, `adapter-ai-context@0.1.0-alpha.1`, `adapter-mcp@0.1.0-alpha.1`, content digests in [`public-release-pin.json`](https://github.com/redact-secret/redact-secret-benchmarks/blob/65ffe7dcb3e7124e7f66cff96cab814f0365f69a/evidence/843/public-release-2026.09.26/public-release-pin.json) | registry tarballs; the MCP and AI-context packages are alpha and the core is a beta prerelease, so nothing here is a released or stable claim |
| [`evidence/612/release-2026.09.25/`](https://github.com/redact-secret/redact-secret-benchmarks/blob/65ffe7dcb3e7124e7f66cff96cab814f0365f69a/evidence/612/release-2026.09.25/README.md) | `0.1.0-beta.8` | release-train rc head `cfc6ba5` tarballs | pre-publication candidate; superseded by the run above for `tools/call` |

Each run records the benchmark commit, the core and adapter tarball digests,
the adapters commit, the sha256 of the `compatibility.json` it read, the SDK
endpoint versions and the Node.js runtimes. The adapters' current record
declares later core endpoints (through `0.1.0-beta.11`) and a later commit than
these runs; an endpoint that no run here installed is not measured here, and a
candidate or unreleased artifact is reported as a candidate result, never as a
release. To refresh the evidence, rerun `npm run mcp:qualify` at an exact
adapters commit and core version; the new run is added beside these, and the
older ones are not edited.

## Result files carry no credential bytes

The MCP qualification report holds outcomes, sink-level verdicts, counts, check
names and timings only (`schemas/mcp-qualification-v1.json`). The runner scans
its own report and Markdown for every synthetic value and every 12-character
fragment and refuses to write one that contains any; the workloads build the
values at run time and never write them literally, which
`tests/mcp-qualification.test.mjs` asserts. The rule for any new adapter
evidence is the same: exact artifact versions and digests, host SDK endpoints,
the destination or sink checked, the verdict and where it came from, and no
matched value or raw scanner output.

## Why there is no public adapter qualification schema or ranking

The issue allows a small public schema only if warranted. It is not, today:

- the authoritative per-package, per-endpoint record already exists and is
  machine-checked in the adapters repository (`compatibility.json`); a second
  schema here would duplicate it and could drift from it;
- the only adapter measurement made here, MCP, already has a versioned report
  schema with exact artifact digests and provenance (`mcp-qualification-v1`);
- a cross-adapter table of results would invite reading unlike host checks as
  one score, which this page exists to prevent.

If a public adapter view is later wanted, it should link to the adapters
record per package and endpoint (artifact version, host SDK endpoint, tested
destination fields, result, provenance) and carry no aggregate or rank. That
would be a new decision, opened when a second adapter is measured here.
