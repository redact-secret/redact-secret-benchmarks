# Final beta.9 source-bound size review

**Result:** accepted tradeoff under the existing candidate-bound regression
policy. This record applies only to core commit
`09e1d7f85cd2ada9f387cc5c9beef3b29023d17d` and trigger
`size/cli/aarch64-unknown-linux-gnu`; the 5% budget is unchanged.

## Immutable input

Core Artifact qualification run
[36243644354](https://github.com/redact-secret/redact-secret/actions/runs/36243644354)
succeeded for the exact source above. Its `artifact-inventory` records 930,616
bytes and SHA-256
`afd52fe2d45108e19e0764751605b7465d6c51f1588d378be088d1631df45d3d`
for `cli-aarch64-unknown-linux-gnu/redact-secret`.

The frozen `0.1.0-beta.8` baseline is 863,848 bytes. The 5% limit is
907,040.4 bytes, so this candidate remains 66,768 bytes (+7.729%) over the
baseline and 23,575.6 bytes over the trigger.

## Byte-identical footprint, fresh source decision

The CLI byte count and SHA-256 are identical to the separately reviewed
`93ddf510a31563d58c7d4c202363ef65c4d92d55` candidate. Consequently its
executable and writable segments, 64 KiB alignment step, and second load
segment offset are also identical. No new shipped-code or alignment growth is
being accepted here.

The source identity changed because PR
[#852](https://github.com/redact-secret/redact-secret/pull/852) corrected the
release-contract documentation and made artifact inventories bind the beta.9
public-contract review. Artifact qualification and SAST were rerun for that
source. Because the regression ledger is source-candidate-bound, this record
adds an exact row rather than inheriting the earlier acceptance implicitly.

The reviewed tradeoff is unchanged: retain the beta.9 detector pack and its
MCP, key-aware sanitization and non-enforcing shadow-scoring boundary without
widening the 5% size budget. A later source candidate must be judged again.
