// Regenerate (or --check) the frozen #427 mixed-document parity plans and their expectations from the authored truth.
// v1 (frozen at 163f4ec) is never changed; v2 is derived from it after redact-secret#930 and promotes the decided envelopes.
// Credential lines are bound by fixture id and content digest only; `npm run fixtures:generate -- --ensure` provides them.
// Usage: node --import tsx scripts/generate-pii-mixed-parity.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { MIXED_PARITY_PLAN_FILES, buildMixedParityPlan, buildMixedParityPlanV2 } from '../benchmarks/evaluation/domains/pii/mixed-parity/authoring.ts';
import { freezeExpectations, loadCredentialFixtures, planCommitment } from '../benchmarks/evaluation/domains/pii/mixed-parity/parity.ts';

export function renderMixedParityPlan(version = 1) {
  const credentials = loadCredentialFixtures();
  const v1 = freezeExpectations(buildMixedParityPlan(credentials), credentials);
  if (version === 1) return `${JSON.stringify(v1, null, 2)}\n`;
  const { expected: _expected, ...base } = v1;
  return `${JSON.stringify(freezeExpectations(buildMixedParityPlanV2(base, planCommitment(v1)), credentials), null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let drift = 0;
  for (const [version, file] of Object.entries(MIXED_PARITY_PLAN_FILES)) {
    const text = renderMixedParityPlan(Number(version));
    if (process.argv.includes('--check')) {
      if (await readFile(file, 'utf8').catch(() => null) !== text) { console.error(`${file} drifted from its authored truth`); drift += 1; }
    } else if (Number(version) === 1 && await readFile(file, 'utf8').catch(() => null) !== text) {
      console.error(`${file} is frozen and would change; refusing`); drift += 1;
    } else await writeFile(file, text);
  }
  if (drift) process.exit(1);
  console.log(process.argv.includes('--check') ? 'mixed parity plans match their authored truth' : 'wrote mixed parity plans');
}
