import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { t3PeerRowFailures, t3Sections } from '../benchmarks/lib/t3-comparison.ts';

const DEFAULT_MODE = `### Must redact · T1 Provider-documented

| Scanner | Files | Spans | Leaked spans | Leaked span rate | Collateral ratio | Twins discriminated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| redact-secret | 10 | 10 | 0 | 0.0% | 0.000 | 5 / 5 |
| gitleaks | 10 | 10 | 2 | 20.0% | 0.000 | 3 / 5 |

### Must not flag · T3 Project policy

> This project’s own numbers only. T3 is this project’s masking policy: a peer positive here is out of scope by design, not a defect, so peer columns are an explicit opt-in (\`npm run baseline:report -- --include-t3-peers\`).

| Scanner | Files | False alarms | Rate |
| --- | ---: | ---: | ---: |
| redact-secret | 350 | 0 | 0.0% |

### Policy · T3 Project policy

> This project’s own numbers only. T3 is this project’s masking policy: a peer positive here is out of scope by design, not a defect, so peer columns are an explicit opt-in (\`npm run baseline:report -- --include-t3-peers\`).

| Scanner | Files | Spans | Leaked spans | Leaked span rate | Collateral ratio | Twins discriminated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| redact-secret | 350 | 350 | 0 | 0.0% | — | — |
`;

const FLAGGED_MODE = `### Policy · T3 Project policy

> T3 is this project’s masking policy, never compared with provider-documented formats. A peer’s rate below reflects scope — it is not built to flag this — not accuracy.

| Scanner | Files | Spans | Leaked spans | Leaked span rate | Collateral ratio | Twins discriminated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| redact-secret | 350 | 350 | 0 | 0.0% | — | — |
| gitleaks | 350 | 350 | 150 | 42.9% | — | — |
| trufflehog | 350 | 350 | 280 | 80.0% | — | — |
| flare-redact | 350 | 350 | 223 | 63.7% | — | — |
`;

test('t3Sections finds every T3 heading and counts its data rows', () => {
  assert.deepEqual(t3Sections(DEFAULT_MODE), [
    { heading: 'Must not flag', rows: 1 },
    { heading: 'Policy', rows: 1 },
  ]);
});

test('T1 sections are never inspected, even with several scanner rows', () => {
  assert.deepEqual(t3PeerRowFailures(DEFAULT_MODE.split('### Must not flag')[0]), []);
});

test('a default-mode comparison with one row per T3 section passes', () => {
  assert.deepEqual(t3PeerRowFailures(DEFAULT_MODE), []);
});

test('a T3 section with peer rows fails, by heading', () => {
  const failures = t3PeerRowFailures(FLAGGED_MODE);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^Policy · T3: 4 scanner rows/);
});

test('the real committed comparison never carries a T3 peer row', async () => {
  const markdown = await readFile(new URL('../docs/generated/release-comparison.md', import.meta.url), 'utf8');
  assert.deepEqual(t3PeerRowFailures(markdown), []);
});
