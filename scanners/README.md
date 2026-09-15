# scanners

Per-tool invocation adapters (redact-secret, Gitleaks, TruffleHog) that run a
scanner against the materialized `fixtures/` corpus and normalize its output
to the common ground-truth schema for scoring.

Empty for now — tracked as an issue in this repository. No adapter here may
vendor or bundle a third-party scanner's source; each shells out to that
tool's own released binary.
