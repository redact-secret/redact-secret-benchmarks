// Regenerate (or --check) the frozen #427 mixed-document parity plan and its expectations from the authored truth.
// Credential lines are bound by fixture id and content digest only; `npm run fixtures:generate -- --ensure` provides them.
// Usage: node --import tsx scripts/generate-pii-mixed-parity.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { MIXED_PARITY_PLAN_FILE, buildMixedParityPlan } from '../benchmarks/evaluation/domains/pii/mixed-parity/authoring.ts';
import { freezeExpectations, loadCredentialFixtures } from '../benchmarks/evaluation/domains/pii/mixed-parity/parity.ts';

export function renderMixedParityPlan() {
  const credentials = loadCredentialFixtures();
  return `${JSON.stringify(freezeExpectations(buildMixedParityPlan(credentials), credentials), null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = renderMixedParityPlan();
  if (process.argv.includes('--check')) {
    if (await readFile(MIXED_PARITY_PLAN_FILE, 'utf8').catch(() => null) !== text) { console.error(`${MIXED_PARITY_PLAN_FILE} drifted from its authored truth`); process.exit(1); }
    console.log('mixed parity plan matches its authored truth');
  } else { await writeFile(MIXED_PARITY_PLAN_FILE, text); console.log(`wrote ${MIXED_PARITY_PLAN_FILE}`); }
}
