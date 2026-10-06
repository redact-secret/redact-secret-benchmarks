# Scope accounting

Mode: **published** · origin: official run 37296823599 (engine v0.1.0-alpha.5), linux-x64, snapshot-2026.10.05, plain run

Counts are the engine's (credential-eval ADR 0016) over the findings each artifact retains. Nothing was re-classified, filtered or scored here; an unresolved type is neither a false positive nor ignored; a profile is a separate configuration, not a speed-up; Unknown means no accounting was recorded, not zero.

## baseline-alpha.5

Engine 0.1.0-alpha.5 · credential-eval-protocol/1 · run class official · config sha256:2451ce7bf380 · evidence snapshot-2026.10.05

| Scanner | Configuration | State | Retained findings | Native label | Mapped credential | Credential-related unmapped | Out of scope | Ambiguous | Label unavailable | Unrecognized label |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flare-redact | default · sha256:f111f4606c91 | legacy-native-label-unavailable | 1,461 | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| gitleaks | default · sha256:f091a51ed948 | legacy-native-label-unavailable | 2,697 | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| openredaction | default · sha256:b1db3e9c340b | legacy-native-label-unavailable | 360,782 | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| redact-secret | default · sha256:e8d78f1359d1 | legacy-native-label-unavailable | 3,558 | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| trufflehog | default · sha256:d077d8241c93 | legacy-native-label-unavailable | 1,073 | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |

