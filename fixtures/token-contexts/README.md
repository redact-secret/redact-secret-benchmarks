# GitHub token contexts

Draft controlled experiment, pending independent human review. This is a
single synthetic token family in environment, JSON, Unicode-prefix, and CRLF
contexts, plus two negative controls. All scanners receive identical files.

The token is constructed as `ghp_` followed by the first 36 hexadecimal
characters of SHA-256 of the literal benchmark-only seed
`redact-secret-benchmarks:never-issued-positive-control:v1`. It was never
issued by GitHub and must never be verified against a provider. This recipe
reconstructs only a synthetic test value, not a real credential.

Expected byte ranges are determined from the authored inputs, not scanner
output. This category establishes narrow detection behavior for a complete
token shape; it does not measure realistic provider coverage or rank tools.
The original starter corpus remains unchanged for a separate comparison.
