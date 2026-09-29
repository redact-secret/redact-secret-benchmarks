---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: new-relic
families:
  - id: new-relic:user-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.newrelic.com/docs/infrastructure-as-code/terraform/terraform-intro/
      issues:
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: "The NRAK- prefix is T1 but the provider says most user keys carry it, so unprefixed user keys are possible; the 27-character uppercase-alphanumeric body is tool-corroborated."
  - id: new-relic:license-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.newrelic.com/docs/opentelemetry/integrations/ibm-mq/host/
        - https://docs.newrelic.com/docs/ebpf/k8s-installation/
        - https://docs.newrelic.com/docs/ebpf/linux-installation/
      issues:
        - redact-secret/redact-secret#656
        - redact-secret/redact-secret#672
        - redact-secret/redact-secret#754
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/656/README.md
      researchedAt: 2026-09-24
    blockedBy: "The NRAL suffix and total length 40 are T1; the hex body, the FFFF segment and the eu01xx region prefix are provider-code and tool corroborated, and the canonical API-keys page still says 40-character hexadecimal."
---

# New Relic

New Relic issues user API keys (`NRAK-` prefix, sent as `Api-Key`) and ingest license keys used by agents and log shippers. Provider documentation: the
[Terraform intro](https://docs.newrelic.com/docs/infrastructure-as-code/terraform/terraform-intro/) page for the user key prefix and the
[IBM MQ host integration](https://docs.newrelic.com/docs/opentelemetry/integrations/ibm-mq/host/) page for the license key suffix.

## Families

### `new-relic:user-api-key` — User API key

- **Shape:** prefix `NRAK-` then 27 uppercase alphanumeric characters. The provider text is "Most user keys begin with the prefix NRAK-", so a user key without it is a false negative the provider documents as possible.
- **Sources:** T1 for the prefix (docs.newrelic.com, quote re-fetched 2026-09-23; the page's provider block shows a masked `NRAK-***` placeholder). Body length and alphabet are tool-corroborated.
- **Issuance:** not attempted.
- **Collisions:** `NRAK-` appears in one New Relic docs page as the expected prefix of a license key, which reads as a documentation error.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence in the [#642 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md).

### `new-relic:license-key` — License key

- **Shape:** current generation: 32 lowercase hex characters then the literal `FFFFNRAL` (40 total), or the EU form `eu01xx` + 26 hex + `FFFFNRAL`. The first `NRAL` generation (36 hex + `NRAL`, labelled `_OLD` by New Relic's docs scanner) and other region prefixes are not covered. The legacy all-hex 40-character key has no marker and stays keyword-gated. The taxonomy description ("40-character hexadecimal") matches the older canonical page.
- **Sources:** T1 for the suffix and length: a docs.newrelic.com comment says "New Relic ingest license key (40 chars, suffix NRAL)"; two eBPF pages show elided examples ending `FFFFNRAL` and the docs style guide uses 32 masked characters then `FFFFNRAL`. The canonical API-keys page still says "40-character hexadecimal string", which contradicts `NRAL` unless it describes the legacy key. Body, `FFFF` and `eu01xx`: New Relic-authored code (newrelic-cli `IsValidLicenseKeyFormat`, docs-website key checker) and TruffleHog 3.97.4.
- **Issuance:** not attempted; an empirical check of one or two fresh `Ingest - License` keys is specified in the #656 web-search pass.
- **Collisions:** the legacy shape collides with SHA-1 digests and commit ids; suffixed shapes need no same-line keyword after [redact-secret#754](https://github.com/redact-secret/redact-secret/issues/754).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row `new-relic:license-key`); evidence [#656 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/656/README.md).

## Candidates that are not families yet

- **Other New Relic key types** (for example browser and Insights keys): not researched here; no taxonomy entry.

## Open questions

1. Should the T1 contract keep `FFFF` (detector, TruffleHog) or only `NRAL` (the provider source)?
2. Is the 36-hex `NRAL` generation still issued?
3. Which prefix set do EU and other regions use beyond `eu01xx`?
4. Two docs pages disagree (`hexadecimal`, `NRAK-`-prefixed license key); provider clarification would settle both.

## Research log

- [redact-secret#642](https://github.com/redact-secret/redact-secret/issues/642) — first T1 re-tier batch; the `NRAK-` prefix was re-fetched live 2026-09-23.
- [redact-secret#656](https://github.com/redact-secret/redact-secret/issues/656) — license key T1 evidence: FOUND for suffix and total length (2026-09-23).
- [redact-secret#672](https://github.com/redact-secret/redact-secret/issues/672) — product fix for the 32/`FFFFNRAL` shape (closed 2026-09-23).
- [redact-secret#754](https://github.com/redact-secret/redact-secret/issues/754) — product fix: suffixed shapes no longer need a New Relic keyword on the line (closed 2026-09-24).
