# Bounded local peer observations

This records public synthetic family/type and range observations, not official measurement, product qualification, independent corpus diversity or an overall winner. The existing runtime preview remains a throughput observation.

## Exact inputs and execution

The producer is [pii-peer-observations.mjs](../../scripts/pii-peer-observations.mjs). It verifies the published npm archives against the committed lockfile SHA-512 integrity, checks that each extracted archive tree equals the installed package tree, and retains the same package tree after execution. The [record](../../benchmarks/pii-peer-comparison/record.json) contains those identities, default configuration and archive hashes. The measured packages are flare-redact **1.6.1** and OpenRedaction **1.1.5**.

The replay engine is pii-eval `b1c097e40bad456e52f904f626cca00b69c45612`, built locally for darwin-arm64, binary SHA-256 `3bb255edc4775cfd7f92ab937f126c478d8aaa9c2437ea88c59236202e98d4d9`. This binary is distinct from the pinned Linux official engine. No official workflow, protected data or EC2 execution was used.

Each peer was actually executed twice on each frozen B11 population: oracle-plan **146**, qualification-plan **266**, diagnostic-balanced **477**, and benign-heavy-stress **299** memberships. That is **1,188 memberships per peer**, **4,752 API calls** across both peers and both replays, and **8 public replay artifacts**. These overlapping populations must not be pooled as independent samples. Their authored range-less uncertainty counts remain **51 / 36 / 49 / 20**, totaling **156 memberships per peer**; these are bound to the authored comparison plan and recomputed by the source check, rather than inferred from type-miss metric counters.

## Reviewed mapping and limits

Flare uses `scan(text, { includeValues: false })`, retaining its defaults: email, obfuscated email and payment-card detectors enabled; phone and network detectors disabled; no IBAN or SSN detector. Missing detections remain in the same six-family authored denominator. Per-family capabilities remain **undeclared**, never silently marked unsupported to remove misses.

OpenRedaction uses `new OpenRedaction().detect(text)` with defaults, including context analysis, false-positive filtering and confidence threshold **0.5**, in a clean working directory without learned state. Exact EMAIL, CREDIT_CARD, IBAN, SSN, IPV4/IPV6 and four full phone-pattern types map to the six benchmark families. Its international phone scope is broader than the authored +1/NANP phone truth. Partial PHONE_LINE_NUMBER and all other unmapped labels are counted separately; no family is guessed for them.

Both APIs' original end-exclusive UTF-16 spans are converted to UTF-8 byte ranges. Astral characters, Korean prefixes and CRLF were checked against actual package results; split surrogate boundaries fail closed. Obfuscated-email spans are retained as reported, without rewriting them to an authored plain-email range. Severity, confidence and redacted output never become sensitivity or action claims. Those axes are unsupported/unavailable and their metrics are withheld; schema-only method restrictions and existing unresolved truth remain intact.

An independent source review accepted this mapping. A pinned-engine synthetic replay verified that a missing finding with an undeclared family becomes a type miss, whereas an explicitly unsupported classification becomes not measured. This review does not establish diverse neutral ground truth, sensitivity/context equivalence, a release-canonical peer adapter or support thresholds. [Issue #576](https://github.com/redact-secret/redact-secret-benchmarks/issues/576) therefore remains open.

## Consumption and verification

[peer-comparison.mjs](../../benchmarks/evaluation/domains/pii/peer-comparison.mjs) accepts only the separate exploratory record, two peer pin sets and eight public artifacts. It verifies the exact reviewed mappings/defaults, package integrity pins, local engine binary, artifact bytes, scanner identities, complete agreeing two-replay capabilities, frozen population/roster identities and authored counts. The existing authority and official records are untouched. Full metrics and bounds remain in the linked per-peer/per-view public artifacts; the UI summarizes scope and configuration rather than duplicating every cell.

```sh
node --import tsx scripts/pii-peer-observations.mjs --check
node --import tsx --test tests/pii-peer-comparison.test.mjs tests/pii-peer-observations.test.mjs
```

Fresh local execution requires the pinned binary and integrity-verified package archives, and refuses existing output directories:

```sh
node --import tsx scripts/pii-peer-observations.mjs \
  --engine=results-output/pii-requalification/engine-source/target/release/pii-eval \
  --out=results-output/pii-peer-comparison/FRESH_DIRECTORY \
  --flare-archive=/tmp/flare-redact-1.6.1.tgz \
  --openredaction-archive=/tmp/openredaction-core-1.1.5.tgz
```

The optional pinned-engine capability proof takes `PII_PEER_ENGINE` and `PII_PEER_CAPABILITY_FIXTURE`, the latter naming a generated peer/view directory with snapshot, manifest and observation files. It runs two deliberately empty synthetic observation sets and makes no claims about an actual scanner's output.
