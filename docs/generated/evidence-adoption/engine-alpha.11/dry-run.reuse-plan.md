# Accuracy reuse plan: public-evidence-snapshot

Verdict **plan** · change **no-archive** · run class **official-eligible** · performance measurements launched **0**

## Fallback (shown before execution)

A fresh accuracy run of the whole population: no observation archive is selected for this population.

## Scanners

| Scanner | Origin | Reason | Changed identity | Receipt |
| --- | --- | --- | --- | --- |
| flare-redact | fresh | no-archive | - | - |
| gitleaks | fresh | no-archive | - | - |
| openredaction | fresh | no-archive | - | - |
| redact-secret | fresh | product-under-test | - | - |
| trufflehog | fresh | no-archive | - | - |

## Measured input identity

- target `sha256:44e316a391b1d8fa933113c41cf19004d08127bbede1d17c397796a38549d9fc`
- archive `none`
- source release provenance: none (provenance only; it never forces a scan)

## Missing evidence

- no verified observation archive for public-evidence-snapshot

## Saved

- scans not launched: 0 (0 scanner(s) reused, 5 fresh)
- runner-minutes not spent: 0 (the reused observations' recorded durations, non-semantic)
