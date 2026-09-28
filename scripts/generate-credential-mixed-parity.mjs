// Regenerate (or --check) the frozen #381 credential mixed-document parity plan from its authored rule.
// The plan binds every fixture line by content and line digest only; `npm run fixtures:generate` provides the values.
// Usage: node --import tsx scripts/generate-credential-mixed-parity.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { CREDENTIAL_MIXED_PARITY_PLAN_FILE, buildCredentialMixedParityPlan, loadCorpora } from '../benchmarks/evaluation/domains/credential/mixed-parity/authoring.ts';

export function renderCredentialMixedParityPlan() {
  return `${JSON.stringify(buildCredentialMixedParityPlan(loadCorpora(), contracts), null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = renderCredentialMixedParityPlan();
  if (process.argv.includes('--check')) {
    if (await readFile(CREDENTIAL_MIXED_PARITY_PLAN_FILE, 'utf8').catch(() => null) !== text) {
      console.error(`${CREDENTIAL_MIXED_PARITY_PLAN_FILE} drifted from its authored rule`);
      process.exit(1);
    }
    console.log('credential mixed parity plan matches its authored rule');
  } else {
    await writeFile(CREDENTIAL_MIXED_PARITY_PLAN_FILE, text);
    console.log(`wrote ${CREDENTIAL_MIXED_PARITY_PLAN_FILE}`);
  }
}
