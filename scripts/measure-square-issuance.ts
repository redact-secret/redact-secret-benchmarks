import { readStdinCredential, runSquareIssuanceCheck } from '../benchmarks/support/square-issuance.ts';

// Structure-only issuance check for a Square key the maintainer issued himself (#584). The value is read from standard
// input only. See docs/specs/square-issuance-check.md.
process.exitCode = await runSquareIssuanceCheck(process.argv.slice(2), {
  readSecret: () => readStdinCredential(),
  stdout: process.stdout,
  stderr: process.stderr,
});
