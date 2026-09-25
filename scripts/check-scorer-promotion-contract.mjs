/**
 * CI gate (#257): the statistical scorer's future-promotion qualification
 * contract (benchmarks/scorer-promotion-contract.json) satisfies
 * schemas/scorer-promotion-contract-v1.json and the rules in
 * benchmarks/lib/scorer-promotion.ts: questions 1-5 are answered separately,
 * every required dimension is gated, zero-tolerance bounds are not loosened,
 * no scorer weight or cut-off appears, the #289 aggregate fields match their
 * schema, and a content change carries a new contract version.
 * Rules: docs/specs/scorer-promotion-gates.md.
 *
 * Run: npm run scorer-promotion:check
 */
import { fileURLToPath } from 'node:url';
import { CONTRACT_PATH, loadPromotionContract, validatePromotionContract } from '../benchmarks/lib/scorer-promotion.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const contract = loadPromotionContract(root);
const problems = validatePromotionContract(contract);

if (problems.length) {
  console.error(`Scorer promotion contract check failed (${CONTRACT_PATH}):\n${problems.map(p => `  - ${p}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Scorer promotion contract check passed: ${CONTRACT_PATH} v${contract.contractVersion}, ${contract.gates.length} hard constraints over questions Q1-Q5; beta.9 passes without Q5.`);
}
