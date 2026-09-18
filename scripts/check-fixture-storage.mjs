import { execFileSync } from 'node:child_process';

const paths = execFileSync('git', ['ls-files', '-z', '--', 'fixtures/generated'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const holdout = execFileSync('git', ['ls-files', '-z', '--', 'holdout/generated'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const materialized = [...paths.filter(p => p.endsWith('.json')), ...holdout];
if (materialized.length) {
  console.error('Generated credential inputs and private holdout state must not be staged or tracked. Commit generators and manifest metadata instead.');
  process.exitCode = 1;
} else console.log('Fixture storage: generators and hashes only; no generated credential JSON tracked.');
