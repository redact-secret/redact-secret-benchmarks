# Final beta.9 RC size review

**Result:** accepted tradeoff under the existing candidate-bound regression
policy. This record applies only to core commit
`93ddf510a31563d58c7d4c202363ef65c4d92d55` and trigger
`size/cli/aarch64-unknown-linux-gnu`; the 5% budget is unchanged.

## Immutable inputs

- Core Artifact qualification run
  [36233877397](https://github.com/redact-secret/redact-secret/actions/runs/36233877397),
  source `93ddf510a31563d58c7d4c202363ef65c4d92d55`, succeeded. Its
  `artifact-inventory` reports 930,616 bytes and SHA-256
  `afd52fe2d45108e19e0764751605b7465d6c51f1588d378be088d1631df45d3d`
  for `cli-aarch64-unknown-linux-gnu/redact-secret`.
- The frozen `0.1.0-beta.8` baseline is 863,848 bytes. The 5% allowance is
  43,192.4 bytes, so the limit is 907,040.4 bytes. The RC is 66,768 bytes
  (+7.729%) over baseline and 23,575.6 bytes over the limit.
- The predecessor accepted at `6b124ac50803fe35aad99abbb2dbe89c32f5f284`
  measured 930,576 bytes. The RC adds 40 bytes (+0.0043%) to the file.

## Same footprint, independently reviewed candidate

`objdump -p` over the two workflow artifacts shows the same two 64 KiB-aligned
load segments and the same second segment offset (`0xa9490`). The writable
segment is byte-identical (`filesz 0x7558`, `memsz 0x7630`). The executable
segment changes from `0x9a72c` to `0x9c8dc`: +8,624 bytes (+1.35%), still
inside the ordinary loadable-code growth described by the original decision.
The alignment step, rather than a new step in shipped file size, remains the
reason the 5% trigger is crossed.

Across Artifact qualification inventories, all other changed shipped binaries
are within 0.33% of `6b124ac`; unchanged rows remain byte-identical. The exact
RC's Artifact qualification and cross-runtime determinism jobs passed. The
exact-candidate benchmark run scanned 2,990/2,990 fixtures without a required
positive or policy miss, and benchmark performance run
[36234366213](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36234366213)
accepted all 10 latency, 10 initialization and 16 memory triggers.

The RC retains the detector gains linked by the original acceptance and adds
the reviewed MCP resources/read and key-aware sanitization boundary plus the
recalibrated, non-enforcing shadow scorer. The ledger therefore records a new
entry for this exact candidate instead of reusing the `6b124ac` entry. A later
candidate must be judged again.
