import { readHiddenCredential, runObservationCapture } from '../benchmarks/support/observation-capture.ts';

process.exitCode = await runObservationCapture(process.argv.slice(2), {
  readSecret: readHiddenCredential,
  stdout: process.stdout,
  stderr: process.stderr,
});
