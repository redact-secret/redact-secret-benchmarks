## Execution plan (accuracy): plan

A dry run: nothing below has been started.

Changed files: 1. scanner-pin 1.

| | Executed | Reused | Re-scored | Jobs | Engine runs / invocations | Peer processes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accuracy (scanner x population) | 15 | 0 | 0 | 3 | 8 | n/a |

Runner-minutes (historical telemetry): 53.06 known. Reported apart from wall-clock latency.

### Dispatch (separate workflows, one per axis)

- accuracy: `gh workflow run official-runs.yml --ref <branch> -f mode=full` (public-evidence-snapshot, regression-corpus, policy-corpus)

### Accuracy

| Population | Action | Scanner | Origin | Reason |
| --- | --- | --- | --- | --- |
| public-evidence-snapshot | fresh | flare-redact | fresh | official-lane-measures-every-scanner |
| public-evidence-snapshot | fresh | gitleaks | fresh | official-lane-measures-every-scanner |
| public-evidence-snapshot | fresh | openredaction | fresh | official-lane-measures-every-scanner |
| public-evidence-snapshot | fresh | redact-secret | fresh | product-under-test |
| public-evidence-snapshot | fresh | trufflehog | fresh | official-lane-measures-every-scanner |
| regression-corpus | fresh | flare-redact | fresh | official-lane-measures-every-scanner |
| regression-corpus | fresh | gitleaks | fresh | official-lane-measures-every-scanner |
| regression-corpus | fresh | openredaction | fresh | official-lane-measures-every-scanner |
| regression-corpus | fresh | redact-secret | fresh | product-under-test |
| regression-corpus | fresh | trufflehog | fresh | official-lane-measures-every-scanner |
| policy-corpus | fresh | flare-redact | fresh | official-lane-measures-every-scanner |
| policy-corpus | fresh | gitleaks | fresh | official-lane-measures-every-scanner |
| policy-corpus | fresh | openredaction | fresh | official-lane-measures-every-scanner |
| policy-corpus | fresh | redact-secret | fresh | product-under-test |
| policy-corpus | fresh | trufflehog | fresh | official-lane-measures-every-scanner |

### Missing evidence

- public-evidence-snapshot: no verified observation archive for public-evidence-snapshot

